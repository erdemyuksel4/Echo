import { existsSync } from 'fs';
import { app, shell, BrowserWindow, ipcMain } from 'electron';
import { join } from 'path';
import { electronApp, optimizer, is } from '@electron-toolkit/utils';
import { APP_NAME, PROTOCOL_VERSION } from '@echo/shared';
import { IdentityManager } from './identity';

let mainWindow: BrowserWindow | null = null;

function getPreloadPath(): string {
  const mjsPath = join(__dirname, '../preload/index.mjs');
  if (existsSync(mjsPath)) return mjsPath;
  return join(__dirname, '../preload/index.js');
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    title: APP_NAME,
    webPreferences: {
      preload: getPreloadPath(),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });

  mainWindow.on('ready-to-show', () => {
    if (mainWindow) {
      mainWindow.show();
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
}

// Single Instance Lock
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  void app.whenReady().then(() => {
    electronApp.setAppUserModelId('com.echo.app');

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
