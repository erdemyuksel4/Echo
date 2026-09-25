import {
  GtcrnWorkletNode,
  loadGtcrn,
  RnnoiseWorkletNode,
  loadRnnoise,
} from '@sapphi-red/web-noise-suppressor';
import gtcrnWorkletSource from '@sapphi-red/web-noise-suppressor/gtcrnWorklet.js?raw';
import gtcrnWasmUrl from '@sapphi-red/web-noise-suppressor/gtcrn.wasm?url';
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

let cachedGtcrnWasm: ArrayBuffer | null = null;
let cachedRnnoiseWasm: ArrayBuffer | null = null;
const cachedWorkletLoadedContexts = new WeakSet<AudioContext>();

async function getGtcrnWasmBinary(): Promise<ArrayBuffer> {
  if (cachedGtcrnWasm) {
    return cachedGtcrnWasm;
  }
  cachedGtcrnWasm = await loadGtcrn({ url: gtcrnWasmUrl });
  console.log('[Echo AI Denoise] Loaded 2024 GTCRN neural network WASM binary.');
  return cachedGtcrnWasm;
}

async function getRnnoiseWasmBinary(): Promise<ArrayBuffer> {
  if (cachedRnnoiseWasm) {
    return cachedRnnoiseWasm;
  }
  cachedRnnoiseWasm = await loadRnnoise({
    url: rnnoiseWasmUrl,
    simdUrl: rnnoiseSimdWasmUrl,
  });
  console.log('[Echo AI Denoise] Loaded SIMD RNNoise neural network WASM binary.');
  return cachedRnnoiseWasm;
}

/**
 * Preloads the AI model WASM binary in the background for instant availability.
 */
export async function getRnnoise(): Promise<ArrayBuffer> {
  try {
    return await getGtcrnWasmBinary();
  } catch {
    return await getRnnoiseWasmBinary();
  }
}

/**
 * Registers both GTCRN (2024) and RNNoise worklet processors into the AudioContext
 * using in-memory Blob URLs to avoid Electron file:// cross-origin issues.
 */
async function ensureWorkletModule(ctx: AudioContext): Promise<void> {
  if (cachedWorkletLoadedContexts.has(ctx)) {
    return;
  }

  const gtcrnBlob = new Blob([gtcrnWorkletSource], { type: 'text/javascript' });
  const gtcrnBlobUrl = URL.createObjectURL(gtcrnBlob);

  const rnnoiseBlob = new Blob([rnnoiseWorkletSource], { type: 'text/javascript' });
  const rnnoiseBlobUrl = URL.createObjectURL(rnnoiseBlob);

  try {
    await Promise.all([
      ctx.audioWorklet.addModule(gtcrnBlobUrl).catch((err: unknown) => {
        console.warn('[Echo AI Denoise] GTCRN worklet load warning:', err);
      }),
      ctx.audioWorklet.addModule(rnnoiseBlobUrl).catch((err: unknown) => {
        console.warn('[Echo AI Denoise] RNNoise worklet load warning:', err);
      }),
    ]);
    cachedWorkletLoadedContexts.add(ctx);
    console.log('[Echo AI Denoise] AudioWorklet modules registered.');
  } finally {
    URL.revokeObjectURL(gtcrnBlobUrl);
    URL.revokeObjectURL(rnnoiseBlobUrl);
  }
}

/**
 * Connects a raw MediaStreamTrack into an AudioWorklet pipeline running
 * on the dedicated real-time audio thread with GTCRN 2024 Deep Learning model.
 * Aggressively removes background noise, keyboard clatter, and fans with zero stutter.
 */
export async function createRNNoiseProcessor(
  rawTrack: MediaStreamTrack,
  initialEnabled = true,
): Promise<RNNoiseProcessorInstance> {
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

  // Force 48000 Hz sample rate as required by the neural network models
  const audioContext = new AudioCtx({ sampleRate: 48000 });
  if (audioContext.state === 'suspended') {
    void audioContext.resume();
  }

  await ensureWorkletModule(audioContext);

  const inputStream = new MediaStream([rawTrack]);
  const sourceNode = audioContext.createMediaStreamSource(inputStream);
  const destinationNode = audioContext.createMediaStreamDestination();

  // Prefer 2024 GTCRN Deep Learning model for superior noise suppression;
  // gracefully fall back to SIMD RNNoise if GTCRN cannot instantiate.
  let denoiseNode: AudioNode;
  try {
    const wasmBinary = await getGtcrnWasmBinary();
    denoiseNode = new GtcrnWorkletNode(audioContext, {
      wasmBinary,
      maxChannels: 1,
    });
    console.log('[Echo AI Denoise] Using 2024 GTCRN Deep Learning speech enhancement.');
  } catch (gtcrnErr) {
    console.warn('[Echo AI Denoise] GTCRN initialization failed, falling back to RNNoise SIMD:', gtcrnErr);
    const wasmBinary = await getRnnoiseWasmBinary();
    denoiseNode = new RnnoiseWorkletNode(audioContext, {
      wasmBinary,
      maxChannels: 1,
    });
  }

  // Cross-fade gain nodes for smooth, click-free live bypass toggling
  const denoiseGain = audioContext.createGain();
  const bypassGain = audioContext.createGain();

  denoiseGain.gain.setValueAtTime(initialEnabled ? 1.0 : 0.0, audioContext.currentTime);
  bypassGain.gain.setValueAtTime(initialEnabled ? 0.0 : 1.0, audioContext.currentTime);

  // Audio Graph:
  // Denoised branch: sourceNode -> denoiseNode -> denoiseGain -> destinationNode
  // Bypassed branch: sourceNode -> bypassGain -> destinationNode
  sourceNode.connect(denoiseNode);
  denoiseNode.connect(denoiseGain);
  denoiseGain.connect(destinationNode);

  sourceNode.connect(bypassGain);
  bypassGain.connect(destinationNode);

  const destinationTrack = destinationNode.stream.getAudioTracks()[0];
  if (!destinationTrack) {
    throw new Error('[Echo AI Denoise] Failed to extract audio track from MediaStreamDestinationNode');
  }

  destinationTrack.enabled = rawTrack.enabled;
  let enabled = initialEnabled;
  let isDestroyed = false;

  const destroy = () => {
    if (isDestroyed) return;
    isDestroyed = true;

    try {
      sourceNode.disconnect();
      denoiseNode.disconnect();
      denoiseGain.disconnect();
      bypassGain.disconnect();
      destinationNode.disconnect();
      if ('destroy' in denoiseNode && typeof (denoiseNode as { destroy: () => void }).destroy === 'function') {
        (denoiseNode as { destroy: () => void }).destroy();
      }
    } catch {
      // Ignore
    }

    try {
      void audioContext.close();
    } catch {
      // Ignore
    }

    console.log('[Echo AI Denoise] AudioWorklet noise suppression pipeline destroyed.');
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
        // Smooth 15ms crossfade to AI denoise
        bypassGain.gain.setTargetAtTime(0.0, now, 0.015);
        denoiseGain.gain.setTargetAtTime(1.0, now, 0.015);
      } else {
        // Smooth 15ms crossfade to bypass
        denoiseGain.gain.setTargetAtTime(0.0, now, 0.015);
        bypassGain.gain.setTargetAtTime(1.0, now, 0.015);
      }
      console.log(`[Echo AI Denoise] Noise suppression ${enabled ? 'ENABLED' : 'DISABLED'}`);
    },
    isEnabled: () => enabled,
    destroy,
  };
}
