import { describe, it, expect } from 'vitest';
import {
  AttachmentSchema,
  AttachmentUploadRequestSchema,
  GiphySearchResponseSchema,
  MessageSchema,
  ClientMsgSendPayloadSchema,
} from '../index';

describe('Media Schemas', () => {
  it('should validate image attachment correctly', () => {
    const attachment = {
      id: 'att-123',
      name: 'screenshot.webp',
      size: 102400,
      mimeType: 'image/webp',
      url: 'http://localhost:8787/api/groups/grp1/attachments/att-123',
      type: 'image' as const,
      width: 1920,
      height: 1080,
    };

    const parsed = AttachmentSchema.safeParse(attachment);
    expect(parsed.success).toBe(true);
  });

  it('should validate GIF attachment correctly', () => {
    const gifAttachment = {
      id: 'att-gif-456',
      name: 'funny.gif',
      size: 2048000,
      mimeType: 'image/gif',
      url: 'https://media.giphy.com/media/xyz/giphy.gif',
      type: 'gif' as const,
    };

    const parsed = AttachmentSchema.safeParse(gifAttachment);
    expect(parsed.success).toBe(true);
  });

  it('should validate P2P file offer correctly', () => {
    const fileOffer = {
      id: 'att-file-789',
      name: 'archive.zip',
      size: 52428800,
      mimeType: 'application/zip',
      url: 'p2p://archive.zip',
      type: 'file' as const,
      p2pOffer: {
        fileHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        fileSize: 52428800,
        mimeType: 'application/zip',
      },
    };

    const parsed = AttachmentSchema.safeParse(fileOffer);
    expect(parsed.success).toBe(true);
  });

  it('should allow message with empty content if attachment is present', () => {
    const msg = {
      channelId: 'chan-1',
      content: '',
      attachments: [
        {
          id: 'att-1',
          name: 'image.png',
          size: 5000,
          mimeType: 'image/png',
          url: 'http://example.com/img.png',
          type: 'image' as const,
        },
      ],
    };

    const parsed = ClientMsgSendPayloadSchema.safeParse(msg);
    expect(parsed.success).toBe(true);
  });

  it('should reject message with both empty content and empty attachments', () => {
    const msg = {
      channelId: 'chan-1',
      content: '   ',
      attachments: [],
    };

    const parsed = ClientMsgSendPayloadSchema.safeParse(msg);
    expect(parsed.success).toBe(false);
  });

  it('should validate chunked upload request schema', () => {
    const uploadReq = {
      filename: 'test.webp',
      mimeType: 'image/webp',
      sizeBytes: 300000,
      totalChunks: 2,
      chunks: [
        { index: 0, dataBase64: 'AAAA' },
        { index: 1, dataBase64: 'BBBB' },
      ],
      width: 800,
      height: 600,
    };

    const parsed = AttachmentUploadRequestSchema.safeParse(uploadReq);
    expect(parsed.success).toBe(true);
  });

  it('should validate Giphy search response schema', () => {
    const giphyRes = {
      results: [
        {
          id: 'g1',
          title: 'Happy Dance',
          url: 'https://media.giphy.com/media/g1/giphy.gif',
          previewUrl: 'https://media.giphy.com/media/g1/200w.gif',
          width: 480,
          height: 270,
        },
      ],
    };

    const parsed = GiphySearchResponseSchema.safeParse(giphyRes);
    expect(parsed.success).toBe(true);
  });

  it('should validate MessageSchema with attachments', () => {
    const fullMsg = {
      id: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
      channelId: 'chan-1',
      authorId: 'user-1',
      authorName: 'Erdem',
      content: 'Bak bu resme',
      attachments: [
        {
          id: 'att-1',
          name: 'photo.webp',
          size: 1024,
          mimeType: 'image/webp',
          url: 'http://localhost:8787/att-1',
          type: 'image' as const,
        },
      ],
      createdAt: 1710000000000,
    };

    const parsed = MessageSchema.safeParse(fullMsg);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.attachments.length).toBe(1);
      expect(parsed.data.attachments[0]?.name).toBe('photo.webp');
    }
  });
});
