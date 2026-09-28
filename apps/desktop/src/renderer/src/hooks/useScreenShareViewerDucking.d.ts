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
export declare function useScreenShareViewerDucking({ videoRef, userVolume, isMuted, isLocal, }: UseScreenShareViewerDuckingOptions): ScreenShareViewerDuckingResult;
export {};
