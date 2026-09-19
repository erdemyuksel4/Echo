import { describe, it, expect } from 'vitest';
import { PROTOCOL_VERSION, APP_NAME, HealthResponseSchema } from '../index';

describe('Shared Health Schema', () => {
  it('should define basic constants', () => {
    expect(PROTOCOL_VERSION).toBe(1);
    expect(APP_NAME).toBe('Echo');
  });

  it('should validate valid health response', () => {
    const validData = {
      status: 'ok',
      app: 'Echo',
      version: '0.1.0',
      protocolVersion: 1,
      timestamp: Date.now(),
    };

    const parsed = HealthResponseSchema.safeParse(validData);
    expect(parsed.success).toBe(true);
  });

  it('should reject invalid status', () => {
    const invalidData = {
      status: 'error',
      app: 'Echo',
      version: '0.1.0',
      protocolVersion: 1,
      timestamp: Date.now(),
    };

    const parsed = HealthResponseSchema.safeParse(invalidData);
    expect(parsed.success).toBe(false);
  });
});
