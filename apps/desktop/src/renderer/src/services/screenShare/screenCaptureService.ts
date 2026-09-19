import {
  SCREEN_QUALITY_PRESETS,
  type ScreenQualityPreset,
  type ScreenShareMode,
} from '@echo/shared';

export interface CaptureOptions {
  sourceId: string;
  quality: ScreenQualityPreset;
  mode: ScreenShareMode;
  hasAudio: boolean;
}

export class ScreenCaptureService {
  async captureScreen(options: CaptureOptions): Promise<MediaStream> {
    const config = SCREEN_QUALITY_PRESETS[options.quality];

    const constraints = {
      audio: options.hasAudio
        ? {
            mandatory: {
              chromeMediaSource: 'desktop',
            },
          }
        : false,
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: options.sourceId,
          maxFrameRate: config.frameRate,
          maxWidth: config.width,
          maxHeight: config.height,
        },
      },
    } as unknown as MediaStreamConstraints;

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        // Set motion or detail hint
        videoTrack.contentHint = options.mode;
      }
      return stream;
    } catch (err) {
      // If audio capture failed, retry without audio
      if (options.hasAudio) {
        console.warn('Screen audio capture failed, retrying without audio:', err);
        return this.captureScreen({ ...options, hasAudio: false });
      }
      throw err;
    }
  }
}

export const screenCaptureService = new ScreenCaptureService();
