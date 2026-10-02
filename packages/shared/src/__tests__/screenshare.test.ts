import { describe, it, expect } from 'vitest';
import {
  ScreenQualityPresetSchema,
  SCREEN_QUALITY_PRESETS,
  ScreenShareStateSchema,
  ClientShareStartPayloadSchema,
  ClientShareStopPayloadSchema,
  ClientShareSignalPayloadSchema,
  ClientAnnotationDrawPayloadSchema,
  ClientAnnotationClearPayloadSchema,
  ClientRemoteControlRequestPayloadSchema,
  ClientRemoteControlResponsePayloadSchema,
  ClientRemoteControlEventPayloadSchema,
  ClientRemoteControlStopPayloadSchema,
} from '../schemas/screenshare';

describe('Faz 6 - Screen Share Schemas', () => {
  it('validates quality presets and config values', () => {
    expect(ScreenQualityPresetSchema.safeParse('720p30').success).toBe(true);
    expect(ScreenQualityPresetSchema.safeParse('1080p30').success).toBe(true);
    expect(ScreenQualityPresetSchema.safeParse('1080p60').success).toBe(true);
    expect(ScreenQualityPresetSchema.safeParse('4k120').success).toBe(false);

    expect(SCREEN_QUALITY_PRESETS['720p30'].width).toBe(1280);
    expect(SCREEN_QUALITY_PRESETS['720p30'].height).toBe(720);
    expect(SCREEN_QUALITY_PRESETS['720p30'].frameRate).toBe(30);
    expect(SCREEN_QUALITY_PRESETS['720p30'].maxBitrate).toBe(2_000_000);

    expect(SCREEN_QUALITY_PRESETS['1080p60'].frameRate).toBe(60);
    expect(SCREEN_QUALITY_PRESETS['1080p60'].maxBitrate).toBe(7_000_000);
  });

  it('validates client start and stop payloads', () => {
    const validStart = ClientShareStartPayloadSchema.safeParse({
      channelId: 'chan-voice-1',
      quality: '1080p30',
      mode: 'motion',
      hasAudio: true,
    });
    expect(validStart.success).toBe(true);

    const validStop = ClientShareStopPayloadSchema.safeParse({
      channelId: 'chan-voice-1',
    });
    expect(validStop.success).toBe(true);

    const invalidStop = ClientShareStopPayloadSchema.safeParse({});
    expect(invalidStop.success).toBe(false);
  });

  it('validates share signal payloads', () => {
    const validSignal = ClientShareSignalPayloadSchema.safeParse({
      channelId: 'chan-1',
      targetUserId: 'user-2',
      signal: { type: 'offer', sdp: 'v=0...' },
    });
    expect(validSignal.success).toBe(true);
  });

  it('validates screen share state with defaults', () => {
    const state = ScreenShareStateSchema.parse({
      channelId: 'chan-1',
      userId: 'user-1',
      displayName: 'Erdem',
      isSharing: true,
    });
    expect(state.quality).toBe('720p30');
    expect(state.mode).toBe('motion');
    expect(state.hasAudio).toBe(false);
    expect(state.viewersCount).toBe(0);
  });

  it('validates annotation stroke and draw/clear payloads', () => {
    const validStroke = {
      id: 'stroke-1',
      userId: 'user-1',
      userDisplayName: 'Erdem',
      tool: 'pen' as const,
      color: '#ef4444',
      width: 3,
      points: [
        { x: 0.1, y: 0.2 },
        { x: 0.3, y: 0.4 },
      ],
      timestamp: 1700000000000,
    };

    const drawPayload = ClientAnnotationDrawPayloadSchema.safeParse({
      channelId: 'chan-1',
      streamUserId: 'streamer-1',
      stroke: validStroke,
    });
    expect(drawPayload.success).toBe(true);

    const clearPayload = ClientAnnotationClearPayloadSchema.safeParse({
      channelId: 'chan-1',
      streamUserId: 'streamer-1',
    });
    expect(clearPayload.success).toBe(true);

    const invalidStroke = ClientAnnotationDrawPayloadSchema.safeParse({
      channelId: 'chan-1',
      streamUserId: 'streamer-1',
      stroke: {
        ...validStroke,
        tool: 'invalid_tool',
      },
    });
    expect(invalidStroke.success).toBe(false);
  });

  it('validates remote control request, response, event, and stop payloads', () => {
    const reqPayload = ClientRemoteControlRequestPayloadSchema.safeParse({
      channelId: 'chan-1',
      streamUserId: 'streamer-1',
    });
    expect(reqPayload.success).toBe(true);

    const resPayload = ClientRemoteControlResponsePayloadSchema.safeParse({
      channelId: 'chan-1',
      requesterUserId: 'viewer-1',
      approved: true,
    });
    expect(resPayload.success).toBe(true);

    const moveEvent = ClientRemoteControlEventPayloadSchema.safeParse({
      channelId: 'chan-1',
      streamUserId: 'streamer-1',
      event: {
        type: 'mousemove',
        x: 0.45,
        y: 0.82,
      },
    });
    expect(moveEvent.success).toBe(true);

    const keyEvent = ClientRemoteControlEventPayloadSchema.safeParse({
      channelId: 'chan-1',
      streamUserId: 'streamer-1',
      event: {
        type: 'keydown',
        key: 'Enter',
      },
    });
    expect(keyEvent.success).toBe(true);

    const stopPayload = ClientRemoteControlStopPayloadSchema.safeParse({
      channelId: 'chan-1',
      targetUserId: 'viewer-1',
    });
    expect(stopPayload.success).toBe(true);
  });
});

