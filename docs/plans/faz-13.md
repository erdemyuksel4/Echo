# Faz 13 Planı — Discord Aktif Kişiler, Ses Odaları ve Yazılı Sohbet Senkronizasyonu

## 1. Hedef

Türkiye'de Discord erişim engeline veya VPN/DPI gereksinimine takılmadan, Cloudflare Worker üzerinden Discord sunucunuzdaki arkadaşlarınızla Echo grubunuzu senkronize etmek:

1. **Discord Aktif Kişiler & Ses Odası Gösterimi (Sunucu Widget API — Token Gerektirmez):**
   - Discord sunucusunda çevrimiçi (`online`), boşta (`idle`) veya rahatsız etmeyin (`dnd`) durumundaki arkadaşları, profil fotoğraflarını ve oynadıkları oyunu **Sağ Üye Listesinde (`MemberList`)** `"Discord'da Aktif"` başlığı altında canlı göstermek.
   - Discord ses kanallarında kimlerin konuşmada olduğunu, hangi odada bulunduklarını ve mikrofon/kulaklık durumlarını **Sol Kanal Listesinde (`ChannelList`)** `"Discord Ses Odaları"` başlığı altında göstermek.
2. **Çift Yönlü Yazılı Sohbet Köprüsü (Echo ↔ Discord):**
   - **Echo → Discord (Webhook / Bot):** Eşleştirilen Echo metin kanalına yazılan mesajları, gönderen kişinin Echo kullanıcı adıyla (`Erdem [Echo]`) anında Discord kanalına iletmek.
   - **Discord → Echo (Bot Token + Kanal ID):** Discord kanalında yazılan mesajları ve görsel ekleri Cloudflare üzerinden çekip Echo kanalına `[DISCORD]` rozeti ve yazarın Discord adıyla anlık düşürmek.
3. **Grup İçi Discord Ayar Modalı (`DiscordSyncModal`):**
   - Grup açılır menüsünden (yalnızca grup sahibi/yönetici) Discord Sunucu ID, Webhook URL, Discord Kanal ID ve Bot Token bilgilerini kolayca yapılandırma ve bağlantıyı test etme ekranı.

---

## 2. Dokunulacak Dosyalar

- **`packages/shared`:**
  - `src/schemas/discord.ts` *(Yeni)*: `DiscordConfigSchema`, `DiscordWidgetStateSchema`, `DiscordMemberSchema`, `DiscordVoiceChannelSchema`, `ClientDiscordConfigPayloadSchema`, `ServerDiscordStatePayloadSchema`.
  - `src/schemas/protocol.ts`: `DISCORD_CONFIG_SET`, `DISCORD_SYNC_NOW`, `DISCORD_STATE` WebSocket olayları.
  - `src/schemas/message.ts`: Mesaj şemasına isteğe bağlı `externalSource?: 'discord'`, `externalAuthorName?: string`, `externalAvatarUrl?: string` alanları.
  - `src/__tests__/discord.test.ts` *(Yeni)*: Şema ve doğrulama birim testleri.
- **`apps/server`:**
  - `src/durable/GroupDO.ts`:
    - SQLite `discord_config` tablosu (`guild_id`, `echo_channel_id`, `webhook_url`, `bot_token`, `discord_channel_id`, `last_discord_msg_id`, `enabled`).
    - Discord Widget (`https://discord.com/api/guilds/{guildId}/widget.json`) sorgulama ve önbellekleme (30 sn aralıkla, Cloudflare Free kotasını koruyarak).
    - Echo'da mesaj gönderildiğinde (`handleMsgSend`) E2EE zarfını grup anahtarıyla çözüp Discord Webhook URL'sine iletme.
    - Discord'dan yeni mesajları (`GET /api/v10/channels/{id}/messages?after=...`) çekip Echo kanalına kaydetme ve `msg.new` ile yayınlama.
  - `test/discord.spec.ts` *(Yeni)*: Sunucu tarafı Discord yapılandırma, yetki kontrolü ve mesaj köprüsü birim testleri.
- **`apps/desktop`:**
  - `src/renderer/src/components/DiscordSyncModal.tsx` *(Yeni)*: Adım adım açıklamalı Discord Senkronizasyon ayarları ve "Bağlantıyı Test Et" butonu.
  - `src/renderer/src/components/ChannelList.tsx`: Grup menüsüne `"Discord Senkronizasyonu"` butonu ve sol kanal listesinin altına `"Discord Ses Odaları"` canlı görünümü.
  - `src/renderer/src/components/MemberList.tsx`: Sağ üye paneline `"Discord'da Aktif — N"` bölümü (avatar, durum noktası, oynadığı oyun, bulunduğu ses odası).
  - `src/renderer/src/components/ChatMessageItem.tsx`: Discord'dan gelen mesajlarda mavi `[DISCORD]` rozeti ve Discord yazar adı/avatarı gösterimi.
  - `src/renderer/src/stores/useChatStore.ts` & `src/renderer/src/services/websocket.ts`: `discordState` ve `discordConfig` durum yönetimi.

---

## 3. Riskler ve Önlemler (Cloudflare Free Disiplini & Güvenlik)

- **Cloudflare Free Kota Koruması:**
  - Sadece grupta en az 1 çevrimiçi Echo kullanıcısı varken senkronizasyon çalışır; grupta kimse yokken Durable Object uyur (0 istek, 0 satır yazımı).
  - Widget ve mesaj sorgulaması en fazla 15-30 saniyede bir önbellekli çalışır (günlük 100.000 istek sınırının %2'sini bile harcamaz).
- **Güvenlik & Gizlilik:**
  - `webhookUrl` ve `botToken` bilgileri yalnızca `GroupDO` SQLite içinde tutulur; normal üyelere gönderilen `DISCORD_STATE` paketinde asla açık token/webhook URL'si gönderilmez (maskelenir).
  - Sadece grup `owner` veya `admin` rolündeki kullanıcılar Discord ayarlarını değiştirebilir.
  - Discord'dan gelen mesaj içerikleri Echo'nun mevcut XSS korumalı Markdown/HTML filtresinden (`renderSafeHtml`) geçer.
- **Sonsuz Döngü Önleme (Loop Prevention):**
  - Echo'dan Discord Webhook'a atılan mesajların (`webhook_id` içeren veya bot tarafından atılan mesajlar) tekrar Discord'dan Echo'ya çekilmesi filtrelenerek mesaj yankılanması kesin olarak engellenir.

---

## 4. Test Yöntemi

1. `pnpm typecheck`, `pnpm lint`, `pnpm test` komutlarıyla tüm monorepo ve yeni `discord.test.ts` / `discord.spec.ts` testlerinin %100 geçmesi.
2. Yetkisiz (normal üye) bir kullanıcının Discord ayarlarını değiştirmeye çalıştığında sunucu tarafından reddedilmesinin testi.
3. Sahte (mock) Discord Widget ve Mesaj API yanıtlarıyla:
   - Aktif Discord üyelerinin ve ses kanalı katılımcılarının UI'a düşmesi,
   - Echo'dan yazılan mesajın Webhook'a gitmesi,
   - Discord'dan gelen mesajın `[DISCORD]` rozetiyle sohbete düşmesi ve sonsuz döngüye girmemesinin doğrulanması.
4. Onay sonrası canlıya alıp `pnpm release` ile yeni sürümün yayınlanması.
