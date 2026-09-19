# Echo — İlerleme Durumu (Progress)

Bu dosya her faz ve görev sonunda güncellenir.

## Faz Durum Özeti

| Faz   | Açıklama                                | Durum      | Dal                    | Notlar                                                                     |
| ----- | --------------------------------------- | ---------- | ---------------------- | -------------------------------------------------------------------------- |
| Faz 0 | İskelet (Monorepo, TS, Lint, Test, Dev) | Tamamlandı | `faz-0-iskelet`        | Monorepo, shared paket, sunucu ve masaüstü iskeleti kuruldu, testler geçti |
| Faz 1 | Kimlik, grup, kanal, yazılı sohbet      | Tamamlandı | `faz-1-kimlik-sohbet`  | Ed25519 kimlik, safeStorage, GroupDO SQLite, WebSocket hibernation, UI    |
| Faz 2 | Zengin mesajlaşma ve bildirim           | Tamamlandı | `faz-2-zengin-mesajlasma` | Yanıtla, düzenle, sil, emoji tepkisi, safe Markdown/spoiler, tray, ses, bildirim |
| Faz 3 | Sesli sohbet ve TURN                    | Tamamlandı | `faz-3-sesli-sohbet`   | WebRTC Tam Mesh, Cloudflare STUN/TURN, VAD konuşma halkası, ses paneli ve bağlantı tanı modalı |
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

## Faz 2 — Kabul Kriterleri ve Gerçekleşenler

- [x] **Zengin Mesajlaşma (`@echo/shared`):**
  - Mesaj şemasına yanıt (`replyTo`, `replyToAuthorName`, `replyToContent`), düzenleme (`editedAt`), silme (`deleted`) ve emoji tepkileri (`reactions: Record<string, string[]>`) alanları eklendi.
  - Güvenli Markdown ayrıştırıcı (`parseMarkdownTokens`, `renderSafeHtml`): XSS açıklarına karşı (`<script>`, `onerror`, `javascript:`, `data:`) tam koruma.
  - Discord tarzı biçimlendirme: Kalın (`**`), İtalik (`*` / `_`), Üstü çizili (`~~`), Satır içi kod (`` ` ``), Kod bloğu (```` ``` ````), Tıklanabilir Spoiler (`||...||`), Otomatik ve etiketli güvenli bağlantılar, `@kullanıcı` ve `@everyone` anmaları.
- [x] **Sunucu Mimarisi (`apps/server`):**
  - SQLite `reactions` tablosu (`message_id, user_id, emoji`).
  - Mesaj tablosu şema göçü (`reply_to_author_name`, `reply_to_content`).
  - `msg.edit` işleyicisi: Yalnızca mesaj sahibinin düzenleyebilmesi, anlık `msg.updated` yayını.
  - `msg.delete` işleyicisi: Mesaj sahibi, kanal veya grup yöneticisinin silebilmesi, anlık `msg.deleted` yayını.
  - `react.add` ve `react.remove` işleyicileri: Emoji tepkisi ekleme/çıkarma, anlık `react.updated` yayını.
  - 90 günlük mesaj saklama ve yetim tepki temizliği için Cloudflare Durable Object `alarm()` rutini.
- [x] **Masaüstü Entegrasyonu ve Arayüz (`apps/desktop`):**
  - Mesaj üzerine gelindiğinde çıkan Discord tarzı işlem barı (Hızlı emojiler, Yanıtla, Düzenle, Sil).
  - Giriş kutusu üzerinde alıntılı yanıt önizleme çubuğu.
  - Satır içi mesaj düzenleme kutusu (Enter ile kaydet, Esc ile iptal) ve `(düzenlendi)` etiketi.
  - Tıklanabilir tepki rozetleri (ekleme/kaldırma ve sayaç gösterimi).
  - Web Audio API ile harici dosyasız hafif ve şık bildirim zili (`soundService`).
  - Windows sistem bildirimleri (`Notification`) ve görev çubuğu rozet sayısı (`setBadgeCount`).
  - Sistem tepsisi (Tray simgesi) ve pencere kapatıldığında tepsiye küçülme (`minimize to tray`).
  - Ses ve bildirim tercihleri için Ayarlar modalı (`SettingsModal`).
  - Kanallarda okunmamış mesaj sayacı rozeti.
- [x] **Test Doğrulamaları:**
  - `pnpm typecheck`: Sıfır hata ile geçti.
  - `pnpm lint`: Sıfır hata ile geçti.
  - `pnpm test`: 8 test dosyası, 23 testin tamamı (%100) başarıyla geçti. XSS güvenlik testleri doğrulandı.

## Faz 3 — Kabul Kriterleri ve Gerçekleşenler

- [x] **Ortak Şemalar ve Protokol (`@echo/shared`):**
  - `packages/shared/src/schemas/voice.ts`: `ClientVoiceJoinPayloadSchema`, `ClientVoiceLeavePayloadSchema`, `ClientVoiceSignalPayloadSchema`, `ClientVoiceStatePayloadSchema`, `ServerVoiceUserJoinedPayloadSchema`, `ServerVoiceParticipantsPayloadSchema`, `PeerDiagnosticsStats`.
  - Protokol olayları: `voice.join`, `voice.leave`, `voice.signal`, `voice.state`, `voice.user_joined`, `voice.user_left`, `voice.participants`.
  - `voice.test.ts`: 11 yeni birim testi başarıyla geçti.
- [x] **Sunucu Mimarisi (`apps/server`):**
  - `GET /api/turn`: STUN sunucuları (`stun:stun.cloudflare.com:3478`, `stun:stun.l.google.com:19302`).
  - `GroupDO`: Bellek içi geçici oda yönetimi (`voiceRooms: Map<channelId, Map<userId, VoiceParticipant>>`, `userVoiceChannel: Map<userId, channelId>`).
  - Maksimum 10 katılımcı sınırı (`VOICE_CHANNEL_FULL`).
  - WebRTC sinyalleşme rölesi (`voice.signal` ile offer/answer/candidate doğrudan hedef kullanıcıya yönlendirme).
  - Kanal üyelerine anlık `voice.user_joined`, `voice.user_left`, `voice.state` yayınları ve bağlantı kopmasında otomatik ses odası temizliği.
  - Yeni gruplarda varsayılan `Genel Ses` ses kanalının oluşturulması.
- [x] **Masaüstü ve WebRTC Mesh Motoru (`apps/desktop`):**
  - Electron ana sürecinde mikrofon izni: `session.defaultSession.setPermissionRequestHandler` ile `media` izninin otomatik ve güvenli verilmesi.
  - `webrtcService`: Tam WebRTC Mesh motoru (`RTCPeerConnection` havuzu, Opus mono, yankı engelleme `echoCancellation: true`, gürültü bastırma `noiseSuppression: true`, otomatik kazanç `autoGainControl: true`).
  - Perfect Negotiation & Polite Peer: Yeni katılan kullanıcı mevcut tüm katılımcılara offer gönderir; glare / çakışma önlenir.
  - VAD (Ses Aktivite Algılama): Web Audio `AudioContext` ve `AnalyserNode` ile 100ms aralıklarla RMS ses düzeyi ölçümü, konuşma başlayınca `speaking: true`, bitişte yumuşak 350ms sönümleme.
  - Arayüz Konuşma Göstergesi: Konuşan kullanıcının avatarı etrafında yeşil parlayan halka (Kanal listesinde, ses panelinde ve üye listesinde eş zamanlı).
  - Discord tarzı Alt Sol Ses Paneli (`VoicePanel`): Bağlantı durumu (`Ses Bağlandı`), ping (ms), mikrofon susturma (`isMuted`), kulaklık sağırlaştırma (`isDeafened`), bağlantıyı kesme butonu.
  - Zorunlu Kabul Kriteri — Bağlantı Tanı Paneli (`VoiceDiagnosticsModal`): WebRTC `getStats()` API'si ile her eş (peer) için RTT (gecikme ms), paket kaybı (sayı ve yüzde), aday türü (`host` / `srflx` / `relay`), gelen bit hızı (kbps) ve ses seviyesi gösterimi.
- [x] **Çoklu Kullanıcı Eşitlemesi ve Ses Ayarları İyileştirmeleri:**
  - Kullanıcı grupları ve aktif grup `localStorage` ve sunucu `GET /api/users/:userId/groups` uç noktası ile kalıcı hale getirildi; yeniden açılışta veya profil geçişinde grup kaybı ve ayrı gruplara düşme sorunu giderildi.
  - Bir kullanıcı davetle gruba katıldığında anlık `member.joined` yayını ve `#genel` kanalında otomatik hoş geldin duyuru mesajı (`🎉 **{displayName}** gruba katıldı. Hoş geldin!`) yayınlandı.
  - Ses kanalına katılma senaryosunda katılımcı senkronizasyonu düzeltildi (yeni gelen katılımcının mevcut herkesi, mevcutların da yeni geleni anında görmesi).
  - Ayarlar modalına (`SettingsModal`): Mikrofon aygıtı seçimi (Input Device dropdown), gerçek zamanlı yeşil seviye göstergeli interaktif mikrofon testi ("Mikrofonu Test Et"), çıkış ses seviyesi kaydırıcısı (%0-100) ve ses çalma testi eklendi.
- [x] **Grup Silme ve Gruptan Ayrılma:**
  - Sunucu: `DELETE /api/groups/:id` (Yalnızca grup sahibi silebilir, Ed25519 imzalı) ve `POST /api/groups/:id/leave` (Grup üyeleri ayrılabilir) uç noktaları eklendi.
  - `GroupDO`: Grup silindiğinde tüm bağlı soketlere `group.deleted` yayını yapılması, Durable Object depolamasının temizlenmesi (`ctx.storage.deleteAll()`) ve tüm üyelerin `UserDO` kayıtlarından grubun silinmesi sağlandı.
  - İstemci Arayüzü: Kanal listesi başlığında Discord tarzı açılır sunucu menüsü (Davet Et, Kanal Ekle, Grubu Sil / Gruptan Ayrıl) ve sol barda grup simgesine sağ tıklandığında çıkan bağlam menüsü eklendi.
  - Onay Penceresi: `DeleteGroupModal` ile silme veya ayrılma öncesi kullanıcıya geri alınamazlık uyarısı ve net onay butonları sunuldu.
- [x] **Test Doğrulamaları:**
  - `pnpm typecheck`: Monorepo genelinde sıfır hata ile geçti.
  - `pnpm lint`: Workspace genelinde sıfır hata ile geçti.
  - `pnpm test`: 9 test dosyası, 36 testin tamamı (%100) başarıyla geçti (grup silme ve ayrılma testleri dahil).
  - `apps/desktop` electron-vite derlemesi başarıyla tamamlandı.
