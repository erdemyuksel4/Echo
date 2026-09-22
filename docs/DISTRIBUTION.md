# Echo — Arkadaşlara Dağıtım ve Kurulum Rehberi

Bu rehber, derlenen **Echo** uygulamasını arkadaşlarınıza nasıl ulaştıracağınızı ve arkadaşlarının kurulumu nasıl yapacağını adım adım anlatır.

---

## 1. Kurulum Paketini Üretme (`.exe`)

Echo'yu tek tıkla kurulabilir bir Windows kurulum paketine dönüştürmek için proje ana dizininde şu komut çalıştırılır:

```bash
pnpm build:exe
```

Bu işlem tamamlandığında kurulum dosyası aşağıdaki dizinde oluşturulur:
📁 `apps/desktop/dist/Echo Setup 0.1.0.exe` (yaklaşık 70–80 MB)

---

## 2. Kurulum Dosyasını Arkadaşlara Ulaştırma

Kurulum dosyasını arkadaşlarınıza şu yollardan biriyle iletebilirsiniz:

- **Google Drive / OneDrive / Dropbox:** Dosyayı Drive'a yükleyin ve "Bağlantıya sahip olan herkes görüntüleyebilir" bağlantısını paylaşın.
- **WeTransfer:** Ücretsiz ve hesapsız 2 GB'a kadar tek tıkla dosya indirme linki oluşturur.
- **Discord:** Nitro varsa doğrudan atılabilir veya dosya paylaşım linki gönderilebilir.
- **GitHub Releases:** Proje GitHub reposunda bir Release açıp `Echo Setup 0.1.0.exe` dosyasını release asset olarak ekleyebilirsiniz.

---

## 3. Arkadaşların Karşılaşacağı Ekran: Windows SmartScreen

Echo açık kaynaklı ve bağımsız bir proje olduğu için yıllık yüzlerce dolarlık ticari kod imzalama sertifikası (Code Signing Certificate) içermez. Bu nedenle Windows, uygulamanın ilk kurulumunda **Windows SmartScreen** mavi uyarı penceresini gösterecektir:

### SmartScreen'i Geçme Adımları (Arkadaşlarınıza iletebilirsiniz):

1. `Echo Setup 0.1.0.exe` dosyasına çift tıklayın.
2. Açılan mavi pencerede **"Windows kişisel bilgisayarınızı korudu"** uyarısı görünür.
3. Penceredeki **"Ek bilgi"** (More info) bağlantısına tıklayın.
4. Sağ altta beliren **"Yine de çalıştır"** (Run anyway) butonuna tıklayın.
5. Kurulum sihirbazı başlayacak, masaüstünüze ve Başlat menünüze Echo kısayolu eklenerek uygulama otomatik açılacaktır.

---

## 4. İlk Açılış ve Gruba Katılma

1. **Profil Oluşturma:** Arkadaşınız ilk açılışta kendine bir görünen ad ve avatar rengi seçer (hesap/şifre gerekmez).
2. **Gruba Katılma:**
   - Sol taraftaki yeşil **"+"** butonuna tıklar.
   - **"Gruba Katıl"** sekmesini seçer.
   - Sizin paylaştığınız davet kodunu (örneğin: `ECHO-XXXX-YYYY-...`) girerek **"Katıl"** der.
   - Anında gruba dahil olur ve genel sohbette hoş geldin duyurusu yapılır!

---

## 5. Ses ve Donanım Ayarları (Discord'dan Geçiş)

- Sol alttaki profil çubuğundaki **Ayarlar (Çark simgesi)** ile:
  - **Mikrofon & Hoparlör Seçimi:** Kullanılacak donanım aygıtı seçilebilir ve "Mikrofonu Test Et" ile yeşil ses çubuğundan canlı test edilebilir.
  - **Ses İletim Modu:**
    - _Ses Etkinliği (VAD):_ Discord'daki gibi konuştukça otomatik iletir.
    - _Bas-Konuş (Push-to-Talk):_ İstenen tuş (örn. V, CapsLock, Space) atanarak sadece basılı tutulduğunda ses iletilir.
  - **Windows ile Birlikte Başlat:** Bilgisayar her açıldığında Echo'nun arka planda otomatik başlaması tek tıkla açılabilir.
