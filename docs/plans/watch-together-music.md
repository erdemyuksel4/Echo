# Plan: Ses Kanallarında Birlikte Müzik Dinleme & YouTube Watch Party

## 1. Hedef
Echo kullanıcılarının ses kanalındayken YouTube üzerinden gerçek zamanlı senkronize şekilde birlikte müzik dinlemesini, video/klip izlemesini, şarkı kuyruğu oluşturmasını ve chat komutları (`!play`, `!pause`, `!skip`, `!queue`, `!stop`) ile kontrol edebilmesini sağlamak.

## 2. Mimari ve Bileşenler
1. **Şema & Protokol (`packages/shared/src/schemas/music.ts` ve `protocol.ts`):**
   - `MusicTrack`: `id`, `title`, `author`, `duration`, `thumbnailUrl`, `addedByName`, `url`.
   - `MusicPlaybackState`: `channelId`, `currentTrack`, `status` ('playing' | 'paused' | 'stopped'), `positionSeconds`, `lastUpdatedTimestamp`, `queue`, `loopMode`.
   - `WsClientEvents.MUSIC_ACTION` & `WsServerEvents.MUSIC_STATE`.
2. **Sunucu Tarafı (`GroupDO.ts` & `index.ts`):**
   - `/api/music/search`: Anahtar kelime veya URL ile YouTube başlık, videoId ve küçük resim getiren hafif arama proxy'si.
   - `GroupDO.ts`: Ses kanalı bazında aktif çalma durumu hafızada saklanır. Çalma/durdurma/sarma/atlama eylemlerinde kanaldaki tüm üyelere anında `music.state` iletilir. Yeni katılan üyeler doğrudan çalan şarkının mevcut saniyesine senkronize olur.
3. **İstemci Arayüzü & YouTube Oynatıcı (`apps/desktop`):**
   - `index.html`: YouTube IFrame API için CSP güncellemesi (`frame-src https://www.youtube.com`).
   - `useMusicStore.ts`: Çalma durumu, ses kontrolü (kişiye özel bağımsız volume), mini oynatıcı ve sahne oynatıcı durumları.
   - `MusicPlayerView.tsx` & `MusicFloatingBar.tsx`: Şarkı arama, sıraya ekleme, çalan şarkı kontrolleri ve sahne içi video ekranı.
   - `VoiceStageView.tsx` & Ses Kontrol Çubuğu: 🎵 Müzik açma butonu.
   - `ChatArea.tsx`: `!play <link/arama>`, `!pause`, `!resume`, `!skip`, `!queue`, `!stop` sohbet komutları.

## 3. Riskler ve Önlemler
- **Risk:** Kullanıcıların internet hızına bağlı olarak 1-2 saniye gecikme olması.
  - **Önlem:** Zaman damgası farkı (`(Date.now() - lastUpdated) / 1000`) ile senkronize seek yapılır; fark 2 saniyeden azsa kullanıcı deneyimini bozmamak için kesintisiz devam eder.
- **Risk:** Sunucu CPU veya depolama kotası.
  - **Önlem:** Ses veya video sunucudan kesinlikle akmaz; sunucu yalnızca 100 baytlık durum sinyallerini iletir. Cloudflare Free planında 0 maliyetle çalışır.

## 4. Test Yöntemi
- Paylaşılan şema ve komut çözümleme için `pnpm test`.
- TypeScript (`pnpm typecheck`) ve lint (`pnpm lint`) doğrulaması.
- Canlı test: Ses kanalında `!play` komutu ve müzik paneli üzerinden şarkı aratma/çalma.
