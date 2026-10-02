import { describe, it, expect } from 'vitest';
import {
  generateKeyPair,
  deriveUserId,
  signMessage,
  verifySignature,
  buildAuthPayload,
  bytesToBase32,
  base32ToBytes,
  deriveKeyFromSecret,
  encryptText,
  decryptText,
  formatE2EEMessage,
  isE2EEMessage,
  parseE2EEMessage,
} from '../index';

describe('Crypto & Identity Helpers', () => {
  it('should generate valid Ed25519 keypair and derive userId', () => {
    const keypair = generateKeyPair();
    expect(keypair.publicKey.length).toBe(32);
    expect(keypair.privateKey.length).toBe(32);
    expect(keypair.publicKeyHex.length).toBe(64);

    const userId = deriveUserId(keypair.publicKey);
    expect(userId.length).toBeGreaterThan(10);

    // Deriving from hex should match
    const userIdFromHex = deriveUserId(keypair.publicKeyHex);
    expect(userIdFromHex).toBe(userId);
  });

  it('should sign and verify valid auth payload', () => {
    const keypair = generateKeyPair();
    const ts = Date.now();
    const payload = buildAuthPayload('test-group-id', ts);

    const sigHex = signMessage(payload, keypair.privateKey);
    expect(sigHex.length).toBe(128); // 64 bytes in hex

    const isValid = verifySignature(payload, sigHex, keypair.publicKey);
    expect(isValid).toBe(true);

    // Tampered payload must fail
    const isInvalid = verifySignature(payload + 'tampered', sigHex, keypair.publicKey);
    expect(isInvalid).toBe(false);

    // Other key must fail
    const anotherKeypair = generateKeyPair();
    const isOtherKeyValid = verifySignature(payload, sigHex, anotherKeypair.publicKey);
    expect(isOtherKeyValid).toBe(false);
  });

  it('should roundtrip base32 encoding/decoding', () => {
    const sampleBytes = new Uint8Array([1, 2, 3, 4, 5, 250, 255]);
    const encoded = bytesToBase32(sampleBytes);
    const decoded = base32ToBytes(encoded);
    expect(Array.from(decoded)).toEqual(Array.from(sampleBytes));
  });

  it('should encrypt and decrypt messages with E2EE (AES-256-GCM)', async () => {
    const secret = 'my-super-secret-channel-key';
    const key = await deriveKeyFromSecret(secret);

    const message = 'Merhaba! Bu çok gizli bir Echo mesajıdır 🔒';
    const { cipherText, iv } = await encryptText(message, key);

    const formatted = formatE2EEMessage(iv, cipherText);
    expect(isE2EEMessage(formatted)).toBe(true);

    const parsed = parseE2EEMessage(formatted);
    expect(parsed).not.toBeNull();
    expect(parsed!.iv).toBe(iv);
    expect(parsed!.cipherText).toBe(cipherText);

    const decrypted = await decryptText(parsed!.cipherText, parsed!.iv, key);
    expect(decrypted).toBe(message);

    // Decrypting with wrong key must fail (tamper resistance)
    const wrongKey = await deriveKeyFromSecret('wrong-secret-key');
    await expect(decryptText(parsed!.cipherText, parsed!.iv, wrongKey)).rejects.toThrow();
  });
});
