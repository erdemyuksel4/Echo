import QRCode from 'qrcode';
import {
  generateX25519KeyPair,
  computeSharedSecretHex,
  encryptIdentity,
  decryptIdentity,
  type X25519KeyPair,
  type DeviceLinkInitResponse,
  type DeviceLinkClaimResponse,
  type DeviceLinkSessionState,
} from '@echo/shared';
import { SERVER_HTTP_URL } from '../config';
import { useAuthStore } from '../stores/useAuthStore';

export interface DeviceLinkInitResult extends DeviceLinkInitResponse {
  qrDataUrl: string;
  qrPayload: string;
  keypair: X25519KeyPair;
}

export class DeviceLinkService {
  /**
   * Yeni cihazda (Cihaz B) eşleme oturumu başlatır ve QR kod üretir.
   */
  async initSession(): Promise<DeviceLinkInitResult> {
    const keypair = generateX25519KeyPair();

    const res = await fetch(`${SERVER_HTTP_URL}/api/auth/link/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tempPublicKeyHex: keypair.publicKeyHex,
        deviceInfo: 'Echo Masaüstü',
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Oturum başlatılamadı');
    }

    const data = (await res.json()) as DeviceLinkInitResponse;

    // QR Kod içeriği: uygulama bağlantısı formatında
    const qrPayload = `echo-link://${data.sessionId}?code=${data.linkCode}&key=${keypair.publicKeyHex}`;

    // SVG / Canvas QR Kod veri URL'i oluştur (karanlık temaya uyumlu)
    const qrDataUrl = await QRCode.toDataURL(qrPayload, {
      width: 256,
      margin: 2,
      color: {
        dark: '#ffffff',
        light: '#0f172a', // slate-900
      },
    });

    return {
      ...data,
      qrDataUrl,
      qrPayload,
      keypair,
    };
  }

  /**
   * Cihaz B'nin oturum durumunu sorgular (Polling).
   */
  async pollStatus(sessionId: string): Promise<DeviceLinkSessionState> {
    const res = await fetch(`${SERVER_HTTP_URL}/api/auth/link/status/${sessionId}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Oturum durumu alınamadı');
    }
    return (await res.json()) as DeviceLinkSessionState;
  }

  /**
   * Cihaz B oturum onaylandığında kimliği çözer ve içeri aktarır.
   */
  async completeTransfer(
    sessionState: DeviceLinkSessionState,
    myKeyPair: X25519KeyPair,
  ): Promise<boolean> {
    if (
      sessionState.status !== 'approved' ||
      !sessionState.encryptedPayload ||
      !sessionState.claimerTempPublicKeyHex
    ) {
      return false;
    }

    const sharedSecret = computeSharedSecretHex(
      myKeyPair.privateKeyHex,
      sessionState.claimerTempPublicKeyHex,
    );

    const transferredIdentity = await decryptIdentity(
      sessionState.encryptedPayload,
      sharedSecret,
    );

    await useAuthStore.getState().importTransferredIdentity(transferredIdentity);
    return true;
  }

  /**
   * Giriş yapılmış cihazda (Cihaz A) 6 haneli kodu girerek hedef oturumu çeker.
   */
  async claimCode(
    linkCode: string,
    claimerDisplayName: string,
  ): Promise<DeviceLinkClaimResponse> {
    const res = await fetch(`${SERVER_HTTP_URL}/api/auth/link/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        linkCode,
        claimerDisplayName,
        claimerDeviceInfo: 'Echo Masaüstü',
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Kod doğrulanamadı veya süresi dolmuş');
    }

    return (await res.json()) as DeviceLinkClaimResponse;
  }

  /**
   * Cihaz A oturuma onay verir: Mevcut kimliği E2EE şifreleyerek yükler.
   */
  async approveSession(
    sessionId: string,
    targetTempPublicKeyHex: string,
  ): Promise<void> {
    if (!window.echoApi?.exportFullIdentity) {
      throw new Error('Mevcut kimlik dışa aktarılamadı');
    }

    const fullIdentity = await window.echoApi.exportFullIdentity();
    if (!fullIdentity) {
      throw new Error('Aktarılacak kimlik bulunamadı');
    }

    // Cihaz A ephemeral X25519 anahtar çifti üretir
    const myKp = generateX25519KeyPair();
    const sharedSecret = computeSharedSecretHex(myKp.privateKeyHex, targetTempPublicKeyHex);

    // E2EE AES-GCM ile kimliği şifrele
    const encrypted = await encryptIdentity(fullIdentity, sharedSecret);

    const res = await fetch(`${SERVER_HTTP_URL}/api/auth/link/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        claimerTempPublicKeyHex: myKp.publicKeyHex,
        encryptedPayload: encrypted,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Onay gönderilemedi');
    }
  }

  /**
   * Cihaz A oturumu reddeder.
   */
  async rejectSession(sessionId: string): Promise<void> {
    const res = await fetch(`${SERVER_HTTP_URL}/api/auth/link/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Reddedilemedi');
    }
  }
}

export const deviceLinkService = new DeviceLinkService();
