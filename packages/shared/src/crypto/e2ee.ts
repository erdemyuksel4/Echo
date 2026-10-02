// End-to-End Encryption (E2EE) Module using AES-256-GCM
// Standard Web Crypto API compatible (Node 16+, Browsers, Cloudflare Workers)

const E2EE_PREFIX = 'e2ee:v1:';

function getCrypto(): Crypto {
  if (typeof globalThis.crypto !== 'undefined') {
    return globalThis.crypto;
  }
  throw new Error('Web Crypto API bulunamadı');
}

export function isE2EEMessage(content: string): boolean {
  return typeof content === 'string' && content.startsWith(E2EE_PREFIX);
}

export function parseE2EEMessage(content: string): { iv: string; cipherText: string } | null {
  if (!isE2EEMessage(content)) return null;
  const parts = content.slice(E2EE_PREFIX.length).split(':');
  if (parts.length < 2) return null;
  const [iv, ...rest] = parts;
  return {
    iv: iv || '',
    cipherText: rest.join(':'),
  };
}

export function formatE2EEMessage(iv: string, cipherText: string): string {
  return `${E2EE_PREFIX}${iv}:${cipherText}`;
}

export async function deriveKeyFromSecret(secret: string, salt = 'Echo-E2EE-Salt-2026'): Promise<CryptoKey> {
  const crypto = getCrypto();
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: enc.encode(salt),
      iterations: 100_000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptText(
  plainText: string,
  key: CryptoKey,
): Promise<{ cipherText: string; iv: string }> {
  const crypto = getCrypto();
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit standard IV for AES-GCM
  const encoded = new TextEncoder().encode(plainText);

  const encryptedBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv as unknown as BufferSource,
    },
    key,
    encoded,
  );

  const ivBase64 = uint8ArrayToBase64(iv);
  const cipherBase64 = uint8ArrayToBase64(new Uint8Array(encryptedBuffer));

  return {
    iv: ivBase64,
    cipherText: cipherBase64,
  };
}

export async function decryptText(
  cipherTextBase64: string,
  ivBase64: string,
  key: CryptoKey,
): Promise<string> {
  const crypto = getCrypto();
  const iv = base64ToUint8Array(ivBase64);
  const cipherBytes = base64ToUint8Array(cipherTextBase64);

  const decryptedBuffer = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv as unknown as BufferSource,
    },
    key,
    cipherBytes as unknown as BufferSource,
  );

  return new TextDecoder().decode(decryptedBuffer);
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  if (typeof btoa !== 'undefined') {
    return btoa(binary);
  }
  const nodeBuffer = (globalThis as unknown as { Buffer?: { from: (b: Uint8Array) => { toString: (enc: string) => string } } }).Buffer;
  if (nodeBuffer) {
    return nodeBuffer.from(bytes).toString('base64');
  }
  return '';
}

function base64ToUint8Array(base64: string): Uint8Array {
  if (typeof atob !== 'undefined') {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }
  const nodeBuffer = (globalThis as unknown as { Buffer?: { from: (str: string, enc: string) => Uint8Array } }).Buffer;
  if (nodeBuffer) {
    return new Uint8Array(nodeBuffer.from(base64, 'base64'));
  }
  return new Uint8Array();
}
