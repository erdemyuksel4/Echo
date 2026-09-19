# Echo — İlerleme Durumu (Progress)

Bu dosya her faz ve görev sonunda güncellenir.

## Faz Durum Özeti

| Faz   | Açıklama                                | Durum      | Dal                    | Notlar                                                                     |
| ----- | --------------------------------------- | ---------- | ---------------------- | -------------------------------------------------------------------------- |
| Faz 0 | İskelet (Monorepo, TS, Lint, Test, Dev) | Tamamlandı | `faz-0-iskelet`        | Monorepo, shared paket, sunucu ve masaüstü iskeleti kuruldu, testler geçti |
| Faz 1 | Kimlik, grup, kanal, yazılı sohbet      | Tamamlandı | `faz-1-kimlik-sohbet`  | Ed25519 kimlik, safeStorage, GroupDO SQLite, WebSocket hibernation, UI    |
| Faz 2 | Zengin mesajlaşma ve bildirim           | Başlanmadı | -                      | -                                                                          |
| Faz 3 | Sesli sohbet ve TURN                    | Başlanmadı | -                      | -                                                                          |
| Faz 4 | Medya                                   | Başlanmadı | -                      | -                                                                          |
| Faz 5 | DM                                      | Başlanmadı | -                      | -                                                                          |
| Faz 6 | Ekran paylaşımı (mesh)                  | Başlanmadı | -                      | -                                                                          |
| Faz 7 | SFU (kapılı)                            | Başlanmadı | -                      | -                                                                          |
| Faz 8 | Cilalama ve dağıtım                     | Başlanmadı | -                      | -                                                                          |
| Faz 9 | Kamera (opsiyonel)                      | Başlanmadı | -                      | -                                                                          |

## Faz 0 — Kabul Kriterleri ve Gerçekleşenler

- [x] pnpm workspace yapısı (`apps/desktop`, `apps/server`, `packages/shared`).
- [x] TypeScript `strict: true` ayarları (`tsconfig.base.json` ve paket tsconfig'leri).
- [x] ESLint (flat config) ve Prettier konfigürasyonları.
- [x] `packages/shared`: Zod şeması (`HealthResponseSchema`), sabitler (`PROTOCOL_VERSION`, `APP_NAME`), Vitest birim testi.
- [x] `apps/server`: Cloudflare Worker (`hono` + `wrangler`), `/api/health` endpoint'i, Vitest entegrasyon testi.
- [x] `apps/desktop`: `electron-vite` + React + Tailwind CSS + TypeScript strict. Güvenlik ayarları (`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, tipli preload köprüsü `window.echoApi`, tek örnek kilidi `requestSingleInstanceLock`).
- [x] Kök script'ler: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm dev`, `pnpm format`.
- [x] `.gitignore`: Secret dosyaları (`.dev.vars`, `.env*`), node_modules, derleme çıktıları (`dist`, `out`, `.wrangler`).
- [x] `README.md`: Windows için kurulum ve geliştirme rehberi.

## Faz 1 — Kabul Kriterleri ve Gerçekleşenler

- [x] **Kimlik ve Kripto:**
  - Cihazda Ed25519 anahtar üretimi (`@noble/curves`).
  - Electron `safeStorage` ile DPAPI şifreli yerel saklama (`echo-identity.json`).
  - `userId` türetme: SHA-256(pubkey) ilk 16 baytı base32 kodlaması.
  - Açılış ekranı (görünen ad + renk paleti + gizlilik uyarısı bildirimi).
- [x] **Ortak Şemalar (`@echo/shared`):**
  - `AuthPayloadSchema`, `UserProfileSchema`, `CreateGroupRequestSchema`, `JoinGroupRequestSchema`.
  - `GroupSnapshotSchema`, `ChannelSchema`, `GroupMemberSchema`, `MessageSchema`.
  - WebSocket zarfı (`v: 1, t, id, d`) ve olay sabitleri.
- [x] **Sunucu Mimarisi (`apps/server`):**
  - Cloudflare Durable Objects: `GroupDO` (SQLite tabloları: `group_meta`, `members`, `channels`, `messages`, `invites`).
  - WebSocket Hibernation API (`ctx.acceptWebSocket`, `setWebSocketAutoResponse` ping/pong).
  - İmzalı kimlik doğrulama (`echo-auth|<target>|<ts>`, zaman aşımı kontrolü, üyelik kontrolü).
  - `POST /api/groups`: Grup oluşturma, `ALLOWED_CREATOR_IDS` kontrolü, varsayılan `#genel` kanal ve daimi davet kodu (`ECHO-...`).
  - `POST /api/groups/join`: Davet kodu ile katılma, üyelik ekleme.
  - Token bucket ile mesaj hız sınırlaması (~5 msg/sn).
  - Mesaj gönderme, ULID üretimi, anlık `msg.new` yayını, geçmiş sayfalama (`history.fetch`).
  - "Yazıyor..." göstergesi (3 sn limitli).
  - Online/offline presence yayını.
- [x] **Masaüstü Arayüzü (`apps/desktop`):**
  - Onboarding profil kurulum modalı.
  - Discord yerleşimi: Sol grup barı, kanal listesi, sohbet alanı, üye listesi.
  - Direkt Mesajlar / Ana Sayfa görünümü: Sol menüden ana sayfaya geçildiğinde grup sohbeti yerine özel DM/Arkadaş merkezi görüntüleme.
  - Grup oluşturma ve katılma modalı: Başarılı işlem sonrası otomatik kapanma ve temizleme.
  - Yazıyor göstergesi: Mesaj gönderildiğinde anlık sıfırlanma ve zıplayan 3 nokta animasyonu.
  - Görsel İyileştirmeler: Discord tarzı açılış yükleme ekranı, yumuşak belirsiz (indeterminate) progress bar ve canlı sinyal göstergesi.
  - Otomatik yeniden bağlanma (üstel geri çekilme) ve bağlantı durumu göstergesi.
- [x] **Test Doğrulamaları:**
  - `pnpm typecheck`: Sıfır hata ile geçti.
  - `pnpm lint`: Sıfır hata ile geçti.
  - `pnpm test`: 5 test dosyası, 13 testin tamamı (%100) geçti.
  - Gerçek `wrangler dev` sunucusuna canlı grup oluşturma ve davetle katılma testi başarıyla çalıştırıldı.
