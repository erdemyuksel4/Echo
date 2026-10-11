import React, { useEffect, useRef, useState } from 'react';
import { useMusicStore } from '../../stores/useMusicStore';
import { useVoiceStore } from '../../stores/useVoiceStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { wsService } from '../../services/websocket';
import { webrtcService } from '../../services/webrtc';

export const MusicPlayerWidget: React.FC = () => {
  const lastLoadedTrackIdRef = useRef<string | null>(null);
  const lastSyncedSeekPosRef = useRef<number>(-1);

  const { currentChannelId } = useVoiceStore();
  const { identity } = useAuthStore();
  const playbackState = useMusicStore((state) =>
    currentChannelId ? state.playbackStates[currentChannelId] ?? null : null,
  );
  const { volume, isMuted, isAdPlaying, setIsAdPlaying } = useMusicStore();

  const currentTrack = playbackState?.currentTrack;
  const trackId = currentTrack?.id;
  const status = playbackState?.status;
  const positionSeconds = playbackState?.positionSeconds ?? 0;
  const lastUpdatedTimestamp = playbackState?.lastUpdatedTimestamp ?? Date.now();
  const durationSeconds = currentTrack?.durationSeconds || 180;
  const isHost = Boolean(playbackState?.hostUserId && identity?.userId && playbackState.hostUserId === identity.userId);

  // Real-time ticking playback position for the background player
  const [, setCurrentPosition] = useState(positionSeconds);

  useEffect(() => {
    if (!window.echoApi?.music) return;
    const cleanup = window.echoApi.music.onAdState((data) => {
      setIsAdPlaying(data.isAd);
    });
    return cleanup;
  }, [setIsAdPlaying]);

  useEffect(() => {
    if (status !== 'playing' || isAdPlaying) {
      if (!isAdPlaying) {
        setCurrentPosition(positionSeconds);
      }
      return;
    }

    const interval = setInterval(() => {
      const elapsed = (Date.now() - (lastUpdatedTimestamp || Date.now())) / 1000;
      const pos = Math.min(durationSeconds, positionSeconds + elapsed);
      setCurrentPosition(pos);
    }, 500);

    return () => clearInterval(interval);
  }, [status, isAdPlaying, positionSeconds, lastUpdatedTimestamp, durationSeconds]);

  // Handle server-side seek events (Only host executes locally)
  useEffect(() => {
    if (!window.echoApi?.music || !trackId || !isHost) return;

    if (Math.abs(positionSeconds - lastSyncedSeekPosRef.current) > 2) {
      lastSyncedSeekPosRef.current = positionSeconds;
      const elapsed = status === 'playing' ? (Date.now() - lastUpdatedTimestamp) / 1000 : 0;
      const targetSec = Math.max(0, positionSeconds + elapsed);
      void window.echoApi.music.seek(targetSec);
    }
  }, [positionSeconds, trackId, status, lastUpdatedTimestamp, isHost]);

  // 1. Sync Track loading with main process background audio engine (HOST ONLY)
  useEffect(() => {
    if (!window.echoApi?.music) return;

    // Listeners do NOT load or play YouTube locally! They hear it from Echo Müzik [BOT] via WebRTC!
    if (!isHost || !trackId || !currentChannelId || status === 'stopped') {
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
  }, [trackId, currentChannelId, status, isHost, positionSeconds, lastUpdatedTimestamp]);

  // 2. Sync Play/Pause/Resume Status (HOST ONLY)
  useEffect(() => {
    if (!window.echoApi?.music || !trackId || !currentChannelId || !isHost) return;

    if (status === 'playing') {
      void window.echoApi.music.resume();
    } else if (status === 'paused') {
      void window.echoApi.music.pause();
    } else if (status === 'stopped') {
      void window.echoApi.music.stop();
    }
  }, [status, trackId, currentChannelId, isHost]);

  // 3. Sync Volume & Mute (Host controls local Chromium player, listeners control incoming bot WebRTC audio)
  useEffect(() => {
    if (isHost) {
      if (window.echoApi?.music) {
        void window.echoApi.music.setVolume(volume, isMuted);
      }
    } else {
      const effectiveVol = isMuted ? 0 : volume;
      webrtcService.setPeerVolume('bot-music', effectiveVol);
    }
  }, [volume, isMuted, isHost]);

  // 4. Listen for Track End event from main process -> trigger skip (HOST ONLY)
  useEffect(() => {
    if (!window.echoApi?.music || !isHost) return;

    const cleanup = window.echoApi.music.onEnded(() => {
      if (currentChannelId) {
        wsService.sendMusicAction({ action: 'skip', channelId: currentChannelId });
      }
    });
    return cleanup;
  }, [currentChannelId, isHost]);

  // 5. Clean up when leaving channel
  useEffect(() => {
    if (!currentChannelId && window.echoApi?.music) {
      lastLoadedTrackIdRef.current = null;
      lastSyncedSeekPosRef.current = -1;
      void window.echoApi.music.stop();
    }
  }, [currentChannelId]);

  return null;
};
