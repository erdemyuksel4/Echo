import { describe, it, expect } from 'vitest';
import {
  ClientVoiceJoinPayloadSchema,
  ClientVoiceLeavePayloadSchema,
  ClientVoiceSignalPayloadSchema,
  ClientVoiceStatePayloadSchema,
  ServerVoiceUserJoinedPayloadSchema,
  ServerVoiceUserLeftPayloadSchema,
  ServerVoiceSignalPayloadSchema,
  ServerVoiceStatePayloadSchema,
  ServerVoiceParticipantsPayloadSchema,
  VoiceParticipantSchema,
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

  it('should validate voice state payload (muted, deafened, speaking, camera)', () => {
    const raw = {
      channelId: 'chan-voice-1',
      muted: true,
      deafened: false,
      speaking: false,
      camera: true,
    };
    const parsed = ClientVoiceStatePayloadSchema.safeParse(raw);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.camera).toBe(true);
    }
  });

  it('should validate voice state payload without camera (optional)', () => {
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

  it('should validate VoiceParticipantSchema with default camera false and explicit camera true', () => {
    const rawDefault = {
      userId: 'user-camera-1',
      displayName: 'Can',
      muted: false,
      deafened: false,
      speaking: false,
    };
    const parsedDefault = VoiceParticipantSchema.safeParse(rawDefault);
    expect(parsedDefault.success).toBe(true);
    if (parsedDefault.success) {
      expect(parsedDefault.data.camera).toBe(false);
    }

    const rawWithCam = {
      userId: 'user-camera-2',
      displayName: 'Zeynep',
      muted: false,
      deafened: false,
      speaking: true,
      camera: true,
    };
    const parsedWithCam = VoiceParticipantSchema.safeParse(rawWithCam);
    expect(parsedWithCam.success).toBe(true);
    if (parsedWithCam.success) {
      expect(parsedWithCam.data.camera).toBe(true);
    }
  });

  it('should validate ServerVoiceStatePayloadSchema with camera state', () => {
    const raw = {
      channelId: 'chan-voice-1',
      userId: 'user-123',
      muted: false,
      deafened: false,
      speaking: true,
      camera: true,
    };
    const parsed = ServerVoiceStatePayloadSchema.safeParse(raw);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.camera).toBe(true);
    }

    // Camera defaults to false when omitted in server payload
    const rawDefault = {
      channelId: 'chan-voice-1',
      userId: 'user-123',
      muted: true,
      deafened: false,
      speaking: false,
    };
    const parsedDefault = ServerVoiceStatePayloadSchema.safeParse(rawDefault);
    expect(parsedDefault.success).toBe(true);
    if (parsedDefault.success) {
      expect(parsedDefault.data.camera).toBe(false);
    }
  });

  it('should validate ServerVoiceUserLeftPayloadSchema', () => {
    const raw = {
      channelId: 'chan-voice-1',
      userId: 'user-left-1',
    };
    const parsed = ServerVoiceUserLeftPayloadSchema.safeParse(raw);
    expect(parsed.success).toBe(true);
  });

  it('should validate ServerVoiceSignalPayloadSchema forwarding WebRTC signal', () => {
    const raw = {
      channelId: 'chan-voice-1',
      fromUserId: 'user-peer-1',
      signal: {
        type: 'offer',
        sdp: 'v=0\r\no=- 999 2 IN IP4 127.0.0.1...',
      },
    };
    const parsed = ServerVoiceSignalPayloadSchema.safeParse(raw);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.fromUserId).toBe('user-peer-1');
    }
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
