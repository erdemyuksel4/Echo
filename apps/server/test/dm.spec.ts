import { describe, it, expect } from 'vitest';
import { app } from '../src/index';
import { generateKeyPair, signMessage, deriveUserId } from '@echo/shared';

describe('Faz 5 - DM Endpoints', () => {
  it('GET /api/dm/check fails when userId is missing', async () => {
    const res = await app.request('/api/dm/check');
    expect(res.status).toBe(400);
    const body = (await res.json()) as { allowed: boolean; reason?: string };
    expect(body.allowed).toBe(false);
  });

  it('GET /ws/user rejects missing userId or pubkey', async () => {
    const res = await app.request('/ws/user');
    expect(res.status).toBe(400);
    const text = await res.text();
    expect(text).toContain('userId and pubkey required');
  });

  it('GET /ws/user rejects expired timestamp', async () => {
    const keypair = generateKeyPair();
    const userId = deriveUserId(keypair.publicKeyHex);
    const oldTs = Date.now() - 100_000;
    const sig = signMessage(`echo-auth|user|${oldTs}`, keypair.privateKey);

    const res = await app.request(
      `/ws/user?userId=${userId}&pubkey=${keypair.publicKeyHex}&ts=${oldTs}&sig=${sig}`,
    );
    expect(res.status).toBe(400);
    const text = await res.text();
    expect(text).toContain('Request expired');
  });

  it('GET /ws/user rejects invalid signature', async () => {
    const keypair = generateKeyPair();
    const userId = deriveUserId(keypair.publicKeyHex);
    const ts = Date.now();
    const wrongSig = '0'.repeat(128);

    const res = await app.request(
      `/ws/user?userId=${userId}&pubkey=${keypair.publicKeyHex}&ts=${ts}&sig=${wrongSig}`,
    );
    expect(res.status).toBe(401);
    const text = await res.text();
    expect(text).toContain('Invalid signature');
  });

  it('GET /ws/user rejects userId mismatch with pubkey', async () => {
    const keypair = generateKeyPair();
    const ts = Date.now();
    const sig = signMessage(`echo-auth|user|${ts}`, keypair.privateKey);

    const res = await app.request(
      `/ws/user?userId=WRONG_USER_ID&pubkey=${keypair.publicKeyHex}&ts=${ts}&sig=${sig}`,
    );
    expect(res.status).toBe(401);
    const text = await res.text();
    expect(text).toContain('userId mismatch');
  });
});
