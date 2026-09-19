import { describe, it, expect } from 'vitest';
import {
  WsEnvelopeSchema,
  ClientMsgSendPayloadSchema,
  AuthPayloadSchema,
  WsClientEvents,
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
