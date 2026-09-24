# Plan: Gerçek Yapay Zeka Gürültü Engelleme (RNNoise) & Ekran Paylaşımı Sistem Sesi Yankı Önleme

## Hedef
1. **Madde 1: Sistem Sesi Yankısını Kesme:** Ekran paylaşımında "Sistem Sesini Paylaş" açıkken, ses kanalındaki arkadaşların konuşmalarının masaüstü ses döngüsüne (loopback) karışıp kanala yankı olarak geri gitmesini engellemek.
2. **Madde 2: Gerçek Yapay Zeka Gürültü Engelleme (RNNoise):** Chromium'un etkisiz dahili filtresi yerine, klavye tuş vuruşlarını, fan/klima uğultusunu ve arka plan seslerini gerçek zamanlı olarak sıfırlayan, 100% ücretsiz ve açık kaynaklı RNNoise (Wasm AudioWorklet) motorunu entegre etmek.

## Ajan Dağılımı (3 Ajan)
- **Patron / Koordinatör Ajan (Ana Model):** Görev dağılımı, mimari denetim, birleştirme, testler ve otomatik sürüm yayınlama.
- **İşçi Ajan 1 (RNNoise AI Geliştiricisi):** `@shiguredo/rnnoise-wasm` veya saf Wasm tabanlı RNNoise AudioWorklet işlemcisini kurar; `webrtc.ts` ve `SettingsModal.tsx` içine "Yapay Zeka Destekli Gürültü Engelleme (RNNoise)" modunu entegre eder.
- **İşçi Ajan 2 (Ekran Sesi Yankı Önleyici):** `screenCaptureService.ts`, `webrtc.ts` ve `ScreenShareTransport.ts` üzerinde, gelen ses kanalı seslerinin ekran yayını mikrofon/sistem akışına karışıp döngüsel yankı (echo loop) yapmasını engelleyen WebAudio filtreleme/ayrıştırma mekanizmasını kurar.

## Dokunulacak Dosyalar
- `apps/desktop/package.json`
- `apps/desktop/src/renderer/src/services/rnnoise/` (yeni klasör ve AudioWorklet / Wasm işlemcisi)
- `apps/desktop/src/renderer/src/services/webrtc.ts`
- `apps/desktop/src/renderer/src/services/screenShare/screenCaptureService.ts`
- `apps/desktop/src/renderer/src/services/screenShare/ScreenShareTransport.ts`
- `apps/desktop/src/renderer/src/components/SettingsModal.tsx`
- `docs/PROGRESS.md`

## Riskler ve Önlemler
- **RNNoise CPU kullanımı:** RNNoise C/Wasm olarak derlenmiş hafif bir RNN modelidir (çerçeve başına <1 ms CPU). Güvenli `AudioWorkletNode` içinde ana iş parçacığını (UI thread) bloke etmeden arka planda çalıştırılacaktır.
- **Sistem Sesi İzolasyonu:** Windows'ta `chromeMediaSource: 'desktop'` donanımsal stereo karışımı alır. Echo'nun kendi ses öğelerinden (`peerAudioElements`) gelen akış, WebAudio dinamik faz/gain iptali veya çıkış yönlendirmesiyle ekran ses izinden temizlenecektir.

## Test Yöntemi
1. `pnpm typecheck` ve `pnpm lint` kontrolü.
2. `pnpm test` ile tüm ortak ve sunucu testlerinin geçmesi.
3. Ayarlar modalındaki ses testi ve loopback ile klavye tıkırtılarının RNNoise açıkken nasıl kesildiğinin doğrulanması.
4. Başarılı olunca `pnpm release` ile GitHub'a sürüm yayınlanması.
