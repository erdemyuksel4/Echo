# Faz 2 — Zengin Mesajlaşma ve Bildirim Uygulama Planı

## Hedef

Discord benzeri zengin yazılı mesajlaşma deneyimini ve masaüstü bildirim altyapısını kurmak:

1. **Zengin Mesaj İşlemleri:** Mesaja yanıt verme (`replyTo`), mesaj düzenleme (`editedAt`), mesaj silme (`deletedAt`), emoji tepkileri (`reactions`), `@kullanıcı` ve `@everyone` anmaları, spoiler (`||metin||`), güvenli ve sanitize edilmiş Markdown ayrıştırma.
2. **Bildirim ve Masaüstü Entegrasyonu:** Electron ana sürecinde Windows sistem bildirimleri (`Notification`), sistem tepsisi (Tray simgesi), arka planda çalışma (minimize to tray), bildirim sesleri, görev çubuğu rozeti.
3. **Sunucu Tarafı Yetki ve Saklama:** Sadece kendi mesajını düzenleme/silme (veya kanal/grup yöneticisi silme yetkisi), emoji tepki ekleme/çıkarma, mesaj saklama temizliği için günlük `alarm()` rutini.

---

## Dokunulacak Dosyalar

### 1. Ortak Paket (`packages/shared`)

- `packages/shared/src/schemas.ts`:
  - `MessageSchema`: `replyToId?: string`, `replyToMessage?: Pick<Message, 'id' | 'authorName' | 'content'>`, `editedAt?: number`, `deletedAt?: number`, `reactions: Record<string, string[]>` (emoji -> userId listesi).
  - Yeni WebSocket olay şemaları: `MSG_EDIT`, `MSG_DELETE`, `REACT_ADD`, `REACT_REMOVE`, `READ_MARK`.
- `packages/shared/src/markdown.ts`:
  - Güvenli Markdown ayrıştırıcı ve HTML sanitize (XSS önleme: `<script>`, `onerror`, `javascript:` şemalarını temizler; `||spoiler||` ayrıştırır).

### 2. Sunucu (`apps/server`)

- `apps/server/src/durable/GroupDO.ts`:
  - SQLite `reactions` tablosu (`message_id, user_id, emoji`).
  - `messages` tablosuna `reply_to_id`, `edited_at`, `deleted_at` alanları.
  - `MSG_EDIT` işleyici: Kullanıcı sadece kendi mesajını düzenleyebilir, max 4000 karakter, yayın: `msg.edit`.
  - `MSG_DELETE` işleyici: Mesaj sahibi veya grup admini silebilir, yayın: `msg.delete`.
  - `REACT_ADD` / `REACT_REMOVE` işleyici: İkili işlem, yayın: `react.update`.
  - `alarm()` metodu: 90 günden eski mesajları ve yetim tepkileri temizleyen günlük rutin.

### 3. Masaüstü Uygulaması (`apps/desktop`)

- `apps/desktop/src/main/index.ts`:
  - Tray (sistem tepsisi) oluşturma ve yönetimi.
  - Pencere kapatıldığında tray'e küçülme (`close` olayını yakalama).
  - Windows bildirimleri için IPC kanalları (`desktop:notify`, `desktop:setBadge`).
- `apps/desktop/src/preload/index.ts`:
  - `window.echoApi.showNotification(...)` ve `setBadge(...)` köprüleri.
- `apps/desktop/src/renderer/src/components/ChatArea.tsx`:
  - Mesaj üzerine gelince işlem çubuğu (Tepki ver, Yanıtla, Düzenle, Sil).
  - Yanıt verme kutusu (mesaj kutusunun üzerinde alıntılanan mesaj önizlemesi).
  - Düzenleme modu (satır içi düzenleme ve Enter ile kaydetme / Esc ile iptal).
  - Emoji seçici popover'ı (sık kullanılan Discord benzeri emojiler: 👍, ❤️, 😂, 🎉, 🔥, 🚀, 👀).
  - Tepki rozetleri (tıklanınca tepki ekleme/çıkarma, sayacı artırma/azaltma).
  - Markdown ve spoiler (`||...||`) tıklanınca açılan karartmalı görsel efekt.
- `apps/desktop/src/renderer/src/components/SettingsModal.tsx`:
  - Bildirim sesleri açık/kapalı, masaüstü bildirimleri, tepsiye küçültme tercihleri.
- `apps/desktop/src/renderer/src/services/sound.ts`:
  - Web Audio API ile hafif sentetik bildirim bip sesi (harici ses dosyasına bağımlılık olmadan).

---

## Riskler ve Önlemler

1. **XSS Güvenlik Riski:**
   - _Risk:_ Kullanıcıların girdiği Markdown içerikleri veya özel HTML etiketleri (`<img onerror="...">`) renderer içinde zararlı JS çalıştırabilir.
   - _Önlem:_ Electron zaten `contextIsolation: true`, `sandbox: true` ile korunuyor. Buna ek olarak Markdown çıktısı kesinlikle `DOMPurify` ile sanitize edilecek, dış bağlantılar sadece `https:` kabul edilecek ve `shell.openExternal` ile varsayılan tarayıcıda açılacak.
2. **Tepki/Düzenleme Yarış Durumu (Race Condition):**
   - _Risk:_ Bir mesaj silinirken aynı anda bir başkası tepki ekleyebilir veya düzenleyebilir.
   - _Önlem:_ Cloudflare Durable Objects tek iş parçacıklı (single-threaded actor) çalıştığı için tüm işlemler atomiktir. `messages` tablosunda `deleted_at IS NOT NULL` olan mesaja tepki veya düzenleme yapılması engellenir.
3. **Tepsi ve Windows Uyumluluğu:**
   - _Risk:_ Tray ikonu Windows görev çubuğunda simge bulunamazsa hata verebilir.
   - _Önlem:_ Fallback ikon oluşturulur ve pencerelerin küçülme davranışı test edilir.

---

## Test Yöntemi

1. **Birim Testleri (`vitest`):**
   - Markdown ayrıştırıcı XSS testi (`<script>`, `javascript:alert(1)`, `onerror` senaryoları).
   - Zod şemalarının yanıt, düzenleme ve tepki yüklerini doğrulaması.
2. **Sunucu Testleri:**
   - Mesaj düzenleme ve silme yetki kontrolleri (başkası düzenleyemez).
   - Tepki ekleme ve geri alma testleri.
3. **Elle / Canlı Test:**
   - `pnpm dev` ile iki profil (`dev` ve `dev:user2`) arasında mesaj yanıtlama, emoji tepkisi verme, mesaj düzenleme (`düzenlendi` ibaresini görme) ve silme.
   - Arka plandayken gelen mesajda Windows bildiriminin ve sesinin tetiklenmesi.
