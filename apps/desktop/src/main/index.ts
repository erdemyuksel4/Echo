import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { app, shell, BrowserWindow, ipcMain, Tray, Menu, nativeImage, Notification, session, clipboard, desktopCapturer } from 'electron';
import { electronApp, optimizer, is } from '@electron-toolkit/utils';
import { APP_NAME, PROTOCOL_VERSION } from '@echo/shared';
import { IdentityManager } from './identity';
import { initAutoUpdater } from './updater';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Custom profile support for multi-user simulation (e.g. --profile=user2 or ECHO_PROFILE=user2)
const profileArg = process.argv.find((a) => a.startsWith('--profile='));
const profileName = process.env.ECHO_PROFILE || (profileArg ? profileArg.split('=')[1] : undefined);

if (profileName) {
  const customUserData = join(app.getPath('appData'), `Echo_${profileName}`);
  app.setPath('userData', customUserData);
}

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

function getPreloadPath(): string {
  const cjsPath = join(__dirname, '../preload/index.cjs');
  if (existsSync(cjsPath)) {
    console.log('[Echo Main] Preload found (cjs):', cjsPath);
    return cjsPath;
  }
  const mjsPath = join(__dirname, '../preload/index.mjs');
  if (existsSync(mjsPath)) {
    console.log('[Echo Main] Preload found (mjs):', mjsPath);
    return mjsPath;
  }
  const jsPath = join(__dirname, '../preload/index.js');
  console.log('[Echo Main] Preload fallback (js):', jsPath, 'exists:', existsSync(jsPath));
  return jsPath;
}

function createTray(): void {
  // 16x16 PNG fallback icon
  const icon = nativeImage.createFromBuffer(
    Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAAElEQVQ4T2Nk+M/wnwEHQEQY1UAMjAYg2QCkGD3k8BmA1IBRAwZcAE6n49MAl214NUA3eWjQ4wYgN4fQo8gYq0GjBshhAACd4iIRfF9RMAAAAABJRU5ErkJggg==',
      'base64',
    ),
  );

  tray = new Tray(icon);
  tray.setToolTip(profileName ? `${APP_NAME} (${profileName})` : APP_NAME);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: `${APP_NAME} Aç`,
      click: () => {
        if (mainWindow) {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Çıkış',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 680,
    minWidth: 700,
    minHeight: 500,
    x: profileName === 'user2' ? 940 : (profileName ? 980 : 30),
    y: 50,
    show: false,
    autoHideMenuBar: true,
    title: profileName ? `${APP_NAME} (${profileName})` : APP_NAME,
    webPreferences: {
      preload: getPreloadPath(),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });

  mainWindow.webContents.on('preload-error', (_event, preloadPath, error) => {
    console.error('[Echo Main] PRELOAD SCRIPT ERROR at:', preloadPath, error);
  });

  mainWindow.on('ready-to-show', () => {
    if (mainWindow) {
      mainWindow.show();
    }
  });

  // Minimize to tray on close if not quitting
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  // Strict CSP & External Links Handling
  mainWindow.webContents.setWindowOpenHandler((details) => {
    try {
      const url = new URL(details.url);
      if (url.protocol === 'https:') {
        void shell.openExternal(details.url);
      }
    } catch {
      // Ignore invalid URLs
    }
    return { action: 'deny' };
  });

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  initAutoUpdater(mainWindow);
}

// Single Instance Lock (disabled or isolated when testing with custom profiles)
const gotTheLock = profileName ? true : app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.on('before-quit', () => {
    isQuitting = true;
  });

  void app.whenReady().then(() => {
    electronApp.setAppUserModelId('com.echo.app');

    // Grant media (microphone) permission for WebRTC voice chat
    session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
      if (permission === 'media') {
        callback(true);
        return;
      }
      callback(false);
    });

    session.defaultSession.setPermissionCheckHandler((_webContents, permission) => {
      return permission === 'media';
    });

    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window);
    });

    const identityManager = new IdentityManager();

    // Handle basic IPC for app info
    ipcMain.handle('app:get-info', () => {
      return {
        appName: APP_NAME,
        protocolVersion: PROTOCOL_VERSION,
        appVersion: app.getVersion(),
        platform: process.platform,
      };
    });

    // Handle Identity IPC
    ipcMain.handle('identity:get', () => {
      return identityManager.getIdentity();
    });

    ipcMain.handle(
      'identity:create',
      (_, { displayName, avatarColor }: { displayName: string; avatarColor: string }) => {
        return identityManager.createIdentity(displayName, avatarColor);
      },
    );

    ipcMain.handle(
      'identity:signAuth',
      (_, { targetId, timestamp }: { targetId: string; timestamp: number }) => {
        return identityManager.signAuth(targetId, timestamp);
      },
    );

    ipcMain.handle('identity:signPayload', (_, { payload }: { payload: string }) => {
      return identityManager.signPayload(payload);
    });

    // Handle Notification & Badge IPC
    ipcMain.handle(
      'desktop:notify',
      (_, { title, body, silent }: { title: string; body: string; silent?: boolean }) => {
        if (Notification.isSupported()) {
          const notification = new Notification({
            title,
            body,
            silent: Boolean(silent),
          });
          notification.on('click', () => {
            if (mainWindow) {
              if (mainWindow.isMinimized()) mainWindow.restore();
              mainWindow.show();
              mainWindow.focus();
            }
          });
          notification.show();
        }
        return true;
      },
    );

    ipcMain.handle('desktop:setBadge', (_, { count }: { count: number }) => {
      if (app.setBadgeCount) {
        app.setBadgeCount(count);
      }
      return true;
    });

    ipcMain.handle('desktop:copyToClipboard', (_, { text }: { text: string }) => {
      clipboard.writeText(text);
      return true;
    });

    // Handle Desktop Capturer for Screen Sharing
    ipcMain.handle('desktop:getSources', async () => {
      const sources = await desktopCapturer.getSources({
        types: ['screen', 'window'],
        thumbnailSize: { width: 320, height: 180 },
        fetchWindowIcons: true,
      });

      return sources.map((s) => ({
        id: s.id,
        name: s.name,
        thumbnailDataUrl: s.thumbnail.toDataURL(),
        appIconDataUrl: s.appIcon ? s.appIcon.toDataURL() : null,
        isScreen: s.id.startsWith('screen:'),
      }));
    });

    // Handle Auto-Start (Windows Login Item)
    ipcMain.handle('desktop:getLoginItemSettings', () => {
      const settings = app.getLoginItemSettings();
      return { openAtLogin: settings.openAtLogin };
    });

    ipcMain.handle('desktop:setLoginItemSettings', (_, { openAtLogin }: { openAtLogin: boolean }) => {
      app.setLoginItemSettings({
        openAtLogin,
        openAsHidden: true,
      });
      return true;
    });

    createTray();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}
