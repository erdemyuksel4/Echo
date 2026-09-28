declare class DmWebSocketService {
    private ws;
    private reconnectTimeout;
    private pingInterval;
    private reconnectAttempt;
    private isIntentionallyClosed;
    connect(): void;
    private initSocket;
    private handleEvent;
    refreshThreads(): Promise<void>;
    sendDm(toUserId: string, content: string): void;
    fetchHistory(peerId: string, before?: string, limit?: number): void;
    markRead(peerId: string, lastReadId: string): void;
    private send;
    private scheduleReconnect;
    private cleanupSocket;
    disconnect(): void;
}
export declare const dmWebSocketService: DmWebSocketService;
export {};
