import { z } from 'zod';

export const DmThreadSchema = z.object({
  peerId: z.string(),
  peerName: z.string(),
  peerColor: z.string(),
  lastMessageAt: z.number(),
  lastMessagePreview: z.string().default(''),
  unreadCount: z.number().int().min(0).default(0),
});

export type DmThread = z.infer<typeof DmThreadSchema>;
