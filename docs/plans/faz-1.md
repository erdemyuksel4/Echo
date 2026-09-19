# Faz 1 Planı — Kimlik, Grup, Kanal ve Yazılı Sohbet Çekirdeği

## 1. Hedef

Echo'nun çekirdek kimlik ve mesajlaşma mimarisini kurmak:

- **Kimlik:** Cihazda Ed25519 anahtar çifti üretimi, Electron `safeStorage` ile şifreli saklama, `userId` türetme (SHA-256 ilk 16 baytı base32). İlk açılış ekranı (görünen ad, renk, gizlilik uyarısı).
- **Ortak Şemalar (`@echo/shared`):** Kimlik, grup, kanal, mesaj, WebSocket protokol zarfı (`v`, `t`, `id`, `d`) ve olay şemaları (`auth`, `msg.send`, `msg.receive`, `channel.create`, vb.).
- **Sunucu (`apps/server`):**
  - Cloudflare Durable Objects (`GroupDO` ve `UserDO`) SQLite depolaması ve WebSocket Hibernation API (`ctx.acceptWebSocket`).
  - İmzalı kimlik doğrulama (`echo-auth|<target>|<ts>`).
  - `POST /api/groups` (grup oluşturma, `ALLOWED_CREATOR_IDS` kontrolü).
  - Davet kodu üretimi ve `POST /api/groups/:id/join` ile katılma.
  - Kanallar: CRUD ve rol bazlı yetkilendirme (`owner`, `admin`, `member`).
  - Yazılı mesajlar: ULID ile mesaj ID üretimi, SQLite indexleme, son 50 mesaj sayfalama (`before=<id>`), "yazıyor..." (rate limited), presence yayını.
- **Masaüstü Arayüzü (`apps/desktop`):**
  - Profil kurulum ekranı ve yerel kimlik yöneticisi.
  - Discord düzeni: Sol sütun (gruplar + grup oluştur/katıl), kanal listesi (yazı kanalları), ana sohbet alanı (mesaj geçmişi, girdi kutusu, "yazıyor..."), sağ sütun (üye listesi).
  - WebSocket istemcisi: Otomatik yeniden bağlanma (üstel geri çekilme) ve çevrimdışı durum göstergesi.

## 2. Dokunulacak ve Oluşturulacak Dosyalar

- `packages/shared/`:
  - `src/schemas/auth.ts` (Kimlik, imza, anahtar doğrulama şemaları)
  - `src/schemas/group.ts` (Grup, kanal, üyelik, rol şemaları)
  - `src/schemas/message.ts` (Mesaj, reaksiyon, sayfalama şemaları)
  - `src/schemas/protocol.ts` (WebSocket mesaj zarfı ve olay tipleri)
  - `src/crypto/identity.ts` (Ed25519 ve base32 kimlik yardımcıları)
  - `src/__tests__/crypto.test.ts`, `src/__tests__/protocol.test.ts`
- `apps/server/`:
  - `wrangler.toml` (Durable Object bağlamaları ve SQLite migrations)
  - `src/index.ts` (Hono rotaları: `/api/groups`, `/api/groups/:id/join`, `/ws/group/:id`, `/ws/user`)
  - `src/durable/GroupDO.ts` (Group Durable Object: WebSocket hibernation, SQLite CRUD, auth, presence)
  - `src/durable/UserDO.ts` (User Durable Object: Üyelikler, DM ön hazırlığı)
  - `test/auth.spec.ts`, `test/group.spec.ts`, `test/message.spec.ts`
- `apps/desktop/`:
  - `src/main/crypto.ts` (Electron `safeStorage` ve anahtar saklama)
  - `src/preload/index.ts` ve `src/preload/index.d.ts` (IPC kimlik ve depolama köprüsü)
  - `src/renderer/src/stores/` (Zustand: authStore, chatStore, groupStore)
  - `src/renderer/src/services/websocket.ts` (WebSocket yöneticisi, reconnection)
  - `src/renderer/src/components/` (Onboarding, Sidebar, ChannelList, ChatArea, MemberList)

## 3. Riskler ve Önlemler

- **Cloudflare Hibernation API & CPU Limiti:** `ws.accept()` ve `setInterval` yerine `ctx.acceptWebSocket` ve ping/pong için `setWebSocketAutoResponse` kullanılacak.
- **İmza Güvenliği:** Zaman damgası (`ts`) ±60 saniye aralığında kontrol edilecek, replay atakları engellenecek.
- **Electron safeStorage Kullanılabilirliği:** Linux/dev ortamlarında fallback mekanizması sağlanacak, fakat Windows'ta DPAPI destekli `safeStorage` aktif olacak.
- **Mesaj Boyutu & Rate Limiting:** Sunucuda mesajlar 4.000 karakterle sınırlanacak, kullanıcı başına ~5 msg/sn bellek içi token bucket uygulanacak.

## 4. Test Yöntemi

1. `pnpm typecheck` ve `pnpm lint` ile tam statik doğrulama.
2. Vitest ile kripto anahtar üretimi/imzalaması, Zod şema doğrulamaları, GroupDO yetki kontrolleri ve imza doğrulama testleri.
3. Sunucu yerel testleri (`wrangler dev`): grup oluşturma, davet kodu ile katılma, WebSocket auth ve mesaj gönderme senaryoları.
4. Masaüstü uygulamasının çalıştırılması, profil oluşturulması, grup ve kanal oluşturup mesajlaşılması.
