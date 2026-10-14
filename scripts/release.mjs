// Builds every platform variant and packs each into an upload-ready zip in ./release
//   npm run release            → all platforms
//   npm run release -- poki    → just one
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { zipSync } from 'fflate';

const root = new URL('..', import.meta.url).pathname;
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const all = ['poki', 'crazygames', 'gamedistribution', 'adsense', 'standalone'];
const wanted = process.argv.slice(2).filter((a) => all.includes(a));
const targets = wanted.length ? wanted : all;

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

console.log('▶ type-check + tests');
execSync('npx tsc --noEmit', { cwd: root, stdio: 'inherit' });
execSync('npx vitest run', { cwd: root, stdio: 'inherit' });

const relDir = join(root, 'release');
if (!existsSync(relDir)) mkdirSync(relDir);

for (const t of targets) {
  const outDir = join(root, `dist-${t}`);
  console.log(`\n▶ building ${t}`);
  rmSync(outDir, { recursive: true, force: true });
  execSync(`npx vite build --mode ${t} --outDir ${outDir}`, { cwd: root, stdio: 'inherit' });
  const files = {};
  for (const f of walk(outDir)) files[relative(outDir, f).split('\\').join('/')] = readFileSync(f);
  const zip = zipSync(files, { level: 9 });
  const name = `chem-detective-${t}-v${pkg.version}.zip`;
  writeFileSync(join(relDir, name), zip);
  console.log(`  ✓ release/${name}  (${(zip.length / 1024 / 1024).toFixed(2)} MB, ${Object.keys(files).length} files)`);
}
console.log('\nDone. Upload the zip that matches your portal (see README.md → "Publishing").');
