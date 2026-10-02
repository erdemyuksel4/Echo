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

export const AnnotationPointSchema = z.object({
  x: z.number(), // 0.0 - 1.0 (normalized)
  y: z.number(), // 0.0 - 1.0 (normalized)
});
export type AnnotationPoint = z.infer<typeof AnnotationPointSchema>;

export const AnnotationStrokeSchema = z.object({
  id: z.string(),
  userId: z.string(),
  userDisplayName: z.string(),
  tool: z.enum(['pen', 'arrow', 'rect']),
  color: z.string(),
  width: z.number().default(3),
  points: z.array(AnnotationPointSchema),
  timestamp: z.number(),
});
export type AnnotationStroke = z.infer<typeof AnnotationStrokeSchema>;

export const ClientAnnotationDrawPayloadSchema = z.object({
  channelId: z.string(),
  streamUserId: z.string(),
  stroke: AnnotationStrokeSchema,
});
export type ClientAnnotationDrawPayload = z.infer<typeof ClientAnnotationDrawPayloadSchema>;

export const ClientAnnotationClearPayloadSchema = z.object({
  channelId: z.string(),
  streamUserId: z.string(),
});
export type ClientAnnotationClearPayload = z.infer<typeof ClientAnnotationClearPayloadSchema>;

export const ServerAnnotationDrawPayloadSchema = ClientAnnotationDrawPayloadSchema;
export type ServerAnnotationDrawPayload = ClientAnnotationDrawPayload;

export const ServerAnnotationClearPayloadSchema = ClientAnnotationClearPayloadSchema;
export type ServerAnnotationClearPayload = ClientAnnotationClearPayload;

export const RemoteControlEventSchema = z.object({
  type: z.enum(['mousemove', 'mousedown', 'mouseup', 'keydown', 'keyup']),
  x: z.number().optional(),
  y: z.number().optional(),
  button: z.number().optional(),
  key: z.string().optional(),
});
export type RemoteControlEvent = z.infer<typeof RemoteControlEventSchema>;

export const ClientRemoteControlRequestPayloadSchema = z.object({
  channelId: z.string(),
  streamUserId: z.string(),
});
export type ClientRemoteControlRequestPayload = z.infer<typeof ClientRemoteControlRequestPayloadSchema>;

export const ServerRemoteControlRequestPayloadSchema = z.object({
  channelId: z.string(),
  requesterUserId: z.string(),
  requesterDisplayName: z.string(),
});
export type ServerRemoteControlRequestPayload = z.infer<typeof ServerRemoteControlRequestPayloadSchema>;

export const ClientRemoteControlResponsePayloadSchema = z.object({
  channelId: z.string(),
  requesterUserId: z.string(),
  approved: z.boolean(),
});
export type ClientRemoteControlResponsePayload = z.infer<typeof ClientRemoteControlResponsePayloadSchema>;

export const ServerRemoteControlResponsePayloadSchema = z.object({
  channelId: z.string(),
  streamUserId: z.string(),
  approved: z.boolean(),
});
export type ServerRemoteControlResponsePayload = z.infer<typeof ServerRemoteControlResponsePayloadSchema>;

export const ClientRemoteControlEventPayloadSchema = z.object({
  channelId: z.string(),
  streamUserId: z.string(),
  event: RemoteControlEventSchema,
});
export type ClientRemoteControlEventPayload = z.infer<typeof ClientRemoteControlEventPayloadSchema>;

export const ServerRemoteControlEventPayloadSchema = z.object({
  channelId: z.string(),
  fromUserId: z.string(),
  fromDisplayName: z.string(),
  event: RemoteControlEventSchema,
});
export type ServerRemoteControlEventPayload = z.infer<typeof ServerRemoteControlEventPayloadSchema>;

export const ClientRemoteControlStopPayloadSchema = z.object({
  channelId: z.string(),
  targetUserId: z.string(),
});
export type ClientRemoteControlStopPayload = z.infer<typeof ClientRemoteControlStopPayloadSchema>;

export const ServerRemoteControlStopPayloadSchema = z.object({
  channelId: z.string(),
  stoppedByUserId: z.string(),
});
export type ServerRemoteControlStopPayload = z.infer<typeof ServerRemoteControlStopPayloadSchema>;

