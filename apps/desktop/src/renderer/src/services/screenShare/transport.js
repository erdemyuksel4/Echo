import { SCREEN_QUALITY_PRESETS } from '@echo/shared';
import { wsService } from '../websocket';
import { iceServersService } from '../iceServers';
import { ScreenAudioDuckingService } from './screenAudioDuckingService';
export class MeshScreenShareTransport {
    localStream = null;
    currentQuality = '720p30';
    audioDuckingService = new ScreenAudioDuckingService();
    // Publisher side: viewerUserId -> RTCPeerConnection
    viewerPcs = new Map();
    // Viewer side: publisherUserId -> RTCPeerConnection
    watchingPcs = new Map();
    remoteStreams = new Map();
    streamResolvers = new Map();
    pendingCandidates = new Map();
    get iceServers() {
        return iceServersService.getIceServers();
    }
    async startSharing(stream, channelId, quality = '720p30') {
        try {
            await iceServersService.fetchIceServers();
        }
        catch (e) {
            console.warn('[ScreenShare] Failed to refresh ICE servers on startSharing:', e);
        }
        // Process audio track with smart voice chat ducking
        this.localStream = this.audioDuckingService.processStreamAudio(stream, channelId);
        this.currentQuality = quality;
    }
    async stopSharing() {
        this.audioDuckingService.cleanup();
        // Close all viewer peer connections
        for (const [viewerId, pc] of this.viewerPcs.entries()) {
            pc.close();
            this.viewerPcs.delete(viewerId);
        }
        this.pendingCandidates.clear();
        if (this.localStream) {
            for (const track of this.localStream.getTracks()) {
                track.stop();
            }
            this.localStream = null;
        }
    }
    getActiveViewerCount() {
        return this.viewerPcs.size;
    }
    async watchStream(targetUserId, channelId) {
        // If already watching, return existing stream
        const existing = this.remoteStreams.get(targetUserId);
        if (existing)
            return existing;
        this.stopWatching(targetUserId);
        try {
            await iceServersService.fetchIceServers();
        }
        catch (e) {
            console.warn('[ScreenShare] Failed to refresh ICE servers on watchStream:', e);
        }
        const pc = new RTCPeerConnection({ iceServers: this.iceServers });
        this.watchingPcs.set(targetUserId, pc);
        const streamPromise = new Promise((resolve) => {
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
            if (event.candidate) {
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
    stopWatching(targetUserId) {
        const pc = this.watchingPcs.get(targetUserId);
        if (pc) {
            pc.close();
            this.watchingPcs.delete(targetUserId);
        }
        this.remoteStreams.delete(targetUserId);
        this.streamResolvers.delete(targetUserId);
        this.pendingCandidates.delete(targetUserId);
    }
    async handleSignal(fromUserId, channelId, rawSignal) {
        const signal = rawSignal;
        if (!signal || !signal.type)
            return;
        switch (signal.type) {
            case 'watch-request': {
                // We are the publisher; a viewer wants our stream
                await this.handleWatchRequestFromViewer(fromUserId, channelId);
                break;
            }
            case 'watch-offer': {
                // Viewer received offer from publisher
                await this.handleOfferFromPublisher(fromUserId, channelId, signal.sdp);
                break;
            }
            case 'watch-answer': {
                // Publisher received answer from viewer
                const pc = this.viewerPcs.get(fromUserId);
                if (pc && signal.sdp) {
                    await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: signal.sdp }));
                    await this.drainPendingCandidates(fromUserId, pc);
                }
                break;
            }
            case 'watch-candidate': {
                // ICE candidate from either side
                if (signal.candidate) {
                    const pc = this.viewerPcs.get(fromUserId) || this.watchingPcs.get(fromUserId);
                    if (pc && pc.remoteDescription && pc.remoteDescription.type) {
                        try {
                            await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
                        }
                        catch (err) {
                            console.warn('[ScreenShare] Failed to add ICE candidate:', err);
                        }
                    }
                    else {
                        const list = this.pendingCandidates.get(fromUserId) ?? [];
                        list.push(signal.candidate);
                        this.pendingCandidates.set(fromUserId, list);
                    }
                }
                break;
            }
            default:
                break;
        }
    }
    async handleWatchRequestFromViewer(viewerUserId, channelId) {
        if (!this.localStream) {
            console.warn('Watch request received but no local screen stream available');
            return;
        }
        // Clean up any existing pc for this viewer
        const existingPc = this.viewerPcs.get(viewerUserId);
        if (existingPc)
            existingPc.close();
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
            if (pc.connectionState === 'disconnected' ||
                pc.connectionState === 'failed' ||
                pc.connectionState === 'closed') {
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
        }
        catch (err) {
            console.error('Failed to create screen share offer for viewer:', err);
        }
    }
    async handleOfferFromPublisher(publisherUserId, channelId, sdp) {
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
            await this.drainPendingCandidates(publisherUserId, pc);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            wsService.sendShareSignal(channelId, publisherUserId, {
                type: 'watch-answer',
                sdp: pc.localDescription?.sdp,
            });
        }
        catch (err) {
            console.error('Failed to handle screen share offer from publisher:', err);
        }
    }
    async drainPendingCandidates(userId, pc) {
        const pending = this.pendingCandidates.get(userId) ?? [];
        for (const cand of pending) {
            try {
                await pc.addIceCandidate(new RTCIceCandidate(cand));
            }
            catch (err) {
                console.warn(`[ScreenShare] Failed to drain pending ICE candidate for ${userId}:`, err);
            }
        }
        this.pendingCandidates.delete(userId);
    }
    preferHardwareCodec(pc, mimeType = 'video/H264') {
        try {
            const transceivers = pc.getTransceivers();
            for (const transceiver of transceivers) {
                if (transceiver.receiver.track.kind === 'video' ||
                    transceiver.sender.track?.kind === 'video') {
                    const capabilities = RTCRtpReceiver.getCapabilities('video');
                    if (capabilities?.codecs) {
                        const preferred = capabilities.codecs.filter((c) => c.mimeType.toLowerCase() === mimeType.toLowerCase());
                        const rest = capabilities.codecs.filter((c) => c.mimeType.toLowerCase() !== mimeType.toLowerCase());
                        transceiver.setCodecPreferences([...preferred, ...rest]);
                    }
                }
            }
        }
        catch (err) {
            console.warn('Failed to set codec preference:', err);
        }
    }
    async applyBitrateLimits(sender, maxBitrate, maxFramerate) {
        try {
            const params = sender.getParameters();
            if (!params.encodings || params.encodings.length === 0) {
                params.encodings = [{}];
            }
            params.encodings[0].maxBitrate = maxBitrate;
            params.encodings[0].maxFramerate = maxFramerate;
            await sender.setParameters(params);
        }
        catch (err) {
            console.warn('Failed to apply screen share bitrate limits:', err);
        }
    }
    destroy() {
        void this.stopSharing();
        for (const [id, pc] of this.watchingPcs.entries()) {
            pc.close();
            this.watchingPcs.delete(id);
        }
        this.remoteStreams.clear();
        this.streamResolvers.clear();
    }
}
export const screenShareTransport = new MeshScreenShareTransport();
