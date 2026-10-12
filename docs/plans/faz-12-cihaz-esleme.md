# Faz 12 — Cihaz Eşleme & QR Kod / Giriş Kodu ile Oturum Aktarımı

Bu plan, kullanıcının farklı cihazlarda (ikinci bilgisayar veya mobil) aynı hesabı kullanabilmesini sağlayan "Cihaz Eşleme / QR Kod & Giriş Kodu ile Oturum Açma" özelliğinin tasarımını ve uygulama adımlarını içerir.

---

## 1. Hedef ve Kapsam

### Hedef
- Yeni bir cihazda uygulamayı açan kullanıcının sıfırdan yeni hesap açmak zorunda kalmaması; mevcut hesabını güvenli bir şekilde QR kod veya 6 haneli kısa bir kod ile yeni cihaza aktarabilmesi.
- Aktarım sırasında güvenliğin korunması:
  - Zaten giriş yapılmış olan cihazdan **açıkça onay (izin) istenmesi**.
  - Kullanıcı "İzin Ver" demeden hiçbir bilginin aktarılmaması.
  - Özel anahtarın (`privateKey`) sunucuya düz metin olarak gitmemesi; cihazlar arasında uçtan uca şifreli (E2EE / Web Crypto AES-GCM) iletilmesi.
  - İzin verildikten sonra her iki cihazın da aynı `userId` ve kimlik bilgileriyle sorunsuz çalışabilmesi.

---

## 2. Mimari ve Güvenlik Akışı

```
[ Cihaz B: Yeni Cihaz ]              [ Cloudflare Server ]              [ Cihaz A: Girişli Cihaz ]
       |                                     |                                     |
       | 1. POST /api/auth/link/init         |                                     |
       |    (Geçici ECDH/AES anahtarı üretir)|                                     |
       |------------------------------------>|                                     |
       |    Döner: sessionId, linkCode (6 hane)                                    |
       |<------------------------------------|                                     |
       |                                     |                                     |
       | 2. QR Kod ve 6 Haneli Kod Gösterir  |                                     |
       |    (Örn: 849-213)                   |                                     |
       |    GET /ws/auth/link/:sessionId ile |                                     |
       |    onay beklemeye başlar            |                                     |
       |------------------------------------>|                                     |
       |                                     | 3. Ayarlar > Cihaz Eşle             |
       |                                     |    Kullanıcı kodu girer (849-213)   |
       |                                     |    POST /api/auth/link/claim        |
       |                                     |<------------------------------------|
       |                                     |                                     |
       |                                     | 4. Cihaz A'da Onay Modalı Çıkar:    |
       |                                     |    "Yeni cihaz giriş yapmak istiyor.|
       |                                     |     İzin veriyor musunuz?"          |
       |                                     |                                     |
       |                                     | 5. Kullanıcı "İzin Ver"e basar:     |
       |                                     |    Kimlik Cihaz B'nin geçici        |
       |                                     |    anahtarıyla şifrelenir           |
       |                                     |    POST /api/auth/link/approve      |
       |                                     |<------------------------------------|
       | 6. Şifreli kimlik Cihaz B'ye iletilir                                     |
       |<------------------------------------|                                     |
       |                                                                           |
       | 7. Cihaz B paketi çözer, yerel                                            |
       |    safeStorage'a kaydeder ve hesaba giriş yapar.                          |
```

### Güvenlik Önlemleri
1. **Zero-Knowledge Aktarım:** Geçici anahtar (Web Crypto AES-GCM veya ECDH) istemciler arasında QR/kod içinde taşınır. Cloudflare sunucusu kimlik şifresini çözemez.
2. **Kısa Ömür (TTL):** Bağlantı kodunun ve oturumun geçerlilik süresi 5 dakikadır. 5 dakika içinde onaylanmazsa düşer.
3. **Tek Kullanımlık:** Bir kod onaylandığı anda oturum sonlandırılır ve bellekten temizlenir.
4. **Çift Cihazlı Onay İsteği:** Kaynak cihazdaki kullanıcının onayı olmadan transfer başlamaz.

---

## 3. Dokunulacak Dosyalar

### 1. Paylaşılan Paket (`packages/shared`)
- `packages/shared/src/schemas/deviceLink.ts` (Yeni): Zod şemaları (`DeviceLinkInitResponse`, `DeviceLinkClaimRequest`, `DeviceLinkApproveRequest`, `DeviceLinkStatus`, vb.).
- `packages/shared/src/crypto/deviceLinkCrypto.ts` (Yeni): Web Crypto API / cross-environment E2EE AES-GCM şifreleme ve anahtar türetme yardımcıları.
- `packages/shared/src/index.ts`: Yeni şemaların ve fonksiyonların dışa aktarımı.
- `packages/shared/src/__tests__/deviceLink.test.ts` (Yeni): Şema ve şifreleme birim testleri.

### 2. Sunucu (`apps/server`)
- `apps/server/src/durable/DeviceLinkDO.ts` (Yeni): Geçici eşleme oturumlarını, kodları ve WebSocket/polling bildirimlerini yöneten Cloudflare Durable Object.
- `apps/server/src/index.ts`: `/api/auth/link/init`, `/api/auth/link/claim`, `/api/auth/link/approve`, `/api/auth/link/reject`, `/ws/auth/link/:sessionId` uç noktaları.
- `apps/server/wrangler.toml`: Gerekirse `DeviceLinkDO` bağlama veya mevcut Durable Object yapısıyla entegrasyon.
- `apps/server/test/deviceLink.spec.ts` (Yeni): Sunucu API testleri.

### 3. Masaüstü Uygulaması (`apps/desktop`)
- `apps/desktop/src/main/identity.ts`:
  - `importIdentity(data)`: Aktarılan kimliği doğrulayıp `safeStorage` ile diske yazma.
  - `exportFullIdentity()`: Güvenli aktarım için mevcut kimlik nesnesini alma.
- `apps/desktop/src/main/index.ts`: IPC işleyicileri (`identity:import`, `identity:exportFull`).
- `apps/desktop/src/preload/index.ts` & `apps/desktop/src/preload/index.d.ts`: Tipli IPC köprüsü.
- `apps/desktop/src/renderer/src/services/deviceLinkService.ts` (Yeni): Sunucu bağlantısı, QR kod veri üretimi, şifreleme/çözme motoru.
- `apps/desktop/src/renderer/src/components/OnboardingModal.tsx`:
  - "Yeni Hesap Oluştur" ve "Mevcut Hesaba Bağlan (QR / Kod)" sekmeleri.
  - SVG QR Kod ve 6 haneli kod gösterimi, geri sayım ve onay bekleniyor göstergesi.
- `apps/desktop/src/renderer/src/components/SettingsModal.tsx`:
  - "📱 Cihaz Bağla" sekmesi.
  - 6 haneli kod girme alanı ve "Doğrula & Eşle" butonu.
- `apps/desktop/src/renderer/src/components/DeviceApprovalModal.tsx` (Yeni):
  - Giriş yapmış olan cihazda çıkan onay penceresi: "Yeni Cihaz Giriş İsteği — İzin Ver / Reddet".
- `apps/desktop/src/renderer/src/stores/useAuthStore.ts`: `importIdentity` metodu entegrasyonu.

---

## 4. Olası Riskler ve Önlemleri

| Risk | Olasılık | Önlem |
|------|----------|-------|
| Kötü niyetli birinin rastgele 6 haneli kod denemesi (brute-force) | Orta | 5 hatalı denemede oturumu anında sonlandırma, hız sınırı (rate limit), 5 dakikalık TTL. |
| Özel anahtarın sunucuda düz metin kalması | Sıfır | Cihaz B'nin ürettiği tek kullanımlık AES-GCM oturum anahtarıyla Cihaz A'da şifrelenir; sunucu veriyi okuyamaz (Zero-Knowledge). |
| İki cihazın aynı anda açık olması durumunda çakışma | Düşük | Echo'nun mevcut mimarisi çoklu cihazı destekler; her cihaz aynı Ed25519 kimliğiyle sunucuya bağımsız WebSocket açabilir. |

---

## 5. Test ve Doğrulama Planı

1. **Birim Testleri (`pnpm test`):**
   - E2EE AES-GCM şifreleme ve anahtar türetme testleri.
   - Şemaların doğrulama testleri.
   - Sunucu Durable Object oturum açma, kod eşleme, onaylama ve zaman aşımı testleri.
2. **Statik Analiz (`pnpm typecheck` ve `pnpm lint`):**
   - Sıfır TypeScript ve ESLint hatası.
3. **Manuel Entegrasyon Testi:**
   - Cihaz B'de "Mevcut Hesaba Bağlan" seçilerek 6 haneli kod ve QR üretilmesi.
   - Cihaz A'da Ayarlar > Cihaz Bağla sekmesinden bu kodun girilmesi.
   - Cihaz A'da onay penceresinin belirmesi ve "İzin Ver"e basılması.
   - Cihaz B'nin kimliği otomatik alıp başarıyla oturum açması ve profilin, grupların senkronize gelmesi.
4. **Otomatik Sürüm Yayınlama:**
   - Testler geçtikten sonra `pnpm release` ile yeni sürümün GitHub'a pushlanması.
