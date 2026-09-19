# Echo — İlerleme Durumu (Progress)

Bu dosya her faz ve görev sonunda güncellenir.

## Faz Durum Özeti

| Faz | Açıklama | Durum | Dal | Notlar |
|---|---|---|---|---|
| Faz 0 | İskelet (Monorepo, TS, Lint, Test, Dev) | Tamamlandı | `faz-0-iskelet` | Monorepo, shared paket, sunucu ve masaüstü iskeleti kuruldu, testler geçti |
| Faz 1 | Kimlik, grup, kanal, yazılı sohbet | Başlanmadı | - | - |
| Faz 2 | Zengin mesajlaşma ve bildirim | Başlanmadı | - | - |
| Faz 3 | Sesli sohbet ve TURN | Başlanmadı | - | - |
| Faz 4 | Medya | Başlanmadı | - | - |
| Faz 5 | DM | Başlanmadı | - | - |
| Faz 6 | Ekran paylaşımı (mesh) | Başlanmadı | - | - |
| Faz 7 | SFU (kapılı) | Başlanmadı | - | - |
| Faz 8 | Cilalama ve dağıtım | Başlanmadı | - | - |
| Faz 9 | Kamera (opsiyonel) | Başlanmadı | - | - |

## Faz 0 — Kabul Kriterleri ve Gerçekleşenler

- [x] pnpm workspace yapısı (`apps/desktop`, `apps/server`, `packages/shared`).
- [x] TypeScript `strict: true` ayarları (`tsconfig.base.json` ve paket tsconfig'leri).
- [x] ESLint (flat config) ve Prettier konfigürasyonları.
- [x] `packages/shared`: Zod şeması (`HealthResponseSchema`), sabitler (`PROTOCOL_VERSION`, `APP_NAME`), Vitest birim testi.
- [x] `apps/server`: Cloudflare Worker (`hono` + `wrangler`), `/api/health` endpoint'i, Vitest entegrasyon testi.
- [x] `apps/desktop`: `electron-vite` + React + Tailwind CSS + TypeScript strict. Güvenlik ayarları (`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, tipli preload köprüsü `window.echoApi`, tek örnek kilidi `requestSingleInstanceLock`).
- [x] Kök script'ler: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm dev`, `pnpm format`.
- [x] `.gitignore`: Secret dosyaları (`.dev.vars`, `.env*`), node_modules, derleme çıktıları (`dist`, `out`, `.wrangler`).
- [x] `README.md`: Windows için kurulum ve geliştirme rehberi.
- [x] Test doğrulamaları:
  - `pnpm typecheck`: Sıfır hata ile geçti.
  - `pnpm lint`: Sıfır hata ile geçti.
  - `pnpm test`: 2 test dosyası, 4 birim testinin tamamı geçti.
  - `apps/server` lokal `wrangler dev` ile ayağa kaldırıldı ve `/api/health` HTTP 200 ile doğrulandı.
  - `apps/desktop` `electron-vite build` ile hatasız derlendi.
