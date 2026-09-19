import { z } from 'zod';

export const MAX_MESSAGE_LENGTH = 4000;

export const MessageSchema = z.object({
  id: z.string(),
  channelId: z.string(),
  authorId: z.string(),
  authorName: z.string(),
  content: z.string().min(1).max(MAX_MESSAGE_LENGTH),
  replyTo: z.string().nullable().default(null),
  createdAt: z.number().int().positive(),
  editedAt: z.number().int().positive().nullable().default(null),
  deleted: z.boolean().default(false),
});

export type Message = z.infer<typeof MessageSchema>;

export const HistoryQuerySchema = z.object({
  channelId: z.string(),
  before: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(50),
});

export type HistoryQuery = z.infer<typeof HistoryQuerySchema>;

export const HistoryResultSchema = z.object({
  channelId: z.string(),
  messages: z.array(MessageSchema),
  hasMore: z.boolean(),
});

export type HistoryResult = z.infer<typeof HistoryResultSchema>;
