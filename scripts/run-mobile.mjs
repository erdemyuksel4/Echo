import { spawnSync } from 'child_process';
import path from 'path';

const action = process.argv[2] || 'test';
const mobileDir = path.resolve(process.cwd(), 'apps/mobile');

const res = spawnSync('flutter', [action], {
  cwd: mobileDir,
  stdio: 'inherit',
  shell: true,
});

process.exit(res.status ?? 0);
