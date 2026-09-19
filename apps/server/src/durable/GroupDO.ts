import { DurableObject } from 'cloudflare:workers';
import { ulid } from 'ulidx';
import {
  sha256,
  bytesToHex,
  verifySignature,
  buildAuthPayload,
  deriveUserId,
  WsEnvelope,
  WsClientEvents,
  WsServerEvents,
  AuthPayloadSchema,
  ClientMsgSendPayloadSchema,
  ClientChannelCreatePayloadSchema,
  ClientChannelRenamePayloadSchema,
  ClientChannelDeletePayloadSchema,
  ClientHistoryFetchPayloadSchema,
  ClientTypingPayloadSchema,
  type GroupSnapshot,
  type Channel,
  type GroupMember,
  type Message,
} from '@echo/shared';
import type { Env } from '../index';

interface WsSessionAttachment {
  userId: string;
  displayName: string;
  role: 'owner' | 'admin' | 'member';
  authenticated: boolean;
  lastMessageTime: number;
  messageCountWindow: number;
}

interface SqlChannelRow {
  id: string;
  name: string;
  type: 'text' | 'voice';
  position: number;
  created_at: number;
}

interface SqlMemberRow {
  user_id: string;
  display_name: string;
  pubkey: string;
  role: 'owner' | 'admin' | 'member';
  joined_at: number;
  banned: number;
}

interface SqlMessageRow {
  id: string;
  channel_id: string;
  author_id: string;
  author_name: string;
  content: string;
  reply_to: string | null;
  created_at: number;
  edited_at: number | null;
  deleted: number;
}

export class GroupDO extends DurableObject<Env> {
  private sql: SqlStorage;
  private typingMap: Map<string, number> = new Map(); // userId -> lastTypingTimestamp

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sql = this.ctx.storage.sql;
    this.initDatabase();

    // Auto respond to 'ping' with 'pong'
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  private initDatabase(): void {
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS group_meta (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        owner_id TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS members (
        user_id TEXT PRIMARY KEY,
        display_name TEXT NOT NULL,
        pubkey TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('owner', 'admin', 'member')),
        joined_at INTEGER NOT NULL,
        banned INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS channels (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('text', 'voice')),
        position INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        channel_id TEXT NOT NULL,
        author_id TEXT NOT NULL,
        author_name TEXT NOT NULL,
        content TEXT NOT NULL,
        reply_to TEXT,
        created_at INTEGER NOT NULL,
        edited_at INTEGER,
        deleted INTEGER NOT NULL DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_messages_chan_id ON messages (channel_id, id);

      CREATE TABLE IF NOT EXISTS invites (
        code TEXT PRIMARY KEY,
        secret_hash TEXT NOT NULL,
        created_by TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER,
        max_uses INTEGER,
        uses INTEGER NOT NULL DEFAULT 0,
        revoked INTEGER NOT NULL DEFAULT 0
      );
    `);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/websocket') {
      if (request.headers.get('Upgrade') !== 'websocket') {
        return new Response('Expected Upgrade: websocket', { status: 426 });
      }

      const webSocketPair = new WebSocketPair();
      const client = webSocketPair[0];
      const server = webSocketPair[1];

      // Hibernate websocket
      this.ctx.acceptWebSocket(server);

      // Attach unauthenticated session
      const attachment: WsSessionAttachment = {
        userId: '',
        displayName: '',
        role: 'member',
        authenticated: false,
        lastMessageTime: Date.now(),
        messageCountWindow: 0,
      };
      server.serializeAttachment(attachment);

      return new Response(null, { status: 101, webSocket: client });
    }

    if (url.pathname === '/internal/init' && request.method === 'POST') {
      const body = (await request.json()) as {
        groupId: string;
        name: string;
        ownerId: string;
        ownerPubkey: string;
        ownerDisplayName: string;
      };

      const now = Date.now();
      this.sql.exec(
        `INSERT OR REPLACE INTO group_meta (id, name, created_at, owner_id) VALUES (?, ?, ?, ?)`,
        body.groupId,
        body.name,
        now,
        body.ownerId,
      );

      this.sql.exec(
        `INSERT OR REPLACE INTO members (user_id, display_name, pubkey, role, joined_at, banned) VALUES (?, ?, ?, 'owner', ?, 0)`,
        body.ownerId,
        body.ownerDisplayName,
        body.ownerPubkey,
        now,
      );

      // Default #genel text channel
      const chanId = ulid();
      this.sql.exec(
        `INSERT INTO channels (id, name, type, position, created_at) VALUES (?, 'genel', 'text', 0, ?)`,
        chanId,
        now,
      );

      // Create default permanent invite
      const inviteCode = `ECHO-${body.groupId.toLowerCase()}-${ulid().substring(0, 6)}`;
      const secretHash = bytesToHex(sha256(new TextEncoder().encode(inviteCode)));
      this.sql.exec(
        `INSERT INTO invites (code, secret_hash, created_by, created_at, uses) VALUES (?, ?, ?, ?, 0)`,
        inviteCode,
        secretHash,
        body.ownerId,
        now,
      );

      return Response.json({ success: true, groupId: body.groupId, defaultInviteCode: inviteCode });
    }

    if (url.pathname === '/internal/join' && request.method === 'POST') {
      const body = (await request.json()) as {
        inviteCode: string;
        userId: string;
        displayName: string;
        pubkey: string;
      };

      // Verify invite
      const inviteCursor = this.sql.exec(
        `SELECT * FROM invites WHERE code = ? AND revoked = 0`,
        body.inviteCode,
      );
      const inviteRows = [...inviteCursor];
      if (inviteRows.length === 0) {
        return Response.json({ error: 'Geçersiz veya süresi dolmuş davet kodu' }, { status: 400 });
      }

      const invite = inviteRows[0] as { max_uses: number | null; uses: number };
      if (invite.max_uses && invite.uses >= invite.max_uses) {
        return Response.json({ error: 'Davet kodunun kullanım limiti dolmuş' }, { status: 400 });
      }

      const now = Date.now();
      // Add or update member
      this.sql.exec(
        `INSERT OR IGNORE INTO members (user_id, display_name, pubkey, role, joined_at, banned) VALUES (?, ?, ?, 'member', ?, 0)`,
        body.userId,
        body.displayName,
        body.pubkey,
        now,
      );

      this.sql.exec(`UPDATE invites SET uses = uses + 1 WHERE code = ?`, body.inviteCode);

      const snapshot = this.getGroupSnapshot();
      return Response.json({ success: true, snapshot });
    }

    if (url.pathname === '/internal/snapshot' && request.method === 'GET') {
      return Response.json(this.getGroupSnapshot());
    }

    return new Response('Not Found', { status: 404 });
  }

  private getGroupSnapshot(): GroupSnapshot {
    const metaRows = [...this.sql.exec(`SELECT * FROM group_meta LIMIT 1`)];
    const meta = metaRows[0] as
      { id: string; name: string; created_at: number; owner_id: string } | undefined;

    const groupMeta = meta
      ? {
          id: meta.id,
          name: meta.name,
          createdAt: meta.created_at,
          ownerId: meta.owner_id,
        }
      : {
          id: 'unknown',
          name: 'Echo Group',
          createdAt: Date.now(),
          ownerId: '',
        };

    const channelsCursor = this.sql.exec(
      `SELECT * FROM channels ORDER BY position ASC, created_at ASC`,
    );
    const channels: Channel[] = ([...channelsCursor] as unknown as SqlChannelRow[]).map((r) => ({
      id: r.id,
      groupId: groupMeta.id,
      name: r.name,
      type: r.type,
      position: r.position,
      createdAt: r.created_at,
    }));

    const membersCursor = this.sql.exec(`SELECT * FROM members WHERE banned = 0`);
    const onlineUserIds = new Set(
      this.ctx
        .getWebSockets()
        .map((ws) => (ws.deserializeAttachment() as WsSessionAttachment)?.userId),
    );

    const members: GroupMember[] = ([...membersCursor] as unknown as SqlMemberRow[]).map((r) => ({
      userId: r.user_id,
      displayName: r.display_name,
      pubkey: r.pubkey,
      role: r.role,
      joinedAt: r.joined_at,
      banned: Boolean(r.banned),
      status: onlineUserIds.has(r.user_id) ? 'online' : 'offline',
    }));

    return {
      group: groupMeta,
      channels,
      members,
    };
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== 'string') return;

    let envelope: WsEnvelope;
    try {
      envelope = JSON.parse(message);
    } catch {
      this.sendError(ws, 'INVALID_JSON', 'Geçersiz mesaj formatı');
      return;
    }

    const session = ws.deserializeAttachment() as WsSessionAttachment | null;
    if (!session) {
      ws.close(1008, 'Session missing');
      return;
    }

    // 1. Unauthenticated handling
    if (!session.authenticated) {
      if (envelope.t !== WsClientEvents.AUTH) {
        this.sendError(ws, 'UNAUTHORIZED', 'Lütfen önce kimlik doğrulaması yapın');
        ws.close(4001, 'Unauthorized');
        return;
      }

      await this.handleAuth(ws, session, envelope);
      return;
    }

    // 2. Rate limiting check (5 msg per sec token bucket)
    const now = Date.now();
    if (now - session.lastMessageTime < 1000) {
      session.messageCountWindow++;
      if (session.messageCountWindow > 5) {
        this.sendRateLimited(ws, 1000);
        return;
      }
    } else {
      session.lastMessageTime = now;
      session.messageCountWindow = 1;
    }
    ws.serializeAttachment(session);

    // 3. Event routing
    switch (envelope.t) {
      case WsClientEvents.MSG_SEND:
        this.handleMessageSend(ws, session, envelope);
        break;
      case WsClientEvents.HISTORY_FETCH:
        this.handleHistoryFetch(ws, envelope);
        break;
      case WsClientEvents.TYPING:
        this.handleTyping(session, envelope);
        break;
      case WsClientEvents.CHANNEL_CREATE:
        this.handleChannelCreate(ws, session, envelope);
        break;
      case WsClientEvents.CHANNEL_RENAME:
        this.handleChannelRename(ws, session, envelope);
        break;
      case WsClientEvents.CHANNEL_DELETE:
        this.handleChannelDelete(ws, session, envelope);
        break;
      default:
        this.sendError(ws, 'UNKNOWN_EVENT', `Bilinmeyen olay: ${envelope.t}`);
        break;
    }
  }

  private async handleAuth(
    ws: WebSocket,
    session: WsSessionAttachment,
    envelope: WsEnvelope,
  ): Promise<void> {
    const parseRes = AuthPayloadSchema.safeParse(envelope.d);
    if (!parseRes.success) {
      this.sendError(ws, 'AUTH_FAILED', 'Kimlik bilgileri eksik veya geçersiz');
      ws.close(4001, 'Auth schema error');
      return;
    }

    const { userId, pubkey, ts, sig } = parseRes.data;

    // Time window check: ±60 seconds
    const now = Date.now();
    if (Math.abs(now - ts) > 60_000) {
      this.sendError(ws, 'AUTH_FAILED', 'İstek zaman aşımına uğramış (zaman damgası farkı > 60sn)');
      ws.close(4001, 'Timestamp skew');
      return;
    }

    // Validate userId derivation from pubkey
    const derived = deriveUserId(pubkey);
    if (derived !== userId) {
      this.sendError(ws, 'AUTH_FAILED', 'Kullanıcı kimliği açık anahtarla eşleşmiyor');
      ws.close(4001, 'UserId mismatch');
      return;
    }

    // Verify Ed25519 signature
    const metaRows = [...this.sql.exec(`SELECT id FROM group_meta LIMIT 1`)];
    const groupId = (metaRows[0] as { id: string } | undefined)?.id ?? '';
    const payload = buildAuthPayload(groupId, ts);

    const isSigValid = verifySignature(payload, sig, pubkey);
    if (!isSigValid) {
      this.sendError(ws, 'AUTH_FAILED', 'İmza doğrulanamadı');
      ws.close(4001, 'Invalid signature');
      return;
    }

    // Check membership in SQLite
    const memberRows = [
      ...this.sql.exec(`SELECT * FROM members WHERE user_id = ? AND banned = 0`, userId),
    ];
    if (memberRows.length === 0) {
      this.sendError(ws, 'NOT_A_MEMBER', 'Bu grubun üyesi değilsiniz');
      ws.close(4003, 'Not a member');
      return;
    }

    const member = memberRows[0] as { display_name: string; role: 'owner' | 'admin' | 'member' };

    session.userId = userId;
    session.displayName = member.display_name;
    session.role = member.role;
    session.authenticated = true;
    ws.serializeAttachment(session);

    // Send auth.ok and initial snapshot
    this.send(ws, WsServerEvents.AUTH_OK, { userId, role: member.role });
    const snapshot = this.getGroupSnapshot();
    this.send(ws, WsServerEvents.SNAPSHOT, snapshot);

    // Broadcast presence changed to online
    this.broadcast(WsServerEvents.PRESENCE_CHANGED, { userId, status: 'online' });
  }

  private handleMessageSend(
    ws: WebSocket,
    session: WsSessionAttachment,
    envelope: WsEnvelope,
  ): void {
    const parse = ClientMsgSendPayloadSchema.safeParse(envelope.d);
    if (!parse.success) {
      this.sendError(ws, 'INVALID_PAYLOAD', 'Mesaj içeriği geçersiz');
      return;
    }

    const { channelId, content, replyTo } = parse.data;

    // Check if channel exists
    const chanRows = [...this.sql.exec(`SELECT id FROM channels WHERE id = ?`, channelId)];
    if (chanRows.length === 0) {
      this.sendError(ws, 'CHANNEL_NOT_FOUND', 'Kanal bulunamadı');
      return;
    }

    const id = ulid();
    const now = Date.now();

    this.sql.exec(
      `INSERT INTO messages (id, channel_id, author_id, author_name, content, reply_to, created_at, deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
      id,
      channelId,
      session.userId,
      session.displayName,
      content,
      replyTo ?? null,
      now,
    );

    const message: Message = {
      id,
      channelId,
      authorId: session.userId,
      authorName: session.displayName,
      content,
      replyTo: replyTo ?? null,
      createdAt: now,
      editedAt: null,
      deleted: false,
    };

    // Broadcast to all connected group members with client nonce echo
    this.broadcast(WsServerEvents.MSG_NEW, message, envelope.id);
  }

  private handleHistoryFetch(ws: WebSocket, envelope: WsEnvelope): void {
    const parse = ClientHistoryFetchPayloadSchema.safeParse(envelope.d);
    if (!parse.success) {
      this.sendError(ws, 'INVALID_PAYLOAD', 'Geçmiş sorgu parametreleri hatalı');
      return;
    }

    const { channelId, before, limit } = parse.data;

    let rows: SqlMessageRow[];
    if (before) {
      rows = [
        ...this.sql.exec(
          `SELECT * FROM messages WHERE channel_id = ? AND id < ? AND deleted = 0 ORDER BY id DESC LIMIT ?`,
          channelId,
          before,
          limit + 1,
        ),
      ] as unknown as SqlMessageRow[];
    } else {
      rows = [
        ...this.sql.exec(
          `SELECT * FROM messages WHERE channel_id = ? AND deleted = 0 ORDER BY id DESC LIMIT ?`,
          channelId,
          limit + 1,
        ),
      ] as unknown as SqlMessageRow[];
    }

    const hasMore = rows.length > limit;
    const slice = hasMore ? rows.slice(0, limit) : rows;

    const messages: Message[] = slice.map((r) => ({
      id: r.id,
      channelId: r.channel_id,
      authorId: r.author_id,
      authorName: r.author_name,
      content: r.content,
      replyTo: r.reply_to,
      createdAt: r.created_at,
      editedAt: r.edited_at,
      deleted: Boolean(r.deleted),
    }));

    this.send(
      ws,
      WsServerEvents.HISTORY_DATA,
      {
        channelId,
        messages: messages.reverse(), // chronologically ascending
        hasMore,
      },
      envelope.id,
    );
  }

  private handleTyping(session: WsSessionAttachment, envelope: WsEnvelope): void {
    const parse = ClientTypingPayloadSchema.safeParse(envelope.d);
    if (!parse.success) return;

    const now = Date.now();
    const last = this.typingMap.get(session.userId) ?? 0;
    if (now - last < 3000) return; // 3 sec throttle

    this.typingMap.set(session.userId, now);

    this.broadcast(
      WsServerEvents.TYPING_USER,
      {
        channelId: parse.data.channelId,
        userId: session.userId,
        displayName: session.displayName,
      },
      undefined,
      session.userId, // do not echo back to sender
    );
  }

  private handleChannelCreate(
    ws: WebSocket,
    session: WsSessionAttachment,
    envelope: WsEnvelope,
  ): void {
    if (session.role !== 'owner' && session.role !== 'admin') {
      this.sendError(ws, 'FORBIDDEN', 'Kanal oluşturma yetkiniz yok');
      return;
    }

    const parse = ClientChannelCreatePayloadSchema.safeParse(envelope.d);
    if (!parse.success) {
      this.sendError(ws, 'INVALID_PAYLOAD', 'Kanal bilgileri geçersiz');
      return;
    }

    const id = ulid();
    const now = Date.now();
    this.sql.exec(
      `INSERT INTO channels (id, name, type, position, created_at) VALUES (?, ?, ?, 99, ?)`,
      id,
      parse.data.name,
      parse.data.type,
      now,
    );

    const metaRows = [...this.sql.exec(`SELECT id FROM group_meta LIMIT 1`)];
    const groupId = (metaRows[0] as { id: string }).id;

    const channel: Channel = {
      id,
      groupId,
      name: parse.data.name,
      type: parse.data.type,
      position: 99,
      createdAt: now,
    };

    this.broadcast(WsServerEvents.CHANNEL_CREATED, channel, envelope.id);
  }

  private handleChannelRename(
    ws: WebSocket,
    session: WsSessionAttachment,
    envelope: WsEnvelope,
  ): void {
    if (session.role !== 'owner' && session.role !== 'admin') {
      this.sendError(ws, 'FORBIDDEN', 'Kanal düzenleme yetkiniz yok');
      return;
    }

    const parse = ClientChannelRenamePayloadSchema.safeParse(envelope.d);
    if (!parse.success) return;

    this.sql.exec(
      `UPDATE channels SET name = ? WHERE id = ?`,
      parse.data.name,
      parse.data.channelId,
    );
    this.broadcast(
      WsServerEvents.CHANNEL_UPDATED,
      { channelId: parse.data.channelId, name: parse.data.name },
      envelope.id,
    );
  }

  private handleChannelDelete(
    ws: WebSocket,
    session: WsSessionAttachment,
    envelope: WsEnvelope,
  ): void {
    if (session.role !== 'owner' && session.role !== 'admin') {
      this.sendError(ws, 'FORBIDDEN', 'Kanal silme yetkiniz yok');
      return;
    }

    const parse = ClientChannelDeletePayloadSchema.safeParse(envelope.d);
    if (!parse.success) return;

    this.sql.exec(`DELETE FROM channels WHERE id = ?`, parse.data.channelId);
    this.broadcast(
      WsServerEvents.CHANNEL_DELETED,
      { channelId: parse.data.channelId },
      envelope.id,
    );
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    const session = ws.deserializeAttachment() as WsSessionAttachment | null;
    if (session?.authenticated && session.userId) {
      // Check if user has other open sockets
      const remainingSockets = this.ctx.getWebSockets().filter((s) => {
        const att = s.deserializeAttachment() as WsSessionAttachment | null;
        return att?.userId === session.userId && s !== ws;
      });

      if (remainingSockets.length === 0) {
        this.broadcast(WsServerEvents.PRESENCE_CHANGED, {
          userId: session.userId,
          status: 'offline',
        });
      }
    }
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.webSocketClose(ws);
  }

  private send(ws: WebSocket, type: string, data: unknown, id?: string): void {
    try {
      ws.send(JSON.stringify({ v: 1, t: type, id, d: data }));
    } catch {
      // socket likely closed
    }
  }

  private broadcast(type: string, data: unknown, id?: string, skipUserId?: string): void {
    const payload = JSON.stringify({ v: 1, t: type, id, d: data });
    for (const ws of this.ctx.getWebSockets()) {
      const att = ws.deserializeAttachment() as WsSessionAttachment | null;
      if (skipUserId && att?.userId === skipUserId) continue;
      try {
        ws.send(payload);
      } catch {
        // ignore write failure
      }
    }
  }

  private sendError(ws: WebSocket, code: string, message: string): void {
    this.send(ws, WsServerEvents.ERROR, { code, message });
  }

  private sendRateLimited(ws: WebSocket, retryAfterMs: number): void {
    this.send(ws, WsServerEvents.RATE_LIMITED, { retryAfterMs });
  }
}
