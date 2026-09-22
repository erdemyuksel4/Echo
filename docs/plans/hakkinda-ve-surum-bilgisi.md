# Plan — Uygulama Hakkında & Sürüm Bilgileri Paneli

## 1. Hedef ve Kapsam

Kullanıcının isteği doğrultusunda Echo masaüstü uygulamasına modern, kapsamlı ve bilgilendirici bir **"Hakkında" (About Echo)** bölümü eklemek. Bu bölümde Echo istemci sürümü, protokol sürümü, temel çalışma ortamı (Electron, Chromium, Node.js, mimari), güvenlik ve mimari özetleri ile manuel güncelleme denetleme özelliği yer alacaktır.

## 2. Mimari ve Arayüz Tasarımı

1. **Ayarlar Modalı Sekmeli Yapısı (`SettingsModal.tsx`):**
   - Modal üst kısmında modern Discord tarzı sekmeler:
     - 🎙️ **Ses & Görüntü** (Mikrofon, hoparlör, ses modu, kamera & ayna testi)
     - 🔔 **Bildirimler & Tercihler** (Windows ile başlatma, sesler, bildirimler)
     - ℹ️ **Hakkında** (Uygulama sürümü, platform, altyapı detayları, güncellemeler)
2. **Hakkında Sekmesi İçeriği:**
   - **Echo Başlığı & Logo:** Echo marka ikonu, slogan ("Modern & Güvenli İletişim Platformu").
   - **Sürüm Kartı:**
     - Echo İstemci Sürümü (`v0.1.0` vb., `app.getVersion()`)
     - Protokol Sürümü (`Echo Protocol v1`)
     - Durum Rozeti (Örn: "Güncel Sürüm")
   - **Çalışma Ortamı & Sistem:**
     - Electron Sürümü (`process.versions.electron`)
     - Chromium Sürümü (`process.versions.chrome`)
     - Node.js Sürümü (`process.versions.node`)
     - Platform & Mimari (Windows x64 vb.)
   - **Güvenlik & Mimari Özetleri:**
     - Ed25519 Kriptografik Kimlik (Cihazda şifrelenir)
     - P2P WebRTC Tam Mesh (Ses, Görüntü & Ekran Paylaşımı)
     - Cloudflare Durable Objects Altyapısı
     - Sıfır Telemetri & Tam Gizlilik
   - **Güncelleme Kontrolü:**
     - "Güncellemeleri Denetle" butonu
     - Anlık durum bildirimi (Denetleniyor / Güncel / İndiriliyor / Geliştirici modu)
   - **Bağlantılar:**
     - GitHub Açık Kaynak Deposu bağlantısı (`shell.openExternal`)
     - MIT Lisansı bilgisi
3. **Kullanıcı Çubuğundan Erişim:**
   - Kullanıcı durum çubuğunda (sol alt) Ayarlar dişlisinin yanında veya menüde "Hakkında" butonuna tıklayarak doğrudan Hakkında sekmesiyle açılabilme desteği (`initialTab?: 'about'`).

## 3. Değişecek Dosyalar

- `apps/desktop/src/main/index.ts`: `app:get-info` içerisine Electron, Chromium, Node.js ve mimari sürümlerini ekleme; güvenli `desktop:openExternal` IPC işleyicisi ekleme.
- `apps/desktop/src/preload/index.ts`: `AppInfo` tipini genişletme; `openExternal` ve `onUpdateStatus` metotlarını expose etme.
- `apps/desktop/src/renderer/src/components/SettingsModal.tsx`: Sekmeli yapıya geçiş ve zengin "Hakkında" sekmesi bileşenini ekleme.
- `apps/desktop/src/renderer/src/components/ChannelList.tsx`: Ayarlar modalına `initialTab` geçebilme ve kullanıcı barına hızlı erişim.
- `docs/PROGRESS.md`: İlerleme durumunu güncelleme.

## 4. Riskler ve Önlemler

- **Güvenlik / Dış Bağlantılar:** Dış bağlantılar (GitHub linki vb.) Electron içinde doğrudan açılmamalı; yalnızca `https:` protokolüyle sistem varsayılan tarayıcısında `shell.openExternal` üzerinden açılmalıdır.
- **Kritik Olmayan Hatalar:** Geliştirici modunda güncelleme denetimi çalışmadığında UI kullanıcıya bunu kibarca bildirmeli (hata fırlatmamalı).

## 5. Test ve Doğrulama Yöntemi

1. `pnpm typecheck` ile TypeScript tiplerinin doğrulanması.
2. `pnpm lint` ile kod standartlarının kontrolü.
3. `pnpm test` ile birim testlerinin çalıştırılması.
4. `pnpm --filter @echo/desktop build` ile derleme doğrulaması.
5. Uygulama arayüzünde Ayarlar -> Hakkında sekmesinin açılması, sürüm bilgilerinin eksiksiz görünmesi ve bağlantıların doğrulanması.
