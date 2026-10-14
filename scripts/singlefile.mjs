// Packs a finished Vite build into ONE self-contained .html file: script, styles, fonts and
// favicon are all inlined, so the game runs by double-clicking the file (file://, no server,
// no internet).
//   npm run build:single                                  → release/chem-detective-v<version>.html
//   node scripts/singlefile.mjs <distDir> [outFile]       → pack an existing build
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIME = {
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

function dataUri(file) {
  const mime = MIME[extname(file).toLowerCase()];
  if (!mime) throw new Error(`singlefile: no MIME type for ${file}`);
  return `data:${mime};base64,${readFileSync(file).toString('base64')}`;
}

/** Local (relative) reference → absolute path, or null for data:/http(s): etc. */
function local(ref, baseDir) {
  const r = ref.trim().replace(/^['"]|['"]$/g, '');
  if (/^(data:|https?:|\/\/|#)/i.test(r)) return null;
  return join(baseDir, r.split(/[?#]/)[0]);
}

function inlineCss(css, cssDir) {
  // every browser that runs WebGL2-era three.js reads woff2, so drop the bulkier woff fallbacks
  css = css.replace(/,\s*url\(\s*['"]?[^)'"]+\.woff['"]?\s*\)\s*format\(\s*['"]?woff['"]?\s*\)/gi, '');
  css = css.replace(/url\(\s*([^)]+?)\s*\)/g, (m, ref) => {
    const p = local(ref, cssDir);
    if (!p) return m;
    if (!existsSync(p)) throw new Error(`singlefile: CSS references missing file ${p}`);
    return `url(${dataUri(p)})`;
  });
  if (/<\/style/i.test(css)) throw new Error('singlefile: stylesheet contains "</style"');
  return css;
}

function safeScript(js) {
  // "</script" would end the inline <script> early; "<\/script" means the same thing to JS
  js = js.replace(/<\/(script)/gi, '<\\/$1');
  if (/<!--/.test(js) && /<script/i.test(js)) throw new Error('singlefile: script contains "<!--" and "<script" (unsafe to inline)');
  return js;
}

function attr(tag, name) {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return m ? (m[2] ?? m[3] ?? m[4]) : null;
}

/**
 * @param {string} distDir  folder holding index.html from `vite build`
 * @param {string} outFile  .html file to write
 * @param {{ banner?: string }} [opts] text placed in a comment at the top of the file (e.g. licences)
 * @returns {{ bytes: number }}
 */
export function packSingleFile(distDir, outFile, opts = {}) {
  const htmlPath = join(distDir, 'index.html');
  let html = readFileSync(htmlPath, 'utf8');

  // preload hints are pointless once everything is inline
  html = html.replace(/<link\b[^>]*\brel\s*=\s*["']?modulepreload["']?[^>]*>\s*/gi, '');

  // stylesheets → <style>
  html = html.replace(/<link\b[^>]*\brel\s*=\s*["']?stylesheet["']?[^>]*>/gi, (tag) => {
    const p = local(attr(tag, 'href') ?? '', distDir);
    if (!p) return tag;
    return `<style>${inlineCss(readFileSync(p, 'utf8'), dirname(p))}</style>`;
  });

  // icons → data URIs
  html = html.replace(/<link\b[^>]*\brel\s*=\s*["']?(?:shortcut\s+)?(?:icon|apple-touch-icon)["']?[^>]*>/gi, (tag) => {
    const href = attr(tag, 'href');
    const p = href && local(href, distDir);
    if (!p) return tag;
    return tag.replace(href, () => dataUri(p));
  });

  // external scripts → inline scripts (keep type="module": inline modules run fine from file://)
  html = html.replace(/<script\b([^>]*)\bsrc\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)([^>]*)>\s*<\/script>/gi, (tag, pre, src, post) => {
    const p = local(src.replace(/^['"]|['"]$/g, ''), distDir);
    if (!p) return tag;
    const attrs = `${pre} ${post}`.replace(/\s*\bcrossorigin(\s*=\s*("[^"]*"|'[^']*'|[^\s>]+))?/gi, '').replace(/\s+/g, ' ').trim();
    const js = safeScript(readFileSync(p, 'utf8'));
    return `<script${attrs ? ' ' + attrs : ''}>${js}</script>`;
  });

  // move the (deferred) module script to the end of <body>, after the loader markup it drives
  const scripts = [];
  html = html.replace(/<script\b[^>]*type\s*=\s*["']?module["']?[^>]*>[\s\S]*?<\/script>\s*/gi, (s) => {
    scripts.push(s.trim());
    return '';
  });
  html = html.replace(/<\/body>/i, () => `  ${scripts.join('\n')}\n  </body>`);

  html = html.replace(/<\/body>/i, () => `  <noscript><p style="font:600 18px sans-serif;color:#fff;text-align:center;margin-top:40vh">Please enable JavaScript to play.</p></noscript>\n  </body>`);

  if (opts.banner) {
    const text = opts.banner.trim();
    if (/-->|--!>/.test(text)) throw new Error('singlefile: banner contains a comment terminator');
    html = html.replace(/^(<!doctype html>)/i, (d) => `${d}\n<!--\n${text}\n-->`);
  }

  // nothing may still point at a sibling file (markup + styles; script bodies are checked for
  // bundler asset paths, since game code legitimately builds href="…" strings at runtime)
  const markup = html.replace(/(<script\b[^>]*>)[\s\S]*?<\/script>/gi, '$1</script>');
  const leftovers = [
    ...markup.matchAll(/\b(?:src|href)\s*=\s*["']?(?!data:|https?:|#|mailto:)([^"'\s>]+)/gi),
    ...markup.matchAll(/url\(\s*['"]?(?!data:|#)([^)'"]+)/gi),
    ...scripts.join('\n').matchAll(/["'`](?:\.{0,2}\/)?(assets\/[^"'`]+)["'`]/g),
  ].map((m) => m[1]);
  if (leftovers.length) throw new Error(`singlefile: unresolved local references: ${leftovers.join(', ')}`);

  writeFileSync(outFile, html);
  return { bytes: Buffer.byteLength(html) };
}

/** Comment placed at the top of the packed file: what it is + the bundled third-party licences. */
export function licenceBanner(root, version) {
  return `Chem Detective v${version} — single-file edition. Open this file in any modern browser to play.\n\n${readFileSync(join(root, 'public', 'licenses.txt'), 'utf8')}`;
}

// CLI
if (resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1] ?? '')) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const dist = resolve(process.argv[2] ?? join(root, 'dist-standalone'));
  const out = resolve(process.argv[3] ?? join(root, 'release', `chem-detective-v${pkg.version}.html`));
  const { bytes } = packSingleFile(dist, out, { banner: licenceBanner(root, pkg.version) });
  console.log(`  ✓ ${out.slice(root.length + 1)}  (${(bytes / 1024 / 1024).toFixed(2)} MB, single file)`);
}
