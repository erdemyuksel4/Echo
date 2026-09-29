import { BrowserWindow, ipcMain } from 'electron';

class MusicPlayerManager {
  private playerWindow: BrowserWindow | null = null;
  private currentTrackId: string | null = null;
  private volume: number = 75;
  private isMuted: boolean = false;
  private mainWindow: BrowserWindow | null = null;

  public init(mainWindow: BrowserWindow): void {
    this.mainWindow = mainWindow;

    ipcMain.handle(
      'music:loadTrack',
      async (_, { videoId, startSeconds = 0 }: { videoId: string; startSeconds?: number }) => {
        this.playTrack(videoId, startSeconds);
        return true;
      },
    );

    ipcMain.handle('music:pause', async () => {
      this.executeJs(`
        const v = document.querySelector('video');
        if (v) v.pause();
      `);
      return true;
    });

    ipcMain.handle('music:resume', async () => {
      const targetVol = this.isMuted ? 0 : this.volume / 100;
      this.executeJs(`
        const v = document.querySelector('video');
        if (v) {
          v.muted = ${this.isMuted};
          v.volume = ${targetVol};
          v.play().catch(function() {});
        }
      `);
      return true;
    });

    ipcMain.handle('music:seek', async (_, { seconds }: { seconds: number }) => {
      this.executeJs(`
        const v = document.querySelector('video');
        if (v) v.currentTime = ${Math.max(0, seconds)};
      `);
      return true;
    });

    ipcMain.handle(
      'music:setVolume',
      async (_, { volume, isMuted }: { volume: number; isMuted: boolean }) => {
        this.volume = volume;
        this.isMuted = isMuted;
        const targetVol = isMuted ? 0 : volume / 100;
        this.executeJs(`
          const v = document.querySelector('video');
          if (v) {
            v.muted = ${isMuted};
            v.volume = ${targetVol};
          }
        `);
        return true;
      },
    );

    ipcMain.handle('music:stop', async () => {
      this.stop();
      return true;
    });
  }

  private ensurePlayerWindow(): BrowserWindow {
    if (this.playerWindow && !this.playerWindow.isDestroyed()) {
      return this.playerWindow;
    }

    this.playerWindow = new BrowserWindow({
      width: 600,
      height: 400,
      x: -9999,
      y: -9999,
      show: true, // Visible to Chromium engine so compositor & audio decode run, placed completely offscreen
      focusable: false,
      skipTaskbar: true,
      webPreferences: {
        backgroundThrottling: false,
        autoplayPolicy: 'no-user-gesture-required',
      },
    });

    this.playerWindow.webContents.on('did-finish-load', () => {
      let attempts = 0;
      const poll = setInterval(() => {
        attempts++;
        if (!this.playerWindow || this.playerWindow.isDestroyed() || attempts > 20) {
          clearInterval(poll);
          return;
        }

        const targetVol = this.isMuted ? 0 : this.volume / 100;
        this.playerWindow.webContents
          .executeJavaScript(
            `
          (function() {
            const skipBtn = document.querySelector('.ytp-skip-ad-button, .ytp-ad-skip-button, .ytp-ad-skip-button-modern');
            if (skipBtn) {
              try { skipBtn.click(); } catch(e) {}
            }
            const v = document.querySelector('video');
            if (v) {
              v.muted = ${this.isMuted};
              v.volume = ${targetVol};
              if (v.paused) {
                v.play().catch(function() {});
              }
              if (!v.__echoHooked) {
                v.__echoHooked = true;
                v.onended = () => {
                  window.location.hash = 'ended-' + Date.now();
                };
              }
              return { ready: true, paused: v.paused, time: v.currentTime };
            }
            return { ready: false };
          })()
        `,
          )
          .then((res: { ready?: boolean; paused?: boolean }) => {
            if (res && res.ready && !res.paused) {
              clearInterval(poll);
            }
          })
          .catch(() => {});
      }, 500);
    });

    this.playerWindow.webContents.on('did-navigate-in-page', (_event, url) => {
      if (url.includes('#ended-')) {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send('music:onEnded');
        }
      }
    });

    return this.playerWindow;
  }

  private playTrack(videoId: string, startSeconds: number): void {
    if (this.currentTrackId === videoId && this.playerWindow && !this.playerWindow.isDestroyed()) {
      // Same track, just resume and seek
      this.executeJs(`
        const v = document.querySelector('video');
        if (v) {
          v.currentTime = ${Math.max(0, startSeconds)};
          v.muted = ${this.isMuted};
          v.volume = ${this.isMuted ? 0 : this.volume / 100};
          v.play().catch(function() {});
        }
      `);
      return;
    }

    this.currentTrackId = videoId;
    const win = this.ensurePlayerWindow();
    const watchUrl = `https://www.youtube.com/watch?v=${videoId}${startSeconds > 0 ? `&t=${Math.floor(startSeconds)}s` : ''}`;
    void win.loadURL(watchUrl).catch(() => {});
  }

  private executeJs(code: string): void {
    if (this.playerWindow && !this.playerWindow.isDestroyed()) {
      void this.playerWindow.webContents.executeJavaScript(code).catch(() => {});
    }
  }

  public stop(): void {
    if (this.playerWindow && !this.playerWindow.isDestroyed()) {
      this.playerWindow.destroy();
      this.playerWindow = null;
      this.currentTrackId = null;
    }
  }
}

export const musicPlayerManager = new MusicPlayerManager();
