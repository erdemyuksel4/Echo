import { type ScreenQualityPreset, type ScreenShareMode } from '@echo/shared';
export interface CaptureOptions {
    sourceId: string;
    quality: ScreenQualityPreset;
    mode: ScreenShareMode;
    hasAudio: boolean;
}
export declare class ScreenCaptureService {
    captureScreen(options: CaptureOptions): Promise<MediaStream>;
}
export declare const screenCaptureService: ScreenCaptureService;
