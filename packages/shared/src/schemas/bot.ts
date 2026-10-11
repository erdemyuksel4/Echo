import { z } from 'zod';

export const BotTypeSchema = z.enum([
  'music',
  'ai',
  'moderation',
  'utility',
  'game',
  'custom',
]);
export type BotType = z.infer<typeof BotTypeSchema>;

export const BotCapabilitySchema = z.enum([
  'voice',
  'chat_commands',
  'events',
  'audio_stream',
]);
export type BotCapability = z.infer<typeof BotCapabilitySchema>;

export const BotCommandDefinitionSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  usage: z.string().optional(),
  aliases: z.array(z.string()).default([]),
});
export type BotCommandDefinition = z.infer<typeof BotCommandDefinitionSchema>;

export const BotManifestSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  avatarUrl: z.string().optional(),
  type: BotTypeSchema,
  capabilities: z.array(BotCapabilitySchema).default([]),
  prefix: z.string().default('!'),
  color: z.string().default('#6366f1'),
  commands: z.array(BotCommandDefinitionSchema).default([]),
});
export type BotManifest = z.infer<typeof BotManifestSchema>;

export const BotCommandInvokePayloadSchema = z.object({
  channelId: z.string().min(1),
  botId: z.string().min(1),
  command: z.string().min(1),
  args: z.array(z.string()).default([]),
  rawText: z.string().default(''),
});
export type BotCommandInvokePayload = z.infer<typeof BotCommandInvokePayloadSchema>;

export const BotStateUpdatePayloadSchema = z.object({
  channelId: z.string().min(1),
  botId: z.string().min(1),
  statusText: z.string().optional(),
  activity: z.string().optional(),
  isSpeaking: z.boolean().default(false),
  metadata: z.record(z.unknown()).optional(),
});
export type BotStateUpdatePayload = z.infer<typeof BotStateUpdatePayloadSchema>;
