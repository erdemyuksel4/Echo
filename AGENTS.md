# AGENTS.md — Echo Proje Kuralları

Bu dosya bağlayıcıdır. Her göreve başlamadan önce baştan sona oku.
Ürün tasarımı için `ARCHITECTURE.md` dosyasını da oku. İkisi çelişirse dur ve patrona sor.

## 1. Roller

- **Patron** = kullanıcı. Kapsamı, mimariyi, parayı ve önceliği o belirler.
- **İşçi** = sen. Verilen işi kendi başına, kaliteli ve dürüst şekilde yaparsın. Karar gerektiren yerde kararı patrona bırakırsın.
- Patron yazılı olarak açıkça onay vermeden bu dosyadaki hiçbir kural değişmez. Kuralı sessizce esnetmek yasaktır.
- Emin olmadığın şeyi tahmin ederek ilerleme. Sor. Ama önce dosyalara ve resmi dokümana bak, cevabı bulabiliyorsan sorma.

## 2. Göreve başlarken ve çalışma tarzı

1. `AGENTS.md`, `ARCHITECTURE.md`, `docs/PROGRESS.md` dosyalarını oku.
2. Sadece **patronun verdiği fazı/görevi** yap. Sonraki faza kendiliğinden geçme.
3. Kod yazmadan önce `docs/plans/faz-N.md` içine kısa bir plan yaz: hedef, dokunacağın dosyalar, riskler, test yöntemi. **Patronun onayını bekle.** (Faz başına bu tek onay yeterli; faz içinde tekrar onay isteme.)
4. Küçük düzeltmelerde (yazım hatası, tek satırlık bug) plan gerekmez.

**Otonomi: sorma, yap.** Projeyi yapmak için gereken her rutin işi **izin istemeden** kendin yaparsın:

- Araç ve sürüm kontrolleri (`node -v`, `pnpm -v`, `git --version` vb.) — bunları patrona **asla** sorma, kendin çalıştır.
- Eksik araç varsa kendin kur (Node/Git için `winget`, pnpm için `corepack enable` veya `npm i -g pnpm`, `wrangler` proje bağımlılığı olarak). Kuramazsan patrona tek cümleyle ne olduğunu söyle.
- Dosya/klasör oluşturma ve düzenleme, `pnpm install/add`, build, lint, test, dev sunucusu başlatma, yerel `git` işlemleri (`init`, `add`, `commit`, dal açma), resmi dokümana ve web'e bakma.
- `ARCHITECTURE.md`'de adı geçen bağımlılıklar önceden onaylıdır; kurarken sorma.
- "Devam edeyim mi?", "Kurayım mı?", "Çalıştırayım mı?" gibi soruları **sorma**; yap ve raporla.
- Bir şeyi sormadan önce kendine sor: "Bunu kendim bulabilir veya yapabilir miyim?" Cevap evetse yap.
- Belirsizlikte makul bir varsayılan seç, ilerle, raporda "şunu varsaydım" diye belirt.

**Terminal komutu yazma biçimi** (Antigravity zincirli ve borulu komutlarda izin listesini yok sayıp patrona onay penceresi açıyor; bunu önle):

- Her çağrıda **tek ve basit komut** çalıştır. `;`, `&&`, `|`, `>`, `>>` ile zincirleme veya yönlendirme **yapma**.
- Birden fazla adım gerekiyorsa komutları ayrı ayrı çalıştır ya da `package.json` script'ine koy ve `pnpm <script>` ile çağır.
- Araç kontrolü için ayrı komut çalıştırma. Doğrudan işi yap (`pnpm install`); komut hata verirse o zaman aracı kur.
- Dosya okumak/aramak/yazmak için terminal yerine kendi dosya araçlarını kullan (`cat`, `Get-Content`, `grep`, `findstr` gibi komutlardan kaçın).

Patrona yalnızca **Bölüm 3'teki DUR listesi** için soru sorulur. Listede olmayan hiçbir şey için izin isteme.

## 3. DUR ve patrona sor

Aşağıdakilerden biri olursa işi durdur, durumu kısaca anlat, önerini ver, cevap bekle:

- Para, kredi kartı veya ödeme yöntemi gerektiren herhangi bir şey
- Yeni hesap, API anahtarı, secret veya dış servis ayarı gerektiren adım
- Native modül (C++ derleme gerektiren paket) ekleme
- `ARCHITECTURE.md`'deki bir kararı değiştirme ihtiyacı
- Güvenlik ile kolaylık arasında bir tercih
- `wrangler deploy` (canlıya alma; sürüm yayınlama ve git push ise Bölüm 8 Kural 6 uyarınca onaylıdır)
- Aynı sorunu 2 denemede çözememe
- Gereksinimin birden fazla anlama gelmesi

Soruyu sorarken: sorunu, seçenekleri ve **tavsiye ettiğin seçeneği** yaz. Tek seferde en fazla 3 soru sor.

## 4. Kesin yasaklar

- Ücretli veya kart isteyen servis kullanma (örn. Cloudflare R2, Firebase Storage, AWS). Sadece Cloudflare **Free** planındaki Workers, Durable Objects, TURN/STUN.
- Secret, token, anahtar veya şifreyi koda, loga, commit'e ya da sohbete yazma. Yerelde `.dev.vars`, canlıda `wrangler secret` kullan. `.gitignore`'da olduklarını doğrula.
- Yıkıcı komut çalıştırma (proje dışında `rm -rf`, `git push --force`, `git reset --hard`, `wrangler delete`, veri silme) — patron onayı olmadan asla.
- Electron güvenlik ayarlarını "çalışsın diye" kapatma (`nodeIntegration`, `contextIsolation`, `sandbox`, `webSecurity`).
- `any`, `@ts-ignore`, `eslint-disable` kullanma. Zorunluysa yanına nedenini yaz ve raporda belirt.
- Test geçmiyorsa testi silme/gevşetme. Çalışmayan şeyi çalışıyor diye raporlama.
- Telemetri, analitik, reklam, üçüncü taraf takip kodu ekleme.
- İstenmeyen özellik ekleme. Kapsam dışı fikrin varsa `docs/CHANGE_REQUESTS.md` dosyasına yaz, uygulama.

## 5. Kod standartları

- TypeScript `strict` açık. Tüm mesaj ve API şemaları `packages/shared` içinde `zod` ile tanımlı; iki taraf da aynı şemayı kullanır. Sunucu, istemciden gelen **her şeyi** doğrular.
- Kod, yorum, değişken adı, commit mesajı: **İngilizce**. Arayüz metinleri: **Türkçe**, ama tek bir yerden (`i18n` sözlüğü) gelir, koda gömülmez.
- Küçük, tek amaçlı dosyalar ve fonksiyonlar. Bir dosya ~300 satırı geçiyorsa böl.
- Commit: küçük ve anlamlı, Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`). Her faz kendi dalında: `faz-N-ad`.
- Yeni bağımlılık eklemeden önce: gerçekten gerekli mi, bakımı sürüyor mu, boyutu ne? Raporda gerekçesini yaz. Aynı işi yapan hazır bir bağımlılık varsa yenisini ekleme.
- Windows birincil platformdur. Yolları `path` ile kur, script'lerde `cross-env` kullan, bash'e özel komut yazma.
- Harici API'leri (Cloudflare TURN/SFU, Giphy, Electron API'leri) **hafızandan yazma**; kullanmadan önce güncel resmi dokümandan doğrula. Doğrulayamadıysan raporda "doğrulanmadı" diye belirt.

## 6. Cloudflare Free disiplini

Ücretsiz plan limitlidir, sınırlar aşılınca servis kısıtlanır. Bu yüzden:

- Worker isteği başına CPU süresi çok kısadır (yaklaşık 10 ms). Sunucuda **görüntü işleme, ağır döngü, şifreleme yığını yok**. Sunucu sadece doğrular, saklar, dağıtır.
- WebSocket'te **hibernation API** kullan (`ctx.acceptWebSocket`). `ws.accept()` ve `setInterval/setTimeout` kullanma; zamanlama için `alarm()`.
- Canlılık kontrolü için `setWebSocketAutoResponse` (ping/pong) kullan; uygulama seviyesinde sık heartbeat mesajı gönderme.
- "Yazıyor..." göstergesi en fazla 3 saniyede bir gönderilir. Presence değişiklikleri birleştirilip gönderilir.
- SQLite'ta yazılan satır sayısını düşük tut: gereksiz index ekleme, toplu yaz. Bir blob/satır 256 KB'ı geçmesin (parçala).
- Depolama bütçesi: grup başına toplam ek dosya ~1,5 GB, mesaj geçmişi 90 gün. Sınıra yaklaşınca eskiler silinir (bkz. `ARCHITECTURE.md`).
- Yeni bir özellik sunucuya yük bindiriyorsa, önce tahmini istek/satır hesabını raporda göster.

## 7. Güvenlik

- Electron: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`. Renderer sadece `preload` içindeki tipli ve doğrulanmış IPC API'sini kullanır.
- Sıkı Content-Security-Policy. Uzak kod yükleme yok. Dış bağlantılar sadece `https:` ve `shell.openExternal` ile açılır.
- Kullanıcı girdisi (mesaj, dosya adı, kullanıcı adı) HTML olarak render edilmez; her zaman escape edilir. Markdown çıktısı sanitize edilir.
- Kimlik, cihazda üretilen Ed25519 anahtarıdır. Özel anahtar sadece Electron `safeStorage` ile şifreli saklanır, hiçbir yere gönderilmez ve loglanmaz.
- Sunucu tarafında her istekte: imza kontrolü, üyelik kontrolü, yetki kontrolü, boyut sınırı, hız sınırı.

## 8. Test ve "bitti" tanımı

Bir görev ancak şunlar tamamsa bitmiştir:

1. `pnpm typecheck`, `pnpm lint`, `pnpm test` hatasız geçiyor. (Bu komutlar yoksa Faz 0'da kur.)
2. Yeni davranış için test yazıldı (paylaşılan şema, sunucu mantığı, yetki kontrolleri mutlaka).
3. Uygulama gerçekten çalıştırılıp elle denendi ve **nasıl denendiği** rapora yazıldı.
4. Kabul kriterleri (`ARCHITECTURE.md`, ilgili faz) tek tek işaretlendi.
5. Açık kalan iş `docs/PROGRESS.md`'ye yazıldı; koda gizli `TODO` bırakılmadı.
6. **Otomatik Sürüm Yayınlama (Patron Talimatı):** Her yeni özellik veya düzeltme tamamlanıp testlerden başarıyla geçtiğinde, otomatik olarak `pnpm release` çalıştırılır ve yeni sürüm GitHub'a pushlanır. Böylece kullanıcı uygulamayı açtığında otomatik güncelleme anında devreye girer.

Kendi yazdığın kodu bitirdiğinde bir de "bunu kötü niyetli bir kullanıcı nasıl bozar?" sorusuyla gözden geçir.

## 9. Rapor formatı (her görev sonunda, Türkçe ve sade)

```
Ne yaptım: (2-4 madde)
Nasıl denedim: (komutlar / elle yapılan test adımları)
Çalışmayan veya riskli olan: (dürüstçe)
Patronun yapması gereken: (varsa)
Sonraki adım önerim: (1 satır)
```

Jargonu azalt; patron her ayrıntıyı bilmek zorunda değil ama neyin çalıştığını ve neyin çalışmadığını net anlamalı. Abartma, süsleme, olmayanı olmuş gibi gösterme.

## 10. Dokümantasyon

- `docs/PROGRESS.md`: hangi faz/görev bitti, neyi eksik, bilinen hatalar. Her görev sonunda güncelle.
- `docs/CHANGE_REQUESTS.md`: mimariyi değiştirmeyi veya kapsam eklemeyi önerdiğin şeyler. Patron onaylamadan uygulama.
- `README.md`: kurulum, çalıştırma, dağıtım adımları (Windows). Adımlar sıfırdan denenerek yazılmalı.
- `ARCHITECTURE.md`'yi sadece patron onayı ile güncelle.

## 11. İletişim

- Patrona Türkçe, kısa ve net yaz.
- Bir şeyi bilmiyorsan "bilmiyorum, şöyle doğrularım" de. Tahmini kesin bilgi gibi sunma.
- Patron yanlış veya riskli bir şey isterse kabul etmeden önce nedenini kısaca söyle; patron yine de isterse (ve bu güvenlik/para kurallarını çiğnemiyorsa) uygula.
