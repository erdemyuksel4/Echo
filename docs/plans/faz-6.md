# Faz 6 — Ekran Paylaşımı (Mesh) Uygulama Planı

## Hedef

Discord benzeri ekran ve pencere paylaşımı altyapısını kurmak:
1. **Kaynak Seçici & Yakalama (Electron Main & Renderer):**
   - Ana süreçte `desktopCapturer.getSources({ types: ['window', 'screen'] })` ile açık pencerelerin ve monitörlerin küçük resimli listesini alma.
   - Seçilen kaynağı `navigator.mediaDevices.getUserMedia` ile yakalama.
   - Windows sistem sesi (loopback audio) yakalama seçeneği.
2. **Kalite Ön Ayarları & Kodlama:**
   - 720p30 (Varsayılan, ~2 Mbps), 1080p30 (~4 Mbps), 1080p60 (Performans uyarılı, ~7 Mbps).
   - `RTCRtpSender.setParameters` ile `maxBitrate` ve `maxFramerate` ayarları.
   - "Hareket" (`motion`) / "Ayrıntı" (`detail`) seçimi ile `track.contentHint` ayarı.
   - Donanım uyumluluğu için `setCodecPreferences` ile H.264 / VP8 tercihi.
3. **Modüler Aktarım Katmanı (`ScreenShareTransport`):**
   - `ScreenShareTransport` arayüzü tanımlanması.
   - Faz 6 için `MeshScreenShareTransport` implementasyonu (mevcut WebRTC mesh bağlantıları üzerinden video/audio track aktarımı veya ayrı video peer bağlantısı).
   - Faz 7 (Cloudflare Realtime SFU) için arayüzün hazır bırakılması.
4. **İzleyici Deneyimi & Uyarılar:**
   - Paylaşan kişiye izleyici sayısı 2'yi geçtiğinde "bilgisayarını ve internetini yorabilir" uyarısı.
   - Ses kanalında yayın yapan kullanıcının yanında "CANLI" rozeti.
   - İzleyiciler için şık yayın izleme paneli: Tam ekran modu, yayın ses düzeyi kaydırıcısı, yayından ayrılma.

---

## Dokunulacak Dosyalar

### 1. Ortak Paket (`packages/shared`)
- `packages/shared/src/schemas/screenshare.ts` (Yeni):
  - `ScreenQualityPresetSchema` ('720p30' | '1080p30' | '1080p60')
  - `ScreenShareSourceSchema` (id, name, thumbnailDataUrl, appIconDataUrl, isScreen)
  - `ScreenShareStateSchema` (userId, isSharing, quality, hasAudio, viewersCount)
- `packages/shared/src/schemas/protocol.ts`:
  - `SHARE_START`, `SHARE_STOP`, `SHARE_SIGNAL` olayları ve veri şemaları.
- `packages/shared/src/index.ts`: Ekran paylaşımı şemalarının dışa aktarımı.
- `packages/shared/src/__tests__/screenshare.test.ts` (Yeni): Birim testleri.

### 2. Sunucu (`apps/server`)
- `apps/server/src/durable/GroupDO.ts`:
  - Ses kanalındaki aktif ekran yayıncılarının ve izleyicilerinin takibi (`screenShares: Map<channelId, Map<userId, ScreenShareInfo>>`).
  - `share.start`, `share.stop`, `share.signal` olaylarının yönlendirilmesi ve kanaldaki diğer kullanıcılara yayını.
- `apps/server/test/screenshare.spec.ts` (Yeni): Ekran paylaşımı sinyal yayını testleri.

### 3. Masaüstü Uygulaması (`apps/desktop`)
- `apps/desktop/src/main/index.ts`:
  - `desktop:getSources` IPC işleyicisi (`desktopCapturer.getSources` ile pencereleri ve ekranları thumbnail ile alma).
- `apps/desktop/src/preload/index.ts`:
  - `getDesktopSources` IPC köprü metodu.
- `apps/desktop/src/renderer/src/services/screenShare/transport.ts` (Yeni):
  - `ScreenShareTransport` arayüzü ve `MeshScreenShareTransport` sınıfı.
- `apps/desktop/src/renderer/src/services/screenShare/screenCaptureService.ts` (Yeni):
  - Medya akışı yakalama, bitrate/framerate yapılandırma, loopback ses desteği.
- `apps/desktop/src/renderer/src/stores/useScreenShareStore.ts` (Yeni):
  - Paylaşım durumu, aktif yayıncılar listesi, izlenen yayın ve izleyici sayısı.
- `apps/desktop/src/renderer/src/components/ScreenSourcePickerModal.tsx` (Yeni):
  - Ekran ve pencere sekmeleri, önizleme kartları, kalite seçici, sistem sesi onay kutusu.
- `apps/desktop/src/renderer/src/components/ScreenShareViewer.tsx` (Yeni):
  - Video oynatıcı, ses seviyesi ayarı, tam ekran butonu, kapatma butonu.
- `apps/desktop/src/renderer/src/components/VoicePanel.tsx`:
  - Ses kanalında "Ekran Paylaş" butonu, yayını durdurma butonu ve izleyici uyarı rozeti.
- `apps/desktop/src/renderer/src/components/ChannelList.tsx`:
  - Ses kanalı katılımcılarında "CANLI" rozeti ve tıklayarak yayını izleme.

---

## Riskler ve Önlemler

1. **Windows Tam Ekran Oyunlarda Siyah Ekran:**
   - *Risk:* Bazı DirectX/Vulkan tam ekran oyunlar pencere yakalama API'sinde siyah ekran dönebilir.
   - *Önlem:* Kaynak seçici modalında kullanıcıya "Oyun paylaşıyorsanız lütfen 'Tüm Ekran' seçeneğini kullanın" uyarısı gösterilecek.
2. **Mesh Bant Genişliği ve CPU Yükü:**
   - *Risk:* 3 veya daha fazla kişi aynı anda izlediğinde upload ve CPU tüketimi artar.
   - *Önlem:* Varsayılan kalite 720p30 (~2 Mbps) olarak tutulacak; H.264 donanım hızlandırma tercih edilecek; izleyici sayısı 2'yi geçtiğinde yayıncıya görsel uyarı verilecek.
3. **Sistem Sesi (Loopback Audio):**
   - *Risk:* Windows'ta bazı aygıt kombinasyonlarında loopback ses yakalanamayabilir.
   - *Önlem:* Sistem sesi opsiyonel onay kutusu olarak sunulacak, yakalanamazsa sessiz video akışına otomatik düşülecektir.

---

## Doğrulama ve Test Yöntemi

1. **Otomatik Testler:**
   - `pnpm --filter @echo/shared test` (şemalar ve kalite ayarları testleri).
   - `pnpm --filter @echo/server test` (GroupDO share sinyal yönlendirme testleri).
   - `pnpm --filter @echo/desktop typecheck` (TypeScript tip kontrolü).
   - `pnpm lint` (kod stili ve kalite kontrolü).
2. **Elle Test Senaryosu:**
   - Ses kanalına katıl → "Ekran Paylaş" butonuna tıkla.
   - Kaynak seçici pencerede ekranlar ve açık pencereler küçük resimleriyle listeleniyor mu?
   - 720p30 seçerek paylaşımı başlat → Kendi ekranında küçük önizleme ve yayın çubuğu görünüyor mu?
   - İkinci istemciden (veya ikinci profilden) ses kanalına gir → Paylaşım yapan kişinin yanında "CANLI" rozeti çıkıyor mu?
   - "Yayını İzle" tıklandığında video akıcı şekilde tam ekran / pencere içinde oynatılıyor mu?
