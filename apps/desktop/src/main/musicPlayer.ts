import { BrowserWindow, ipcMain } from 'electron';

class MusicPlayerManager {
  private playerWindow: BrowserWindow | null = null;
  private currentTrackId: string | null = null;
  private volume: number = 75;
  private isMuted: boolean = false;
  private isPaused: boolean = false;
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
      this.isPaused = true;
      this.executeJs(`
        (function() {
          try {
            const mp = document.getElementById('movie_player');
            if (mp && typeof mp.pauseVideo === 'function') {
              mp.pauseVideo();
            }
          } catch(e) {}
          try {
            const v = document.querySelector('video');
            if (v) v.pause();
          } catch(e) {}
        })();
      `);
      return true;
    });

    ipcMain.handle('music:resume', async () => {
      this.isPaused = false;
      const targetVol = this.isMuted ? 0 : this.volume;
      this.executeJs(`
        (function() {
          const vol = ${targetVol};
          const muted = ${this.isMuted};
          try {
            const mp = document.getElementById('movie_player');
            if (mp) {
              if (muted || vol === 0) {
                if (typeof mp.mute === 'function') mp.mute();
              } else {
                if (typeof mp.unMute === 'function') mp.unMute();
                if (typeof mp.setVolume === 'function') mp.setVolume(vol);
              }
              if (typeof mp.playVideo === 'function') mp.playVideo();
            }
          } catch(e) {}
          try {
            const v = document.querySelector('video');
            if (v) {
              v.muted = muted;
              v.volume = muted ? 0 : vol / 100;
              v.play().catch(function() {});
            }
          } catch(e) {}
        })();
      `);
      return true;
    });

    ipcMain.handle('music:seek', async (_, { seconds }: { seconds: number }) => {
      const sec = Math.max(0, seconds);
      this.executeJs(`
        (function() {
          const sec = ${sec};
          try {
            const mp = document.getElementById('movie_player');
            if (mp && typeof mp.seekTo === 'function') {
              mp.seekTo(sec, true);
            }
          } catch(e) {}
          try {
            const v = document.querySelector('video');
            if (v) v.currentTime = sec;
          } catch(e) {}
        })();
      `);
      return true;
    });

    ipcMain.handle(
      'music:setVolume',
      async (_, { volume, isMuted }: { volume: number; isMuted: boolean }) => {
        this.volume = Math.max(0, Math.min(100, volume));
        this.isMuted = isMuted;
        const targetVol = isMuted ? 0 : this.volume;
        this.executeJs(`
          (function() {
            const vol = ${targetVol};
            const muted = ${isMuted};
            try {
              const mp = document.getElementById('movie_player');
              if (mp) {
                if (muted || vol === 0) {
                  if (typeof mp.mute === 'function') mp.mute();
                } else {
                  if (typeof mp.unMute === 'function') mp.unMute();
                  if (typeof mp.setVolume === 'function') mp.setVolume(vol);
                }
              }
            } catch(e) {}
            try {
              const v = document.querySelector('video');
              if (v) {
                v.muted = muted;
                v.volume = muted ? 0 : vol / 100;
              }
            } catch(e) {}
          })();
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
      show: true, // Visible to Chromium engine so compositor & audio decode run, placed offscreen
      focusable: false,
      skipTaskbar: true,
      webPreferences: {
        backgroundThrottling: false,
        autoplayPolicy: 'no-user-gesture-required',
      },
    });

    this.playerWindow.webContents.on('did-finish-load', () => {
      this.syncPlaybackStateInPage();
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

  private syncPlaybackStateInPage(seekSeconds?: number): void {
    if (!this.playerWindow || this.playerWindow.isDestroyed()) return;

    const vol = this.isMuted ? 0 : this.volume;
    const muted = this.isMuted;
    const paused = this.isPaused;
    const seekArg = typeof seekSeconds === 'number' && seekSeconds > 0 ? seekSeconds : -1;

    this.executeJs(`
      (function() {
        if (window.__echoPlayerLoop) clearInterval(window.__echoPlayerLoop);

        let initialSeekDone = ${seekArg < 0};
        const targetSeek = ${seekArg};

        window.__echoPlayerLoop = setInterval(function() {
          try {
            const mp = document.getElementById('movie_player');
            const v = document.querySelector('video');

            // 1. Auto-dismiss any Google / YouTube confirm / consent popups
            const confirmBtn = document.querySelector('yt-confirm-dialog-renderer #confirm-button button, .yt-spec-button-shape-next--filled');
            if (confirmBtn) confirmBtn.click();

            // 2. Check if an advertisement is actively showing
            const isAd = mp && (mp.classList.contains('ad-showing') || mp.classList.contains('ad-interrupting'));
            if (isAd) {
              const skipBtn = document.querySelector('.ytp-skip-ad-button, .ytp-ad-skip-button, .ytp-ad-skip-button-modern, button.ytp-ad-skip-button-modern, .ytp-ad-text');
              if (skipBtn) skipBtn.click();
              if (typeof mp.skipAd === 'function') mp.skipAd();

              if (v) {
                v.playbackRate = 16.0;
                v.muted = true;
              }
              return;
            }

            // 3. Main song playback configuration
            const targetVol = ${muted} || ${vol} === 0 ? 0 : ${vol};

            if (mp) {
              if (${muted} || ${vol} === 0) {
                if (typeof mp.mute === 'function') mp.mute();
              } else {
                if (typeof mp.unMute === 'function') mp.unMute();
                if (typeof mp.setVolume === 'function') mp.setVolume(targetVol);
              }

              if (!initialSeekDone && targetSeek > 0) {
                if (typeof mp.seekTo === 'function') {
                  mp.seekTo(targetSeek, true);
                  initialSeekDone = true;
                }
              }

              if (!${paused}) {
                if (typeof mp.playVideo === 'function') mp.playVideo();
              } else {
                if (typeof mp.pauseVideo === 'function') mp.pauseVideo();
              }
            }

            if (v) {
              if (v.playbackRate !== 1.0) v.playbackRate = 1.0;
              v.muted = ${muted};
              v.volume = ${muted ? 0 : vol / 100};

              if (!initialSeekDone && targetSeek > 0) {
                v.currentTime = targetSeek;
                initialSeekDone = true;
              }

              if (!${paused}) {
                if (v.paused) v.play().catch(function() {});
              } else {
                v.pause();
              }

              if (!v.__echoHooked) {
                v.__echoHooked = true;
                v.onended = () => {
                  const adActive = mp && (mp.classList.contains('ad-showing') || mp.classList.contains('ad-interrupting'));
                  if (!adActive) {
                    window.location.hash = 'ended-' + Date.now();
                  }
                };
              }
            }
          } catch(e) {}
        }, 500);
      })();
    `);
  }

  private playTrack(videoId: string, startSeconds: number): void {
    this.isPaused = false;

    if (this.currentTrackId === videoId && this.playerWindow && !this.playerWindow.isDestroyed()) {
      // Same track, seek and resume
      this.syncPlaybackStateInPage(startSeconds);
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
    this.isPaused = false;
    this.currentTrackId = null;
    if (this.playerWindow && !this.playerWindow.isDestroyed()) {
      try {
        void this.playerWindow.webContents
          .executeJavaScript(
            `
          (function() {
            if (window.__echoPlayerLoop) clearInterval(window.__echoPlayerLoop);
            try {
              const mp = document.getElementById('movie_player');
              if (mp && typeof mp.stopVideo === 'function') mp.stopVideo();
            } catch(e) {}
            try {
              const v = document.querySelector('video');
              if (v) { v.pause(); v.src = ''; }
            } catch(e) {}
          })()
        `,
          )
          .catch(() => {});
      } catch {
        // window might already be destroyed
      }

      this.playerWindow.destroy();
      this.playerWindow = null;
    }
  }
}

export const musicPlayerManager = new MusicPlayerManager();
