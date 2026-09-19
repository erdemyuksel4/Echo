import { z } from 'zod';

export const PROTOCOL_VERSION = 1;
export const APP_NAME = 'Echo';

export const HealthResponseSchema = z.object({
  status: z.literal('ok'),
  app: z.string(),
  version: z.string(),
  protocolVersion: z.number().int().positive(),
  timestamp: z.number().int().positive(),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;
