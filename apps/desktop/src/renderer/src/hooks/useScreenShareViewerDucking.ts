import { useEffect, useRef, useState } from 'react';
import { useVoiceStore } from '../stores/useVoiceStore';
import { UserAudioState } from '@echo/shared';

interface UseScreenShareViewerDuckingOptions {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  userVolume: number;
  isMuted: boolean;
  isLocal: boolean;
}

export interface ScreenShareViewerDuckingResult {
  isDucked: boolean;
  effectiveVolume: number;
}

/**
 * Smart viewer-side self-voice ducking:
 * When the viewer is speaking in the voice channel, the incoming stream audio
 * is instantaneously ducked to prevent their own voice from returning as a ~200ms
 * delayed loopback echo from the streamer's Windows desktop audio capture.
 * A 400ms hold time is enforced after silence to suppress the full network RTT echo tail.
 */
export function useScreenShareViewerDucking({
  videoRef,
  userVolume,
  isMuted,
  isLocal,
}: UseScreenShareViewerDuckingOptions): ScreenShareViewerDuckingResult {
  const isSpeaking = useVoiceStore(
    (s) => s.isSpeaking || s.audioState === UserAudioState.SPEAKING,
  );

  const [isDucked, setIsDucked] = useState(false);
  const restoreTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isLocal) {
      // Local streamer's own preview video is always muted to avoid local feedback
      if (videoRef.current) {
        videoRef.current.muted = true;
      }
      return;
    }

    if (isSpeaking) {
      // User started speaking: cancel any restore timer and immediately duck
      if (restoreTimeoutRef.current) {
        clearTimeout(restoreTimeoutRef.current);
        restoreTimeoutRef.current = null;
      }
      setIsDucked(true);
    } else {
      // User stopped speaking: wait 400ms (echo tail hold) before restoring normal volume
      if (isDucked && !restoreTimeoutRef.current) {
        restoreTimeoutRef.current = setTimeout(() => {
          setIsDucked(false);
          restoreTimeoutRef.current = null;
        }, 400);
      }
    }

    return () => {
      if (restoreTimeoutRef.current) {
        clearTimeout(restoreTimeoutRef.current);
        restoreTimeoutRef.current = null;
      }
    };
  }, [isSpeaking, isLocal, isDucked]);

  // Calculate and apply effective volume to the HTMLVideoElement
  const baseVolume = isMuted ? 0 : userVolume;
  // During ducking, reduce volume to 5% (near silence) to block 200ms delayed self-voice echo
  const effectiveVolume = isDucked ? baseVolume * 0.05 : baseVolume;

  useEffect(() => {
    if (isLocal) return;

    if (videoRef.current) {
      videoRef.current.muted = isMuted || effectiveVolume === 0;
      videoRef.current.volume = Math.max(0, Math.min(1, effectiveVolume));
    }
  }, [effectiveVolume, isMuted, isLocal, videoRef]);

  return {
    isDucked,
    effectiveVolume,
  };
}
