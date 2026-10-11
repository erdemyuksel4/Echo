# Plan: Ses Kanalı Katılımcı Listesi Senkronizasyonu, Otomatik Bot Tahliyesi ve Sağ Tık Ses Düzeyi Düzeltmeleri

## 1. Hedef
Patron tarafından bildirilen 3 kritik sorunu çözmek:
1. **Otomatik Bot Tahliyesi & Kanal Boşaltma:** Son insan kullanıcı ses kanalından çıktığında botun (`bot-music`) da kanaldan çıkması, müziğin tamamen durdurulması ve sunucudaki oda durumunun sıfırlanması.
2. **Kanal Katılımcı Listesi Anlık Senkronizasyonu:** DM'lere veya başka kanallara gidip gelindiğinde, kanaldan gir-çık yapıldığında katılımcı listesinin boş görünmesi / senkronizasyonunun kopması sorununun kökten çözülmesi.
3. **Sağ Tık Bireysel Ses Düzeyi & Susturma (Volume Control):** Sağ tıklayıp ses kısma / açma (%0 - %200) ve kullanıcı susturma işlevinin gerçek zamanlı olarak çalışır hale getirilmesi.

---

## 2. Kök Neden Analizi & Çözüm Stratejisi

### Sorun 1: Grupta/kanalda kimse yoksa botun çıkmaması
- **Kök Neden:** `GroupDO.ts` içinde `leaveVoiceRoom` fonksiyonunda kullanıcı çıktığında insan sayısı 0'a inse bile, bazı durumlarda (istemci bağlantı kopması, DM'ye geçiş) `bot-music` odada asılı kalabiliyor ve tüm istemcilere yetkili boş liste (`VOICE_PARTICIPANTS: []`) yayınlanmıyordu.
- **Çözüm:**
  - `GroupDO.ts`: Bir ses odasından son insan ayrıldığında veya son insan bağlantıyı kestiğinde (`webSocketClose`), `bot-music` odadan derhal silinecek, müzik durumu `stopped` yapılacak ve tüm istemcilere hem `VOICE_USER_LEFT` hem de güncel boş liste `VOICE_PARTICIPANTS` anında yayınlanacak.
  - Masaüstü istemcisinde (`musicPlayer.ts`): Host kanaldan çıktığında yerel arka plan oynatıcı (`playerWindow`) anında kapatılacak.

### Sorun 2: Kanaldakilerin anlık listesinin bozulması (gir-çık, DM'lere geçiş)
- **Kök Neden:**
  1. `Sidebar.tsx`: Kullanıcı "Ana Sayfa" (DM) butonuna tıkladığında `wsService.disconnect()` çağrılarak grup WebSocket'i tamamen kapatılıyordu. Bu durum ses kanalındayken bile bağlantıyı koparıyor ve DM'den geri dönüldüğünde eski katılımcı durumu sıfırlanıyordu.
  2. `GroupDO.ts`: Sunucu katılımcı değişimlerinde yalnızca tekil fark olayları (`VOICE_USER_JOINED` / `VOICE_USER_LEFT`) yayınlıyordu. Herhangi bir paket kaçtığında veya yeniden bağlanıldığında istemci listesi güncellenmiyordu.
- **Çözüm:**
  - `Sidebar.tsx`: DM'lere geçildiğinde ses bağlantısı veya grup bağlantısı gereksiz yere kapatılmayacak (`wsService.disconnect()` kaldırılacak, arka planda canlı kalacak).
  - `GroupDO.ts`: Her katılma (`VOICE_JOIN`) ve ayrılma (`VOICE_LEAVE`) olayında sunucu, o kanalın en güncel ve kesin katılımcı listesini `VOICE_PARTICIPANTS` olayıyla tüm gruba duyuracak.
  - `websocket.ts`: Gruba tıklandığında veya kanal değiştirildiğinde sunucudan güncel `VOICE_PARTICIPANTS` listesi anında alınarak `useVoiceStore.setChannelParticipants` ile senkronize edilecek.

### Sorun 3: Sağ tıklayıp ses kısma özelliğinin çalışmaması
- **Kök Neden:**
  1. `VoiceStageView.tsx`: `ParticipantTile` bileşeninde kamera açıkken `<video>` etiketinde `muted={isLocal}` kullanılıyordu. Uzak kullanıcı için `muted=false` olduğu için video etiketi ham WebRTC sesini doğrudan tarayıcı üzerinden 100% sesle oynatıyor, arka plandaki ses denetimini tamamen baypas ediyordu.
  2. `webrtc.ts`: Ses düzeyi yalnızca HTML5 `<audio>` etiketinin `volume` (0.0 - 1.0) özelliğine bağlanmıştı. Chromium motorunda WebRTC MediaStream akışlarında bu özellik ses filtreleme yapamıyor ve %100 üzerindeki ses yükseltmelerini (%200) desteklemiyordu.
- **Çözüm:**
  - `VoiceStageView.tsx`: `ParticipantTile` içindeki `<video>` etiketi `muted={true}` yapılacak.
  - `webrtc.ts`: Her uzak kullanıcı için Web Audio API `AudioContext` ve `GainNode` zinciri (`peerGainNodes`) bağlanacak.
  - `UserContextMenu.tsx`: Kullanıcı sesi değiştirildiğinde `gainNode.gain.setValueAtTime(...)` ile ses anında %0 (susturuldu) ile %200 (yükseltildi) arasında doğrudan işitsel olarak ayarlanacak.

---

## 3. Dokunulacak Dosyalar
1. `apps/server/src/durable/GroupDO.ts` *(Katılımcı yayınları & boş oda bot tahliyesi)*
2. `apps/desktop/src/renderer/src/services/websocket.ts` *(Senkronizasyon & DM geçiş düzeltmesi)*
3. `apps/desktop/src/renderer/src/components/Sidebar.tsx` *(DM geçişinde gereksiz disconnect engelleme)*
4. `apps/desktop/src/renderer/src/services/webrtc.ts` *(Web Audio GainNode entegrasyonu)*
5. `apps/desktop/src/renderer/src/components/VoiceStageView.tsx` *(Video ses çakışması engelleme)*
6. `apps/desktop/src/renderer/src/components/UserContextMenu.tsx` *(Ses kısma & susturma köprüsü)*

---

## 4. Riskler ve Test Yöntemi
- **Risk:** Web Audio AudioContext'in tarayıcı otomatik oynatma (autoplay policy) engeline takılması.
  - *Önlem:* İlk kullanıcı etkileşiminde veya ses kanalına katılımda `audioContext.resume()` güvencesi eklenecek.
- **Test:**
  - `pnpm typecheck`, `pnpm lint`, `pnpm test` çalıştırılacak.
  - İki istemci ile kanal gir-çık, DM'ye geçiş ve sağ tık ses kısma doğrulanacak.
