# Plan: Konuşma Sırasında Arka Plan Seslerinin (Bardak, Tıklama, Çıtırtı) İzolasyonu ve Akıllı Ses Kapısı

## 1. Hedef
Kullanıcı mikrofona konuşurken (`sesim varken`) arkadaki bardak şıngırtısı, çatal/kaşık, klavye/fare tıklaması ve ortam seslerinin konuşmayla birlikte karşı tarafa sızmasını engellemek; kelime aralarındaki duraklamalarda ses tabanını tamamen sıfıra indirmek.

## 2. Kök Neden Analizi
1. **Chromium AGC & Eski Gürültü Filtresi Çatışması:** `getUserMedia` tarafında Chromium'un dahili `autoGainControl: true` (otomatik kazanç) ve `noiseSuppression: true` ayarları açıktı.
   - Chromium AGC, kullanıcı konuştuğunda mikrofon hassasiyetini +15 dB'e kadar artırarak arkadaki bardak ve ortam seslerini yapay olarak yükseltiyordu.
   - Chromium'un 2012'den kalma eski gürültü filtresi, sesin fazını bozup ses dalgasını yaydığı (smearing) için yapay zeka GTCRN modelinin darbe seslerini net ayrıştırmasını engelliyordu.
2. **Kelime Arası Ses Kapısı (Noise Gate) Eksikliği:** GTCRN sürekli açık çalıştığından, konuşma esnasında verilen nefes aralarında veya kelime aralarındaki küçük duraklamalarda arkadaki bardak/tıkırtı sesleri karşı tarafa geçiyordu.
3. **Akustik Darbe (Transient) Baskılayıcı Eksikliği:** Bardak şıngırtısı ve sert tıklamalar 8-14 kHz arasında çok yüksek frekans rezonansına ve <0.5 ms ani genlik patlamasına sahiptir. Ses formantsal yapısından bağımsız çalışan hızlı ataklı darbe bastırıcı yoktu.

## 3. Yapılacak Değişiklikler ve Mimari
1. **Chromium Kısıtlamalarının İyileştirilmesi (`webrtc.ts`):**
   - Yapay zeka devredeyken Chromium'un gürültü bozan `noiseSuppression` ve `autoGainControl` ayarları kapatılacak; mikrofondan gelen saf, bozulmamış dalga doğrudan GTCRN'e aktarılacak (sadece donanımsal `echoCancellation` korunacak).
2. **AudioWorklet Akıllı Konuşma Kapısı (`SpeechGateProcessor` - `rnnoiseProcessor.ts`):**
   - -42 dB açılma, -48 dB kapanma eşiği ve 120 ms konuşma kuyruğu (hold time) ile çalışan akıllı ses kapısı.
   - Üstel yumuşak geçiş (smooth exponential gain) ile klik veya "pıt" yapmadan kelime aralarında ve sustuğunda çıkışı tam 0.0 (mutlak sessizlik) seviyesine çeker.
3. **Akustik Masa/Darbe Filtresi (High-pass 85 Hz):**
   - Bardağı masaya koyarken oluşan masa titreşimlerini ve hava akımı uğultularını keser.
4. **Yüksek Frekans Cam Rezonans Filtresi (Low-pass 8 kHz):**
   - İnsan sesinde olmayan, cam ve porselen şıngırtısına ait 8-16 kHz arası tiz çınlamaları yumuşatır.
5. **Hızlı Ataklı Darbe Kompresörü (`DynamicsCompressorNode`):**
   - 2 ms atak, 14:1 sıkıştırma oranı ile konuşma esnasında aniden patlayan bardak çarpması ve mekanik klavye vuruntularını anında 14-16 dB aşağı bastırır.

## 4. Dokunulacak Dosyalar
- `apps/desktop/src/renderer/src/services/rnnoise/rnnoiseProcessor.ts`
- `apps/desktop/src/renderer/src/services/webrtc.ts`
- `docs/PROGRESS.md`

## 5. Riskler ve Önlemler
- *Risk:* Fısıltılı veya çok kısık konuşmaların ses kapısı tarafından kesilmesi.
  - *Önlem:* -48 dB kapanma eşiği ve 120 ms kuyruk süresi fısıltıyı rahatça geçirecek şekilde kalibre edilmiştir. Ayrıca bypass geçişi mevcuttur.

## 6. Test Yöntemi
- `pnpm typecheck`, `pnpm lint`, `pnpm test` doğrulaması.
- Ses kanalı içi Ağ Test Modu açılarak mikrofona konuşurken bardak şıngırdatma ve klavyeye basma testi; hem konuşurken hem duraklarken darbe ve arka plan seslerinin bastırıldığının doğrulanması.
