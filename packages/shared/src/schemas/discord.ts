import { z } from 'zod';

export const DiscordMemberSchema = z.object({
  id: z.string(),
  username: z.string(),
  discriminator: z.string().optional(),
  avatar: z.string().nullable().optional(),
  avatarUrl: z.string().nullable().optional(),
  status: z.enum(['online', 'idle', 'dnd', 'offline']).default('online'),
  activity: z.string().nullable().optional(),
  channelId: z.string().nullable().optional(),
  mute: z.boolean().default(false),
  deaf: z.boolean().default(false),
  selfMute: z.boolean().default(false),
  selfDeaf: z.boolean().default(false),
});
export type DiscordMember = z.infer<typeof DiscordMemberSchema>;

export const DiscordVoiceChannelSchema = z.object({
  id: z.string(),
  name: z.string(),
  position: z.number().default(0),
  members: z.array(DiscordMemberSchema).default([]),
});
export type DiscordVoiceChannel = z.infer<typeof DiscordVoiceChannelSchema>;

export const DiscordStateSchema = z.object({
  guildId: z.string(),
  guildName: z.string().default('Discord Sunucusu'),
  instantInvite: z.string().nullable().optional(),
  onlineMembers: z.array(DiscordMemberSchema).default([]),
  voiceChannels: z.array(DiscordVoiceChannelSchema).default([]),
  lastSyncedAt: z.number().default(0),
  error: z.string().nullable().optional(),
});
export type DiscordState = z.infer<typeof DiscordStateSchema>;

export const DiscordConfigSchema = z.object({
  guildId: z.string().trim().default(''),
  echoChannelId: z.string().trim().optional().default(''),
  webhookUrl: z.string().trim().optional().default(''),
  botToken: z.string().trim().optional().default(''),
  discordChannelId: z.string().trim().optional().default(''),
  syncAllChannels: z.boolean().default(true),
  enabled: z.boolean().default(false),
});
export type DiscordConfig = z.infer<typeof DiscordConfigSchema>;

export const ClientDiscordConfigSetPayloadSchema = z.object({
  guildId: z.string().trim(),
  echoChannelId: z.string().trim().optional(),
  webhookUrl: z.string().trim().optional(),
  botToken: z.string().trim().optional(),
  discordChannelId: z.string().trim().optional(),
  syncAllChannels: z.boolean().default(true),
  enabled: z.boolean().default(true),
});
export type ClientDiscordConfigSetPayload = z.infer<typeof ClientDiscordConfigSetPayloadSchema>;

export const ClientDiscordSyncNowPayloadSchema = z.object({
  guildId: z.string().optional(),
});
export type ClientDiscordSyncNowPayload = z.infer<typeof ClientDiscordSyncNowPayloadSchema>;

export const ServerDiscordStatePayloadSchema = DiscordStateSchema;
export type ServerDiscordStatePayload = z.infer<typeof ServerDiscordStatePayloadSchema>;

export const ServerDiscordConfigPayloadSchema = z.object({
  guildId: z.string(),
  echoChannelId: z.string().optional(),
  hasWebhook: z.boolean(),
  hasBotToken: z.boolean(),
  discordChannelId: z.string().optional(),
  syncAllChannels: z.boolean().default(true),
  enabled: z.boolean(),
});
export type ServerDiscordConfigPayload = z.infer<typeof ServerDiscordConfigPayloadSchema>;
