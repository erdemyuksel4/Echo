import { BaseBot } from './BaseBot';
import { wsService } from '../websocket';
import { iceServersService } from '../iceServers';
import type { VoiceSignalData } from '@echo/shared';

export abstract class VoiceBot extends BaseBot {
  protected activeChannelId: string | null = null;
  protected botPeerConnections: Map<string, RTCPeerConnection> = new Map();
  protected outgoingAudioTrack: MediaStreamTrack | null = null;
  protected isHostActive = false;

  public get channelId(): string | null {
    return this.activeChannelId;
  }

  public get isJoined(): boolean {
    return this.activeChannelId !== null;
  }

  public setHostStatus(isHost: boolean): void {
    this.isHostActive = isHost;
    if (!isHost) {
      this.closeAllBotPeers();
    }
  }

  public setAudioTrack(track: MediaStreamTrack | null): void {
    this.outgoingAudioTrack = track;
    if (this.isHostActive) {
      for (const pc of this.botPeerConnections.values()) {
        const senders = pc.getSenders();
        const audioSender = senders.find((s) => s.track?.kind === 'audio' || !s.track);
        if (audioSender && track) {
          void audioSender.replaceTrack(track);
        } else if (!audioSender && track) {
          pc.addTrack(track, new MediaStream([track]));
        }
      }
    }
  }

  public handleIncomingSignal(fromUserId: string, signal: VoiceSignalData): void {
    if (!this.isHostActive || !this.activeChannelId) return;

    let pc = this.botPeerConnections.get(fromUserId);
    if (!pc) {
      pc = this.createBotPeerConnection(fromUserId);
      this.botPeerConnections.set(fromUserId, pc);
    }

    if (signal.type === 'offer') {
      void (async () => {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: signal.sdp }));
          if (this.outgoingAudioTrack) {
            const senders = pc.getSenders();
            if (!senders.some((s) => s.track === this.outgoingAudioTrack)) {
              pc.addTrack(this.outgoingAudioTrack, new MediaStream([this.outgoingAudioTrack]));
            }
          }
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          if (this.activeChannelId && answer.sdp) {
            wsService.sendVoiceSignal(
              this.activeChannelId,
              fromUserId,
              { type: 'answer', sdp: answer.sdp },
              this.id,
            );
          }
        } catch (err) {
          console.warn(`[VoiceBot ${this.id}] Error handling offer from ${fromUserId}:`, err);
        }
      })();
    } else if (signal.type === 'answer') {
      void pc
        .setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: signal.sdp }))
        .catch((err) => console.warn(`[VoiceBot ${this.id}] Error setting remote answer:`, err));
    } else if (signal.type === 'candidate' && signal.candidate) {
      void pc
        .addIceCandidate(
          new RTCIceCandidate({
            candidate: signal.candidate,
            sdpMid: signal.sdpMid,
            sdpMLineIndex: signal.sdpMLineIndex,
          }),
        )
        .catch((err) => console.warn(`[VoiceBot ${this.id}] Error adding ICE candidate:`, err));
    }
  }

  protected createBotPeerConnection(targetUserId: string): RTCPeerConnection {
    const iceServers = iceServersService.getIceServers();
    const pc = new RTCPeerConnection({ iceServers });

    if (this.outgoingAudioTrack) {
      pc.addTrack(this.outgoingAudioTrack, new MediaStream([this.outgoingAudioTrack]));
    }

    pc.onicecandidate = (event) => {
      if (event.candidate && event.candidate.candidate && this.activeChannelId) {
        wsService.sendVoiceSignal(
          this.activeChannelId,
          targetUserId,
          {
            type: 'candidate',
            candidate: event.candidate.candidate,
            sdpMid: event.candidate.sdpMid,
            sdpMLineIndex: event.candidate.sdpMLineIndex,
          },
          this.id,
        );
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        this.botPeerConnections.delete(targetUserId);
      }
    };

    return pc;
  }

  protected closeAllBotPeers(): void {
    for (const pc of this.botPeerConnections.values()) {
      try {
        pc.close();
      } catch {
        // Ignore
      }
    }
    this.botPeerConnections.clear();
  }

  public joinVoice(channelId: string): void {
    this.activeChannelId = channelId;
  }

  public leaveVoice(): void {
    this.closeAllBotPeers();
    this.activeChannelId = null;
  }

  public override destroy(): void {
    this.leaveVoice();
    this.outgoingAudioTrack = null;
  }
}
