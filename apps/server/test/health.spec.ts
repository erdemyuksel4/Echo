import { describe, it, expect } from 'vitest';
import { app } from '../src/index';
import { HealthResponseSchema } from '@echo/shared';

describe('Server Health Endpoint', () => {
  it('GET /api/health should return 200 and valid health schema', async () => {
    const res = await app.request('/api/health');
    expect(res.status).toBe(200);

    const body = await res.json();
    const parsed = HealthResponseSchema.safeParse(body);
    expect(parsed.success).toBe(true);

    if (parsed.success) {
      expect(parsed.data.status).toBe('ok');
      expect(parsed.data.app).toBe('Echo');
      expect(parsed.data.protocolVersion).toBe(1);
    }
  });
});
