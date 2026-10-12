import { x25519 } from '@noble/curves/ed25519';
import { bytesToHex, hexToBytes } from './identity';
import { deriveKeyFromSecret, encryptText, decryptText } from './e2ee';
import type { TransferredIdentity } from '../schemas/deviceLink';

export interface X25519KeyPair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
  publicKeyHex: string;
  privateKeyHex: string;
}

/**
 * X25519 geçici anahtar çifti üretir (Diffie-Hellman için).
 */
export function generateX25519KeyPair(): X25519KeyPair {
  const privateKey = x25519.utils.randomPrivateKey();
  const publicKey = x25519.getPublicKey(privateKey);
  return {
    privateKey,
    publicKey,
    privateKeyHex: bytesToHex(privateKey),
    publicKeyHex: bytesToHex(publicKey),
  };
}

/**
 * İki tarafın X25519 anahtarlarından ortak gizli sırrı (shared secret) hesaplar.
 */
export function computeSharedSecretHex(myPrivateKeyHex: string, theirPublicKeyHex: string): string {
  const myPriv = hexToBytes(myPrivateKeyHex);
  const theirPub = hexToBytes(theirPublicKeyHex);
  const shared = x25519.getSharedSecret(myPriv, theirPub);
  return bytesToHex(shared);
}

/**
 * Kimlik nesnesini ortak sır ile AES-256-GCM kullanarak şifreler.
 */
export async function encryptIdentity(
  identity: TransferredIdentity,
  sharedSecretHex: string,
): Promise<{ iv: string; cipherText: string }> {
  const cryptoKey = await deriveKeyFromSecret(sharedSecretHex, 'Echo-DeviceLink-Salt-2026');
  const jsonStr = JSON.stringify(identity);
  return encryptText(jsonStr, cryptoKey);
}

/**
 * Şifreli paketi ortak sır ile çözerek kimlik nesnesine dönüştürür.
 */
export async function decryptIdentity(
  encrypted: { iv: string; cipherText: string },
  sharedSecretHex: string,
): Promise<TransferredIdentity> {
  const cryptoKey = await deriveKeyFromSecret(sharedSecretHex, 'Echo-DeviceLink-Salt-2026');
  const jsonStr = await decryptText(encrypted.cipherText, encrypted.iv, cryptoKey);
  return JSON.parse(jsonStr) as TransferredIdentity;
}
