import { DurableObject } from 'cloudflare:workers';
import { WsClientEvents, WsServerEvents } from '@echo/shared';
import type {
  WsEnvelope,
  DmMessage,
  DmThread,
} from '@echo/shared';
import {
  ClientDmSendPayloadSchema as DmSendSchema,
  ClientDmHistoryFetchPayloadSchema as DmHistorySchema,
  ClientDmReadMarkPayloadSchema as DmReadMarkSchema,
} from '@echo/shared';
import type { Env } from '../index';

interface UserSessionAttachment {
  userId: string;
  displayName: string;
  color: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function generateId(): string {
  // ULID-compatible timestamp prefix + random suffix
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 9)}`.toUpperCase();
}

function send(ws: WebSocket, t: string, d: unknown): void {
  try {
    ws.send(JSON.stringify({ v: 1, t, d }));
  } catch {
    // socket closed
  }
}

// ── UserDO ───────────────────────────────────────────────────────────────────

export class UserDO extends DurableObject<Env> {
  private sql: SqlStorage;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sql = this.ctx.storage.sql;
    this.initDatabase();
  }

  private initDatabase(): void {
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS memberships (
        group_id   TEXT PRIMARY KEY,
        group_name TEXT NOT NULL,
        joined_at  INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS dm_threads (
        peer_id              TEXT PRIMARY KEY,
        peer_name            TEXT NOT NULL DEFAULT '',
        peer_color           TEXT NOT NULL DEFAULT '#6366f1',
        last_message_at      INTEGER NOT NULL DEFAULT 0,
        last_message_preview TEXT NOT NULL DEFAULT '',
        unread_count         INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS dm_messages (
        id           TEXT PRIMARY KEY,
        from_user_id TEXT NOT NULL,
        to_user_id   TEXT NOT NULL,
        from_name    TEXT NOT NULL DEFAULT '',
        from_color   TEXT NOT NULL DEFAULT '#6366f1',
        content      TEXT NOT NULL DEFAULT '',
        created_at   INTEGER NOT NULL,
        deleted      INTEGER NOT NULL DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_dm_messages_from ON dm_messages(from_user_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_dm_messages_to   ON dm_messages(to_user_id, created_at);

      CREATE TABLE IF NOT EXISTS dm_read_state (
        peer_id      TEXT PRIMARY KEY,
        last_read_id TEXT NOT NULL DEFAULT ''
      );
    `);
  }

  // ── HTTP fetch ─────────────────────────────────────────────────────────────

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // ── Membership ────────────────────────────────────────────────────────────

    if (url.pathname === '/internal/add-membership' && request.method === 'POST') {
      const { groupId, groupName } = (await request.json()) as {
        groupId: string;
        groupName: string;
      };
      this.sql.exec(
        `INSERT OR REPLACE INTO memberships (group_id, group_name, joined_at) VALUES (?, ?, ?)`,
        groupId,
        groupName,
        Date.now(),
      );
      return Response.json({ success: true });
    }

    if (url.pathname === '/internal/remove-membership' && request.method === 'POST') {
      const { groupId } = (await request.json()) as { groupId: string };
      this.sql.exec(`DELETE FROM memberships WHERE group_id = ?`, groupId);
      return Response.json({ success: true });
    }

    if (url.pathname === '/internal/memberships' && request.method === 'GET') {
      const rows = [...this.sql.exec(`SELECT * FROM memberships ORDER BY joined_at DESC`)];
      return Response.json(rows);
    }

    // ── WebSocket ─────────────────────────────────────────────────────────────

    if (url.pathname === '/internal/ws') {
      if (request.headers.get('Upgrade') !== 'websocket') {
        return new Response('Expected WebSocket', { status: 426 });
      }
      const pair = new WebSocketPair();
      const server = pair[1];
      const userId = url.searchParams.get('userId') ?? '';
      const displayName = url.searchParams.get('displayName') ?? 'Bilinmiyor';
      const color = url.searchParams.get('color') ?? '#6366f1';

      this.ctx.acceptWebSocket(server);
      const attachment: UserSessionAttachment = { userId, displayName, color };
      server.serializeAttachment(attachment);

      return new Response(null, { status: 101, webSocket: pair[0] });
    }

    // ── DM: Deliver message from sender DO (called by Worker) ─────────────────

    if (url.pathname === '/internal/dm/deliver' && request.method === 'POST') {
      const msg = (await request.json()) as DmMessage;
      // Store in our local dm_messages table
      this.sql.exec(
        `INSERT OR IGNORE INTO dm_messages
          (id, from_user_id, to_user_id, from_name, from_color, content, created_at, deleted)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
        msg.id,
        msg.fromUserId,
        msg.toUserId,
        msg.fromName,
        msg.fromColor,
        msg.content,
        msg.createdAt,
      );
      // Update thread (peer = the sender)
      const peerId = msg.fromUserId;
      this.sql.exec(
        `INSERT INTO dm_threads (peer_id, peer_name, peer_color, last_message_at, last_message_preview, unread_count)
         VALUES (?, ?, ?, ?, ?, 1)
         ON CONFLICT(peer_id) DO UPDATE SET
           peer_name = excluded.peer_name,
           peer_color = excluded.peer_color,
           last_message_at = excluded.last_message_at,
           last_message_preview = excluded.last_message_preview,
           unread_count = unread_count + 1`,
        peerId,
        msg.fromName,
        msg.fromColor,
        msg.createdAt,
        msg.content.slice(0, 100),
      );
      // Push to any connected WebSockets
      for (const ws of this.ctx.getWebSockets()) {
        send(ws, WsServerEvents.DM_NEW, msg);
      }
      return Response.json({ success: true });
    }

    // ── DM: Thread list ───────────────────────────────────────────────────────

    if (url.pathname === '/internal/dm/threads' && request.method === 'GET') {
      const rows = [
        ...this.sql.exec(
          `SELECT peer_id, peer_name, peer_color, last_message_at, last_message_preview, unread_count
           FROM dm_threads ORDER BY last_message_at DESC`,
        ),
      ];
      const threads: DmThread[] = rows.map((r) => ({
        peerId: r.peer_id as string,
        peerName: r.peer_name as string,
        peerColor: r.peer_color as string,
        lastMessageAt: r.last_message_at as number,
        lastMessagePreview: (r.last_message_preview as string) ?? '',
        unreadCount: r.unread_count as number,
      }));
      return Response.json(threads);
    }

    // ── DM: History ───────────────────────────────────────────────────────────

    if (url.pathname === '/internal/dm/history' && request.method === 'GET') {
      const peerId = url.searchParams.get('peerId') ?? '';
      const before = url.searchParams.get('before');
      const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50', 10), 100);

      let rows;
      if (before) {
        rows = [
          ...this.sql.exec(
            `SELECT * FROM dm_messages
             WHERE (from_user_id = ? OR to_user_id = ?)
               AND id < ?
             ORDER BY created_at DESC LIMIT ?`,
            peerId,
            peerId,
            before,
            limit,
          ),
        ];
      } else {
        rows = [
          ...this.sql.exec(
            `SELECT * FROM dm_messages
             WHERE from_user_id = ? OR to_user_id = ?
             ORDER BY created_at DESC LIMIT ?`,
            peerId,
            peerId,
            limit,
          ),
        ];
      }

      const messages: DmMessage[] = rows.reverse().map((r) => ({
        id: r.id as string,
        fromUserId: r.from_user_id as string,
        toUserId: r.to_user_id as string,
        fromName: (r.from_name as string) ?? '',
        fromColor: (r.from_color as string) ?? '#6366f1',
        content: r.content as string,
        attachments: [],
        createdAt: r.created_at as number,
        deleted: (r.deleted as number) === 1,
      }));

      return Response.json({ messages, hasMore: rows.length === limit });
    }

    // ── DM: Read mark ─────────────────────────────────────────────────────────

    if (url.pathname === '/internal/dm/read-mark' && request.method === 'POST') {
      const { peerId, lastReadId } = (await request.json()) as {
        peerId: string;
        lastReadId: string;
      };
      this.sql.exec(
        `INSERT INTO dm_read_state (peer_id, last_read_id) VALUES (?, ?)
         ON CONFLICT(peer_id) DO UPDATE SET last_read_id = excluded.last_read_id`,
        peerId,
        lastReadId,
      );
      this.sql.exec(
        `UPDATE dm_threads SET unread_count = 0 WHERE peer_id = ?`,
        peerId,
      );
      return Response.json({ success: true });
    }

    return new Response('Not Found', { status: 404 });
  }

  // ── WebSocket Hibernation handlers ─────────────────────────────────────────

  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): void {
    if (typeof message !== 'string') return;

    let envelope: WsEnvelope;
    try {
      envelope = JSON.parse(message) as WsEnvelope;
    } catch {
      return;
    }

    const { t, d } = envelope;

    switch (t) {
      case WsClientEvents.DM_SEND:
        void this.handleDmSend(ws, d);
        break;
      case WsClientEvents.DM_HISTORY_FETCH:
        void this.handleDmHistoryFetch(ws, d);
        break;
      case WsClientEvents.DM_READ_MARK:
        void this.handleDmReadMark(ws, d);
        break;
      default:
        break;
    }
  }

  webSocketClose(ws: WebSocket): void {
    ws.close();
  }

  webSocketError(ws: WebSocket, error: unknown): void {
    console.error('UserDO WebSocket error', error);
    ws.close();
  }

  // ── DM Handlers ───────────────────────────────────────────────────────────

  private async handleDmSend(ws: WebSocket, rawData: unknown): Promise<void> {
    const session = ws.deserializeAttachment() as UserSessionAttachment | null;
    if (!session || !session.userId) return;

    const senderId = session.userId;
    const senderName = session.displayName;
    const senderColor = session.color;

    const parsed = DmSendSchema.safeParse(rawData);
    if (!parsed.success) {
      send(ws, WsServerEvents.ERROR, { code: 'INVALID_PAYLOAD', message: 'Geçersiz DM verisi' });
      return;
    }

    const { toUserId, content } = parsed.data;

    // Common group check is done in Worker before WS connection; trust the connection here.
    // Build message
    const msgId = generateId();
    const now = Date.now();

    const dmMsg: DmMessage = {
      id: msgId,
      fromUserId: senderId,
      toUserId,
      fromName: senderName ?? 'Bilinmiyor',
      fromColor: senderColor ?? '#6366f1',
      content,
      attachments: [],
      createdAt: now,
      deleted: false,
    };

    // Save to sender's own storage
    this.sql.exec(
      `INSERT OR IGNORE INTO dm_messages
        (id, from_user_id, to_user_id, from_name, from_color, content, created_at, deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
      dmMsg.id,
      dmMsg.fromUserId,
      dmMsg.toUserId,
      dmMsg.fromName,
      dmMsg.fromColor,
      dmMsg.content,
      dmMsg.createdAt,
    );

    // Update sender's thread (peer = receiver)
    this.sql.exec(
      `INSERT INTO dm_threads (peer_id, peer_name, peer_color, last_message_at, last_message_preview, unread_count)
       VALUES (?, ?, ?, ?, ?, 0)
       ON CONFLICT(peer_id) DO UPDATE SET
         last_message_at = excluded.last_message_at,
         last_message_preview = excluded.last_message_preview`,
      toUserId,
      // Receiver's name/color is unknown here; will be updated when receiver's snapshot comes
      toUserId,
      '#6366f1',
      now,
      content.slice(0, 100),
    );

    // Echo back to sender
    send(ws, WsServerEvents.DM_NEW, dmMsg);

    // Deliver to receiver's UserDO via internal HTTP
    const receiverStub = this.env.USER_DO.get(this.env.USER_DO.idFromName(toUserId));
    void receiverStub.fetch(
      new Request(`http://user-do/internal/dm/deliver`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dmMsg),
      }),
    );
  }

  private handleDmHistoryFetch(ws: WebSocket, rawData: unknown): void {
    const parsed = DmHistorySchema.safeParse(rawData);
    if (!parsed.success) return;

    const { peerId, before, limit } = parsed.data;

    let rows;
    if (before) {
      rows = [
        ...this.sql.exec(
          `SELECT * FROM dm_messages
           WHERE (from_user_id = ? OR to_user_id = ?)
             AND id < ?
           ORDER BY created_at DESC LIMIT ?`,
          peerId,
          peerId,
          before,
          limit,
        ),
      ];
    } else {
      rows = [
        ...this.sql.exec(
          `SELECT * FROM dm_messages
           WHERE from_user_id = ? OR to_user_id = ?
           ORDER BY created_at DESC LIMIT ?`,
          peerId,
          peerId,
          limit,
        ),
      ];
    }

    const messages: DmMessage[] = rows.reverse().map((r) => ({
      id: r.id as string,
      fromUserId: r.from_user_id as string,
      toUserId: r.to_user_id as string,
      fromName: (r.from_name as string) ?? '',
      fromColor: (r.from_color as string) ?? '#6366f1',
      content: r.content as string,
      attachments: [],
      createdAt: r.created_at as number,
      deleted: (r.deleted as number) === 1,
    }));

    send(ws, WsServerEvents.HISTORY_DATA, {
      peerId,
      messages,
      hasMore: rows.length === limit,
    });
  }

  private handleDmReadMark(ws: WebSocket, rawData: unknown): void {
    const session = ws.deserializeAttachment() as UserSessionAttachment | null;
    if (!session || !session.userId) return;

    const parsed = DmReadMarkSchema.safeParse(rawData);
    if (!parsed.success) return;

    const { peerId, lastReadId } = parsed.data;

    this.sql.exec(
      `INSERT INTO dm_read_state (peer_id, last_read_id) VALUES (?, ?)
       ON CONFLICT(peer_id) DO UPDATE SET last_read_id = excluded.last_read_id`,
      peerId,
      lastReadId,
    );
    this.sql.exec(`UPDATE dm_threads SET unread_count = 0 WHERE peer_id = ?`, peerId);

    send(ws, WsServerEvents.DM_READ, { peerId, lastReadId });
  }
}
