# Faz 9: Kamera (Webcam) ve Otomatik Güncelleme (Auto-Updater) Planı

## Hedef

1. **Faz 9 (Kamera / Webcam):** Ses kanalındaki kullanıcıların düşük gecikmeli, optimize edilmiş (480p24 Mesh) kamera yayını açabilmesi, karşı tarafların kameralarını Discord tarzı grid sahnede izleyebilmesi.
2. **Otomatik Güncelleme Sistemi (Auto-Updater):** Discord tarzı, uygulama açıldığında GitHub Releases üzerinden yeni sürüm kontrolü yapılması, arka planda indirilmesi ve tek tıkla ("Güncelle ve Yeniden Başlat") otomatik güncellenmesi.

---

## 1. Kamera (Webcam) Mimarisi

### A. Protokol & Ortak Şemalar (`@echo/shared`)

- `VoiceParticipant` şemasına `camera: boolean` alanı eklenmesi.
- `ClientVoiceStatePayloadSchema` şemasına `camera?: boolean` eklenmesi.
- `VOICE_STATE` olayı ile mikrofon ve kulaklık gibi kamera durumu da anlık olarak tüm kanala duyurulur.

### B. Masaüstü & WebRTC Motoru (`apps/desktop`)

- `webrtcService`:
  - `localCameraStream: MediaStream | null` yönetimi.
  - `toggleCamera(enable?: boolean): Promise<boolean>` metodu.
  - `480p24` donanım ve bant genişliği optimizasyonu (`{ width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { max: 24 } }`).
  - Kamera parçalarının (`videoTrack`) mevcut tüm eş bağlantılarına (`RTCPeerConnection`) eklenmesi (`addTrack` / `replaceTrack` / `removeTrack`).
  - Eşlerden gelen kamera akışlarının `cameraStreams: Map<string, MediaStream>` içinde toplanması.
- `useVoiceStore`:
  - `isCameraActive: boolean` ve `cameraStreams: Record<string, MediaStream>` durumları.
  - Katılımcıların `camera` durumu takibi.

### C. Arayüz (UI)

- `VoicePanel.tsx`:
  - Alt ses paneline "Kamera Aç / Kapat" (`Video` / `VideoOff`) butonu eklenmesi.
- `VoiceStageView.tsx` (Yeni Bileşen):
  - Ses kanalına tıklandığında ortada Discord tarzı dinamik video ızgarası (Grid view):
    - Kamera açıksa canlı video görüntüsü (CSS `object-cover`, yuvarlatılmış köşeler).
    - Kamera kapalıysa avatar + konuşurken yeşil parlayan halka.
    - Kullanıcı adı ve susturma/kulaklık simgeleri.
    - Ekran paylaşımı da varsa ana sahnede birlikte yer alma.
- `SettingsModal.tsx`:
  - Kamera aygıtı seçimi (Webcam Selector) ve canlı ayna önizleme testi.

---

## 2. Otomatik Güncelleme (Auto-Updater) Mimarisi

### A. Electron Ana Süreci (`apps/desktop/src/main/updater.ts` & `index.ts`)

- `electron-updater` kütüphanesi entegrasyonu.
- GitHub Releases sağlayıcısı (`owner: erdemyuksel4`, `repo: Echo`).
- Olaylar:
  - `checking-for-update`
  - `update-available` (yeni sürüm bulundu)
  - `download-progress` (indirme yüzdesi)
  - `update-downloaded` (güncelleme hazır)
- IPC Uç Noktaları:
  - `updater:check` (güncellemeleri denetle)
  - `updater:install` (`autoUpdater.quitAndInstall()`)

### B. Preload & Tipler (`apps/desktop/src/preload`)

- `window.echoApi.checkForUpdates()`
- `window.echoApi.quitAndInstall()`
- `window.echoApi.onUpdateDownloaded((info) => void)`
- `window.echoApi.onUpdateProgress((progress) => void)`

### C. Arayüz (UI)

- Sağ üstte veya ses panelinde Discord tarzı yeşil parlayan **"Yeni Güncelleme Hazır — Yeniden Başlat"** rozeti/butonu.
- Tıklandığında uygulama saniyeler içinde yeni sürüme geçip kendini otomatik yeniden başlatır.

---

## Dokunulacak Dosyalar

1. `packages/shared/src/schemas/voice.ts`
2. `apps/desktop/package.json`
3. `apps/desktop/src/main/updater.ts` (Yeni)
4. `apps/desktop/src/main/index.ts`
5. `apps/desktop/src/preload/index.ts` ve `preload/index.d.ts`
6. `apps/desktop/src/renderer/src/services/webrtc.ts`
7. `apps/desktop/src/renderer/src/stores/useVoiceStore.ts`
8. `apps/desktop/src/renderer/src/components/VoicePanel.tsx`
9. `apps/desktop/src/renderer/src/components/VoiceStageView.tsx` (Yeni)
10. `apps/desktop/src/renderer/src/components/SettingsModal.tsx`
11. `apps/desktop/src/renderer/src/App.tsx`

---

## Riskler ve Önlemler

- **Kamera Mesh Yükü:** 10 kullanıcının hepsi kamera açarsa bant genişliği zorlanabilir.
  - _Önlem:_ Çözünürlük 480p24 ile sınırlanır (yaklaşık 300-400 kbps), H.264/VP8 donanım hızlandırması tercih edilir.
- **Auto-Updater İmzası:** Windows SmartScreen imzasız güncellemelerde uyarı verebilir.
  - _Önlem:_ `electron-updater` nsis güncellemelerini delta veya tam paket olarak sessiz kurabilir; README ve dokümantasyonda adımlar açıklanır.

---

## Test Yöntemi

1. `pnpm typecheck`, `pnpm lint`, `pnpm test` sıfır hata ile geçişi.
2. `Cift-Kullanici-Test.bat` ile iki pencere açıp birinde kamerayı açma, diğerinde canlı kamera görüntüsünü ve konuşma halkasını doğrulama.
3. Ayarlar ekranında kamera cihazı listeleme ve canlı ayna testi.
4. Auto-updater kontrol metodunun ve olay dinleyicilerinin simülasyonu.
