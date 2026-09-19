# Faz 0 Planı — İskelet

## 1. Hedef

Echo için çalışan, boş ama tam teşekküllü monorepo iskeletini kurmak.

- `pnpm` workspace yapısı: `apps/desktop`, `apps/server`, `packages/shared`.
- TypeScript (`strict`), ESLint, Prettier ve Vitest konfigürasyonları.
- Kök seviyede `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm dev` script'leri.
- `packages/shared`: Zod şeması ve ortak tipler (iki tarafın da kullandığı örnek sağlık/ping şeması veya sabit).
- `apps/server`: Cloudflare Worker (`hono` + `wrangler`), `/api/health` endpoint'i `shared` paketinden veri döndürecek.
- `apps/desktop`: `electron-vite` + React + Tailwind CSS + TypeScript strict; güvenli pencere açılışı (`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, tipli preload), "Merhaba Echo" ve `shared` paketinden okunan veri gösterilecek.
- `.gitignore`: Secret dosyaları (`.dev.vars`, `.env*`), derleme çıktıları, node_modules.
- `README.md`: Windows için sıfırdan kurulum ve çalıştırma adımları.
- `docs/PROGRESS.md`: İlerleme durumu ve tamamlanan görevlerin takibi.
- Git dalı: `faz-0-iskelet`.

## 2. Dokunulacak ve Oluşturulacak Dosyalar

- `package.json` (kök workspace tanımları, betikler)
- `pnpm-workspace.yaml` (`apps/*`, `packages/*`)
- `.gitignore`
- `tsconfig.base.json` (ortak TypeScript strict ayarları)
- `eslint.config.js` & `.prettierrc`
- `README.md`
- `docs/PROGRESS.md`
- `packages/shared/`:
  - `package.json`
  - `tsconfig.json`
  - `src/index.ts`
  - `src/schemas/health.ts` (Zod şeması & sabitler)
  - `src/__tests__/health.test.ts`
- `apps/server/`:
  - `package.json`
  - `tsconfig.json`
  - `wrangler.toml`
  - `src/index.ts` (`hono` tabanlı `/api/health` endpoint'i)
  - `test/health.spec.ts` (Vitest Worker testi)
  - `vitest.config.ts`
- `apps/desktop/`:
  - `package.json`
  - `tsconfig.json`
  - `electron-vite.config.ts`
  - `src/main/index.ts` (Electron main süreci, tek örnek, güvenlik kısıtlamaları)
  - `src/preload/index.ts` (Tipli ve izole IPC köprüsü)
  - `src/preload/index.d.ts`
  - `src/renderer/index.html`
  - `src/renderer/src/App.tsx` ("Merhaba Echo" & shared versiyon bilgisi)
  - `src/renderer/src/main.tsx`
  - `tailwind.config.js` & `postcss.config.js`

## 3. Riskler ve Dikkat Edilecekler

- **Windows Yol Uyumluluğu:** Windows dosya yolları (`path.join` / `cross-env`) kullanılacak; bash'e özel komutlardan kaçınılacak.
- **Electron Güvenlik Kuralları:** `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true` korunacak, hiçbir sebeple gevşetilmeyecek.
- **Dış Bağımlılıklar:** Native modül (C++ derleme gerektiren paketler) eklenmeyecek.
- **Free Plan / Bulut Disiplini:** Sunucu sadece `hono` ve `wrangler` dev ortamı olarak kurulacak, secret dosyaları `.gitignore` altına alınacak.
- **Eşzamanlı Çalıştırma:** `pnpm dev` ile hem desktop hem server dev süreçleri (örn. `concurrently` ile) aynı anda ayağa kalkabilmeli.

## 4. Test ve Doğrulama Yöntemi

1. `pnpm install` ile bağımlılıkların temiz ve hatasız kurulması.
2. `pnpm typecheck` komutu ile tüm paketlerin (shared, server, desktop) TypeScript kontrollerinden sıfır hata ile geçmesi.
3. `pnpm lint` ile ESLint kontrolü.
4. `pnpm test` ile Vitest testlerinin (shared ve server) başarıyla geçmesi.
5. `pnpm dev` çalıştırılarak:
   - Worker dev sunucusunun ayağa kalkması ve `http://localhost:8787/api/health` yanıt vermesi.
   - Electron uygulamasının güvenli bir pencere açması, "Merhaba Echo" başlığı ve `shared` paketinden gelen ortak veriyi ekranda göstermesi.
