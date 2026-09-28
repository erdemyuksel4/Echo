import { GtcrnWorkletNode, loadGtcrn, RnnoiseWorkletNode, loadRnnoise, } from '@sapphi-red/web-noise-suppressor';
import gtcrnWorkletSource from '@sapphi-red/web-noise-suppressor/gtcrnWorklet.js?raw';
import gtcrnWasmUrl from '@sapphi-red/web-noise-suppressor/gtcrn.wasm?url';
import rnnoiseWorkletSource from '@sapphi-red/web-noise-suppressor/rnnoiseWorklet.js?raw';
import rnnoiseWasmUrl from '@sapphi-red/web-noise-suppressor/rnnoise.wasm?url';
import rnnoiseSimdWasmUrl from '@sapphi-red/web-noise-suppressor/rnnoise_simd.wasm?url';
let cachedGtcrnWasm = null;
let cachedRnnoiseWasm = null;
const cachedWorkletLoadedContexts = new WeakSet();
async function getGtcrnWasmBinary() {
    if (cachedGtcrnWasm) {
        return cachedGtcrnWasm;
    }
    cachedGtcrnWasm = await loadGtcrn({ url: gtcrnWasmUrl });
    console.log('[Echo AI Denoise] Loaded 2024 GTCRN neural network WASM binary.');
    return cachedGtcrnWasm;
}
async function getRnnoiseWasmBinary() {
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
export async function getRnnoise() {
    try {
        return await getGtcrnWasmBinary();
    }
    catch {
        return await getRnnoiseWasmBinary();
    }
}
const speechGateWorkletSource = `
class EchoSpeechGateProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    // Open threshold: -42 dB (~0.0079 linear amplitude)
    // Close threshold: -48 dB (~0.00398 linear amplitude)
    this.openThreshold = 0.0079;
    this.closeThreshold = 0.00398;
    // ~130 ms hold time in 128-sample blocks at 48kHz (1 block = 2.66ms -> 49 blocks)
    this.holdBlocks = 49;
    this.holdCounter = 0;
    this.currentGain = 0.0;
    this.isOpen = false;
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || !input[0] || input[0].length === 0) return true;

    const inChannel = input[0];
    const outChannel = output[0];
    const len = inChannel.length;

    // Calculate RMS energy of current 128-sample block
    let sum = 0;
    for (let i = 0; i < len; i++) {
      const sample = inChannel[i];
      sum += sample * sample;
    }
    const rms = Math.sqrt(sum / len);

    // Gate state machine with hysteresis
    if (rms >= this.openThreshold) {
      this.isOpen = true;
      this.holdCounter = this.holdBlocks;
    } else if (rms < this.closeThreshold) {
      if (this.holdCounter > 0) {
        this.holdCounter--;
      } else {
        this.isOpen = false;
      }
    }

    const targetGain = this.isOpen ? 1.0 : 0.0;
    // Fast attack (under 1ms), smooth natural release (approx 15-20ms)
    const step = this.isOpen ? 0.04 : 0.009;

    for (let i = 0; i < len; i++) {
      this.currentGain += (targetGain - this.currentGain) * step;
      if (this.currentGain < 0.0001) {
        this.currentGain = 0.0;
      }
      outChannel[i] = inChannel[i] * this.currentGain;
    }

    return true;
  }
}
registerProcessor('echo-speech-gate', EchoSpeechGateProcessor);
`;
/**
 * Registers GTCRN (2024), RNNoise, and Echo Speech Gate worklet processors into the AudioContext
 * using in-memory Blob URLs to avoid Electron file:// cross-origin issues.
 */
async function ensureWorkletModule(ctx) {
    if (cachedWorkletLoadedContexts.has(ctx)) {
        return;
    }
    const gtcrnBlob = new Blob([gtcrnWorkletSource], { type: 'text/javascript' });
    const gtcrnBlobUrl = URL.createObjectURL(gtcrnBlob);
    const rnnoiseBlob = new Blob([rnnoiseWorkletSource], { type: 'text/javascript' });
    const rnnoiseBlobUrl = URL.createObjectURL(rnnoiseBlob);
    const speechGateBlob = new Blob([speechGateWorkletSource], { type: 'text/javascript' });
    const speechGateBlobUrl = URL.createObjectURL(speechGateBlob);
    try {
        await Promise.all([
            ctx.audioWorklet.addModule(gtcrnBlobUrl).catch((err) => {
                console.warn('[Echo AI Denoise] GTCRN worklet load warning:', err);
            }),
            ctx.audioWorklet.addModule(rnnoiseBlobUrl).catch((err) => {
                console.warn('[Echo AI Denoise] RNNoise worklet load warning:', err);
            }),
            ctx.audioWorklet.addModule(speechGateBlobUrl).catch((err) => {
                console.warn('[Echo AI Denoise] Speech gate worklet load warning:', err);
            }),
        ]);
        cachedWorkletLoadedContexts.add(ctx);
        console.log('[Echo AI Denoise] AudioWorklet modules registered.');
    }
    finally {
        URL.revokeObjectURL(gtcrnBlobUrl);
        URL.revokeObjectURL(rnnoiseBlobUrl);
        URL.revokeObjectURL(speechGateBlobUrl);
    }
}
/**
 * Connects a raw MediaStreamTrack into an AudioWorklet pipeline running
 * on the dedicated real-time audio thread with GTCRN 2024 Deep Learning model,
 * intelligent speech gating, and transient impulse dampening.
 * Aggressively removes background noise, keyboard clatter, glass/cup clinks, and fans.
 */
export async function createRNNoiseProcessor(rawTrack, initialEnabled = true) {
    const AudioCtx = window.AudioContext ||
        window.webkitAudioContext;
    // Force 48000 Hz sample rate as required by the neural network models
    const audioContext = new AudioCtx({ sampleRate: 48000 });
    if (audioContext.state === 'suspended') {
        void audioContext.resume();
    }
    await ensureWorkletModule(audioContext);
    const inputStream = new MediaStream([rawTrack]);
    const sourceNode = audioContext.createMediaStreamSource(inputStream);
    const destinationNode = audioContext.createMediaStreamDestination();
    // 1. High-Pass Filter (85 Hz, Q 0.707): Eliminates desk thumps from cups, table bumps & low rumble
    const highpass = audioContext.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.setValueAtTime(85, audioContext.currentTime);
    highpass.Q.setValueAtTime(0.707, audioContext.currentTime);
    // 2. Core Neural Denoise (GTCRN 2024 Deep Learning, fallback to RNNoise SIMD)
    let denoiseNode;
    try {
        const wasmBinary = await getGtcrnWasmBinary();
        denoiseNode = new GtcrnWorkletNode(audioContext, {
            wasmBinary,
            maxChannels: 1,
        });
        console.log('[Echo AI Denoise] Using 2024 GTCRN Deep Learning speech enhancement.');
    }
    catch (gtcrnErr) {
        console.warn('[Echo AI Denoise] GTCRN initialization failed, falling back to RNNoise SIMD:', gtcrnErr);
        const wasmBinary = await getRnnoiseWasmBinary();
        denoiseNode = new RnnoiseWorkletNode(audioContext, {
            wasmBinary,
            maxChannels: 1,
        });
    }
    // 3. Transient Dampener (8000 Hz Low-Pass): Rolls off piercing high-frequency glass/ceramic chime
    const transientDampener = audioContext.createBiquadFilter();
    transientDampener.type = 'lowpass';
    transientDampener.frequency.setValueAtTime(8000, audioContext.currentTime);
    transientDampener.Q.setValueAtTime(0.707, audioContext.currentTime);
    // 4. Fast-Attack Transient Limiter / Compressor: Clamps sudden cup clinks & loud keystrokes instantly
    const transientLimiter = audioContext.createDynamicsCompressor();
    transientLimiter.threshold.setValueAtTime(-18, audioContext.currentTime);
    transientLimiter.knee.setValueAtTime(6, audioContext.currentTime);
    transientLimiter.ratio.setValueAtTime(14, audioContext.currentTime);
    transientLimiter.attack.setValueAtTime(0.002, audioContext.currentTime); // 2ms fast attack
    transientLimiter.release.setValueAtTime(0.08, audioContext.currentTime); // 80ms release
    // 5. Intelligent Speech Gate: Completely cuts output to 0.0 in pauses between words/sentences
    const speechGateNode = new AudioWorkletNode(audioContext, 'echo-speech-gate');
    // Cross-fade gain nodes for smooth, click-free live bypass toggling
    const denoiseGain = audioContext.createGain();
    const bypassGain = audioContext.createGain();
    denoiseGain.gain.setValueAtTime(initialEnabled ? 1.0 : 0.0, audioContext.currentTime);
    bypassGain.gain.setValueAtTime(initialEnabled ? 0.0 : 1.0, audioContext.currentTime);
    // Audio Graph:
    // Denoised branch: sourceNode -> highpass -> denoiseNode -> transientDampener -> transientLimiter -> speechGateNode -> denoiseGain -> destinationNode
    // Bypassed branch: sourceNode -> bypassGain -> destinationNode
    sourceNode.connect(highpass);
    highpass.connect(denoiseNode);
    denoiseNode.connect(transientDampener);
    transientDampener.connect(transientLimiter);
    transientLimiter.connect(speechGateNode);
    speechGateNode.connect(denoiseGain);
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
        if (isDestroyed)
            return;
        isDestroyed = true;
        try {
            sourceNode.disconnect();
            highpass.disconnect();
            denoiseNode.disconnect();
            transientDampener.disconnect();
            transientLimiter.disconnect();
            speechGateNode.disconnect();
            denoiseGain.disconnect();
            bypassGain.disconnect();
            destinationNode.disconnect();
            if ('destroy' in denoiseNode && typeof denoiseNode.destroy === 'function') {
                denoiseNode.destroy();
            }
        }
        catch {
            // Ignore
        }
        try {
            void audioContext.close();
        }
        catch {
            // Ignore
        }
        console.log('[Echo AI Denoise] AudioWorklet noise suppression pipeline destroyed.');
    };
    return {
        sourceTrack: rawTrack,
        destinationTrack,
        destinationStream: destinationNode.stream,
        audioContext,
        setEnabled: (val) => {
            if (enabled === val || isDestroyed)
                return;
            enabled = val;
            const now = audioContext.currentTime;
            if (val) {
                // Smooth 15ms crossfade to AI denoise
                bypassGain.gain.setTargetAtTime(0.0, now, 0.015);
                denoiseGain.gain.setTargetAtTime(1.0, now, 0.015);
            }
            else {
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
