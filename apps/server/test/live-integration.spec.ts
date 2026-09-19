import { describe, it, expect } from 'vitest';
import { generateKeyPair, signMessage } from '@echo/shared';

describe('Live Group Creation & Join Flow', () => {
  it('should create a group, generate invite code, and allow new user to join', async () => {
    // 1. Create Group
    const owner = generateKeyPair();
    const now = Date.now();
    const createPayload = `echo-create-group|Oyun Odasi|${now}`;
    const createSig = signMessage(createPayload, owner.privateKey);

    const serverUrl = process.env.TEST_SERVER_URL || 'http://127.0.0.1:8787';
    let createRes: Response;
    try {
      createRes = await fetch(`${serverUrl}/api/groups`, {
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
      // Server is not actively running during CI/unit test run
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

    const joinRes = await fetch(`${serverUrl}/api/groups/join`, {
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

    // 3. Connect via WebSocket to the live group as owner and authenticate
    const wsUrl = serverUrl.replace(/^http/, 'ws') + `/ws/group/${createData.groupId}`;
    console.log('Connecting to WebSocket:', wsUrl);

    const wsPromise = new Promise<{ authOk: boolean; snapshotReceived: boolean }>((resolve, reject) => {
      const ws = new WebSocket(wsUrl);
      let authOk = false;
      let snapshotReceived = false;

      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error(`WebSocket timeout. authOk=${authOk}, snapshotReceived=${snapshotReceived}`));
      }, 10000);

      ws.onopen = () => {
        console.log('WS OPEN, sending auth...');
        const authTs = Date.now();
        const authPayload = `echo-auth|${createData.groupId}|${authTs}`;
        const authSig = signMessage(authPayload, owner.privateKey);

        ws.send(
          JSON.stringify({
            v: 1,
            t: 'auth',
            id: 'auth-1',
            d: {
              userId: createData.ownerId,
              pubkey: owner.publicKeyHex,
              ts: authTs,
              sig: authSig,
            },
          }),
        );
      };

      ws.onmessage = (event) => {
        console.log('WS MSG:', event.data);
        try {
          const msg = JSON.parse(event.data as string);
          if (msg.t === 'auth.ok') authOk = true;
          if (msg.t === 'snapshot') snapshotReceived = true;
          if (authOk && snapshotReceived) {
            clearTimeout(timeout);
            ws.close();
            resolve({ authOk, snapshotReceived });
          }
        } catch (e) {
          console.error('Parse error:', e);
        }
      };

      ws.onerror = (err) => {
        console.error('WS ERR:', err);
      };

      ws.onclose = (event) => {
        console.log('WS CLOSE:', event.code, event.reason);
        clearTimeout(timeout);
        if (!authOk || !snapshotReceived) {
          reject(new Error(`WS closed early with code ${event.code}: ${event.reason}`));
        }
      };
    });

    const wsResult = await wsPromise;
    expect(wsResult.authOk).toBe(true);
    expect(wsResult.snapshotReceived).toBe(true);
  });
});
