# Plan: Doğrudan Ses Yayını (P2P Music Host), Google/YouTube Girişi ve Reklam Yönetimi

## 1. Hedef
Kullanıcının talebi doğrultusunda müzik sistemini 3 aşamada dönüştürmek:
1. **Google / YouTube Girişi:** Kullanıcıların kendi Google/YouTube hesaplarıyla oturum açabilmesi (böylece YouTube Premium'u olan kullanıcıların hiçbir reklamla karşılaşmaması).
2. **Kanal İçi Doğrudan Ses Yayını (Host Streaming):** Şarkıyı kanalda kim açtıysa, şarkının yalnızca onun bilgisayarındaki arka plan oynatıcısında çalışması; sesin WebRTC üzerinden odadaki diğer tüm kullanıcılara canlı radyo gibi P2P aktarılması. Diğer kullanıcıların YouTube açmak zorunda kalmaması.
3. **Akıllı Reklam Durumu ve Otomatik Atlama:** Şarkıyı açan kişide Premium yoksa reklam çıktığında arayüzde ("YouTube Reklamı Oynatılıyor...") rozeti gösterilmesi ve YouTube reklam atlamaya izin verdiği salise otomatik atlanması.

## 2. Dokunulacak Dosyalar
- `apps/desktop/src/main/musicPlayer.ts`: 
  - `persist:youtube` session partition ile Google/YouTube giriş penceresi (`loginWithGoogle`).
  - YouTube reklam algılandığında renderer'a anlık durum iletimi (`music:adStatus`).
  - Oynatıcı penceresinin ses akışının (Audio Loopback/Stream) WebRTC'ye beslenmesi.
- `apps/desktop/src/preload/index.ts`:
  - `window.echoApi.music.loginWithGoogle()` ve reklam durumu dinleyicisi.
- `apps/desktop/src/renderer/src/services/webrtc.ts`:
  - Şarkıyı açan kişinin yerel müzik sesini miksleyip WebRTC bağlantısına göndermesi, izleyicilerin doğrudan bu sesi dinlemesi.
- `apps/desktop/src/renderer/src/components/MusicModal.tsx` & `MusicPlayerWidget.tsx`:
  - "YouTube Hesabı Bağla / Oturumu Kapat" butonu.
  - "YouTube Reklamı Oynatılıyor" durum rozeti.
- `apps/server/src/durable/GroupDO.ts` & `packages/shared/src/schemas/music.ts`:
  - Müzik durumuna `hostUserId` ve `isAd` durumlarının eklenmesi.

## 3. Riskler ve Önlemler
- **Risk 1 (Upload Yükü):** Şarkıyı yayınlayan kullanıcı kanaldaki herkese ses gönderecektir.
  - *Önlem:* WebRTC Opus kodeki sadece 64-96 kbps ses harcar. 4 kişilik bir odada toplam upload ~300 kbps olur, bu da tüm modern internet hatları için oldukça hafiftir.
- **Risk 2 (Google Giriş Güvenliği):**
  - *Önlem:* Electron içinde hiçbir şifre okunmaz veya saklanmaz. Doğrudan izole `accounts.google.com` penceresi açılır ve Chromium'un kendi güvenli cookie deposunda oturum tutulur.

## 4. Test Yöntemi
1. Google giriş modalı açılıp oturum açılabilmesi ve çerezlerin kalıcı olması testi.
2. Reklam başladığında arayüzde sarı rozetin çıkması ve atlanabilir olduğu an otomatik atlaması testi.
3. 2 kullanıcı ile test: Kullanıcı 1 şarkı açtığında Kullanıcı 2'nin YouTube açmadan sesi doğrudan Kullanıcı 1'den pürüzsüzce duyması testi.
