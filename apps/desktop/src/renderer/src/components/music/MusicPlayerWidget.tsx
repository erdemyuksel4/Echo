import React, { useEffect, useRef } from 'react';
import { Music, Play, Pause, SkipForward, Square, ListMusic } from 'lucide-react';
import { useMusicStore } from '../../stores/useMusicStore';
import { useVoiceStore } from '../../stores/useVoiceStore';
import { wsService } from '../../services/websocket';

export const MusicPlayerWidget: React.FC = () => {
  const lastLoadedTrackIdRef = useRef<string | null>(null);

  const { currentChannelId } = useVoiceStore();
  const playbackState = useMusicStore((state) =>
    currentChannelId ? state.playbackStates[currentChannelId] ?? null : null,
  );
  const volume = useMusicStore((state) => state.volume);
  const isMuted = useMusicStore((state) => state.isMuted);
  const setPanelOpen = useMusicStore((state) => state.setPanelOpen);

  const currentTrack = playbackState?.currentTrack;
  const trackId = currentTrack?.id;
  const status = playbackState?.status;
  const positionSeconds = playbackState?.positionSeconds ?? 0;
  const lastUpdatedTimestamp = playbackState?.lastUpdatedTimestamp ?? Date.now();

  // 1. Sync Track loading with main process background audio engine
  useEffect(() => {
    if (!window.echoApi?.music) return;

    if (!trackId || !currentChannelId || status === 'stopped') {
      if (lastLoadedTrackIdRef.current) {
        lastLoadedTrackIdRef.current = null;
        void window.echoApi.music.stop();
      }
      return;
    }

    const elapsed = status === 'playing' ? (Date.now() - lastUpdatedTimestamp) / 1000 : 0;
    const startSec = Math.max(0, positionSeconds + elapsed);

    if (trackId !== lastLoadedTrackIdRef.current) {
      lastLoadedTrackIdRef.current = trackId;
      void window.echoApi.music.loadTrack(trackId, startSec);
    }
  }, [trackId, currentChannelId, status]);

  // 2. Sync Play/Pause/Resume Status
  useEffect(() => {
    if (!window.echoApi?.music || !trackId || !currentChannelId) return;

    if (status === 'playing') {
      void window.echoApi.music.resume();
    } else if (status === 'paused') {
      void window.echoApi.music.pause();
    } else if (status === 'stopped') {
      void window.echoApi.music.stop();
    }
  }, [status, trackId, currentChannelId]);

  // 3. Sync Volume & Mute
  useEffect(() => {
    if (!window.echoApi?.music) return;
    void window.echoApi.music.setVolume(volume, isMuted);
  }, [volume, isMuted]);

  // 4. Listen for Track End event from main process -> trigger skip
  useEffect(() => {
    if (!window.echoApi?.music) return;

    const cleanup = window.echoApi.music.onEnded(() => {
      if (currentChannelId) {
        wsService.sendMusicAction({
          action: 'skip',
          channelId: currentChannelId,
        });
      }
    });

    return () => {
      cleanup();
    };
  }, [currentChannelId]);

  // 5. Clean up when leaving channel
  useEffect(() => {
    if (!currentChannelId && window.echoApi?.music) {
      lastLoadedTrackIdRef.current = null;
      void window.echoApi.music.stop();
    }
  }, [currentChannelId]);

  const hasActiveMusic = Boolean(currentTrack) && Boolean(currentChannelId) && status !== 'stopped';
  if (!hasActiveMusic) return null;

  return (
    <div className="fixed bottom-4 right-4 z-40 flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-slate-950/95 border border-indigo-500/40 shadow-2xl shadow-indigo-950/40 backdrop-blur-md text-xs text-white animate-in fade-in slide-in-from-bottom-2 select-none">
      {/* Thumbnail or Music Icon */}
      {currentTrack?.thumbnailUrl ? (
        <img
          src={currentTrack.thumbnailUrl}
          alt={currentTrack.title}
          className="w-9 h-9 rounded-lg object-cover border border-slate-800 shrink-0"
        />
      ) : (
        <div className="w-9 h-9 rounded-lg bg-indigo-950/60 border border-indigo-500/30 flex items-center justify-center shrink-0">
          <Music
            className={`h-4 w-4 ${status === 'playing' ? 'text-indigo-400 animate-pulse' : 'text-slate-400'}`}
          />
        </div>
      )}

      {/* Track Info */}
      <div className="flex flex-col min-w-0 max-w-[160px] md:max-w-[220px]">
        <span className="font-bold truncate text-[11px] leading-tight text-white">
          {currentTrack?.title}
        </span>
        <span className="text-[10px] text-slate-400 truncate leading-tight">
          {currentTrack?.author || 'YouTube'}
        </span>
      </div>

      {/* Controls */}
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
          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-200 hover:text-white transition"
          title={status === 'playing' ? 'Duraklat' : 'Oynat'}
        >
          {status === 'playing' ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
        </button>

        <button
          onClick={() => {
            if (currentChannelId) {
              wsService.sendMusicAction({ action: 'skip', channelId: currentChannelId });
            }
          }}
          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition"
          title="Sonraki Şarkı"
        >
          <SkipForward className="h-3.5 w-3.5" />
        </button>

        <button
          onClick={() => {
            if (currentChannelId) {
              wsService.sendMusicAction({ action: 'stop', channelId: currentChannelId });
            }
          }}
          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-red-400 transition"
          title="Müziği Durdur"
        >
          <Square className="h-3.5 w-3.5" />
        </button>

        <button
          onClick={() => setPanelOpen(true)}
          className="p-1.5 rounded-lg hover:bg-slate-800 text-indigo-400 hover:text-indigo-300 transition"
          title="Müzik Paneli & Kuyruk"
        >
          <ListMusic className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};
