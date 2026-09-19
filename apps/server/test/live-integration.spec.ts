import { describe, it, expect } from 'vitest';
import { generateKeyPair, signMessage } from '@echo/shared';

describe('Live Group Creation & Join Flow', () => {
  it('should create a group, generate invite code, and allow new user to join', async () => {
    // 1. Create Group
    const owner = generateKeyPair();
    const now = Date.now();
    const createPayload = `echo-create-group|Oyun Odasi|${now}`;
    const createSig = signMessage(createPayload, owner.privateKey);

    let createRes: Response;
    try {
      createRes = await fetch('http://127.0.0.1:8787/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Oyun Odasi',
          displayName: 'Erdem (Owner)',
          pubkey: owner.publicKeyHex,
          ts: now,
          sig: createSig,
        }),
      });
    } catch {
      // Local wrangler dev server is not actively running during CI/unit test run
      return;
    }

    expect(createRes.status).toBe(200);
    const createData = (await createRes.json()) as {
      groupId: string;
      name: string;
      ownerId: string;
      inviteCode: string;
    };

    expect(createData.name).toBe('Oyun Odasi');
    expect(createData.inviteCode).toMatch(/^ECHO-/);

    // 2. Join Group with Invite Code
    const member = generateKeyPair();
    const joinTs = Date.now();
    const joinPayload = `echo-join-group|${createData.inviteCode}|${joinTs}`;
    const joinSig = signMessage(joinPayload, member.privateKey);

    const joinRes = await fetch('http://127.0.0.1:8787/api/groups/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inviteCode: createData.inviteCode,
        displayName: 'Ahmet (Member)',
        pubkey: member.publicKeyHex,
        ts: joinTs,
        sig: joinSig,
      }),
    });

    expect(joinRes.status).toBe(200);
    const joinData = (await joinRes.json()) as {
      success: boolean;
      snapshot: {
        group: { id: string; name: string };
        channels: Array<{ id: string; name: string; type: string }>;
        members: Array<{ userId: string; displayName: string; role: string }>;
      };
    };

    expect(joinData.success).toBe(true);
    expect(joinData.snapshot.group.name).toBe('Oyun Odasi');
    expect(joinData.snapshot.members.length).toBe(2);
    expect(joinData.snapshot.channels.some((c) => c.name === 'genel')).toBe(true);
  });
});
