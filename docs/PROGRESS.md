# Echo — İlerleme Durumu (Progress)

Bu dosya her faz ve görev sonunda güncellenir.

## Faz Durum Özeti

| Faz   | Açıklama                                | Durum      | Dal                    | Notlar                                                                     |
| ----- | --------------------------------------- | ---------- | ---------------------- | -------------------------------------------------------------------------- |
| Faz 0 | İskelet (Monorepo, TS, Lint, Test, Dev) | Tamamlandı | `faz-0-iskelet`        | Monorepo, shared paket, sunucu ve masaüstü iskeleti kuruldu, testler geçti |
| Faz 1 | Kimlik, grup, kanal, yazılı sohbet      | Tamamlandı | `faz-1-kimlik-sohbet`  | Ed25519 kimlik, safeStorage, GroupDO SQLite, WebSocket hibernation, UI    |
| Faz 2 | Zengin mesajlaşma ve bildirim           | Tamamlandı | `faz-2-zengin-mesajlasma` | Yanıtla, düzenle, sil, emoji tepkisi, safe Markdown/spoiler, tray, ses, bildirim |
| Faz 3 | Sesli sohbet ve TURN                    | Tamamlandı | `faz-3-sesli-sohbet`   | WebRTC Tam Mesh, Cloudflare STUN/TURN, VAD konuşma halkası, ses paneli ve bağlantı tanı modalı |
| Faz 4 | Medya                                   | Tamamlandı | `faz-4-medya`          | Görsel/GIF yükleme (server), P2P dosya paylaşımı (WebRTC DataChannel), lightbox görüntüleyici, sürükle-bırak, Ctrl+V paste, Giphy picker |
| Faz 5 | DM                                      | Tamamlandı | `faz-5-dm`             | UserDO çift taraflı yazım, /ws/user WS endpoint, dm_threads, dm_messages, DmChatArea, MemberList DM başlatma |
| Faz 6 | Ekran paylaşımı (mesh)                  | Tamamlandı | `faz-6-ekran-paylasimi`| desktopCapturer, 720p30/1080p kalite ön ayarları, ScreenShareTransport, MeshTransport, ScreenShareViewer |
| Faz 7 | SFU (kapılı)                            | Atlandı    | -                      | Patron kararıyla şimdilik atlandı (P2P Mesh yeterli)                       |
| Faz 8 | Cilalama ve dağıtım                     | Tamamlandı | `faz-8-cilalama-dagitim`| Bas-konuş, Windows ile başlat, boş durumlar, NSIS tek tıkla .exe kurulumu  |
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



