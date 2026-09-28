/**
 * Notification sound generator using Web Audio API
 * Generates a clean two-tone chime without external audio files
 */
declare class SoundService {
    private ctx;
    private soundEnabled;
    constructor();
    isEnabled(): boolean;
    setEnabled(enabled: boolean): void;
    playNotification(): void;
}
export declare const soundService: SoundService;
export {};
