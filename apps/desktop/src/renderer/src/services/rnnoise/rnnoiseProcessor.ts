import { RnnoiseWorkletNode, loadRnnoise } from '@sapphi-red/web-noise-suppressor';
import rnnoiseWorkletSource from '@sapphi-red/web-noise-suppressor/rnnoiseWorklet.js?raw';
import rnnoiseWasmUrl from '@sapphi-red/web-noise-suppressor/rnnoise.wasm?url';
import rnnoiseSimdWasmUrl from '@sapphi-red/web-noise-suppressor/rnnoise_simd.wasm?url';

export interface RNNoiseProcessorInstance {
  sourceTrack: MediaStreamTrack;
  destinationTrack: MediaStreamTrack;
  destinationStream: MediaStream;
  audioContext: AudioContext;
  setEnabled: (enabled: boolean) => void;
  isEnabled: () => boolean;
  destroy: () => void;
}

let cachedWasmBinary: ArrayBuffer | null = null;
const cachedWorkletLoadedContexts = new WeakSet<AudioContext>();

/**
 * Loads the WebAssembly binary (with SIMD acceleration support) once
 * and caches it in memory across processor instances.
 */
async function getWasmBinary(): Promise<ArrayBuffer> {
  if (cachedWasmBinary) {
    return cachedWasmBinary;
  }
  cachedWasmBinary = await loadRnnoise({
    url: rnnoiseWasmUrl,
    simdUrl: rnnoiseSimdWasmUrl,
  });
  console.log('[Echo RNNoise] Loaded SIMD neural network WASM binary.');
  return cachedWasmBinary;
}

/**
 * Preloads the RNNoise WASM binary in the background for instant availability.
 */
export async function getRnnoise(): Promise<ArrayBuffer> {
  return getWasmBinary();
}

/**
 * Inlines the AudioWorkletProcessor script into an in-memory Blob URL
 * to avoid any Electron file:// cross-origin or path resolution restrictions.
 */
async function ensureWorkletModule(ctx: AudioContext): Promise<void> {
  if (cachedWorkletLoadedContexts.has(ctx)) {
    return;
  }

  const blob = new Blob([rnnoiseWorkletSource], { type: 'text/javascript' });
  const blobUrl = URL.createObjectURL(blob);
  try {
    await ctx.audioWorklet.addModule(blobUrl);
    cachedWorkletLoadedContexts.add(ctx);
    console.log('[Echo RNNoise] AudioWorklet module loaded into audio context.');
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

/**
 * Connects a raw MediaStreamTrack into an AudioWorklet pipeline running
 * on the dedicated real-time audio thread (isolated from UI / React thread).
 * Completely eliminates clicks, pops, and "pıt-pıt" dropouts.
 */
export async function createRNNoiseProcessor(
  rawTrack: MediaStreamTrack,
  initialEnabled = true,
): Promise<RNNoiseProcessorInstance> {
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

  // Force 48000 Hz sample rate as required by the RNNoise neural network model
  const audioContext = new AudioCtx({ sampleRate: 48000 });
  if (audioContext.state === 'suspended') {
    void audioContext.resume();
  }

  // Load WASM and register AudioWorklet module
  const [wasmBinary] = await Promise.all([
    getWasmBinary(),
    ensureWorkletModule(audioContext),
  ]);

  const inputStream = new MediaStream([rawTrack]);
  const sourceNode = audioContext.createMediaStreamSource(inputStream);
  const destinationNode = audioContext.createMediaStreamDestination();

  // Create real-time AudioWorklet processor node
  const rnnoiseNode = new RnnoiseWorkletNode(audioContext, {
    wasmBinary,
    maxChannels: 1,
  });

  // Cross-fade gain nodes for smooth, click-free live bypass toggling
  const rnnoiseGain = audioContext.createGain();
  const bypassGain = audioContext.createGain();

  rnnoiseGain.gain.setValueAtTime(initialEnabled ? 1.0 : 0.0, audioContext.currentTime);
  bypassGain.gain.setValueAtTime(initialEnabled ? 0.0 : 1.0, audioContext.currentTime);

  // Audio Graph:
  // Denoised branch: sourceNode -> rnnoiseNode -> rnnoiseGain -> destinationNode
  // Bypassed branch: sourceNode -> bypassGain -> destinationNode
  sourceNode.connect(rnnoiseNode);
  rnnoiseNode.connect(rnnoiseGain);
  rnnoiseGain.connect(destinationNode);

  sourceNode.connect(bypassGain);
  bypassGain.connect(destinationNode);

  const destinationTrack = destinationNode.stream.getAudioTracks()[0];
  if (!destinationTrack) {
    throw new Error('[Echo RNNoise] Failed to extract audio track from MediaStreamDestinationNode');
  }

  destinationTrack.enabled = rawTrack.enabled;
  let enabled = initialEnabled;
  let isDestroyed = false;

  const destroy = () => {
    if (isDestroyed) return;
    isDestroyed = true;

    try {
      sourceNode.disconnect();
      rnnoiseNode.disconnect();
      rnnoiseGain.disconnect();
      bypassGain.disconnect();
      destinationNode.disconnect();
      rnnoiseNode.destroy();
    } catch {
      // Ignore
    }

    try {
      void audioContext.close();
    } catch {
      // Ignore
    }

    console.log('[Echo RNNoise] AudioWorklet noise suppression pipeline destroyed.');
  };

  return {
    sourceTrack: rawTrack,
    destinationTrack,
    destinationStream: destinationNode.stream,
    audioContext,
    setEnabled: (val: boolean) => {
      if (enabled === val || isDestroyed) return;
      enabled = val;
      const now = audioContext.currentTime;
      if (val) {
        // Smooth 15ms crossfade to RNNoise
        bypassGain.gain.setTargetAtTime(0.0, now, 0.015);
        rnnoiseGain.gain.setTargetAtTime(1.0, now, 0.015);
      } else {
        // Smooth 15ms crossfade to bypass
        rnnoiseGain.gain.setTargetAtTime(0.0, now, 0.015);
        bypassGain.gain.setTargetAtTime(1.0, now, 0.015);
      }
      console.log(`[Echo RNNoise] Noise suppression ${enabled ? 'ENABLED' : 'DISABLED'}`);
    },
    isEnabled: () => enabled,
    destroy,
  };
}
