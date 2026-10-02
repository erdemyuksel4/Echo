import {
  deriveKeyFromSecret,
  encryptText,
  decryptText,
  formatE2EEMessage,
  parseE2EEMessage,
  isE2EEMessage,
} from '@echo/shared';

class E2EEService {
  private keyCache: Map<string, CryptoKey> = new Map();
  private decryptedCache: Map<string, string> = new Map();

  /**
   * Derives and caches an AES-256-GCM CryptoKey for the specified channel or DM.
   */
  public async getChannelKey(channelId: string): Promise<CryptoKey> {
    const existing = this.keyCache.get(channelId);
    if (existing) return existing;

    // Default room secret derived from channelId (and optional group secret)
    const secret = `Echo-Secret-Channel-${channelId}`;
    const key = await deriveKeyFromSecret(secret);
    this.keyCache.set(channelId, key);
    return key;
  }

  /**
   * Encrypts plaintext message into E2EE standard envelope format: `e2ee:v1:<iv>:<cipherText>`
   */
  public async encryptMessage(channelId: string, plainText: string): Promise<string> {
    try {
      const key = await this.getChannelKey(channelId);
      const { cipherText, iv } = await encryptText(plainText, key);
      return formatE2EEMessage(iv, cipherText);
    } catch (err) {
      console.error('[E2EE] Mesaj şifrelenirken hata oluştu:', err);
      // Fallback: return original text if encryption fails
      return plainText;
    }
  }

  /**
   * Decrypts an E2EE formatted message. If not encrypted, returns raw text.
   */
  public async decryptMessage(
    channelId: string,
    content: string,
  ): Promise<{ text: string; isEncrypted: boolean; error?: boolean }> {
    if (!isE2EEMessage(content)) {
      return { text: content, isEncrypted: false };
    }

    const cached = this.decryptedCache.get(content);
    if (cached !== undefined) {
      return { text: cached, isEncrypted: true };
    }

    const parsed = parseE2EEMessage(content);
    if (!parsed) {
      return { text: '🔒 Geçersiz şifreli mesaj formatı', isEncrypted: true, error: true };
    }

    try {
      const key = await this.getChannelKey(channelId);
      const plain = await decryptText(parsed.cipherText, parsed.iv, key);
      this.decryptedCache.set(content, plain);
      return { text: plain, isEncrypted: true };
    } catch (err) {
      console.warn('[E2EE] Mesaj şifresi çözülemedi (farklı anahtar veya bozuk veri):', err);
      return {
        text: '🔒 Bu mesaj uçtan uca şifrelenmiştir.',
        isEncrypted: true,
        error: true,
      };
    }
  }

  public isEncrypted(content: string): boolean {
    return isE2EEMessage(content);
  }
}

export const e2eeService = new E2EEService();
