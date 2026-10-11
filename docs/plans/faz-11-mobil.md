# Faz 11: Echo Mobil Versiyonu — Mimari ve Uygulama Planı

Bu plan, Echo'nun masaüstünde sahip olduğu **tüm özelliklerin** (yazılı sohbet, medya, WebRTC mesh ses, kamera, ekran yayını, DM, E2EE, çizim/beyaz tahta) mobil platformlara (Android & iOS) eksiksiz uyarlanması için hazırlanmıştır.

---

## 1. Hedef ve Kapsam

Masaüstü Echo'nun tüm kabiliyetlerini cebe taşımak:
- **Kimlik & Güvenlik:** Cihazda Ed25519 anahtar üretimi, güvenli donanım anahtarlık (Keystore/Keychain), E2EE şifreleme desteği.
- **Sunucu & Protokol Uyumu:** Mevcut Cloudflare Workers + Durable Objects (`GroupDO`, `UserDO`) WebSocket hibernation altyapısıyla %100 uyumlu çalışma.
- **Yazılı Sohbet & Zengin Medya:** Kanallar, Markdown biçimlendirme, spoiler, alıntılı yanıt, düzenleme, silme, emoji tepkileri, `@kullanıcı` anmaları.
- **Medya & Dosyalar:** Görsel yükleme (istemcide otomatik sıkıştırma), GIF oynatıcı, Giphy entegrasyonu, tam ekran Lightbox, P2P dosya transferi.
- **Direkt Mesajlar (DM):** Ortak grup kontrolü, ikili özel sohbet, anlık okunmamış sayaçları.
- **WebRTC Sesli Sohbet:** Tam P2P mesh ses, Cloudflare STUN & TURN desteği, VAD (ses aktivite algılama), Mute / Deafen, hoparlör / kulaklık yönlendirmesi.
- **Mobil Arka Plan Sesi (Background Audio / Foreground Service):** Ekran kilitliyken veya başka uygulamadayken sesli sohbetin kesilmemesi ve durum çubuğu kontrol bildirimi.
- **WebRTC Kamera (Görüntülü Görüşme):** Ön/arka kamera seçimi, 480p düşük gecikmeli mesh görüntü, video sahne ızgarası (VoiceStageView).
- **Ekran Paylaşımı:** PC'den paylaşılan ekranları mobilde akıcı izleme (zoom/pan) + Mobilden ekran yayını başlatabilme (`MediaProjection` / `ReplayKit`).
- **İşbirliği Özellikleri:** Beyaz tahta (Whiteboard) ve ekran çizimlerini mobilde görüntüleme ve parmakla çizim desteği.

---

## 2. Mobil Teknoloji Tercihi

### Öneri: Flutter (Dart) — `apps/mobile`
*Geliştirme ortamında Flutter 3.47.2 ve Dart 3.13.2 zaten kurulu ve hazır bulunmaktadır.*

**Neden Flutter?**
1. **Üstün WebRTC Performansı:** `flutter_webrtc` paketi doğrudan yerel WebRTC C++ motorunu (libwebrtc) kullanır. Mobil cihazlarda düşük pil tüketimi ve donanım destekli ses/video kodlama sağlar.
2. **Kusursuz Arka Plan Servisi:** Android Foreground Service ve iOS CallKit/VoIP entegrasyonu ile ekran kapalıyken arka planda kesintisiz Discord deneyimi.
3. **Pürüzsüz 60/120 FPS Arayüz:** Discord mobilin yeni React Native sürümündeki takılmaların aksine Impeller motoruyla sıfır jank animasyonlar.
4. **Donanım Şifreleme:** `cryptography` ile Ed25519 ve X25519 (E2EE) doğrudan native hızda çalışır.

*(Alternatif: React Native / Expo. Ancak WebRTC C++ köprüsü ve arka plan ses sürekliliği mobil ekosistemde Flutter kadar stabil değildir.)*

---

## 3. Mimari ve Dizin Yapısı

```
Echo/
  apps/
    desktop/               (Mevcut Electron uygulaması)
    server/                (Mevcut Cloudflare Worker + Durable Objects)
    updater/               (Mevcut bağımsız Windows updater)
    mobile/                (Yeni: Flutter mobil uygulaması)
      android/
      ios/
      lib/
        core/
          crypto/          (Ed25519 anahtar yönetimi, SecureStorage)
          network/         (WebSocket istemcisi, yeniden bağlanma, ping/pong)
          webrtc/          (Mesh ses motoru, kamera, ekran paylaşımı, STUN/TURN)
          theme/           (Echo Discord karanlık teması, renk paleti)
        features/
          auth/            (Profil kurulumu, ilk açılış ekranı)
          chat/            (Mesaj listesi, Markdown, medya, tepkiler, ses efektleri)
          voice/           (Ses paneli, VAD, konuşma halkası, video sahnesi)
          screenshare/     (Ekran izleyici ve yayıncı)
          dm/              (Direkt mesajlar, arkadaş listesi)
          media/           (Görsel sıkıştırma, lightbox, Giphy, P2P dosya)
          whiteboard/      (Ortak çizim tahtası)
          settings/        (Ses/kamera ayarları, bildirimler, hesap)
  packages/
    shared/                (Protokol şemaları ve tip referansları)
```

---

## 4. Adım Adım Geliştirme Fazları (Yol Haritası)

### Aşama 1: Çekirdek Altyapı, Kimlik ve Bağlantı (Milestone 1)
- `apps/mobile` Flutter projesinin başlatılması, bağımlılıkların eklenmesi (`flutter_webrtc`, `web_socket_channel`, `flutter_secure_storage`, `cryptography`, `provider`/`bloc`).
- Cihazda Ed25519 anahtar çifti oluşturma, güvenli saklama ve `userId` türetme.
- Cloudflare Workers API ve WebSocket (`GroupDO`, `UserDO`) bağlantısı, `echo-auth` imza protokolü.
- Grup oluşturma, davet kodu ile katılma, kanal listesi.

### Aşama 2: Zengin Yazılı Sohbet & DM (Milestone 2)
- Discord tarzı mobil mesaj akışı, sanallaştırılmış liste (`ListView.builder`).
- Markdown (kalın, italik, kod, spoiler dokunarak açma).
- Alıntılı yanıtlama, mesaj düzenleme/silme, emoji tepkileri, "yazıyor..." animasyonu.
- Direkt Mesajlar (DM) sekmesi ve arkadaşlar yönetimi.

### Aşama 3: Medya ve Dosya Paylaşımı (Milestone 3)
- Kameradan/Galeriden fotoğraf seçimi, mobilde WebP formatına sıkıştırma ve parçalı yükleme.
- Giphy GIF arama ve mesaj içi hareketli oynatıcı.
- Tam ekran görsel görüntüleyici (çift dokunma ve pinch-to-zoom).
- WebRTC DataChannel ile P2P büyük dosya indirme/gönderme.

### Aşama 4: WebRTC Sesli Sohbet & Arka Plan Sürekliliği (Milestone 4 - En Kritik)
- `flutter_webrtc` ile P2P mesh sesli görüşme motoru (Opus mono, AEC, NS).
- STUN/TURN röle entegrasyonu (hücresel veri / LTE / Wi-Fi geçişleri için).
- VAD (Ses aktivitesi algılama) ile avatar etrafında yeşil parlayan halka.
- Mikrofon susturma (Mute), sağırlaştırma (Deafen), hoparlör / ahize geçişi.
- **Android Foreground Service / iOS CallKit:** Uygulama arka plana atıldığında veya ekran kilitlendiğinde sesin kesintisiz devam etmesi ve bildirim çubuğunda ses kontrol butonları.

### Aşama 5: Kamera, Ekran Paylaşımı ve İşbirliği (Milestone 5)
- Ön/arka kamera görüntülü görüşme ve dinamik video grid sahnesi (`VoiceStageView`).
- Masaüstünden yapılan ekran yayınlarını mobilde tam ekran, pan & zoom ile izleme.
- Mobilden ekran yayını paylaşabilme (`MediaProjection`).
- E2EE (Uçtan uca şifreli DM/grup mesajları).
- Ortak çizim tahtası (Whiteboard) entegrasyonu.

### Aşama 6: Dağıtım, İnce Ayarlar ve Test (Milestone 6)
- Android APK derlemesi (`flutter build apk --release`).
- İzin yönetimi (Mikrofon, Kamera, Bildirim, Depolama).
- Düşük ağ / paket kaybı durumunda yeniden bağlanma testleri.
- Masaüstü ile mobil arasında çift yönlü canlı entegrasyon testi.

---

## 5. Riskler ve Önlemler

| Risk | Etki | Önlem |
|------|------|-------|
| Mobil Arka Planında Sesin Kapanması | Kullanıcı başka uygulamaya geçince ses kesilir | Android'de Foreground Service + Partial WakeLock; iOS'ta Background Audio kiti kullanılır. |
| Hücresel Ağda (4G/5G) NAT / P2P Engeli | Mobil kullanıcılar sese bağlanamaz | `ARCHITECTURE.md`'deki Cloudflare STUN & TURN sunucuları dinamik olarak kullanılır. |
| Mesh Mimaride Mobil Pil & Bant Genişliği | 5-6 kişilik kanalda pil tüketimi | Mobilde gelen video/kamera akışları gerekmedikçe duraklatılır (viewport takibi), ses mono Opus DTX olarak çalışır. |
| Bildirimler (Uygulama Tamamen Kapalıyken) | Cloudflare Free planda doğrudan FCM/APNs push sunucusu yok | Öncelikli olarak Foreground Service ile arka plan bağlantısı korunur; talep edilirse Firebase Free FCM tetikleyicisi eklenir. |

---

## 6. Test Yöntemi

1. **Birim & Protokol Testleri:** Ed25519 imza doğrulaması, WebSocket JSON paket ayrıştırma.
2. **Çapraz Platform Testi:** Windows masaüstü (`Echo.exe`) ile Android mobil cihaz (veya emülatör) arasında canlı grup kurma, mesajlaşma, sesli kanala katılma, kamera açma ve ekran izleme.
3. **Arka Plan Testi:** Mobil cihazda ses kanalındayken telefon ekranını kilitleyip sesin kesintisiz iletildiğini doğrulama.
