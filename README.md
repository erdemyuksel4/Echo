# Echo

Echo, birkaç arkadaşın kullanacağı Windows masaüstü sohbet uygulamasıdır (gruplar, yazı ve ses kanalları, DM, dosya ve ekran paylaşımı).

## Ön Koşullar

- **İşletim Sistemi:** Windows 10 veya Windows 11 (x64)
- **Node.js:** v20+ LTS
- **pnpm:** v9+ (`corepack enable` veya `npm install -g pnpm`)
- **Git**

## Kurulum

1. Repoyu klonlayın ve proje dizinine gidin:

   ```powershell
   git clone <repo-url>
   cd Echo
   ```

2. Bağımlılıkları yükleyin:
   ```powershell
   pnpm install
   ```

## Geliştirme ve Çalıştırma

Tüm uygulamayı (Masaüstü ve Sunucu) aynı anda dev modunda çalıştırmak için:

```powershell
pnpm dev
```

Veya servisleri ayrı ayrı çalıştırmak için:

- **Masaüstü (Electron + React):**

  ```powershell
  pnpm dev:desktop
  ```

- **Sunucu (Cloudflare Worker):**
  ```powershell
  pnpm dev:server
  ```
  Sunucu dev ortamında `http://localhost:8787` adresinde çalışır. Sağlık kontrolü: `http://localhost:8787/api/health`

## Kod Kalitesi ve Testler

- **Tip Kontrolü:**

  ```powershell
  pnpm typecheck
  ```

- **Kod Standartları (Lint):**

  ```powershell
  pnpm lint
  ```

- **Otomatik Biçimlendirme (Prettier):**

  ```powershell
  pnpm format
  ```

- **Birim Testleri (Vitest):**
  ```powershell
  pnpm test
  ```

## Tek Tıkla Kurulum Paketi (.exe) Üretme ve Dağıtım

Echo'yu arkadaşlarınıza göndermek üzere tek bir Windows kurulum paketine (`.exe`) dönüştürmek için:

```powershell
pnpm build:exe
```

- Çıktı: `apps/desktop/dist/Echo Setup 0.1.0.exe`
- Arkadaşlarınıza dağıtım ve Windows SmartScreen uyarısını aşma rehberi için bkz: [Arkadaşlara Dağıtım Rehberi](docs/DISTRIBUTION.md).

## Güvenlik ve Mimari

- Masaüstü: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`. Preload IPC köprüsü tiplidir.
- Şemalar: `@echo/shared` paketi içindeki Zod tanımları hem istemci hem sunucu tarafından ortak kullanılır.
- Bulut: Cloudflare Free plan (Workers + Durable Objects).
