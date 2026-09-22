import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

const packagePaths = [
  resolve(rootDir, 'package.json'),
  resolve(rootDir, 'apps/desktop/package.json'),
  resolve(rootDir, 'apps/server/package.json'),
  resolve(rootDir, 'packages/shared/package.json'),
];

const rootPkg = JSON.parse(readFileSync(packagePaths[0], 'utf-8'));
const currentVersion = rootPkg.version || '0.1.0';

const args = process.argv.slice(2);
const isCloud = args.includes('--cloud');
const bumpType = args.find((a) => !a.startsWith('--')) || 'patch';

function getNextVersion(version, type) {
  const parts = version.split('.').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) {
    throw new Error(`Geçersiz semver formatı: ${version}`);
  }
  let [major, minor, patch] = parts;
  if (type === 'major') {
    major++;
    minor = 0;
    patch = 0;
  } else if (type === 'minor') {
    minor++;
    patch = 0;
  } else if (type === 'patch') {
    patch++;
  } else if (/^\d+\.\d+\.\d+$/.test(type)) {
    return type;
  } else {
    throw new Error(`Bilinmeyen sürüm artırma tipi: ${type}. (patch, minor, major veya x.y.z verin)`);
  }
  return `${major}.${minor}.${patch}`;
}

const nextVersion = getNextVersion(currentVersion, bumpType);
const nextTag = `v${nextVersion}`;

console.log('\n======================================================');
console.log(`🚀 Echo Otomatik Sürüm Yayınlayıcı`);
console.log(`📌 Mevcut Sürüm: v${currentVersion}`);
console.log(`✨ Yeni Sürüm:   ${nextTag}`);
console.log('======================================================\n');

// 1. Update package.json files
for (const p of packagePaths) {
  const content = JSON.parse(readFileSync(p, 'utf-8'));
  content.version = nextVersion;
  writeFileSync(p, JSON.stringify(content, null, 2) + '\n', 'utf-8');
  console.log(`✓ Güncellendi: ${p.replace(rootDir, '')}`);
}

// 2. Extract GitHub Token from Windows Git Credential Manager
function getGitHubToken() {
  try {
    const out = execSync('git credential fill', {
      input: 'protocol=https\nhost=github.com\n\n',
      stdio: ['pipe', 'pipe', 'ignore'],
    }).toString();
    const match = out.match(/password=(.+)/);
    return match ? match[1].trim() : null;
  } catch {
    return null;
  }
}

const ghToken = process.env.GH_TOKEN || getGitHubToken();

let buildDuration = '0';
if (!isCloud) {
  // 3. Local Fast Build
  console.log('\n[1/3] 🔨 Masaüstü Kurulum Paketi Yerelde Hızlıca Derleniyor...');
  const startTime = Date.now();
  try {
    execSync('pnpm --filter @echo/desktop run build:exe', {
      cwd: rootDir,
      stdio: 'inherit',
      env: { ...process.env, GH_TOKEN: ghToken || undefined },
    });
  } catch (err) {
    console.error('\n❌ Derleme hatası:', err.message);
    process.exit(1);
  }
  buildDuration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`✓ Derleme tamamlandı (${buildDuration} saniye)!\n`);
} else {
  console.log('\n☁️  Bulut Modu (--cloud): Yerel derleme atlandı, GitHub Actions derleyecek.\n');
}

// 4. Git Commit & Tag
console.log('[2/3] 📦 Git Commit ve Tag Hazırlanıyor...');
function runCmd(cmd, env = {}) {
  console.log(`> ${cmd}`);
  execSync(cmd, { cwd: rootDir, stdio: 'inherit', env: { ...process.env, ...env } });
}

try {
  runCmd('git add .');
  runCmd(`git commit -m "chore: release ${nextTag}"`);
  runCmd(`git tag ${nextTag}`);
  runCmd(`git push origin main --tags`);
} catch (err) {
  console.error('\n❌ Git işlemi hatası:', err.message);
  process.exit(1);
}

if (!isCloud) {
  // 5. Direct Upload to GitHub Releases
  console.log('\n[3/3] 🚀 GitHub Releases Sayfasına Doğrudan Yükleniyor...');
  const distDir = resolve(rootDir, 'apps/desktop/dist');
  const exeSpaced = resolve(distDir, `Echo Setup ${nextVersion}.exe`);
  const blockmapSpaced = resolve(distDir, `Echo Setup ${nextVersion}.exe.blockmap`);
  const exeHyphen = resolve(distDir, `Echo-Setup-${nextVersion}.exe`);
  const blockmapHyphen = resolve(distDir, `Echo-Setup-${nextVersion}.exe.blockmap`);
  const latestYml = resolve(distDir, 'latest.yml');

  // Ensure hyphenated copies exist for electron-updater latest.yml compatibility
  try {
    if (existsSync(exeSpaced) && !existsSync(exeHyphen)) {
      copyFileSync(exeSpaced, exeHyphen);
    }
    if (existsSync(blockmapSpaced) && !existsSync(blockmapHyphen)) {
      copyFileSync(blockmapSpaced, blockmapHyphen);
    }
  } catch (copyErr) {
    console.warn('[Uyarı] Dosya kopyalama uyarısı:', copyErr.message);
  }

  if (ghToken) {
    const filesToUpload = [exeSpaced, exeHyphen, blockmapSpaced, blockmapHyphen, latestYml]
      .filter((f) => existsSync(f))
      .map((f) => `"${f}"`)
      .join(' ');

    try {
      console.log(`> gh release create ${nextTag} (hızlı doğrudan yükleme)`);
      execSync(
        `gh release create ${nextTag} ${filesToUpload} --title "${nextTag}" --notes "Echo ${nextTag} sürümü (Otomatik Hızlı Dağıtım)"`,
        {
          cwd: rootDir,
          stdio: 'inherit',
          env: { ...process.env, GH_TOKEN: ghToken },
        }
      );
      console.log(`✓ GitHub Release başarıyla oluşturuldu ve tüm dosyalar yüklendi!`);
    } catch (err) {
      console.warn(`[Bilgi] 'gh release create' mevcut veya uyarı verdi, upload deneniyor:`, err.message);
      try {
        execSync(
          `gh release upload ${nextTag} ${filesToUpload} --clobber`,
          {
            cwd: rootDir,
            stdio: 'inherit',
            env: { ...process.env, GH_TOKEN: ghToken },
          }
        );
        console.log(`✓ Dosyalar mevcut Release'e başarıyla yüklendi!`);
      } catch (uploadErr) {
        console.warn(`[Bilgi] Doğrudan yükleme atlandı:`, uploadErr.message);
      }
    }
  } else {
    console.log('[Bilgi] GitHub token bulunamadı; derleme GitHub Actions üzerinden tamamlanacak.');
  }

  console.log('\n======================================================');
  console.log(`🎉 Tebrikler! ${nextTag} artık YAYINDA!`);
  console.log(`⚡ Toplam Süre: ~${buildDuration} saniye (GitHub Actions beklenmedi!)`);
  console.log(`🔄 Uygulamayı açtığınızda güncelleme otomatik yüklenecektir.`);
  console.log('======================================================\n');
} else {
  console.log('\n======================================================');
  console.log(`🎉 Tebrikler! ${nextTag} GitHub'a pushlandı!`);
  console.log(`🤖 GitHub Actions arka planda Windows runner üzerinde derleyecek.`);
  console.log('======================================================\n');
}

