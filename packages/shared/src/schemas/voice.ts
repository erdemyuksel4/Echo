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
});

export type ClientVoiceStatePayload = z.infer<typeof ClientVoiceStatePayloadSchema>;

// Server -> Client Payloads
export const VoiceParticipantSchema = z.object({
  userId: z.string(),
  displayName: z.string(),
  muted: z.boolean().default(false),
  deafened: z.boolean().default(false),
  speaking: z.boolean().default(false),
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
