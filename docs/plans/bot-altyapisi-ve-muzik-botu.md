# Plan: Genişletilebilir Bot Altyapısı (Bot Framework) ve Sanal Müzik Botu

## 1. Hedef ve Vizyon

Echo için gelecekte eklenebilecek tüm botlara (Müzik Botu, Yapay Zeka/Asistan Botu, Moderasyon Botu, Mini-Oyunlar vb.) zemin hazırlayan modüler bir **Bot Altyapısı (Bot Framework)** kurmak ve ilk olarak bu altyapı üzerinde **Sanal WebRTC Müzik Botu**'nu geliştirmek.

### Temel Prensipler:
1. **Modüler Bot Mimarisi:** Her bot `BaseBot` sınıfından türer; kendi komutlarını (`!play`, `!skip`, `!help` vb.), yeteneklerini (`voice`, `chat`, `events`), durumunu ve arayüz kartını tanımlar.
2. **Discord Tarzı Deneyim:** Kanallarda botlar gerçek katılımcı olarak görünür, yanlarında şık bir `[BOT]` rozeti taşır.
3. **Sıfır İstemci Yükü (Zero Client Overhead):** Dinleyiciler müzik dinlemek için hiçbir gizli YouTube/Chromium penceresi açmaz. Sadece botun odadaki WebRTC ses akışını (arkadaş sesi gibi) dinler.
4. **Sıfır Reklam & Saf Ses:** YouTube saf ses akışı çözülerek doğrudan Web Audio üzerinden WebRTC ses kanalına aktarılır.

---

## 2. Mimari Bileşenler

### A. Ortak Katman (`packages/shared`)
- **`BotManifest` / `BotType` / `BotCapability`:** Bot tanımları, komut şemaları (`BotCommandDefinition`), yetenek matrisi (`'voice' | 'chat_commands' | 'events' | 'audio_stream'`).
- **`ChannelParticipant`:** `isBot?: boolean`, `botId?: string`, `botType?: string` alanları.
- **`WsClientEvents` / `WsServerEvents`:** Bot olayları ve komut çalıştırma (`BOT_COMMAND_INVOKE`, `BOT_STATE_UPDATE`).

### B. Sunucu Katmanı (`apps/server`)
- **`GroupDO.ts`:**
  - Botların ses kanalına katılımı (`bot-music`, `bot-ai` vb.) ve kanal katılımcı listesinde `isBot: true` ile yayınlanması.
  - Bot WebRTC sinyallerinin (`VOICE_SIGNAL`) host istemcisi ve diğer kullanıcılar arasında yönlendirilmesi.
  - Odada kimse kalmadığında botların otomatik tahliyesi.

### C. Masaüstü Bot Çerçevesi (`apps/desktop/src/renderer/src/services/bots/`)
- **`BaseBot.ts`:** Tüm botların ortak temel sınıfı (olay dinleme, komut ayrıştırma, yaşam döngüsü).
- **`VoiceBot.ts` (extends `BaseBot`):** Ses kanalına bağlanabilen, WebRTC audio track besleyen ses botu tabanı.
- **`MusicBot.ts` (extends `VoiceBot`):**
  - Sıra yönetimi (kuyruk, döngü, karıştırma).
  - Saf ses akış motoru (`HTML5 Audio` + `AudioContext` -> `MediaStreamDestination`).
  - Metin komutları (`!play`, `!pause`, `!resume`, `!skip`, `!stop`, `!queue`, `!np`).
- **`BotManager.ts`:** Kayıtlı botları (`registry`) yöneten, gelen mesajlardaki `!` ve `/` komutlarını ilgili bota dağıtan merkezi orkestratör.

### D. Arayüz Bileşenleri
- **Üye Listesi (`MemberList.tsx`) & Ses Paneli (`VoicePanel.tsx`):** `[BOT]` etiketi (Discord tarzı mor/mavi arka plan, beyaz kalın yazı).
- **Ses Sahnesi (`VoiceStageView.tsx`):**
  - Müzik botu için özel görselleştirme kartı (albüm kapağı, çalan şarkı, yeşil konuşma halkası, bireysel ses kısma sürgüsü).
- **Sohbet Alanı (`ChatArea.tsx`):** Bot komutlarının işlenmesi ve bot yanıtlarının zengin mesaj kartı olarak dönmesi.

---

## 3. Dokunulacak Dosyalar

1. `packages/shared/src/schemas/bot.ts` *(Yeni dosya)*
2. `packages/shared/src/schemas/voice.ts` *(Katılımcı şeması güncellemesi)*
3. `packages/shared/src/schemas/protocol.ts` *(Bot olayları)*
4. `packages/shared/src/index.ts` *(Dışa aktarımlar)*
5. `apps/server/src/durable/GroupDO.ts` *(Bot katılımı & sinyalleşme)*
6. `apps/desktop/src/renderer/src/services/bots/BaseBot.ts` *(Yeni dosya)*
7. `apps/desktop/src/renderer/src/services/bots/VoiceBot.ts` *(Yeni dosya)*
8. `apps/desktop/src/renderer/src/services/bots/MusicBot.ts` *(Yeni dosya)*
9. `apps/desktop/src/renderer/src/services/bots/BotManager.ts` *(Yeni dosya)*
10. `apps/desktop/src/renderer/src/components/VoiceStageView.tsx` *(Bot kartı & ses denetimi)*
11. `apps/desktop/src/renderer/src/components/MemberList.tsx` *(BOT etiketi)*
12. `apps/desktop/src/renderer/src/components/music/MusicPlayerWidget.tsx` *(Kumanda entegrasyonu)*

---

## 4. Riskler ve Çözümler

- **Risk 1:** Şarkıyı başlatan (Host) kullanıcı ses kanalından çıkarsa müzik kesilir mi?
  - *Çözüm:* Host Handoff (Sahiplik Devri): Odada başka bir kullanıcı varsa botun yerel ses yayıncılığı sıradaki kullanıcıya devredilir; kimse kalmazsa bot kanaldan ayrılır.
- **Risk 2:** WebRTC bant genişliği ve CPU.
  - *Çözüm:* Bot tek bir hafif Opus ses akışı (64 kbps) basar; izleyicilerde sıfır video/Chromium çalışacağı için sistem performansı en üst düzeyde olur.
- **Risk 3:** YouTube akış linklerinin süre aşımı (expire olması).
  - *Çözüm:* Her şarkı sırası geldiğinde anlık taze ses URL'si alınır.

---

## 5. Test ve Doğrulama Adımları

1. Bot altyapısı birim testleri (`packages/shared/src/__tests__/bot.test.ts`).
2. `pnpm test:dual` ile iki istemci açılarak:
   - Kanalda `[BOT]` rozetli **"Echo Müzik"** katılımcısının belirdiği doğrulanır.
   - Host şarkıyı açtığında diğer kullanıcının bilgisayarında hiçbir YouTube/video açılmadan botun WebRTC sesinin net şekilde duyulduğu test edilir.
   - Dinleyicinin botu sağ tıklayıp sesini kısabildiği doğrulanır.
   - Sohbete `!play`, `!skip`, `!stop` yazıldığında botun komutları başarıyla işlediği kontrol edilir.
3. `pnpm typecheck`, `pnpm lint`, `pnpm test` çalıştırılır.
4. Başarı durumunda `pnpm release` ile yeni sürüm yayınlanır.
