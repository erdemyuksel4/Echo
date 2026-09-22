# Faz 4 — Medya: Resim, GIF, Giphy ve P2P Dosya Paylaşımı Uygulama Planı

Bu plan `ARCHITECTURE.md` (Bölüm 8 ve Bölüm 15) gereksinimlerine ve `AGENTS.md` kurallarına uygun olarak hazırlanmıştır.

---

## 1. Hedef ve Kapsam

Kullanıcıların Discord benzeri zengin medya alışverişi yapabilmesi:

1. **Resim Paylaşımı ve Önizleme:**
   - Sohbet alanına panodan yapıştırma (`Ctrl + V`), sürükle-bırak (`drag-and-drop`) ve dosya seçme butonu (`+` veya ataş ikonu).
   - Gönderilmeden önce mesaj giriş kutusu üzerinde önizleme kutucuğu (thumbnail) ve iptal (`X`) butonu.
   - İstemci tarafında WebP sıkıştırma (Canvas API ile maksimum 1920px uzun kenar, ~0.8 kalite, hedef ≤ 1 MB). Sunucu CPU'su harcanmaz (Cloudflare Free 10ms kuralı).
   - Görsel mesaj kutusu: Tıklanabilir küçük resim (thumbnail), tıklandığında tam ekran **Görsel Görüntüleyici (Lightbox Modal)**, yakınlaştırma ve dışarı aktarma / indirme.

2. **Animasyonlu GIF ve Giphy Araması:**
   - Yerel animasyonlu GIF yüklemeleri (≤ 4 MB) WebP'ye dönüştürülmeden orijinal korunur.
   - Sohbet çubuğunda **GIF** butonu; tıklandığında açılan Giphy/Tenor trendler ve arama popover'ı.
   - Seçilen GIF'lerin doğrudan URL'si mesaja eklenir; sunucu depolama kotası harcanmaz.

3. **Sunucu Depolama Disiplini (`GroupDO` SQLite):**
   - Resimler 256 KB'lık parçalar (`attachment_chunks`) halinde saklanır (Cloudflare SQLite satır limiti).
   - Ek dosyalar için grup başı kota (~1.5 GB) ve 90 günlük saklama temizliği (`alarm()` rutini).
   - `POST /api/groups/:id/attachments` ve `GET /api/groups/:id/attachments/:attachmentId`.

4. **P2P Büyük Dosya Aktarımı (WebRTC DataChannel):**
   - Büyük dosyalar (ZIP, PDF, belgeler vb.) sunucuya yüklenmez.
   - Gönderici mesaja dosya teklifi (dosya adı, boyutu, SHA-256 özeti) ekler.
   - Alıcı "İndir" dediğinde WebRTC DataChannel üzerinden 16 KB parçalarla doğrudan P2P aktarılır; aktarım ilerleme çubuğu (progress bar) ve tamamlanınca SHA-256 hash doğrulaması yapılır.

---

## 2. Dokunulacak Dosyalar

### Ortak Paket (`packages/shared`)

- `packages/shared/src/schemas/message.ts`:
  - `AttachmentSchema` (`id`, `name`, `size`, `mimeType`, `url`, `type: 'image' | 'gif' | 'file'`, `p2pOffer?: { fileHash, fileSize }`).
  - `MessageSchema` içine `attachments: z.array(AttachmentSchema).default([])` entegrasyonu.
- `packages/shared/src/schemas/protocol.ts`:
  - P2P dosya transfer sinyalleri (`file.offer`, `file.accept`, `file.reject`).
- `packages/shared/src/schemas/media.ts`:
  - Medya yükleme ve Giphy yanıt şemaları.

### Sunucu (`apps/server`)

- `apps/server/src/durable/GroupDO.ts`:
  - `attachments` ve `attachment_chunks` SQLite tabloları.
  - Ek yükleme ve getirme uç noktaları (`/internal/attachments/upload`, `/internal/attachments/:id`).
  - 90 günlük ve kota aşımı ek temizleme mantığı.
- `apps/server/src/index.ts`:
  - `POST /api/groups/:id/attachments` (yetkili ve boyutu doğrulanmış yükleme).
  - `GET /api/groups/:id/attachments/:attachmentId` (parçaları birleştirip akışla döndüren uç nokta).
  - `GET /api/giphy/search` (sunucu üzerinden güvenli proxy veya istemci doğrudan erişimi).

### Masaüstü Uygulaması (`apps/desktop`)

- `apps/desktop/src/renderer/src/services/imageCompression.ts`:
  - İstemci tarafı WebP sıkıştırma ve boyutlandırma motoru.
- `apps/desktop/src/renderer/src/services/p2pFileTransfer.ts`:
  - WebRTC DataChannel tabanlı geri basınçlı (backpressure) parça gönderim ve alım servisi.
- `apps/desktop/src/renderer/src/components/ChatArea.tsx`:
  - Sürükle-bırak hedef alanı (drag-drop overlay).
  - Pano yapıştırma (`onPaste`) yakalama.
  - Gönderme öncesi ekler çubuğu (attachment bar) ve dosya seçici butonu.
- `apps/desktop/src/renderer/src/components/ChatMessageItem.tsx`:
  - Resim, GIF ve dosya indirme kartları renderlaması.
- `apps/desktop/src/renderer/src/components/ImageViewerModal.tsx`:
  - Discord tarzı tam ekran görsel inceleme (lightbox modalı).
- `apps/desktop/src/renderer/src/components/GiphyPicker.tsx`:
  - Trend ve arama destekli GIF seçim penceresi.

---

## 3. Riskler ve Önlemler

| Risk                                                     | Önlem                                                                                                                                            |
| :------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------- |
| Büyük resimler Cloudflare SQLite satır limitini aşabilir | İstemcide WebP ile ≤ 1 MB'a sıkıştırılır ve 256 KB parçalara bölünerek saklanır.                                                                 |
| GIF animasyonları WebP çevriminde kaybolabilir           | MIME türü `image/gif` olan dosyalar WebP'ye dönüştürülmez, orijinal baytları korunur (≤ 4 MB).                                                   |
| Giphy API anahtarı veya kota engeli                      | Varsayılan açık API anahtarı ve doğrudan arama fallback'i kurulur; arama yapılamazsa doğrudan URL yapıştırma desteklenir.                        |
| P2P dosya transferinde bellek şişmesi                    | Veri tek seferde belleğe alınmaz; 16 KB parçalarla stream edilir ve aktarım bitene kadar `bufferedAmountLowThreshold` ile geri basınç uygulanır. |
| Kötü amaçlı dosya yürütülmesi                            | Çalıştırılabilir (`.exe`, `.bat`, `.vbs`) dosyalar için indirme ve açma öncesinde kırmızı güvenlik uyarısı gösterilir.                           |

---

## 4. Test ve Doğrulama Planı

1. **Birim & Şema Testleri:**
   - `packages/shared`: Ek şemaları, WebP/MIME doğrulama testleri (`pnpm test`).
2. **Sunucu Entegrasyon Testleri:**
   - `apps/server`: Parçalı ek yükleme, boyutu aşan isteklerin reddi, ek getirme testleri.
3. **Masaüstü & Manuel Doğrulama:**
   - 5 MB JPEG görseli sürükleyip bırakma; istemcide WebP'ye sıkıştırılıp gönderildiğini ve sohbette thumbnail olarak göründüğünü doğrulama.
   - Görsele tıklayıp Lightbox modalında büyütüldüğünü ve indirilebildiğini doğrulama.
   - GIF aramasından veya panodan animasyonlu GIF gönderip animasyonun kesintisiz oynadığını doğrulama.
   - İki kullanıcı arasında (User 1 ve User 2) büyük dosya teklifi gönderip P2P DataChannel üzerinden indirildiğini test etme.
4. **Monorepo Sağlık Kontrolleri:**
   - `pnpm typecheck` (0 hata).
   - `pnpm lint` (0 hata).
   - `pnpm test` (%100 başarı).
   - `pnpm --filter @echo/desktop build` (hatasız derleme).
