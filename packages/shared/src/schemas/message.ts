import { z } from 'zod';

export const MAX_MESSAGE_LENGTH = 4000;

export const AttachmentTypeSchema = z.enum(['image', 'gif', 'file']);
export type AttachmentType = z.infer<typeof AttachmentTypeSchema>;

export const P2POfferSchema = z.object({
  fileHash: z.string(),
  fileSize: z.number().int().positive(),
  mimeType: z.string(),
});
export type P2POffer = z.infer<typeof P2POfferSchema>;

export const AttachmentSchema = z.object({
  id: z.string(),
  name: z.string().max(255),
  size: z.number().int().nonnegative(),
  mimeType: z.string(),
  url: z.string(),
  type: AttachmentTypeSchema,
  width: z.number().optional(),
  height: z.number().optional(),
  p2pOffer: P2POfferSchema.optional(),
});
export type Attachment = z.infer<typeof AttachmentSchema>;

export const MessageSchema = z.object({
  id: z.string(),
  channelId: z.string(),
  authorId: z.string(),
  authorName: z.string(),
  content: z.string().max(MAX_MESSAGE_LENGTH).default(''),
  attachments: z.array(AttachmentSchema).default([]),
  replyTo: z.string().nullable().default(null),
  replyToAuthorName: z.string().nullable().default(null),
  replyToContent: z.string().nullable().default(null),
  createdAt: z.number().int().positive(),
  editedAt: z.number().int().positive().nullable().default(null),
  deleted: z.boolean().default(false),
  reactions: z.record(z.string(), z.array(z.string())).default({}),
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
