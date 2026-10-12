import { describe, it, expect } from 'vitest';
import {
  generateX25519KeyPair,
  computeSharedSecretHex,
  encryptIdentity,
  decryptIdentity,
  DeviceLinkInitRequestSchema,
  DeviceLinkInitResponseSchema,
  DeviceLinkClaimRequestSchema,
  DeviceLinkClaimResponseSchema,
  DeviceLinkApproveRequestSchema,
  DeviceLinkSessionStateSchema,
  TransferredIdentity,
} from '../index';

describe('DeviceLink E2EE Handshake and Crypto', () => {
  it('should generate valid X25519 keypairs', () => {
    const kp = generateX25519KeyPair();
    expect(kp.publicKeyHex).toHaveLength(64);
    expect(kp.privateKeyHex).toHaveLength(64);
    expect(kp.publicKey.length).toBe(32);
    expect(kp.privateKey.length).toBe(32);
  });

  it('should derive identical shared secret from two independent keypairs (Diffie-Hellman)', () => {
    const deviceB = generateX25519KeyPair();
    const deviceA = generateX25519KeyPair();

    const secretAB = computeSharedSecretHex(deviceA.privateKeyHex, deviceB.publicKeyHex);
    const secretBA = computeSharedSecretHex(deviceB.privateKeyHex, deviceA.publicKeyHex);

    expect(secretAB).toBe(secretBA);
    expect(secretAB).toHaveLength(64);
  });

  it('should encrypt identity on device A and successfully decrypt on device B with zero leak', async () => {
    const deviceB = generateX25519KeyPair(); // Yeni cihaz
    const deviceA = generateX25519KeyPair(); // Giriş yapılmış cihaz

    const mockIdentity: TransferredIdentity = {
      userId: 'testuser12345678',
      displayName: 'Erdem Test',
      avatarColor: '#4f46e5',
      publicKeyHex: '11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff',
      privateKeyHex: 'aabbccddeeff11223344556677889900aabbccddeeff11223344556677889900',
      createdAt: Date.now(),
    };

    // Cihaz A ortak sırrı hesaplar ve kimliği şifreler
    const secretA = computeSharedSecretHex(deviceA.privateKeyHex, deviceB.publicKeyHex);
    const encrypted = await encryptIdentity(mockIdentity, secretA);

    expect(encrypted.iv).toBeDefined();
    expect(encrypted.cipherText).toBeDefined();
    expect(encrypted.cipherText).not.toContain('Erdem Test');
    expect(encrypted.cipherText).not.toContain(mockIdentity.privateKeyHex);

    // Cihaz B ortak sırrı hesaplar ve şifreyi çözer
    const secretB = computeSharedSecretHex(deviceB.privateKeyHex, deviceA.publicKeyHex);
    const decrypted = await decryptIdentity(encrypted, secretB);

    expect(decrypted).toEqual(mockIdentity);
  });

  it('should validate schemas correctly', () => {
    const initReq = DeviceLinkInitRequestSchema.parse({
      tempPublicKeyHex: 'a'.repeat(64),
      deviceInfo: 'Echo Desktop v0.1.x',
    });
    expect(initReq.tempPublicKeyHex).toBe('a'.repeat(64));

    const initRes = DeviceLinkInitResponseSchema.parse({
      sessionId: 'sess_123',
      linkCode: '849-213',
      expiresAt: Date.now() + 300_000,
    });
    expect(initRes.linkCode).toBe('849-213');

    const claimReq = DeviceLinkClaimRequestSchema.parse({
      linkCode: '849-213',
      claimerDisplayName: 'Erdem',
      claimerDeviceInfo: 'Windows PC',
    });
    expect(claimReq.claimerDisplayName).toBe('Erdem');

    const claimRes = DeviceLinkClaimResponseSchema.parse({
      sessionId: 'sess_123',
      targetTempPublicKeyHex: 'b'.repeat(64),
      targetDeviceInfo: 'Yeni Cihaz',
      expiresAt: Date.now() + 300_000,
    });
    expect(claimRes.targetDeviceInfo).toBe('Yeni Cihaz');

    const approveReq = DeviceLinkApproveRequestSchema.parse({
      sessionId: 'sess_123',
      claimerTempPublicKeyHex: 'a'.repeat(64),
      encryptedPayload: {
        iv: 'iv_val',
        cipherText: 'cipher_val',
      },
    });
    expect(approveReq.sessionId).toBe('sess_123');

    const state = DeviceLinkSessionStateSchema.parse({
      sessionId: 'sess_123',
      status: 'pending',
      expiresAt: Date.now() + 300_000,
      targetDeviceInfo: 'Yeni Cihaz',
    });
    expect(state.status).toBe('pending');
  });
});
