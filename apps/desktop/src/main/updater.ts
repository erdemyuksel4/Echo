import { app, BrowserWindow, ipcMain } from 'electron';
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { is } from '@electron-toolkit/utils';

const REPO_OWNER = 'erdemyuksel4';
const REPO_NAME = 'Echo';

let targetWindow: BrowserWindow | null = null;
let isInitialized = false;

export function getUpdaterPath(): string | null {
  // 1. Production installed path (same directory as Echo.exe)
  const productionPath = join(dirname(process.execPath), 'EchoUpdater.exe');
  if (existsSync(productionPath)) return productionPath;

  // 2. Extra resources / relative path
  const resourcesPath = join(process.resourcesPath, '../EchoUpdater.exe');
  if (existsSync(resourcesPath)) return resourcesPath;

  // 3. Development publish path
  const devPath = join(__dirname, '../../../../apps/updater/bin/Release/publish/EchoUpdater.exe');
  if (existsSync(devPath)) return devPath;

  const devNetPath = join(
    __dirname,
    '../../../../apps/updater/bin/Release/net9.0-windows/win-x64/EchoUpdater.exe'
  );
  if (existsSync(devNetPath)) return devNetPath;

  return null;
}

function isNewerVersion(remote: string, current: string): boolean {
  const rParts = remote.replace(/^v/i, '').split('.').map((p) => parseInt(p, 10) || 0);
  const cParts = current.replace(/^v/i, '').split('.').map((p) => parseInt(p, 10) || 0);
  for (let i = 0; i < Math.max(rParts.length, cParts.length); i++) {
    const r = rParts[i] ?? 0;
    const c = cParts[i] ?? 0;
    if (r > c) return true;
    if (r < c) return false;
  }
  return false;
}

export async function checkForUpdateAndLaunchUpdater(options?: {
  manual?: boolean;
}): Promise<{ available: boolean; version?: string }> {
  void options;
  const currentVersion = app.getVersion();
  console.log(`[Echo Main] Checking for updates (current version: v${currentVersion})...`);

  if (targetWindow && !targetWindow.isDestroyed()) {
    targetWindow.webContents.send('updater:status', { status: 'checking' });
  }

  try {
    const res = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`, {
      headers: {
        'User-Agent': `Echo-App/${currentVersion}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!res.ok) {
      throw new Error(`GitHub API returned HTTP ${res.status}`);
    }

    const release = (await res.json()) as {
      tag_name?: string;
      assets?: { name: string; browser_download_url: string }[];
    };

    const rawTag = release.tag_name || '';
    const remoteVersion = rawTag.replace(/^v/i, '');

    if (!remoteVersion) {
      console.log('[Echo Main] Could not determine remote version from release.');
      if (targetWindow && !targetWindow.isDestroyed()) {
        targetWindow.webContents.send('updater:status', { status: 'not-available', version: currentVersion });
      }
      return { available: false, version: currentVersion };
    }

    const hasUpdate = isNewerVersion(remoteVersion, currentVersion);

    if (hasUpdate) {
      console.log(`[Echo Main] New update available: v${remoteVersion} (current: v${currentVersion})`);

      if (targetWindow && !targetWindow.isDestroyed()) {
        targetWindow.webContents.send('updater:status', { status: 'available', version: remoteVersion });
        targetWindow.webContents.send('updater:available', { version: remoteVersion });
      }

      const updaterPath = getUpdaterPath();
      if (updaterPath) {
        // Find asset download url if present
        let assetUrl: string | undefined;
        if (release.assets && Array.isArray(release.assets)) {
          const match =
            release.assets.find(
              (a) => a.name.endsWith('.exe') && a.name.toLowerCase().includes('setup')
            ) || release.assets.find((a) => a.name.endsWith('.exe'));
          if (match) {
            assetUrl = match.browser_download_url;
          }
        }

        const args = [
          `--target-version=${remoteVersion}`,
          `--app-path=${process.execPath}`,
        ];
        if (assetUrl) {
          args.push(`--download-url=${assetUrl}`);
        }

        console.log(`[Echo Main] Launching EchoUpdater (${updaterPath}) with args:`, args);
        const child = spawn(updaterPath, args, {
          detached: true,
          stdio: 'ignore',
        });
        child.unref();

        // Release file locks by quitting Echo.exe immediately
        console.log('[Echo Main] Closing Echo to allow EchoUpdater to execute without locks...');
        if (targetWindow && !targetWindow.isDestroyed()) {
          targetWindow.removeAllListeners('close');
        }
        app.quit();
        return { available: true, version: remoteVersion };
      } else {
        console.warn('[Echo Main] EchoUpdater.exe not found on disk. Cannot launch separate updater.');
        return { available: true, version: remoteVersion };
      }
    } else {
      console.log(`[Echo Main] Echo is up-to-date (v${currentVersion}).`);
      if (targetWindow && !targetWindow.isDestroyed()) {
        targetWindow.webContents.send('updater:status', {
          status: 'not-available',
          version: currentVersion,
        });
      }
      return { available: false, version: currentVersion };
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.warn('[Echo Main] Update check failed:', errorMsg);
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

  // IPC Handlers
  ipcMain.handle('updater:check', async () => {
    return await checkForUpdateAndLaunchUpdater({ manual: true });
  });

  ipcMain.handle('updater:download', async () => {
    return null;
  });

  ipcMain.handle('updater:install', () => {
    void checkForUpdateAndLaunchUpdater({ manual: true });
  });

  // Background check on startup if packaged
  if (!is.dev && app.isPackaged) {
    setTimeout(() => {
      void checkForUpdateAndLaunchUpdater().catch((err) => {
        console.warn('[Echo Main] Initial update check failed:', err);
      });
    }, 1500);

    // Periodic check every 15 minutes
    setInterval(
      () => {
        void checkForUpdateAndLaunchUpdater().catch((err) => {
          console.warn('[Echo Main] Periodic update check failed:', err);
        });
      },
      15 * 60 * 1000
    );
  }
}
