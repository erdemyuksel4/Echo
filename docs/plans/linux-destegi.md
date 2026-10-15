# Linux Desteği ve GitHub Dağıtımı Planı

## 1. Hedef ve Kapsam

Echo'nun Linux işletim sistemlerinde (Ubuntu, Debian, Fedora, Arch Linux vb.) sorunsuz çalışması, geliştirilebilmesi, derlenebilmesi ve son kullanıcılara `AppImage`, `.deb` ve `.tar.gz` formatlarında sunulması.

## 2. Dokunulacak Dosyalar

1. `apps/desktop/package.json`:
   - `build.win.extraFiles`: `EchoUpdater.exe` dosyasını sadece Windows hedefine sınırlandırma (Linux derlemesinde dosya yok hatasını ve Windows ikilisinin Linux paketine girmesini engeller).
   - `build.linux`: `AppImage`, `deb`, `tar.gz` hedefleri, masaüstü kısayol tanımları (`desktop`), kategori (`Network;Chat;AudioVideo`) ve ikon (`resources/icon.png`) yapılandırması.
   - Scriptler: `"build:linux"` ve `"build:all"` eklenmesi.
2. `package.json`:
   - Kök dizine `"build:linux"` script'i eklenmesi.
3. `apps/desktop/src/main/index.ts`:
   - Linux Wayland ve PipeWire ekran paylaşımı bayrakları (`WebRTCPipeWireCapturer`, `ozone-platform-hint=auto`).
   - Linux için öncelikli `.png` pencere ve sistem tepsisi ikonu seçimi.
4. `apps/desktop/src/main/identity.ts`:
   - `safeStorage`: Linux ortamlarında Secret Service / KWallet kilitli veya eksik olduğunda çökme yaşanmaması için `try...catch` koruması ve temiz fallback.
5. `apps/desktop/src/renderer/src/components/SettingsModal.tsx`:
   - Platform metinlerinin ("Windows ile Birlikte Başlat", "Windows sistem bildirimleri") Linux ve diğer platformlarla uyumlu dinamik hale getirilmesi ("Sistemle Birlikte Başlat", "Sistem bildirimleri").
6. `scripts/bump-version.mjs`:
   - `dotnet publish` Windows ikilisinin yalnızca `win32` üzerinde derlenmesi (Linux/macOS geliştiricilerinde patlamayı önleme).
   - Linux dağıtım paketlerinin (`.AppImage`, `.deb`, `.tar.gz`, `latest-linux.yml`) GitHub Release varlıklarına otomatik dahil edilmesi.
7. `.github/workflows/release.yml`:
   - GitHub Actions üzerinde `matrix` ile hem `windows-latest` (NSIS .exe) hem `ubuntu-latest` (AppImage, deb, tar.gz) derlemesi yapan ve GitHub Releases'e yükleyen CI/CD iş akışı.
8. `README.md`:
   - Linux kurulum, çalıştırma ve sistem gereksinimleri dokümantasyonu.
9. `docs/PROGRESS.md`:
   - Yapılan işlemlerin ve Linux desteğinin kayıt altına alınması.

## 3. Olası Riskler ve Önlemler

- **Risk:** Windows makinesinde doğrudan `AppImage` derlenmeye çalışıldığında Linux toolchain eksikliği nedeniyle `electron-builder` uyarı verebilir.
  - **Önlem:** Yerelde `tar.gz` ve temel Linux derlemeleri test edilir; tam `AppImage` ve `.deb` paketleri için hem `build:linux` yapılandırması tamamlanır hem de GitHub Actions (`ubuntu-latest`) devreye sokulur.
- **Risk:** Linux'ta `safeStorage` libsecret olmadığında (minimal WM, container vb.) çökme.
  - **Önlem:** `identity.ts` içinde `try...catch` ile çift katmanlı base64 fallback'e düşülür.
- **Risk:** Wayland altında ekran paylaşımının siyah ekran vermesi.
  - **Önlem:** `WebRTCPipeWireCapturer` bayrağı Chromium seviyesinde aktif edilir.

## 4. Test Yöntemi

1. `pnpm typecheck` ve `pnpm lint` kontrolü.
2. Tüm birim ve entegrasyon testlerinin (`pnpm test`) çalıştırılması.
3. `apps/desktop` derleme çıktılarının doğrulanması.
4. `scripts/bump-version.mjs` sürümleme ve GitHub yükleme adımlarının simülasyonu / doğrulanması.
