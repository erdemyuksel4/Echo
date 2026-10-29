import { describe, it, expect } from 'vitest';
import {
  MessageSchema,
  ClientMsgSendPayloadSchema,
  ClientThreadFetchPayloadSchema,
  ServerMsgUpdatedPayloadSchema,
} from '../index';

describe('Thread Schemas', () => {
  it('should parse message with thread properties', () => {
    const rawMsg = {
      id: 'msg-1',
      channelId: 'chan-1',
      authorId: 'user-1',
      authorName: 'Erdem',
      content: 'Ana mesaj',
      createdAt: 1000,
      threadId: null,
      threadCount: 3,
      threadLastReplyAt: 2000,
    };

    const parsed = MessageSchema.safeParse(rawMsg);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.threadCount).toBe(3);
      expect(parsed.data.threadLastReplyAt).toBe(2000);
      expect(parsed.data.threadId).toBeNull();
    }
  });

  it('should parse thread reply message with threadId', () => {
    const rawReply = {
      id: 'msg-2',
      channelId: 'chan-1',
      authorId: 'user-2',
      authorName: 'Ahmet',
      content: 'Alt mesaj yanıtı',
      createdAt: 2000,
      threadId: 'msg-1',
    };

    const parsed = MessageSchema.safeParse(rawReply);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.threadId).toBe('msg-1');
      expect(parsed.data.threadCount).toBe(0);
    }
  });

  it('should validate ClientMsgSendPayloadSchema with threadId', () => {
    const raw = {
      channelId: 'chan-1',
      content: 'Thread yanıtı',
      threadId: 'msg-1',
    };

    const parsed = ClientMsgSendPayloadSchema.safeParse(raw);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.threadId).toBe('msg-1');
    }
  });

  it('should validate ClientThreadFetchPayloadSchema', () => {
    const raw = {
      channelId: 'chan-1',
      threadId: 'msg-1',
      limit: 30,
    };

    const parsed = ClientThreadFetchPayloadSchema.safeParse(raw);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.threadId).toBe('msg-1');
      expect(parsed.data.limit).toBe(30);
    }
  });

  it('should validate ServerMsgUpdatedPayloadSchema with thread updates', () => {
    const raw = {
      channelId: 'chan-1',
      messageId: 'msg-1',
      threadCount: 5,
      threadLastReplyAt: 5000,
    };

    const parsed = ServerMsgUpdatedPayloadSchema.safeParse(raw);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.threadCount).toBe(5);
      expect(parsed.data.threadLastReplyAt).toBe(5000);
    }
  });
});
