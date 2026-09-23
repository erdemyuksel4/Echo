import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

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

const token = process.env.GH_TOKEN || getGitHubToken();
if (!token) {
  console.error('GitHub token bulunamadı!');
  process.exit(1);
}

const tag = process.argv[2] || 'v0.1.8';
const distDir = resolve(rootDir, 'apps/desktop/dist');

const files = [
  resolve(distDir, 'latest.yml'),
  resolve(distDir, 'Echo Setup 0.1.8.exe'),
  resolve(distDir, 'Echo-Setup-0.1.8.exe'),
  resolve(distDir, 'Echo Setup 0.1.8.exe.blockmap'),
  resolve(distDir, 'Echo-Setup-0.1.8.exe.blockmap'),
].filter((f) => existsSync(f));

console.log(`Release ${tag} için dosyalar yükleniyor:`, files.map((f) => f.split('\\').pop()));

const fileArgs = files.map((f) => `"${f}"`).join(' ');
const cmd = `gh release upload ${tag} ${fileArgs} --clobber`;
console.log(`> ${cmd}`);

try {
  execSync(cmd, {
    cwd: rootDir,
    stdio: 'inherit',
    env: { ...process.env, GH_TOKEN: token },
  });
  console.log(`✓ Release ${tag} dosyaları ve latest.yml başarıyla güncellendi!`);
} catch (err) {
  console.error('Yükleme hatası:', err.message);
  process.exit(1);
}
