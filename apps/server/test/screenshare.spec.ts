import { describe, it, expect } from 'vitest';
import {
  ClientShareStartPayloadSchema,
  ClientShareStopPayloadSchema,
  ClientShareSignalPayloadSchema,
  ServerShareStartedPayloadSchema,
  WsClientEvents,
  WsServerEvents,
} from '@echo/shared';

describe('Faz 6 - Screen Share Server Protocol', () => {
  it('defines correct event constants', () => {
    expect(WsClientEvents.SHARE_START).toBe('share.start');
    expect(WsClientEvents.SHARE_STOP).toBe('share.stop');
    expect(WsClientEvents.SHARE_SIGNAL).toBe('share.signal');

    expect(WsServerEvents.SHARE_STARTED).toBe('share.started');
    expect(WsServerEvents.SHARE_STOPPED).toBe('share.stopped');
    expect(WsServerEvents.SHARE_SIGNAL).toBe('share.signal');
    expect(WsServerEvents.SHARE_ACTIVE_LIST).toBe('share.active_list');
  });

  it('validates share start payload for voice channels', () => {
    const valid = ClientShareStartPayloadSchema.safeParse({
      channelId: 'voice-chan-1',
      quality: '720p30',
      mode: 'motion',
      hasAudio: true,
    });
    expect(valid.success).toBe(true);

    const invalid = ClientShareStartPayloadSchema.safeParse({
      quality: 'invalid-quality',
    });
    expect(invalid.success).toBe(false);
  });

  it('validates share stop payload', () => {
    const valid = ClientShareStopPayloadSchema.safeParse({
      channelId: 'voice-chan-1',
    });
    expect(valid.success).toBe(true);
  });

  it('validates share signal routing payload', () => {
    const valid = ClientShareSignalPayloadSchema.safeParse({
      channelId: 'voice-chan-1',
      targetUserId: 'user-bob',
      signal: { sdp: 'v=0...', type: 'offer' },
    });
    expect(valid.success).toBe(true);
  });

  it('validates server broadcast payload on share started', () => {
    const valid = ServerShareStartedPayloadSchema.safeParse({
      channelId: 'voice-chan-1',
      userId: 'user-alice',
      displayName: 'Alice',
      isSharing: true,
      quality: '1080p30',
      mode: 'detail',
      hasAudio: false,
      viewersCount: 0,
    });
    expect(valid.success).toBe(true);
  });
});
