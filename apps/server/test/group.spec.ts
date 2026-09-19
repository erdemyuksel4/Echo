import { describe, it, expect } from 'vitest';
import { app } from '../src/index';
import { generateKeyPair, signMessage } from '@echo/shared';

describe('Server Group Routes', () => {
  it('POST /api/groups should reject invalid signature', async () => {
    const keypair = generateKeyPair();
    const ts = Date.now();
    const wrongSig = '0'.repeat(128);

    const res = await app.request('/api/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Grubu',
        displayName: 'Erdem',
        pubkey: keypair.publicKeyHex,
        ts,
        sig: wrongSig,
      }),
    });

    expect(res.status).toBe(401);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBe('İmza doğrulanamadı');
  });

  it('POST /api/groups should reject expired timestamp', async () => {
    const keypair = generateKeyPair();
    const oldTs = Date.now() - 100_000; // 100 sec ago
    const payload = `echo-create-group|Test Grubu|${oldTs}`;
    const sig = signMessage(payload, keypair.privateKey);

    const res = await app.request('/api/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Grubu',
        displayName: 'Erdem',
        pubkey: keypair.publicKeyHex,
        ts: oldTs,
        sig,
      }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBe('İstek zaman aşımına uğramış');
  });

  it('POST /api/groups/join should reject invalid invite code format', async () => {
    const keypair = generateKeyPair();
    const ts = Date.now();
    const payload = `echo-join-group|INVALID_CODE|${ts}`;
    const sig = signMessage(payload, keypair.privateKey);

    const res = await app.request('/api/groups/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inviteCode: 'INVALID_CODE',
        displayName: 'Arkadaş',
        pubkey: keypair.publicKeyHex,
        ts,
        sig,
      }),
    });

    expect(res.status).toBe(400);
  });
});
