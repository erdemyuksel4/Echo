import { SCREEN_QUALITY_PRESETS, type ScreenQualityPreset } from '@echo/shared';
import { wsService } from '../websocket';
import { iceServersService } from '../iceServers';

export interface ScreenShareTransport {
  startSharing(stream: MediaStream, channelId: string, quality: ScreenQualityPreset): Promise<void>;
  stopSharing(): Promise<void>;
  watchStream(targetUserId: string, channelId: string): Promise<MediaStream>;
  stopWatching(targetUserId: string): void;
  handleSignal(fromUserId: string, channelId: string, signal: unknown): Promise<void>;
  getActiveViewerCount(): number;
  destroy(): void;
}

interface WatchSignal {
  type: 'watch-request' | 'watch-offer' | 'watch-answer' | 'watch-candidate';
  sdp?: string;
  candidate?: RTCIceCandidateInit;
}

export class MeshScreenShareTransport implements ScreenShareTransport {
  private localStream: MediaStream | null = null;
  private currentChannelId: string | null = null;
  private currentQuality: ScreenQualityPreset = '720p30';

  // Publisher side: viewerUserId -> RTCPeerConnection
  private viewerPcs: Map<string, RTCPeerConnection> = new Map();

  // Viewer side: publisherUserId -> RTCPeerConnection
  private watchingPcs: Map<string, RTCPeerConnection> = new Map();
  private remoteStreams: Map<string, MediaStream> = new Map();
  private streamResolvers: Map<string, (stream: MediaStream) => void> = new Map();

  private get iceServers(): RTCIceServer[] {
    return iceServersService.getIceServers();
  }

  async startSharing(
    stream: MediaStream,
    channelId: string,
    quality: ScreenQualityPreset = '720p30',
  ): Promise<void> {
    this.localStream = stream;
    this.currentChannelId = channelId;
    this.currentQuality = quality;
  }

  async stopSharing(): Promise<void> {
    // Close all viewer peer connections
    for (const [viewerId, pc] of this.viewerPcs.entries()) {
      pc.close();
      this.viewerPcs.delete(viewerId);
    }

    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        track.stop();
      }
      this.localStream = null;
    }

    this.currentChannelId = null;
  }

  getActiveViewerCount(): number {
    return this.viewerPcs.size;
  }

  async watchStream(targetUserId: string, channelId: string): Promise<MediaStream> {
    // If already watching, return existing stream
    const existing = this.remoteStreams.get(targetUserId);
    if (existing) return existing;

    this.stopWatching(targetUserId);

    const pc = new RTCPeerConnection({ iceServers: this.iceServers });
    this.watchingPcs.set(targetUserId, pc);

    const streamPromise = new Promise<MediaStream>((resolve) => {
      this.streamResolvers.set(targetUserId, resolve);
    });

    pc.ontrack = (event) => {
      const stream = event.streams[0] || new MediaStream([event.track]);
      this.remoteStreams.set(targetUserId, stream);
      const resolver = this.streamResolvers.get(targetUserId);
      if (resolver) {
        resolver(stream);
        this.streamResolvers.delete(targetUserId);
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && this.currentChannelId) {
        wsService.sendShareSignal(channelId, targetUserId, {
          type: 'watch-candidate',
          candidate: event.candidate.toJSON(),
        });
      }
    };

    // Tell the publisher we want to watch their stream
    wsService.sendShareSignal(channelId, targetUserId, {
      type: 'watch-request',
    });

    return streamPromise;
  }

  stopWatching(targetUserId: string): void {
    const pc = this.watchingPcs.get(targetUserId);
    if (pc) {
      pc.close();
      this.watchingPcs.delete(targetUserId);
    }
    this.remoteStreams.delete(targetUserId);
    this.streamResolvers.delete(targetUserId);
  }

  async handleSignal(fromUserId: string, channelId: string, rawSignal: unknown): Promise<void> {
    const signal = rawSignal as WatchSignal;
    if (!signal || !signal.type) return;

    switch (signal.type) {
      case 'watch-request': {
        // We are the publisher; a viewer wants our stream
        await this.handleWatchRequestFromViewer(fromUserId, channelId);
        break;
      }
      case 'watch-offer': {
        // Viewer received offer from publisher
        await this.handleOfferFromPublisher(fromUserId, channelId, signal.sdp!);
        break;
      }
      case 'watch-answer': {
        // Publisher received answer from viewer
        const pc = this.viewerPcs.get(fromUserId);
        if (pc && signal.sdp) {
          await pc.setRemoteDescription(
            new RTCSessionDescription({ type: 'answer', sdp: signal.sdp }),
          );
        }
        break;
      }
      case 'watch-candidate': {
        // ICE candidate from either side
        if (signal.candidate) {
          const pc = this.viewerPcs.get(fromUserId) || this.watchingPcs.get(fromUserId);
          if (pc && pc.remoteDescription) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
            } catch (err) {
              console.warn('Failed to add screen share ICE candidate:', err);
            }
          }
        }
        break;
      }
      default:
        break;
    }
  }

  private async handleWatchRequestFromViewer(
    viewerUserId: string,
    channelId: string,
  ): Promise<void> {
    if (!this.localStream) {
      console.warn('Watch request received but no local screen stream available');
      return;
    }

    // Clean up any existing pc for this viewer
    const existingPc = this.viewerPcs.get(viewerUserId);
    if (existingPc) existingPc.close();

    const pc = new RTCPeerConnection({ iceServers: this.iceServers });
    this.viewerPcs.set(viewerUserId, pc);

    // Add local stream tracks to PC
    const config = SCREEN_QUALITY_PRESETS[this.currentQuality];
    for (const track of this.localStream.getTracks()) {
      const sender = pc.addTrack(track, this.localStream);
      if (track.kind === 'video' && sender) {
        void this.applyBitrateLimits(sender, config.maxBitrate, config.frameRate);
      }
    }

    this.preferHardwareCodec(pc, 'video/H264');

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        wsService.sendShareSignal(channelId, viewerUserId, {
          type: 'watch-candidate',
          candidate: event.candidate.toJSON(),
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (
        pc.connectionState === 'disconnected' ||
        pc.connectionState === 'failed' ||
        pc.connectionState === 'closed'
      ) {
        pc.close();
        this.viewerPcs.delete(viewerUserId);
      }
    };

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      wsService.sendShareSignal(channelId, viewerUserId, {
        type: 'watch-offer',
        sdp: pc.localDescription?.sdp,
      });
    } catch (err) {
      console.error('Failed to create screen share offer for viewer:', err);
    }
  }

  private async handleOfferFromPublisher(
    publisherUserId: string,
    channelId: string,
    sdp: string,
  ): Promise<void> {
    let pc = this.watchingPcs.get(publisherUserId);
    if (!pc) {
      pc = new RTCPeerConnection({ iceServers: this.iceServers });
      this.watchingPcs.set(publisherUserId, pc);

      pc.ontrack = (event) => {
        const stream = event.streams[0] || new MediaStream([event.track]);
        this.remoteStreams.set(publisherUserId, stream);
        const resolver = this.streamResolvers.get(publisherUserId);
        if (resolver) {
          resolver(stream);
          this.streamResolvers.delete(publisherUserId);
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          wsService.sendShareSignal(channelId, publisherUserId, {
            type: 'watch-candidate',
            candidate: event.candidate.toJSON(),
          });
        }
      };
    }

    try {
      await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp }));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      wsService.sendShareSignal(channelId, publisherUserId, {
        type: 'watch-answer',
        sdp: pc.localDescription?.sdp,
      });
    } catch (err) {
      console.error('Failed to handle screen share offer from publisher:', err);
    }
  }

  private preferHardwareCodec(pc: RTCPeerConnection, mimeType = 'video/H264'): void {
    try {
      const transceivers = pc.getTransceivers();
      for (const transceiver of transceivers) {
        if (
          transceiver.receiver.track.kind === 'video' ||
          transceiver.sender.track?.kind === 'video'
        ) {
          const capabilities = RTCRtpReceiver.getCapabilities('video');
          if (capabilities?.codecs) {
            const preferred = capabilities.codecs.filter(
              (c) => c.mimeType.toLowerCase() === mimeType.toLowerCase(),
            );
            const rest = capabilities.codecs.filter(
              (c) => c.mimeType.toLowerCase() !== mimeType.toLowerCase(),
            );
            transceiver.setCodecPreferences([...preferred, ...rest]);
          }
        }
      }
    } catch (err) {
      console.warn('Failed to set codec preference:', err);
    }
  }

  private async applyBitrateLimits(
    sender: RTCRtpSender,
    maxBitrate: number,
    maxFramerate: number,
  ): Promise<void> {
    try {
      const params = sender.getParameters();
      if (!params.encodings || params.encodings.length === 0) {
        params.encodings = [{}];
      }
      params.encodings[0]!.maxBitrate = maxBitrate;
      params.encodings[0]!.maxFramerate = maxFramerate;
      await sender.setParameters(params);
    } catch (err) {
      console.warn('Failed to apply screen share bitrate limits:', err);
    }
  }

  destroy(): void {
    void this.stopSharing();
    for (const [id, pc] of this.watchingPcs.entries()) {
      pc.close();
      this.watchingPcs.delete(id);
    }
    this.remoteStreams.clear();
    this.streamResolvers.clear();
  }
}

export const screenShareTransport: ScreenShareTransport = new MeshScreenShareTransport();
