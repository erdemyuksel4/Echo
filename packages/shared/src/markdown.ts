/**
 * Safe Discord-like Markdown parser and sanitizer for Echo
 * Strictly protects against XSS (no script, no javascript:, no onerror execution)
 */

export type MarkdownToken =
  | { type: 'text'; content: string }
  | { type: 'bold'; content: string }
  | { type: 'italic'; content: string }
  | { type: 'strike'; content: string }
  | { type: 'code'; content: string }
  | { type: 'codeblock'; language?: string; content: string }
  | { type: 'spoiler'; content: string }
  | { type: 'mention'; target: string }
  | { type: 'link'; text: string; url: string };

/**
 * Escapes unsafe HTML characters to prevent raw HTML execution
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Sanitizes URLs to strictly allow only http: and https: schemes.
 * Rejects javascript:, data:, vbscript:, and relative malicious protocols.
 */
export function sanitizeUrl(url: string): string | null {
  const trimmed = url.trim();
  // Reject non-http(s) schemes or dangerous patterns
  const protocolMatch = trimmed.match(/^([a-zA-Z0-9+.-]+):/);
  if (protocolMatch && protocolMatch[1]) {
    const proto = protocolMatch[1].toLowerCase();
    if (proto !== 'http' && proto !== 'https') {
      return null;
    }
  } else {
    // Relative URLs or schema-less not allowed as external links
    return null;
  }
  return trimmed;
}

/**
 * Parses markdown into structured tokens for safe React rendering
 */
export function parseMarkdownTokens(rawText: string): MarkdownToken[] {
  if (!rawText) return [];

  const tokens: MarkdownToken[] = [];
  let remaining = rawText;

  // First extract codeblocks (triple backticks)
  const codeBlockRegex = /^```([a-zA-Z0-9_+-]*)\n?([\s\S]*?)```/;
  // Inline tokens regex (with unicode \p{L} support for mentions)
  const inlineRegex =
    /(`([^`]+)`)|(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(__([^_]+)__)|(_([^_]+)_)|(~~([^~]+)~~)|(\|\|([^|]+)\|\|)|(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\))|((https?:\/\/[^\s]+))|(@([\p{L}\p{N}_-]+))/u;

  while (remaining.length > 0) {
    // Check codeblock at current start
    const cbMatch = remaining.match(codeBlockRegex);
    if (cbMatch && cbMatch.index === 0) {
      tokens.push({
        type: 'codeblock',
        language: cbMatch[1] || undefined,
        content: cbMatch[2] ?? '',
      });
      remaining = remaining.slice(cbMatch[0].length);
      continue;
    }

    // Search for next inline pattern
    const match = remaining.match(inlineRegex);
    if (!match || match.index === undefined) {
      tokens.push({ type: 'text', content: remaining });
      break;
    }

    // Add plain text before match
    if (match.index > 0) {
      tokens.push({ type: 'text', content: remaining.slice(0, match.index) });
    }

    const matchedStr = match[0];
    if (matchedStr.startsWith('`') && matchedStr.endsWith('`') && !matchedStr.startsWith('```')) {
      tokens.push({ type: 'code', content: match[2] ?? '' });
    } else if (matchedStr.startsWith('**') && matchedStr.endsWith('**')) {
      tokens.push({ type: 'bold', content: match[4] ?? '' });
    } else if (
      (matchedStr.startsWith('*') && matchedStr.endsWith('*')) ||
      (matchedStr.startsWith('_') && matchedStr.endsWith('_') && !matchedStr.startsWith('__'))
    ) {
      tokens.push({ type: 'italic', content: match[6] ?? match[10] ?? '' });
    } else if (matchedStr.startsWith('~~') && matchedStr.endsWith('~~')) {
      tokens.push({ type: 'strike', content: match[12] ?? '' });
    } else if (matchedStr.startsWith('||') && matchedStr.endsWith('||')) {
      tokens.push({ type: 'spoiler', content: match[14] ?? '' });
    } else if (matchedStr.startsWith('[') && matchedStr.includes('](')) {
      const text = match[16] ?? '';
      const rawUrl = match[17] ?? '';
      const safe = sanitizeUrl(rawUrl);
      if (safe) {
        tokens.push({ type: 'link', text, url: safe });
      } else {
        tokens.push({ type: 'text', content: matchedStr });
      }
    } else if (matchedStr.startsWith('http://') || matchedStr.startsWith('https://')) {
      const safe = sanitizeUrl(matchedStr);
      if (safe) {
        tokens.push({ type: 'link', text: matchedStr, url: safe });
      } else {
        tokens.push({ type: 'text', content: matchedStr });
      }
    } else if (matchedStr.startsWith('@')) {
      tokens.push({ type: 'mention', target: matchedStr.slice(1) });
    } else {
      tokens.push({ type: 'text', content: matchedStr });
    }

    remaining = remaining.slice(match.index + matchedStr.length);
  }

  return tokens;
}

/**
 * Converts markdown text into sanitized, safe HTML for rendering.
 * All raw HTML in user input is escaped, scripts are completely neutralized.
 */
export function renderSafeHtml(rawText: string): string {
  const tokens = parseMarkdownTokens(rawText);
  return tokens
    .map((t) => {
      switch (t.type) {
        case 'text':
          return escapeHtml(t.content);
        case 'bold':
          return `<strong>${escapeHtml(t.content)}</strong>`;
        case 'italic':
          return `<em>${escapeHtml(t.content)}</em>`;
        case 'strike':
          return `<del>${escapeHtml(t.content)}</del>`;
        case 'code':
          return `<code class="bg-slate-800 px-1 py-0.5 rounded text-indigo-300 font-mono text-xs">${escapeHtml(t.content)}</code>`;
        case 'codeblock':
          return `<pre class="bg-slate-950 p-3 rounded-lg my-1.5 overflow-x-auto text-slate-200 font-mono text-xs border border-slate-800"><code>${escapeHtml(t.content)}</code></pre>`;
        case 'spoiler':
          return `<span class="echo-spoiler bg-slate-800 text-transparent hover:text-inherit select-none cursor-pointer rounded px-1 transition-colors" title="Spoiler'ı görmek için tıkla">${escapeHtml(t.content)}</span>`;
        case 'mention':
          return `<span class="echo-mention text-indigo-400 bg-indigo-950/60 font-medium px-1 rounded">@${escapeHtml(t.target)}</span>`;
        case 'link':
          return `<a href="${escapeHtml(t.url)}" target="_blank" rel="noopener noreferrer" class="text-indigo-400 underline hover:text-indigo-300">${escapeHtml(t.text)}</a>`;
      }
    })
    .join('');
}

export interface MediaEmbed {
  originalUrl: string;
  embedUrl: string;
  isGif: boolean;
  title?: string;
}

/**
 * Detects standalone image/GIF links (Giphy, Tenor, direct images) in message text
 * to render Discord-style inline media embeds below the text.
 */
export function extractMediaUrls(rawText: string): MediaEmbed[] {
  if (!rawText) return [];
  const urlRegex = /(https?:\/\/[^\s]+)/gi;
  const matches = rawText.match(urlRegex);
  if (!matches) return [];

  const results: MediaEmbed[] = [];
  const seen = new Set<string>();

  for (const rawUrl of matches) {
    const cleanUrl = rawUrl.replace(/[.,;!?)]+$/, ''); // Strip trailing punctuation
    if (seen.has(cleanUrl)) continue;

    // 1. Direct media URLs (.gif, .png, .jpg, .jpeg, .webp)
    const directMatch = cleanUrl.match(/\.(gif|png|jpe?g|webp)(\?[^\s]*)?$/i);
    if (directMatch) {
      seen.add(cleanUrl);
      const isGif = directMatch[1]?.toLowerCase() === 'gif';
      results.push({
        originalUrl: cleanUrl,
        embedUrl: cleanUrl,
        isGif,
      });
      continue;
    }

    // 2. Giphy direct media URLs (e.g. https://media*.giphy.com/media/.../giphy.gif)
    if (
      /^https?:\/\/(media\d*\.giphy\.com|i\.giphy\.com)\/media\/[a-zA-Z0-9_-]+\/(giphy\.(gif|webp)|source\.gif)/i.test(
        cleanUrl,
      )
    ) {
      seen.add(cleanUrl);
      results.push({
        originalUrl: cleanUrl,
        embedUrl: cleanUrl,
        isGif: true,
      });
      continue;
    }

    // 3. Giphy web page URLs (e.g. https://giphy.com/gifs/funny-cat-3oEjI6SIIHBdRxXI40 or https://giphy.com/gifs/3oEjI6SIIHBdRxXI40)
    const giphyWebMatch = cleanUrl.match(
      /^https?:\/\/giphy\.com\/gifs\/(?:[a-zA-Z0-9_-]+-)?([a-zA-Z0-9]+)/i,
    );
    if (giphyWebMatch && giphyWebMatch[1]) {
      seen.add(cleanUrl);
      const gifId = giphyWebMatch[1];
      results.push({
        originalUrl: cleanUrl,
        embedUrl: `https://media.giphy.com/media/${gifId}/giphy.gif`,
        isGif: true,
      });
      continue;
    }

    // 4. Tenor media URLs (e.g. https://media.tenor.com/.../tenor.gif or c.tenor.com)
    if (/^https?:\/\/(media|c)\.tenor\.com\/[^\s]+(\.gif|\.png|\.webp)?/i.test(cleanUrl)) {
      seen.add(cleanUrl);
      results.push({
        originalUrl: cleanUrl,
        embedUrl: cleanUrl,
        isGif: true,
      });
      continue;
    }
  }

  return results;
}
