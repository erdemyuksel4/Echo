import { DurableObject } from 'cloudflare:workers';
import type { Env } from '../index';

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
        group_id TEXT PRIMARY KEY,
        group_name TEXT NOT NULL,
        joined_at INTEGER NOT NULL
      );
    `);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

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

    return new Response('Not Found', { status: 404 });
  }
}
