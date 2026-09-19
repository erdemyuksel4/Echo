import { readFileSync, writeFileSync } from 'node:fs';
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

const bumpType = process.argv[2] || 'patch';

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

// 2. Git operations
function runCmd(cmd) {
  console.log(`> ${cmd}`);
  execSync(cmd, { cwd: rootDir, stdio: 'inherit' });
}

try {
  runCmd('git add .');
  runCmd(`git commit -m "chore: release ${nextTag}"`);
  runCmd(`git tag ${nextTag}`);
  runCmd(`git push origin main --tags`);

  console.log('\n======================================================');
  console.log(`🎉 Tebrikler! ${nextTag} GitHub'a başarıyla pushlandı!`);
  console.log(`🤖 GitHub Actions arka planda Windows runner üzerinde:`);
  console.log(`   1. Kurulum paketini (.exe, .blockmap, latest.yml) derleyecek.`);
  console.log(`   2. Otomatik bir GitHub Release oluşturup dosyaları oraya koyacak.`);
  console.log(`   3. Kullanıcıların Echo uygulaması açıldığında bu güncellemeyi`);
  console.log(`      otomatik algılayıp Discord tarzı yükleme sunacak!`);
  console.log('======================================================\n');
} catch (err) {
  console.error('\n❌ Bir hata oluştu:', err.message);
  process.exit(1);
}
