import { describe, it, expect } from 'vitest';
import {
  MessageSchema,
  ClientMsgSendPayloadSchema,
  ClientThreadFetchPayloadSchema,
  ServerThreadDataPayloadSchema,
  ServerMsgUpdatedPayloadSchema,
} from '@echo/shared';

describe('Faz 14 - Thread (Alt Mesaj) Schemas & Server Protocol', () => {
  it('validates a message with thread metadata', () => {
    const rawMsg = {
      id: '01HX0000000000000000000001',
      channelId: 'chan-123',
      authorId: 'usr-1',
      authorName: 'Erdem',
      content: 'Kök mesaj',
      createdAt: 1700000000000,
      threadId: null,
      threadCount: 4,
      threadLastReplyAt: 1700000050000,
    };

    const parsed = MessageSchema.parse(rawMsg);
    expect(parsed.threadCount).toBe(4);
    expect(parsed.threadLastReplyAt).toBe(1700000050000);
    expect(parsed.threadId).toBeNull();
  });

  it('validates sending a message into a thread', () => {
    const sendPayload = {
      channelId: 'chan-123',
      content: 'Alt mesaj yanıtı',
      threadId: '01HX0000000000000000000001',
    };

    const parsed = ClientMsgSendPayloadSchema.parse(sendPayload);
    expect(parsed.threadId).toBe('01HX0000000000000000000001');
    expect(parsed.content).toBe('Alt mesaj yanıtı');
  });

  it('validates thread fetch payload and server response payload', () => {
    const fetchPayload = {
      channelId: 'chan-123',
      threadId: '01HX0000000000000000000001',
      limit: 20,
    };

    const parsedFetch = ClientThreadFetchPayloadSchema.parse(fetchPayload);
    expect(parsedFetch.channelId).toBe('chan-123');
    expect(parsedFetch.threadId).toBe('01HX0000000000000000000001');

    const serverData = {
      channelId: 'chan-123',
      threadId: '01HX0000000000000000000001',
      messages: [
        {
          id: '01HX0000000000000000000002',
          channelId: 'chan-123',
          authorId: 'usr-2',
          authorName: 'Ahmet',
          content: 'İlk alt yanıt',
          createdAt: 1700000010000,
          threadId: '01HX0000000000000000000001',
        },
      ],
      hasMore: false,
    };

    const parsedServerData = ServerThreadDataPayloadSchema.parse(serverData);
    expect(parsedServerData.messages.length).toBe(1);
    expect(parsedServerData.messages[0]?.threadId).toBe('01HX0000000000000000000001');
  });

  it('validates live root message threadCount update payload', () => {
    const updatePayload = {
      channelId: 'chan-123',
      messageId: '01HX0000000000000000000001',
      threadCount: 5,
      threadLastReplyAt: 1700000080000,
    };

    const parsed = ServerMsgUpdatedPayloadSchema.parse(updatePayload);
    expect(parsed.threadCount).toBe(5);
    expect(parsed.threadLastReplyAt).toBe(1700000080000);
  });
});
