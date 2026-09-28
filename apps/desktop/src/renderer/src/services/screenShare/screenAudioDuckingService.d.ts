export declare class ScreenAudioDuckingService {
    private audioContext;
    private sourceNode;
    private duckingGainNode;
    private destinationNode;
    private unsubscribeVoiceStore;
    private restoreTimeout;
    private isDucked;
    /**
     * Processes the local screen capture audio track by passing it through
     * a Web Audio GainNode. When friends in the voice channel speak,
     * the screen audio is smoothly ducked to prevent loopback voice echo.
     */
    processStreamAudio(stream: MediaStream, channelId: string): MediaStream;
    private startVoiceChannelMonitoring;
    cleanup(): void;
}
