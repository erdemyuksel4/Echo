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
  AttachmentUploadRequestSchema,
  deriveUserId,
  verifySignature,
  DEFAULT_FALLBACK_ICE_SERVERS,
  TurnResponseSchema,
  type HealthResponse,
} from '@echo/shared';
import { GroupDO } from './durable/GroupDO';
import { UserDO } from './durable/UserDO';

export { GroupDO, UserDO };

export interface Env {
  ENVIRONMENT?: string;
  ALLOWED_CREATOR_IDS?: string;
  GIPHY_API_KEY?: string;
  CLOUDFLARE_TURN_KEY_ID?: string;
  CLOUDFLARE_TURN_API_TOKEN?: string;
  GROUP_DO: DurableObjectNamespace<GroupDO>;
  USER_DO: DurableObjectNamespace<UserDO>;
}

export const app = new Hono<{ Bindings: Env }>();

app.use('*', cors());

// Root landing page
app.get('/', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="tr">
      <head>
        <title>Echo Server — Aktif</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * { box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 1rem; }
          .card { background: #1e293b; padding: 2.5rem 2rem; border-radius: 1.25rem; box-shadow: 0 20px 35px -10px rgba(0,0,0,0.6); text-align: center; max-width: 440px; width: 100%; border: 1px solid #334155; }
          .badge { display: inline-flex; align-items: center; gap: 0.5rem; background: rgba(16, 185, 129, 0.15); color: #34d399; font-weight: 600; font-size: 0.875rem; padding: 0.35rem 0.85rem; border-radius: 9999px; margin-bottom: 1.25rem; border: 1px solid rgba(16, 185, 129, 0.3); }
          .dot { width: 8px; height: 8px; border-radius: 50%; background: #10b981; }
          h1 { color: #818cf8; margin: 0 0 0.75rem 0; font-size: 1.75rem; }
          p { color: #94a3b8; line-height: 1.6; margin: 0 0 1rem 0; font-size: 0.95rem; }
          .meta { font-size: 0.8rem; color: #64748b; margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid #334155; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="badge"><span class="dot"></span> Sunucu Aktif ve Çalışıyor</div>
          <h1>Echo Server</h1>
          <p>Echo arka plan sunucusu Cloudflare Workers & Durable Objects üzerinde başarıyla devrede.</p>
          <div class="meta">Echo v0.1.0 • Cloudflare Workers (Free) • Durum: OK</div>
        </div>
      </body>
    </html>
  `);
});

// WebRTC ICE / TURN configuration
app.get('/api/turn', async (c) => {
  const turnKeyId = c.env?.CLOUDFLARE_TURN_KEY_ID;
  const turnApiToken = c.env?.CLOUDFLARE_TURN_API_TOKEN;

  // 1. If Cloudflare Calls TURN credentials are set in secrets, generate ephemeral credentials
  if (turnKeyId && turnApiToken) {
    try {
      const cfRes = await fetch(
        `https://rtc.live.cloudflare.com/v1/turn/keys/${turnKeyId}/credentials/generate-ice-servers`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${turnApiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ttl: 86400 }),
        },
      );

      if (cfRes.ok) {
        const raw = await cfRes.json();
        const parsed = TurnResponseSchema.safeParse(raw);
        if (parsed.success && parsed.data.iceServers.length > 0) {
          return c.json(parsed.data);
        }
      } else {
        console.error('Cloudflare Calls TURN credentials generation error:', cfRes.status, await cfRes.text());
      }
    } catch (err) {
      console.error('Error fetching Cloudflare Calls TURN credentials:', err);
    }
  }

  // 2. High-reliability fallback: Cloudflare STUN, Google STUN, OpenRelay Metered TURN
  return c.json({
    iceServers: DEFAULT_FALLBACK_ICE_SERVERS,
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
    return c.json({ error: errData.error ?? 'Grup silinemedi' }, delRes.status as 400 | 403 | 404);
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

// Get active invite code for group
app.get('/api/groups/:id/invite', async (c) => {
  const groupId = c.req.param('id');
  if (!groupId) {
    return c.json({ error: 'Grup ID zorunludur' }, 400);
  }

  const groupDoId = c.env.GROUP_DO.idFromName(groupId.toLowerCase());
  const groupStub = c.env.GROUP_DO.get(groupDoId);
  const snapRes = await groupStub.fetch('http://do/internal/snapshot');
  if (!snapRes.ok) {
    return c.json({ error: 'Grup bulunamadı' }, 404);
  }
  const snapshot = (await snapRes.json()) as { inviteCode?: string };
  return c.json({ inviteCode: snapshot.inviteCode ?? `ECHO-${groupId.toLowerCase()}` });
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

// Attachment upload
app.post('/api/groups/:id/attachments', async (c) => {
  const groupId = c.req.param('id');
  if (!groupId) {
    return c.json({ error: 'Grup ID zorunludur' }, 400);
  }

  const rawBody = await c.req.json();
  const parse = AttachmentUploadRequestSchema.safeParse(rawBody);
  if (!parse.success) {
    return c.json({ error: 'Geçersiz ek verisi' }, 400);
  }

  const groupDoId = c.env.GROUP_DO.idFromName(groupId.toLowerCase());
  const groupStub = c.env.GROUP_DO.get(groupDoId);

  const res = await groupStub.fetch('http://do/internal/attachments/upload', {
    method: 'POST',
    body: JSON.stringify(parse.data),
  });

  const data = (await res.json()) as unknown;
  return c.json(data, res.status as 200 | 400 | 500);
});

// Attachment download / binary streaming
app.get('/api/groups/:id/attachments/:attachmentId', async (c) => {
  const groupId = c.req.param('id');
  const attachmentId = c.req.param('attachmentId');
  if (!groupId || !attachmentId) {
    return c.text('Group ID and Attachment ID are required', 400);
  }

  const groupDoId = c.env.GROUP_DO.idFromName(groupId.toLowerCase());
  const groupStub = c.env.GROUP_DO.get(groupDoId);

  return groupStub.fetch(`http://do/internal/attachments/${attachmentId}`);
});

// Giphy Search Proxy
app.get('/api/giphy/search', async (c) => {
  const q = c.req.query('q')?.trim() || '';
  const limit = Math.min(parseInt(c.req.query('limit') || '25', 10), 50);
  const offset = parseInt(c.req.query('offset') || '0', 10);
  const apiKey = c.env?.GIPHY_API_KEY || 'dc6zaTOxFJmzC';

  try {
    const endpoint = q
      ? `https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${encodeURIComponent(q)}&limit=${limit}&offset=${offset}&rating=g&lang=tr`
      : `https://api.giphy.com/v1/gifs/trending?api_key=${apiKey}&limit=${limit}&offset=${offset}&rating=g`;

    const res = await fetch(endpoint);
    if (!res.ok) {
      return c.json({ results: [] });
    }

    const data = (await res.json()) as {
      data?: Array<{
        id: string;
        title: string;
        images?: {
          original?: { url?: string; width?: string; height?: string };
          fixed_width?: { url?: string; width?: string; height?: string };
        };
      }>;
    };

    const results = (data.data || [])
      .map((item) => {
        const original = item.images?.original;
        const fixed = item.images?.fixed_width;
        if (!original?.url) return null;
        return {
          id: item.id,
          title: item.title || 'GIF',
          url: original.url,
          previewUrl: fixed?.url || original.url,
          width: parseInt(original.width || '300', 10) || 300,
          height: parseInt(original.height || '200', 10) || 200,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    return c.json({ results });
  } catch (err) {
    console.warn('Giphy search error:', err);
    return c.json({ results: [] });
  }
});

// ── DM: Helper — check common group membership ───────────────────────────────

async function hasCommonGroup(env: Env, userIdA: string, userIdB: string): Promise<boolean> {
  try {
    const [stubA, stubB] = [
      env.USER_DO.get(env.USER_DO.idFromName(userIdA)),
      env.USER_DO.get(env.USER_DO.idFromName(userIdB)),
    ];
    const [resA, resB] = await Promise.all([
      stubA.fetch('http://do/internal/memberships'),
      stubB.fetch('http://do/internal/memberships'),
    ]);
    const memA = (await resA.json()) as { group_id: string }[];
    const memB = (await resB.json()) as { group_id: string }[];
    const setA = new Set(memA.map((m) => m.group_id));
    return memB.some((m) => setA.has(m.group_id));
  } catch {
    return false;
  }
}

// ── DM: User WebSocket endpoint ──────────────────────────────────────────────
// Auth: same signed header as group WS. Tags: [userId, displayName, color]

app.get('/ws/user', async (c) => {
  const userId = c.req.query('userId');
  const pubkey = c.req.query('pubkey');
  const ts = parseInt(c.req.query('ts') ?? '0', 10);
  const sig = c.req.query('sig') ?? '';
  const displayName = c.req.query('displayName') ?? 'Bilinmiyor';
  const color = c.req.query('color') ?? '#6366f1';

  if (!userId || !pubkey) {
    return c.text('userId and pubkey required', 400);
  }

  if (Math.abs(Date.now() - ts) > 60_000) {
    return c.text('Request expired', 400);
  }

  const derivedId = deriveUserId(pubkey);
  if (derivedId !== userId) {
    return c.text('userId mismatch', 401);
  }

  const payload = `echo-auth|user|${ts}`;
  if (!verifySignature(payload, sig, pubkey)) {
    return c.text('Invalid signature', 401);
  }

  const userDoId = c.env.USER_DO.idFromName(userId);
  const userStub = c.env.USER_DO.get(userDoId);

  // Build URL for UserDO WebSocket with user tags in query string
  const doUrl = new URL(c.req.url);
  doUrl.pathname = '/internal/ws';
  doUrl.search = `?userId=${encodeURIComponent(userId)}&displayName=${encodeURIComponent(displayName)}&color=${encodeURIComponent(color)}`;

  return userStub.fetch(new Request(doUrl.toString(), c.req.raw));
});

// ── DM: Get thread list ──────────────────────────────────────────────────────

app.get('/api/users/:userId/dm-threads', async (c) => {
  const userId = c.req.param('userId');
  const userDoId = c.env.USER_DO.idFromName(userId);
  const userStub = c.env.USER_DO.get(userDoId);
  const res = await userStub.fetch('http://do/internal/dm/threads');
  const threads = await res.json();
  return c.json(threads);
});

// ── DM: Check if DM is allowed (common group check) ─────────────────────────

app.get('/api/dm/check', async (c) => {
  const userIdA = c.req.query('userIdA') ?? '';
  const userIdB = c.req.query('userIdB') ?? '';
  if (!userIdA || !userIdB) {
    return c.json({ allowed: false, reason: 'Missing userId' }, 400);
  }
  const allowed = await hasCommonGroup(c.env, userIdA, userIdB);
  return c.json({ allowed });
});

export default app;
