import type {
  VoiceSignalData,
  PeerDiagnosticsStats,
  VoiceParticipant,
} from '@echo/shared';
import { useVoiceStore } from '../stores/useVoiceStore';
import { useAuthStore } from '../stores/useAuthStore';
import { wsService } from './websocket';
import { SERVER_HTTP_URL } from '../config';

interface PreviousPeerStats {
  bytesReceived: number;
  timestamp: number;
}

class WebRTCVoiceService {
  private localStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private vadInterval: ReturnType<typeof setInterval> | null = null;
  private diagnosticsInterval: ReturnType<typeof setInterval> | null = null;

  private peers: Map<string, RTCPeerConnection> = new Map();
  private peerAudioElements: Map<string, HTMLAudioElement> = new Map();
  private peerDisplayNames: Map<string, string> = new Map();
  private pendingCandidates: Map<string, RTCIceCandidateInit[]> = new Map();
  private prevStats: Map<string, PreviousPeerStats> = new Map();

  private iceServers: RTCIceServer[] = [
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: 'stun:stun.l.google.com:19302' },
  ];

  private currentGroupId: string | null = null;
  private currentChannelId: string | null = null;
  private lastSpeakingState = false;
  private speakingSilenceTimer: ReturnType<typeof setTimeout> | null = null;

  private selectedInputDeviceId: string | null = null;
  private selectedOutputDeviceId: string | null = null;
  private outputVolume = 1.0;

  async init(): Promise<void> {
    try {
      const res = await fetch(`${SERVER_HTTP_URL}/api/turn`);
      if (res.ok) {
        const data = (await res.json()) as { iceServers?: RTCIceServer[] };
        if (data.iceServers && data.iceServers.length > 0) {
          this.iceServers = data.iceServers;
        }
      }
    } catch {
      // Fallback STUN is already set
    }
  }

  async join(
    groupId: string,
    groupName: string,
    channelId: string,
    channelName: string,
  ): Promise<void> {
    const voiceStore = useVoiceStore.getState();

    // If already in a channel, leave first
    if (this.currentChannelId) {
      this.leave();
    }

    this.currentGroupId = groupId;
    this.currentChannelId = channelId;
    voiceStore.setConnecting(groupId, groupName, channelId, channelName);

    try {
      // 1. Get microphone stream with Echo cancellation & Noise suppression
      const audioConstraints: MediaTrackConstraints = {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1, // Opus mono
      };
      if (this.selectedInputDeviceId) {
        audioConstraints.deviceId = { exact: this.selectedInputDeviceId };
      }

      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints,
        video: false,
      });

      // Apply current mute / PTT state
      this.updateAudioTrackState();

      // 2. Setup VAD (Voice Activity Detection)
      this.setupVAD(this.localStream);

      // 3. Inform server via WS
      wsService.joinVoice(groupId, channelId);

      // 4. Start diagnostics polling
      this.startDiagnostics();

      voiceStore.setConnected(channelId);
    } catch (err) {
      console.error('Failed to get user media or join voice channel:', err);
      this.leave();
    }
  }

  leave(): void {
    const voiceStore = useVoiceStore.getState();
    const myUserId = useAuthStore.getState().identity?.userId;

    if (this.currentChannelId) {
      if (myUserId) {
        voiceStore.removeChannelParticipant(this.currentChannelId, myUserId);
      }
      wsService.leaveVoice(this.currentChannelId, this.currentGroupId ?? undefined);
    }

    this.currentChannelId = null;
    this.currentGroupId = null;

    // Stop VAD
    if (this.vadInterval) {
      clearInterval(this.vadInterval);
      this.vadInterval = null;
    }
    if (this.speakingSilenceTimer) {
      clearTimeout(this.speakingSilenceTimer);
      this.speakingSilenceTimer = null;
    }
    if (this.audioContext) {
      void this.audioContext.close();
      this.audioContext = null;
      this.analyser = null;
    }

    // Stop diagnostics
    if (this.diagnosticsInterval) {
      clearInterval(this.diagnosticsInterval);
      this.diagnosticsInterval = null;
    }

    // Stop local stream tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop());
      this.localStream = null;
    }

    // Close all peer connections
    for (const [peerId, pc] of this.peers.entries()) {
      pc.close();
      const audio = this.peerAudioElements.get(peerId);
      if (audio) {
        audio.pause();
        audio.srcObject = null;
        audio.remove();
      }
    }

    this.peers.clear();
    this.peerAudioElements.clear();
    this.peerDisplayNames.clear();
    this.pendingCandidates.clear();
    this.prevStats.clear();
    this.lastSpeakingState = false;

    useVoiceStore.getState().setDisconnected();
  }

  // Called when someone (including self) joins or existing participants are provided
  handleUserJoined(
    channelId: string,
    joinedUserId: string,
    joinedDisplayName: string,
    existingParticipants: VoiceParticipant[],
  ): void {
    if (channelId !== this.currentChannelId) return;

    const myUserId = useAuthStore.getState().identity?.userId;

    if (joinedUserId === myUserId) {
      // WE just joined: We are the polite peer. Initiate WebRTC offers to ALL existing participants!
      for (const peer of existingParticipants) {
        if (peer.userId !== myUserId) {
          void this.initiateOffer(peer.userId, peer.displayName);
        }
      }
    } else {
      // Someone else joined: Register their display name and wait for their offer
      this.peerDisplayNames.set(joinedUserId, joinedDisplayName);
    }
  }

  handleUserLeft(channelId: string, leftUserId: string): void {
    if (channelId !== this.currentChannelId) return;

    const pc = this.peers.get(leftUserId);
    if (pc) {
      pc.close();
      this.peers.delete(leftUserId);
    }

    const audio = this.peerAudioElements.get(leftUserId);
    if (audio) {
      audio.pause();
      audio.srcObject = null;
      audio.remove();
      this.peerAudioElements.delete(leftUserId);
    }

    this.peerDisplayNames.delete(leftUserId);
    this.pendingCandidates.delete(leftUserId);
    this.prevStats.delete(leftUserId);

    // Remove from diagnostics
    const currentDiag = { ...useVoiceStore.getState().diagnostics };
    delete currentDiag[leftUserId];
    useVoiceStore.getState().setDiagnostics(currentDiag);
  }

  async handleSignal(fromUserId: string, signal: VoiceSignalData): Promise<void> {
    if (!this.currentChannelId) return;

    if (signal.type === 'offer') {
      await this.handleOffer(fromUserId, signal.sdp);
    } else if (signal.type === 'answer') {
      await this.handleAnswer(fromUserId, signal.sdp);
    } else if (signal.type === 'candidate') {
      await this.handleCandidate(fromUserId, signal);
    }
  }

  private async initiateOffer(peerId: string, displayName: string): Promise<void> {
    this.peerDisplayNames.set(peerId, displayName);
    const pc = this.getOrCreatePeerConnection(peerId, displayName);

    try {
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false,
      });

      await pc.setLocalDescription(offer);

      if (this.currentChannelId && pc.localDescription) {
        wsService.sendVoiceSignal(this.currentChannelId, peerId, {
          type: 'offer',
          sdp: pc.localDescription.sdp,
        });
      }
    } catch (err) {
      console.error(`Failed to create offer for peer ${peerId}:`, err);
    }
  }

  private async handleOffer(peerId: string, sdp: string): Promise<void> {
    const displayName = this.peerDisplayNames.get(peerId) || 'Kullanıcı';
    const pc = this.getOrCreatePeerConnection(peerId, displayName);

    try {
      await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp }));

      // Drain queued ICE candidates
      const pending = this.pendingCandidates.get(peerId) ?? [];
      for (const cand of pending) {
        await pc.addIceCandidate(new RTCIceCandidate(cand));
      }
      this.pendingCandidates.delete(peerId);

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      if (this.currentChannelId && pc.localDescription) {
        wsService.sendVoiceSignal(this.currentChannelId, peerId, {
          type: 'answer',
          sdp: pc.localDescription.sdp,
        });
      }
    } catch (err) {
      console.error(`Failed to handle offer from ${peerId}:`, err);
    }
  }

  private async handleAnswer(peerId: string, sdp: string): Promise<void> {
    const pc = this.peers.get(peerId);
    if (!pc) return;

    try {
      await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp }));

      // Drain queued ICE candidates
      const pending = this.pendingCandidates.get(peerId) ?? [];
      for (const cand of pending) {
        await pc.addIceCandidate(new RTCIceCandidate(cand));
      }
      this.pendingCandidates.delete(peerId);
    } catch (err) {
      console.error(`Failed to handle answer from ${peerId}:`, err);
    }
  }

  private async handleCandidate(
    peerId: string,
    candidateData: { candidate: string; sdpMid?: string | null; sdpMLineIndex?: number | null },
  ): Promise<void> {
    if (!candidateData.candidate || candidateData.candidate.trim().length === 0) return;

    const pc = this.peers.get(peerId);

    const candidateInit: RTCIceCandidateInit = {
      candidate: candidateData.candidate,
      sdpMid: candidateData.sdpMid,
      sdpMLineIndex: candidateData.sdpMLineIndex,
    };

    if (pc && pc.remoteDescription && pc.remoteDescription.type) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidateInit));
      } catch (err) {
        console.warn(`Failed to add ICE candidate for ${peerId}:`, err);
      }
    } else {
      // Queue until remote description is set
      const list = this.pendingCandidates.get(peerId) ?? [];
      list.push(candidateInit);
      this.pendingCandidates.set(peerId, list);
    }
  }

  private getOrCreatePeerConnection(peerId: string, displayName: string): RTCPeerConnection {
    let pc = this.peers.get(peerId);
    if (pc) return pc;

    pc = new RTCPeerConnection({
      iceServers: this.iceServers,
    });

    this.peers.set(peerId, pc);
    this.peerDisplayNames.set(peerId, displayName);

    // Add local audio track
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        pc!.addTrack(track, this.localStream!);
      });
    }

    // ICE Candidate generation (only non-empty candidates)
    pc.onicecandidate = (event) => {
      if (event.candidate && event.candidate.candidate && this.currentChannelId) {
        wsService.sendVoiceSignal(this.currentChannelId, peerId, {
          type: 'candidate',
          candidate: event.candidate.candidate,
          sdpMid: event.candidate.sdpMid,
          sdpMLineIndex: event.candidate.sdpMLineIndex,
        });
      }
    };

    // Remote audio track reception
    pc.ontrack = (event) => {
      let audio = this.peerAudioElements.get(peerId);
      if (!audio) {
        audio = new Audio();
        audio.autoplay = true;
        audio.style.display = 'none';
        document.body.appendChild(audio);
        this.peerAudioElements.set(peerId, audio);
      }
      audio.srcObject = event.streams[0] ?? new MediaStream([event.track]);
      audio.volume = this.outputVolume;

      // Apply deafen state
      const isDeafened = useVoiceStore.getState().isDeafened;
      audio.muted = isDeafened;

      void audio.play().catch((e) => console.warn('Audio play prevented:', e));
    };

    pc.onconnectionstatechange = () => {
      if (pc?.connectionState === 'failed' || pc?.connectionState === 'closed') {
        this.handleUserLeft(this.currentChannelId || '', peerId);
      }
    };

    return pc;
  }

  updateAudioTrackState(): void {
    const store = useVoiceStore.getState();
    const isMuted = store.isMuted || store.isDeafened;
    const canTransmit = !isMuted && (store.inputMode === 'vad' || store.isPttActive);

    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((t) => {
        t.enabled = canTransmit;
      });
    }

    if (!canTransmit && this.lastSpeakingState) {
      if (this.speakingSilenceTimer) {
        clearTimeout(this.speakingSilenceTimer);
        this.speakingSilenceTimer = null;
      }
      this.setLocalSpeaking(false);
    }
  }

  setPttActive(active: boolean): void {
    const store = useVoiceStore.getState();
    if (store.isPttActive === active) return;
    store.setPttActive(active);
    this.updateAudioTrackState();

    if (store.inputMode === 'ptt' && !store.isMuted && !store.isDeafened) {
      this.setLocalSpeaking(active);
    }
  }

  setInputMode(mode: 'vad' | 'ptt'): void {
    const store = useVoiceStore.getState();
    store.setInputMode(mode);
    this.updateAudioTrackState();
  }

  toggleMute(): void {
    const store = useVoiceStore.getState();
    const newMuted = !store.isMuted;
    store.setMuted(newMuted);
    this.updateAudioTrackState();

    if (this.currentChannelId) {
      wsService.sendVoiceState(this.currentChannelId, {
        muted: newMuted,
        deafened: store.isDeafened,
        speaking: false,
      });
    }
  }

  toggleDeafen(): void {
    const store = useVoiceStore.getState();
    const newDeafened = !store.isDeafened;
    store.setDeafened(newDeafened);
    this.updateAudioTrackState();

    // Mute all remote audio elements
    this.peerAudioElements.forEach((audio) => {
      audio.muted = newDeafened;
    });

    if (this.currentChannelId) {
      wsService.sendVoiceState(this.currentChannelId, {
        muted: newDeafened ? true : store.isMuted,
        deafened: newDeafened,
        speaking: false,
      });
    }
  }

  private setupVAD(stream: MediaStream): void {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioContext = new AudioCtx();
      const source = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.2;
      source.connect(this.analyser);

      const buffer = new Float32Array(this.analyser.fftSize);

      this.vadInterval = setInterval(() => {
        if (!this.analyser || !this.currentChannelId) return;

        const store = useVoiceStore.getState();
        const canTransmit = !store.isMuted && !store.isDeafened && (store.inputMode === 'vad' || store.isPttActive);
        if (!canTransmit) {
          if (this.lastSpeakingState) {
            this.setLocalSpeaking(false);
          }
          return;
        }

        // In PTT mode, speaking state is driven directly by PTT button activation
        if (store.inputMode === 'ptt') {
          if (!this.lastSpeakingState && store.isPttActive) {
            this.setLocalSpeaking(true);
          }
          return;
        }

        this.analyser.getFloatTimeDomainData(buffer);

        // Calculate Root Mean Square (RMS)
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
          sum += buffer[i]! * buffer[i]!;
        }
        const rms = Math.sqrt(sum / buffer.length);
        const threshold = 0.02; // Voice detection threshold

        if (rms > threshold) {
          if (this.speakingSilenceTimer) {
            clearTimeout(this.speakingSilenceTimer);
            this.speakingSilenceTimer = null;
          }
          if (!this.lastSpeakingState) {
            this.setLocalSpeaking(true);
          }
        } else {
          // Delay turning off speaking by 350ms to prevent flickering
          if (this.lastSpeakingState && !this.speakingSilenceTimer) {
            this.speakingSilenceTimer = setTimeout(() => {
              this.setLocalSpeaking(false);
              this.speakingSilenceTimer = null;
            }, 350);
          }
        }
      }, 100);
    } catch (err) {
      console.warn('VAD setup failed:', err);
    }
  }

  private setLocalSpeaking(speaking: boolean): void {
    this.lastSpeakingState = speaking;
    useVoiceStore.getState().setSpeaking(speaking);

    if (this.currentChannelId) {
      const store = useVoiceStore.getState();
      wsService.sendVoiceState(this.currentChannelId, {
        muted: store.isMuted,
        deafened: store.isDeafened,
        speaking,
      });
    }
  }

  private startDiagnostics(): void {
    this.diagnosticsInterval = setInterval(() => {
      void this.pollDiagnostics();
    }, 1500);
  }

  private async pollDiagnostics(): Promise<void> {
    if (this.peers.size === 0) {
      useVoiceStore.getState().setPingMs(0);
      return;
    }

    const diags: Record<string, PeerDiagnosticsStats> = {};
    let totalRtt = 0;
    let rttCount = 0;

    for (const [peerId, pc] of this.peers.entries()) {
      const displayName = this.peerDisplayNames.get(peerId) || 'Kullanıcı';

      let candidateType: 'host' | 'srflx' | 'relay' | 'unknown' = 'unknown';
      let localCandidateType: string | undefined;
      let remoteCandidateType: string | undefined;
      let rttMs = 0;
      let packetsLost = 0;
      let fractionLost = 0;
      let bitrateKbps = 0;
      let audioLevel = 0;

      try {
        const stats = await pc.getStats();

        // 1. Find nominated / succeeded candidate-pair
        stats.forEach((report) => {
          if (report.type === 'candidate-pair' && (report.state === 'succeeded' || report.nominated)) {
            rttMs = Math.round((report.currentRoundTripTime || 0) * 1000);
            if (rttMs > 0) {
              totalRtt += rttMs;
              rttCount++;
            }

            const localCandidate = stats.get(report.localCandidateId);
            const remoteCandidate = stats.get(report.remoteCandidateId);

            localCandidateType = localCandidate?.candidateType;
            remoteCandidateType = remoteCandidate?.candidateType;

            if (remoteCandidate?.candidateType) {
              candidateType = remoteCandidate.candidateType as 'host' | 'srflx' | 'relay';
            } else if (localCandidate?.candidateType) {
              candidateType = localCandidate.candidateType as 'host' | 'srflx' | 'relay';
            }
          }

          if (report.type === 'inbound-rtp' && report.kind === 'audio') {
            packetsLost = report.packetsLost || 0;
            fractionLost = report.fractionLost || 0;
            audioLevel = report.audioLevel || 0;

            const now = report.timestamp;
            const bytes = report.bytesReceived || 0;
            const prev = this.prevStats.get(peerId);

            if (prev && now > prev.timestamp) {
              const deltaBytes = bytes - prev.bytesReceived;
              const deltaSec = (now - prev.timestamp) / 1000;
              bitrateKbps = Math.round((deltaBytes * 8) / deltaSec / 1000);
            }

            this.prevStats.set(peerId, { bytesReceived: bytes, timestamp: now });
          }
        });
      } catch (err) {
        console.warn('Failed to get stats for peer:', peerId, err);
      }

      diags[peerId] = {
        peerId,
        displayName,
        connectionState: pc.connectionState,
        iceConnectionState: pc.iceConnectionState,
        candidateType,
        localCandidateType,
        remoteCandidateType,
        rttMs,
        packetsLost,
        fractionLost,
        bitrateKbps,
        audioLevel,
      };
    }

    useVoiceStore.getState().setDiagnostics(diags);

    if (rttCount > 0) {
      useVoiceStore.getState().setPingMs(Math.round(totalRtt / rttCount));
    }
  }

  async getAudioDevices(): Promise<{ inputs: MediaDeviceInfo[]; outputs: MediaDeviceInfo[] }> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return {
        inputs: devices.filter((d) => d.kind === 'audioinput'),
        outputs: devices.filter((d) => d.kind === 'audiooutput'),
      };
    } catch {
      return { inputs: [], outputs: [] };
    }
  }

  async setInputDevice(deviceId: string): Promise<void> {
    this.selectedInputDeviceId = deviceId;
    if (this.localStream && this.currentChannelId) {
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: { exact: deviceId },
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1,
          },
          video: false,
        });

        const newTrack = newStream.getAudioTracks()[0];
        if (newTrack) {
          for (const pc of this.peers.values()) {
            const sender = pc.getSenders().find((s) => s.track?.kind === 'audio');
            if (sender) {
              await sender.replaceTrack(newTrack);
            }
          }
          this.localStream.getAudioTracks().forEach((t) => t.stop());
          this.localStream = newStream;
          this.setupVAD(newStream);
        }
      } catch (err) {
        console.warn('Failed to switch input device:', err);
      }
    }
  }

  setOutputVolume(volume: number): void {
    this.outputVolume = Math.max(0, Math.min(1, volume));
    this.peerAudioElements.forEach((audio) => {
      audio.volume = this.outputVolume;
    });
  }

  getOutputVolume(): number {
    return this.outputVolume;
  }

  getInputDeviceId(): string | null {
    return this.selectedInputDeviceId;
  }

  getOutputDeviceId(): string | null {
    return this.selectedOutputDeviceId;
  }

  testMicrophone(onLevel: (rms: number) => void): () => void {
    let active = true;
    let testAudioContext: AudioContext | null = null;
    let stream: MediaStream | null = null;
    let interval: ReturnType<typeof setInterval> | null = null;

    void (async () => {
      try {
        const constraints: MediaStreamConstraints = {
          audio: this.selectedInputDeviceId
            ? { deviceId: { exact: this.selectedInputDeviceId } }
            : true,
          video: false,
        };
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        testAudioContext = new AudioCtx();
        const source = testAudioContext.createMediaStreamSource(stream);
        const analyser = testAudioContext.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);

        const buffer = new Float32Array(analyser.fftSize);
        interval = setInterval(() => {
          if (!active) return;
          analyser.getFloatTimeDomainData(buffer);
          let sum = 0;
          for (let i = 0; i < buffer.length; i++) {
            sum += buffer[i]! * buffer[i]!;
          }
          const rms = Math.sqrt(sum / buffer.length);
          onLevel(Math.min(1, rms * 5));
        }, 50);
      } catch (err) {
        console.warn('Mic test error:', err);
      }
    })();

    return () => {
      active = false;
      if (interval) clearInterval(interval);
      if (testAudioContext) void testAudioContext.close();
      if (stream) stream.getTracks().forEach((t) => t.stop());
      onLevel(0);
    };
  }
}

export const webrtcService = new WebRTCVoiceService();
