# Plan: Discord Tarzı Sanal Müzik Botu (Virtual WebRTC Peer)

## 1. Hedef ve Kapsam

Discord'daki müzik botları (Rythm, FredBoat, Groovy vb.) modeline geçiş:
- **Eski Yöntem:** Her dinleyicinin bilgisayarında ayrı ayrı gizli Chromium pencerelerinde YouTube açılıyor, zaman damgaları senkronize edilmeye çalışılıyordu. Bu durum dinleyiciler arasında senkron kaymalarına, farklı zamanlarda çıkan reklamlara ve gereksiz bellek/CPU tüketimine yol açıyordu.
- **Yeni Yöntem (Discord Modeli):**
  - Müzik açıldığında ses kanalına sanal bir katılımcı katılır: **`🎵 Echo Müzik [BOT]`**.
  - Sadece şarkıyı başlatan kullanıcının istemcisi (Host) sesi işler ve `MediaStreamAudioDestinationNode` ile WebRTC ses hattına saf Opus ses akışı olarak enjekte eder.
  - Kanaldaki diğer hiçbir kullanıcının bilgisayarında **YouTube/Chromium açılmaz**; odadaki herkes tıpkı bir arkadaşları konuşuyormuş gibi botun yayınladığı saf sesi WebRTC üzerinden dinler.
  - Herkes kanal listesinden veya sahneden botun sesini bağımsız olarak kısıp açabilir.
  - Bot konuşurken/çalarken etrafında yeşil ses halkası yanar.

---

## 2. Dokunulacak Dosyalar

1. **`packages/shared/src/schemas/voice.ts` & `protocol.ts`:**
   - `ChannelParticipant` şemasına `isBot?: boolean` rozeti eklenmesi.
   - Bot kimlik standartları (`userId: bot-music-<channelId>`).

2. **`apps/server/src/durable/GroupDO.ts`:**
   - Bot katılımcısının ses kanalı listesine eklenmesi ve sinyalleşme (`VOICE_SIGNAL`) mesajlarının host istemcisi üzerinden yönlendirilmesi.
   - Odadaki herkes kanaldan çıktığında botun otomatik temizlenmesi.

3. **`apps/desktop/src/renderer/src/services/virtualMusicBotService.ts` (Yeni Servis):**
   - Host tarafında çalışan sanal bot kontrolcüsü.
   - Şarkı çalmaya başladığında bot kimliğiyle WebRTC bağlantısı kurar, yerel Web Audio çıkışını WebRTC audio track'i olarak odaya basar.
   - Şarkıyı açan kişi kanaldan çıkarsa bot sorumluluğunu kanalda kalan bir sonraki kullanıcıya devreder (Host Handoff).

4. **`apps/desktop/src/renderer/src/components/VoiceStageView.tsx` & `VoicePanel.tsx`:**
   - Ses kanalında botun Discord tarzı mor `BOT` etiketiyle şık bir katılımcı kartı olarak gösterilmesi.
   - Botun çaldığı şarkı bilgisi, animasyonlu müzik dalgaları ve bireysel ses ayarı sürgüsü.

5. **`apps/desktop/src/renderer/src/components/music/MusicPlayerWidget.tsx` & `MusicModal.tsx`:**
   - Dinleyiciler için yerel oynatıcı yerine uzaktan kumanda (kumanda/kuyruk) mantığına geçirilmesi.

---

## 3. Riskler ve Çözümler

- **Risk 1:** Şarkıyı açan (host) kullanıcı kanaldan ayrılırsa müzik kesilir mi?
  - *Çözüm:* Akıllı Host Transferi: Odada başka kullanıcı varsa botun yayıncılığı odadaki bir sonraki kullanıcıya pürüzsüz devreder. Odada kimse kalmazsa bot kanaldan ayrılır.
- **Risk 2:** WebRTC Mesh bant genişliği.
  - *Çözüm:* Bot sadece tek bir ses track'i (Opus ~64kbps) gönderir. Video/ekran yayınına göre bant genişliği ve CPU yükü yok denecek kadar azdır.
- **Risk 3:** YouTube reklamları.
  - *Çözüm:* Sadece host tarafında işlendiği için dinleyiciler asla reklam beklemesi veya reklam videosu görmez.

---

## 4. Test Yöntemi

1. `pnpm test:dual` ile iki istemci açılır ve aynı ses kanalına girilir.
2. 1. kullanıcı müzik panelinden bir parça başlatır.
3. Kanalda **`🎵 Echo Müzik [BOT]`** kullanıcısının belirdiği ve yeşil konuşma halkası yaktığı doğrulanır.
4. 2. kullanıcının bilgisayarında arka planda hiçbir YouTube penceresi açılmadığı ve botun sesini doğrudan WebRTC üzerinden sıfır gecikmeyle duyduğu doğrulanır.
5. 2. kullanıcının botun sesini sağ tıklayıp kısabildiği test edilir.
6. `pnpm typecheck`, `pnpm lint`, `pnpm test` çalıştırılır.
