# Ses Kanalı Kalıcılığı ve Katılımcı Senkronizasyonu İyileştirme Planı

## Hedef

1. Kullanıcı bir sunucuda ses kanalındayken başka sunuculara veya Direkt Mesajlara (DM) geçtiğinde ses kanalından düşmemesi (arka planda ses bağlantısının kesintisiz devam etmesi).
2. Bir kullanıcı ses kanalından çıktığında katılımcı listesinin tüm istemcilerde anında ve doğru güncellenmesi; gir-çık yapıldığında kimin kanalda olduğunun tutarsızlaşması sorununun kökten çözülmesi.

---

## Sorunların Kök Nedenleri (Root Cause Analysis)

1. **Ses Kanalından Düşme Nedeni:**
   - İstemcideki `wsService` (`websocket.ts`) tek bir WebSocket referansı tutmaktadır.
   - Kullanıcı başka bir sunucuya tıkladığında veya DM (Ana Sayfa) butonuna bastığında `wsService.disconnect()` çağrılmaktadır.
   - `disconnect()` metodu hem `webrtcService.leave()` çağırarak WebRTC eş bağlantılarını kapatmakta hem de eski sunucunun WebSocket bağlantısını kapatmaktadır.
   - Sunucu tarafında (`GroupDO.webSocketClose`) kullanıcının soketi kapandığı için kullanıcı ses kanalından otomatik olarak atılmaktadır (`leaveVoiceRoom`).

2. **Katılımcı Güncellenmeme ve "Orada Mı Değil Mi" Belirsizliği:**
   - Sunucuda `handleAuth` esnasında sadece dolu olan odalar (`room.size > 0`) için `VOICE_PARTICIPANTS` gönderilmektedir. Oda boşalmışsa hiçbir şey gönderilmemekte; istemcinin yerel durumunda (Zustand store) eski katılımcılar silinmeden kalmaktadır.
   - Kullanıcı ses kanalından kendisi ayrıldığında (`webrtcService.leave()`), yerel `channelParticipants` listesinden kendi kaydı anında temizlenmemekte; sunucudan `VOICE_USER_LEFT` gelene kadar beklenmektedir.
   - Bir kullanıcı başka sunucuya veya DM'e geçtiğinde soket kapandığı için, o sırada başka biri odadan çıkarsa istemci bu `VOICE_USER_LEFT` bildirimini hiç alamamakta ve o kişiyi hala kanalda sanmaktadır.

---

## Dokunulacak Dosyalar

1. **`apps/server/src/durable/GroupDO.ts`**
   - `handleAuth`: Gruba ait tüm ses kanallarını tespit edip, boş olan kanallar için de `participants: []` içeren `VOICE_PARTICIPANTS` olayını gönderme.
   - `leaveVoiceRoom`: Katılımcı ayrıldığında durumun netleşmesi için güncel katılımcı listesini yayma.

2. **`apps/desktop/src/renderer/src/stores/useVoiceStore.ts`**
   - `currentGroupId: string | null` ve `currentGroupName: string | null` durumları ekleme.
   - `setConnecting`, `setConnected` ve `setDisconnected` fonksiyonlarını grup bilgisiyle güncelleme.

3. **`apps/desktop/src/renderer/src/services/websocket.ts`**
   - Çoklu soket desteği (`chatSocket` ve `voiceSocket`):
     - Kullanıcı ses kanalındayken başka sunucuya veya DM'e geçerse, ses kanalının bulunduğu sunucunun WebSocket'i (`voiceSocket`) açık tutulur.
     - Ses sinyalleri (`VOICE_SIGNAL`, `VOICE_STATE`, `SHARE_SIGNAL`) ve ses bildirimleri bu soket üzerinden kesintisiz akmaya devam eder.
     - Yalnızca kullanıcı ses kanalından açıkça çıktığında (`leaveVoice`) ilgili ses soketi (eğer aktif sohbet soketi değilse) kapatılır.

4. **`apps/desktop/src/renderer/src/services/webrtc.ts`**
   - `currentGroupId` takibi.
   - `join(groupId, groupName, channelId, channelName)` metodunun güncellenmesi.
   - `leave()` metodunda anında yerel katılımcı temizliği (`removeChannelParticipant`).

5. **`apps/desktop/src/renderer/src/components/ChannelList.tsx`**
   - Ses kanalına tıklandığında `groupId` ve `groupName` iletilmesi.
   - Halihazırda bağlı olunan ses kanalına tekrar tıklandığında kanaldan ayrılma (toggle) imkanı sunulması.

6. **`apps/desktop/src/renderer/src/components/VoicePanel.tsx`**
   - Başka sunucuda veya DM'deyken kullanıcının hangi sunucu ve kanalda bağlı olduğunu gösterme (`{channelName} / {groupName}`).

7. **`apps/desktop/src/renderer/src/components/Sidebar.tsx`**
   - DM veya grup geçişlerinde ses oturumunu düşürmeyen güvenli geçiş yapılması.

---

## Riskler ve Önlemler

- **Risk:** Kullanıcı arka arkaya farklı sunuculardaki ses kanallarına tıklarsa soketler karışabilir.
  - _Önlem:_ Yeni bir ses kanalına bağlanmadan önce mevcut ses kanalından temizce ayrılınır (`leaveVoice`), eski ses soketi kapatılır ve yenisine geçilir.
- **Risk:** Cloudflare Workers bağlantı sınırları.
  - _Önlem:_ İstemci aynı anda en fazla 2 soket (1 aktif sohbet + 1 arka plan ses) açık tutar. Aynı sunucudaysa tek soket paylaşılır.

---

## Test Yöntemi

1. `pnpm typecheck` ve `pnpm lint` ile statik kod doğrulaması.
2. `pnpm test` ile mevcut ve yeni birim testlerinin çalıştırılması.
3. Çoklu pencere / kullanıcı simülasyonu:
   - Kullanıcı A bir ses kanalına katılır.
   - Kullanıcı A başka bir sunucuya tıklar ve DM'e geçer. Ses bağlantısının, ping süresinin ve konuşma göstergelerinin kesilmediği doğrulanır.
   - Kullanıcı B ses kanalına girer ve çıkar. Kullanıcı A'nın ekranında katılımcı listesinin anında 0 ve 1 olarak doğru güncellendiği teyit edilir.
