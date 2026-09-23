# Plan — Uygulama ve Güncelleyici (EchoUpdater) Ayrıştırma

## 1. Hedef ve Kapsam

Ana Echo masaüstü uygulaması ile güncelleme işlemini (indirme, kurma, yeniden başlatma) birbirinden bağımsız iki ayrı bileşene ayırmak.

Kullanıcı uygulamayı açtığında:
1. `Echo.exe` sürüm kontrolü yapar.
2. Yeni sürüm varsa, `EchoUpdater.exe`'yi başlatır ve `Echo.exe` kendini hemen kapatır (böylece Windows dosya kilitleri serbest kalır).
3. `EchoUpdater` açılır; şık, karanlık bir arayüzde indirme ilerlemesini gösterir, güncellemeyi sessizce kurar ve bitince `Echo.exe`'yi açıp kendini kapatır.

## 2. Ajan Dağılımı

- **Agent 1:** `apps/updater` (EchoUpdater) geliştirilmesi (C# .NET 9 WPF modern koyu tema penceresi, GitHub Releases API'den indirme, NSIS sessiz kurulumu, Echo'yu başlatma).
- **Agent 2:** `apps/desktop` ana uygulamasından eski auto-updater mantığının temizlenmesi, açılışta sürüm kontrolü ve `EchoUpdater`'a yönlendirme yapılması.
- **Agent 3:** Kalite kontrol ve test (typecheck, lint, vitest, electron derlemesi, installer paketlemesi).

## 3. Dokunulacak Dosyalar

- `apps/updater/` (Yeni)
- `apps/desktop/src/main/index.ts`
- `apps/desktop/src/main/updater.ts`
- `apps/desktop/src/preload/index.ts`
- `apps/desktop/package.json`
- `scripts/bump-version.mjs`
- `docs/PROGRESS.md`

## 4. Riskler ve Çözümler

- **Dosya Kilidi:** Ana uygulama updater'ı başlatır başlatmaz `app.quit()` ile kapanır; böylece `AppData\Local\Programs\Echo` üzerindeki tüm kilitler kalkar.
- **Geliştirici Modu:** `pnpm dev` esnasında sürüm kontrolü atlanır; yalnızca paketlenmiş uygulamada (`app.isPackaged`) aktif olur.

## 5. Test Yöntemi

1. `pnpm typecheck` ve `pnpm lint` kontrolü.
2. `pnpm test` (67 testin tamamı).
3. `EchoUpdater.exe` derleme testi.
4. `pnpm --filter @echo/desktop run build:exe` ile NSIS paketleme testi.
