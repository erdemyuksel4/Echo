# Plan: Görsel (Text/Base64 Data URL) ve GIF Gönderme Desteği

## 1. Hedef ve Çözüm Yaklaşımı

1. **Görselleri Text / Base64 Formatında Gönderme:**
   - Sunucunun karmaşık chunked SQLite depolama sistemindeki URL hatalarını (çift slash `//` ve 404 Not Found) ve Cloudflare Free depolama kotalarını aşmak için görseller istemci tarafında optimize edilmiş modern **WebP** formatına sıkıştırılır (~30-70 KB).
   - Sıkıştırılmış görsel doğrudan **Base64 Data URL (`data:image/webp;base64,...`)** olarak mesajın `attachments` dizisine metin formatında eklenir.
   - Böylece hem grup kanallarında hem de direkt mesajlarda (DM) hiçbir sunucu yükleme hatası olmadan anında gönderilir ve karşı tarafta sıfır gecikmeyle açılır.

2. **GIF Arama & Gönderme Sorununun Çözümü:**
   - Sunucudaki `GIPHY_API_KEY` eski ve banlanmış public test anahtarı (`dc6zaTOxFJmzC`) olduğu için 403 Forbidden hatası veriyordu.
   - Doğrulanmış ve aktif çalışan Giphy API anahtarı entegre edilecek.
   - `GiphyPicker` arama yapılmadığında güncel popüler (trending) GIF'leri getirecek, arama yapıldığında ise Türkçe/İngilizce GIF sonuçlarını anında listeleyecek.
   - Seçilen GIF'ler doğrudan yüksek hızlı CDN URL'si veya WebP olarak mesaja eklenecek.

3. **Direkt Mesajlara (DM) Görsel & GIF Desteği:**
   - `DmChatArea.tsx` içine de görsel yükleme ve GIF seçme butonları eklenerek kullanıcıların birebir sohbetlerde de resim ve GIF paylaşabilmesi sağlanacak.

---

## 2. Dokunulacak Dosyalar

- `apps/desktop/src/renderer/src/services/imageCompression.ts`
  - Görselleri ~1280px ve 0.80 kalite WebP formatında sıkıştırıp doğrudan Base64 Data URL üreten `createImageAttachment` fonksiyonu.
- `apps/desktop/src/renderer/src/components/ChatArea.tsx`
  - Dosya seçme, sürükle-bırak (drag-drop) ve panodan yapıştırma (Ctrl+V) işlemlerini Base64 attachment ile anında hazırlayıp gönderme.
- `apps/desktop/src/renderer/src/components/GiphyPicker.tsx`
  - Çalışan API ile hızlı arama ve trending listeleme.
- `apps/server/src/index.ts`
  - `/api/giphy/search` proxy'sine aktif anahtar atanması ve yedek upload route'unun çift slash hatasının düzeltilmesi.
- `apps/desktop/src/renderer/src/components/DmChatArea.tsx`
  - DM alanına görsel yükleme ve GIF butonu eklenmesi.
- `docs/PROGRESS.md`
  - Yapılan geliştirmelerin belgelenmesi.

---

## 3. Riskler ve Önlemler

| Risk | Olasılık | Önlem |
|------|----------|-------|
| Büyük boyutlu resimlerin WebSocket mesajını şişirmesi | Düşük | `imageCompression.ts` çözünürlüğü maks 1280px'e ve WebP kalitesini 0.80'e çeker; tipik bir ekran görüntüsü 35-65 KB olur. |
| GIF animasyon karelerinin kaybolması | Düşük | Harici GIF'ler doğrudan Giphy CDN URL'siyle taşınır; yerel yüklenen GIF'ler için boyut kontrolü yapılır. |

---

## 4. Test ve Doğrulama Adımları

1. Giphy API trending & search çağrılarının başarılı HTTP 200 ve JSON döndürdüğünün doğrulanması.
2. `pnpm typecheck` ile tip güvenliğinin doğrulanması.
3. `pnpm lint` ile ESLint kontrolünün geçmesi.
4. `pnpm test` ile 79 birim/entegrasyon testinin hatasız çalışması.
5. `pnpm release` ile otomatik paketlenip GitHub'a yüklenmesi.
