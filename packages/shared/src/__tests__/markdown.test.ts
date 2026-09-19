import { describe, it, expect } from 'vitest';
import { parseMarkdownTokens, renderSafeHtml, sanitizeUrl } from '../markdown';

describe('Markdown Sanitizer and Parser', () => {
  it('prevents XSS with raw script tags', () => {
    const malicious = '<script>alert("xss")</script>';
    const safeHtml = renderSafeHtml(malicious);
    expect(safeHtml).not.toContain('<script>');
    expect(safeHtml).toContain('&lt;script&gt;');
  });

  it('prevents XSS with onerror attribute on tags', () => {
    const malicious = '<img src=x onerror="alert(1)">';
    const safeHtml = renderSafeHtml(malicious);
    expect(safeHtml).not.toContain('<img');
    expect(safeHtml).toContain('&lt;img');
  });

  it('neutralizes javascript: pseudoprotocol in links', () => {
    expect(sanitizeUrl('javascript:alert(1)')).toBeNull();
    expect(sanitizeUrl('data:text/html,<script>alert(1)</script>')).toBeNull();
    expect(sanitizeUrl('vbscript:msgbox(1)')).toBeNull();

    const maliciousLink = '[Click me](javascript:alert(1))';
    const safeHtml = renderSafeHtml(maliciousLink);
    expect(safeHtml).not.toContain('href="javascript:');
    expect(safeHtml).not.toContain('<a href=');
  });

  it('allows safe http and https links', () => {
    expect(sanitizeUrl('https://example.com')).toBe('https://example.com');
    expect(sanitizeUrl('http://echo.local:8787')).toBe('http://echo.local:8787');

    const validLink = '[Docs](https://echo.app/docs)';
    const safeHtml = renderSafeHtml(validLink);
    expect(safeHtml).toContain('<a href="https://echo.app/docs"');
    expect(safeHtml).toContain('rel="noopener noreferrer"');
    expect(safeHtml).toContain('>Docs</a>');
  });

  it('parses bold, italic, strikethrough, inline code, and spoilers', () => {
    const markdown = '**bold text** and *italic text* and ~~deleted text~~ with `code snippet` and ||secret||';
    const tokens = parseMarkdownTokens(markdown);

    expect(tokens.some((t) => t.type === 'bold' && t.content === 'bold text')).toBe(true);
    expect(tokens.some((t) => t.type === 'italic' && t.content === 'italic text')).toBe(true);
    expect(tokens.some((t) => t.type === 'strike' && t.content === 'deleted text')).toBe(true);
    expect(tokens.some((t) => t.type === 'code' && t.content === 'code snippet')).toBe(true);
    expect(tokens.some((t) => t.type === 'spoiler' && t.content === 'secret')).toBe(true);
  });

  it('parses code blocks with language', () => {
    const raw = "```typescript\nconst greeting: string = 'Hello Echo';\n```";
    const tokens = parseMarkdownTokens(raw);
    expect(tokens.length).toBe(1);
    const first = tokens[0];
    expect(first).toBeDefined();
    if (first && first.type === 'codeblock') {
      expect(first.language).toBe('typescript');
      expect(first.content).toContain("const greeting: string = 'Hello Echo';");
    }
  });

  it('parses mentions properly', () => {
    const raw = 'Hello @erdem and @everyone';
    const tokens = parseMarkdownTokens(raw);
    const mentions = tokens.filter((t) => t.type === 'mention');
    expect(mentions.length).toBe(2);
    expect(mentions[0]).toEqual({ type: 'mention', target: 'erdem' });
    expect(mentions[1]).toEqual({ type: 'mention', target: 'everyone' });
  });
});
