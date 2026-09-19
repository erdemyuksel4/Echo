import { app, safeStorage } from 'electron';
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import {
  generateKeyPair,
  deriveUserId,
  signMessage,
  buildAuthPayload,
  type UserProfile,
} from '@echo/shared';

interface StoredIdentity {
  userId: string;
  displayName: string;
  avatarColor: string;
  publicKeyHex: string;
  encryptedPrivateKeyHex: string;
  createdAt: number;
}

export class IdentityManager {
  private identityPath: string;

  constructor() {
    this.identityPath = join(app.getPath('userData'), 'echo-identity.json');
  }

  getIdentity(): (UserProfile & { publicKeyHex: string }) | null {
    if (!existsSync(this.identityPath)) return null;

    try {
      const raw = readFileSync(this.identityPath, 'utf8');
      const data = JSON.parse(raw) as StoredIdentity;
      return {
        userId: data.userId,
        displayName: data.displayName,
        avatarColor: data.avatarColor,
        publicKeyHex: data.publicKeyHex,
        createdAt: data.createdAt,
      };
    } catch {
      return null;
    }
  }

  createIdentity(displayName: string, avatarColor: string): UserProfile & { publicKeyHex: string } {
    const keypair = generateKeyPair();
    const userId = deriveUserId(keypair.publicKey);
    const now = Date.now();

    // Encrypt private key with safeStorage if available
    let encryptedPrivKeyHex: string;
    if (safeStorage.isEncryptionAvailable()) {
      const encryptedBuffer = safeStorage.encryptString(keypair.privateKeyHex);
      encryptedPrivKeyHex = encryptedBuffer.toString('hex');
    } else {
      // Fallback for environments where safeStorage is unavailable
      encryptedPrivKeyHex = Buffer.from(keypair.privateKeyHex).toString('base64');
    }

    const stored: StoredIdentity = {
      userId,
      displayName,
      avatarColor,
      publicKeyHex: keypair.publicKeyHex,
      encryptedPrivateKeyHex: encryptedPrivKeyHex,
      createdAt: now,
    };

    writeFileSync(this.identityPath, JSON.stringify(stored, null, 2), 'utf8');

    return {
      userId,
      displayName,
      avatarColor,
      publicKeyHex: keypair.publicKeyHex,
      createdAt: now,
    };
  }

  private getPrivateKeyHex(): string | null {
    if (!existsSync(this.identityPath)) return null;
    try {
      const raw = readFileSync(this.identityPath, 'utf8');
      const data = JSON.parse(raw) as StoredIdentity;

      if (safeStorage.isEncryptionAvailable()) {
        const encryptedBuffer = Buffer.from(data.encryptedPrivateKeyHex, 'hex');
        return safeStorage.decryptString(encryptedBuffer);
      } else {
        return Buffer.from(data.encryptedPrivateKeyHex, 'base64').toString('utf8');
      }
    } catch {
      return null;
    }
  }

  signAuth(
    targetId: string,
    timestamp: number,
  ): { sig: string; pubkey: string; userId: string } | null {
    const privKeyHex = this.getPrivateKeyHex();
    const identity = this.getIdentity();
    if (!privKeyHex || !identity) return null;

    const payload = buildAuthPayload(targetId, timestamp);
    const sig = signMessage(payload, privKeyHex);

    return {
      sig,
      pubkey: identity.publicKeyHex,
      userId: identity.userId,
    };
  }

  signPayload(payload: string): { sig: string; pubkey: string; userId: string } | null {
    const privKeyHex = this.getPrivateKeyHex();
    const identity = this.getIdentity();
    if (!privKeyHex || !identity) return null;

    const sig = signMessage(payload, privKeyHex);
    return {
      sig,
      pubkey: identity.publicKeyHex,
      userId: identity.userId,
    };
  }
}
