import type { Attachment } from '@echo/shared';
export interface P2PTransferProgress {
    offerId: string;
    status: 'idle' | 'connecting' | 'transferring' | 'completed' | 'error';
    progress: number;
    bytesTransferred: number;
    totalBytes: number;
    error?: string;
}
type ProgressListener = (progress: P2PTransferProgress) => void;
declare class P2PFileTransferService {
    private localFiles;
    private activePeerConnections;
    private progressListeners;
    private transferStates;
    subscribe(listener: ProgressListener): () => void;
    getProgress(offerId: string): P2PTransferProgress | undefined;
    private updateProgress;
    registerFileForSharing(file: File): Promise<Attachment>;
    startDownload(targetUserId: string, offerId: string, fileHash: string, fileName: string, totalBytes: number, mimeType: string): Promise<void>;
    handleSignal(fromUserId: string, rawSignal: unknown): Promise<void>;
}
export declare const p2pFileTransferService: P2PFileTransferService;
export {};
