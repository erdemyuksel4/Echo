import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Helper to fetch URL content
function fetchText(url) {
  return new Promise((resolve, reject) => {
    https.get(
      url,
      {
        headers: {
          'User-Agent': 'Echo-Updater-Tester/1.0',
          Accept: 'application/json, text/plain, */*',
        },
      },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return resolve(fetchText(res.headers.location));
        }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage} for ${url}`));
        }
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve(data));
      }
    ).on('error', reject);
  });
}

// Helper to check URL status (HEAD or GET)
function checkUrlStatus(url) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      {
        method: 'HEAD',
        headers: {
          'User-Agent': 'Echo-Updater-Tester/1.0',
        },
      },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          return resolve(checkUrlStatus(res.headers.location));
        }
        res.resume();
        resolve({ statusCode: res.statusCode, headers: res.headers });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

// Simple semver compare (returns >0 if a > b, <0 if a < b, 0 if equal)
function semverCompare(a, b) {
  const pa = a.replace(/^v/, '').split('.').map(Number);
  const pb = b.replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}

// Simple YAML parser for latest.yml
function parseLatestYml(content) {
  const result = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([a-zA-Z0-9_-]+):\s*(.+)$/);
    if (match) {
      const key = match[1];
      let val = match[2].trim();
      if ((val.startsWith("'") && val.endsWith("'")) || (val.startsWith('"') && val.endsWith('"'))) {
        val = val.slice(1, -1);
      }
      result[key] = val;
    }
  }
  return result;
}

async function runTests() {
  console.log('====================================================');
  console.log('       ECHO AUTO UPDATER ENTEGRASYON TESTI         ');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  [OK] ${message}`);
      passed++;
    } else {
      console.error(`  [HATA] ${message}`);
      failed++;
    }
  }

  // 1. Local Configuration Check
  console.log('[1/5] Yerel Yapılandırma ve Versiyon Kontrolü...');
  const desktopPkgPath = path.join(rootDir, 'apps', 'desktop', 'package.json');
  const desktopPkg = JSON.parse(fs.readFileSync(desktopPkgPath, 'utf-8'));
  const localVersion = desktopPkg.version;
  const publishConfig = desktopPkg.build?.publish;

  assert(Boolean(localVersion), `Yerel masaüstü versiyonu tanımlı: v${localVersion}`);
  assert(publishConfig?.provider === 'github', 'electron-builder provider GitHub olarak tanımlı');
  assert(publishConfig?.owner === 'erdemyuksel4', 'GitHub owner: erdemyuksel4');
  assert(publishConfig?.repo === 'Echo', 'GitHub repo: Echo');

  // 2. GitHub Releases API Check
  console.log('\n[2/5] GitHub Releases API Kontrolü...');
  let latestRelease;
  try {
    const releaseJson = await fetchText(
      'https://api.github.com/repos/erdemyuksel4/Echo/releases/latest'
    );
    latestRelease = JSON.parse(releaseJson);
    assert(Boolean(latestRelease.tag_name), `GitHub latest release bulundu: ${latestRelease.tag_name}`);
    console.log(`        Yayın Tarihi: ${latestRelease.published_at}`);
    console.log(`        Release Adı: ${latestRelease.name}`);
  } catch (err) {
    assert(false, `GitHub Releases API erişim hatası: ${err.message}`);
  }

  // 3. latest.yml Dosyası Doğrulama
  console.log('\n[3/5] GitHub latest.yml Dağıtım Dosyası Kontrolü...');
  let remoteVersion = null;
  try {
    const ymlContent = await fetchText(
      'https://github.com/erdemyuksel4/Echo/releases/download/v0.1.1/latest.yml'
    );
    const parsedYml = parseLatestYml(ymlContent);
    remoteVersion = parsedYml.version;
    assert(Boolean(remoteVersion), `latest.yml başarıyla okundu, remote version: v${remoteVersion}`);
    assert(parsedYml.path?.endsWith('.exe'), `latest.yml hedef yürütülebilir dosya: ${parsedYml.path}`);
    assert(Boolean(parsedYml.sha512), `latest.yml SHA512 doğrulaması mevcut: ${parsedYml.sha512.substring(0, 20)}...`);
  } catch (err) {
    assert(false, `latest.yml indirilemedi veya doğrulanamadı: ${err.message}`);
  }

  // 4. İndirilebilir Asset (Setup.exe) Doğrulama
  console.log('\n[4/5] GitHub Kurulum Paketi (Setup.exe) Erişilebilirliği...');
  try {
    const assetUrl = 'https://github.com/erdemyuksel4/Echo/releases/download/v0.1.1/Echo.Setup.0.1.1.exe';
    const res = await checkUrlStatus(assetUrl);
    assert(
      res.statusCode === 200,
      `Echo.Setup.0.1.1.exe doğrudan indirilebilir durumda (HTTP ${res.statusCode})`
    );
    if (res.headers['content-length']) {
      const mb = (Number(res.headers['content-length']) / (1024 * 1024)).toFixed(1);
      console.log(`        Dosya boyutu: ${mb} MB`);
    }
  } catch (err) {
    assert(false, `Setup exe erişilemedi: ${err.message}`);
  }

  // 5. Semver Karşılaştırma & Senaryo Testi (autoUpdater davranış simülasyonu)
  console.log('\n[5/5] Uygulama Başlarken Sürüm Karşılaştırma Mantığı Simülasyonu...');
  if (remoteVersion) {
    // Senaryo A: Yerel v0.1.0 iken GitHub v0.1.1
    const cmpOld = semverCompare(remoteVersion, '0.1.0');
    assert(
      cmpOld > 0,
      `Senaryo A: Kullanıcıda v0.1.0 kuruluysa -> GitHub (v${remoteVersion}) daha yeni olduğu için 'update-available' tetiklenir ve güncelleme barı görünür.`
    );

    // Senaryo B: Yerel v0.1.1 iken GitHub v0.1.1 (Şu anki durum)
    const cmpSame = semverCompare(remoteVersion, localVersion);
    assert(
      cmpSame === 0,
      `Senaryo B: Kullanıcıda v${localVersion} kuruluysa -> GitHub (v${remoteVersion}) ile aynı olduğu için 'update-not-available' tetiklenir ve uygulama sessizce açılır.`
    );

    // Senaryo C: Yerel v0.1.2 (daha yeni yerel sürüm) iken GitHub v0.1.1
    const cmpNewer = semverCompare(remoteVersion, '0.1.2');
    assert(
      cmpNewer < 0,
      `Senaryo C: Kullanıcıda v0.1.2 varsa -> GitHub (v${remoteVersion}) daha eski olduğu için güncelleme tetiklenmez.`
    );
  }

  // 6. Packaged App resources kontrolü
  console.log('\n[Ek Kontrol] Derlenmiş paket içindeki app-update.yml kontrolü...');
  const unpackedConfigPath = path.join(
    rootDir,
    'apps',
    'desktop',
    'dist',
    'win-unpacked',
    'resources',
    'app-update.yml'
  );
  if (fs.existsSync(unpackedConfigPath)) {
    const content = fs.readFileSync(unpackedConfigPath, 'utf-8');
    assert(
      content.includes('owner: erdemyuksel4') && content.includes('repo: Echo'),
      `win-unpacked/resources/app-update.yml doğru repo yapılandırmasına sahip.`
    );
  } else {
    console.log('  [BİLGİ] Henüz win-unpacked derlenmemiş veya temizlenmiş (isteğe bağlı).');
  }

  console.log('\n====================================================');
  console.log(`SONUÇ: ${passed} test başarılı, ${failed} test hatalı.`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runTests().catch((err) => {
  console.error('Test sırasında beklenmeyen hata:', err);
  process.exit(1);
});
