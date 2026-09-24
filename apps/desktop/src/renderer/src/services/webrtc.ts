import {
  type VoiceSignalData,
  type PeerDiagnosticsStats,
  type VoiceParticipant,
  UserAudioState,
} from '@echo/shared';
import { useVoiceStore } from '../stores/useVoiceStore';
import { useAuthStore } from '../stores/useAuthStore';
import { wsService } from './websocket';
import { iceServersService } from './iceServers';

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

  private iceServers: RTCIceServer[] = iceServersService.getIceServers();

  private currentGroupId: string | null = null;
  private currentChannelId: string | null = null;
  private lastSpeakingState = false;
  private speakingSilenceTimer: ReturnType<typeof setTimeout> | null = null;

  private selectedInputDeviceId: string | null = (() => {
    try {
      return localStorage.getItem('echo_voice_input_device') || null;
    } catch {
      return null;
    }
  })();
  private selectedOutputDeviceId: string | null = (() => {
    try {
      return localStorage.getItem('echo_voice_output_device') || null;
    } catch {
      return null;
    }
  })();
  private selectedVideoDeviceId: string | null = null;
  private localCameraStream: MediaStream | null = null;
  private outputVolume = 1.0;

  async init(): Promise<void> {
    await iceServersService.fetchIceServers();
    this.iceServers = iceServersService.getIceServers();

    if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
      navigator.mediaDevices.ondevicechange = () => {
        console.log('[Echo WebRTC] Audio/Video device change detected.');
        if (this.currentChannelId) {
          const liveMicTracks = this.localStream?.getAudioTracks().filter((t) => t.readyState === 'live');
          if (!liveMicTracks || liveMicTracks.length === 0) {
            void this.reacquireLocalAudio();
          }
        }
      };
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

    // Refresh ICE / TURN relay credentials
    try {
      await iceServersService.fetchIceServers();
      this.iceServers = iceServersService.getIceServers();
    } catch (e) {
      console.warn('[Echo WebRTC] Failed to refresh ICE servers on join:', e);
    }

    try {
      // 1. Get microphone stream with Echo cancellation & Noise suppression
      const audioConstraints: MediaTrackConstraints = {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      };
      if (this.selectedInputDeviceId && this.selectedInputDeviceId !== 'default') {
        audioConstraints.deviceId = { exact: this.selectedInputDeviceId };
      }

      try {
        this.localStream = await navigator.mediaDevices.getUserMedia({
          audio: audioConstraints,
          video: false,
        });
      } catch (deviceErr) {
        console.warn('[Echo WebRTC] Selected input device failed, falling back:', deviceErr);
        this.selectedInputDeviceId = null;
        try {
          this.localStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
            video: false,
          });
        } catch {
          console.warn('[Echo WebRTC] Fallback with constraints failed, requesting raw audio: true');
          this.localStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: false,
          });
        }
      }

      const micTrack = this.localStream.getAudioTracks()[0];
      if (!micTrack) {
        throw new Error('Mikrofon ses izi (audio track) bulunamadı');
      }

      // Check if muted by hardware switch or OS
      if (micTrack.muted) {
        console.warn('[Echo WebRTC] Local microphone track is muted by hardware or OS!');
        voiceStore.setIsMicUnavailable(true);
      } else {
        voiceStore.setIsMicUnavailable(false);
      }

      micTrack.onmute = () => {
        console.warn('[Echo WebRTC] Local microphone track muted by hardware or OS!');
        useVoiceStore.getState().setIsMicUnavailable(true);
      };
      micTrack.onunmute = () => {
        console.log('[Echo WebRTC] Local microphone track unmuted.');
        useVoiceStore.getState().setIsMicUnavailable(false);
      };

      micTrack.onended = () => {
        console.warn('[Echo WebRTC] Local microphone track ended, attempting re-acquire...');
        if (this.currentChannelId) {
          void this.reacquireLocalAudio();
        }
      };

      // Apply current mute / PTT state
      this.updateAudioTrackState();

      // 2. Setup VAD (Voice Activity Detection)
      this.setupVAD(this.localStream);

      // 3. Inform server via WS
      wsService.joinVoice(groupId, channelId);

      // 4. Start diagnostics polling
      this.startDiagnostics();

      // Connection safety gate: only mark connected if alone or once peer connection is up
      this.updateConnectionStatusGate();
    } catch (err) {
      console.error('Failed to get user media or join voice channel:', err);
      this.leave();
    }
  }

  leave(): void {
    const voiceStore = useVoiceStore.getState();
    const myUserId = useAuthStore.getState().identity?.userId;

    const exitingChannelId = this.currentChannelId;
    const exitingGroupId = this.currentGroupId;

    // Immediately null out channel ID so no incoming tracks/signals can be processed or played
    this.currentChannelId = null;
    this.currentGroupId = null;

    if (exitingChannelId) {
      if (myUserId) {
        voiceStore.removeChannelParticipant(exitingChannelId, myUserId);
      }
      wsService.leaveVoice(exitingChannelId, exitingGroupId ?? undefined);
    }

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
      try {
        void this.audioContext.close();
      } catch {
        // Ignore
      }
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
      this.localStream.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {
          // Ignore
        }
      });
      this.localStream = null;
    }

    // Stop local camera stream tracks
    if (this.localCameraStream) {
      this.localCameraStream.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {
          // Ignore
        }
      });
      this.localCameraStream = null;
    }

    // Close all peer connections and detach handlers
    for (const [peerId, pc] of this.peers.entries()) {
      try {
        pc.ontrack = null;
        pc.onicecandidate = null;
        pc.onconnectionstatechange = null;
        pc.close();
      } catch (err) {
        console.warn(`Error closing peer ${peerId}:`, err);
      }
    }
    this.peers.clear();

    // Pause, stop all tracks, and remove all peer audio elements
    for (const audio of this.peerAudioElements.values()) {
      try {
        audio.pause();
        if (audio.srcObject instanceof MediaStream) {
          audio.srcObject.getTracks().forEach((track) => {
            try {
              track.stop();
            } catch {
              // Ignore
            }
          });
        }
        audio.srcObject = null;
        audio.remove();
      } catch (err) {
        console.warn('Error cleaning up audio element:', err);
      }
    }
    this.peerAudioElements.clear();

    // DOM Sweep: Clean up ANY orphaned audio elements in DOM
    if (typeof document !== 'undefined') {
      document.querySelectorAll<HTMLAudioElement>('audio[data-echo-peer]').forEach((el) => {
        try {
          el.pause();
          if (el.srcObject instanceof MediaStream) {
            el.srcObject.getTracks().forEach((track) => {
              try {
                track.stop();
              } catch {
                // Ignore
              }
            });
          }
          el.srcObject = null;
          el.remove();
        } catch {
          // Ignore
        }
      });
    }

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
    this.updateConnectionStatusGate();
  }

  handleUserLeft(channelId: string, leftUserId: string): void {
    if (channelId !== this.currentChannelId) return;

    const pc = this.peers.get(leftUserId);
    if (pc) {
      try {
        pc.ontrack = null;
        pc.onicecandidate = null;
        pc.onconnectionstatechange = null;
        pc.close();
      } catch {
        // Ignore
      }
      this.peers.delete(leftUserId);
    }

    const audio = this.peerAudioElements.get(leftUserId);
    if (audio) {
      try {
        audio.pause();
        if (audio.srcObject instanceof MediaStream) {
          audio.srcObject.getTracks().forEach((track) => {
            try {
              track.stop();
            } catch {
              // Ignore
            }
          });
        }
        audio.srcObject = null;
        audio.remove();
      } catch {
        // Ignore
      }
      this.peerAudioElements.delete(leftUserId);
    }

    this.peerDisplayNames.delete(leftUserId);
    this.pendingCandidates.delete(leftUserId);
    this.prevStats.delete(leftUserId);
    useVoiceStore.getState().removePeerCameraStream(leftUserId);

    // Remove from diagnostics
    const currentDiag = { ...useVoiceStore.getState().diagnostics };
    delete currentDiag[leftUserId];
    useVoiceStore.getState().setDiagnostics(currentDiag);

    this.updateConnectionStatusGate();
  }

  async handleSignal(fromUserId: string, signal: VoiceSignalData, channelId?: string): Promise<void> {
    if (!this.currentChannelId) return;
    if (channelId && channelId !== this.currentChannelId) return;

    if (signal.type === 'offer') {
      await this.handleOffer(fromUserId, signal.sdp);
    } else if (signal.type === 'answer') {
      await this.handleAnswer(fromUserId, signal.sdp);
    } else if (signal.type === 'candidate') {
      await this.handleCandidate(fromUserId, signal);
    }
  }

  private async initiateOffer(peerId: string, displayName: string): Promise<void> {
    if (!this.currentChannelId) return;
    this.peerDisplayNames.set(peerId, displayName);

    let pc: RTCPeerConnection;
    try {
      pc = this.getOrCreatePeerConnection(peerId, displayName);
    } catch {
      return;
    }

    // Ensure local audio track is attached to PC before offer is generated
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        const sender = pc.getSenders().find((s) => s.track?.kind === 'audio');
        if (!sender) {
          pc.addTrack(audioTrack, this.localStream);
        } else if (sender.track !== audioTrack) {
          void sender.replaceTrack(audioTrack);
        }
      }
    }

    try {
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });

      if (!this.currentChannelId) {
        try {
          pc.close();
        } catch {
          // Ignore
        }
        return;
      }

      await pc.setLocalDescription(offer);

      if (!this.currentChannelId) {
        try {
          pc.close();
        } catch {
          // Ignore
        }
        return;
      }

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
    if (!this.currentChannelId) return;
    const displayName = this.peerDisplayNames.get(peerId) || 'Kullanıcı';

    let pc: RTCPeerConnection;
    try {
      pc = this.getOrCreatePeerConnection(peerId, displayName);
    } catch {
      return;
    }

    // Ensure local audio track is attached to PC before answer is generated
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        const sender = pc.getSenders().find((s) => s.track?.kind === 'audio');
        if (!sender) {
          pc.addTrack(audioTrack, this.localStream);
        } else if (sender.track !== audioTrack) {
          void sender.replaceTrack(audioTrack);
        }
      }
    }

    try {
      await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp }));
      if (!this.currentChannelId) {
        try {
          pc.close();
        } catch {
          // Ignore
        }
        return;
      }

      // Drain queued ICE candidates safely
      const pending = this.pendingCandidates.get(peerId) ?? [];
      for (const cand of pending) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(cand));
        } catch (candErr) {
          console.warn(`[Echo WebRTC] Failed to add queued ICE candidate for ${peerId}:`, candErr);
        }
      }
      this.pendingCandidates.delete(peerId);

      const answer = await pc.createAnswer();
      if (!this.currentChannelId) {
        try {
          pc.close();
        } catch {
          // Ignore
        }
        return;
      }

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

      // Drain queued ICE candidates safely
      const pending = this.pendingCandidates.get(peerId) ?? [];
      for (const cand of pending) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(cand));
        } catch (candErr) {
          console.warn(`[Echo WebRTC] Failed to add queued ICE candidate for ${peerId}:`, candErr);
        }
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
    if (!this.currentChannelId) {
      throw new Error('[Echo WebRTC] Cannot create peer connection when not in a voice channel');
    }

    let pc = this.peers.get(peerId);
    if (pc) return pc;

    this.iceServers = iceServersService.getIceServers();
    const hasTurn = this.iceServers.some((s) => {
      const urls = Array.isArray(s.urls) ? s.urls : [s.urls];
      return urls.some((u) => u.startsWith('turn:') || u.startsWith('turns:'));
    });
    console.log(`[Echo WebRTC] [CONNECTING] Peer: ${peerId} (${displayName})`);
    console.log(`[Echo WebRTC] [CONNECTING] iceServers:`, JSON.stringify(this.iceServers, null, 2));
    console.log(`[Echo WebRTC] [CONNECTING] TURN configured: ${hasTurn ? 'YES (Relay candidate available)' : 'NO - ONLY STUN! (Will fail on symmetric NAT / firewalls)'}`);

    pc = new RTCPeerConnection({
      iceServers: this.iceServers,
    });

    this.peers.set(peerId, pc);
    this.peerDisplayNames.set(peerId, displayName);

    // Add local audio track
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        console.log(`[Echo WebRTC] Attaching local audio track (${track.id}) to peer ${peerId}. Enabled: ${track.enabled}, readyState: ${track.readyState}`);
        pc!.addTrack(track, this.localStream!);
      });
    } else {
      console.warn(`[Echo WebRTC] localStream is not ready when creating PC for peer ${peerId}`);
    }

    // Add local camera video track
    if (this.localCameraStream) {
      this.localCameraStream.getVideoTracks().forEach((track) => {
        pc!.addTrack(track, this.localCameraStream!);
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

    // Remote track reception (audio or video)
    pc.ontrack = (event) => {
      console.log(`[Echo WebRTC] Received remote track (${event.track.kind}) from peer: ${peerId}, id: ${event.track.id}, enabled: ${event.track.enabled}`);
      // If we already left the channel, STOP track immediately and NEVER play audio!
      if (!this.currentChannelId) {
        if (event.track) {
          try {
            event.track.stop();
          } catch {
            // Ignore
          }
        }
        return;
      }

      if (event.track.kind === 'video') {
        const stream = event.streams[0] ?? new MediaStream([event.track]);
        useVoiceStore.getState().setPeerCameraStream(peerId, stream);
        event.track.onended = () => {
          useVoiceStore.getState().removePeerCameraStream(peerId);
        };
        return;
      }

      let audio = this.peerAudioElements.get(peerId);
      if (!audio) {
        audio = new Audio();
        audio.setAttribute('data-echo-peer', peerId);
        audio.autoplay = true;
        audio.style.display = 'none';
        document.body.appendChild(audio);
        this.peerAudioElements.set(peerId, audio);
      }
      const remoteStream = event.streams[0] ?? new MediaStream([event.track]);
      audio.srcObject = remoteStream;
      audio.volume = this.outputVolume;

      // Apply output device if set
      if (
        this.selectedOutputDeviceId &&
        typeof (audio as unknown as { setSinkId?: (id: string) => Promise<void> }).setSinkId === 'function'
      ) {
        const sinkId = this.selectedOutputDeviceId === 'default' ? '' : this.selectedOutputDeviceId;
        (audio as unknown as { setSinkId: (id: string) => Promise<void> })
          .setSinkId(sinkId)
          .catch((err: unknown) => console.warn('setSinkId error:', err));
      }

      // Apply deafen state
      const isDeafened = useVoiceStore.getState().isDeafened;
      audio.muted = isDeafened;

      void audio.play().catch((e) => console.warn('[Echo WebRTC] Audio play prevented:', e));
    };

    pc.onconnectionstatechange = () => {
      console.log(`[Echo WebRTC] Peer ${peerId} connectionState:`, pc?.connectionState);
      this.updateConnectionStatusGate();
      if (pc?.connectionState === 'failed') {
        console.warn(`[Echo WebRTC] Peer ${peerId} connection failed, attempting ICE restart...`);
        try {
          pc.restartIce();
        } catch (e) {
          console.warn(`[Echo WebRTC] restartIce failed for ${peerId}:`, e);
        }
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`[Echo WebRTC] Peer ${peerId} iceConnectionState:`, pc?.iceConnectionState);
      this.updateConnectionStatusGate();
      if (pc?.iceConnectionState === 'failed') {
        console.warn(`[Echo WebRTC] Peer ${peerId} ICE connection failed, attempting ICE restart...`);
        try {
          pc.restartIce();
        } catch (e) {
          console.warn(`[Echo WebRTC] restartIce failed for ${peerId}:`, e);
        }
      }
    };

    return pc;
  }

  updateConnectionStatusGate(): void {
    if (!this.currentChannelId) return;
    const voiceStore = useVoiceStore.getState();
    const participants = voiceStore.channelParticipants[this.currentChannelId] || [];
    const myUserId = useAuthStore.getState().identity?.userId;
    const otherParticipants = participants.filter((p) => p.userId !== myUserId);

    // If nobody else is in the room, we are safely connected once local mic stream is active
    if (otherParticipants.length === 0) {
      if (voiceStore.connectionStatus !== 'connected' && this.localStream) {
        voiceStore.setConnected(this.currentChannelId);
      }
      return;
    }

    // If other participants exist, check if at least one peer connection has successfully connected
    const anyConnected = Array.from(this.peers.values()).some(
      (pc) =>
        pc.connectionState === 'connected' ||
        pc.iceConnectionState === 'connected' ||
        pc.iceConnectionState === 'completed',
    );

    if (anyConnected) {
      if (voiceStore.connectionStatus !== 'connected') {
        console.log('[Echo WebRTC] WebRTC peer connection established! Voice connected.');
        voiceStore.setConnected(this.currentChannelId);
      }
    } else {
      // Still waiting for WebRTC ICE negotiation with peers
      if (voiceStore.connectionStatus === 'connected') {
        voiceStore.setConnecting(
          this.currentGroupId || '',
          voiceStore.currentGroupName || '',
          this.currentChannelId,
          voiceStore.currentChannelName || '',
        );
      }
    }
  }

  updateAudioTrackState(): void {
    const store = useVoiceStore.getState();
    const isMuted =
      store.audioState === UserAudioState.MUTED ||
      store.audioState === UserAudioState.DEAFENED ||
      store.isMuted ||
      store.isDeafened;
    const canTransmit = !isMuted && (store.inputMode === 'vad' || store.isPttActive);

    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((t) => {
        t.enabled = canTransmit;
      });
    }

    if (!canTransmit && (this.lastSpeakingState || store.isSpeaking)) {
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
    const myUserId = useAuthStore.getState().identity?.userId;
    const isCurrentlyMutedOrDeafened =
      store.audioState === UserAudioState.MUTED ||
      store.audioState === UserAudioState.DEAFENED ||
      store.isMuted ||
      store.isDeafened;

    const nextAudioState = isCurrentlyMutedOrDeafened
      ? UserAudioState.IDLE
      : UserAudioState.MUTED;

    store.setAudioState(nextAudioState, myUserId);
    this.updateAudioTrackState();

    if (this.currentChannelId) {
      wsService.sendVoiceState(this.currentChannelId, {
        muted: nextAudioState === UserAudioState.MUTED,
        deafened: false,
        speaking: false,
      });
    }
  }

  toggleDeafen(): void {
    const store = useVoiceStore.getState();
    const myUserId = useAuthStore.getState().identity?.userId;
    const isCurrentlyDeafened =
      store.audioState === UserAudioState.DEAFENED || store.isDeafened;

    const nextAudioState = isCurrentlyDeafened
      ? UserAudioState.IDLE
      : UserAudioState.DEAFENED;

    store.setAudioState(nextAudioState, myUserId);
    this.updateAudioTrackState();

    // Mute/unmute all remote audio elements
    const shouldMutePeers = nextAudioState === UserAudioState.DEAFENED;
    this.peerAudioElements.forEach((audio) => {
      audio.muted = shouldMutePeers;
    });

    if (this.currentChannelId) {
      wsService.sendVoiceState(this.currentChannelId, {
        muted: shouldMutePeers,
        deafened: shouldMutePeers,
        speaking: false,
      });
    }
  }

  private setupVAD(stream: MediaStream): void {
    // 1. Clean up any existing VAD interval, silence timer, and audioContext
    if (this.vadInterval) {
      clearInterval(this.vadInterval);
      this.vadInterval = null;
    }
    if (this.speakingSilenceTimer) {
      clearTimeout(this.speakingSilenceTimer);
      this.speakingSilenceTimer = null;
    }
    if (this.audioContext) {
      try {
        void this.audioContext.close();
      } catch {
        // Ignore
      }
      this.audioContext = null;
      this.analyser = null;
    }

    if (!this.currentChannelId) return;

    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioContext = new AudioCtx();
      if (this.audioContext.state === 'suspended') {
        void this.audioContext.resume();
      }
      const source = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.2;
      source.connect(this.analyser);

      const buffer = new Float32Array(this.analyser.fftSize);

      this.vadInterval = setInterval(() => {
        if (!this.analyser || !this.currentChannelId) return;

        const store = useVoiceStore.getState();
        const canTransmit =
          !store.isMuted && !store.isDeafened && (store.inputMode === 'vad' || store.isPttActive);

        this.analyser.getFloatTimeDomainData(buffer);

        // Calculate Root Mean Square (RMS)
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
          sum += buffer[i]! * buffer[i]!;
        }
        const rms = Math.sqrt(sum / buffer.length);

        // Always update live microphone audio level for the UI meter
        store.setLocalAudioLevel(canTransmit ? Math.min(1, rms * 12) : 0);

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

        const threshold = 0.008; // High-sensitivity detection for normal and quiet microphones

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
      }, 60);
    } catch (err) {
      console.warn('VAD setup failed:', err);
    }
  }

  private setLocalSpeaking(speaking: boolean): void {
    const store = useVoiceStore.getState();
    const isMutedOrDeafened =
      store.audioState === UserAudioState.MUTED ||
      store.audioState === UserAudioState.DEAFENED ||
      store.isMuted ||
      store.isDeafened;

    // Prevent speaking conflict while muted or deafened
    if (speaking && isMutedOrDeafened) {
      this.lastSpeakingState = false;
      return;
    }

    this.lastSpeakingState = speaking;
    const myUserId = useAuthStore.getState().identity?.userId;
    store.setSpeaking(speaking, myUserId);

    if (this.currentChannelId) {
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
          if (
            report.type === 'candidate-pair' &&
            (report.state === 'succeeded' || report.nominated)
          ) {
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

  private async reacquireLocalAudio(): Promise<void> {
    if (!this.currentChannelId) return;
    try {
      const audioConstraints: MediaTrackConstraints = {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      };
      if (this.selectedInputDeviceId && this.selectedInputDeviceId !== 'default') {
        audioConstraints.deviceId = { exact: this.selectedInputDeviceId };
      }

      let newStream: MediaStream;
      try {
        newStream = await navigator.mediaDevices.getUserMedia({
          audio: audioConstraints,
          video: false,
        });
      } catch {
        this.selectedInputDeviceId = null;
        newStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false,
        });
      }

      const newTrack = newStream.getAudioTracks()[0];
      if (!newTrack) return;

      // Replace audio track across all active peer connections
      for (const pc of this.peers.values()) {
        const sender = pc.getSenders().find((s) => s.track?.kind === 'audio');
        if (sender) {
          await sender.replaceTrack(newTrack);
        }
      }

      if (this.localStream) {
        this.localStream.getAudioTracks().forEach((t) => {
          try {
            t.stop();
          } catch {
            // Ignore
          }
        });
      }
      this.localStream = newStream;
      this.updateAudioTrackState();
      this.setupVAD(newStream);

      newTrack.onended = () => {
        if (this.currentChannelId) {
          void this.reacquireLocalAudio();
        }
      };
      console.log('[Echo WebRTC] Successfully re-acquired local audio stream.');
    } catch (err) {
      console.error('[Echo WebRTC] Failed to re-acquire local audio:', err);
    }
  }

  async setInputDevice(deviceId: string): Promise<void> {
    this.selectedInputDeviceId = deviceId;
    try {
      if (deviceId) {
        localStorage.setItem('echo_voice_input_device', deviceId);
      } else {
        localStorage.removeItem('echo_voice_input_device');
      }
    } catch {
      // Ignore
    }

    if (this.localStream && this.currentChannelId) {
      try {
        const audioConstraints: MediaTrackConstraints = {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        };
        if (deviceId && deviceId !== 'default') {
          audioConstraints.deviceId = { exact: deviceId };
        }

        const newStream = await navigator.mediaDevices.getUserMedia({
          audio: audioConstraints,
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
          this.localStream.getAudioTracks().forEach((t) => {
            try {
              t.stop();
            } catch {
              // Ignore
            }
          });
          this.localStream = newStream;
          this.updateAudioTrackState();
          this.setupVAD(newStream);

          newTrack.onended = () => {
            if (this.currentChannelId) {
              void this.reacquireLocalAudio();
            }
          };
        }
      } catch (err) {
        console.warn('Failed to switch input device:', err);
      }
    }
  }

  async setOutputDevice(deviceId: string): Promise<void> {
    this.selectedOutputDeviceId = deviceId;
    try {
      if (deviceId) {
        localStorage.setItem('echo_voice_output_device', deviceId);
      } else {
        localStorage.removeItem('echo_voice_output_device');
      }
    } catch {
      // Ignore
    }

    const sinkId = !deviceId || deviceId === 'default' ? '' : deviceId;

    for (const audio of this.peerAudioElements.values()) {
      if (
        typeof (audio as unknown as { setSinkId?: (id: string) => Promise<void> }).setSinkId === 'function'
      ) {
        try {
          await (audio as unknown as { setSinkId: (id: string) => Promise<void> }).setSinkId(sinkId);
        } catch (err) {
          console.warn('Failed to setSinkId on audio element:', err);
        }
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

  getLocalCameraStream(): MediaStream | null {
    return this.localCameraStream;
  }

  getVideoDeviceId(): string | null {
    return this.selectedVideoDeviceId;
  }

  async getVideoDevices(): Promise<MediaDeviceInfo[]> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter((d) => d.kind === 'videoinput');
    } catch {
      return [];
    }
  }

  async setVideoDevice(deviceId: string): Promise<void> {
    this.selectedVideoDeviceId = deviceId;
    if (this.localCameraStream && this.currentChannelId) {
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            deviceId: { exact: deviceId },
            width: { ideal: 640 },
            height: { ideal: 480 },
            frameRate: { max: 24 },
          },
        });

        const newTrack = newStream.getVideoTracks()[0];
        if (newTrack) {
          for (const pc of this.peers.values()) {
            const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
            if (sender) {
              await sender.replaceTrack(newTrack);
            }
          }
          this.localCameraStream.getVideoTracks().forEach((t) => t.stop());
          this.localCameraStream = newStream;
          useVoiceStore.getState().setPeerCameraStream('local', newStream);
          const myUserId = useAuthStore.getState().identity?.userId;
          if (myUserId) {
            useVoiceStore.getState().setPeerCameraStream(myUserId, newStream);
          }
        }
      } catch (err) {
        console.warn('Failed to switch video device:', err);
      }
    }
  }

  testCamera(videoElement: HTMLVideoElement): () => void {
    let active = true;
    let stream: MediaStream | null = null;

    void (async () => {
      try {
        const constraints: MediaStreamConstraints = {
          audio: false,
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            frameRate: { max: 24 },
            ...(this.selectedVideoDeviceId
              ? { deviceId: { exact: this.selectedVideoDeviceId } }
              : {}),
          },
        };
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        videoElement.srcObject = stream;
        void videoElement.play().catch((e) => console.warn('Test camera play error:', e));
      } catch (err) {
        console.warn('Camera test error:', err);
      }
    })();

    return () => {
      active = false;
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
      videoElement.srcObject = null;
    };
  }

  async toggleCamera(enable?: boolean): Promise<boolean> {
    const shouldEnable = enable === undefined ? !this.localCameraStream : enable;
    const voiceStore = useVoiceStore.getState();

    if (shouldEnable) {
      try {
        const constraints: MediaStreamConstraints = {
          audio: false,
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            frameRate: { max: 24 },
            ...(this.selectedVideoDeviceId
              ? { deviceId: { exact: this.selectedVideoDeviceId } }
              : {}),
          },
        };

        this.localCameraStream = await navigator.mediaDevices.getUserMedia(constraints);
        const videoTrack = this.localCameraStream.getVideoTracks()[0];
        if (!videoTrack) return false;

        voiceStore.setCameraActive(true);
        voiceStore.setPeerCameraStream('local', this.localCameraStream);
        const myUserId = useAuthStore.getState().identity?.userId;
        if (myUserId) {
          voiceStore.setPeerCameraStream(myUserId, this.localCameraStream);
        }

        // Add track to each existing peer and renegotiate
        for (const [peerId, pc] of this.peers.entries()) {
          try {
            pc.addTrack(videoTrack, this.localCameraStream);
            const displayName = this.peerDisplayNames.get(peerId) || 'Kullanıcı';
            await this.initiateOffer(peerId, displayName);
          } catch (e) {
            console.warn(`Failed to add video track or offer to peer ${peerId}:`, e);
          }
        }

        if (this.currentChannelId) {
          wsService.sendVoiceState(this.currentChannelId, {
            muted: voiceStore.isMuted,
            deafened: voiceStore.isDeafened,
            speaking: voiceStore.isSpeaking,
            camera: true,
          });
        }
        return true;
      } catch (err) {
        console.error('Failed to start camera:', err);
        return false;
      }
    } else {
      if (this.localCameraStream) {
        this.localCameraStream.getTracks().forEach((t) => t.stop());
        this.localCameraStream = null;
      }

      voiceStore.setCameraActive(false);
      voiceStore.removePeerCameraStream('local');
      const myUserId = useAuthStore.getState().identity?.userId;
      if (myUserId) {
        voiceStore.removePeerCameraStream(myUserId);
      }

      // Remove video senders and renegotiate
      for (const [peerId, pc] of this.peers.entries()) {
        try {
          const senders = pc.getSenders();
          for (const sender of senders) {
            if (sender.track?.kind === 'video') {
              pc.removeTrack(sender);
            }
          }
          const displayName = this.peerDisplayNames.get(peerId) || 'Kullanıcı';
          await this.initiateOffer(peerId, displayName);
        } catch (e) {
          console.warn(`Failed to remove video track or offer to peer ${peerId}:`, e);
        }
      }

      if (this.currentChannelId) {
        wsService.sendVoiceState(this.currentChannelId, {
          muted: voiceStore.isMuted,
          deafened: voiceStore.isDeafened,
          speaking: voiceStore.isSpeaking,
          camera: false,
        });
      }
      return false;
    }
  }
}

export const webrtcService = new WebRTCVoiceService();
