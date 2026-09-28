# Plan: Kristal Netliğinde Ses (Boğukluk Giderme) & Discord Tarzı Kullanıcı Sağ Tık Ses Ayar Menüsü (Context Menu) & Arayüz İyileştirmeleri

## 1. Hedefler
1. **Ses Netliği ve Vokal Parlaklığı (Vocal Clarity & Presence):**
   - Önceki sürümdeki agresif 8000 Hz kesici ve sert kompresör sesin boğuklaşmasına (muffled) yol açtı. İnsan sesinin doğal dinamiğini, nefesini ve netliğini korumak için 8 kHz kesici kaldırılacak, kompresör sadece aşırı yüksek patlamaları (-6 dB tepe) yumuşatacak şekilde şeffaflaştırılacak.
   - Vokal netliğini ve anlaşılırlığını artıran stüdyo tipi **Presence & Clarity Peaking EQ** (+2.5 dB @ 3.2 kHz) ve yumuşak vokal hava bandı eklenerek sesin kristal netliğinde, berrak ve canlı çıkması sağlanacak.
2. **Discord Tarzı Kullanıcı Sağ Tık Menüsü (Agent 1):**
   - Ses sahnesinde (`VoiceStageView`), üye listesinde (`MemberList`) ve sohbette (`ChatMessageItem`) herhangi bir kullanıcıya sağ tıklandığında modern bir context menu açılacak.
   - **Kullanıcıya Özel Ses Seviyesi (Slider):** %0 ile %200 arasında ayarlanabilir ses düzeyi (WebAudio GainNode ile %100 üzeri ses artırma desteği).
   - **Kullanıcıyı Benim İçin Sustur (Mute):** İlgili kullanıcının sesini yalnızca kendisi için susturma/açma.
   - **Direkt Mesaj Gönder:** Tek tıkla ilgili kullanıcının özel DM sohbetine geçiş.
   - **Bahset (@username):** Metin kutusuna etiket ekleme.
   - **Kullanıcı ID Kopyala.**
   - Ses seviyeleri `localStorage` üzerinde saklanarak kanal geçişlerinde hatırlanacak.
3. **Arayüz İyileştirmeleri & Ses Sahnesi Cilası (Agent 2):**
   - Ses sahnesindeki katılımcı kartlarına özel ses ayarı yapıldığında (örneğin %150 veya susturulmuş) küçük şık rozet gösterimi.
   - Sağ tık menüsü için Discord tarzı gölgeli, yumuşak geçişli koyu tema arayüz.

## 2. Dokunulacak Dosyalar
- `apps/desktop/src/renderer/src/services/rnnoise/rnnoiseProcessor.ts` (Akustik filtrelerin şeffaflaştırılması ve Vokal Presence EQ)
- `apps/desktop/src/renderer/src/services/webrtc.ts` (`setUserVolume`, `setUserMuted`, Peer GainNode zinciri)
- `apps/desktop/src/renderer/src/stores/useVoiceStore.ts` (`peerVolumes`, `peerMuted` state ve kalıcılık)
- `apps/desktop/src/renderer/src/components/UserContextMenu.tsx` (Yeni sağ tık menü bileşeni)
- `apps/desktop/src/renderer/src/components/VoiceStageView.tsx` (Sağ tık entegrasyonu ve ses rozetleri)
- `apps/desktop/src/renderer/src/components/MemberList.tsx` (Sağ tık menü entegrasyonu)
- `apps/desktop/src/renderer/src/components/ChatMessageItem.tsx` (Sağ tık menü entegrasyonu)
- `docs/PROGRESS.md`

## 3. Riskler ve Önlemler
- *Risk:* WebAudio GainNode ile %200 ses artışında dijital kırpılma (clipping) riski.
  - *Önlem:* Her kullanıcı ses zincirine yumuşak bir limiter eklenerek ses bozulmadan temiz yükseltilecek.
- *Risk:* Ekranın kenarlarında açılan menünün pencere dışına taşması.
  - *Önlem:* Context menu koordinatları pencere genişliği ve yüksekliğine göre otomatik içeri kenetlenecek.

## 4. Test Yöntemi
- `pnpm typecheck`, `pnpm lint`, `pnpm test`.
- Ağ Test Modu ile insan sesinin boğukluğunun gittiğinin ve berraklaştığının dinlenmesi.
- Katılımcıya sağ tıklayarak %0 - %200 ses değiştirme ve susturma testleri.
- Otomatik sürüm (`v0.1.27`) yayını.
