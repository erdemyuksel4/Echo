import { describe, it, expect } from 'vitest';
import { app } from '../src/index';

describe('Faz 12 - Device Link Endpoints', () => {
  it('POST /api/auth/link/init rejects invalid payload', async () => {
    const res = await app.request('/api/auth/link/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tempPublicKeyHex: 'too-short' }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('Geçersiz');
  });

  it('POST /api/auth/link/claim rejects invalid payload', async () => {
    const res = await app.request('/api/auth/link/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ linkCode: '1' }), // En az 4 hane olmalı
    });
    expect(res.status).toBe(400);
  });

  it('POST /api/auth/link/approve rejects invalid payload', async () => {
    const res = await app.request('/api/auth/link/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: '123' }), // Eksik parametreler
    });
    expect(res.status).toBe(400);
  });

  it('full link lifecycle with mock USER_DO works seamlessly', async () => {
    interface MockLinkItem {
      sessionId: string;
      linkCode: string;
      tempPublicKeyHex: string;
      deviceInfo?: string;
      status: string;
      expiresAt: number;
      claimerDisplayName?: string;
      claimerDeviceInfo?: string;
      claimerTempPublicKeyHex?: string;
      encryptedPayload?: { iv: string; cipherText: string };
    }

    // In-memory mock storage for UserDO device linking
    const mockStorage: Record<string, MockLinkItem> = {};

    const mockUserDOInstance = {
      fetch: async (urlStr: string, init?: RequestInit) => {
        const u = new URL(urlStr);
        if (u.pathname === '/internal/device-link/init') {
          const body = JSON.parse(init?.body as string) as { tempPublicKeyHex: string; deviceInfo?: string };
          const sessionId = 'test-session-123';
          const linkCode = '849-213';
          mockStorage[sessionId] = {
            sessionId,
            linkCode: '849213',
            tempPublicKeyHex: body.tempPublicKeyHex,
            deviceInfo: body.deviceInfo,
            status: 'pending',
            expiresAt: Date.now() + 300_000,
          };
          return new Response(JSON.stringify({ sessionId, linkCode, expiresAt: mockStorage[sessionId].expiresAt }));
        }

        if (u.pathname === '/internal/device-link/claim') {
          const body = JSON.parse(init?.body as string) as { linkCode: string; claimerDisplayName: string; claimerDeviceInfo?: string };
          const item = Object.values(mockStorage).find((s) => s.linkCode === body.linkCode.replace(/[^0-9]/g, ''));
          if (!item) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
          item.status = 'claimed';
          item.claimerDisplayName = body.claimerDisplayName;
          item.claimerDeviceInfo = body.claimerDeviceInfo;
          return new Response(JSON.stringify({
            sessionId: item.sessionId,
            targetTempPublicKeyHex: item.tempPublicKeyHex,
            targetDeviceInfo: item.deviceInfo,
            expiresAt: item.expiresAt,
          }));
        }

        if (u.pathname === '/internal/device-link/approve') {
          const body = JSON.parse(init?.body as string) as {
            sessionId: string;
            claimerTempPublicKeyHex: string;
            encryptedPayload: { iv: string; cipherText: string };
          };
          const item = mockStorage[body.sessionId];
          if (!item) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
          item.status = 'approved';
          item.claimerTempPublicKeyHex = body.claimerTempPublicKeyHex;
          item.encryptedPayload = body.encryptedPayload;
          return new Response(JSON.stringify({ success: true }));
        }

        if (u.pathname === '/internal/device-link/status') {
          const sid = u.searchParams.get('sessionId') || '';
          const item = mockStorage[sid];
          if (!item) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
          return new Response(JSON.stringify(item));
        }

        return new Response('Not found', { status: 404 });
      },
    };

    const mockEnv = {
      USER_DO: {
        idFromName: () => 'mock-id',
        get: () => mockUserDOInstance,
      },
    };

    // 1. Cihaz B init çağırır
    const initRes = await app.request('/api/auth/link/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tempPublicKeyHex: 'b'.repeat(64),
        deviceInfo: 'Cihaz B (Laptop)',
      }),
    }, mockEnv as unknown as Parameters<typeof app.request>[2]);

    expect(initRes.status).toBe(200);
    const initData = (await initRes.json()) as { sessionId: string; linkCode: string };
    expect(initData.sessionId).toBe('test-session-123');
    expect(initData.linkCode).toBe('849-213');

    // 2. Cihaz A kodu girer (claim)
    const claimRes = await app.request('/api/auth/link/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        linkCode: '849-213',
        claimerDisplayName: 'Erdem (Ana PC)',
        claimerDeviceInfo: 'Windows Masaüstü',
      }),
    }, mockEnv as unknown as Parameters<typeof app.request>[2]);

    expect(claimRes.status).toBe(200);
    const claimData = (await claimRes.json()) as { sessionId: string; targetTempPublicKeyHex: string };
    expect(claimData.sessionId).toBe('test-session-123');
    expect(claimData.targetTempPublicKeyHex).toBe('b'.repeat(64));

    // 3. Cihaz A onaylar (approve)
    const approveRes = await app.request('/api/auth/link/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'test-session-123',
        claimerTempPublicKeyHex: 'a'.repeat(64),
        encryptedPayload: {
          iv: 'mock-iv',
          cipherText: 'mock-ciphertext',
        },
      }),
    }, mockEnv as unknown as Parameters<typeof app.request>[2]);

    expect(approveRes.status).toBe(200);

    // 4. Cihaz B durumu sorgular (status)
    const statusRes = await app.request('/api/auth/link/status/test-session-123', undefined, mockEnv as unknown as Parameters<typeof app.request>[2]);
    expect(statusRes.status).toBe(200);
    const statusData = (await statusRes.json()) as {
      status: string;
      encryptedPayload?: { cipherText: string };
    };
    expect(statusData.status).toBe('approved');
    expect(statusData.encryptedPayload?.cipherText).toBe('mock-ciphertext');
  });
});
