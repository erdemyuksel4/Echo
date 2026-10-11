import { app, BrowserWindow, ipcMain } from 'electron';
import { autoUpdater } from 'electron-updater';
import { is } from '@electron-toolkit/utils';

let targetWindow: BrowserWindow | null = null;
let isInitialized = false;

import { appendFileSync } from 'fs';
import { join } from 'path';

function getUpdaterLogPath(): string {
  try {
    return join(app.getPath('userData'), 'updater.log');
  } catch {
    return join(process.cwd(), 'updater.log');
  }
}

function writeLog(level: string, message: string): void {
  try {
    const entry = `[${new Date().toISOString()}] [${level}] ${message}\n`;
    appendFileSync(getUpdaterLogPath(), entry, 'utf8');
  } catch {}
}

const updaterLogger = {
  info: (msg: string): void => {
    console.log('[Echo Updater]', msg);
    writeLog('INFO', msg);
  },
  warn: (msg: string): void => {
    console.warn('[Echo Updater]', msg);
    writeLog('WARN', msg);
  },
  error: (msg: string): void => {
    console.error('[Echo Updater]', msg);
    writeLog('ERROR', msg);
  },
  debug: (msg: string): void => {
    writeLog('DEBUG', msg);
  },
};

// Configure autoUpdater
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;
autoUpdater.disableWebInstaller = true;
autoUpdater.disableDifferentialDownload = false;
autoUpdater.logger = updaterLogger;

// Use GitHub provider so electron-updater can resolve both current and old version blockmaps by tag:
// e.g. /releases/download/v0.1.48/... and /releases/download/v0.1.47/....blockmap
// This enables true differential (delta) updates (~1-5MB instead of full ~86MB installer).
autoUpdater.setFeedURL({
  provider: 'github',
  owner: 'erdemyuksel4',
  repo: 'Echo',
});

export async function checkForUpdate(): Promise<{ available: boolean; version?: string }> {
  const currentVersion = app.getVersion();
  console.log(`[Echo Updater] Checking for updates (current version: v${currentVersion})...`);

  if (!app.isPackaged || is.dev) {
    console.log('[Echo Updater] Skipped update check in development/unpackaged mode.');
    if (targetWindow && !targetWindow.isDestroyed()) {
      targetWindow.webContents.send('updater:status', {
        status: 'not-available',
        version: currentVersion,
      });
    }
    return { available: false, version: currentVersion };
  }

  if (targetWindow && !targetWindow.isDestroyed()) {
    targetWindow.webContents.send('updater:status', { status: 'checking' });
  }

  try {
    const result = await autoUpdater.checkForUpdates();
    const updateInfo = result?.updateInfo;
    if (updateInfo) {
      return {
        available: updateInfo.version !== currentVersion,
        version: updateInfo.version,
      };
    }
    return { available: false, version: currentVersion };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.warn('[Echo Updater] Check for updates failed:', errorMsg);
    if (targetWindow && !targetWindow.isDestroyed()) {
      targetWindow.webContents.send('updater:status', {
        status: 'error',
        error: errorMsg,
      });
    }
    return { available: false };
  }
}

export function initAutoUpdater(window: BrowserWindow): void {
  targetWindow = window;

  if (isInitialized) {
    return;
  }
  isInitialized = true;

  autoUpdater.on('checking-for-update', () => {
    writeLog('INFO', 'Checking for update...');
    if (targetWindow && !targetWindow.isDestroyed()) {
      targetWindow.webContents.send('updater:status', { status: 'checking' });
    }
  });

  autoUpdater.on('update-available', (info) => {
    writeLog('INFO', `Update available: v${info.version}`);
    const releaseNotes =
      typeof info.releaseNotes === 'string'
        ? info.releaseNotes
        : Array.isArray(info.releaseNotes)
          ? info.releaseNotes.map((n) => (typeof n === 'string' ? n : n.note)).join('\n')
          : undefined;

    if (targetWindow && !targetWindow.isDestroyed()) {
      targetWindow.webContents.send('updater:status', {
        status: 'available',
        version: info.version,
      });
      targetWindow.webContents.send('updater:available', {
        version: info.version,
        releaseNotes,
      });
    }
  });

  autoUpdater.on('update-not-available', (info) => {
    writeLog('INFO', `App is up to date: v${info.version}`);
    if (targetWindow && !targetWindow.isDestroyed()) {
      targetWindow.webContents.send('updater:status', {
        status: 'not-available',
        version: info.version,
      });
    }
  });

  autoUpdater.on('download-progress', (progressObj) => {
    const percent = Math.round(progressObj.percent);
    const bytesPerSecond = Math.round(progressObj.bytesPerSecond);
    const transferred = progressObj.transferred;
    const total = progressObj.total;

    writeLog(
      'PROGRESS',
      `Progress: ${percent}% (${(transferred / (1024 * 1024)).toFixed(2)}MB / ${(total / (1024 * 1024)).toFixed(2)}MB) at ${(bytesPerSecond / 1024).toFixed(0)} KB/s`
    );

    if (targetWindow && !targetWindow.isDestroyed()) {
      targetWindow.webContents.send('updater:status', {
        status: 'downloading',
        percent,
      });
      targetWindow.webContents.send('updater:progress', {
        percent,
        bytesPerSecond,
        transferred,
        total,
      });
    }
  });

  autoUpdater.on('update-downloaded', (info) => {
    writeLog('INFO', `Update downloaded successfully: v${info.version}`);
    if (targetWindow && !targetWindow.isDestroyed()) {
      targetWindow.webContents.send('updater:status', {
        status: 'downloaded',
        version: info.version,
      });
      targetWindow.webContents.send('updater:downloaded', {
        version: info.version,
      });
    }
  });

  autoUpdater.on('error', (err) => {
    writeLog('ERROR', `AutoUpdater error: ${err.message} \n${err.stack || ''}`);
    if (targetWindow && !targetWindow.isDestroyed()) {
      targetWindow.webContents.send('updater:status', {
        status: 'error',
        error: err.message,
      });
    }
  });

  // IPC Handlers
  ipcMain.handle('updater:check', async () => {
    return await checkForUpdate();
  });

  ipcMain.handle('updater:download', async () => {
    if (!app.isPackaged || is.dev) return null;
    try {
      return await autoUpdater.downloadUpdate();
    } catch (err) {
      console.warn('[Echo Updater] Manual downloadUpdate failed:', err);
      return null;
    }
  });

  ipcMain.handle('updater:install', () => {
    if (!app.isPackaged || is.dev) {
      console.log('[Echo Updater] Skipped quitAndInstall in development mode.');
      return;
    }
    console.log('[Echo Updater] Installing update and restarting...');
    if (targetWindow && !targetWindow.isDestroyed()) {
      targetWindow.removeAllListeners('close');
    }
    // isSilent: false, isForceRunAfter: true (app restarts automatically with new version)
    autoUpdater.quitAndInstall(false, true);
  });

  // Background check on startup if packaged
  if (!is.dev && app.isPackaged) {
    setTimeout(() => {
      void checkForUpdate().catch((err) => {
        console.warn('[Echo Updater] Initial background check failed:', err);
      });
    }, 2500);

    // Periodic check every 15 minutes
    setInterval(
      () => {
        void checkForUpdate().catch((err) => {
          console.warn('[Echo Updater] Periodic update check failed:', err);
        });
      },
      15 * 60 * 1000
    );
  }
}

