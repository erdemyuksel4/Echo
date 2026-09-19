import { z } from 'zod';

export const AuthPayloadSchema = z.object({
  userId: z.string().min(10).max(40),
  pubkey: z.string().length(64), // 32 bytes hex
  ts: z.number().int().positive(),
  sig: z.string().length(128), // 64 bytes hex
});

export type AuthPayload = z.infer<typeof AuthPayloadSchema>;

export const UserProfileSchema = z.object({
  userId: z.string().min(10).max(40),
  displayName: z.string().min(2).max(32).trim(),
  avatarColor: z.string().regex(/^#([0-9a-fA-F]{6})$/),
  createdAt: z.number().int().positive(),
});

export type UserProfile = z.infer<typeof UserProfileSchema>;

export const CreateGroupRequestSchema = z.object({
  name: z.string().min(2).max(50).trim(),
  displayName: z.string().min(2).max(32).trim(),
  pubkey: z.string().length(64),
  ts: z.number().int().positive(),
  sig: z.string().length(128),
});

export type CreateGroupRequest = z.infer<typeof CreateGroupRequestSchema>;

export const JoinGroupRequestSchema = z.object({
  inviteCode: z.string().min(4).max(64).trim(),
  displayName: z.string().min(2).max(32).trim(),
  pubkey: z.string().length(64),
  ts: z.number().int().positive(),
  sig: z.string().length(128),
});

export type JoinGroupRequest = z.infer<typeof JoinGroupRequestSchema>;
