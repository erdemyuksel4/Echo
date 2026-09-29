import React, { useEffect, useRef, useState } from 'react';
import { Music, Play, Pause, SkipForward, Square, ListMusic, Volume2, Volume1, VolumeX } from 'lucide-react';
import { useMusicStore } from '../../stores/useMusicStore';
import { useVoiceStore } from '../../stores/useVoiceStore';
import { wsService } from '../../services/websocket';

export const MusicPlayerWidget: React.FC = () => {
  const lastLoadedTrackIdRef = useRef<string | null>(null);
  const lastSyncedSeekPosRef = useRef<number>(-1);

  const { currentChannelId } = useVoiceStore();
  const playbackState = useMusicStore((state) =>
    currentChannelId ? state.playbackStates[currentChannelId] ?? null : null,
  );
  const { volume, setVolume, isMuted, toggleMute, setPanelOpen } = useMusicStore();

  const currentTrack = playbackState?.currentTrack;
  const trackId = currentTrack?.id;
  const status = playbackState?.status;
  const positionSeconds = playbackState?.positionSeconds ?? 0;
  const lastUpdatedTimestamp = playbackState?.lastUpdatedTimestamp ?? Date.now();
  const durationSeconds = currentTrack?.durationSeconds || 180;

  // Real-time ticking playback position for the small player
  const [currentPosition, setCurrentPosition] = useState(positionSeconds);

  useEffect(() => {
    if (status !== 'playing') {
      setCurrentPosition(positionSeconds);
      return;
    }

    const interval = setInterval(() => {
      const elapsed = (Date.now() - (lastUpdatedTimestamp || Date.now())) / 1000;
      const pos = Math.min(durationSeconds, positionSeconds + elapsed);
      setCurrentPosition(pos);
    }, 500);

    return () => clearInterval(interval);
  }, [status, positionSeconds, lastUpdatedTimestamp, durationSeconds]);

  // Handle server-side seek events
  useEffect(() => {
    if (!window.echoApi?.music || !trackId) return;

    if (Math.abs(positionSeconds - lastSyncedSeekPosRef.current) > 2) {
      lastSyncedSeekPosRef.current = positionSeconds;
      const elapsed = status === 'playing' ? (Date.now() - lastUpdatedTimestamp) / 1000 : 0;
      const targetSec = Math.max(0, positionSeconds + elapsed);
      void window.echoApi.music.seek(targetSec);
    }
  }, [positionSeconds, trackId, status, lastUpdatedTimestamp]);

  // 1. Sync Track loading with main process background audio engine
  useEffect(() => {
    if (!window.echoApi?.music) return;

    if (!trackId || !currentChannelId || status === 'stopped') {
      if (lastLoadedTrackIdRef.current) {
        lastLoadedTrackIdRef.current = null;
        lastSyncedSeekPosRef.current = -1;
        void window.echoApi.music.stop();
      }
      return;
    }

    const elapsed = status === 'playing' ? (Date.now() - lastUpdatedTimestamp) / 1000 : 0;
    const startSec = Math.max(0, positionSeconds + elapsed);

    if (trackId !== lastLoadedTrackIdRef.current) {
      lastLoadedTrackIdRef.current = trackId;
      lastSyncedSeekPosRef.current = positionSeconds;
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
      lastSyncedSeekPosRef.current = -1;
      void window.echoApi.music.stop();
    }
  }, [currentChannelId]);

  const hasActiveMusic = Boolean(currentTrack) && Boolean(currentChannelId) && status !== 'stopped';
  if (!hasActiveMusic) return null;

  const handleTogglePlayPause = () => {
    if (!currentChannelId) return;
    if (status === 'playing') {
      void window.echoApi?.music?.pause();
      wsService.sendMusicAction({ action: 'pause', channelId: currentChannelId });
    } else {
      void window.echoApi?.music?.resume();
      wsService.sendMusicAction({ action: 'resume', channelId: currentChannelId });
    }
  };

  const handleStop = () => {
    if (!currentChannelId) return;
    void window.echoApi?.music?.stop();
    wsService.sendMusicAction({ action: 'stop', channelId: currentChannelId });
  };

  const handleSkip = () => {
    if (!currentChannelId) return;
    wsService.sendMusicAction({ action: 'skip', channelId: currentChannelId });
  };

  const formatSeconds = (sec: number) => {
    const s = Math.floor(sec);
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${m}:${rem < 10 ? '0' : ''}${rem}`;
  };

  const progressPercent = durationSeconds > 0 ? (currentPosition / durationSeconds) * 100 : 0;

  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col rounded-2xl bg-slate-950/95 border border-indigo-500/40 shadow-2xl shadow-indigo-950/50 backdrop-blur-md text-xs text-white animate-in fade-in slide-in-from-bottom-2 select-none overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-2.5">
        {/* Thumbnail or Music Icon */}
        {currentTrack?.thumbnailUrl ? (
          <img
            src={currentTrack.thumbnailUrl}
            alt={currentTrack.title}
            className="w-10 h-10 rounded-lg object-cover border border-slate-800 shrink-0"
          />
        ) : (
          <div className="w-10 h-10 rounded-lg bg-indigo-950/60 border border-indigo-500/30 flex items-center justify-center shrink-0">
            <Music
              className={`h-4 w-4 ${status === 'playing' ? 'text-indigo-400 animate-pulse' : 'text-slate-400'}`}
            />
          </div>
        )}

        {/* Track Info & Time */}
        <div className="flex flex-col min-w-0 max-w-[150px] md:max-w-[180px]">
          <span className="font-bold truncate text-[11px] leading-tight text-white">
            {currentTrack?.title}
          </span>
          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 truncate leading-tight mt-0.5">
            <span className="truncate max-w-[90px]">{currentTrack?.author || 'YouTube'}</span>
            <span>•</span>
            <span className="font-mono text-indigo-300">
              {formatSeconds(currentPosition)} / {currentTrack?.duration || formatSeconds(durationSeconds)}
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1 ml-1 border-l border-slate-800 pl-2">
          <button
            onClick={handleTogglePlayPause}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-200 hover:text-white transition active:scale-95"
            title={status === 'playing' ? 'Duraklat' : 'Oynat'}
          >
            {status === 'playing' ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 fill-current" />}
          </button>

          <button
            onClick={handleSkip}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition active:scale-95"
            title="Sonraki Şarkı"
          >
            <SkipForward className="h-3.5 w-3.5" />
          </button>

          <button
            onClick={handleStop}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-red-400 transition active:scale-95"
            title="Müziği Durdur"
          >
            <Square className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Inline Volume Control */}
        <div className="flex items-center gap-1.5 border-l border-slate-800 pl-2">
          <button
            onClick={toggleMute}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition"
            title={isMuted ? 'Sesi Aç' : 'Sesi Kapat'}
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="h-3.5 w-3.5 text-rose-400" />
            ) : volume < 50 ? (
              <Volume1 className="h-3.5 w-3.5 text-slate-300" />
            ) : (
              <Volume2 className="h-3.5 w-3.5 text-slate-300" />
            )}
          </button>

          <input
            type="range"
            min={0}
            max={100}
            value={isMuted ? 0 : volume}
            onChange={(e) => {
              const val = Number(e.target.value);
              if (isMuted) toggleMute();
              setVolume(val);
              void window.echoApi?.music?.setVolume(val, false);
            }}
            className="w-14 md:w-16 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            title={`Ses: ${isMuted ? '0%' : `${volume}%`}`}
          />
          <span className="text-[9px] font-mono text-slate-400 w-5 text-right">
            {isMuted ? '0%' : `${volume}%`}
          </span>

          <button
            onClick={() => setPanelOpen(true)}
            className="p-1.5 ml-1 rounded-lg hover:bg-slate-800 text-indigo-400 hover:text-indigo-300 transition"
            title="Müzik Paneli & Kuyruk"
          >
            <ListMusic className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Mini Progress Bar at bottom */}
      <div className="w-full h-1 bg-slate-800/80">
        <div
          className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300"
          style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
        />
      </div>
    </div>
  );
};
