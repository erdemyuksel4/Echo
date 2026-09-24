import { useVoiceStore } from '../../stores/useVoiceStore';
import { useAuthStore } from '../../stores/useAuthStore';

export class ScreenAudioDuckingService {
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private duckingGainNode: GainNode | null = null;
  private destinationNode: MediaStreamAudioDestinationNode | null = null;
  private unsubscribeVoiceStore: (() => void) | null = null;
  private restoreTimeout: ReturnType<typeof setTimeout> | null = null;
  private isDucked = false;

  /**
   * Processes the local screen capture audio track by passing it through
   * a Web Audio GainNode. When friends in the voice channel speak,
   * the screen audio is smoothly ducked to prevent loopback voice echo.
   */
  processStreamAudio(stream: MediaStream, channelId: string): MediaStream {
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) {
      // No audio captured, return stream as is
      return stream;
    }

    const rawAudioTrack = audioTracks[0]!;
    const videoTracks = stream.getVideoTracks();

    try {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioContext = new AudioCtxClass();

      // Create stream source from the captured screen audio
      const rawAudioStream = new MediaStream([rawAudioTrack]);
      this.sourceNode = this.audioContext.createMediaStreamSource(rawAudioStream);

      // Create GainNode for dynamic ducking
      this.duckingGainNode = this.audioContext.createGain();
      this.duckingGainNode.gain.setValueAtTime(1.0, this.audioContext.currentTime);

      // Create destination for WebRTC transport
      this.destinationNode = this.audioContext.createMediaStreamDestination();

      this.sourceNode.connect(this.duckingGainNode);
      this.duckingGainNode.connect(this.destinationNode);

      const processedAudioTrack = this.destinationNode.stream.getAudioTracks()[0]!;

      // Handle track endings
      rawAudioTrack.addEventListener('ended', () => {
        this.cleanup();
      });

      // Subscribe to voice store to monitor peer speaking events
      this.startVoiceChannelMonitoring(channelId);

      // Assemble new stream with original video + processed ducked audio
      return new MediaStream([...videoTracks, processedAudioTrack]);
    } catch (err) {
      console.warn('[ScreenAudioDuckingService] Failed to initialize Web Audio ducking:', err);
      // Fallback: return original stream unmodified
      return stream;
    }
  }

  private startVoiceChannelMonitoring(channelId: string): void {
    if (this.unsubscribeVoiceStore) {
      this.unsubscribeVoiceStore();
    }

    this.unsubscribeVoiceStore = useVoiceStore.subscribe((state) => {
      if (!this.audioContext || !this.duckingGainNode) return;

      const myUserId = useAuthStore.getState().identity?.userId;
      const participants = state.channelParticipants[channelId] ?? [];

      // Check if any remote friend in the same voice channel is speaking
      const isAnyPeerSpeaking = participants.some(
        (p) => p.userId !== myUserId && (p.speaking || (!p.muted && !p.deafened && false)),
      );

      if (isAnyPeerSpeaking) {
        if (this.restoreTimeout) {
          clearTimeout(this.restoreTimeout);
          this.restoreTimeout = null;
        }

        if (!this.isDucked) {
          this.isDucked = true;
          // Instantly ramp gain down to 0 (complete silence of loopback leak) in 10ms
          const now = this.audioContext.currentTime;
          this.duckingGainNode.gain.cancelScheduledValues(now);
          this.duckingGainNode.gain.setTargetAtTime(0.0, now, 0.01);
        }
      } else if (this.isDucked && !this.restoreTimeout) {
        // Hold ducking for 450ms to ensure the echo tail (WebRTC RTT + buffer) has passed
        this.restoreTimeout = setTimeout(() => {
          if (!this.audioContext || !this.duckingGainNode) return;
          this.isDucked = false;
          this.restoreTimeout = null;

          // Smoothly restore gain back to 100% over 150ms
          const now = this.audioContext.currentTime;
          this.duckingGainNode.gain.cancelScheduledValues(now);
          this.duckingGainNode.gain.setTargetAtTime(1.0, now, 0.15);
        }, 450);
      }
    });
  }

  cleanup(): void {
    if (this.unsubscribeVoiceStore) {
      this.unsubscribeVoiceStore();
      this.unsubscribeVoiceStore = null;
    }

    if (this.restoreTimeout) {
      clearTimeout(this.restoreTimeout);
      this.restoreTimeout = null;
    }

    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch {
        // Ignore
      }
      this.sourceNode = null;
    }

    if (this.duckingGainNode) {
      try {
        this.duckingGainNode.disconnect();
      } catch {
        // Ignore
      }
      this.duckingGainNode = null;
    }

    if (this.destinationNode) {
      try {
        this.destinationNode.disconnect();
      } catch {
        // Ignore
      }
      this.destinationNode = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        void this.audioContext.close();
      } catch {
        // Ignore
      }
      this.audioContext = null;
    }

    this.isDucked = false;
  }
}
