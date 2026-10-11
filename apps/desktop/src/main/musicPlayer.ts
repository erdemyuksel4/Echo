import { BrowserWindow, ipcMain, session } from 'electron';

class MusicPlayerManager {
  private playerWindow: BrowserWindow | null = null;
  private currentTrackId: string | null = null;
  private volume: number = 75;
  private isMuted: boolean = false;
  private isPaused: boolean = false;
  private mainWindow: BrowserWindow | null = null;
  private isAdCurrentlyActive: boolean = false;

  public init(mainWindow: BrowserWindow): void {
    this.mainWindow = mainWindow;

    // Block known YouTube and Google ad network requests to eliminate ads at network layer
    const adFilterPatterns = [
      '*://*.doubleclick.net/*',
      '*://*.googleadservices.com/*',
      '*://*.googlesyndication.com/*',
      '*://*.youtube.com/pagead/*',
      '*://*.youtube.com/api/stats/ads*',
      '*://*.youtube.com/get_midroll_info*',
      '*://static.doubleclick.net/*',
      '*://securepubads.g.doubleclick.net/*',
      '*://*.youtube.com/youtubei/v1/player/ad_break*',
    ];
    try {
      const ytSession = session.fromPartition('persist:youtube');
      ytSession.webRequest.onBeforeRequest({ urls: adFilterPatterns }, (_details, callback) => {
        callback({ cancel: true });
      });
    } catch (e) {
      console.warn('[MusicPlayer] Failed to register ad network filter:', e);
    }

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
        if (this.playerWindow && !this.playerWindow.isDestroyed()) {
          try {
            this.playerWindow.webContents.setAudioMuted(isMuted);
          } catch {
            // Ignore
          }
        }
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

    // Google / YouTube Login
    ipcMain.handle('music:loginGoogle', async () => {
      return await this.openGoogleLoginWindow();
    });

    // Check YouTube Auth status
    ipcMain.handle('music:checkAuth', async () => {
      return await this.checkYouTubeAuth();
    });

    // Logout from YouTube / Google
    ipcMain.handle('music:logoutGoogle', async () => {
      return await this.logoutYouTube();
    });

    // WebRTC Bot Streaming signals for Echo Müzik [BOT]
    ipcMain.handle(
      'music:handleBotSignal',
      async (
        _,
        {
          fromUserId,
          signal,
          iceServers,
        }: {
          fromUserId: string;
          signal: unknown;
          iceServers?: unknown[];
        },
      ) => {
        return this.handleBotSignal(fromUserId, signal, iceServers);
      },
    );

    ipcMain.handle('music:removeBotPeer', async (_, { userId }: { userId: string }) => {
      return this.removeBotPeer(userId);
    });
  }

  private async checkYouTubeAuth(): Promise<{ isLoggedIn: boolean }> {
    try {
      const sess = session.fromPartition('persist:youtube');
      const cookies = await sess.cookies.get({ domain: '.youtube.com' });
      const hasAuth = cookies.some(
        (c) => c.name === 'LOGIN_INFO' || c.name === 'SAPISID' || c.name === 'SID'
      );
      return { isLoggedIn: hasAuth };
    } catch {
      return { isLoggedIn: false };
    }
  }

  private async logoutYouTube(): Promise<boolean> {
    try {
      const sess = session.fromPartition('persist:youtube');
      await sess.clearStorageData();
      if (this.playerWindow && !this.playerWindow.isDestroyed()) {
        this.playerWindow.webContents.reload();
      }
      return true;
    } catch {
      return false;
    }
  }

  private openGoogleLoginWindow(): Promise<boolean> {
    return new Promise((resolve) => {
      const loginWin = new BrowserWindow({
        width: 520,
        height: 680,
        title: 'YouTube / Google Girişi',
        parent: this.mainWindow || undefined,
        modal: true,
        autoHideMenuBar: true,
        webPreferences: {
          partition: 'persist:youtube',
          contextIsolation: true,
          sandbox: true,
        },
      });

      loginWin.loadURL('https://accounts.google.com/ServiceLogin?service=youtube&continue=https%3A%2F%2Fwww.youtube.com%2F');

      loginWin.on('close', async () => {
        const auth = await this.checkYouTubeAuth();
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send('music:onAuthChange', auth);
        }
        resolve(auth.isLoggedIn);
      });
    });
  }

  private injectAdBlockingStyles(): void {
    if (!this.playerWindow || this.playerWindow.isDestroyed()) return;
    const css = `
      .ytp-ad-overlay-container,
      .ytp-ad-message-container,
      .ytp-ad-action-interstitial,
      .ytp-ad-player-overlay,
      .ytp-ad-player-overlay-layout,
      .ytp-ad-progress,
      .ytp-ad-progress-list,
      #player-ads,
      ytd-ad-slot-renderer,
      ytd-in-feed-ad-layout-renderer,
      ytd-banner-promo-renderer,
      ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-ads"] {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }
    `;
    try {
      void this.playerWindow.webContents.insertCSS(css);
    } catch {
      // Ignore
    }
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
        partition: 'persist:youtube',
        backgroundThrottling: false,
        autoplayPolicy: 'no-user-gesture-required',
      },
    });

    this.playerWindow.webContents.on('dom-ready', () => {
      this.injectAdBlockingStyles();
      this.syncPlaybackStateInPage();
    });

    this.playerWindow.webContents.on('did-finish-load', () => {
      this.injectAdBlockingStyles();
      this.syncPlaybackStateInPage();
    });

    this.playerWindow.webContents.on('console-message', (_event, _level, message) => {
      if (message === '__ECHO_AD__:true') {
        if (!this.isAdCurrentlyActive) {
          this.isAdCurrentlyActive = true;
          try {
            this.playerWindow?.webContents.setAudioMuted(true);
          } catch {
            // Ignore
          }
          if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('music:onAdState', { isAd: true });
          }
        }
      } else if (message === '__ECHO_AD__:false') {
        if (this.isAdCurrentlyActive) {
          this.isAdCurrentlyActive = false;
          try {
            this.playerWindow?.webContents.setAudioMuted(this.isMuted);
          } catch {
            // Ignore
          }
          if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('music:onAdState', { isAd: false });
          }
        }
      } else if (message === '__ECHO_ENDED__') {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send('music:onEnded');
        }
      } else if (message.startsWith('__ECHO_BOT_SIGNAL__:')) {
        try {
          const raw = message.slice('__ECHO_BOT_SIGNAL__:'.length);
          const data = JSON.parse(raw);
          if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('music:onBotSignal', data);
          }
        } catch (e) {
          console.warn('[Echo MusicPlayer] Failed to parse bot signal:', e);
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

        function killAd(mp, v) {
          try {
            const isAd = Boolean(
              (mp && (mp.classList.contains('ad-showing') || mp.classList.contains('ad-interrupting'))) ||
              (mp && typeof mp.getAdState === 'function' && mp.getAdState() > 0) ||
              document.querySelector('.ytp-ad-text, .ytp-ad-preview-text, .ytp-ad-skip-button-modern, .ytp-skip-ad-button, .ytp-ad-player-overlay-layout, .videoAdUi')
            );

            if (isAd) {
              console.log('__ECHO_AD__:true');
              if (v) {
                try {
                  v.muted = true;
                  if (!isNaN(v.duration) && v.duration > 0) {
                    v.currentTime = v.duration;
                  }
                  v.playbackRate = 16.0;
                } catch(e) {}
              }
              const skipBtn = document.querySelector('.ytp-skip-ad-button, .ytp-ad-skip-button, .ytp-ad-skip-button-modern, button.ytp-ad-skip-button-modern, .videoAdUiSkipButton, [id^="skip-button"]');
              if (skipBtn && typeof (skipBtn as any).click === 'function') {
                try { (skipBtn as any).click(); } catch(e) {}
              }
              if (mp && typeof mp.skipAd === 'function') {
                try { mp.skipAd(); } catch(e) {}
              }
              return true;
            } else {
              console.log('__ECHO_AD__:false');
              return false;
            }
          } catch(e) {
            return false;
          }
        }

        // Install MutationObserver for instant ad detection on DOM changes
        if (!window.__echoAdObserver && document.body) {
          window.__echoAdObserver = new MutationObserver(function() {
            const mp = document.getElementById('movie_player');
            const v = document.querySelector('video');
            killAd(mp, v);
          });
          window.__echoAdObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
        }

        window.__echoPlayerLoop = setInterval(function() {
          try {
            const mp = document.getElementById('movie_player');
            const v = document.querySelector('video');

            // 1. Auto-dismiss any Google / YouTube confirm / consent popups
            const confirmBtn = document.querySelector('yt-confirm-dialog-renderer #confirm-button button, .yt-spec-button-shape-next--filled');
            if (confirmBtn) (confirmBtn as any).click();

            // 2. Comprehensive check and instant kill if an advertisement is actively showing
            const isAd = killAd(mp, v);

            if (isAd) {
              // Mute audio track on WebRTC so no ad sound escapes to the voice room
              if (window.__echoBotPeers && window.__echoBotPeers.size > 0 && v && typeof v.captureStream === 'function') {
                try {
                  const s = v.captureStream();
                  const t = s.getAudioTracks()[0];
                  if (t) t.enabled = false;
                } catch(e) {}
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
                v.addEventListener('timeupdate', function() {
                  killAd(mp, v);
                });
                v.onended = () => {
                  const adActive = Boolean(
                    (mp && (mp.classList.contains('ad-showing') || mp.classList.contains('ad-interrupting'))) ||
                    document.querySelector('.ytp-ad-text, .ytp-ad-skip-button-modern, .ytp-skip-ad-button')
                  );
                  if (!adActive) {
                    console.log('__ECHO_ENDED__');
                  }
                };
              }
            }

            // Synchronize audio track for all connected bot WebRTC peers
            if (window.__echoBotPeers && window.__echoBotPeers.size > 0 && v && typeof v.captureStream === 'function') {
              try {
                const s = v.captureStream();
                const t = s.getAudioTracks()[0];
                if (t && t.readyState === 'live') {
                  t.enabled = true; // Ensure track is audible during actual song playback
                  for (const pc of window.__echoBotPeers.values()) {
                    const senders = pc.getSenders();
                    const audioSender = senders.find((snd) => snd.track?.kind === 'audio' || !snd.track);
                    if (audioSender && audioSender.track !== t) {
                      void audioSender.replaceTrack(t);
                    } else if (!audioSender) {
                      pc.addTrack(t, s);
                    }
                  }
                }
              } catch(e) {}
            }
          } catch(e) {}
        }, 200);
      })();
    `);
  }

  public handleBotSignal(
    fromUserId: string,
    signal: unknown,
    iceServers?: unknown[],
  ): boolean {
    if (!this.playerWindow || this.playerWindow.isDestroyed()) return false;

    const payloadStr = JSON.stringify({ fromUserId, signal, iceServers });
    this.executeJs(`
      (async function() {
        try {
          const { fromUserId, signal, iceServers } = ${payloadStr};
          window.__echoBotPeers = window.__echoBotPeers || new Map();

          function getAudioMedia() {
            try {
              const v = document.querySelector('video');
              if (v && typeof v.captureStream === 'function') {
                const s = v.captureStream();
                const t = s.getAudioTracks()[0];
                if (t && t.readyState === 'live') return { track: t, stream: s };
              }
            } catch(e) {}
            return null;
          }

          if (signal.type === 'offer') {
            let pc = window.__echoBotPeers.get(fromUserId);
            if (pc) {
              try { pc.close(); } catch(e) {}
            }

            const servers = Array.isArray(iceServers) && iceServers.length > 0
              ? iceServers
              : [{ urls: 'stun:stun.cloudflare.com:3478' }, { urls: 'stun:stun.l.google.com:19302' }];
            pc = new RTCPeerConnection({ iceServers: servers });
            window.__echoBotPeers.set(fromUserId, pc);

            const media = getAudioMedia();
            if (media && media.track) {
              pc.addTrack(media.track, media.stream);
            } else {
              try {
                pc.addTransceiver('audio', { direction: 'sendonly' });
              } catch(e) {}
            }

            pc.onicecandidate = (evt) => {
              if (evt.candidate && evt.candidate.candidate) {
                console.log('__ECHO_BOT_SIGNAL__:' + JSON.stringify({
                  toUserId: fromUserId,
                  signal: {
                    type: 'candidate',
                    candidate: evt.candidate.candidate,
                    sdpMid: evt.candidate.sdpMid,
                    sdpMLineIndex: evt.candidate.sdpMLineIndex,
                  }
                }));
              }
            };

            await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: signal.sdp }));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            console.log('__ECHO_BOT_SIGNAL__:' + JSON.stringify({
              toUserId: fromUserId,
              signal: {
                type: 'answer',
                sdp: answer.sdp,
              }
            }));

          } else if (signal.type === 'answer') {
            const pc = window.__echoBotPeers.get(fromUserId);
            if (pc) {
              await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: signal.sdp }));
            }
          } else if (signal.type === 'candidate' && signal.candidate) {
            const pc = window.__echoBotPeers.get(fromUserId);
            if (pc && pc.remoteDescription && pc.remoteDescription.type) {
              await pc.addIceCandidate(new RTCIceCandidate({
                candidate: signal.candidate,
                sdpMid: signal.sdpMid,
                sdpMLineIndex: signal.sdpMLineIndex,
              }));
            }
          }
        } catch(err) {
          console.warn('[Echo Bot WebRTC] Signal error:', err);
        }
      })();
    `);
    return true;
  }

  public removeBotPeer(userId: string): boolean {
    if (!this.playerWindow || this.playerWindow.isDestroyed()) return false;
    this.executeJs(`
      (function() {
        if (window.__echoBotPeers && window.__echoBotPeers.has(${JSON.stringify(userId)})) {
          const pc = window.__echoBotPeers.get(${JSON.stringify(userId)});
          try { pc.close(); } catch(e) {}
          window.__echoBotPeers.delete(${JSON.stringify(userId)});
        }
      })();
    `);
    return true;
  }

  private playTrack(videoId: string, startSeconds: number): void {
    this.isPaused = false;
    this.isAdCurrentlyActive = false;
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('music:onAdState', { isAd: false });
    }

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
    this.isAdCurrentlyActive = false;
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('music:onAdState', { isAd: false });
    }
    if (this.playerWindow && !this.playerWindow.isDestroyed()) {
      try {
        void this.playerWindow.webContents
          .executeJavaScript(
            `
          (function() {
            if (window.__echoPlayerLoop) clearInterval(window.__echoPlayerLoop);
            if (window.__echoBotPeers) {
              for (const pc of window.__echoBotPeers.values()) {
                try { pc.close(); } catch(e) {}
              }
              window.__echoBotPeers.clear();
            }
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
