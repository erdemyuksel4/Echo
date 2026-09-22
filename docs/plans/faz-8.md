# Faz 8 — Cilalama ve Dağıtım Uygulama Planı

## Hedef

Echo uygulamasını arkadaş grubuna dağıtılabilir, stabil, tek tıkla kurulabilir bir Windows `.exe` haline getirmek ve eksik Discord konfor özelliklerini tamamlamak:

1. **Bas-Konuş (Push-to-Talk) & Ses Ayarları:**
   - Ayarlar modalına "Ses İletim Modu" seçeneği: "Ses Etkinliği (VAD)" (varsayılan) ve "Bas-Konuş (Push-to-Talk)".
   - Bas-konuş tuş seçici arayüzü (kullanıcı istediği klavye tuşunu kaydedebilir; örn. `ControlRight`, `CapsLock`, `KeyV`, `Space`).
   - Tuşu bırakma gecikmesi (PTT Release Delay: 150-200 ms) ile konuşma sonunun ani kesilmesini önleme.
   - WebRTC ses motoruna entegrasyon: Bas-konuş aktifken tuşa basılmadığı sürece mikrofon verisi susturulur, basıldığında mikrofon açılır ve konuşma göstergesi yeşile döner.

2. **Sistem Entegrasyonu (Windows ile Başlat & Tepsi Cilası):**
   - Electron `app.setLoginItemSettings` ve `app.getLoginItemSettings` ile "Windows ile birlikte başlat" seçeneği.
   - Ayarlar modalında "Sistem Ayarları" kartı ve açma/kapatma anahtarı (toggle).
   - Uygulama kapatıldığında tepsiye (tray) küçülme ve çift tıkla / bildirim tıklamasıyla pencereli moda dönme davranışlarının pekiştirilmesi.

3. **Kullanıcı Arayüzü Cilası & Boş Durumlar (Empty States):**
   - **Kanal Karşılama Kartı:** Henüz mesaj yazılmamış kanallarda Discord tarzı "#kanal-adı kanalına hoş geldin! Bu kanalın başlangıcı." karşılama bloğu.
   - **Boş DM Karşılaması:** Henüz mesajlaşılmamış bir DM seçildiğinde kullanıcı adı ve avatarıyla samimi sohbet başlangıç paneli.
   - **Ağ Durumu / Yeniden Bağlanma Banner'ı:** İnternet koptuğunda veya sunucuya yeniden bağlanılırken üstte zarif bir sarı/kırmızı uyarı afişi ("Bağlantı koptu, yeniden bağlanılıyor...").

4. **Tek Tıkla Kurulan `.exe` Paketi (`electron-builder` + NSIS):**
   - `apps/desktop` için `electron-builder` yapılandırması.
   - Çıktı: `Echo Setup 0.1.0.exe` (NSIS kurulum sihirbazı; masaüstü ve Başlat menüsü kısayolu oluşturur, temiz uninstaller içerir).
   - Uygulama simgesi (`icon.ico` ve `icon.png`).
   - `package.json` derleme script'i: `pnpm build:exe`.

5. **Arkadaşlara Dağıtım & SmartScreen Rehberi:**
   - `README.md` ve `docs/DISTRIBUTION.md` içinde patronun `.exe` dosyasını arkadaşlarına nasıl ileteceği (Google Drive, Discord, GitHub vb.).
   - Windows SmartScreen ("Bilinmeyen Yayıncı" / "Windows kişisel bilgisayarınızı korudu" -> "Ek Bilgi" -> "Yine de Çalıştır") aşamasını arkadaşlara adım adım anlatan rehber.

---

## Dokunulacak Dosyalar

### 1. Masaüstü Ana Süreci & Preload (`apps/desktop`)

- `apps/desktop/src/main/index.ts`:
  - `desktop:getLoginItemSettings` ve `desktop:setLoginItemSettings` IPC işleyicileri.
  - Bas-konuş ve pencere kısayol iyileştirmeleri.
- `apps/desktop/src/preload/index.ts` ve `src/preload/index.d.ts`:
  - `getLoginItemSettings()`, `setLoginItemSettings(openAtLogin: boolean)` metotları.

### 2. Masaüstü Arayüzü & Durum Yönetimi (`apps/desktop/src/renderer`)

- `apps/desktop/src/renderer/src/stores/useVoiceStore.ts`:
  - `inputMode`: `'vad' | 'ptt'`
  - `pttKey`: string (varsayılan `'KeyV'`)
  - `pttReleaseDelay`: number (varsayılan `200` ms)
  - `isPttPressed`: boolean
  - `setInputMode`, `setPttKey`, `setPttReleaseDelay`, `setPttPressed` eylemleri.
- `apps/desktop/src/renderer/src/services/webrtc.ts`:
  - Bas-konuş mantığı ile mikrofon ses akışını tuşa göre etkinleştirme/susturma (`track.enabled` kontrolü ve VAD senkronizasyonu).
- `apps/desktop/src/renderer/src/components/SettingsModal.tsx`:
  - Giriş modu seçimi (Ses Aktivitesi vs Bas-Konuş).
  - Tuş atama dinleyicisi (kullanıcı tuşa basınca yakalar).
  - "Windows ile birlikte başlat" toggle switch'i.
- `apps/desktop/src/renderer/src/components/ChatArea.tsx` ve `DmChatArea.tsx`:
  - Boş kanal ve boş DM karşılama durumları.
- `apps/desktop/src/renderer/src/App.tsx`:
  - Global `keydown` / `keyup` dinleyicisi (bas-konuş için).
  - İnternet kopması / yeniden bağlanma durum çubuğu.

### 3. Paketleme & Dağıtım Konfigürasyonu

- `apps/desktop/package.json`:
  - `electron-builder` bağımlılığı ve `build:exe` script'i.
  - `build` yapılandırması (appId: `com.echo.app`, productName: `Echo`, nsis ayarları, ikonlar).
- `apps/desktop/build/icon.ico` & `apps/desktop/build/icon.png`: Uygulama ikonları.
- `docs/DISTRIBUTION.md` (Yeni): Arkadaşlara dağıtım ve SmartScreen rehberi.

---

## Riskler ve Önlemler

1. **Bas-Konuş Pencere Odağı Sınırı (Native vs Safe JS):**
   - _Risk:_ Electron'un yerleşik pencere dinleyicileri uygulama odaktayken harika çalışır. Ancak arka planda tam ekran oyundayken `keyup` yakalamak normalde C++ native modül (`uiohook-napi`) gerektirir. `AGENTS.md` gereğince native modüller Windows'ta derleme ve uyumluluk riski taşır.
   - _Önlem:_ İlk aşamada uygulamanın güvenli ve sıfır derleme hatasıyla çalışması için yerleşik Electron kısayol/pencere yapısı kullanılır. Native hook ihtiyacı patronun isteğine göre kontrollü olarak eklenebilir.
2. **Windows SmartScreen Uyarısı:**
   - _Risk:_ Kod imzalama sertifikası (yıllık yüzlerce dolar) kullanılmadığı için Windows ilk açılışta mavi "Kişisel bilgisayarınız korundu" uyarısı verir.
   - _Önlem:_ Arkadaşların korkmaması için açık ve ekran görüntülü adım adım aşma rehberi hazırlanacaktır ("Ek bilgi" -> "Yine de çalıştır").
3. **Kurulum Boyutu & NSIS:**
   - _Risk:_ Paketleme sırasında gereksiz dosyalar `.exe`'ye dahil edilirse dosya boyutu şişebilir.
   - _Önlem:_ `electron-builder` files filtresiyle yalnızca `out/` ve gerekli üretim bağımlılıkları paketlenecektir (~70-80 MB).

---

## Doğrulama ve Test Yöntemi

1. **Otomatik Testler & Linting:**
   - `pnpm typecheck` (sıfır TypeScript hatası).
   - `pnpm lint` (sıfır ESLint uyarısı).
   - `pnpm test` (mevcut tüm Vitest testlerinin sorunsuz geçmesi).
2. **Bas-Konuş Testi:**
   - Ayarlar'dan "Bas-Konuş" seçilip bir tuş atanır (örn. Space veya V).
   - Ses kanalına bağlanıldığında mikrofonun varsayılan susturulduğu doğrulanır.
   - Tuşa basılı tutulduğunda konuşma göstergesinin yeşil yandığı ve sesin iletildiği, tuş bırakıldığında susturulduğu test edilir.
3. **Windows ile Başlat Testi:**
   - Ayarlar'dan toggle açılıp kapatılır; IPC'nin doğru değer döndürdüğü doğrulanır.
4. **Paketleme Testi:**
   - `pnpm --filter @echo/desktop build:exe` (veya ilgili derleme komutu) çalıştırılır.
   - `dist/` klasöründe tek tıkla çalışan `Echo Setup 0.1.0.exe` dosyasının başarıyla üretildiği doğrulanır.
