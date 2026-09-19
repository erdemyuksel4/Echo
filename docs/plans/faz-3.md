# Faz 3 — Sesli Sohbet, WebRTC Mesh ve Bağlantı Tanı Paneli Uygulama Planı

## Hedef

Discord benzeri sesli kanal altyapısını kurmak:
1. **WebRTC Tam Mesh Ses Motoru:** 
   - 10 kişiye kadar tam mesh ses bağlantısı (`RTCPeerConnection`).
   - "Perfect negotiation" deseni (yeni katılan kişi mevcut üyelere offer yollar, çakışma yaşanmaz).
   - Opus codec, mono, DTX ve FEC aktif; gürültü bastırma, yankı önleme ve otomatik kazanç kontrolü.
2. **Sinyalleşme ve ICE Altyapısı:**
   - GroupDO WebSocket üzerinden `voice.join`, `voice.leave`, `voice.signal` (offer, answer, candidate) aktarımı.
   - Cloudflare ücretsiz STUN (`stun:stun.cloudflare.com:3478`) ve `/api/turn` (varsa Cloudflare Calls TURN token'ı, yoksa STUN fallback).
3. **Kullanıcı Arayüzü ve Deneyimi:**
   - Sol menüden ses kanalına tıklayarak katılma ve ayrılma.
   - Sol alt ses kontrol paneli: Bağlantı durumu, kanal adı, ping süresi, Mute (mikrofonu kapat), Deafen (sağırlaştır), Kanaldan Ayrıl butonu.
   - Konuşma göstergesi: `AudioContext` ve `AnalyserNode` ile ses seviyesi takibi; konuşan kişinin kanal ve üye listesindeki avatarı etrafında canlı yeşil halka yanması.
   - Kişi başı ses düzeyi kaydırıcısı (diğer kullanıcıların sesini açıp kısabilme).
4. **Zorunlu Bağlantı Tanı Paneli (Tanı & Kalite):**
   - Her bağlı eş için `getStats()` verileri: Bağlantı durumu, aday türü (`host`, `srflx`, `relay`), RTT (gecikme ms), paket kaybı (loss %), ses bitrate'i.
   - Bağlantı sorunlarını anında tespit edebilmek için tanı paneli modalı / paneli.

---

## Dokunulacak Dosyalar

### 1. Ortak Paket (`packages/shared`)
- `packages/shared/src/schemas/voice.ts`:
  - `VoiceJoinPayloadSchema`, `VoiceLeavePayloadSchema`, `VoiceSignalPayloadSchema`, `VoiceStatePayloadSchema`.
  - WebRTC sinyal tipleri (`offer`, `answer`, `candidate`).
  - Tanı paneli veri arayüzü (`PeerConnectionStats`).
- `packages/shared/src/schemas/protocol.ts`:
  - `VOICE_JOIN`, `VOICE_LEAVE`, `VOICE_SIGNAL`, `VOICE_STATE` olay sabitleri.
- `packages/shared/src/index.ts`: Ses şemalarının dışa aktarımı.

### 2. Sunucu (`apps/server`)
- `apps/server/src/index.ts`:
  - `GET /api/turn`: Cloudflare Calls TURN kimlik bilgilerini üreten (veya STUN listesi döndüren) endpoint.
- `apps/server/src/durable/GroupDO.ts`:
  - Ses kanalı katılımcı takibi (bellek içi `Map<channelId, Set<userId>>`, SQLite'a yazılmaz).
  - Kanal başı en fazla 10 kişi sınır kontrolü.
  - `voice.join`: Yeni gelen kullanıcıyı mevcut katılımcılara duyurma (`voice.user_joined`).
  - `voice.leave`: Ayrılmayı diğerlerine duyurma (`voice.user_left`).
  - `voice.signal`: Offer/Answer/ICE candidate paketlerini hedeflenen kullanıcıya iletme (`targetUserId`).

### 3. Masaüstü Uygulaması (`apps/desktop`)
- `apps/desktop/src/renderer/src/services/webrtc.ts`:
  - `WebRtcVoiceService`: `RTCPeerConnection` havuzu, yerel mikrofon akışı (`navigator.mediaDevices.getUserMedia`), "perfect negotiation", ICE candidate yönetimi, `AudioContext` ses seviyesi dedektörü.
  - `getPeerStats()`: Eş başına RTT, packet loss ve candidate type istatistikleri.
- `apps/desktop/src/renderer/src/stores/useVoiceStore.ts`:
  - Ses durumu (bağlı kanal, sessiz/sağır durumu, konuşan kullanıcılar listesi, eş istatistikleri).
- `apps/desktop/src/renderer/src/components/VoicePanel.tsx`:
  - Sol alt köşe Discord tarzı ses paneli (yeşil bağlantı göstergesi, ping, Mute, Deafen, Ayrıl butonları, Tanı Paneli butonu).
- `apps/desktop/src/renderer/src/components/VoiceDiagnosticsModal.tsx`:
  - Bağlantı tanı paneli: Her katılımcının bağlantı durumu, aday türü (host/srflx/relay), RTT ms, paket kaybı.
- `apps/desktop/src/renderer/src/components/ChannelList.tsx`:
  - Ses kanallarına tıklanınca katılma, kanalın altında bağlı katılımcıların ve konuşma halkalarının listelenmesi.
- `apps/desktop/src/renderer/src/components/MemberList.tsx`:
  - Konuşan kullanıcılarda yeşil canlılık halkası ve kişi başı ses ayarı kaydırıcısı.

---

## Riskler ve Önlemler

1. **Simetrik NAT ve P2P Bağlantı Engeli:**
   - *Risk:* Üniversite, yurt veya bazı mobil operatör ağlarında P2P STUN bağlantıları doğrudan kurulamaz.
   - *Önlem:* Cloudflare STUN birincil olarak kullanılır. Cloudflare Calls TURN bilgileri yapılandırıldığında otomatik devreye girer. Bağlantı Tanı Paneli aday türünü (`host` / `srflx` / `relay`) net gösterir, böylece sorunun kaynağı kullanıcıya şeffafça açıklanır.
2. **Yarış Durumu (Glare / Simultaneous Offer):**
   - *Risk:* İki taraf aynı anda birbirine offer gönderirse WebRTC çakışması yaşanır.
   - *Önlem:* Kuralımız nettir: **Yeni katılan kişi (veya ID'si alfabetik büyük olan) teklif (offer) yollar.** "Polite peer" (perfect negotiation) deseni uygulanarak çakışmalar matematiksel olarak önlenir.
3. **Mikrofon İzinleri ve Electron Sandbox:**
   - *Risk:* Electron sandbox içinde mikrofon izni verilmezse `getUserMedia` hata verir.
   - *Önlem:* `apps/desktop/src/main/index.ts` içinde `session.defaultSession.setPermissionRequestHandler` ile `media` iznine açıkça izin verilir.

---

## Test Yöntemi

1. **Birim ve Protokol Testleri:**
   - Ses sinyalleşme Zod şemalarının doğrulanması (`vitest`).
   - GroupDO ses kanalı 10 kişi sınırı ve sinyal yönlendirme testleri.
2. **Yerel Çoklu Kullanıcı Testi:**
   - `pnpm dev` (Kullanıcı 1) ve `pnpm dev:user2` (Kullanıcı 2) aynı ses kanalına girer.
   - Bir taraf konuşurken `AudioContext` analizörü tetiklenir ve arayüzde yeşil konuşma halkası yanar.
   - Tanı panelinde her iki taraf için `host`/`srflx` aday türü, RTT ve ses istatistikleri doğrulanır.
   - Mute, Deafen ve kanaldan ayrılma işlevleri test edilir.
