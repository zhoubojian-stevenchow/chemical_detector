// Packs a finished Vite build into ONE self-contained .html file: script, styles, fonts and
// favicon are all inlined, so the game runs by double-clicking the file (file://, no server,
// no internet).
//   npm run build:single                                  → release/chem-detective-v<version>.html
//   node scripts/singlefile.mjs <distDir> [outFile]       → pack an existing build
//
// The packer refuses (throws) rather than writing a file that would be broken offline: a
// code-split build, an asset the bundle loads at runtime, or anything fetched from the internet.
import { existsSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIME = {
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.cur': 'image/x-icon',
  '.eot': 'application/vnd.ms-fontobject',
};

/** url(…) with a quoted or bare argument (quoted data: URIs may contain ")") */
const CSS_URL = /url\(\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|[^)\s]*)\s*\)/gi;

/** <link rel=…> values that make the browser fetch something */
const FETCHING_RELS = /\b(stylesheet|icon|apple-touch-icon|mask-icon)\b/i;
/** hints/PWA links that mean nothing in a single offline file → dropped */
const DROPPED_RELS = /\b(manifest|preload|modulepreload|prefetch|preconnect|dns-prefetch|prerender)\b/i;

class PackError extends Error {
  constructor(msg) {
    super(`singlefile: ${msg}`);
  }
}

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (name.startsWith('.') || name.endsWith('.map')) continue; // .DS_Store, sourcemaps
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

function unquote(s) {
  return s.trim().replace(/^(['"])(.*)\1$/s, '$2');
}

function attr(tag, name) {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return m ? (m[2] ?? m[3] ?? m[4]) : null;
}

/**
 * @param {string} distDir  folder holding index.html from `vite build`
 * @param {string} outFile  .html file to write
 * @param {{ banner?: string }} [opts] text placed in a comment in <head> (e.g. licences)
 * @returns {{ bytes: number }}
 */
export function packSingleFile(distDir, outFile, opts = {}) {
  distDir = resolve(distDir);
  const used = new Set(); // dist files whose content made it into the output (or were dropped on purpose)

  /** classify a reference found in `fromDir` */
  const ref = (raw, fromDir) => {
    const r = unquote(raw);
    if (/^data:/i.test(r)) return { kind: 'data' };
    if (/^#/.test(r) || r === '') return { kind: 'fragment' };
    if (/^(https?:)?\/\//i.test(r)) return { kind: 'remote', url: r };
    if (/^[a-z][a-z0-9+.-]*:/i.test(r)) return { kind: 'other' }; // mailto:, tel:, javascript:, blob:…
    const frag = r.includes('#') ? r.slice(r.indexOf('#')) : '';
    let clean = r.split(/[?#]/)[0];
    try {
      clean = decodeURI(clean);
    } catch {
      /* keep it as written */
    }
    const path = clean.startsWith('/') ? join(distDir, clean) : join(fromDir, clean);
    if (!existsSync(path)) throw new PackError(`"${r}" points at a missing file (${path})`);
    return { kind: 'local', path, frag };
  };

  const dataUri = (path) => {
    const mime = MIME[extname(path).toLowerCase()];
    if (!mime) throw new PackError(`don't know how to inline ${relative(distDir, path)} (no MIME type)`);
    used.add(path);
    return `data:${mime};base64,${readFileSync(path).toString('base64')}`;
  };

  const inlineCss = (css, cssDir, where) => {
    if (/@import\b/i.test(css)) throw new PackError(`${where} uses @import, which can't be inlined`);
    // every browser that runs WebGL2-era three.js reads woff2, so drop the bulkier woff fallbacks
    css = css.replace(/,\s*url\(\s*(['"]?)([^)'"]+\.woff)\1\s*\)\s*format\(\s*['"]?woff['"]?\s*\)/gi, (_m, _q, u) => {
      const r = ref(u, cssDir);
      if (r.kind === 'local') used.add(r.path);
      return '';
    });
    css = css.replace(CSS_URL, (m, raw) => {
      const r = ref(raw, cssDir);
      if (r.kind === 'remote') throw new PackError(`${where} loads ${r.url} from the internet`);
      return r.kind === 'local' ? `url("${dataUri(r.path)}${r.frag}")` : m;
    });
    // backstop: image-set("x.png" 1x) & co. — any string still naming a shipped file
    for (const m of css.matchAll(/(["'])((?!data:)[^"'\s]+\.[a-z0-9]{2,5})\1/gi)) {
      const p = join(cssDir, m[2].split(/[?#]/)[0]);
      if (existsSync(p) && statSync(p).isFile()) throw new PackError(`${where} still references ${m[2]}`);
    }
    if (/<\/style/i.test(css)) throw new PackError(`${where} contains "</style"`);
    return css;
  };

  const inlineJs = (path) => {
    used.add(path);
    let js = readFileSync(path, 'utf8');
    const where = relative(distDir, path);
    // a single file can only carry ONE self-contained module (extra chunks / runtime-loaded assets
    // are also caught by the asset walk below)
    if (/(?:\bfrom|\bimport)\s*\(?\s*["'`](?:https?:)?\/\//.test(js)) throw new PackError(`${where} imports code from the internet`);
    if (/\bimport\(\s*["'`]\.{1,2}\//.test(js)) throw new PackError(`${where} uses dynamic import() — the build must not be code-split`);
    if (/(?:\bfrom|\bimport)\s*["'`]\.{1,2}\//.test(js)) throw new PackError(`${where} imports another chunk — the build must not be code-split`);
    if (/\bimport\.meta\.url\b/.test(js)) throw new PackError(`${where} resolves files via import.meta.url — inline those assets instead`);
    // "</script" would end the inline <script> early; "<\/script" means the same thing to JS
    js = js.replace(/<\/(script)/gi, '<\\/$1');
    if (/<!--/.test(js) && /<script/i.test(js)) throw new PackError(`${where} contains "<!--" and "<script" (unsafe to inline)`);
    return js;
  };

  let html = readFileSync(join(distDir, 'index.html'), 'utf8').replace(/^\uFEFF/, '');
  // <style> blocks written in index.html may reference files too
  html = html.replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi, (_m, a, css, b) => a + inlineCss(css, distDir, 'an inline <style>') + b);
  if (!/<\/body>/i.test(html) || !/<head\b[^>]*>/i.test(html)) throw new PackError('index.html needs <head> and </body>');
  if (/<script\b[^>]*type\s*=\s*["']?importmap/i.test(html)) throw new PackError('import maps load modules at runtime and cannot be packed');

  // <link>s: stylesheets → <style>, icons → data URIs; preloads mean a code-split build
  html = html.replace(/<link\b[^>]*>/gi, (tag) => {
    const rel = attr(tag, 'rel') ?? '';
    const href = attr(tag, 'href');
    if (DROPPED_RELS.test(rel)) return '';
    if (!href || !FETCHING_RELS.test(rel)) return tag;
    const r = ref(href, distDir);
    if (r.kind === 'remote') throw new PackError(`<link rel="${rel}"> loads ${r.url} from the internet`);
    if (r.kind !== 'local') return tag;
    if (/\bstylesheet\b/i.test(rel)) {
      if (/\balternate\b/i.test(rel)) throw new PackError(`<link rel="${rel}"> (alternate stylesheet) can't be packed`);
      used.add(r.path);
      const media = attr(tag, 'media');
      const open = media && media !== 'all' ? `<style media="${media.replace(/"/g, '&quot;')}">` : '<style>';
      return `${open}${inlineCss(readFileSync(r.path, 'utf8'), dirname(r.path), relative(distDir, r.path))}</style>`;
    }
    return tag.replace(href, () => dataUri(r.path) + r.frag);
  });


  // external scripts → inline scripts (keep type="module": inline modules run fine from file://)
  html = html.replace(/<script\b([^>]*?)\s+src\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)([^>]*)>\s*<\/script>/gi, (tag, pre, src, post) => {
    const r = ref(src, distDir);
    if (r.kind === 'remote') throw new PackError(`<script> loads ${r.url} from the internet`);
    if (r.kind !== 'local') return tag;
    const attrs = `${pre} ${post}`.replace(/\s*\bcrossorigin(\s*=\s*("[^"]*"|'[^']*'|[^\s>]+))?/gi, '').replace(/\s+/g, ' ').trim();
    return `<script${attrs ? ' ' + attrs : ''}>${inlineJs(r.path)}</script>`;
  });

  // move the (deferred) module scripts to the end of <body>, after the loader markup they drive
  const scripts = [];
  html = html.replace(/<script\b[^>]*type\s*=\s*["']?module["']?[^>]*>[\s\S]*?<\/script>\s*/gi, (s) => {
    scripts.push(s.trim());
    return '';
  });
  const noscript =
    '<noscript><div style="position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;padding:24px;background:#22223b;color:#fff;font:600 20px sans-serif;text-align:center">Please enable JavaScript to play.</div></noscript>';
  const bodyEnd = html.toLowerCase().lastIndexOf('</body>');
  html = `${html.slice(0, bodyEnd)}  ${[...scripts, noscript].join('\n  ')}\n  ${html.slice(bodyEnd)}`;

  // nothing in the markup may still load a file (script bodies were checked above)
  const markup = html.replace(/(<script\b[^>]*>)[\s\S]*?<\/script>/gi, '$1</script>').replace(/<!--[\s\S]*?-->/g, '');
  for (const tag of markup.match(/<(?:script|img|source|video|audio|iframe|embed|track|object|input|use|image)\b[^>]*>/gi) ?? []) {
    for (const name of ['src', 'srcset', 'poster', 'data', 'href', 'xlink:href']) {
      const v = attr(tag, name);
      if (!v) continue;
      const parts = name === 'srcset' && !/^\s*data:/i.test(v) ? v.split(',').map((x) => x.trim().split(/\s+/)[0]) : [v];
      for (const part of parts) {
        const r = ref(part, distDir);
        if (r.kind === 'remote') throw new PackError(`${tag.slice(0, 60)}… loads ${r.url} from the internet`);
        if (r.kind === 'local') throw new PackError(`${tag.slice(0, 60)}… still points at ${relative(distDir, r.path)}`);
      }
    }
  }
  for (const m of markup.matchAll(CSS_URL)) {
    const r = ref(m[1], distDir);
    if (r.kind === 'local' || r.kind === 'remote') throw new PackError(`markup still references ${unquote(m[1])}`);
  }

  // every emitted asset must be inside the file; an unused one means the bundle loads it at runtime
  const code = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]).join('\n');
  for (const f of walk(distDir)) {
    if (used.has(f) || f === join(distDir, 'index.html')) continue;
    const inAssets = relative(distDir, f).split(/[\\/]/)[0] === 'assets';
    const name = basename(f).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (inAssets || new RegExp(`["'\`/]${name}["'\`?#]`).test(code)) {
      throw new PackError(`${relative(distDir, f)} would be missing from the single file (code-split chunk or runtime-loaded asset)`);
    }
  }

  // the charset must be declared within the first 1024 bytes: put it first in <head>
  html = html.replace(/<meta\b[^>]*\bcharset\s*=[^>]*>\s*/i, '');
  html = html.replace(/<head\b[^>]*>/i, (h) => `${h}\n    <meta charset="UTF-8" />`);
  if (Buffer.from(html).indexOf('charset') > 1024) throw new PackError('<head> starts too late for the charset declaration');

  if (opts.banner) {
    const text = opts.banner.trim();
    if (/-->|--!>/.test(text)) throw new PackError('banner contains a comment terminator');
    const comment = `\n<!--\n${text}\n-->`;
    // after <meta charset>, which must stay within the first 1024 bytes
    const charset = html.match(/<meta\b[^>]*\bcharset\b[^>]*>/i);
    if (charset) html = html.replace(charset[0], () => charset[0] + comment);
    else html = html.replace(/<head\b[^>]*>/i, (h) => h + comment);
  }

  writeFileSync(outFile, html);
  return { bytes: Buffer.byteLength(html) };
}

/** Comment placed in the packed file: what it is + the bundled third-party licences. */
export function licenceBanner(root, version) {
  return `Chem Detective v${version} — single-file edition. Open this file in any modern browser to play.\n\n${readFileSync(join(root, 'public', 'licenses.txt'), 'utf8')}`;
}

// CLI (realpath both sides so symlinked checkouts / junctions still count as "run directly")
const self = realpathSync(fileURLToPath(import.meta.url));
const entry = process.argv[1] && existsSync(process.argv[1]) ? realpathSync(process.argv[1]) : '';
if (entry === self) {
  const root = resolve(dirname(self), '..');
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const dist = resolve(process.argv[2] ?? join(root, 'dist-standalone'));
  const out = resolve(process.argv[3] ?? join(root, 'release', `chem-detective-v${pkg.version}.html`));
  try {
    const { bytes } = packSingleFile(dist, out, { banner: licenceBanner(root, pkg.version) });
    console.log(`  ✓ ${relative(root, out)}  (${(bytes / 1024 / 1024).toFixed(2)} MB, single file)`);
  } catch (e) {
    console.error(e instanceof PackError ? `✗ ${e.message}` : e);
    process.exit(1);
  }
}
