import { DurableObject } from 'cloudflare:workers';
import { Buffer } from 'node:buffer';
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
  ClientMsgEditPayloadSchema,
  ClientMsgDeletePayloadSchema,
  ClientReactAddPayloadSchema,
  ClientReactRemovePayloadSchema,
  ClientChannelCreatePayloadSchema,
  ClientChannelRenamePayloadSchema,
  ClientChannelDeletePayloadSchema,
  ClientHistoryFetchPayloadSchema,
  ClientTypingPayloadSchema,
  ClientVoiceJoinPayloadSchema,
  ClientVoiceLeavePayloadSchema,
  ClientVoiceSignalPayloadSchema,
  ClientVoiceStatePayloadSchema,
  ClientFileSignalPayloadSchema,
  AttachmentUploadRequestSchema,
  ClientShareStartPayloadSchema,
  ClientShareStopPayloadSchema,
  ClientShareSignalPayloadSchema,
  type VoiceParticipant,
  type ScreenShareState,
  type GroupSnapshot,
  type Channel,
  type GroupMember,
  type Message,
  type Attachment,
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
  reply_to_author_name?: string | null;
  reply_to_content?: string | null;
  attachments_json?: string | null;
  created_at: number;
  edited_at: number | null;
  deleted: number;
}

export class GroupDO extends DurableObject<Env> {
  private sql: SqlStorage;
  private typingMap: Map<string, number> = new Map(); // userId -> lastTypingTimestamp
  private voiceRooms: Map<string, Map<string, VoiceParticipant>> = new Map(); // channelId -> (userId -> participant)
  private userVoiceChannel: Map<string, string> = new Map(); // userId -> channelId
  private screenShares: Map<string, Map<string, ScreenShareState>> = new Map(); // channelId -> (userId -> ScreenShareState)

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

      CREATE TABLE IF NOT EXISTS reactions (
        message_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        emoji TEXT NOT NULL,
        PRIMARY KEY(message_id, user_id, emoji)
      );

      CREATE INDEX IF NOT EXISTS idx_reactions_msg ON reactions (message_id);

      CREATE TABLE IF NOT EXISTS attachments (
        id TEXT PRIMARY KEY,
        file_name TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        total_chunks INTEGER NOT NULL,
        uploaded_by TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_attachments_created ON attachments (created_at);

      CREATE TABLE IF NOT EXISTS attachment_chunks (
        attachment_id TEXT NOT NULL,
        chunk_index INTEGER NOT NULL,
        data_base64 TEXT NOT NULL,
        PRIMARY KEY(attachment_id, chunk_index)
      );
    `);

    try {
      this.sql.exec(`ALTER TABLE messages ADD COLUMN reply_to_author_name TEXT`);
    } catch {
      // Column already exists
    }

    try {
      this.sql.exec(`ALTER TABLE messages ADD COLUMN reply_to_content TEXT`);
    } catch {
      // Column already exists
    }

    try {
      this.sql.exec(`ALTER TABLE messages ADD COLUMN attachments_json TEXT DEFAULT '[]'`);
    } catch {
      // Column already exists
    }

    // Ensure at least one voice channel exists in existing groups
    try {
      const voiceCursor = this.sql.exec(`SELECT id FROM channels WHERE type = 'voice' LIMIT 1`);
      if ([...voiceCursor].length === 0) {
        const metaCursor = this.sql.exec(`SELECT id FROM group_meta LIMIT 1`);
        if ([...metaCursor].length > 0) {
          const voiceChanId = ulid();
          this.sql.exec(
            `INSERT INTO channels (id, name, type, position, created_at) VALUES (?, 'Genel Ses', 'voice', 1, ?)`,
            voiceChanId,
            Date.now(),
          );
        }
      }
    } catch {
      // Ignore
    }

    // Schedule 24-hour cleanup alarm if not scheduled
    this.ctx.storage.getAlarm().then((scheduled) => {
      if (!scheduled) {
        this.ctx.storage.setAlarm(Date.now() + 24 * 60 * 60 * 1000);
      }
    }).catch(() => {});
  }

  async alarm(): Promise<void> {
    const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
    // 90-day retention cleanup
    this.sql.exec(`DELETE FROM messages WHERE created_at < ?`, ninetyDaysAgo);
    this.sql.exec(`DELETE FROM reactions WHERE message_id NOT IN (SELECT id FROM messages)`);
    this.sql.exec(
      `DELETE FROM attachment_chunks WHERE attachment_id IN (SELECT id FROM attachments WHERE created_at < ?)`,
      ninetyDaysAgo,
    );
    this.sql.exec(`DELETE FROM attachments WHERE created_at < ?`, ninetyDaysAgo);
    // Reschedule in 24 hours
    await this.ctx.storage.setAlarm(Date.now() + 24 * 60 * 60 * 1000);
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

      // Default voice channel
      const voiceChanId = ulid();
      this.sql.exec(
        `INSERT INTO channels (id, name, type, position, created_at) VALUES (?, 'Genel Ses', 'voice', 1, ?)`,
        voiceChanId,
        now + 1,
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

      // 1. Broadcast member.joined to all connected sockets
      const newMember: GroupMember = {
        userId: body.userId,
        displayName: body.displayName,
        pubkey: body.pubkey,
        role: 'member',
        joinedAt: now,
        banned: false,
        status: 'online',
      };
      this.broadcast(WsServerEvents.MEMBER_JOINED, newMember);

      // 2. Insert welcome system message in #genel and broadcast msg.new
      const genelRows = [...this.sql.exec(`SELECT id FROM channels WHERE name = 'genel' LIMIT 1`)] as { id: string }[];
      const genelChanId = genelRows[0]?.id;
      if (genelChanId) {
        const welcomeId = ulid();
        const welcomeContent = `🎉 **${body.displayName}** gruba katıldı. Hoş geldin!`;
        this.sql.exec(
          `INSERT INTO messages (id, channel_id, author_id, author_name, content, created_at, deleted)
           VALUES (?, ?, 'system', 'Echo Sistemi', ?, ?, 0)`,
          welcomeId,
          genelChanId,
          welcomeContent,
          now,
        );

        const welcomeMsg: Message = {
          id: welcomeId,
          channelId: genelChanId,
          authorId: 'system',
          authorName: 'Echo Sistemi',
          content: welcomeContent,
          replyTo: null,
          replyToAuthorName: null,
          replyToContent: null,
          attachments: [],
          createdAt: now,
          editedAt: null,
          deleted: false,
          reactions: {},
        };
        this.broadcast(WsServerEvents.MSG_NEW, welcomeMsg);
      }

      const snapshot = this.getGroupSnapshot();
      return Response.json({ success: true, snapshot });
    }

    if (url.pathname === '/internal/snapshot' && request.method === 'GET') {
      return Response.json(this.getGroupSnapshot());
    }

    if (url.pathname === '/internal/delete' && request.method === 'POST') {
      const { userId } = (await request.json()) as { userId: string };

      const metaRows = [...this.sql.exec(`SELECT * FROM group_meta LIMIT 1`)];
      const meta = metaRows[0] as { id: string; name: string; owner_id: string } | undefined;
      if (!meta) {
        return Response.json({ error: 'Grup bulunamadı' }, { status: 404 });
      }

      if (meta.owner_id !== userId) {
        return Response.json({ error: 'Yalnızca grup sahibi grubu silebilir' }, { status: 403 });
      }

      // Collect all member IDs to clean up their UserDO records
      const memberRows = [...this.sql.exec(`SELECT user_id FROM members`)] as { user_id: string }[];
      const memberUserIds = memberRows.map((r) => r.user_id);

      // 1. Broadcast group.deleted to all connected sockets
      this.broadcast(WsServerEvents.GROUP_DELETED, { groupId: meta.id });

      // 2. Close all sockets
      for (const ws of this.ctx.getWebSockets()) {
        try {
          ws.close(1000, 'Group deleted');
        } catch {
          // ignore
        }
      }

      // 3. Clear all voice room mappings
      this.voiceRooms.clear();
      this.userVoiceChannel.clear();

      // 4. Delete all stored DO data
      await this.ctx.storage.deleteAll();

      return Response.json({ success: true, groupId: meta.id, memberUserIds });
    }

    if (url.pathname === '/internal/leave' && request.method === 'POST') {
      const { userId } = (await request.json()) as { userId: string };

      const metaRows = [...this.sql.exec(`SELECT * FROM group_meta LIMIT 1`)];
      const meta = metaRows[0] as { id: string; name: string; owner_id: string } | undefined;
      if (!meta) {
        return Response.json({ error: 'Grup bulunamadı' }, { status: 404 });
      }

      if (meta.owner_id === userId) {
        return Response.json(
          { error: 'Grup sahibi gruptan ayrılamaz, grubu silebilirsiniz' },
          { status: 400 },
        );
      }

      const memberRows = [...this.sql.exec(`SELECT * FROM members WHERE user_id = ?`, userId)] as {
        display_name: string;
      }[];
      if (memberRows.length === 0) {
        return Response.json({ error: 'Bu grubun üyesi değilsiniz' }, { status: 400 });
      }

      const memberDisplayName = memberRows[0]!.display_name;

      this.sql.exec(`DELETE FROM members WHERE user_id = ?`, userId);

      // Leave any active voice channel
      const currentChannelId = this.userVoiceChannel.get(userId);
      if (currentChannelId) {
        this.leaveVoiceRoom(userId, currentChannelId);
      }

      // Broadcast member.left to remaining sockets
      this.broadcast(WsServerEvents.MEMBER_LEFT, { groupId: meta.id, userId });

      // Close any websockets belonging to this user
      for (const ws of this.ctx.getWebSockets()) {
        try {
          const attachment = ws.deserializeAttachment() as WsSessionAttachment | null;
          if (attachment?.userId === userId) {
            ws.close(1000, 'Left group');
          }
        } catch {
          // ignore
        }
      }

      return Response.json({ success: true, groupId: meta.id, displayName: memberDisplayName });
    }

    if (url.pathname === '/internal/attachments/upload' && request.method === 'POST') {
      const rawBody = await request.json();
      const parse = AttachmentUploadRequestSchema.safeParse(rawBody);
      if (!parse.success) {
        return Response.json({ error: 'Geçersiz ek yükleme verisi' }, { status: 400 });
      }

      const body = parse.data;
      const MAX_GROUP_ATTACHMENTS_BYTES = 1.5 * 1024 * 1024 * 1024; // 1.5 GB limit

      // Check storage quota
      const sizeRows = [
        ...this.sql.exec(`SELECT SUM(size_bytes) as total_size FROM attachments`),
      ] as { total_size: number | null }[];
      const currentTotal = sizeRows[0]?.total_size ?? 0;
      if (currentTotal + body.sizeBytes > MAX_GROUP_ATTACHMENTS_BYTES) {
        const oldestRows = [
          ...this.sql.exec(`SELECT id, size_bytes FROM attachments ORDER BY created_at ASC`),
        ] as { id: string; size_bytes: number }[];
        let freed = 0;
        const needed = currentTotal + body.sizeBytes - MAX_GROUP_ATTACHMENTS_BYTES;
        for (const oldAtt of oldestRows) {
          this.sql.exec(`DELETE FROM attachment_chunks WHERE attachment_id = ?`, oldAtt.id);
          this.sql.exec(`DELETE FROM attachments WHERE id = ?`, oldAtt.id);
          freed += oldAtt.size_bytes;
          if (freed >= needed) break;
        }
      }

      const attachmentId = ulid();
      this.sql.exec(
        `INSERT INTO attachments (id, file_name, mime_type, size_bytes, total_chunks, uploaded_by, created_at)
         VALUES (?, ?, ?, ?, ?, '', ?)`,
        attachmentId,
        body.filename,
        body.mimeType,
        body.sizeBytes,
        body.totalChunks,
        Date.now(),
      );

      for (const chunk of body.chunks) {
        this.sql.exec(
          `INSERT OR REPLACE INTO attachment_chunks (attachment_id, chunk_index, data_base64) VALUES (?, ?, ?)`,
          attachmentId,
          chunk.index,
          chunk.dataBase64,
        );
      }

      const metaRows = [...this.sql.exec(`SELECT id FROM group_meta LIMIT 1`)];
      const groupId = (metaRows[0] as { id: string } | undefined)?.id ?? '';

      const attachmentType: 'image' | 'gif' = body.mimeType === 'image/gif' ? 'gif' : 'image';
      const attachment: Attachment = {
        id: attachmentId,
        name: body.filename,
        size: body.sizeBytes,
        mimeType: body.mimeType,
        url: `/api/groups/${groupId}/attachments/${attachmentId}`,
        type: attachmentType,
        width: body.width,
        height: body.height,
      };

      return Response.json({
        success: true,
        attachment,
      });
    }

    if (url.pathname.startsWith('/internal/attachments/') && request.method === 'GET') {
      const attachmentId = url.pathname.replace('/internal/attachments/', '');
      const attRows = [
        ...this.sql.exec(`SELECT * FROM attachments WHERE id = ?`, attachmentId),
      ] as {
        file_name: string;
        mime_type: string;
        size_bytes: number;
        total_chunks: number;
      }[];

      if (attRows.length === 0 || !attRows[0]) {
        return new Response('Attachment not found', { status: 404 });
      }

      const att = attRows[0];
      const chunkRows = [
        ...this.sql.exec(
          `SELECT chunk_index, data_base64 FROM attachment_chunks WHERE attachment_id = ? ORDER BY chunk_index ASC`,
          attachmentId,
        ),
      ] as { chunk_index: number; data_base64: string }[];

      if (chunkRows.length < att.total_chunks) {
        return new Response('Attachment incomplete', { status: 425 });
      }

      const buffers = chunkRows.map((c) => Buffer.from(c.data_base64, 'base64'));
      const totalBuffer = Buffer.concat(buffers);

      return new Response(totalBuffer, {
        status: 200,
        headers: {
          'Content-Type': att.mime_type,
          'Content-Disposition': `inline; filename="${encodeURIComponent(att.file_name)}"`,
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
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

    const inviteCursor = this.sql.exec(
      `SELECT code FROM invites WHERE revoked = 0 ORDER BY created_at ASC LIMIT 1`,
    );
    const inviteRows = [...inviteCursor] as { code: string }[];
    let inviteCode = inviteRows[0]?.code;

    if (!inviteCode && groupMeta.id && groupMeta.id !== 'unknown') {
      inviteCode = `ECHO-${groupMeta.id.toLowerCase()}-${ulid().substring(0, 6)}`;
      const secretHash = bytesToHex(sha256(new TextEncoder().encode(inviteCode)));
      this.sql.exec(
        `INSERT INTO invites (code, secret_hash, created_by, created_at, uses) VALUES (?, ?, ?, ?, 0)`,
        inviteCode,
        secretHash,
        groupMeta.ownerId || 'system',
        Date.now(),
      );
    }

    return {
      group: groupMeta,
      channels,
      members,
      inviteCode,
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

    // 2. Rate limiting check strictly for chat messages (5 msg/sec token bucket)
    if (envelope.t === WsClientEvents.MSG_SEND) {
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
    }

    // 3. Event routing
    switch (envelope.t) {
      case WsClientEvents.MSG_SEND:
        this.handleMessageSend(ws, session, envelope);
        break;
      case WsClientEvents.MSG_EDIT:
        this.handleMessageEdit(ws, session, envelope);
        break;
      case WsClientEvents.MSG_DELETE:
        this.handleMessageDelete(ws, session, envelope);
        break;
      case WsClientEvents.REACT_ADD:
        this.handleReactAdd(ws, session, envelope);
        break;
      case WsClientEvents.REACT_REMOVE:
        this.handleReactRemove(ws, session, envelope);
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
      case WsClientEvents.VOICE_JOIN:
        this.handleVoiceJoin(ws, session, envelope);
        break;
      case WsClientEvents.VOICE_LEAVE:
        this.handleVoiceLeave(session, envelope);
        break;
      case WsClientEvents.VOICE_SIGNAL:
        this.handleVoiceSignal(session, envelope);
        break;
      case WsClientEvents.VOICE_STATE:
        this.handleVoiceState(session, envelope);
        break;
      case WsClientEvents.FILE_SIGNAL:
        this.handleFileSignal(session, envelope);
        break;
      case WsClientEvents.SHARE_START:
        this.handleShareStart(ws, session, envelope);
        break;
      case WsClientEvents.SHARE_STOP:
        this.handleShareStop(session, envelope);
        break;
      case WsClientEvents.SHARE_SIGNAL:
        this.handleShareSignal(session, envelope);
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

    // Send active voice participants across all voice channels (including empty ones to clear stale client state)
    const voiceChanRows = [
      ...this.sql.exec(`SELECT id FROM channels WHERE type = 'voice'`),
    ] as { id: string }[];
    for (const chan of voiceChanRows) {
      const room = this.voiceRooms.get(chan.id);
      this.send(ws, WsServerEvents.VOICE_PARTICIPANTS, {
        channelId: chan.id,
        participants: room ? Array.from(room.values()) : [],
      });
    }

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

    const { channelId, content = '', replyTo, attachments = [] } = parse.data;

    // Check if channel exists
    const chanRows = [...this.sql.exec(`SELECT id FROM channels WHERE id = ?`, channelId)];
    if (chanRows.length === 0) {
      this.sendError(ws, 'CHANNEL_NOT_FOUND', 'Kanal bulunamadı');
      return;
    }

    const id = ulid();
    const now = Date.now();

    // Lookup reply info if replying
    let replyToAuthorName: string | null = null;
    let replyToContent: string | null = null;
    if (replyTo) {
      const replied = [
        ...this.sql.exec(`SELECT author_name, content FROM messages WHERE id = ?`, replyTo),
      ] as { author_name: string; content: string }[];
      if (replied.length > 0 && replied[0]) {
        replyToAuthorName = replied[0].author_name;
        replyToContent = replied[0].content.slice(0, 100);
      }
    }

    this.sql.exec(
      `INSERT INTO messages (id, channel_id, author_id, author_name, content, reply_to, reply_to_author_name, reply_to_content, attachments_json, created_at, deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      id,
      channelId,
      session.userId,
      session.displayName,
      content,
      replyTo ?? null,
      replyToAuthorName,
      replyToContent,
      JSON.stringify(attachments),
      now,
    );

    const message: Message = {
      id,
      channelId,
      authorId: session.userId,
      authorName: session.displayName,
      content,
      replyTo: replyTo ?? null,
      replyToAuthorName,
      replyToContent,
      attachments,
      createdAt: now,
      editedAt: null,
      deleted: false,
      reactions: {},
    };

    // Broadcast to all connected group members with client nonce echo
    this.broadcast(WsServerEvents.MSG_NEW, message, envelope.id);
  }

  private handleMessageEdit(
    ws: WebSocket,
    session: WsSessionAttachment,
    envelope: WsEnvelope,
  ): void {
    const parse = ClientMsgEditPayloadSchema.safeParse(envelope.d);
    if (!parse.success) {
      this.sendError(ws, 'INVALID_PAYLOAD', 'Mesaj düzenleme parametreleri geçersiz');
      return;
    }

    const { channelId, messageId, content } = parse.data;

    const rows = [
      ...this.sql.exec(
        `SELECT * FROM messages WHERE id = ? AND channel_id = ? AND deleted = 0`,
        messageId,
        channelId,
      ),
    ] as unknown as SqlMessageRow[];

    if (rows.length === 0 || !rows[0]) {
      this.sendError(ws, 'MESSAGE_NOT_FOUND', 'Düzenlenecek mesaj bulunamadı');
      return;
    }

    const msg = rows[0];
    if (msg.author_id !== session.userId) {
      this.sendError(ws, 'FORBIDDEN', 'Yalnızca kendi mesajınızı düzenleyebilirsiniz');
      return;
    }

    const now = Date.now();
    this.sql.exec(
      `UPDATE messages SET content = ?, edited_at = ? WHERE id = ?`,
      content,
      now,
      messageId,
    );

    this.broadcast(WsServerEvents.MSG_UPDATED, {
      channelId,
      messageId,
      content,
      editedAt: now,
    });
  }

  private handleMessageDelete(
    ws: WebSocket,
    session: WsSessionAttachment,
    envelope: WsEnvelope,
  ): void {
    const parse = ClientMsgDeletePayloadSchema.safeParse(envelope.d);
    if (!parse.success) {
      this.sendError(ws, 'INVALID_PAYLOAD', 'Mesaj silme parametreleri geçersiz');
      return;
    }

    const { channelId, messageId } = parse.data;

    const rows = [
      ...this.sql.exec(`SELECT * FROM messages WHERE id = ? AND channel_id = ?`, messageId, channelId),
    ] as unknown as SqlMessageRow[];

    if (rows.length === 0 || !rows[0]) {
      this.sendError(ws, 'MESSAGE_NOT_FOUND', 'Silinecek mesaj bulunamadı');
      return;
    }

    const msg = rows[0];
    const canDelete =
      msg.author_id === session.userId ||
      session.role === 'owner' ||
      session.role === 'admin';

    if (!canDelete) {
      this.sendError(ws, 'FORBIDDEN', 'Bu mesajı silme yetkiniz yok');
      return;
    }

    this.sql.exec(`UPDATE messages SET deleted = 1 WHERE id = ?`, messageId);

    this.broadcast(WsServerEvents.MSG_DELETED, {
      channelId,
      messageId,
    });
  }

  private handleReactAdd(
    ws: WebSocket,
    session: WsSessionAttachment,
    envelope: WsEnvelope,
  ): void {
    const parse = ClientReactAddPayloadSchema.safeParse(envelope.d);
    if (!parse.success) {
      this.sendError(ws, 'INVALID_PAYLOAD', 'Tepki parametreleri geçersiz');
      return;
    }

    const { channelId, messageId, emoji } = parse.data;

    const msgRows = [
      ...this.sql.exec(
        `SELECT id FROM messages WHERE id = ? AND channel_id = ? AND deleted = 0`,
        messageId,
        channelId,
      ),
    ];
    if (msgRows.length === 0) {
      this.sendError(ws, 'MESSAGE_NOT_FOUND', 'Tepki verilecek mesaj bulunamadı');
      return;
    }

    this.sql.exec(
      `INSERT OR IGNORE INTO reactions (message_id, user_id, emoji) VALUES (?, ?, ?)`,
      messageId,
      session.userId,
      emoji,
    );

    const reactions = this.getMessageReactions(messageId);

    this.broadcast(WsServerEvents.REACT_UPDATED, {
      channelId,
      messageId,
      emoji,
      reactions,
    });
  }

  private handleReactRemove(
    ws: WebSocket,
    session: WsSessionAttachment,
    envelope: WsEnvelope,
  ): void {
    const parse = ClientReactRemovePayloadSchema.safeParse(envelope.d);
    if (!parse.success) {
      this.sendError(ws, 'INVALID_PAYLOAD', 'Tepki kaldırma parametreleri geçersiz');
      return;
    }

    const { channelId, messageId, emoji } = parse.data;

    this.sql.exec(
      `DELETE FROM reactions WHERE message_id = ? AND user_id = ? AND emoji = ?`,
      messageId,
      session.userId,
      emoji,
    );

    const reactions = this.getMessageReactions(messageId);

    this.broadcast(WsServerEvents.REACT_UPDATED, {
      channelId,
      messageId,
      emoji,
      reactions,
    });
  }

  private getMessageReactions(messageId: string): Record<string, string[]> {
    const rows = [
      ...this.sql.exec(`SELECT emoji, user_id FROM reactions WHERE message_id = ?`, messageId),
    ] as { emoji: string; user_id: string }[];

    const result: Record<string, string[]> = {};
    for (const r of rows) {
      if (!result[r.emoji]) result[r.emoji] = [];
      result[r.emoji]!.push(r.user_id);
    }
    return result;
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

    const messageIds = slice.map((m) => m.id);
    const reactionMap: Record<string, Record<string, string[]>> = {};
    if (messageIds.length > 0) {
      const placeholders = messageIds.map(() => '?').join(',');
      const reactRows = [
        ...this.sql.exec(
          `SELECT message_id, user_id, emoji FROM reactions WHERE message_id IN (${placeholders})`,
          ...messageIds,
        ),
      ] as { message_id: string; user_id: string; emoji: string }[];
      for (const r of reactRows) {
        if (!reactionMap[r.message_id]) {
          reactionMap[r.message_id] = {};
        }
        const emojiMap = reactionMap[r.message_id]!;
        if (!emojiMap[r.emoji]) {
          emojiMap[r.emoji] = [];
        }
        emojiMap[r.emoji]!.push(r.user_id);
      }
    }

    const messages: Message[] = slice.map((r) => {
      let attachments: Attachment[] = [];
      if (r.attachments_json) {
        try {
          attachments = JSON.parse(r.attachments_json);
        } catch {
          attachments = [];
        }
      }

      return {
        id: r.id,
        channelId: r.channel_id,
        authorId: r.author_id,
        authorName: r.author_name,
        content: r.content,
        replyTo: r.reply_to,
        replyToAuthorName: r.reply_to_author_name ?? null,
        replyToContent: r.reply_to_content ?? null,
        attachments,
        createdAt: r.created_at,
        editedAt: r.edited_at,
        deleted: Boolean(r.deleted),
        reactions: reactionMap[r.id] ?? {},
      };
    });

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

  private handleVoiceJoin(
    ws: WebSocket,
    session: WsSessionAttachment,
    envelope: WsEnvelope,
  ): void {
    const parse = ClientVoiceJoinPayloadSchema.safeParse(envelope.d);
    if (!parse.success) {
      this.sendError(ws, 'INVALID_PAYLOAD', 'Ses kanalına katılım parametreleri geçersiz');
      return;
    }

    const { channelId } = parse.data;
    const chanRows = [...this.sql.exec(`SELECT id, type FROM channels WHERE id = ?`, channelId)] as { id: string; type: string }[];
    if (chanRows.length === 0 || chanRows[0]?.type !== 'voice') {
      this.sendError(ws, 'CHANNEL_NOT_FOUND', 'Ses kanalı bulunamadı');
      return;
    }

    // If user is already in another voice channel, leave it first
    const currentChannelId = this.userVoiceChannel.get(session.userId);
    if (currentChannelId && currentChannelId !== channelId) {
      this.leaveVoiceRoom(session.userId, currentChannelId);
    }

    let room = this.voiceRooms.get(channelId);
    if (!room) {
      room = new Map();
      this.voiceRooms.set(channelId, room);
    }

    if (room.size >= 10 && !room.has(session.userId)) {
      this.sendError(ws, 'VOICE_CHANNEL_FULL', 'Ses kanalı dolu (maksimum 10 kullanıcı)');
      return;
    }

    const participant: VoiceParticipant = {
      userId: session.userId,
      displayName: session.displayName,
      muted: false,
      deafened: false,
      speaking: false,
      camera: false,
    };

    // Get list of existing participants BEFORE adding this new one (for mesh offer initiation)
    const existingParticipants = Array.from(room.values());

    room.set(session.userId, participant);
    this.userVoiceChannel.set(session.userId, channelId);

    // Broadcast to all connected clients in the group so channel avatars & mesh update
    this.broadcast(
      WsServerEvents.VOICE_USER_JOINED,
      {
        channelId,
        userId: session.userId,
        displayName: session.displayName,
        currentParticipants: existingParticipants,
      },
      envelope.id,
    );

    // Send currently active screen shares in this channel to the newly joined user
    const channelShares = Array.from(this.screenShares.get(channelId)?.values() ?? []);
    if (channelShares.length > 0) {
      this.send(ws, WsServerEvents.SHARE_ACTIVE_LIST, {
        channelId,
        shares: channelShares,
      });
    }
  }

  private handleVoiceLeave(
    session: WsSessionAttachment,
    envelope: WsEnvelope,
  ): void {
    const parse = ClientVoiceLeavePayloadSchema.safeParse(envelope.d);
    if (!parse.success) return;

    const { channelId } = parse.data;
    this.leaveVoiceRoom(session.userId, channelId, envelope.id);
  }

  private leaveVoiceRoom(userId: string, channelId: string, envelopeId?: string): void {
    const room = this.voiceRooms.get(channelId);
    if (room && room.has(userId)) {
      room.delete(userId);
      if (room.size === 0) {
        this.voiceRooms.delete(channelId);
      }
    }
    if (this.userVoiceChannel.get(userId) === channelId) {
      this.userVoiceChannel.delete(userId);
    }

    // Stop active screen share if this user was sharing
    const shares = this.screenShares.get(channelId);
    if (shares && shares.has(userId)) {
      shares.delete(userId);
      if (shares.size === 0) {
        this.screenShares.delete(channelId);
      }
      this.broadcast(WsServerEvents.SHARE_STOPPED, { channelId, userId });
    }

    this.broadcast(
      WsServerEvents.VOICE_USER_LEFT,
      {
        channelId,
        userId,
      },
      envelopeId,
    );
  }

  private handleVoiceSignal(
    session: WsSessionAttachment,
    envelope: WsEnvelope,
  ): void {
    const parse = ClientVoiceSignalPayloadSchema.safeParse(envelope.d);
    if (!parse.success) return;

    const { channelId, targetUserId, signal } = parse.data;

    // Direct relay to target user
    this.sendToUser(targetUserId, WsServerEvents.VOICE_SIGNAL, {
      channelId,
      fromUserId: session.userId,
      signal,
    });
  }

  private handleVoiceState(
    session: WsSessionAttachment,
    envelope: WsEnvelope,
  ): void {
    const parse = ClientVoiceStatePayloadSchema.safeParse(envelope.d);
    if (!parse.success) return;

    const { channelId, muted, deafened, speaking, camera } = parse.data;
    const room = this.voiceRooms.get(channelId);
    let currentCamera = false;
    if (room && room.has(session.userId)) {
      const p = room.get(session.userId)!;
      p.muted = muted;
      p.deafened = deafened;
      p.speaking = speaking;
      if (camera !== undefined) {
        p.camera = camera;
      }
      currentCamera = p.camera;
    }

    this.broadcast(WsServerEvents.VOICE_STATE, {
      channelId,
      userId: session.userId,
      muted,
      deafened,
      speaking,
      camera: currentCamera,
    });
  }

  private handleFileSignal(
    session: WsSessionAttachment,
    envelope: WsEnvelope,
  ): void {
    const parse = ClientFileSignalPayloadSchema.safeParse(envelope.d);
    if (!parse.success) return;

    const { targetUserId, signal } = parse.data;

    this.sendToUser(targetUserId, WsServerEvents.FILE_SIGNAL, {
      fromUserId: session.userId,
      signal,
    });
  }

  private handleShareStart(
    ws: WebSocket,
    session: WsSessionAttachment,
    envelope: WsEnvelope,
  ): void {
    const parse = ClientShareStartPayloadSchema.safeParse(envelope.d);
    if (!parse.success) {
      this.sendError(ws, 'INVALID_PAYLOAD', 'Ekran paylaşımı parametreleri geçersiz');
      return;
    }

    const { channelId, quality, mode, hasAudio } = parse.data;

    // Check if user is in this voice channel
    if (this.userVoiceChannel.get(session.userId) !== channelId) {
      this.sendError(ws, 'FORBIDDEN', 'Ekran paylaşmak için önce ses kanalına katılmalısınız');
      return;
    }

    let channelShares = this.screenShares.get(channelId);
    if (!channelShares) {
      channelShares = new Map();
      this.screenShares.set(channelId, channelShares);
    }

    const shareState: ScreenShareState = {
      channelId,
      userId: session.userId,
      displayName: session.displayName,
      isSharing: true,
      quality,
      mode,
      hasAudio,
      viewersCount: 0,
    };

    channelShares.set(session.userId, shareState);

    // Broadcast to entire group
    this.broadcast(WsServerEvents.SHARE_STARTED, shareState, envelope.id);
  }

  private handleShareStop(
    session: WsSessionAttachment,
    envelope: WsEnvelope,
  ): void {
    const parse = ClientShareStopPayloadSchema.safeParse(envelope.d);
    if (!parse.success) return;

    const { channelId } = parse.data;
    const channelShares = this.screenShares.get(channelId);
    if (channelShares && channelShares.has(session.userId)) {
      channelShares.delete(session.userId);
      if (channelShares.size === 0) {
        this.screenShares.delete(channelId);
      }
    }

    this.broadcast(
      WsServerEvents.SHARE_STOPPED,
      {
        channelId,
        userId: session.userId,
      },
      envelope.id,
    );
  }

  private handleShareSignal(
    session: WsSessionAttachment,
    envelope: WsEnvelope,
  ): void {
    const parse = ClientShareSignalPayloadSchema.safeParse(envelope.d);
    if (!parse.success) return;

    const { channelId, targetUserId, signal } = parse.data;

    this.sendToUser(targetUserId, WsServerEvents.SHARE_SIGNAL, {
      channelId,
      fromUserId: session.userId,
      signal,
    });
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

        // Also leave any voice room if currently connected
        const currentChannelId = this.userVoiceChannel.get(session.userId);
        if (currentChannelId) {
          this.leaveVoiceRoom(session.userId, currentChannelId);
        }
      }
    }
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.webSocketClose(ws);
  }

  private sendToUser(userId: string, type: string, data: unknown, id?: string): void {
    const payload = JSON.stringify({ v: 1, t: type, id, d: data });
    for (const ws of this.ctx.getWebSockets()) {
      const att = ws.deserializeAttachment() as WsSessionAttachment | null;
      if (att?.userId === userId) {
        try {
          ws.send(payload);
        } catch {
          // ignore write failure
        }
      }
    }
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
