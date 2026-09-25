# Faz: Gerçek Zamanlı AudioWorklet ile RNNoise Gürültü Engelleme ve "Pıt-Pıt" / Çıtırtı Çözümü

## 1. Hedef
Echo masaüstü uygulamasında gürültü engelleme açıkken konuşma sırasında karşı tarafa giden sürekli "pıt-pıt" / çıtırtı / klik seslerini kökten ve kalıcı olarak yok etmek; profesyonel Discord/Krisp kalitesinde, gecikmesiz ve kesintisiz ses iletimini sağlamak.

## 2. Sorunun Kök Neden Analizi
- **Neden sessizlikte değil de sadece konuşurken "pıt-pıt" duyuluyor?**
  1. **ScriptProcessorNode Ana İş Parçacığı (UI Thread) Tıkanması:** `rnnoiseProcessor.ts` içinde kullanılan `ScriptProcessorNode` tarayıcının ana JavaScript iş parçacığında (UI thread) çalışmaktadır. Kullanıcı konuştuğunda `vadInterval` (60ms), React avatar konuşma halkaları, ses seviye animasyonları ve `diagnosticsInterval` (1.5s `getStats`) çalışır. Bu UI yükleri ana iş parçacığında 10-25 ms'lik mikro gecikmelere yol açar.
  2. **MediaStreamDestination Arabellek Açlığı (Underflow):** `ScriptProcessorNode` geciktiğinde Web Audio'nun gerçek zamanlı render motoru `MediaStreamDestination`'a zamanında arabellek yetiştiremez. Sinyal aktif olduğu anda meydana gelen bu mikro kesintiler karşı tarafa **"pıt-pıt" (clicking / popping)** olarak yansır. (Sessizlik anında genlik 0 olduğu için bu kesinti duyulmaz, konuşma başladığı anda her hecede işitilir).
  3. **W3C Standardı:** W3C Web Audio konsorsiyumu `ScriptProcessorNode`'u tam olarak bu UI takılmaları ve klik sesleri yüzünden kullanımdan kaldırmış (deprecated) ve yerine gerçek zamanlı ses iş parçacığında çalışan **`AudioWorklet`** mimarisini zorunlu kılmıştır.

## 3. Mimari Çözüm: Native SIMD AudioWorklet Entegrasyonu
Projemizde zaten kurulu olan `@sapphi-red/web-noise-suppressor` kütüphanesinin `RnnoiseWorkletNode` ve SIMD WebAssembly motoru devreye alınacaktır:
1. **İş Parçacığı İzolasyonu:** RNNoise sinir ağı doğrudan tarayıcının OS öncelikli **AudioWorklet** iş parçacığında (ayrı thread) çalışır. UI'da ne kadar ağır render olursa olsun ses işleme sıfır gecikmeyle (128 örnek = 2.66 ms kuantum) kesintisiz akar.
2. **SIMD Hızlandırması:** `rnnoise_simd.wasm` ile CPU yükü %0.5'in altına iner.
3. **Pürüzsüz Donanımsal Bypass:** Filtre açılıp kapatılırken iki adet `GainNode` üzerinden tıkırtısız, anlık ses yönlendirmesi yapılır.
4. **CSP Güncellemesi:** `index.html` içerisindeki Content-Security-Policy kuralına worklet blob ve wasm yüklemeleri için gerekli izinler eklenir.

## 4. Dokunulacak Dosyalar
- `apps/desktop/src/renderer/index.html`: CSP güncellenerek `blob:` ve `data:` script/connect kaynaklarına izin verilecek.
- `apps/desktop/src/renderer/src/services/rnnoise/rnnoiseProcessor.ts`: Eski `ScriptProcessorNode` mimarisi tamamen kaldırılarak yerine modern `RnnoiseWorkletNode` tabanlı, sıfır takılmalı AudioWorklet motoru kurulacak.
- `apps/desktop/src/renderer/src/services/webrtc.ts`: AudioWorklet başlatma ve durdurma yaşam döngüsüyle tam uyumlu hale getirilecek.
- `docs/PROGRESS.md`: İlerleme durumu ve teknik detaylar işlenecek.

## 5. Riskler ve Önlemler
- **Risk:** Electron üretim paketinde (production build) AudioWorklet wasm ve js dosyalarının yolunun çözümlenememesi.
  - **Önlem:** Vite'ın `?url` import direktifi veya doğrudan Vite bundle içine gömülü (inline/data URI) worklet mekanizması kullanılacak. Hem dev modunda (`pnpm dev`) hem de paketlenmiş `.exe`'de çalışması doğrulanacak.
- **Risk:** Kullanıcının mikrofonunun 44.1 kHz olması.
  - **Önlem:** AudioContext `sampleRate: 48000` olarak sabitlenecek, Web Audio dahili resampler'ı otomatik devreye girecek.

## 6. Test ve Doğrulama Yöntemi
1. `pnpm typecheck` ve `pnpm lint` ile TypeScript ve kod standartları doğrulanacak.
2. `pnpm test` ile mevcut 79 birim/entegrasyon testi çalıştırılacak.
3. Ayarlar -> Ses & Görüntü altından mikrofon döngü testi (loopback) ile konuşurken sıfır klik/çıtırtı ve mükemmel gürültü engelleme işitilerek test edilecek.
4. Başarı sonrası `pnpm release` ile otomatik olarak GitHub Release (`v0.1.23`) yayınlanacak.
