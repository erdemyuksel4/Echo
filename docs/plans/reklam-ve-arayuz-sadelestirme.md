# Plan: Arayüz Sadeleştirme & YouTube Reklamlarını Sıfırlama

## Hedef
1. Kullanıcının bilmesini gerektirmeyen teknik jargonları (WebRTC Mesh, 480p24, RTC Bağlanıyor, STUN/TURN, Sinyal barları vb.) ve işlevsiz/fazlalık tuşları (Tanı modalı/butonu, mükerrer Hakkında butonu) temizleyerek arayüzü sade, profesyonel Discord standardına getirmek.
2. YouTube müzik motoruna dahili Electron ağ filtreleme ve DOM reklam atlayıcı ekleyerek tüm reklamları sıfırlamak; reklamların hiç başlamamasını ve kullanıcıların aynı anda reklamsız şekilde şarkıyı dinlemesini sağlamak.

## Dokunulacak Dosyalar
- `apps/desktop/src/main/index.ts`: Electron `session.defaultSession.webRequest.onBeforeRequest` içine reklam ağlarını (doubleclick, googleads, youtube.com/pagead, ad_break vb.) engelleyen kural eklenmesi.
- `apps/desktop/src/main/musicPlayer.ts`: Oynatıcı içinde olası reklam durumunda anlık sessize alma ve 0.05 saniyede reklamı atlama mekanizması.
- `apps/desktop/src/renderer/src/components/VoicePanel.tsx`: "Tanı" (Activity) butonunun ve "RTC Mesh", "RTC Bağlanıyor" gibi teknik ifadelerin kaldırılması/sadeleştirilmesi.
- `apps/desktop/src/renderer/src/components/VoiceStageView.tsx`: "Tanı" butonunun ve "480p24 WebRTC Mesh" teknik yazısının kaldırılması.
- `apps/desktop/src/renderer/src/components/ChannelList.tsx`: Profil yanındaki mükerrer "Info" (Hakkında) butonunun kaldırılması (Ayarlar modalında zaten mevcut).
- `apps/desktop/src/renderer/src/components/ChatArea.tsx`: Üst bardaki gereksiz yeşil sinyal çubuklarının sadeleştirilmesi.

## Riskler & Dikkat Edilecekler
- YouTube'un ana video akışlarının (`*.googlevideo.com`) reklam filtresinden etkilenmemesi (yalnızca `pagead`, `doubleclick`, `ad_break`, `get_midroll_info` engellenecek).
- `VoiceDiagnosticsModal`'ın kaldırılması veya geliştirici moduna gizlenmesi; ses bağlantısı ve WebRTC servisinin çalışmasını etkilemez.

## Test Yöntemi
1. `pnpm typecheck`, `pnpm lint`, `pnpm test` komutlarının hatasız geçmesi.
2. YouTube'dan video/şarkı aratılıp oynatıldığında reklam girmeden doğrudan parçanın başlamasının doğrulanması.
3. Arayüzün incelenmesi: Sadeleşen barlar ve kaldırılan fazlalık butonların doğrulanması.
4. Yeni sürümün `pnpm release` ile GitHub'a yüklenmesi.
