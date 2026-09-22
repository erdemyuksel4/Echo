import { BrowserWindow, ipcMain } from 'electron';
import { autoUpdater } from 'electron-updater';
import { is } from '@electron-toolkit/utils';

let targetWindow: BrowserWindow | null = null;
let isInitialized = false;

export function initAutoUpdater(window: BrowserWindow): void {
  targetWindow = window;

  if (isInitialized) {
    return;
  }
  isInitialized = true;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    console.log('[Echo Updater] Checking for update...');
    if (targetWindow && !targetWindow.isDestroyed()) {
      targetWindow.webContents.send('updater:status', { status: 'checking' });
    }
  });

  autoUpdater.on('update-available', (info) => {
    console.log('[Echo Updater] Update available, downloading automatically:', info.version);
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
    console.log('[Echo Updater] Current version is up-to-date:', info.version);
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
    console.log(`[Echo Updater] Download progress: ${percent}% (${bytesPerSecond} B/s)`);

    if (targetWindow && !targetWindow.isDestroyed()) {
      targetWindow.webContents.send('updater:progress', {
        percent,
        bytesPerSecond,
      });
    }
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('[Echo Updater] Update downloaded successfully:', info.version);
    if (targetWindow && !targetWindow.isDestroyed()) {
      targetWindow.webContents.send('updater:status', {
        status: 'downloaded',
        version: info.version,
      });
      targetWindow.webContents.send('updater:downloaded', {
        version: info.version,
      });
    }

    // Seamless zero-touch auto-restart after a brief notification delay (1.5s)
    setTimeout(() => {
      console.log('[Echo Updater] Auto-installing update and restarting...');
      try {
        autoUpdater.quitAndInstall(false, true);
      } catch (err) {
        console.error('[Echo Updater] quitAndInstall failed:', err);
      }
    }, 1500);
  });

  autoUpdater.on('error', (err) => {
    console.warn('[Echo Updater] Error occurred during update check:', err.message);
    if (targetWindow && !targetWindow.isDestroyed()) {
      targetWindow.webContents.send('updater:status', {
        status: 'error',
        error: err.message,
      });
    }
  });

  // IPC Handlers
  ipcMain.handle('updater:check', async () => {
    if (is.dev) {
      console.log('[Echo Updater] Skipped checkForUpdates in development mode.');
      return null;
    }
    try {
      return await autoUpdater.checkForUpdates();
    } catch (error) {
      console.warn('[Echo Updater] checkForUpdates failed:', error);
      return null;
    }
  });

  ipcMain.handle('updater:download', async () => {
    if (is.dev) {
      console.log('[Echo Updater] Skipped downloadUpdate in development mode.');
      return null;
    }
    try {
      return await autoUpdater.downloadUpdate();
    } catch (error) {
      console.warn('[Echo Updater] downloadUpdate failed:', error);
      return null;
    }
  });

  ipcMain.handle('updater:install', () => {
    if (is.dev) {
      console.log('[Echo Updater] Skipped quitAndInstall in development mode.');
      return;
    }
    autoUpdater.quitAndInstall();
  });

  // Trigger initial check in production shortly after window loads
  if (!is.dev) {
    setTimeout(() => {
      void autoUpdater.checkForUpdates().catch((err) => {
        console.warn('[Echo Updater] Initial background check failed:', err);
      });
    }, 1500);

    // Periodic check every 10 minutes
    setInterval(() => {
      void autoUpdater.checkForUpdates().catch((err) => {
        console.warn('[Echo Updater] Periodic check failed:', err);
      });
    }, 10 * 60 * 1000);
  }
}
