import { Hono } from 'hono';
import { cors } from 'hono/cors';
import {
  APP_NAME,
  PROTOCOL_VERSION,
  HealthResponseSchema,
  type HealthResponse,
} from '@echo/shared';

export interface Env {
  ENVIRONMENT?: string;
}

export const app = new Hono<{ Bindings: Env }>();

app.use('*', cors());

app.get('/api/health', (c) => {
  const healthData: HealthResponse = {
    status: 'ok',
    app: APP_NAME,
    version: '0.1.0',
    protocolVersion: PROTOCOL_VERSION,
    timestamp: Date.now(),
  };

  // Validate response with shared schema
  const parsed = HealthResponseSchema.parse(healthData);
  return c.json(parsed);
});

export default app;
