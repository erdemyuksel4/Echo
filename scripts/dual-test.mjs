import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

const exePath = resolve(rootDir, 'apps/desktop/dist/win-unpacked/Echo.exe');

console.log('\n======================================================');
console.log('   Echo — Çift Kullanıcı Test Başlatıcı (Multi-User)   ');
console.log('======================================================\n');

if (existsSync(exePath)) {
  console.log('🚀 Derlenmiş Echo.exe bulundu. İki bağımsız pencere açılıyor...');

  // 1. Start User 1 (Left window)
  console.log('👉 1. Kullanıcı açılıyor (Sol ekran)...');
  const user1 = spawn(exePath, [], {
    detached: true,
    stdio: 'ignore',
  });
  user1.unref();

  // Wait 1.5 seconds so windows do not clash during launch
  setTimeout(() => {
    // 2. Start User 2 (Right window with isolated profile)
    console.log('👉 2. Kullanıcı açılıyor (Sağ ekran, Profil: user2)...');
    const user2 = spawn(exePath, ['--profile=user2'], {
      detached: true,
      stdio: 'ignore',
    });
    user2.unref();

    console.log('\n✅ İki pencere başarıyla açıldı!');
    console.log('💡 Nasıl test edilir?');
    console.log('   1. Birinci pencerede grubunuzdaki davet kodunu kopyalayın.');
    console.log('   2. İkinci pencerede sol menüdeki "+" butonuna tıklayıp davet kodunu yapıştırın.');
    console.log('   3. İki kullanıcıyla aynı ses kanalına girin, ses ve konuşma halkalarını test edin.');
    console.log('   4. Birinde ses kanalındayken DM veya başka gruba geçip sesin düşmediğini görün!');
    console.log('======================================================\n');
    process.exit(0);
  }, 1500);
} else {
  console.log('⚠️ apps/desktop/dist/win-unpacked/Echo.exe bulunamadı.');
  console.log('📦 Lütfen önce "pnpm build:exe" çalıştırarak uygulamayı derleyin.\n');
  process.exit(1);
}
