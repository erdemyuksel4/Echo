# Plan: Kullanıcı / Herkes Etiketleme & Sahne İçi Ekran Yayını

## Hedef
1. **Kullanıcıları ve Herkesi Etiketleyebilme (Mentions):**
   - Sohbette `@` yazıldığında açılan, kanal/grup üyelerini ve `@herkes` / `@everyone` seçeneğini gösteren açılır menü (mention autocomplete).
   - Klavye yön tuşları (Yukarı/Aşağı, Enter/Tab, Esc) ve fare ile seçim.
   - `packages/shared/src/markdown.ts` içinde Türkçe karakterli (ç, ğ, ı, ö, ş, ü vb.) kullanıcı adlarının `@` etiketlerinde düzgün ayrıştırılması (`\p{L}`).
   - `ChatMessageItem` içinde etiketlerin (`@kullanıcı`, `@herkes`) belirgin rozet olarak gösterilmesi ve kullanıcının etiketlendiği mesajların hafif renk vurgusuyla öne çıkarılması.
2. **Ekran Yayınının Sahne Ortasında Kamera Gibi Çıkması & Tıkla-İzle:**
   - Ekran yayını açıldığında tüm uygulamayı kaplayan zoraki bir modal yerine, `VoiceStageView` sahne ızgarasında (grid) kamera kutusu gibi yer alması (`ScreenShareTile`).
   - "Direkt açılmasın, tıklayalım öyle görünsün": Diğer kullanıcılar için varsayılan olarak "CANLI YAYIN - [Kullanıcı]" kartı ve "**Yayını İzle**" butonu görünür; tıklanana kadar bant genişliği tüketmez ve görüntü açılmaz. Tıklandığında akış bağlanıp kutu içinde canlı oynatılır.
   - Yayını açan kullanıcı için kendi ekran önizlemesi ve "Yayını Durdur" butonu sahnede kamera gibi yer alır.
   - İzleyen kullanıcı için kutu üzerinde "İzlemeyi Bırak" ve "Tam Ekran" butonları yer alır.
3. **Ses Sahnesi Yalnızca Soldan Ses Kanalına Tıklanınca Görünsün:**
   - Kullanıcı ses kanalındayken soldan metin kanalına (#genel) tıkladığında ses bağlantısı arka planda kesintisiz sürerken ortada metin sohbeti (`ChatArea`) görünür.
   - Yalnızca sol menüden ses kanalına tıklandığında kameraların ve yayınların olduğu `VoiceStageView` sahnesi görüntülenir.

## Dokunulacak Dosyalar
- `packages/shared/src/markdown.ts` — Unicode & Türkçe harf destekli mention regex
- `packages/shared/src/__tests__/markdown.test.ts` — Mention ayrıştırma birim testleri
- `apps/desktop/src/renderer/src/components/ChatArea.tsx` — Mention autocomplete açılır menüsü ve klavye etkileşimi
- `apps/desktop/src/renderer/src/components/ChatMessageItem.tsx` — Mention rozetleri, `@herkes` / `@everyone` ve satır vurgusu
- `apps/desktop/src/renderer/src/components/VoiceStageView.tsx` — Sahne ortasında `ScreenShareTile` grid entegrasyonu ve tıkla-izle mantığı
- `apps/desktop/src/renderer/src/components/ScreenShareViewer.tsx` — Yalnızca kullanıcı tam ekran istediğinde çalışacak odaklanmış görünüm
- `docs/PROGRESS.md` — İlerleme dokümantasyonu

## Riskler ve Önlemler
- **Risk:** Metin kutusunda `@` yazarken imleç konumu ve kelime değişiminde metnin bozulması.
  - **Önlem:** `selectionStart` referans alınarak son `@` ifadesi hedeflenir ve araya güvenle boşlukla tamamlanan etiket yerleştirilir.
- **Risk:** Birden fazla katılımcı hem kamera hem ekran yayını açtığında sahne grid'inin taşması.
  - **Önlem:** Toplam kutu sayısı (`participants.length + activeShares.length`) üzerinden dinamik CSS grid sınıfları hesaplanır.

## Test Yöntemi
1. `pnpm typecheck`, `pnpm lint`, `pnpm test` komutlarının hatasız geçmesi.
2. Metin sohbetinde `@` yazıldığında öneri kutusunun açıldığının, `@herkes` ve üyelerin listelendiğinin, Türkçe karakterli isimlerin seçilip mesaj atıldığında mavi rozet ve etiket vurgusu aldığının doğrulanması.
3. Ses kanalında yayın açıldığında sahne ortasında kutu olarak belirdiğinin, tıklamadan yayının başlamadığının, "Yayını İzle"ye basınca kutuda videonun oynatıldığının, sol menüden metin kanalına geçildiğinde sohbetin geldiğinin ve ses kanalına tıklanınca sahnenin geri geldiğinin doğrulanması.
