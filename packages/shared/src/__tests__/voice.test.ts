import { describe, it, expect } from 'vitest';
import {
  ClientVoiceJoinPayloadSchema,
  ClientVoiceLeavePayloadSchema,
  ClientVoiceSignalPayloadSchema,
  ClientVoiceStatePayloadSchema,
  ServerVoiceUserJoinedPayloadSchema,
  ServerVoiceParticipantsPayloadSchema,
  WsEnvelopeSchema,
  WsClientEvents,
  WsServerEvents,
} from '../index';

describe('Voice Schemas & Protocol', () => {
  it('should validate voice join payload', () => {
    const raw = {
      channelId: 'chan-voice-1',
    };
    const parsed = ClientVoiceJoinPayloadSchema.safeParse(raw);
    expect(parsed.success).toBe(true);
  });

  it('should validate voice leave payload', () => {
    const raw = {
      channelId: 'chan-voice-1',
    };
    const parsed = ClientVoiceLeavePayloadSchema.safeParse(raw);
    expect(parsed.success).toBe(true);
  });

  it('should validate voice offer signal payload', () => {
    const raw = {
      channelId: 'chan-voice-1',
      targetUserId: 'user-456',
      signal: {
        type: 'offer',
        sdp: 'v=0\r\no=- 12345 2 IN IP4 127.0.0.1...',
      },
    };
    const parsed = ClientVoiceSignalPayloadSchema.safeParse(raw);
    expect(parsed.success).toBe(true);
  });

  it('should validate voice answer signal payload', () => {
    const raw = {
      channelId: 'chan-voice-1',
      targetUserId: 'user-123',
      signal: {
        type: 'answer',
        sdp: 'v=0\r\no=- 67890 2 IN IP4 127.0.0.1...',
      },
    };
    const parsed = ClientVoiceSignalPayloadSchema.safeParse(raw);
    expect(parsed.success).toBe(true);
  });

  it('should validate voice candidate signal payload', () => {
    const raw = {
      channelId: 'chan-voice-1',
      targetUserId: 'user-123',
      signal: {
        type: 'candidate',
        candidate: 'candidate:1 1 UDP 2130706431 192.168.1.1 50000 typ host',
        sdpMid: '0',
        sdpMLineIndex: 0,
      },
    };
    const parsed = ClientVoiceSignalPayloadSchema.safeParse(raw);
    expect(parsed.success).toBe(true);
  });

  it('should reject invalid signal payload', () => {
    const invalid = {
      channelId: 'chan-voice-1',
      targetUserId: 'user-123',
      signal: {
        type: 'unsupported-type',
      },
    };
    const parsed = ClientVoiceSignalPayloadSchema.safeParse(invalid);
    expect(parsed.success).toBe(false);
  });

  it('should validate voice state payload (muted, deafened, speaking)', () => {
    const raw = {
      channelId: 'chan-voice-1',
      muted: true,
      deafened: false,
      speaking: false,
    };
    const parsed = ClientVoiceStatePayloadSchema.safeParse(raw);
    expect(parsed.success).toBe(true);
  });

  it('should validate server voice user joined payload with existing participants', () => {
    const raw = {
      channelId: 'chan-voice-1',
      userId: 'user-new',
      displayName: 'Ahmet',
      currentParticipants: [
        {
          userId: 'user-existing-1',
          displayName: 'Mehmet',
          muted: false,
          deafened: false,
          speaking: true,
        },
      ],
    };
    const parsed = ServerVoiceUserJoinedPayloadSchema.safeParse(raw);
    expect(parsed.success).toBe(true);
  });

  it('should validate server voice participants payload', () => {
    const raw = {
      channelId: 'chan-voice-1',
      participants: [
        {
          userId: 'user-1',
          displayName: 'Ali',
          muted: false,
          deafened: false,
          speaking: false,
        },
      ],
    };
    const parsed = ServerVoiceParticipantsPayloadSchema.safeParse(raw);
    expect(parsed.success).toBe(true);
  });

  it('should wrap voice join in standard WsEnvelope', () => {
    const envelope = {
      v: 1,
      t: WsClientEvents.VOICE_JOIN,
      id: 'req-voice-1',
      d: {
        channelId: 'chan-voice-1',
      },
    };
    const parsed = WsEnvelopeSchema.safeParse(envelope);
    expect(parsed.success).toBe(true);
  });

  it('should wrap voice user joined in standard WsEnvelope', () => {
    const envelope = {
      v: 1,
      t: WsServerEvents.VOICE_USER_JOINED,
      d: {
        channelId: 'chan-voice-1',
        userId: 'u1',
        displayName: 'Test',
        currentParticipants: [],
      },
    };
    const parsed = WsEnvelopeSchema.safeParse(envelope);
    expect(parsed.success).toBe(true);
  });
});
