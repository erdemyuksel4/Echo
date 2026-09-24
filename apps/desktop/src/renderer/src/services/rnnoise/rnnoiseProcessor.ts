import { Rnnoise, type DenoiseState } from '@shiguredo/rnnoise-wasm';

const RNNOISE_FRAME_SIZE = 480; // 10ms of audio at 48kHz
const BUFFER_SIZE = 1024; // 21.3ms WebAudio quantum to prevent thread starvation and crackling

let rnnoiseSingleton: Rnnoise | null = null;
let rnnoiseInitPromise: Promise<Rnnoise> | null = null;

/**
 * Initializes and caches the RNNoise WASM module instance.
 * Thread-safe and loads only once during the app lifecycle.
 */
export async function getRnnoise(): Promise<Rnnoise> {
  if (rnnoiseSingleton) {
    return rnnoiseSingleton;
  }
  if (!rnnoiseInitPromise) {
    rnnoiseInitPromise = Rnnoise.load()
      .then((instance) => {
        rnnoiseSingleton = instance;
        console.log('[Echo RNNoise] Neural network WASM engine loaded successfully. Frame size:', instance.frameSize);
        return instance;
      })
      .catch((err) => {
        rnnoiseInitPromise = null;
        console.error('[Echo RNNoise] Failed to load RNNoise WASM module:', err);
        throw err;
      });
  }
  return rnnoiseInitPromise;
}

/**
 * Allocation-free ring buffer for streaming audio samples
 * between WebAudio quantum (1024 samples) and RNNoise frames (480 samples).
 */
class AudioRingQueue {
  private buffer: Float32Array;
  private writePos = 0;
  private readPos = 0;
  private available = 0;

  constructor(capacity = 16384) {
    this.buffer = new Float32Array(capacity);
  }

  write(samples: Float32Array): void {
    const len = samples.length;
    for (let i = 0; i < len; i++) {
      this.buffer[this.writePos] = samples[i]!;
      this.writePos = (this.writePos + 1) % this.buffer.length;
    }
    this.available += len;
    if (this.available > this.buffer.length) {
      this.available = this.buffer.length;
      this.readPos = this.writePos; // overflow protection
    }
  }

  read(out: Float32Array): number {
    const len = Math.min(out.length, this.available);
    for (let i = 0; i < len; i++) {
      out[i] = this.buffer[this.readPos]!;
      this.readPos = (this.readPos + 1) % this.buffer.length;
    }
    this.available -= len;
    return len;
  }

  length(): number {
    return this.available;
  }

  reset(): void {
    this.writePos = 0;
    this.readPos = 0;
    this.available = 0;
    this.buffer.fill(0);
  }
}

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
 * Connects a raw MediaStreamTrack into an AudioContext pipeline, passes frames
 * through RNNoise recurrent neural network (48kHz -> 480 chunk), and returns
 * a crystal-clear, denoised MediaStreamTrack with zero crackling.
 */
export async function createRNNoiseProcessor(
  rawTrack: MediaStreamTrack,
  initialEnabled = true,
): Promise<RNNoiseProcessorInstance> {
  const rnnoise = await getRnnoise();
  const denoiseState: DenoiseState = rnnoise.createDenoiseState();

  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

  // Force 48000 Hz sample rate as required by the RNNoise neural network model
  const audioContext = new AudioCtx({ sampleRate: 48000 });
  if (audioContext.state === 'suspended') {
    void audioContext.resume();
  }

  const inputStream = new MediaStream([rawTrack]);
  const sourceNode = audioContext.createMediaStreamSource(inputStream);
  const processorNode = audioContext.createScriptProcessor(BUFFER_SIZE, 1, 1);
  const destinationNode = audioContext.createMediaStreamDestination();

  const inputQueue = new AudioRingQueue(16384);
  const outputQueue = new AudioRingQueue(16384);

  // Prime output buffer with 1024 samples (21.3ms) of silence so reads NEVER underflow
  const priming = new Float32Array(1024);
  outputQueue.write(priming);

  const frameChunk = new Float32Array(RNNOISE_FRAME_SIZE);
  let enabled = initialEnabled;
  let isDestroyed = false;
  let smoothGain = 1.0;

  processorNode.onaudioprocess = (event: AudioProcessingEvent) => {
    if (isDestroyed) return;

    const inputData = event.inputBuffer.getChannelData(0);
    const outputData = event.outputBuffer.getChannelData(0);

    // If disabled, directly bypass RNNoise and output raw microphone audio
    if (!enabled) {
      outputData.set(inputData);
      return;
    }

    // 1. Queue incoming WebAudio samples (1024 samples)
    inputQueue.write(inputData);

    // 2. Process all complete 480-sample frames through the RNNoise neural net
    while (inputQueue.length() >= RNNOISE_FRAME_SIZE) {
      inputQueue.read(frameChunk);

      // Scale [-1.0, 1.0] float to 16-bit PCM range [-32768.0, 32767.0]
      for (let i = 0; i < RNNOISE_FRAME_SIZE; i++) {
        frameChunk[i] = frameChunk[i]! * 32768;
      }

      // Run deep learning inference (returns voice activity probability [0.0 - 1.0])
      const vadProb = denoiseState.processFrame(frameChunk);

      // Target gain: If no speech (VAD < 0.05), attenuate to zero. If speaking, full volume.
      const targetGain = vadProb < 0.05 ? 0.0 : vadProb < 0.15 ? (vadProb - 0.05) / 0.1 : 1.0;

      // Smooth exponential envelope transition per sample — completely eliminates clicks and crackling!
      for (let i = 0; i < RNNOISE_FRAME_SIZE; i++) {
        smoothGain += (targetGain - smoothGain) * 0.02;
        frameChunk[i] = (frameChunk[i]! / 32768) * smoothGain;
      }

      outputQueue.write(frameChunk);
    }

    // 3. Read processed samples into output buffer
    const readCount = outputQueue.read(outputData);
    if (readCount < outputData.length) {
      // Fade out gracefully to zero instead of abrupt zero-fill
      let lastVal = readCount > 0 ? outputData[readCount - 1]! : 0;
      for (let i = readCount; i < outputData.length; i++) {
        lastVal *= 0.95;
        outputData[i] = lastVal;
      }
    }
  };

  // Wire up audio graph
  sourceNode.connect(processorNode);
  processorNode.connect(destinationNode);

  // Keep AudioContext clock pumping and protect processorNode from V8 garbage collection
  const silentGain = audioContext.createGain();
  silentGain.gain.value = 0;
  processorNode.connect(silentGain);
  silentGain.connect(audioContext.destination);
  (audioContext as unknown as { _keepAliveProcessor?: ScriptProcessorNode })._keepAliveProcessor = processorNode;

  const destinationTrack = destinationNode.stream.getAudioTracks()[0];
  if (!destinationTrack) {
    throw new Error('[Echo RNNoise] Failed to extract audio track from MediaStreamDestinationNode');
  }

  // Preserve initial enabled / mute state
  destinationTrack.enabled = rawTrack.enabled;

  const destroy = () => {
    if (isDestroyed) return;
    isDestroyed = true;

    try {
      processorNode.onaudioprocess = null;
      sourceNode.disconnect();
      processorNode.disconnect();
      silentGain.disconnect();
      destinationNode.disconnect();
    } catch {
      // Ignore
    }

    try {
      denoiseState.destroy();
    } catch (e) {
      console.warn('[Echo RNNoise] Error destroying denoise state:', e);
    }

    try {
      void audioContext.close();
    } catch {
      // Ignore
    }

    console.log('[Echo RNNoise] RNNoise processor pipeline destroyed and cleaned up.');
  };

  return {
    sourceTrack: rawTrack,
    destinationTrack,
    destinationStream: destinationNode.stream,
    audioContext,
    setEnabled: (val: boolean) => {
      enabled = val;
      if (!val) {
        // Reset queues when disabling so stale buffers are cleared
        inputQueue.reset();
        outputQueue.reset();
        outputQueue.write(priming);
      }
      console.log(`[Echo RNNoise] Noise suppression ${enabled ? 'ENABLED' : 'DISABLED'}`);
    },
    isEnabled: () => enabled,
    destroy,
  };
}
