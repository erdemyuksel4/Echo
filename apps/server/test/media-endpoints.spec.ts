import { describe, it, expect, vi } from 'vitest';
import { app } from '../src/index';

describe('Faz 4 - Media Endpoints', () => {
  it('GET /api/giphy/search returns JSON with results array', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: [
            {
              id: 'gif123',
              title: 'Funny Cat',
              images: {
                original: { url: 'https://media.giphy.com/cat.gif', width: '400', height: '300' },
                fixed_width: { url: 'https://media.giphy.com/cat-preview.gif', width: '200', height: '150' },
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const res = await app.request('/api/giphy/search?q=cat');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { results: Array<{ id: string; url: string }> };
    expect(Array.isArray(body.results)).toBe(true);
    expect(body.results.length).toBe(1);
    expect(body.results[0]?.id).toBe('gif123');
    expect(body.results[0]?.url).toBe('https://media.giphy.com/cat.gif');
  });

  it('POST /api/groups/:id/attachments fails when payload is invalid', async () => {
    const res = await app.request('/api/groups/group123/attachments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invalid: true }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('Geçersiz ek verisi');
  });
});
