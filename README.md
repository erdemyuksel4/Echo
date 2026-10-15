# Echo

Echo, modern, güvenli ve gerçek zamanlı bir masaüstü ve mobil sohbet platformudur (gruplar, yazı ve ses kanalları, DM, dosya, kamera ve ekran paylaşımı).

---

## Ön Koşullar

- **Desteklenen İşletim Sistemleri:**
  - **Windows:** Windows 10 veya Windows 11 (x64)
  - **Linux:** Ubuntu 20.04+, Debian 11+, Fedora 38+, Arch Linux vb. (x64)
- **Node.js:** v20+ LTS (v22 önerilir)
- **pnpm:** v9+ (`corepack enable` veya `npm install -g pnpm`)
- **Git**

> **Linux Notu:** Linux sistemlerde native araçlar için gerekli paketler:
> ```bash
> sudo apt-get install build-essential libsecret-1-dev libarchive-tools
> ```

---

## Kurulum

1. Repoyu klonlayın ve proje dizinine gidin:

   ```bash
   git clone https://github.com/erdemyuksel4/Echo.git
   cd Echo
   ```

2. Bağımlılıkları yükleyin:

   ```bash
   pnpm install
   ```

---

## Geliştirme ve Çalıştırma

Tüm uygulamayı (Masaüstü ve Sunucu) aynı anda dev modunda çalıştırmak için:

```bash
pnpm dev
```

Veya servisleri bağımsız çalıştırmak için:

- **Masaüstü (Electron + React):**
  ```bash
  pnpm dev:desktop
  ```

- **Sunucu (Cloudflare Worker):**
  ```bash
  pnpm dev:server
  ```
  Sunucu dev ortamında `http://localhost:8787` adresinde çalışır. Sağlık kontrolü: `http://localhost:8787/api/health`

---

## Kod Kalitesi ve Testler

- **Tip Kontrolü:**
  ```bash
  pnpm typecheck
  ```

- **Kod Standartları (Lint):**
  ```bash
  pnpm lint
  ```

- **Otomatik Biçimlendirme (Prettier):**
  ```bash
  pnpm format
  ```

- **Birim ve Entegrasyon Testleri (Vitest):**
  ```bash
  pnpm test
  ```

---

## Kurulum Paketleri Üretme ve Dağıtım

### 1. Windows Kurulum Paketi (.exe)
Echo'yu tek tıkla kurulan bir Windows kurulum paketine (`.exe` NSIS) dönüştürmek için:

```powershell
pnpm build:exe
```
- Çıktı: `apps/desktop/dist/Echo Setup <sürüm>.exe`

### 2. Linux Paketleri (AppImage, DEB, tar.gz)
Echo'yu Linux ortamlarında çalıştırmak ve dağıtmak için paketlemek:

```bash
pnpm build:linux
```
- **AppImage:** `apps/desktop/dist/Echo-<sürüm>.AppImage` (Herhangi bir Linux dağıtımında kuruluma gerek kalmadan doğrudan çalışır)
  ```bash
  chmod +x Echo-*.AppImage
  ./Echo-*.AppImage
  ```
- **DEB Paketi:** `apps/desktop/dist/echo_<sürüm>_amd64.deb` (Ubuntu/Debian için `sudo dpkg -i echo_*.deb`)
- **Arşiv:** `apps/desktop/dist/Echo-<sürüm>.tar.gz`

> **Wayland & PipeWire Desteği:** Echo, Linux altında hem X11 hem de Wayland oturumlarını otomatik algılar. Wayland altında tam ekran ve pencere paylaşımı için Chromium WebRTCPipeWireCapturer desteği aktif edilmiştir.

---

## Güvenlik ve Mimari

- **Masaüstü:** `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`. Preload IPC köprüsü tiplidir.
- **Kriptografik Kimlik:** Ed25519 asimetrik anahtar çifti. Özel anahtar Windows'ta DPAPI, Linux'ta libsecret/Secret Service koruması ile saklanır.
- **Şemalar:** `@echo/shared` paketi içindeki Zod tanımları istemci, sunucu ve mobil tarafından ortak doğrulanır.
- **Bulut Altyapısı:** Cloudflare Free plan (Workers + Durable Objects Hibernation WebSocket).
