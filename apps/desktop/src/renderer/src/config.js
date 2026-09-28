// Centralized server configuration for Echo Desktop
// In local development, it points to http://localhost:8787.
// In production, configure your deployed Cloudflare Worker URL here or via VITE_SERVER_URL.
export const SERVER_HTTP_URL = import.meta.env.VITE_SERVER_URL ||
    'https://echo-server.erdemyuksel04.workers.dev';
export const SERVER_WS_URL = SERVER_HTTP_URL.startsWith('https')
    ? SERVER_HTTP_URL.replace(/^https/, 'wss')
    : SERVER_HTTP_URL.replace(/^http/, 'ws');
