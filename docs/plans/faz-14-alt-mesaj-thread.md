# Faz 14 Planı: Discord Tarzı Alt Mesaj (Thread) Sistemi

## 1. Hedef
Discord'daki gibi bir mesaja bağlı alt sohbet (Thread / İleti Dizisi) oluşturabilme, mesaj altında "X Yanıt" göstergesi sunma ve tıklandığında sağ tarafta açılan bağımsız alt mesajlaşma yan panelinde (`ThreadPanel`) sohbet edebilme sistemini kurmak.

---

## 2. Dokunulacak Dosyalar

1. **Ortak Şemalar (`packages/shared`):**
   - `packages/shared/src/schemas/message.ts`:
     - `MessageSchema`'ya `threadId` (nullable/optional), `threadCount` (number, default 0), `threadLastReplyAt` (number, nullable) eklenmesi.
     - `ThreadHistoryQuerySchema`: Thread mesajlarını sayfalamak için sorgu şeması (`channelId`, `threadId`, `before`, `limit`).
   - `packages/shared/src/schemas/protocol.ts`:
     - İstemci & Sunucu WebSocket olayları: `THREAD_FETCH`, `THREAD_DATA`, `msg.send` içinde `threadId` desteği.

2. **Sunucu Mimarisi (`apps/server`):**
   - `apps/server/src/durable/GroupDO.ts`:
     - SQLite `messages` tablosuna `thread_id` kolonu (ve index) eklenmesi (`ALTER TABLE` geriye dönük uyumlu migration).
     - `msg.send` işleyicisine `threadId` desteği:
       - Mesaj bir thread'e atılıyorsa ana mesajın (root message) `thread_count` ve `thread_last_reply_at` değerinin güncellenmesi.
       - İlgili kanaldaki tüm bağlı istemcilere `msg.new` ve ana mesaj için `msg.updated` (yeni yanıt sayısı ve son yanıt saati) yayını.
     - `thread.fetch` işleyicisi: Belirli bir `threadId`'ye ait mesaj geçmişini döndürme.
     - `msg.delete` ve `msg.edit` işleyicilerinde thread mesajlarının sorunsuz yönetimi (kök mesaj silinirse alt mesaj sayacının tutarlılığı).

3. **Masaüstü Arayüzü (`apps/desktop`):**
   - `apps/desktop/src/renderer/src/components/ChatMessageItem.tsx`:
     - Mesaj aksiyon barına "Alt Başlık Başlat / Yanıt Dizisi (Thread)" butonu eklenmesi.
     - Mesaj altında `threadCount > 0` ise Discord tarzı şık bir alt mesaj barı: `🧵 [X Yanıt • Son yanıt zamanı >]`. Tıklandığında thread panelini açma.
   - `apps/desktop/src/renderer/src/components/ThreadPanel.tsx` (Yeni bileşen):
     - Discord tarzı sağ yan panel (açılır/kapanır).
     - Üstte sabitlenen kök mesaj kartı.
     - Altında thread mesajları akışı (Markdown, tepkiler, ekler destekli).
     - En altta alt mesaj gönderme kutusu (gönder, emoji vb.).
   - `apps/desktop/src/renderer/src/components/ChatArea.tsx`:
     - `activeThreadId` state yönetimi ve `ThreadPanel` entegrasyonu.
     - Ana sohbette sadece ana kanal mesajlarının (`threadId` boş/null olanların) listelenmesi; thread mesajlarının ana akışı kirletmemesi.
   - `apps/desktop/src/renderer/src/types/` veya store güncellemeleri.

---

## 3. Riskler ve Çözümler

- **Risk 1:** Ana sohbet akışının thread mesajlarıyla dolması.
  - *Çözüm:* Ana kanal mesaj sorgusunda (`history.fetch`), yalnızca `thread_id IS NULL` olan mesajlar döndürülecektir. Böylece ana sohbet tertemiz kalır; alt mesajlar sadece ilgili thread panelinde görünür.
- **Risk 2:** Cloudflare Durable Object SQLite depolama ve CPU bütçesi.
  - *Çözüm:* Ekstra bir tablo yerine mevcut `messages` tablosuna `thread_id` kolonu ve indeks (`idx_messages_thread`) eklenir. Sayaç için ayrı sorgu yükü getirmemek adına mesaj gönderiminde ve sorgusunda minimal CPU tüketimi sağlanır.
- **Risk 3:** Kök mesaj silindiğinde alt mesajların yetim kalması.
  - *Çözüm:* Kök mesaj silindiğinde `deleted = 1` işaretlenir, alt mesajlar korunur ancak silinmiş kök mesaj altında görüntülenebilir veya kök mesaja göre yetki denetimi yapılır.

---

## 4. Test Yöntemi

1. `pnpm typecheck`, `pnpm lint`, `pnpm test` komutlarının sıfır hata ile geçmesi.
2. `packages/shared` için yeni şema birim testleri.
3. Sunucu tarafında thread mesaj gönderme ve geçmiş sorgulama entegrasyon testleri.
4. Masaüstü uygulamasında:
   - Bir mesaja tıklayıp alt başlık başlatma.
   - Alt başlık panelinde mesajlaşma.
   - Ana sohbette "1 Yanıt • Az önce" rozetinin canlı belirmesi.
   - Rozete tıklandığında sağ panelin açılarak thread geçmişinin yüklenmesi.
