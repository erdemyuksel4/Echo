import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { ulid } from 'ulidx';
import {
  APP_NAME,
  PROTOCOL_VERSION,
  HealthResponseSchema,
  CreateGroupRequestSchema,
  JoinGroupRequestSchema,
  DeleteGroupRequestSchema,
  LeaveGroupRequestSchema,
  deriveUserId,
  verifySignature,
  type HealthResponse,
} from '@echo/shared';
import { GroupDO } from './durable/GroupDO';
import { UserDO } from './durable/UserDO';

export { GroupDO, UserDO };

export interface Env {
  ENVIRONMENT?: string;
  ALLOWED_CREATOR_IDS?: string;
  GROUP_DO: DurableObjectNamespace<GroupDO>;
  USER_DO: DurableObjectNamespace<UserDO>;
}

export const app = new Hono<{ Bindings: Env }>();

app.use('*', cors());

// Health Check
app.get('/api/turn', (c) => {
  return c.json({
    iceServers: [
      { urls: 'stun:stun.cloudflare.com:3478' },
      { urls: 'stun:stun.l.google.com:19302' },
    ],
  });
});

app.get('/api/health', (c) => {
  const healthData: HealthResponse = {
    status: 'ok',
    app: APP_NAME,
    version: '0.1.0',
    protocolVersion: PROTOCOL_VERSION,
    timestamp: Date.now(),
  };

  const parsed = HealthResponseSchema.parse(healthData);
  return c.json(parsed);
});

// Create Group
app.post('/api/groups', async (c) => {
  const rawBody = await c.req.json();
  const parse = CreateGroupRequestSchema.safeParse(rawBody);
  if (!parse.success) {
    return c.json({ error: 'Geçersiz grup oluşturma parametreleri' }, 400);
  }

  const { name, displayName, pubkey, ts, sig } = parse.data;

  // 1. Timestamp check (±60s)
  const now = Date.now();
  if (Math.abs(now - ts) > 60_000) {
    return c.json({ error: 'İstek zaman aşımına uğramış' }, 400);
  }

  // 2. UserId and signature verification
  const userId = deriveUserId(pubkey);
  const payload = `echo-create-group|${name}|${ts}`;
  if (!verifySignature(payload, sig, pubkey)) {
    return c.json({ error: 'İmza doğrulanamadı' }, 401);
  }

  // 3. Creator permission check
  const allowed = c.env.ALLOWED_CREATOR_IDS?.trim();
  if (allowed && allowed.length > 0) {
    const list = allowed.split(',').map((id) => id.trim());
    if (!list.includes(userId)) {
      return c.json({ error: 'Grup oluşturma yetkiniz bulunmuyor' }, 403);
    }
  }

  // 4. Generate unique Group ID and initialize GroupDO
  const groupId = ulid().toLowerCase();
  const groupDoId = c.env.GROUP_DO.idFromName(groupId);
  const groupStub = c.env.GROUP_DO.get(groupDoId);

  const initRes = await groupStub.fetch('http://do/internal/init', {
    method: 'POST',
    body: JSON.stringify({
      groupId,
      name,
      ownerId: userId,
      ownerPubkey: pubkey,
      ownerDisplayName: displayName,
    }),
  });

  const initData = (await initRes.json()) as { defaultInviteCode: string };

  // 5. Add membership to owner's UserDO
  try {
    const userDoId = c.env.USER_DO.idFromName(userId);
    const userStub = c.env.USER_DO.get(userDoId);
    await userStub.fetch('http://do/internal/add-membership', {
      method: 'POST',
      body: JSON.stringify({ groupId, groupName: name }),
    });
  } catch (err) {
    console.warn('Failed to register membership in UserDO:', err);
  }

  return c.json({
    groupId,
    name,
    ownerId: userId,
    inviteCode: initData.defaultInviteCode,
  });
});

// Join Group via Invite
app.post('/api/groups/join', async (c) => {
  const rawBody = await c.req.json();
  const parse = JoinGroupRequestSchema.safeParse(rawBody);
  if (!parse.success) {
    return c.json({ error: 'Geçersiz davet katılım parametreleri' }, 400);
  }

  const { inviteCode, displayName, pubkey, ts, sig } = parse.data;

  // 1. Timestamp check
  const now = Date.now();
  if (Math.abs(now - ts) > 60_000) {
    return c.json({ error: 'İstek zaman aşımına uğramış' }, 400);
  }

  // 2. UserId and signature verification
  const userId = deriveUserId(pubkey);
  const payload = `echo-join-group|${inviteCode}|${ts}`;
  if (!verifySignature(payload, sig, pubkey)) {
    return c.json({ error: 'İmza doğrulanamadı' }, 401);
  }

  // 3. Extract groupId from invite code format: ECHO-<groupIdPrefix>-<suffix>
  // or pass directly to GroupDO. The invite code starts with ECHO-<groupId>-
  const parts = inviteCode.split('-');
  if (parts.length < 3 || parts[0] !== 'ECHO') {
    return c.json({ error: 'Geçersiz davet kodu biçimi' }, 400);
  }

  const groupIdPrefix = parts[1];
  if (!groupIdPrefix) {
    return c.json({ error: 'Geçersiz davet kodu' }, 400);
  }

  // If prefix was partial or full, find GroupDO id
  const groupDoId = c.env.GROUP_DO.idFromName(groupIdPrefix.toLowerCase());
  const groupStub = c.env.GROUP_DO.get(groupDoId);

  const joinRes = await groupStub.fetch('http://do/internal/join', {
    method: 'POST',
    body: JSON.stringify({
      inviteCode,
      userId,
      displayName,
      pubkey,
    }),
  });

  if (!joinRes.ok) {
    const errData = (await joinRes.json()) as { error?: string };
    return c.json({ error: errData.error ?? 'Katılma başarısız' }, 400);
  }

  const joinData = (await joinRes.json()) as { snapshot: { group: { id: string; name: string } } };

  // Add membership to UserDO
  try {
    const userDoId = c.env.USER_DO.idFromName(userId);
    const userStub = c.env.USER_DO.get(userDoId);
    await userStub.fetch('http://do/internal/add-membership', {
      method: 'POST',
      body: JSON.stringify({
        groupId: joinData.snapshot.group.id,
        groupName: joinData.snapshot.group.name,
      }),
    });
  } catch (err) {
    console.warn('Failed to register membership in UserDO:', err);
  }

  return c.json(joinData);
});

// Delete group (Owner only)
app.delete('/api/groups/:id', async (c) => {
  const groupId = c.req.param('id');
  if (!groupId) {
    return c.json({ error: 'Grup ID zorunludur' }, 400);
  }

  let body: { sig: string; pubkey: string; ts: number };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Geçersiz JSON gövdesi' }, 400);
  }

  const parseResult = DeleteGroupRequestSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json({ error: 'Geçersiz istek parametreleri' }, 400);
  }

  const { sig, pubkey, ts } = parseResult.data;

  // Check timestamp freshness (+/- 60 sec)
  if (Math.abs(Date.now() - ts) > 60_000) {
    return c.json({ error: 'İstek zaman aşımına uğramış' }, 400);
  }

  // Verify signature: echo-delete-group|<groupId>|<ts>
  const payload = `echo-delete-group|${groupId}|${ts}`;
  if (!verifySignature(payload, sig, pubkey)) {
    return c.json({ error: 'İmza doğrulanamadı' }, 401);
  }

  const userId = deriveUserId(pubkey);
  const groupDoId = c.env.GROUP_DO.idFromName(groupId.toLowerCase());
  const groupStub = c.env.GROUP_DO.get(groupDoId);

  const delRes = await groupStub.fetch('http://do/internal/delete', {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });

  if (!delRes.ok) {
    const errData = (await delRes.json()) as { error?: string };
    return c.json(
      { error: errData.error ?? 'Grup silinemedi' },
      delRes.status as 400 | 403 | 404,
    );
  }

  const delData = (await delRes.json()) as { success: boolean; memberUserIds?: string[] };

  // Remove membership from UserDO for all members
  if (delData.memberUserIds && Array.isArray(delData.memberUserIds)) {
    for (const memberId of delData.memberUserIds) {
      try {
        const uId = c.env.USER_DO.idFromName(memberId);
        const uStub = c.env.USER_DO.get(uId);
        await uStub.fetch('http://do/internal/remove-membership', {
          method: 'POST',
          body: JSON.stringify({ groupId }),
        });
      } catch (err) {
        console.warn('Failed to remove membership from UserDO:', err);
      }
    }
  }

  return c.json({ success: true, groupId });
});

// Leave group (Non-owner member)
app.post('/api/groups/:id/leave', async (c) => {
  const groupId = c.req.param('id');
  if (!groupId) {
    return c.json({ error: 'Grup ID zorunludur' }, 400);
  }

  let body: { sig: string; pubkey: string; ts: number };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Geçersiz JSON gövdesi' }, 400);
  }

  const parseResult = LeaveGroupRequestSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json({ error: 'Geçersiz istek parametreleri' }, 400);
  }

  const { sig, pubkey, ts } = parseResult.data;

  // Check timestamp freshness (+/- 60 sec)
  if (Math.abs(Date.now() - ts) > 60_000) {
    return c.json({ error: 'İstek zaman aşımına uğramış' }, 400);
  }

  // Verify signature: echo-leave-group|<groupId>|<ts>
  const payload = `echo-leave-group|${groupId}|${ts}`;
  if (!verifySignature(payload, sig, pubkey)) {
    return c.json({ error: 'İmza doğrulanamadı' }, 401);
  }

  const userId = deriveUserId(pubkey);
  const groupDoId = c.env.GROUP_DO.idFromName(groupId.toLowerCase());
  const groupStub = c.env.GROUP_DO.get(groupDoId);

  const leaveRes = await groupStub.fetch('http://do/internal/leave', {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });

  if (!leaveRes.ok) {
    const errData = (await leaveRes.json()) as { error?: string };
    return c.json(
      { error: errData.error ?? 'Gruptan ayrılamadı' },
      leaveRes.status as 400 | 403 | 404,
    );
  }

  // Remove membership from UserDO for this user
  try {
    const uId = c.env.USER_DO.idFromName(userId);
    const uStub = c.env.USER_DO.get(uId);
    await uStub.fetch('http://do/internal/remove-membership', {
      method: 'POST',
      body: JSON.stringify({ groupId }),
    });
  } catch (err) {
    console.warn('Failed to remove membership from UserDO:', err);
  }

  return c.json({ success: true, groupId });
});

// User memberships
app.get('/api/users/:userId/groups', async (c) => {
  const userId = c.req.param('userId');
  const userDoId = c.env.USER_DO.idFromName(userId);
  const userStub = c.env.USER_DO.get(userDoId);
  const res = await userStub.fetch('http://do/internal/memberships');
  const memberships = (await res.json()) as { group_id: string; group_name: string }[];
  return c.json(
    memberships.map((m) => ({
      id: m.group_id,
      name: m.group_name,
    })),
  );
});

// Group WebSocket endpoint
app.get('/ws/group/:id', async (c) => {
  const groupId = c.req.param('id');
  if (!groupId) {
    return c.text('Group ID required', 400);
  }

  const groupDoId = c.env.GROUP_DO.idFromName(groupId.toLowerCase());
  const groupStub = c.env.GROUP_DO.get(groupDoId);

  const doUrl = new URL(c.req.url);
  doUrl.pathname = '/websocket';

  return groupStub.fetch(new Request(doUrl.toString(), c.req.raw));
});

export default app;
