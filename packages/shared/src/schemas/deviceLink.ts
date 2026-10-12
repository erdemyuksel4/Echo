import { z } from 'zod';

export const DeviceLinkStatusSchema = z.enum([
  'pending',   // Oturum açıldı, kod/QR üretildi, bağlantı bekleniyor
  'claimed',   // Cihaz A kodu girdi, Cihaz A'da onay penceresi açık, onay bekleniyor
  'approved',  // Cihaz A onay verdi, şifreli kimlik paketi yüklendi
  'rejected',  // Cihaz A isteği reddetti
  'expired',   // 5 dakikalık süre doldu
]);

export type DeviceLinkStatus = z.infer<typeof DeviceLinkStatusSchema>;

// Yeni Cihaz (Cihaz B) oturum başlatırken
export const DeviceLinkInitRequestSchema = z.object({
  tempPublicKeyHex: z.string().min(64).max(64), // X25519 public key (32 bytes = 64 hex chars)
  deviceInfo: z.string().max(100).default('Yeni Cihaz'),
});
export type DeviceLinkInitRequest = z.infer<typeof DeviceLinkInitRequestSchema>;

export const DeviceLinkInitResponseSchema = z.object({
  sessionId: z.string(),
  linkCode: z.string().min(6).max(8), // örn: "849213" veya "849-213"
  expiresAt: z.number(),
});
export type DeviceLinkInitResponse = z.infer<typeof DeviceLinkInitResponseSchema>;

// Cihaz A (giriş yapmış olan) kodu girerek oturumu sorgular ve talep eder
export const DeviceLinkClaimRequestSchema = z.object({
  linkCode: z.string().min(4).max(10),
  claimerDisplayName: z.string().min(1).max(50),
  claimerDeviceInfo: z.string().max(100).default('Echo Masaüstü'),
});
export type DeviceLinkClaimRequest = z.infer<typeof DeviceLinkClaimRequestSchema>;

export const DeviceLinkClaimResponseSchema = z.object({
  sessionId: z.string(),
  targetTempPublicKeyHex: z.string(),
  targetDeviceInfo: z.string(),
  expiresAt: z.number(),
});
export type DeviceLinkClaimResponse = z.infer<typeof DeviceLinkClaimResponseSchema>;

// Cihaz A onay verdiğinde sunucuya şifrelenmiş kimliği iletir
export const DeviceLinkApproveRequestSchema = z.object({
  sessionId: z.string(),
  claimerTempPublicKeyHex: z.string().min(64).max(64), // Cihaz A'nın X25519 public key'i
  encryptedPayload: z.object({
    iv: z.string(),
    cipherText: z.string(),
  }),
});
export type DeviceLinkApproveRequest = z.infer<typeof DeviceLinkApproveRequestSchema>;

// Cihaz A isteği reddettiğinde
export const DeviceLinkRejectRequestSchema = z.object({
  sessionId: z.string(),
});
export type DeviceLinkRejectRequest = z.infer<typeof DeviceLinkRejectRequestSchema>;

// Cihaz B'nin durum sorgusu veya WebSocket durum yanıtı
export const DeviceLinkSessionStateSchema = z.object({
  sessionId: z.string(),
  status: DeviceLinkStatusSchema,
  expiresAt: z.number(),
  targetDeviceInfo: z.string(),
  claimerDisplayName: z.string().optional(),
  claimerDeviceInfo: z.string().optional(),
  claimerTempPublicKeyHex: z.string().optional(),
  encryptedPayload: z
    .object({
      iv: z.string(),
      cipherText: z.string(),
    })
    .optional(),
});
export type DeviceLinkSessionState = z.infer<typeof DeviceLinkSessionStateSchema>;

// Aktarılan kimliğin çözülmüş hali
export const TransferredIdentitySchema = z.object({
  userId: z.string(),
  displayName: z.string(),
  avatarColor: z.string(),
  publicKeyHex: z.string(),
  privateKeyHex: z.string(),
  createdAt: z.number(),
});
export type TransferredIdentity = z.infer<typeof TransferredIdentitySchema>;
