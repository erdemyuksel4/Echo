import { z } from 'zod';

export const VoiceSignalDataSchema = z.union([
  z.object({
    type: z.enum(['offer', 'answer']),
    sdp: z.string(),
  }),
  z.object({
    type: z.literal('candidate'),
    candidate: z.string(),
    sdpMid: z.string().nullable().optional(),
    sdpMLineIndex: z.number().nullable().optional(),
  }),
]);

export type VoiceSignalData = z.infer<typeof VoiceSignalDataSchema>;

// Client -> Server Payloads
export const ClientVoiceJoinPayloadSchema = z.object({
  channelId: z.string(),
});

export type ClientVoiceJoinPayload = z.infer<typeof ClientVoiceJoinPayloadSchema>;

export const ClientVoiceLeavePayloadSchema = z.object({
  channelId: z.string(),
});

export type ClientVoiceLeavePayload = z.infer<typeof ClientVoiceLeavePayloadSchema>;

export const ClientVoiceSignalPayloadSchema = z.object({
  channelId: z.string(),
  targetUserId: z.string(),
  signal: VoiceSignalDataSchema,
});

export type ClientVoiceSignalPayload = z.infer<typeof ClientVoiceSignalPayloadSchema>;

export const ClientVoiceStatePayloadSchema = z.object({
  channelId: z.string(),
  muted: z.boolean(),
  deafened: z.boolean(),
  speaking: z.boolean(),
  camera: z.boolean().optional(),
});

export type ClientVoiceStatePayload = z.infer<typeof ClientVoiceStatePayloadSchema>;

// Server -> Client Payloads
export const VoiceParticipantSchema = z.object({
  userId: z.string(),
  displayName: z.string(),
  muted: z.boolean().default(false),
  deafened: z.boolean().default(false),
  speaking: z.boolean().default(false),
  camera: z.boolean().default(false),
});

export type VoiceParticipant = z.infer<typeof VoiceParticipantSchema>;

export const ServerVoiceUserJoinedPayloadSchema = z.object({
  channelId: z.string(),
  userId: z.string(),
  displayName: z.string(),
  currentParticipants: z.array(VoiceParticipantSchema),
});

export type ServerVoiceUserJoinedPayload = z.infer<typeof ServerVoiceUserJoinedPayloadSchema>;

export const ServerVoiceUserLeftPayloadSchema = z.object({
  channelId: z.string(),
  userId: z.string(),
});

export type ServerVoiceUserLeftPayload = z.infer<typeof ServerVoiceUserLeftPayloadSchema>;

export const ServerVoiceSignalPayloadSchema = z.object({
  channelId: z.string(),
  fromUserId: z.string(),
  signal: VoiceSignalDataSchema,
});

export type ServerVoiceSignalPayload = z.infer<typeof ServerVoiceSignalPayloadSchema>;

export const ServerVoiceStatePayloadSchema = z.object({
  channelId: z.string(),
  userId: z.string(),
  muted: z.boolean(),
  deafened: z.boolean(),
  speaking: z.boolean(),
  camera: z.boolean().default(false),
});

export type ServerVoiceStatePayload = z.infer<typeof ServerVoiceStatePayloadSchema>;

export const ServerVoiceParticipantsPayloadSchema = z.object({
  channelId: z.string(),
  participants: z.array(VoiceParticipantSchema),
});

export type ServerVoiceParticipantsPayload = z.infer<typeof ServerVoiceParticipantsPayloadSchema>;

// Diagnostic stats for acceptance criteria panel
export interface PeerDiagnosticsStats {
  peerId: string;
  displayName: string;
  connectionState: string;
  iceConnectionState: string;
  candidateType: 'host' | 'srflx' | 'relay' | 'unknown';
  localCandidateType?: string;
  remoteCandidateType?: string;
  rttMs: number;
  packetsLost: number;
  fractionLost: number;
  bitrateKbps: number;
  audioLevel: number;
}

// WebRTC ICE / TURN Configuration Schemas
export const IceServerSchema = z.object({
  urls: z.union([z.string(), z.array(z.string())]),
  username: z.string().optional(),
  credential: z.string().optional(),
});

export type IceServerConfig = z.infer<typeof IceServerSchema>;

export const TurnResponseSchema = z.object({
  iceServers: z.union([
    z.array(IceServerSchema),
    IceServerSchema.transform((single) => [single]),
  ]),
});

export type TurnResponse = z.infer<typeof TurnResponseSchema>;

// Verified high-reliability fallback ICE servers (Cloudflare STUN, Google STUN, OpenRelay Metered TURN)
export const DEFAULT_FALLBACK_ICE_SERVERS: IceServerConfig[] = [
  {
    urls: [
      'stun:stun.cloudflare.com:3478',
      'stun:stun.l.google.com:19302',
    ],
  },
  {
    urls: [
      'turn:openrelay.metered.ca:80',
      'turn:openrelay.metered.ca:443',
      'turn:openrelay.metered.ca:443?transport=tcp',
      'turns:openrelay.metered.ca:443?transport=tcp',
    ],
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];
