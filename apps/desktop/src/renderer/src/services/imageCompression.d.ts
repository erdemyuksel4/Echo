import type { Attachment } from '@echo/shared';
export interface CompressedImagePayload {
    filename: string;
    mimeType: string;
    sizeBytes: number;
    totalChunks: number;
    chunks: Array<{
        index: number;
        dataBase64: string;
    }>;
    width?: number;
    height?: number;
}
export declare function processImageForUpload(file: File): Promise<CompressedImagePayload>;
export declare function uploadImageAttachment(groupId: string, file: File): Promise<Attachment>;
