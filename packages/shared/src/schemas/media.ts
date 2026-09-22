import { z } from 'zod';
import { AttachmentSchema } from './message';

export const AttachmentUploadRequestSchema = z.object({
  filename: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(100),
  sizeBytes: z
    .number()
    .int()
    .positive()
    .max(10 * 1024 * 1024), // Max 10MB per upload
  totalChunks: z.number().int().positive().max(50),
  chunks: z.array(
    z.object({
      index: z.number().int().nonnegative(),
      dataBase64: z.string().min(1),
    }),
  ),
  width: z.number().optional(),
  height: z.number().optional(),
});
export type AttachmentUploadRequest = z.infer<typeof AttachmentUploadRequestSchema>;

export const AttachmentUploadResponseSchema = z.object({
  success: z.boolean(),
  attachment: AttachmentSchema,
});
export type AttachmentUploadResponse = z.infer<typeof AttachmentUploadResponseSchema>;

export const GiphyItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  url: z.string().url(),
  previewUrl: z.string().url(),
  width: z.number(),
  height: z.number(),
});
export type GiphyItem = z.infer<typeof GiphyItemSchema>;

export const GiphySearchResponseSchema = z.object({
  results: z.array(GiphyItemSchema),
});
export type GiphySearchResponse = z.infer<typeof GiphySearchResponseSchema>;
