import { describe, it, expect } from 'vitest';
import {
  WsEnvelopeSchema,
  ClientMsgSendPayloadSchema,
  ClientHistoryFetchPayloadSchema,
  AuthPayloadSchema,
  WsClientEvents,
  generateKeyPair,
  signMessage,
  buildAuthPayload,
  deriveUserId,
} from '../index';

describe('Protocol Schemas', () => {
  it('should validate standard WsEnvelope', () => {
    const raw = {
      v: 1,
      t: WsClientEvents.MSG_SEND,
      id: 'nonce-123',
      d: {
        channelId: 'chan-1',
        content: 'Merhaba Echo!',
      },
    };

    const parsed = WsEnvelopeSchema.safeParse(raw);
    expect(parsed.success).toBe(true);

    if (parsed.success) {
      const msgParsed = ClientMsgSendPayloadSchema.safeParse(parsed.data.d);
      expect(msgParsed.success).toBe(true);
    }
  });

  it('should validate valid auth payload', () => {
    const keypair = generateKeyPair();
    const ts = Date.now();
    const userId = deriveUserId(keypair.publicKeyHex);
    const payload = buildAuthPayload('group-1', ts);
    const sig = signMessage(payload, keypair.privateKey);

    const validAuth = {
      userId,
      pubkey: keypair.publicKeyHex,
      ts,
      sig,
    };

    const parsed = AuthPayloadSchema.safeParse(validAuth);
    expect(parsed.success).toBe(true);
  });

  it('should validate ClientHistoryFetchPayloadSchema', () => {
    const validFetch = {
      channelId: 'chan-456',
      limit: 50,
    };
    const parsed = ClientHistoryFetchPayloadSchema.safeParse(validFetch);
    expect(parsed.success).toBe(true);
  });

  it('should reject invalid auth payload format', () => {
    const invalidAuth = {
      userId: 'short',
      pubkey: 'invalid_hex',
      ts: -1,
      sig: 'short_sig',
    };

    const parsed = AuthPayloadSchema.safeParse(invalidAuth);
    expect(parsed.success).toBe(false);
  });
});
