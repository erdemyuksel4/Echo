import { ed25519 } from '@noble/curves/ed25519';
import { sha256 } from '@noble/hashes/sha256';

export { sha256 };

// RFC 4648 Base32 alphabet (without padding)
const BASE32_ALPHABET = 'abcdefghijklmnopqrstuvwxyz234567';

export function bytesToBase32(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i];
    if (byte === undefined) continue;
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

export function base32ToBytes(str: string): Uint8Array {
  const cleaned = str.toLowerCase();
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i];
    if (!char) continue;
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) {
      throw new Error(`Invalid base32 character: ${char}`);
    }
    value = (value << 5) | index;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return new Uint8Array(bytes);
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error('Invalid hex string');
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

export interface KeyPair {
  publicKey: Uint8Array; // 32 bytes
  privateKey: Uint8Array; // 32 bytes
  publicKeyHex: string;
  privateKeyHex: string;
}

/**
 * Generates an Ed25519 keypair
 */
export function generateKeyPair(): KeyPair {
  const privateKey = ed25519.utils.randomPrivateKey();
  const publicKey = ed25519.getPublicKey(privateKey);
  return {
    privateKey,
    publicKey,
    privateKeyHex: bytesToHex(privateKey),
    publicKeyHex: bytesToHex(publicKey),
  };
}

/**
 * Derives userId from public key:
 * userId = first 16 bytes of SHA-256(publicKey) encoded as base32
 */
export function deriveUserId(publicKey: Uint8Array | string): string {
  const pubBytes = typeof publicKey === 'string' ? hexToBytes(publicKey) : publicKey;
  const hash = sha256(pubBytes);
  const first16 = hash.slice(0, 16);
  return bytesToBase32(first16);
}

/**
 * Signs payload using Ed25519 private key
 */
export function signMessage(message: Uint8Array | string, privateKey: Uint8Array | string): string {
  const privBytes = typeof privateKey === 'string' ? hexToBytes(privateKey) : privateKey;
  const msgBytes = typeof message === 'string' ? new TextEncoder().encode(message) : message;
  const signature = ed25519.sign(msgBytes, privBytes);
  return bytesToHex(signature);
}

/**
 * Verifies Ed25519 signature
 */
export function verifySignature(
  message: Uint8Array | string,
  signatureHex: string,
  publicKey: Uint8Array | string,
): boolean {
  try {
    const pubBytes = typeof publicKey === 'string' ? hexToBytes(publicKey) : publicKey;
    const sigBytes = hexToBytes(signatureHex);
    const msgBytes = typeof message === 'string' ? new TextEncoder().encode(message) : message;
    return ed25519.verify(sigBytes, msgBytes, pubBytes);
  } catch {
    return false;
  }
}

/**
 * Builds standard auth signature payload for WebSocket
 */
export function buildAuthPayload(targetId: string, timestamp: number): string {
  return `echo-auth|${targetId}|${timestamp}`;
}
