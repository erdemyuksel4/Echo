import { type ScreenQualityPreset } from '@echo/shared';
export interface ScreenShareTransport {
    startSharing(stream: MediaStream, channelId: string, quality: ScreenQualityPreset): Promise<void>;
    stopSharing(): Promise<void>;
    watchStream(targetUserId: string, channelId: string): Promise<MediaStream>;
    stopWatching(targetUserId: string): void;
    handleSignal(fromUserId: string, channelId: string, signal: unknown): Promise<void>;
    getActiveViewerCount(): number;
    destroy(): void;
}
export declare class MeshScreenShareTransport implements ScreenShareTransport {
    private localStream;
    private currentQuality;
    private audioDuckingService;
    private viewerPcs;
    private watchingPcs;
    private remoteStreams;
    private streamResolvers;
    private pendingCandidates;
    private get iceServers();
    startSharing(stream: MediaStream, channelId: string, quality?: ScreenQualityPreset): Promise<void>;
    stopSharing(): Promise<void>;
    getActiveViewerCount(): number;
    watchStream(targetUserId: string, channelId: string): Promise<MediaStream>;
    stopWatching(targetUserId: string): void;
    handleSignal(fromUserId: string, channelId: string, rawSignal: unknown): Promise<void>;
    private handleWatchRequestFromViewer;
    private handleOfferFromPublisher;
    private drainPendingCandidates;
    private preferHardwareCodec;
    private applyBitrateLimits;
    destroy(): void;
}
export declare const screenShareTransport: ScreenShareTransport;
