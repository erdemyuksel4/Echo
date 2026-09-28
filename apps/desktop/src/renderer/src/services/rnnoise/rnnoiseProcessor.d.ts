export interface RNNoiseProcessorInstance {
    sourceTrack: MediaStreamTrack;
    destinationTrack: MediaStreamTrack;
    destinationStream: MediaStream;
    audioContext: AudioContext;
    setEnabled: (enabled: boolean) => void;
    isEnabled: () => boolean;
    destroy: () => void;
}
/**
 * Preloads the AI model WASM binary in the background for instant availability.
 */
export declare function getRnnoise(): Promise<ArrayBuffer>;
/**
 * Connects a raw MediaStreamTrack into an AudioWorklet pipeline running
 * on the dedicated real-time audio thread with GTCRN 2024 Deep Learning model,
 * intelligent speech gating, and transient impulse dampening.
 * Aggressively removes background noise, keyboard clatter, glass/cup clinks, and fans.
 */
export declare function createRNNoiseProcessor(rawTrack: MediaStreamTrack, initialEnabled?: boolean): Promise<RNNoiseProcessorInstance>;
