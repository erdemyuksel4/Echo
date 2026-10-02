# Yeni Özellikler Yol Haritası (Faz 10+)

Patronun talebi üzerine planlanan gelişmiş özellikler ve uygulama sırası:

## 1. Ekran Yayınlarını Kaydetme Özelliği (Faz 10.2)
- **Hedef:** Kullanıcı ekran yayını izlerken veya kendi yayınını yaparken tek tıkla yüksek kalitede (WebM/MP4) yerel video kaydı başlatıp durdurabilmeli; kayıt bittiğinde dosyayı bilgisayarına kaydedebilmeli.
- **Teknoloji:** HTML5 `MediaRecorder` API + Electron Native Save File Dialog (`showSaveDialog`).
- **Dokunulacak Dosyalar:**
  - `apps/desktop/src/renderer/src/services/screenRecorder.ts`: Video + ses parçalarını birleştiren, parçaları toplayıp blob üreten kayıt servisi.
  - `apps/desktop/src/renderer/src/components/VoiceStageView.tsx`: Ekran karosuna "Kaydet / Kaydı Durdur" butonu ve kırmızı yanıp sönen kayıt süresi göstergesi (`01:23 REC`).
  - `apps/desktop/src/main/index.ts`: Kaydedilen videonun kullanıcının seçeceği dizine (`Videolar` / `Masaüstü`) yazılması için IPC köprüsü.

## 2. Ekrana Çizim & Beyaz Tahta Aracı (Faz 10.3)
- **Hedef:** Ekran yayını sırasında yayıncı ve izin verilen izleyicilerin ekran üzerine canlı fırça, ok, dikdörtgen ve vurgulayıcı çizimleri yapabilmesi; çizimlerin WebRTC DataChannel üzerinden milisaniyeler içinde senkronize olması.
- **Teknoloji:** HTML5 Canvas Overlay (`pointer-events` kontrollü) + WebRTC DataChannel gerçek zamanlı çizim koordinat paketi (`draw:stroke`, `draw:clear`).
- **Dokunulacak Dosyalar:**
  - `apps/desktop/src/renderer/src/components/ScreenAnnotationCanvas.tsx`: Video üzerine binen şeffaf çizim katmanı.
  - `apps/desktop/src/renderer/src/services/screenShare/ScreenAnnotationTransport.ts`: DataChannel çizim yayınlayıcı ve alıcı.
  - `apps/desktop/src/renderer/src/components/VoiceStageView.tsx`: Çizim araç çubuğu (Kalem, Renk paleti, Silgi, Temizle).

## 3. Mesajlarda Uçtan Uca Şifreleme (E2EE) (Faz 10.4)
- **Hedef:** Grup ve DM mesajlarının içeriğinin sunucuya (Cloudflare SQLite) gitmeden önce cihazda şifrelenmesi. Sunucunun mesaj metinlerini ve ekleri asla düz metin olarak görememesi.
- **Teknoloji:** 
  - DM için: X25519 (ECDH) anahtar değişimi + AES-256-GCM (Web Crypto API).
  - Grup için: Grup anahtarı (Group Ratchet / Simetrik AES-256-GCM anahtarı), grup üyeleri arasında ECDH ile güvenle dağıtılır.
- **Dokunulacak Dosyalar:**
  - `packages/shared/src/crypto.ts`: AES-256-GCM şifreleme/çözme ve X25519 türetme fonksiyonları.
  - `apps/desktop/src/renderer/src/services/e2eeService.ts`: Mesaj gönderilmeden önce şifreleme, mesaj geldiğinde çözme katmanı.
  - `apps/server/src/durable/GroupDO.ts` & `UserDO.ts`: Şifreli metin (`content_encrypted`, `iv`) alanlarını doğrulama ve depolama.

## 4. Uzaktan Kontrol (TeamViewer Benzeri) (Faz 10.5)
- **Hedef:** Yayıncının izin verdiği bir arkadaşının yayın ekranına tıklayarak veya tuşlayarak yayıncının bilgisayarını uzaktan yönetebilmesi.
- **Teknoloji & Güvenlik:**
  - WebRTC DataChannel ile güvenli fare koordinatı (normalize x,y: 0.0-1.0), fare tıklamaları ve klavye girdilerinin iletimi.
  - Yayıncı tarafında açık onay/izin mekanizması ("X kullanıcısına kontrol izni ver"). Acil durdurma tuşu (`Escape` veya `F8` ile anında kontrolü kesme).
  - Windows tarafında girdi simülasyonu: Electron ana sürecinde Windows `SendInput` API köprüsü.
- **Dokunulacak Dosyalar:**
  - `apps/desktop/src/main/remoteControl.ts`: Windows SendInput girdi köprüsü.
  - `apps/desktop/src/renderer/src/services/remoteControlTransport.ts`: DataChannel girdi gönderici/alıcı.
  - `apps/desktop/src/renderer/src/components/RemoteControlOverlay.tsx`: İzleyici tarafında girdi yakalama ve yayıncı tarafında izin bildirimi.
