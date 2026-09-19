import { z } from 'zod';

export const UserRoleSchema = z.enum(['owner', 'admin', 'member']);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const ChannelTypeSchema = z.enum(['text', 'voice']);
export type ChannelType = z.infer<typeof ChannelTypeSchema>;

export const ChannelSchema = z.object({
  id: z.string(),
  groupId: z.string(),
  name: z.string().min(1).max(50).trim(),
  type: ChannelTypeSchema,
  position: z.number().int().nonnegative(),
  createdAt: z.number().int().positive(),
});

export type Channel = z.infer<typeof ChannelSchema>;

export const GroupMemberSchema = z.object({
  userId: z.string(),
  displayName: z.string().min(2).max(32),
  pubkey: z.string(),
  role: UserRoleSchema,
  joinedAt: z.number().int().positive(),
  banned: z.boolean().default(false),
  status: z.enum(['online', 'idle', 'offline']).default('offline'),
});

export type GroupMember = z.infer<typeof GroupMemberSchema>;

export const GroupMetaSchema = z.object({
  id: z.string(),
  name: z.string().min(2).max(50),
  ownerId: z.string(),
  createdAt: z.number().int().positive(),
});

export type GroupMeta = z.infer<typeof GroupMetaSchema>;

export const GroupSnapshotSchema = z.object({
  group: GroupMetaSchema,
  channels: z.array(ChannelSchema),
  members: z.array(GroupMemberSchema),
});

export type GroupSnapshot = z.infer<typeof GroupSnapshotSchema>;

export const InviteDataSchema = z.object({
  code: z.string(),
  groupId: z.string(),
  createdBy: z.string(),
  createdAt: z.number().int().positive(),
  expiresAt: z.number().int().positive().nullable(),
  maxUses: z.number().int().positive().nullable(),
  uses: z.number().int().nonnegative(),
});

export type InviteData = z.infer<typeof InviteDataSchema>;
