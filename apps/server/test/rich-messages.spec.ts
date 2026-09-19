import { describe, it, expect } from 'vitest';
import {
  MessageSchema,
  ClientMsgEditPayloadSchema,
  ClientMsgDeletePayloadSchema,
  ClientReactAddPayloadSchema,
  ClientReactRemovePayloadSchema,
  ServerReactUpdatedPayloadSchema,
  ServerMsgUpdatedPayloadSchema,
  ServerMsgDeletedPayloadSchema,
} from '@echo/shared';

describe('Faz 2 - Rich Messaging Schemas and Validation', () => {
  it('validates a message with reply, edit, and reactions', () => {
    const rawMessage = {
      id: '01HX0000000000000000000001',
      channelId: 'chan-123',
      authorId: 'usr-123',
      authorName: 'Erdem',
      content: 'Bu bir **test** mesajıdır ||gizli||',
      replyTo: '01HX0000000000000000000000',
      replyToAuthorName: 'Ahmet',
      replyToContent: 'İlk mesaj içeriği',
      createdAt: 1700000000000,
      editedAt: 1700000005000,
      deleted: false,
      reactions: {
        '👍': ['usr-123', 'usr-456'],
        '🔥': ['usr-789'],
      },
    };

    const parsed = MessageSchema.parse(rawMessage);
    expect(parsed.replyTo).toBe('01HX0000000000000000000000');
    expect(parsed.replyToAuthorName).toBe('Ahmet');
    expect(parsed.reactions['👍']?.length).toBe(2);
    expect(parsed.editedAt).toBe(1700000005000);
  });

  it('validates message edit and delete payloads', () => {
    const editPayload = {
      channelId: 'chan-1',
      messageId: 'msg-1',
      content: 'Güncellenmiş mesaj metni',
    };
    expect(ClientMsgEditPayloadSchema.parse(editPayload)).toEqual(editPayload);

    const deletePayload = {
      channelId: 'chan-1',
      messageId: 'msg-1',
    };
    expect(ClientMsgDeletePayloadSchema.parse(deletePayload)).toEqual(deletePayload);

    const serverUpdate = {
      channelId: 'chan-1',
      messageId: 'msg-1',
      content: 'Yeni metin',
      editedAt: Date.now(),
    };
    expect(ServerMsgUpdatedPayloadSchema.parse(serverUpdate)).toBeDefined();

    const serverDelete = {
      channelId: 'chan-1',
      messageId: 'msg-1',
    };
    expect(ServerMsgDeletedPayloadSchema.parse(serverDelete)).toBeDefined();
  });

  it('validates emoji reaction add and remove payloads', () => {
    const reactAdd = {
      channelId: 'chan-1',
      messageId: 'msg-1',
      emoji: '🚀',
    };
    expect(ClientReactAddPayloadSchema.parse(reactAdd)).toEqual(reactAdd);

    const reactRemove = {
      channelId: 'chan-1',
      messageId: 'msg-1',
      emoji: '🚀',
    };
    expect(ClientReactRemovePayloadSchema.parse(reactRemove)).toEqual(reactRemove);

    const serverReactUpdate = {
      channelId: 'chan-1',
      messageId: 'msg-1',
      emoji: '🚀',
      reactions: {
        '🚀': ['usr-1', 'usr-2'],
      },
    };
    expect(ServerReactUpdatedPayloadSchema.parse(serverReactUpdate)).toBeDefined();
  });
});
