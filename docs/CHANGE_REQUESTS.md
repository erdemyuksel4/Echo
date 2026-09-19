# Değişiklik Talepleri (Change Requests)

Mimariyi değiştirmeyi veya ARCHITECTURE.md kapsamına yeni bir şey eklemeyi öneren talepler burada toplanır.
Patron onaylamadan uygulanmaz.

_Şu an açık bir değişiklik talebi bulunmamaktadır._

---

## Bilinen Hatalar (Faz 4 Medya — Düşük Öncelik)

- **Görsel yükleme hatası:** `uploadImageAttachment()` çağrısı hata veriyor. Muhtemel neden: `wrangler dev` çalışmıyor olabilir veya `/api/groups/:id/attachments` endpoint CORS/auth sorunu yaşıyor. Faz 8 cilalama aşamasında incelenecek.
- **Giphy — "sonuç bulunamadı":** `/api/giphy/search` proxy'si `GIPHY_API_KEY` ortam değişkeni olmadan fallback public key'i dönemiyor veya Giphy isteği hata alıyor. Faz 8'de debug edilecek.
