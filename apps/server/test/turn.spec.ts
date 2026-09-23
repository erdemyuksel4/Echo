import { describe, it, expect, vi } from 'vitest';
import { app } from '../src/index';
import { TurnResponseSchema } from '@echo/shared';

describe('Server TURN Endpoint', () => {
  it('GET /api/turn should return 200 and fallback iceServers containing reliable STUN when secrets are not set', async () => {
    const res = await app.request('/api/turn');
    expect(res.status).toBe(200);

    const body = await res.json();
    const parsed = TurnResponseSchema.safeParse(body);
    expect(parsed.success).toBe(true);

    if (parsed.success) {
      expect(parsed.data.iceServers.length).toBeGreaterThanOrEqual(1);

      // Verify STUN exists
      const hasStun = parsed.data.iceServers.some((s) => {
        const urls = Array.isArray(s.urls) ? s.urls : [s.urls];
        return urls.some((u) => u.startsWith('stun:'));
      });
      expect(hasStun).toBe(true);
    }
  });

  it('GET /api/turn should request Cloudflare Calls API when TURN secrets are provided', async () => {
    const originalFetch = globalThis.fetch;
    const mockCfIceServers = [
      { urls: 'stun:stun.cloudflare.com:3478' },
      {
        urls: [
          'turn:turn.cloudflare.com:3478?transport=udp',
          'turns:turn.cloudflare.com:5349?transport=tcp',
        ],
        username: 'cf-ephemeral-user',
        credential: 'cf-ephemeral-pass',
      },
    ];

    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('rtc.live.cloudflare.com')) {
        return new Response(JSON.stringify({ iceServers: mockCfIceServers }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return originalFetch(url);
    });

    try {
      const mockEnv = {
        CLOUDFLARE_TURN_KEY_ID: 'test-turn-key-id',
        CLOUDFLARE_TURN_API_TOKEN: 'test-api-token',
      };

      const res = await app.request('/api/turn', undefined, mockEnv);
      expect(res.status).toBe(200);

      const body = await res.json();
      const parsed = TurnResponseSchema.safeParse(body);
      expect(parsed.success).toBe(true);

      if (parsed.success) {
        expect(parsed.data.iceServers.length).toBe(2);
        const cfTurn = parsed.data.iceServers.find((s) => s.username === 'cf-ephemeral-user');
        expect(cfTurn).toBeDefined();
        expect(cfTurn?.credential).toBe('cf-ephemeral-pass');
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
