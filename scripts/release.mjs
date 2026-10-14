// Builds every platform variant and packs each into an upload-ready zip in ./release,
// plus a single double-clickable .html of the ad-free build
//   npm run release            → all platforms
//   npm run release -- poki    → just one
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { zipSync } from 'fflate';
import { licenceBanner, packSingleFile } from './singlefile.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
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
  if (t === 'standalone') {
    // the ad-free build also ships as one double-clickable .html file
    const html = `chem-detective-v${pkg.version}.html`;
    const { bytes } = packSingleFile(outDir, join(relDir, html), { banner: licenceBanner(root, pkg.version) });
    console.log(`  ✓ release/${html}  (${(bytes / 1024 / 1024).toFixed(2)} MB, single file)`);
  }
}
console.log('\nDone. Upload the zip that matches your portal (see README.md → "Publishing").');
