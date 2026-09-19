import { z } from 'zod';

export const ScreenQualityPresetSchema = z.enum(['720p30', '1080p30', '1080p60']);
export type ScreenQualityPreset = z.infer<typeof ScreenQualityPresetSchema>;

export const ScreenShareModeSchema = z.enum(['motion', 'detail']);
export type ScreenShareMode = z.infer<typeof ScreenShareModeSchema>;

export interface ScreenQualityConfig {
  width: number;
  height: number;
  frameRate: number;
  maxBitrate: number; // in bps
}

export const SCREEN_QUALITY_PRESETS: Record<ScreenQualityPreset, ScreenQualityConfig> = {
  '720p30': {
    width: 1280,
    height: 720,
    frameRate: 30,
    maxBitrate: 2_000_000, // 2 Mbps
  },
  '1080p30': {
    width: 1920,
    height: 1080,
    frameRate: 30,
    maxBitrate: 4_000_000, // 4 Mbps
  },
  '1080p60': {
    width: 1920,
    height: 1080,
    frameRate: 60,
    maxBitrate: 7_000_000, // 7 Mbps
  },
};

export const ScreenShareSourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  thumbnailDataUrl: z.string(),
  appIconDataUrl: z.string().nullable().optional(),
  isScreen: z.boolean(),
});
export type ScreenShareSource = z.infer<typeof ScreenShareSourceSchema>;

export const ScreenShareStateSchema = z.object({
  channelId: z.string(),
  userId: z.string(),
  displayName: z.string(),
  isSharing: z.boolean(),
  quality: ScreenQualityPresetSchema.default('720p30'),
  mode: ScreenShareModeSchema.default('motion'),
  hasAudio: z.boolean().default(false),
  viewersCount: z.number().int().nonnegative().default(0),
});
export type ScreenShareState = z.infer<typeof ScreenShareStateSchema>;

export const ClientShareStartPayloadSchema = z.object({
  channelId: z.string(),
  quality: ScreenQualityPresetSchema.default('720p30'),
  mode: ScreenShareModeSchema.default('motion'),
  hasAudio: z.boolean().default(false),
});
export type ClientShareStartPayload = z.infer<typeof ClientShareStartPayloadSchema>;

export const ClientShareStopPayloadSchema = z.object({
  channelId: z.string(),
});
export type ClientShareStopPayload = z.infer<typeof ClientShareStopPayloadSchema>;

export const ClientShareSignalPayloadSchema = z.object({
  channelId: z.string(),
  targetUserId: z.string(),
  signal: z.unknown(),
});
export type ClientShareSignalPayload = z.infer<typeof ClientShareSignalPayloadSchema>;

export const ServerShareStartedPayloadSchema = ScreenShareStateSchema;
export type ServerShareStartedPayload = z.infer<typeof ServerShareStartedPayloadSchema>;

export const ServerShareStoppedPayloadSchema = z.object({
  channelId: z.string(),
  userId: z.string(),
});
export type ServerShareStoppedPayload = z.infer<typeof ServerShareStoppedPayloadSchema>;

export const ServerShareSignalPayloadSchema = z.object({
  channelId: z.string(),
  fromUserId: z.string(),
  signal: z.unknown(),
});
export type ServerShareSignalPayload = z.infer<typeof ServerShareSignalPayloadSchema>;
