import React, { useEffect, useRef } from 'react';
import { Music, Minimize2, ExternalLink } from 'lucide-react';
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
  getCurrentTime: () => number;
  getPlayerState: () => number;
  destroy: () => void;
}

export const MusicPlayerWidget: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayerInstance | null>(null);
  const isReadyRef = useRef(false);
  const lastLoadedTrackIdRef = useRef<string | null>(null);

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
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);
    }
  }, []);

  // 2. Initialize Player instance when YT is ready
  useEffect(() => {
    let checkInterval: ReturnType<typeof setInterval> | null = null;

    const initPlayer = () => {
      if (!window.YT?.Player || !containerRef.current || playerRef.current) return;

      const playerId = `yt-player-${Math.random().toString(36).substring(2, 9)}`;
      const playerDiv = document.createElement('div');
      playerDiv.id = playerId;
      containerRef.current.innerHTML = '';
      containerRef.current.appendChild(playerDiv);

      playerRef.current = new window.YT.Player(playerDiv, {
        videoId: trackId || '',
        playerVars: {
          autoplay: 1,
          controls: 1,
          disablekb: 0,
          fs: 1,
          modestbranding: 1,
          rel: 0,
          origin: window.location.origin,
        },
        events: {
          onReady: (event) => {
            isReadyRef.current = true;
            event.target.setVolume(isMuted ? 0 : volume);
            if (status === 'playing') {
              const elapsed = (Date.now() - lastUpdatedTimestamp) / 1000;
              event.target.seekTo(Math.max(0, positionSeconds + elapsed), true);
              event.target.playVideo();
            }
          },
          onStateChange: (event) => {
            // Track ended: Auto skip to next in queue
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
            // Skip unplayable video
            if (currentChannelId) {
              wsService.sendMusicAction({
                action: 'skip',
                channelId: currentChannelId,
              });
            }
          },
        },
      });
    };

    if (window.YT?.Player) {
      initPlayer();
    } else {
      checkInterval = setInterval(() => {
        if (window.YT?.Player) {
          if (checkInterval) clearInterval(checkInterval);
          initPlayer();
        }
      }, 100);
    }

    return () => {
      if (checkInterval) clearInterval(checkInterval);
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch {
          // ignore
        }
        playerRef.current = null;
        isReadyRef.current = false;
      }
    };
  }, []);

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

  // 4. Sync Track ID
  useEffect(() => {
    if (!playerRef.current || !isReadyRef.current) return;

    if (trackId && trackId !== lastLoadedTrackIdRef.current) {
      lastLoadedTrackIdRef.current = trackId;
      const elapsed = status === 'playing' ? (Date.now() - lastUpdatedTimestamp) / 1000 : 0;
      const startSec = Math.max(0, positionSeconds + elapsed);
      try {
        playerRef.current.loadVideoById({
          videoId: trackId,
          startSeconds: Math.floor(startSec),
        });
        if (status === 'playing') {
          playerRef.current.playVideo();
        } else {
          playerRef.current.pauseVideo();
        }
      } catch (e) {
        console.warn('Failed to load video by id:', e);
      }
    }
  }, [trackId]);

  // 5. Sync Playback Status & Position
  useEffect(() => {
    if (!playerRef.current || !isReadyRef.current || !trackId) return;

    try {
      if (status === 'playing') {
        const expectedPos = Math.max(0, positionSeconds + (Date.now() - lastUpdatedTimestamp) / 1000);
        const currentPos = playerRef.current.getCurrentTime();
        if (Math.abs(currentPos - expectedPos) > 3) {
          playerRef.current.seekTo(expectedPos, true);
        }
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
  }, [status, positionSeconds, lastUpdatedTimestamp, trackId]);

  // 6. Volume & Mute Sync
  useEffect(() => {
    if (!playerRef.current || !isReadyRef.current) return;
    try {
      playerRef.current.setVolume(isMuted ? 0 : volume);
    } catch {
      // ignore
    }
  }, [volume, isMuted]);

  const showFloatingPip = isExpandedStage && Boolean(currentTrack) && Boolean(currentChannelId);

  return (
    <div
      className={
        showFloatingPip
          ? 'fixed bottom-4 right-4 z-40 w-80 md:w-96 rounded-2xl overflow-hidden bg-slate-950 border border-indigo-500/40 shadow-2xl shadow-indigo-950/50 flex flex-col transition-all duration-300 animate-in fade-in slide-in-from-bottom-4'
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
              title="Videoyu Gizle (Arka planda çalmaya devam eder)"
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
  );
};
