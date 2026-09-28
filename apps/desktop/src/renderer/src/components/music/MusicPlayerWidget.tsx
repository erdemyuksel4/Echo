import React, { useEffect, useRef } from 'react';
import { Music, Minimize2, Maximize2, ExternalLink, Play, Pause, SkipForward } from 'lucide-react';
import { useMusicStore } from '../../stores/useMusicStore';
import { useVoiceStore } from '../../stores/useVoiceStore';
import { wsService } from '../../services/websocket';

declare global {
  interface Window {
    YT?: {
      Player: new (
        elementId: string | HTMLElement,
        options: {
          videoId?: string;
          host?: string;
          playerVars?: Record<string, unknown>;
          events?: {
            onReady?: (event: { target: YTPlayerInstance }) => void;
            onStateChange?: (event: { data: number }) => void;
            onError?: (event: { data: number }) => void;
          };
        },
      ) => YTPlayerInstance;
      PlayerState: {
        UNSTARTED: number;
        ENDED: number;
        PLAYING: number;
        PAUSED: number;
        BUFFERING: number;
        CUED: number;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

interface YTPlayerInstance {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  loadVideoById: (options: string | { videoId: string; startSeconds?: number }) => void;
  cueVideoById: (options: string | { videoId: string; startSeconds?: number }) => void;
  setVolume: (volume: number) => void;
  getVolume: () => number;
  unMute: () => void;
  mute: () => void;
  isMuted: () => boolean;
  getCurrentTime: () => number;
  getPlayerState: () => number;
  destroy: () => void;
}

export const MusicPlayerWidget: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayerInstance | null>(null);
  const isReadyRef = useRef(false);
  const lastLoadedTrackIdRef = useRef<string | null>(null);
  const isCreatingRef = useRef(false);

  const { currentChannelId } = useVoiceStore();
  const playbackState = useMusicStore((state) =>
    currentChannelId ? state.playbackStates[currentChannelId] ?? null : null,
  );
  const volume = useMusicStore((state) => state.volume);
  const isMuted = useMusicStore((state) => state.isMuted);
  const isExpandedStage = useMusicStore((state) => state.isExpandedStage);
  const setExpandedStage = useMusicStore((state) => state.setExpandedStage);
  const setPanelOpen = useMusicStore((state) => state.setPanelOpen);

  const currentTrack = playbackState?.currentTrack;
  const trackId = currentTrack?.id;
  const status = playbackState?.status;
  const positionSeconds = playbackState?.positionSeconds ?? 0;
  const lastUpdatedTimestamp = playbackState?.lastUpdatedTimestamp ?? Date.now();

  // 1. Load YouTube IFrame API script once
  useEffect(() => {
    if (!window.YT) {
      const existingScript = document.querySelector('script[src*="youtube.com/iframe_api"]');
      if (!existingScript) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);
      }
    }
  }, []);

  // 2. Initialize or Update Player whenever trackId changes
  useEffect(() => {
    if (!trackId || !currentChannelId) {
      if (playerRef.current && isReadyRef.current) {
        try {
          playerRef.current.pauseVideo();
        } catch {
          // ignore
        }
      }
      return;
    }

    // Helper to compute start seconds
    const elapsed = status === 'playing' ? (Date.now() - lastUpdatedTimestamp) / 1000 : 0;
    const startSec = Math.max(0, positionSeconds + elapsed);

    // If player already exists and is ready
    if (playerRef.current && isReadyRef.current) {
      if (trackId !== lastLoadedTrackIdRef.current) {
        lastLoadedTrackIdRef.current = trackId;
        try {
          playerRef.current.loadVideoById({
            videoId: trackId,
            startSeconds: Math.floor(startSec),
          });
          playerRef.current.unMute();
          playerRef.current.setVolume(isMuted ? 0 : volume);
          if (status === 'playing') {
            playerRef.current.playVideo();
          } else {
            playerRef.current.pauseVideo();
          }
        } catch (err) {
          console.warn('loadVideoById failed:', err);
        }
      }
      return;
    }

    // Otherwise, create the player once window.YT is ready
    if (isCreatingRef.current) return;
    isCreatingRef.current = true;

    const setupPlayer = () => {
      if (!window.YT?.Player || !containerRef.current) {
        setTimeout(setupPlayer, 150);
        return;
      }

      try {
        containerRef.current.innerHTML = '';
        const playerDiv = document.createElement('div');
        playerDiv.id = `yt-player-inst-${Date.now()}`;
        containerRef.current.appendChild(playerDiv);

        lastLoadedTrackIdRef.current = trackId;

        playerRef.current = new window.YT.Player(playerDiv, {
          videoId: trackId,
          host: 'https://www.youtube-nocookie.com',
          playerVars: {
            autoplay: 1,
            controls: 1,
            disablekb: 0,
            fs: 1,
            modestbranding: 1,
            rel: 0,
            enablejsapi: 1,
            playsinline: 1,
            origin: 'https://www.youtube.com',
            widget_referrer: 'https://www.youtube.com',
          },
          events: {
            onReady: (event) => {
              isReadyRef.current = true;
              isCreatingRef.current = false;
              try {
                event.target.unMute();
                event.target.setVolume(isMuted ? 0 : volume);
                const currentElapsed =
                  status === 'playing' ? (Date.now() - lastUpdatedTimestamp) / 1000 : 0;
                event.target.seekTo(Math.max(0, positionSeconds + currentElapsed), true);
                if (status === 'playing') {
                  event.target.playVideo();
                } else {
                  event.target.pauseVideo();
                }
              } catch (err) {
                console.warn('Player onReady event error:', err);
              }
            },
            onStateChange: (event) => {
              if (event.data === window.YT?.PlayerState.ENDED) {
                if (currentChannelId) {
                  wsService.sendMusicAction({
                    action: 'skip',
                    channelId: currentChannelId,
                  });
                }
              }
            },
            onError: (err) => {
              console.warn('YouTube player error:', err);
              if (currentChannelId) {
                wsService.sendMusicAction({
                  action: 'skip',
                  channelId: currentChannelId,
                });
              }
            },
          },
        });

        setTimeout(() => {
          const iframe = containerRef.current?.querySelector('iframe');
          if (iframe) {
            iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
            iframe.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture');
          }
        }, 50);
      } catch (e) {
        console.error('Failed to create YT.Player instance:', e);
        isCreatingRef.current = false;
      }
    };

    setupPlayer();
  }, [trackId, currentChannelId]);

  // 3. Pause when leaving voice channel
  useEffect(() => {
    if (!currentChannelId && playerRef.current && isReadyRef.current) {
      try {
        playerRef.current.pauseVideo();
      } catch {
        // ignore
      }
    }
  }, [currentChannelId]);

  // 4. Sync Playback Status & Position
  useEffect(() => {
    if (!playerRef.current || !isReadyRef.current || !trackId) return;

    try {
      if (status === 'playing') {
        const expectedPos = Math.max(
          0,
          positionSeconds + (Date.now() - lastUpdatedTimestamp) / 1000,
        );
        const currentPos = playerRef.current.getCurrentTime();
        if (Math.abs(currentPos - expectedPos) > 3) {
          playerRef.current.seekTo(expectedPos, true);
        }
        playerRef.current.unMute();
        playerRef.current.setVolume(isMuted ? 0 : volume);
        playerRef.current.playVideo();
      } else if (status === 'paused') {
        playerRef.current.pauseVideo();
        if (Math.abs(playerRef.current.getCurrentTime() - positionSeconds) > 2) {
          playerRef.current.seekTo(positionSeconds, true);
        }
      } else if (status === 'stopped') {
        playerRef.current.pauseVideo();
      }
    } catch (e) {
      console.warn('Playback sync error:', e);
    }
  }, [status, positionSeconds, lastUpdatedTimestamp, trackId, isMuted, volume]);

  // 5. Volume & Mute Sync
  useEffect(() => {
    if (!playerRef.current || !isReadyRef.current) return;
    try {
      if (isMuted) {
        playerRef.current.mute();
      } else {
        playerRef.current.unMute();
        playerRef.current.setVolume(volume);
      }
    } catch {
      // ignore
    }
  }, [volume, isMuted]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch {
          // ignore
        }
        playerRef.current = null;
        isReadyRef.current = false;
        isCreatingRef.current = false;
      }
    };
  }, []);

  const hasActiveMusic = Boolean(currentTrack) && Boolean(currentChannelId);
  const showFloatingPip = isExpandedStage && hasActiveMusic;

  return (
    <>
      {/* Minimized Quick Audio Bar when user collapses PiP */}
      {!isExpandedStage && hasActiveMusic && (
        <div className="fixed bottom-4 right-4 z-40 flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-slate-950/95 border border-indigo-500/40 shadow-2xl backdrop-blur-md text-xs text-white animate-in fade-in slide-in-from-bottom-2 select-none">
          <Music
            className={`h-4 w-4 ${status === 'playing' ? 'text-indigo-400 animate-pulse' : 'text-slate-400'}`}
          />
          <div className="flex flex-col min-w-0 max-w-[160px] md:max-w-[220px]">
            <span className="font-bold truncate text-[11px] leading-tight text-white">
              {currentTrack?.title}
            </span>
            <span className="text-[10px] text-slate-400 truncate leading-tight">
              {currentTrack?.author}
            </span>
          </div>
          <div className="flex items-center gap-1 ml-1 border-l border-slate-800 pl-2">
            <button
              onClick={() => {
                if (currentChannelId) {
                  wsService.sendMusicAction({
                    action: status === 'playing' ? 'pause' : 'resume',
                    channelId: currentChannelId,
                  });
                }
              }}
              className="p-1 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition"
              title={status === 'playing' ? 'Duraklat' : 'Oynat'}
            >
              {status === 'playing' ? (
                <Pause className="h-3.5 w-3.5" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
            </button>
            <button
              onClick={() => {
                if (currentChannelId) {
                  wsService.sendMusicAction({ action: 'skip', channelId: currentChannelId });
                }
              }}
              className="p-1 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition"
              title="Sonraki Şarkı"
            >
              <SkipForward className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setExpandedStage(true)}
              className="p-1 rounded-lg hover:bg-slate-800 text-indigo-400 hover:text-indigo-300 transition"
              title="Videoyu Aç"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Main YouTube Container */}
      <div
        className={
          showFloatingPip
            ? 'fixed bottom-4 right-4 z-40 w-80 md:w-96 rounded-2xl overflow-hidden bg-slate-950 border border-indigo-500/40 shadow-2xl shadow-indigo-950/50 flex flex-col transition-all duration-300 animate-in fade-in slide-in-from-bottom-4'
            : hasActiveMusic
              ? 'fixed bottom-24 right-4 w-72 h-44 opacity-0 pointer-events-none -z-10'
              : 'fixed -top-[9999px] -left-[9999px] w-1 h-1 opacity-0 pointer-events-none'
        }
      >
        {showFloatingPip && (
          <div className="flex items-center justify-between px-3 py-2 bg-slate-900/90 border-b border-slate-800 text-xs text-white">
            <div className="flex items-center gap-2 min-w-0">
              <Music className="h-3.5 w-3.5 text-indigo-400 shrink-0 animate-pulse" />
              <span className="font-semibold truncate">{currentTrack?.title}</span>
            </div>
            <div className="flex items-center gap-1 shrink-0 ml-2">
              <button
                onClick={() => setPanelOpen(true)}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800"
                title="Müzik Panelini Aç"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setExpandedStage(false)}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800"
                title="Videoyu Gizle (Arka planda ses çalmaya devam eder)"
              >
                <Minimize2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        <div className={showFloatingPip ? 'w-full aspect-video bg-black' : 'w-full h-full'}>
          <div ref={containerRef} className="w-full h-full" />
        </div>
      </div>
    </>
  );
};
