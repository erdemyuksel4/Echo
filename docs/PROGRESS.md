# Echo — İlerleme Durumu (Progress)

Bu dosya her faz ve görev sonunda güncellenir.

## Faz Durum Özeti

| Faz   | Açıklama                                | Durum      | Dal                       | Notlar                                                                                                                                   |
| ----- | --------------------------------------- | ---------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Faz 0 | İskelet (Monorepo, TS, Lint, Test, Dev) | Tamamlandı | `faz-0-iskelet`           | Monorepo, shared paket, sunucu ve masaüstü iskeleti kuruldu, testler geçti                                                               |
| Faz 1 | Kimlik, grup, kanal, yazılı sohbet      | Tamamlandı | `faz-1-kimlik-sohbet`     | Ed25519 kimlik, safeStorage, GroupDO SQLite, WebSocket hibernation, UI                                                                   |
| Faz 2 | Zengin mesajlaşma ve bildirim           | Tamamlandı | `faz-2-zengin-mesajlasma` | Yanıtla, düzenle, sil, emoji tepkisi, safe Markdown/spoiler, tray, ses, bildirim                                                         |
| Faz 3 | Sesli sohbet ve TURN                    | Tamamlandı | `faz-3-sesli-sohbet`      | WebRTC Tam Mesh, Cloudflare STUN/TURN, VAD konuşma halkası, ses paneli ve bağlantı tanı modalı                                           |
| Faz 4 | Medya                                   | Tamamlandı | `faz-4-medya`             | Görsel/GIF yükleme (server), P2P dosya paylaşımı (WebRTC DataChannel), lightbox görüntüleyici, sürükle-bırak, Ctrl+V paste, Giphy picker |
| Faz 5 | DM                                      | Tamamlandı | `faz-5-dm`                | UserDO çift taraflı yazım, /ws/user WS endpoint, dm_threads, dm_messages, DmChatArea, MemberList DM başlatma                             |
| Faz 6 | Ekran paylaşımı (mesh)                  | Tamamlandı | `faz-6-ekran-paylasimi`   | desktopCapturer, 720p30/1080p kalite ön ayarları, ScreenShareTransport, MeshTransport, ScreenShareViewer                                 |
| Faz 7 | SFU (kapılı)                            | Atlandı    | -                         | Patron kararıyla şimdilik atlandı (P2P Mesh yeterli)                                                                                     |
| Faz 8 | Cilalama ve dağıtım                     | Tamamlandı | `faz-8-cilalama-dagitim`  | Bas-konuş, Windows ile başlat, boş durumlar, NSIS tek tıkla .exe kurulumu                                                                |
| Faz 9 | Kamera (Webcam)                         | Tamamlandı | `faz-9-kamera`            | WebRTC 480p24 mesh kamera yayını, VoiceStageView video grid, Ayarlar kamera seçici & ayna testi                                          |

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
  - Discord tarzı biçimlendirme: Kalın (`**`), İtalik (`*` / `_`), Üstü çizili (`~~`), Satır içi kod (`` ` ``), Kod bloğu (` ``` `), Tıklanabilir Spoiler (`||...||`), Otomatik ve etiketli güvenli bağlantılar, `@kullanıcı` ve `@everyone` anmaları.
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

## Faz 4 — Kabul Kriterleri ve Gerçekleşenler

- [x] **Ortak Şemalar (`@echo/shared`):**
  - `AttachmentTypeSchema`, `AttachmentSchema`, `P2POfferSchema`: Mesaj şemasına `attachments: Attachment[]` alanı eklendi.
  - `AttachmentUploadRequestSchema`, `AttachmentUploadResponseSchema`, `GiphyItemSchema`, `GiphySearchResponseSchema`: Yeni `media.ts` şema modülü.
  - Protokole `FILE_SIGNAL` olayı, `ClientFileSignalPayloadSchema`, `ServerFileSignalPayloadSchema` ve `ClientMsgSendPayloadSchema`'ya `attachments` alanı eklendi.
  - 8 yeni birim testi eklendi.
- [x] **Sunucu (`apps/server`):**
  - SQLite'a `attachments` tablosu (metadata) ve `attachment_chunks` tablosu (binary chunks ≤180KB) eklendi.
  - `POST /internal/attachments/upload`: Çok parçalı yükleme; FIFO gruplu kota yönetimi.
  - `GET /internal/attachments/:id`: Binary chunk birleştirme ve akış.
  - `POST /api/groups/:id/attachments` ve `GET /api/groups/:id/attachments/:id`: Harici HTTP API.
  - `GET /api/giphy/search`: Giphy proxy (API anahtarı `.dev.vars`'ta, test için `c.env?.GIPHY_API_KEY` ile güvenli isteğe bağlı).
  - `FILE_SIGNAL` WebSocket olayı: Hedef kullanıcıya doğrudan P2P sinyal rölesi.
  - 90 günlük ek yük temizliği `alarm()` rutinine eklendi.
  - 2 yeni test dosyası.
- [x] **Masaüstü (`apps/desktop`):**
  - `imageCompression.ts`: Canvas API ile sunucu taraflı işlem yapmadan WebP dönüşümü (max 1920px), GIF korunur; `uploadImageAttachment()` fonksiyonu.
  - `p2pFileTransfer.ts`: WebRTC DataChannel ile P2P dosya transferi; SHA-256 bütünlük doğrulaması; `crypto.randomUUID()` ile benzersiz offer ID'leri.
  - `GiphyPicker.tsx`: Arama ve trend GIF ızgarası; `onSelect` callback ile `Attachment` dönüşümü.
  - `ImageViewerModal.tsx`: Tam ekran lightbox; zum artır/azalt, sıfırla, indir, Esc ile kapat.
  - `ChatArea.tsx`: Sürükle-bırak yükleme, `Ctrl+V` ekran görüntüsü yapıştırma, dosya yükleme butonu, GIF seçici butonu, hazırlık eki tepsisi (staged attachment tray) ile önizleme ve silme.
  - `ChatMessageItem.tsx`: Görsel/GIF küçük resim gösterimi (lightbox açılır), P2PFileCard bileşeni (ilerleme çubuğu, indirme butonu, durum rozetleri).
  - `websocket.ts`: `FILE_SIGNAL` yönlendirme, `sendMessage()` fonksiyonuna `attachments` parametresi, `sendFileSignal()` metodu.
- [x] **Test Doğrulamaları:**
  - `pnpm typecheck`: Monorepo genelinde sıfır hata ile geçti.
  - `pnpm lint`: Workspace genelinde sıfır hata ile geçti.
  - `pnpm test`: 11 test dosyası, 46 testin tamamı (%100) başarıyla geçti.

### Bilinen Limitler / Açık İşler

- Görsel URL'leri `http://localhost:8787` ile hardcode edilmiş; canlıya almada `ARCHITECTURE.md`'de tanımlı gerçek Worker URL'sine güncellenmesi gerekir.
- P2P dosya indirme, gönderen kullanıcı çevrimiçi olduğunda çalışır; çevrimdışıysa dosya alınamaz (P2P'nin doğal kısıtı).

## Faz 5 — Kabul Kriterleri ve Gerçekleşenler

- [x] **Ortak Şemalar (`@echo/shared`):**
  - `DmThreadSchema`, `DmThread` türü (`peerId, peerName, peerColor, lastMessageAt, lastMessagePreview, unreadCount`).
  - `DmMessageSchema`, `DmMessage` türü (`id, fromUserId, toUserId, fromName, fromColor, content, attachments, createdAt, deleted`).
  - Protokol olayları: `dm.send`, `dm.history_fetch`, `dm.read_mark`, `dm.new`, `dm.read`, `dm.snapshot`.
  - İlgili Zod payload şemaları (`ClientDmSendPayloadSchema`, `ClientDmHistoryFetchPayloadSchema`, vb.).
- [x] **Sunucu Mimarisi (`apps/server`):**
  - `UserDO` SQLite tabloları: `dm_threads`, `dm_messages`, `dm_read_state`.
  - Çift taraflı yazım (Double-write): Gönderen kullanıcı kendi `UserDO`'suna yazar ve alıcı `UserDO`'suna `/internal/dm/deliver` ile teslim eder. İki tarafın da bağımsız tam geçmişi tutulur.
  - WebSocket Hibernation: `/internal/ws` uç noktası ile kişisel UserDO'ya bağlanma, `serializeAttachment` ile oturum bilgisi bağlama.
  - İmzalı kimlik doğrulama: `GET /ws/user` (Ed25519 `echo-auth|user|<ts>` doğrulaması, süre aşımı ve pubkey kontrolü).
  - Ortak grup kontrolü: `GET /api/dm/check` ve `hasCommonGroup` yardımcısı (iki kullanıcının üyelik kümelerini karşılaştırma).
  - DM geçmişi sayfalama (`/internal/dm/history`, limit & before desteği).
  - Okundu işaretleme (`/internal/dm/read-mark`, okunmamış sayacını sıfırlama).
  - Yeni 5 adet otomatik birim testi (`apps/server/test/dm.spec.ts`).
- [x] **Masaüstü Arayüzü (`apps/desktop`):**
  - `dmWebsocket.ts`: Kişisel `UserDO`'ya bağlanan WebSocket servisi (otomatik kimlik imzalama, yeniden bağlanma, `dm.send`, `dm.history_fetch`, `dm.read_mark`).
  - `useDmStore.ts`: DM thread'leri, mesaj geçmişi, aktif eş (peer), okunmamış rozetleri, sesli bildirim (`playNotification`) ve masaüstü sistem bildirimi entegrasyonu.
  - `DmChatArea.tsx`: Birebir özel sohbet alanı; Markdown/spoiler/kod blokları ayrıştırma, zaman damgaları, otomatik kaydırma ve anlık mesaj gönderimi.
  - `DirectMessagesView.tsx`: Ana sayfa paneli; seçili eş olduğunda doğrudan sohbet, seçili değilken son görüşmeler ve genel bakış dashboard'u.
  - `ChannelList.tsx`: DM modunda sol panelde tüm DM sohbetlerinin listelenmesi, okunmamış rozetleri ve ana sayfa geçiş butonu.
  - `MemberList.tsx`: Grup üye listesindeki herhangi bir üyeye tek tıkla doğrudan DM başlatma butonu (`MessageSquare`).
  - `App.tsx`: Kimlik yüklendiğinde otomatik `dmWebSocketService.connect()` başlatılması.
- [x] **Test Doğrulamaları:**
  - `pnpm typecheck`: Monorepo genelinde sıfır hata ile geçti.
  - `pnpm lint`: Workspace genelinde sıfır hata ile geçti.
  - `pnpm test`: 12 test dosyası, 51 testin tamamı (%100) başarıyla geçti.

## Faz 6 — Kabul Kriterleri ve Gerçekleşenler

- [x] **Ortak Şemalar (`@echo/shared`):**
  - `ScreenQualityPresetSchema` (`720p30`, `1080p30`, `1080p60`), `ScreenShareModeSchema` (`motion`, `detail`).
  - Kalite konfigürasyonları: `SCREEN_QUALITY_PRESETS` (çözünürlük, framerate, maxBitrate).
  - Ekran paylaşımı kaynak ve durum şemaları (`ScreenShareSourceSchema`, `ScreenShareStateSchema`).
  - Ekran paylaşımı protokol olayları: `share.start`, `share.stop`, `share.signal`, `share.started`, `share.stopped`, `share.active_list`.
  - Yeni 4 adet Zod birim testi (`packages/shared/src/__tests__/screenshare.test.ts`).
- [x] **Sunucu Mimarisi (`apps/server`):**
  - `GroupDO`: `screenShares` bellekiçi haritası ile ses kanalı bazlı ekran paylaşımı takibi.
  - `share.start`: Yetki ve ses kanalı üyeliği kontrolü; grup geneline `share.started` duyurusu.
  - `share.stop`: Paylaşımı kaldırma ve `share.stopped` yayını.
  - `share.signal`: Hedef izleyiciye/yayıncıya doğrudan WebRTC sinyal yönlendirmesi.
  - Ses kanalından ayrılma veya bağlantı kopmasında otomatik ekran yayını sonlandırma.
  - Kanala katılan yeni kullanıcılara o kanaldaki aktif yayınların otomatik iletilmesi (`share.active_list`).
  - Yeni 5 adet otomatik birim testi (`apps/server/test/screenshare.spec.ts`).
- [x] **Masaüstü Altyapısı ve Arayüzü (`apps/desktop`):**
  - Electron Ana Süreci: `desktopCapturer.getSources` ile açık pencere ve ekranları küçük resimleriyle toplayan `desktop:getSources` IPC işleyicisi.
  - Preload: `getDesktopSources()` metodunun güvenli `contextBridge` köprüsü.
  - `ScreenShareTransport`: SFU geçişine hazır modüler aktarım arayüzü ve `MeshScreenShareTransport` implementasyonu (H.264 donanım codec tercihi, bitrate kısıtlamaları).
  - `screenCaptureService`: `navigator.mediaDevices.getUserMedia` ile ekran yakalama; `contentHint` ve sistem sesi (loopback) desteği.
  - `useScreenShareStore`: Yayın durumu, aktif yayınlar, izleyici sayısı ve izleme durumu yönetimi.
  - `ScreenSourcePickerModal`: Ekran/pencere sekmeleri, canlı önizleme kartları, 720p30/1080p ön ayarları, hareket/ayrıntı optimizasyonu, 1080p60 performans uyarısı ve ses paylaşımı onay kutusu.
  - `ScreenShareViewer`: Tam ekran modu, ses seviyesi kaydırıcısı/susturma, canlı rozeti ve yayından ayrılma butonu içeren video oynatıcı arayüzü.
  - `VoicePanel`: Ses kanalında "Ekran Paylaş" butonu, aktif yayında "Yayını Durdur" butonu, izleyici sayısı göstergesi ve 2'den fazla izleyicide sarı sistem yükü uyarı rozeti.
  - `ChannelList`: Ses kanalındaki yayıncılarda yanıp sönen kırmızı "CANLI" rozeti ve tek tıkla "Yayını İzle" butonu.
- [x] **Test Doğrulamaları:**
  - `pnpm typecheck`: Monorepo genelinde sıfır hata ile geçti.
  - `pnpm lint`: Workspace genelinde sıfır hata ile geçti.
  - `pnpm test`: 14 test dosyası, 60 testin tamamı (%100) başarıyla geçti.

## Faz 8 — Kabul Kriterleri ve Gerçekleşenler

- [x] **Bas-Konuş (Push-to-Talk) & Ses Ayarları:**
  - `useVoiceStore`: `inputMode` ('vad' | 'ptt'), `pttKey`, `pttKeyDisplay`, `pttReleaseDelay`, `isPttActive` durumları eklendi ve `localStorage` ile kalıcı hale getirildi.
  - `webrtcService`: Bas-konuş aktifken mikrofon parçasını dinamik olarak susturma/açma (`updateAudioTrackState`), basılı tutulduğunda konuşma algılama ve bırakıldığında VAD senkronizasyonu.
  - `SettingsModal`: Ses iletim modu seçici (VAD vs PTT), dinamik tuş kaydedici (Keyboard recorder; Space, Ctrl, CapsLock, V vb.) ve ayarlanabilir bırakma gecikmesi kaydırıcısı (50-1000 ms).
  - `App.tsx`: Global pencere `keydown` ve `keyup` dinleyicileri (yazı kutularında doğal yazımı engellemez, tuş bırakıldığında gecikmeyle mikrofonu kapatır).
- [x] **Sistem Entegrasyonu (Windows ile Başlatma & Oturum Ayarları):**
  - Electron Ana Süreci: `desktop:getLoginItemSettings` ve `desktop:setLoginItemSettings` (`app.setLoginItemSettings` ile Windows başlangıç kaydı) IPC uç noktaları.
  - Preload: `getLoginItemSettings()` ve `setLoginItemSettings(openAtLogin: boolean)` güvenli contextBridge metotları.
  - `SettingsModal`: "Windows ile Birlikte Başlat" toggle anahtarı.
- [x] **Arayüz ve Boş Durum (Empty State) Cilası:**
  - `ChatArea`: Henüz mesaj yazılmamış kanallarda Discord tarzı büyük `#` simgeli ve başlatan açıklamalı hoş geldin kartı.
  - `App.tsx`: Sunucu bağlantısı koptuğunda veya yeniden bağlanılırken ekranın üstünde zarif sarı uyarı afişi ("Sunucuya bağlanılıyor..." / "Bağlantı koptu, yeniden bağlanılıyor...").
- [x] **Tek Tıkla Kurulan `.exe` Paketi (`electron-builder` + NSIS):**
  - Modern Echo uygulama ikonu oluşturuldu (`apps/desktop/build/icon.png`).
  - `apps/desktop/package.json` ve kök `package.json` içine `"build:exe"` derleme script'i ve NSIS paketleyici yapılandırması eklendi.
  - `pnpm build:exe` ile tek tıkla kurulan bağımsız `apps/desktop/dist/Echo Setup 0.1.0.exe` (84.3 MB) paketi başarıyla üretildi.
  - NSIS paketi: Masaüstü kısayolu, Başlat menüsü kısayolu ve temiz kaldırıcı (uninstaller) içerir.
- [x] **Arkadaşlara Dağıtım & SmartScreen Rehberi:**
  - `docs/DISTRIBUTION.md`: Arkadaşlara `.exe` dosyasını iletme (Drive, WeTransfer vb.), Windows SmartScreen mavi ekranını ("Ek bilgi" -> "Yine de çalıştır") aşma adımları ve ilk açılışta davet koduyla katılma rehberi hazırlandı.
  - `README.md` kurulum ve dağıtım bölümleri güncellendi.
- [x] **Canlıya Alma (Cloudflare Workers) & GitHub Dağıtımı:**
  - Sunucu: `https://echo-server.erdemyuksel04.workers.dev` adresinde Cloudflare Workers ve Durable Objects üzerine canlıya alındı.
  - Masaüstü konfigürasyonu (`config.ts`): Canlı Cloudflare Workers uç noktasına bağlandı.
  - Windows Kurulum Paketi: Canlı sunucu adresi gömülü olarak `Echo Setup 0.1.0.exe` derlendi.
  - GitHub: Proje tüm dallarıyla `https://github.com/erdemyuksel4/Echo` deposuna yüklendi ve `v0.1.0` release etiketi açıldı.
- [x] **Ses Kanalı Kalıcılığı ve Katılımcı Senkronizasyonu İyileştirmeleri:**
  - **Arka Planda Kesintisiz Ses (Discord Davranışı):** Kullanıcı bir sunucuda ses kanalındayken başka sunuculara veya Direkt Mesajlara (DM) geçtiğinde ses bağlantısının kesilmesini önlemek amacıyla çift soket / arka plan ses soketi mimarisi (`websocket.ts`) kuruldu. Kullanıcı başka sunucudayken ses sinyalleşmesi ve WebRTC mesh iletişimi kesintisiz devam eder.
  - **Global Ses Paneli Bilgilendirmesi:** `VoicePanel` başka sunucularda veya DM'deyken de sol altta bağlı kalır; kullanıcının hangi sunucu ve kanalda olduğunu açıkça belirtir (`{channelName} / {groupName}`).
  - **Katılımcı Senkronizasyonu & Boş Oda Temizliği:** `GroupDO.handleAuth` metodunda tüm ses kanallarının katılımcı listeleri (boş odalar için `[]` dahil) gönderilerek istemcideki eski/yetim katılımcı listeleri temizlendi.
  - **Anında Çıkış ve Kolaylık (Toggle):** `webrtcService.leave()` çağrıldığında kullanıcının kendi kaydı yerel Zustand store'dan anında silinir; `ChannelList` üzerinde aktif ses kanalına tekrar tıklandığında kolayca bağlantıyı kesme (toggle leave) özelliği eklendi.
  - **Canlı Sunucu Güncellemesi:** Sunucu güncellemeleri Cloudflare Workers üzerine deploy edildi (`Version ID: 5d10a9a9-08ba-422c-9907-6dfca7d26926`), masaüstü kurulum paketi güncellendi ve kodlar GitHub'a pushlandı.

## Faz 9 — Kabul Kriterleri ve Gerçekleşenler

- [x] **Ortak Şemalar ve Protokol (`@echo/shared`):**
  - `VoiceParticipantSchema`: `camera: z.boolean().default(false)` alanı eklendi.
  - `ClientVoiceStatePayloadSchema`: `camera: z.boolean().optional()` alanı eklendi.
  - `ServerVoiceStatePayloadSchema`: `camera: z.boolean().default(false)` alanı eklendi.
  - `packages/shared/src/__tests__/voice.test.ts`: Kamera şemalarını doğrulayan birim testleri eklendi ve tüm testler (43/43) başarıyla geçti.
- [x] **Sunucu Mimarisi (`apps/server`):**
  - `GroupDO.ts`: Ses odasına katılan katılımcılara varsayılan `camera: false` atandı.
  - `GroupDO.handleVoiceState`: İstemcilerden gelen `camera` durumu oda hafızasında güncellenerek gruptaki tüm eşlere `voice.state` olayı ile anlık olarak duyurulması sağlandı.
- [x] **WebRTC Motoru ve Kamera Yönetimi (`apps/desktop`):**
  - `WebRTCVoiceService`: `localCameraStream`, `selectedVideoDeviceId` yönetimi tanımlandı.
  - `toggleCamera(enable?: boolean)`: 480p24 optimum çözünürlük kısıtlaması (`{ width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { max: 24 } }`), H.264/VP8 uyumlu mesh entegrasyonu.
  - Kamera açıldığında mevcut tüm eş RTCPeerConnection bağlantılarına `pc.addTrack` ile video track eklenip renegotiation (yeniden anlaşma) teklifleri gönderildi.
  - `pc.ontrack`: Uzak eşlerden gelen video track'leri `video` türünde yakalanarak `useVoiceStore.setPeerCameraStream` üzerinden UI ile senkronize edildi.
  - Kamera kapatıldığında `pc.removeTrack` ve `initiateOffer` ile video parçaları temizlenip `voice.state` ile diğer kullanıcılara `camera: false` bildirildi.
  - Cihaz yönetimi: `getVideoDevices()`, `setVideoDevice(deviceId)`, `testCamera(videoElement)` metotları yazıldı.
- [x] **Ses & Video Store (`useVoiceStore.ts`):**
  - `isCameraActive: boolean`, `cameraStreams: Record<string, MediaStream>` state'leri eklendi.
  - `setCameraActive`, `setPeerCameraStream`, `removePeerCameraStream` eylemleri tanımlandı.
  - `updateChannelParticipantState` içine `camera` güncellemesi eklendi.
- [x] **Arayüz (UI) Bileşenleri:**
  - `VoicePanel.tsx`: Alt ses kontrol paneline "Kamera Aç / Kapat" (`Video` / `VideoOff`) butonu eklendi. Kanal ismine tıklandığında ses sahnesine odaklanma sağlandı.
  - `VoiceStageView.tsx`: Discord tarzı dinamik video ızgarası (Grid view). Kamera açıksa canlı `<video autoPlay playsInline muted={isLocal} />` oynatıcı, kapalıysa avatar + konuşurken yeşil parlayan halka gösterimi, tam ekran kontrolü, alt araç çubuğu (Kamera, Mikrofon, Kulaklık, Ayrıl).
  - `SettingsModal.tsx`: "Kamera & Video" ayar kartı, sistemdeki kamera cihazlarını listeleyen açılır menü (`Webcam Selector`) ve canlı aynalı kamera önizleme testi ("Kamerayı Test Et").
  - `App.tsx` & `ChannelList.tsx`: Aktif kanal bir ses kanalı olduğunda ortada `VoiceStageView` sahnesi render edilir; kanal listesinden ses kanalına tıklandığında hem katılım hem sahne odağı sağlanır. Katılımcı listesinde kamerası açık kullanıcılarda yeşil kamera rozeti gösterilir.
- [x] **Test Doğrulamaları:**
  - `pnpm typecheck`: Sıfır hata ile geçti.
  - `pnpm test`: Tüm paketlerdeki 65 testin tamamı (%100) başarıyla geçti.
  - `pnpm --filter @echo/desktop build`: Sıfır hata ile derlendi.

## Otomatik Güncelleme Sistemi (Zero-Touch Discord-Tarzı Auto-Updater)

- [x] **GitHub Releases & CI/CD Pipeline:**
  - `.github/workflows/release.yml`: Her yeni tag pushlandığında (`v*.*.*`) GitHub Actions Windows runner üzerinde otomatik olarak Electron derlemesi (`pnpm build:exe`) yapar.
  - `latest.yml`, `Echo.Setup.*.exe` ve `.blockmap` dosyalarını otomatik olarak GitHub Release varlığı olarak yayınlar.
- [x] **Sıfır Dokunuş (Zero-Touch) Güncelleme Akışı:**
  - `apps/desktop/src/main/updater.ts`: `autoDownload = true` ile güncelleme bulunduğunda arka planda otomatik indirilir.
  - İndirme tamamlandığında (`update-downloaded`) kullanıcıya buton tıklatma zorunluluğu olmadan 1.5 saniye sonra otomatik olarak `autoUpdater.quitAndInstall(false, true)` çağrılır.
  - Uygulama açılışında (1.5 sn sonra) ve 10 dakikada bir periyodik olarak sessizce güncelleme denetlenir.
  - `UpdateNotification.tsx`: Kullanıcıya sürecin durumunu (İndiriliyor %X -> Güncellendi, yeniden başlatılıyor...) şık ve bilgilendirici olarak gösterir.
- [x] **Otomatik Sürüm Yayınlama Aracı:**
  - `scripts/bump-version.mjs` ve `pnpm release` komutu ile tek komutta tüm `package.json` sürümleri güncellenir, git commit ve tag oluşturulur ve GitHub'a pushlanır.

## Uygulama Hakkında & Sürüm Bilgileri Paneli (About Echo)

- [x] **Ana Süreç & Preload Entegrasyonu (`apps/desktop`):**
  - `apps/desktop/src/main/index.ts`: `app:get-info` IPC işleyicisine Electron (`process.versions.electron`), Chromium (`process.versions.chrome`), Node.js (`process.versions.node`) ve işlemci mimarisi (`process.arch`) eklendi.
  - Güvenli `desktop:openExternal` IPC işleyicisi ile harici bağlantıların (`https:`) sistem varsayılan tarayıcısında açılması sağlandı.
  - `apps/desktop/src/preload/index.ts`: `AppInfo` tipi genişletildi, `openExternal` ve `onUpdateStatus` metotları tipli olarak UI'a sunuldu.
- [x] **Modern Sekmeli Ayarlar & Zengin "Hakkında" Görünümü (`SettingsModal.tsx`):**
  - Üst gezinme çubuğu (Tabs): 🎙️ **Ses & Görüntü**, 🔔 **Bildirim & Tercihler**, ℹ️ **Hakkında**.
  - **Echo Başlığı & Canlı Rozet:** İstemci sürümü (`v0.1.0`), Echo simgesi, canlı durum animasyonu.
  - **Sürüm & Çalışma Ortamı Kartları:** Protokol sürümü (`Echo Protocol v1`), İşletim sistemi & mimari (`Windows x64`), Electron, Chromium ve Node.js sürümleri.
  - **Mimari & Güvenlik Prensipleri:** Ed25519 Kriptografik kimlik, P2P WebRTC mesh, Sıfır telemetri ve Cloudflare DO altyapısı özetleri.
  - **Yazılım Güncellemeleri Denetleyicisi:** "Güncellemeleri Denetle" butonu, denetleme animasyonu ve anlık durum geri bildirimi (`onUpdateStatus`).
  - **Açık Kaynak & Lisans:** GitHub repository bağlantısı (`openExternal`) ve MIT lisans bilgisi.
- [x] **Kullanıcı Durum Barından Hızlı Erişim (`ChannelList.tsx`):**
  - Sol alttaki kullanıcı profil çubuğuna doğrudan "Hakkında" sekmesini açan bilgi butonu (`Info`) eklendi.
- [x] **Test ve Doğrulamalar:**
  - `pnpm typecheck`: Monorepo genelinde sıfır hata ile geçti.
  - `pnpm lint`: Monorepo genelinde sıfır hata ile geçti.
  - `pnpm test`: 14 test dosyası, 65 testin tamamı (%100) başarıyla geçti.
  - `pnpm --filter @echo/desktop build`: Electron derlemesi başarıyla tamamlandı.

## Sekme & Ayarlar Geçişlerinde Sunucu Bağlantı Kopması Düzeltmesi

- [x] **WebSocket Pre-Auth Mesaj Kuyruğu (`apps/desktop/src/renderer/src/services/websocket.ts`):**
  - Kanal veya sekme geçişlerinde (`fetchHistory` vb.) kimlik doğrulaması (`AUTH_OK`) tamamlanmadan önce giden isteklerin Cloudflare DO tarafından `4001 Unauthorized` ile soketi kapatmasını önlemek için `pendingQueue` ve `isAuthenticated` kontrolü eklendi.
  - Ön kimlik doğrulama tamamlanana kadar tüm giden mesajlar sıralı şekilde tamponlanır ve `AUTH_OK` alındığında otomatik olarak sırayla gönderilir.
  - Olası anlık gecikmeler veya zaman damgası farklarında 4001 hatalarında hemen pes etmek yerine 3 denemeye kadar yeniden kimlik doğrulama ile bağlanma yeteneği getirildi.
- [x] **Sekme ve Grup Arka Plan Soket Yönetimi (`websocket.ts` & `Sidebar.tsx`):**
  - "Ana Sayfa" (DM) veya grup sekmeleri arasında geçiş yaparken soket gereksiz yere tamamen kapatılmak yerine hazırda (`OPEN`) tutulur. Böylece kullanıcı bir sekmeye veya gruba geri döndüğünde 0ms gecikmeyle bağlantı anında korunur.
- [x] **Electron Arka Plan Kısıtlamasını Kapatma (`apps/desktop/src/main/index.ts`):**
  - `backgroundThrottling: false` tanımlanarak, pencere odağı kaybolduğunda veya pencereler arası geçişte Chromium'un timer'ları ve WebSocket ping döngüsünü durdurması/yavaşlatması engellendi.
- [x] **Ayarlar Cihaz Dinleme Döngüsü Düzeltmesi (`SettingsModal.tsx`):**
  - Cihaz listeleme efektinin bağımlılıkları `[isOpen]` olarak izole edildi ve iç fonksiyonel state güncelleyicileriyle sonsuz tetiklenme/yeniden çizim döngüsü giderildi.
- [x] **Protokol & Şema Birim Testleri (`packages/shared/src/__tests__/protocol.test.ts`):**
  - `AuthPayload` ve `ClientHistoryFetchPayload` şemalarını doğrulayan birim testleri eklendi. Toplam 67 birim testinin tamamı başarıyla geçti.

## Auto-Updater Yeniden Başlatma & WebSocket Bağlantı Kopması Düzeltmeleri

- [x] **Auto-Updater Yeniden Başlatma Kilitlenmesi Giderildi (`apps/desktop/src/main/updater.ts`):**
  - `mainWindow.on('close')` içindeki `event.preventDefault()` (tepsiye küçültme) dinleyicisi `quitAndInstall` çağrılmadan önce temizlendi. Böylece güncelleme indiğinde pencerenin ve uygulamanın kapanması engellenmez; `autoUpdater.quitAndInstall(true, true)` ile NSIS arka planda sessizce kurulumu yapar ve uygulamayı anında yeniden başlatır.
- [x] **WebSocket Periyodik Kopma (Idle Timeout) Sorunu Giderildi:**
  - `apps/server/src/durable/UserDO.ts`: Eksik olan `setWebSocketAutoResponse('ping', 'pong')` eklendi ve `webSocketMessage` içinde ham `'ping'` mesajları doğrudan yakalanarak `'pong'` yanıtı verildi.
  - `apps/server/src/durable/GroupDO.ts`: Durable Object uyanıkken gelen ham `'ping'` paketlerinin `JSON.parse` hatasına düşmesi engellendi ve anında `'pong'` ile yanıtlandı.
  - `apps/desktop/src/renderer/src/services/websocket.ts` & `dmWebsocket.ts`: Ping periyodu 30 saniyeden **15 saniyeye** düşürüldü; Cloudflare edge proxy'lerinin 30-45s rölanti (idle) süresi dolmadan canlılık paketlerinin sürekli gitmesi garantiye alındı.

## DM ve Kanallar Arası Geçiş Senkronizasyonu (Orta Alan Takılma Düzeltmesi)

- [x] **Store ve Snapshot Önbellek Senkronizasyonu (`useChatStore.ts`):**
  - `groupSnapshots` önbelleği getirilerek her grubun meta, kanal ve üye listesi saklandı. Grup değiştirildiğinde önbellekteki kanallar ve ilk metin kanalı anında yüklenir.
  - `setActiveGroup(null)` çağrıldığında kanallar ve üyeler temizlenerek DM görünümüyle çakışma yaşanması önlendi.
  - `setSnapshot` fonksiyonuna yalnızca aktif gruba ait snapshot'ların aktif görünümü değiştirmesi kuralı getirildi; arka plandaki gruplardan gelen snapshot'ların aktif görünümü bozması engellendi.
- [x] **Sol Panel & Orta Alan Navigasyon Uyumu (`ChannelList.tsx` & `App.tsx`):**
  - `ChannelList.tsx`'in `!activeGroupMeta` yerine `!activeGroupId` ile DM listesini render etmesi sağlandı; `activeGroupId` ile `App.tsx`'in render koşulu tam senkron hale getirildi.
  - `ChannelList` DM ekranında bir DM sohbetine tıklandığında veya "Ana Sayfa & Arkadaşlar"a basıldığında `activeGroupId`'nin sıfırlanması (`setActiveGroup(null)`) sağlandı.
  - Eğer grup seçilmiş ancak henüz snapshot yükleniyorsa DM listesi yerine yükleme iskeleti gösterilmesi sağlandı.
- [x] **Sohbet Alanı Geçmiş & Aktif Kanal Senkronizasyonu (`ChatArea.tsx` & `websocket.ts`):**
  - `ChatArea.tsx` içine `activeChannelId` veya bağlantı durumu değiştiğinde otomatik olarak `wsService.fetchHistory(activeChannelId)` çağrısı yapan `useEffect` eklendi.
  - Hazırda açık ve doğrulanmış olan bir WebSocket'e sahip gruba geçiş yapıldığında `connect` metodunun anında aktif kanal geçmişini çekmesi sağlandı.
- [x] **Sidebar & Modal Geçiş Temizliği (`Sidebar.tsx`, `CreateOrJoinModal.tsx`, `MemberList.tsx`):**
  - Bir grup seçildiğinde, yeni grup kurulduğunda veya gruba katılınıldığında `activePeer(null)` yapılarak önceki DM seçimi temizlendi.
  - Gruptan bir üyeye "Mesaj Gönder" denildiğinde veya sol menüden DM seçildiğinde aktif grup sıfırlanarak DM sohbet alanı derhal ekrana getirildi.

## Uygulama ve Bağımsız Güncelleyici (EchoUpdater) Ayrıştırma

- [x] **Agent 1: Bağımsız Güncelleyici Uygulaması (`apps/updater/`):**
  - C# / .NET 9 WPF tabanlı, Discord/Echo karanlık temasına uygun frameless modern `EchoUpdater` geliştirildi.
  - GitHub Releases API entegrasyonu ile en güncel sürümü tespit etme, `%TEMP%` dizinine indirme (indirme hızı, kalan süre, yüzde barı göstergesi).
  - NSIS sessiz kurulum (`/S`) çalıştırma, kurulum bitişini bekleme ve güncellenen `Echo.exe`'yi otomatik başlatıp kendini kapatma yeteneği eklendi.
  - Hata durumunda kullanıcıya dost arayüz ve "Yeniden Dene" / "Kapat" butonları sağlandı.
- [x] **Agent 2: Ana Uygulama Ayrıştırması & Yönlendirme (`apps/desktop`):**
  - `apps/desktop/src/main/updater.ts` içerisindeki ağır in-app indirme ve kapat-kur döngüsü temizlendi; dosya boyutu 764 kB'den 198 kB'ye düşürüldü.
  - Açılışta ve manuel istekte çalışan hafif `checkForUpdateAndLaunchUpdater()` geliştirildi; yeni sürüm tespit edildiğinde `EchoUpdater.exe`'yi parametrelerle başlatıp `app.quit()` ile `Echo.exe`'yi anında kapatarak Windows dosya kilitlerini tamamen serbest bırakması sağlandı.
  - `apps/desktop/package.json` içerisine `extraFiles` eklenerek `EchoUpdater.exe`'nin kurulum dizininde `Echo.exe`'nin yanına yerleştirilmesi sağlandı.
  - `scripts/bump-version.mjs` sürümleme script'ine `EchoUpdater`'ı otomatik derleme adımı eklendi.
- [x] **Agent 3: QA & Test Doğrulamaları:**
  - `pnpm typecheck`: Monorepo genelinde 0 hata ile geçti.
  - `pnpm lint`: ESLint 0 hata ile geçti.
  - `pnpm test`: 67 testin tamamı (%100) başarıyla geçti.
  - `dotnet publish`: `EchoUpdater.exe` başarıyla derlendi.
  - `pnpm --filter @echo/desktop run build:exe`: Hem `Echo.exe` hem `EchoUpdater.exe` başarıyla imzalandı ve NSIS kurulum paketi üretildi.

## GitHub API 403 Rate Limit Çözümü & Sıfır Limit Doğrudan İndirme

- [x] **GitHub API 403 (Rate Limit Exceeded) Giderildi:**
  - GitHub REST API (`api.github.com/repos/...`) unauthenticated isteklerde saatte 60 istek sınırı koyduğu için 403 Forbidden hatası veriyordu.
  - `apps/desktop/src/main/updater.ts` ve `apps/updater/MainWindow.xaml.cs` içine doğrudan ve sıfır kota kısıtlamalı `https://github.com/erdemyuksel4/Echo/releases/latest/download/latest.yml` indirme ve ayrıştırma stratejisi eklendi.
  - `latest.yml` doğrudan GitHub CDN üzerinden çekildiği için API kotasına takılmaz ve 403 hatası vermez.

## WebRTC TURN Röle & NAT/Firewall Geçişi (Simetrik NAT Desteği)

- [x] **Şema ve Yedekli Mimari (`packages/shared`):**
  - WebRTC için tip güvenli `IceServerSchema` ve `TurnResponseSchema` tanımlandı.
  - Doğrulanmış `DEFAULT_FALLBACK_ICE_SERVERS` tanımlandı (Cloudflare STUN, Google STUN, OpenRelay Metered TURN — UDP/TCP/TLS 80 & 443 portları).
  - 5 yeni birim testi (`packages/shared/src/__tests__/voice.test.ts`) eklendi ve tüm testler geçti.
- [x] **Sunucu Uç Noktası (`apps/server/src/index.ts`):**
  - `/api/turn` uç noktası dinamik hale getirildi:
    - Cloudflare Calls TURN secret'ları (`CLOUDFLARE_TURN_KEY_ID`, `CLOUDFLARE_TURN_API_TOKEN`) tanımlıysa Cloudflare API'sine bağlanıp geçici TURN kimlik bilgisi üretiyor.
    - Secret'lar henüz eklenmemişse otomatik olarak OpenRelay Metered TURN yedek sunucularını sunuyor.
  - Birim testleri (`apps/server/test/turn.spec.ts`) yazıldı ve tüm sunucu testleri başarıyla geçti.
- [x] **Masaüstü İstemcisi (`apps/desktop`):**
  - Merkezi `iceServersService` oluşturuldu.
  - Ses (`webrtc.ts`), ekran paylaşımı (`transport.ts`) ve P2P dosya transferi (`p2pFileTransfer.ts`) servislerinin tamamı doğrudan STUN + TURN yedekleriyle başlatılacak ve sunucudan dinamik güncellenecek şekilde bağlandı.
- [x] **Otomatik Dağıtım (v0.1.10):**
  - Tüm test ve kontroller (typecheck, lint, test) hatasız tamamlandı.
  - `pnpm release` ile `v0.1.10` sürümü GitHub Releases üzerinde tek tıkla kurulum ve güncelleme için yayınlandı.

## Ses Aygıtı Yönetimi, Çıkış Yönlendirme & Kanaldan Ayrılma Sızıntısı Çözümü (v0.1.11)

- [x] **Kanaldan Ayrılınca Sesin Devam Etmesi (Audio Leak) Giderildi:**
  - `leave()` metodunda tüm `RTCPeerConnection` bağlantı dinleyicileri sıfırlandı (`ontrack = null`, `onicecandidate = null`, `onconnectionstatechange = null`) ve bağlantılar kapatıldı.
  - Tüm `peerAudioElements` elemanları durduruldu (`pause()`), bağlı olan `MediaStreamTrack`'lerin tümü kapatıldı (`track.stop()`), `srcObject = null` yapıldı ve DOM'dan kaldırıldı.
  - DOM üzerinde `audio[data-echo-peer]` seçicisiyle genel süpürme (sweep) yapılarak hiçbir yetim (orphan) ses çalma nesnesi kalmaması sağlandı.
  - `getOrCreatePeerConnection` ve `ontrack` içine `currentChannelId` kontrolü konuldu; kanalda olunmadığı anda ses çalınması ve yeni bağlantı kurulması engellendi.
  - `websocket.ts` içinde `VOICE_SIGNAL` olayına kanal kontrolü (`channelId === currentChannelId`) eklendi; eski kanaldan gelen gecikmeli WebRTC sinyallerinin yeni bağlantı açması önlendi.
- [x] **Aygıt Değişimi & Ses Gönderiminin Durması (Confused State) Giderildi:**
  - `setupVAD`: Aygıt değiştiğinde veya yeni akış geldiğinde önceki VAD interval'ı, konuşma zamanlayıcısı ve AudioContext kapatılarak birden fazla analizörün birbiriyle çakışması ve sesin gidip gelmesi engellendi.
  - `setInputDevice`: `exact` kısıtlaması güvenli hale getirildi, `getUserMedia` hatasında otomatik olarak varsayılan mikrofona geçiş desteği eklendi. Yeni akışın `updateAudioTrackState()` çağrısıyla PTT/Mute durumunu doğru koruması sağlandı.
  - `reacquireLocalAudio`: Mikrofon akışı Windows seviyesinde koptuğunda (`track.onended`) veya aygıt takılıp çıkarıldığında (`devicechange`) otomatik olarak mikrofonu yeniden edinme mantığı eklendi.
  - `setOutputDevice`: `setSinkId` desteği eklenerek hoparlör/kulaklık seçimi aktifleştirildi. Ayarlar modalındaki pasif açılır liste gerçek aygıt seçimine bağlandı.
- [x] **Otomatik Dağıtım (v0.1.11):**
  - Typecheck, ESLint ve tüm testler (74/74) başarıyla geçti.
  - `pnpm release` ile `v0.1.11` GitHub Releases üzerinde otomatik olarak yayınlandı.
