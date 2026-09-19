# Echo — Mimari ve Uygulama Planı

Echo, Türkiye'de erişilemeyen Discord'un yerine, birkaç arkadaşın (şimdilik 5-6 kişi) kullanacağı **Windows masaüstü sohbet uygulamasıdır**: gruplar, yazı ve ses kanalları, DM, resim/GIF/dosya, ekran paylaşımı.

Bu doküman **patronun onayladığı tasarımdır**. Değiştirmek için `docs/CHANGE_REQUESTS.md`'ye yaz, patron onaylamadan uygulama. Çalışma kuralları `AGENTS.md`'de.

## 1. Hedefler ve hedef dışı

**Hedefler**

- Tek bir `.exe` kurulum dosyası. Arkadaşlar ek program kurmayacak, ayar yapmayacak.
- Ses gecikmesi Discord'dan yüksek olmayacak; mümkünse düşük olacak.
- Aylık maliyet **0 TL**. Kredi kartı girilmeyecek.
- Discord'un günlük kullanımdaki özelliklerinin çoğu olacak (bkz. Bölüm 13).
- Bir sesli kanalda en fazla **10 kişi**. Tipik kullanım 5-6 kişi.

**Hedef dışı (şimdilik yapılmayacak)**
Mac/Linux, mobil, botlar/webhook, thread, stage kanalı, oyun overlay'i, oyun aktivitesi, e-posta/şifre ile hesap, uygulama kapalıyken push bildirim, yazılı mesajlar için uçtan uca şifreleme.

> **Gizlilik notu:** Ses ve ekran görüntüsü WebRTC ile şifreli akar (DTLS-SRTP). Ancak yazılı mesajlar ve ekler sunucuda (Cloudflare Durable Object) **düz metin olarak saklanır**; Cloudflare teknik olarak erişebilir. Bu, arkadaş grubu için kabul edilmiş bir takastır. Kullanıcılara ilk açılışta kısa bir bilgilendirme gösterilir.

## 2. Sabit kararlar

| Karar            | Seçim                                                             | Neden                                             |
| ---------------- | ----------------------------------------------------------------- | ------------------------------------------------- |
| Platform         | Windows 10/11, x64                                                | Patronun grubu Windows kullanıyor                 |
| Masaüstü         | Electron + TypeScript                                             | Chromium içinde WebRTC ve ekran yakalama hazır    |
| Bulut            | **Cloudflare Free** (Workers + Durable Objects)                   | Süresiz ücretsiz, kartsız hesap açılabiliyor      |
| Yazı, DM, geçmiş | Sunucu üzerinden (Durable Object + SQLite)                        | Anında iletim, çevrimdışı olanlar sonra görür     |
| Ses              | WebRTC, doğrudan P2P mesh                                         | Ara sunucu yok, en düşük gecikme                  |
| Bağlanamayanlar  | Cloudflare TURN (kota: 1.000 GB/ay)                               | Yurt/kampüs/mobil ağlarda P2P kurulamaz           |
| Ekran paylaşımı  | Önce P2P mesh, sonra Cloudflare SFU (Faz 7)                       | SFU: gönderen tek akış yollar, PC yükü düşer      |
| Kimlik           | Cihazda üretilen Ed25519 anahtarı + kullanıcı adı                 | Hesap/şifre yok. Sonra değiştirilebilir (Bölüm 5) |
| Dosya depolama   | Durable Object içinde, küçük dosyalar                             | **R2 kart istiyor, kullanılmayacak**              |
| Büyük dosya      | Sadece P2P (gönderen çevrimiçiyken)                               | Depolama kotasını korur                           |
| GIF arama        | Giphy API (sonuç URL olarak saklanır)                             | Depolama harcamaz                                 |
| Paketleme        | electron-builder (NSIS) + GitHub Releases ile otomatik güncelleme | Ücretsiz                                          |

Sunucu kodu **taşınabilir** yazılır: Cloudflare'e özel API'ler tek bir katmanda toplanır, böylece ileride patron kendi sunucusuna (Node + SQLite) geçebilir.

## 3. Genel bakış

```
                 +-------------------------------------------+
                 |  Cloudflare (Free)                         |
                 |  Worker  --> GroupDO (her grup için 1)     |
                 |          --> UserDO  (her kullanıcı için 1)|
                 |  TURN / STUN   (+ SFU, Faz 7)              |
                 +-------------------------------------------+
                    ^ WebSocket (yazı, durum, sinyal)   ^ relay (gerekirse)
                    |                                    |
   +----------------+---+        WebRTC P2P (ses, ekran) +---+----------------+
   | Echo (Electron) A  |<----------------------------->| Echo (Electron) B  |
   +--------------------+                               +--------------------+
```

- **GroupDO** = bir grubun (Discord'daki "sunucu") tüm verisi: üyeler, roller, kanallar, mesajlar, ekler, davetler. Grup oluşturmak otomatik yeni bir GroupDO doğurur; patron veya arkadaşlar **hiçbir kurulum yapmaz**.
- **UserDO** = bir kullanıcının verisi: üyesi olduğu gruplar, DM konuşmaları, okunmamış sayaçları.
- Sesli kanal ve ekran paylaşımının **sinyalleşmesi** GroupDO WebSocket'inden geçer; ses/görüntü verisi ise doğrudan P2P (veya TURN/SFU) ile akar.

## 4. Repo yapısı ve teknoloji

```
echo/
  AGENTS.md  ARCHITECTURE.md  README.md
  docs/  PROGRESS.md  CHANGE_REQUESTS.md  plans/
  apps/
    desktop/    Electron (electron-vite) + React + TypeScript
    server/     Cloudflare Worker + Durable Objects (wrangler)
  packages/
    shared/     zod şemaları, olay tipleri, sabitler (iki taraf da kullanır)
```

- Paket yöneticisi: **pnpm** workspace. Node LTS.
- Masaüstü: `electron-vite`, React, TypeScript strict, Tailwind CSS, Zustand (durum), `react-virtuoso` (uzun mesaj listesi).
- Sunucu: `wrangler`, `hono` (HTTP yönlendirme), `zod`.
- Test: `vitest` (+ sunucu için `@cloudflare/vitest-pool-workers`). Kod kalitesi: ESLint + Prettier.
- Yerel önbellek: IndexedDB (`idb`). Ayarlar: `electron-store`. **Native modül yok** (bas-konuş için Faz 8'de patron onayıyla istisna).
- Kimlik kriptosu: `@noble/curves` (Ed25519). ID üretimi: ULID (sunucuda).

## 5. Kimlik ve yetkilendirme

- İlk açılışta cihazda Ed25519 anahtar çifti üretilir. Özel anahtar Electron `safeStorage` ile şifrelenip diske yazılır. `userId` = açık anahtarın SHA-256 özetinin ilk 16 baytı (base32).
- Kullanıcı bir **görünen ad** ve avatar rengi seçer. E-posta/şifre yok.
- Kimlik katmanı `IdentityProvider` arayüzü arkasında olacak; ileride "Google ile giriş" eklenirse sadece bu katman değişir.
- **WebSocket kimlik doğrulama:** Bağlantı açıldıktan sonra ilk mesaj `auth` olmalı (5 sn içinde gelmezse kapat): `{ userId, pubkey, ts, sig }`. `sig` = Ed25519(`echo-auth|<groupId>|<ts>`). Sunucu: özet eşleşiyor mu, `ts` ±60 sn içinde mi, kullanıcı üye mi? Doğrulanan `userId` WebSocket attachment'ına yazılır (en fazla 2048 bayt).
- **HTTP istekleri** de aynı şekilde imzalı gövde ile yapılır.
- **Grup oluşturma sınırı:** Worker ortam değişkeni `ALLOWED_CREATOR_IDS` (virgülle ayrılmış `userId` listesi). Boşsa herkes oluşturabilir (sadece geliştirme). Patron ilk kurulumdan sonra kendi ID'sini yazar; arkadaşlar davetle katılır.
- **Roller:** `owner`, `admin`, `member`. İzinler: kanal yönetimi, üye atma/yasaklama, davet yönetimi, başkasının mesajını silme. Sadece `owner`: grubu silme, sahipliği devretme.
- **Davet kodu:** `groupId + gizli parça` içeren kısa bir metin (örn. `ECHO-K7F2-9QXM-4TWA`). Sunucuda yalnızca gizli parçanın SHA-256 özeti saklanır. Süre, kullanım sayısı ve iptal desteklenir. Ayrı bir dizin/registry gerekmez.

## 6. Sunucu tasarımı

### 6.1 Uç noktalar (Worker)

- `POST /api/groups` — grup oluştur (imzalı, `ALLOWED_CREATOR_IDS` kontrolü).
- `POST /api/groups/:id/join` — davetle katıl (imzalı, davet kodu ile).
- `GET  /ws/group/:id` — WebSocket (GroupDO'ya yönlendirir).
- `GET  /ws/user` — WebSocket (kullanıcının UserDO'su: DM, bildirim, grup listesi).
- `POST /api/turn` — imzalı istek → kısa ömürlü TURN kimlik bilgisi (Cloudflare TURN API'sini Worker çağırır; anahtar `wrangler secret`).
- `GET  /api/health` — sürüm ve durum.

### 6.2 GroupDO SQLite şeması (başlangıç, geliştirilebilir)

```
group_meta(id, name, created_at, owner_id)
members(user_id PK, display_name, pubkey, role, joined_at, banned)
channels(id PK, name, type 'text'|'voice', position, created_at)
messages(id PK ulid, channel_id, author_id, content, reply_to, created_at, edited_at, deleted)
  INDEX(channel_id, id)
reactions(message_id, user_id, emoji, PRIMARY KEY(message_id,user_id,emoji))
attachments(id PK, message_id, kind 'image'|'gif'|'file'|'giphy', name, mime, size, w, h, chunk_count, url)
attachment_chunks(attachment_id, idx, data BLOB)   -- parça <= 256 KB
invites(secret_hash PK, created_by, expires_at, max_uses, uses, revoked)
read_state(user_id, channel_id, last_read_id)
```

Ses kanalı katılımcıları ve "yazıyor" bilgisi **geçicidir**: bellekte ve WebSocket attachment'ında tutulur, SQLite'a yazılmaz.

### 6.3 UserDO

`memberships` (grup listesi), `dm_threads`, `dm_messages`, `dm_read_state`. **DM'ler iki taraflı yazılır:** gönderenin UserDO'su mesajı kendine kaydeder ve alıcının UserDO'suna iletir; her iki tarafta bir kopya vardır. Mesaj ID'si idempotency sağlar. DM sadece **en az bir ortak grubu olan** iki kişi arasında izinlidir.

### 6.4 WebSocket protokolü

Zarf: `{ v: 1, t: "<olay>", id?: "<istemci nonce>", d: { ... } }`. Tüm şemalar `packages/shared`'da.

İstemci → sunucu: `auth`, `msg.send`, `msg.edit`, `msg.delete`, `react.add`, `react.remove`, `typing`, `read.mark`, `channel.create|rename|delete|reorder`, `member.kick|ban|role`, `invite.create|revoke`, `voice.join|leave|state`, `voice.signal`, `share.start|stop|signal`, `history.fetch` (sayfalama: `before=<id>`, 50 mesaj).

Sunucu → istemci: `auth.ok`, `snapshot` (üyeler, kanallar, presence), aynı olayların yayın halleri, `error` (kod + mesaj), `rate.limited`.

Mesaj ID'sini **sunucu** üretir. İstemci iyimser (optimistic) gösterir, `id` nonce'u ile eşleştirir.

### 6.5 Sınırlar ve koruma

- Mesaj en fazla 4.000 karakter. Kullanıcı başına hız sınırı: yaklaşık 5 mesaj/sn (bellek içi token bucket).
- Ek başına en fazla: resim 8 MB (istemci sıkıştırır, saklanan ≤ ~1 MB), GIF 4 MB, diğer dosyalar depolanmaz (P2P).
- Grup başına ek dosya kotası ~1,5 GB; dolunca en eski ekler silinir, mesajda "ek süresi doldu" yazar.
- Mesaj saklama: 90 gün. Günlük `alarm()` ile temizlik.
- Bir grupta en fazla 50 üye (yapılandırılabilir sabit).

### 6.6 Cloudflare Free bütçesi (yaklaşık; wrangler/dashboard'dan doğrula)

Günlük yaklaşık: 100 bin Worker isteği, 100 bin SQLite satır yazımı, 5 milyon satır okuma; toplam 5 GB depolama; WebSocket'te gelen 20 mesaj 1 istek sayılır. 5-6 kişinin kullanımı bunun çok altındadır, ama her yeni özellik için tahmini yük hesabı yapılır (bkz. `AGENTS.md` Bölüm 6).

## 7. Yazılı mesajlaşma

- Yazı kanalları ve DM aynı mesaj bileşenlerini kullanır.
- **Mesaj özellikleri:** düz metin + hafif Markdown (kalın, italik, üstü çizili, satır içi kod, kod bloğu, spoiler `||...||`, otomatik bağlantı), yanıtla, düzenle (düzenlendi etiketi), sil, emoji tepkileri, `@kullanıcı` ve `@everyone` anması, "yazıyor..." göstergesi.
- **Okunmamış:** kanal başına `last_read_id`; grup ve kanal listesinde rozet, anma sayısı ayrı gösterilir.
- **Presence:** çevrimiçi / boşta (Windows `powerMonitor` ile) / çevrimdışı. Değişiklikler birleştirilerek yayınlanır.
- **Geçmiş:** kanala girince son 50 mesaj; yukarı kaydırdıkça sayfalama. Liste sanallaştırılır (binlerce mesajda akıcı).
- **Bildirim:** Windows bildirimi (anma ve DM için varsayılan açık), ses, görev çubuğu rozeti, tray simgesi. Uygulama kapatılınca tray'e küçülür; "Windows ile başlat" seçeneği vardır. Uygulama tamamen kapalıyken bildirim gelmez (bilinen sınır).
- **Arama:** ilk sürümde yok (sonra: SQLite FTS5 varsa onunla).

## 8. Medya (resim, GIF, dosya)

- **Yapıştır / sürükle-bırak / dosya seç** ile eklenir. Göndermeden önce önizleme ve iptal.
- **Resim:** istemcide WebP'ye sıkıştırılır (uzun kenar en fazla 1920 px, kalite ~0,8, hedef ≤ ~1 MB). Sunucu **görüntü işlemez**. 256 KB parçalara bölünüp WebSocket üzerinden yüklenir, parçalar `attachment_chunks`'ta saklanır; alıcı gerektiğinde çeker ve IndexedDB'de önbelleğe alır. Sohbette küçük önizleme (thumbnail) gösterilir; tıklayınca büyük görünüm.
- **Animasyonlu GIF (≤ 4 MB):** olduğu gibi saklanır (WebP'ye çevrilmez, animasyon bozulmasın).
- **Giphy:** uygulama içinden arama. Seçilen GIF'in sadece **URL'si** saklanır (`kind='giphy'`), dosya sunucuya yüklenmez. API anahtarı patrondan istenir (Faz 4).
- **Büyük dosya / video / zip:** sunucuya yüklenmez. Gönderen mesaja "dosya teklifi" ekler (ad, boyut, SHA-256); alıcı "indir" deyince WebRTC DataChannel ile P2P aktarılır (16 KB parça, `bufferedAmountLowThreshold` ile geri basınç, ilerleme çubuğu, bitince hash doğrulama). Gönderen çevrimdışıysa indirilemez, bu arayüzde açıkça yazar.
- Dosya adları ve MIME türleri doğrulanır. Çalıştırılabilir dosyalar için indirme öncesi uyarı gösterilir.

## 9. Sesli sohbet

- **Topoloji:** tam mesh; sesli kanaldaki her çift kişi arasında bir `RTCPeerConnection`. Kanal en fazla 10 kişi (sunucu da reddeder).
- **Sinyalleşme:** GroupDO WebSocket'i üzerinden `voice.join`, `voice.leave`, `voice.signal` (offer/answer/ICE). "Perfect negotiation" deseni kullanılır. Kanala girenin ID'si mevcut katılımcılara duyurulur; **yeni gelen teklif yollar** (çakışmayı önler).
- **ICE sunucuları:** `stun:stun.cloudflare.com:3478` + `/api/turn`'dan alınan kısa ömürlü TURN bilgisi (yaklaşık 1 saat, süre dolmadan yenilenir). TURN alınamazsa yalnızca STUN'a düşülür ve arayüzde net hata gösterilir. TURN için UDP ve TCP/TLS seçenekleri ICE listesinde bulunmalı (kampüs ağları UDP'yi kapatabilir).
- **Ses:** Opus, mono, DTX + FEC açık. Girişte tarayıcının yerleşik yankı önleme, gürültü bastırma ve otomatik kazanç kontrolü (ayarlardan kapatılabilir).
- **Kullanıcı özellikleri:** mikrofon ve hoparlör seçimi, sessize alma (mute), sağırlaştırma (deafen), kişi başı ses düzeyi, konuşma göstergesi (`AudioContext` analizörü ile), ses kanalından ayrılma. Bas-konuş tuşu Faz 8'de.
- **Bağlantı tanı paneli (zorunlu):** her bağlantı için `getStats()` ile aday türü (`host` / `srflx` / `relay`), RTT, paket kaybı, bitrate. Bir arkadaş bağlanamazsa nedenini buradan görürüz. Bu panel Faz 3'ün kabul kriteridir.
- **Yeniden bağlanma:** ağ değişince ICE restart; sunucu WebSocket'i koparsa üstel geri çekilmeyle yeniden bağlan ve ses oturumunu koru.

## 10. Ekran paylaşımı

- **Yakalama:** ana süreçte `desktopCapturer.getSources` ile ekran/pencere listesi (küçük resimlerle), `session.setDisplayMediaRequestHandler` ile seçilen kaynak verilir. **Sistem sesi** Windows'ta `audio: 'loopback'` ile paylaşılabilir (açıp kapatılabilir).
- **Kalite ön ayarları:** 720p30 (**varsayılan**, ~2 Mbps), 1080p30 (~4 Mbps), 1080p60 (uyarı göster, ~7 Mbps). `RTCRtpSender.setParameters` ile `maxBitrate` ve `maxFramerate` ayarlanır. "Hareket" (oyun) / "Ayrıntı" (belge) seçeneği `contentHint` ile.
- **Kodlama:** mümkünse donanım kodlayıcı (H.264). `setCodecPreferences` ile tercih edilir, olmazsa VP8. CPU/GPU yükünü düşük tutmak birincil hedeftir.
- **İzleyici:** ayrı pencere/panel, tam ekran, ses düzeyi.
- **Faz 6 — Mesh:** paylaşan her izleyiciye ayrı akış yollar. Paylaşan kişiye izleyici sayısı 2'yi geçince "bilgisayarını ve internetini yorabilir" uyarısı gösterilir. Aktarım katmanı bir arayüzün arkasında olacak: `ScreenShareTransport` (`MeshTransport`, sonra `CloudflareSfuTransport`).
- **Faz 7 — SFU:** Cloudflare Realtime SFU ile paylaşan **tek akış** yollar, dağıtımı Cloudflare yapar. Bu faz **kapılıdır**: Cloudflare hesabında SFU ve TURN'ün kartsız açılabildiği doğrulanmadan başlanmaz (patron adımı). Açılamazsa yedek plan: ilk 2 izleyiciye doğrudan, kalanlara bu izleyicilerin **yeniden iletmesi** (relay); bu yöntemin CPU maliyeti ve ek gecikmesi raporlanır.

## 11. Masaüstü uygulaması

- **Pencereler:** ana pencere, kaynak seçici (ekran paylaşımı), izleyici. Tek örnek çalışır (`requestSingleInstanceLock`).
- **Güvenlik:** `contextIsolation`, `sandbox`, `nodeIntegration: false`. Tipli IPC köprüsü (`preload`). Sıkı CSP. İzin isteği işleyicisi yalnızca mikrofon ve ekran yakalamaya izin verir. Harici bağlantılar `https:` ile ve `shell.openExternal` üzerinden.
- **Sunucu adresi:** `wrangler deploy` sonrası `*.workers.dev` adresi yapılandırma dosyasında (`apps/desktop/src/config.ts`) durur; secret değildir.
- **Güncelleme:** `electron-updater` + GitHub Releases. İmzasız yayın yapılır; Windows SmartScreen "bilinmeyen yayıncı" uyarısı çıkar, README'de arkadaşlara adım adım anlatılır.
- **Loglar:** yerelde, kişisel veri içermeden. Telemetri yok.
- **Ayarlar:** ses aygıtları, bildirimler, başlangıçta çalıştır, tema (koyu varsayılan, açık), ekran paylaşımı kalitesi.

## 12. Arayüz

Discord'a alışkın kullanıcılar için tanıdık yerleşim, ama kopya değil: sol dar sütunda gruplar, yanında kanal listesi (yazı/ses), ortada sohbet, sağda üye listesi (açılıp kapanır), sol altta ses paneli (mute, deafen, ayrıl, bağlantı durumu). Koyu tema, Türkçe arayüz, klavye kısayolları (kanal geçişi, mute). Erişilebilirlik: klavye ile gezinme, yeterli kontrast, ölçeklenebilir yazı boyutu.

## 13. Discord özellik eşleştirmesi

| Özellik                                               | Durum                               | Faz  |
| ----------------------------------------------------- | ----------------------------------- | ---- |
| Gruplar, yazı ve ses kanalları                        | Var                                 | 1, 3 |
| Roller (owner/admin/member), davet, atma/yasaklama    | Var (basit)                         | 1    |
| Mesaj: yanıt, düzenle, sil, tepki, anma, Markdown     | Var                                 | 2    |
| Okunmamış, "yazıyor...", presence                     | Var                                 | 1-2  |
| Bildirim, tray, Windows ile başlat                    | Var                                 | 2, 8 |
| Sesli sohbet (10 kişiye kadar)                        | Var                                 | 3    |
| Gürültü bastırma, yankı önleme, mute/deafen           | Var (tarayıcı yerleşik)             | 3    |
| Resim, GIF, Giphy, dosya                              | Var                                 | 4    |
| DM                                                    | Var (ortak grubu olanlarla)         | 5    |
| Ekran paylaşımı + sistem sesi                         | Var                                 | 6-7  |
| Bas-konuş (global kısayol)                            | Var                                 | 8    |
| Kamera (webcam)                                       | Sonra (Faz 6'nın üstüne, opsiyonel) | 9    |
| Mesaj arama, sabitleme (pin)                          | Sonra                               | -    |
| Grup DM, özel emoji, tema paketleri                   | Sonra                               | -    |
| Bot, webhook, thread, stage, overlay, oyun aktivitesi | Yok                                 | -    |
| Uygulama kapalıyken bildirim                          | Yok (teknik sınır)                  | -    |

## 14. Performans hedefleri (Türkiye içi, ev interneti)

- Yazılı mesaj: gönderimden alıcıda görünmeye ortanca < 200 ms.
- Ses: tek yönlü gecikme < 150 ms (P2P), TURN üzerinden < 250 ms. Sesli kanala girişten ilk sese < 3 sn.
- Ekran paylaşımı 720p30: paylaşan kişinin CPU'su tek başına oyun oynamayı engellemeyecek düzeyde (donanım kodlamada); yükseliş izleyici sayısıyla doğrusal artar (mesh) veya sabit kalır (SFU).
- Mesaj listesi 10.000 mesajda akıcı kaydırma.
- Soğuk başlangıç: uygulama açılışından sohbet görünene kadar < 3 sn.

## 15. Fazlar

Her faz ayrı dalda, patron onayıyla başlar (bkz. `AGENTS.md` Bölüm 2). Risk önce: bağlantı sorunları erken görülsün diye ses, medyadan önce gelir.

### Faz 0 — İskelet

**Hedef:** Boş ama çalışan proje.

- pnpm monorepo, `apps/desktop`, `apps/server`, `packages/shared`.
- TypeScript strict, ESLint, Prettier, vitest; `pnpm typecheck|lint|test|dev` komutları.
- Electron penceresi açılıyor ("Merhaba Echo"); `wrangler dev` ile Worker `/api/health` yanıtlıyor; iki taraf `shared` paketinden bir sabiti/şemayı kullanıyor.
- `.gitignore` (secret dosyaları dahil), `README.md` (Windows kurulum adımları), `docs/PROGRESS.md`.

**Kabul:** temiz klonda `pnpm install && pnpm dev` ile ikisi de ayağa kalkıyor; testler geçiyor.
**Patron adımları:** Sadece Cloudflare hesabı aç (**kart girme**); `wrangler login` gerektiğinde işçi yönlendirir. Node, pnpm, git gibi araçları işçi kontrol eder ve eksikse **kendisi kurar**, patrona sormaz.

### Faz 1 — Kimlik, grup, kanal, yazılı sohbet (çekirdek)

- Anahtar üretimi, `safeStorage`, ilk açılış ekranı (ad + renk + gizlilik notu).
- GroupDO + UserDO iskeleti, imzalı `auth`, `POST /api/groups`, davet ile katılma.
- Kanal oluştur/yeniden adlandır/sil (yetkiye göre), yazı kanalında mesaj gönder/al, geçmiş sayfalama, presence, "yazıyor...", okunmamış rozeti.
- Yeniden bağlanma (üstel geri çekilme) ve çevrimdışı durum göstergesi.
- Sunucuyu canlıya alma (**patron onayı ile** `wrangler deploy`), `ALLOWED_CREATOR_IDS` ayarı.

**Kabul:** iki farklı bilgisayarda (biri gerçek arkadaş olabilir) grup kur, davetle katıl, mesajlaş; bir taraf çevrimdışıyken atılan mesaj online olunca geliyor; imzasız/üye olmayan istek reddediliyor (test var); rate limit çalışıyor.

### Faz 2 — Zengin mesajlaşma ve bildirim

- Yanıtla, düzenle, sil, tepki, anma, Markdown (sanitize), spoiler, bağlantılar.
- Windows bildirimi, tray, görev çubuğu rozeti, bildirim sesleri, ayarlar ekranı.
- Mesaj saklama temizliği (`alarm()`).

**Kabul:** Bölüm 7 maddeleri çalışıyor; XSS denemeleri (`<script>`, `onerror`, `javascript:`) etkisiz (test var).

### Faz 3 — Sesli sohbet ve TURN (en riskli faz)

- Ses kanalı katılım/ayrılma, mesh WebRTC, sinyalleşme, cihaz seçimi, mute/deafen, kişi başı ses, konuşma göstergesi, 10 kişi sınırı.
- `/api/turn` ve Cloudflare TURN entegrasyonu; ICE listesinde UDP + TCP/TLS.
- **Bağlantı tanı paneli** (`host/srflx/relay`, RTT, kayıp).
- Yeniden bağlanma ve ICE restart.

**Kabul:** en az 3 gerçek kullanıcıyla, farklı ağlarda (ev, mobil hotspot, mümkünse yurt/kampüs) ses çalışıyor; hiçbir çift bağlanamıyorsa tanı paneli nedenini gösteriyor; sesin ortanca gecikmesi patronla birlikte ölçülüyor.
**Patron adımları:** Cloudflare panelinde TURN anahtarı oluştur (**kart isterse dur ve bana haber ver**), `TURN_KEY_ID` ve `TURN_KEY_API_TOKEN`'ı `wrangler secret` ile gir (işçi adımları gösterir).

### Faz 4 — Medya

- Yapıştır/sürükle-bırak/seç, önizleme, WebP sıkıştırma, parçalı yükleme, önbellek, resim görüntüleyici.
- Animasyonlu GIF, Giphy araması (URL olarak), grup ek kotası ve temizliği.
- P2P büyük dosya aktarımı (DataChannel, geri basınç, hash doğrulama).

**Kabul:** 5 MB'lık fotoğraf sıkıştırılıp gidiyor, GIF animasyonu bozulmuyor, kota dolunca eskiler temizleniyor, 200 MB'lık dosya iki bilgisayar arasında bozulmadan aktarılıyor.
**Patron adımları:** Giphy geliştirici hesabından ücretsiz API anahtarı.

### Faz 5 — DM

- UserDO üzerinden DM (iki taraflı yazım), okunmamış, bildirim, medya desteği.
- Ortak grup kontrolü.

**Kabul:** iki kullanıcı DM'leşiyor; ortak grubu olmayan kullanıcıya DM reddediliyor (test var); biri çevrimdışıyken gelen DM sonra görülüyor.

### Faz 6 — Ekran paylaşımı (mesh)

- Kaynak seçici, kalite ön ayarları, sistem sesi, izleyici, `ScreenShareTransport` arayüzü + `MeshTransport`.
- Paylaşan için izleyici sayısı uyarısı ve CPU/GPU/upload dostu varsayılanlar.

**Kabul:** 720p30, 1-3 izleyiciyle akıcı; sistem sesi çalışıyor; patronun bilgisayarında paylaşım sırasında CPU/GPU kullanımı ölçülüp raporlanıyor.

### Faz 7 — SFU (kapılı)

- **Önce patron onayı ve hesap doğrulaması.** Cloudflare Realtime SFU kartsız açılıyor mu? Açılıyorsa `CloudflareSfuTransport`; açılmıyorsa yedek plan (Bölüm 10) için patrondan onay iste.
- Kota izleme notu: 1.000 GB/ay TURN ile ortaktır.

**Kabul:** 5 izleyicide paylaşan kişinin upload'u tek akış kadar; CPU yükü 1 izleyiciyle aynı düzeyde.

### Faz 8 — Cilalama ve dağıtım

- Bas-konuş (global kısayol; **native modül**, patron onayıyla), Windows ile başlat, tek örnek, ayarlar cilası.
- electron-builder NSIS kurulum dosyası, GitHub Releases ile otomatik güncelleme, README'de SmartScreen açıklaması.
- Hata ekranları, boş durumlar, ilk kullanım turu.

**Kabul:** temiz bir Windows makinede kurulum → grup daveti → sesli sohbet baştan sona çalışıyor; güncelleme yayınlanınca uygulama kendini güncelliyor.

### Faz 9 — Kamera (opsiyonel)

Webcam paylaşımı (mesh, düşük çözünürlük). Patron isterse.

## 16. Bilinen riskler

| Risk                                                | Etki                            | Önlem                                                                                                  |
| --------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------ |
| CGNAT / kampüs ağı P2P'yi engeller                  | Bazı arkadaşlar sese bağlanamaz | TURN (UDP + TCP/TLS), tanı paneli, Faz 3'te gerçek ağlarda test                                        |
| Cloudflare TURN/SFU kart isteyebilir                | Faz 3 ve 7 bloklanır            | Patrona haber ver; alternatif ücretsiz TURN sağlayıcısı veya VPS'e (`~€4-6/ay`) geçiş patron kararıdır |
| Free plan limitleri (CPU 10 ms, günlük satır/istek) | Servis kısıtlanır               | `AGENTS.md` Bölüm 6, hibernation, ağır işi istemciye taşıma                                            |
| Türkiye'den Cloudflare'e erişim kısıtlanabilir      | Uygulama çalışmaz               | Sunucu kodu taşınabilir yazılır (Bölüm 2), gerekirse VPS                                               |
| Mesh'te ekran paylaşımı CPU/upload'u yorar          | Paylaşan kişinin PC'si yavaşlar | Varsayılan 720p30, donanım kodlama, uyarı, Faz 7 SFU                                                   |
| İmzasız uygulama SmartScreen uyarısı                | Arkadaşlar çekinebilir          | README'de adım adım anlat; ileride imza sertifikası patron kararı                                      |
| Mesajlar sunucuda düz metin                         | Gizlilik                        | Gizlilik notu (Bölüm 1); istenirse ileride E2E                                                         |
| Windows tam ekran oyunlarda yakalama siyah          | Paylaşım görünmez               | "Tüm ekran" yakalamayı öner, kullanıcıya not göster                                                    |
| Durable Object tek konumda                          | Uzak konumdan biraz yavaş       | Ses P2P olduğu için etkilenmez; sadece yazı gecikmesi                                                  |

## 17. İlk görev

Sadece **Faz 0**. Önce `docs/plans/faz-0.md` planını yaz ve patronun onayını bekle. Onaydan sonra uygula, `AGENTS.md`'deki rapor formatıyla bildir.
