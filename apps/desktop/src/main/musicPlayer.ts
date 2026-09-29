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
      width: 480,
      height: 360,
      show: false, // Completely hidden background player, no video window on screen
      focusable: false,
      skipTaskbar: true,
      webPreferences: {
        backgroundThrottling: false,
        autoplayPolicy: 'no-user-gesture-required',
        contextIsolation: false,
        nodeIntegration: false,
        sandbox: false,
      },
    });

    this.playerWindow.webContents.on('did-finish-load', () => {
      const targetVol = this.isMuted ? 0 : this.volume / 100;
      this.executeJs(`
        (function() {
          let attempts = 0;
          const tryPlay = () => {
            const v = document.querySelector('video');
            const playBtn = document.querySelector('.ytp-large-play-button');
            if (playBtn) {
              try { playBtn.click(); } catch(e) {}
            }
            if (v) {
              v.muted = ${this.isMuted};
              v.volume = ${targetVol};
              const p = v.play();
              if (p && p.catch) {
                p.catch(function(e) {
                  v.muted = false;
                  v.play().catch(function() {});
                });
              }
              v.onended = () => {
                window.location.hash = 'ended-' + Date.now();
              };
            } else if (attempts < 25) {
              attempts++;
              setTimeout(tryPlay, 200);
            }
          };
          tryPlay();
        })();
      `);
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
    const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&start=${Math.floor(startSeconds)}`;
    void win.loadURL(embedUrl);
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
