// Guards for scripts/singlefile.mjs: what it inlines, and the broken builds it must refuse.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { packSingleFile } from '../scripts/singlefile.mjs';

const dirs = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

const FONT = Buffer.from([0x77, 0x4f, 0x46, 0x32, 1, 2, 3, 4]);

/** A miniature `vite build` output; `over` replaces/adds files (null deletes). */
function dist(over = {}) {
  const d = mkdtempSync(join(tmpdir(), 'singlefile-'));
  dirs.push(d);
  const files = {
    'index.html': `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>T</title>
    <link rel="icon" type="image/svg+xml" href="./favicon.svg" />
    <script type="module" crossorigin src="./assets/index-abc.js"></script>
    <link rel="stylesheet" crossorigin href="./assets/index-abc.css">
  </head>
  <body>
    <div id="app"></div>
  </body>
</html>
`,
    'favicon.svg': '<svg xmlns="http://www.w3.org/2000/svg"/>',
    'assets/index-abc.js': 'const a = "$& $1 $` $\' $$"; document.title = "</script>" + a;',
    'assets/index-abc.css':
      '@font-face{font-family:F;src:url(./f-1.woff2)format("woff2"),url(./f-1.woff)format("woff")}body{background:url(#g)}',
    'assets/f-1.woff2': FONT,
    'assets/f-1.woff': Buffer.from([9, 9]),
    ...over,
  };
  for (const [name, content] of Object.entries(files)) {
    if (content === null) continue;
    mkdirSync(join(d, name, '..'), { recursive: true });
    writeFileSync(join(d, name), content);
  }
  return d;
}

function pack(d, opts) {
  const out = join(d, 'out.html');
  packSingleFile(d, out, opts);
  return readFileSync(out, 'utf8');
}

describe('single-file packer', () => {
  it('inlines script, styles, fonts and icon', () => {
    const html = pack(dist(), { banner: 'Licences — © someone' });
    expect(html).not.toMatch(/\.\/assets\//);
    expect(html).toContain(`url("data:font/woff2;base64,${FONT.toString('base64')}")`);
    expect(html).not.toContain('woff)'); // fallback dropped
    expect(html).toContain('url(#g)');
    expect(html).toMatch(/<link rel="icon" type="image\/svg\+xml" href="data:image\/svg\+xml;base64,/);
    expect(html).toMatch(/<script type="module">/);
    expect(html).not.toContain('crossorigin');
  });

  it('keeps $-sequences and escapes </script', () => {
    const html = pack(dist());
    expect(html).toContain('"$& $1 $` $\' $$"');
    expect(html).toContain('"<\\/script>"');
    expect(html.match(/<\/script>/g)).toHaveLength(1);
  });

  it('puts the module script at the end of <body> and adds a visible noscript', () => {
    const html = pack(dist());
    expect(html.indexOf('<div id="app">')).toBeLessThan(html.indexOf('<script type="module">'));
    expect(html).toMatch(/<noscript><div style="position:fixed;inset:0;z-index:1000/);
  });

  it('keeps <meta charset> within the first 1024 bytes and the banner after it', () => {
    const html = pack(dist(), { banner: 'x'.repeat(5000) });
    expect(Buffer.from(html).indexOf('charset')).toBeLessThan(1024);
    expect(html.indexOf('<meta charset')).toBeLessThan(html.indexOf('xxxxx'));
    expect(() => pack(dist(), { banner: 'oops --> here' })).toThrow(/comment terminator/);
  });

  it.each([
    ['a code-split chunk', { 'assets/index-abc.js': 'import{a}from"./vendor-x.js";a()', 'assets/vendor-x.js': 'export const a=1' }, /code-split/],
    ['a dynamic import', { 'assets/index-abc.js': 'import(`./lazy-x.js`)' }, /dynamic import/],
    ['an asset loaded at runtime', { 'assets/index-abc.js': 'new URL(`big-x.png`,import.meta.url)', 'assets/big-x.png': 'png' }, /import\.meta\.url/],
    ['an unreferenced emitted asset', { 'assets/stray-x.png': 'png' }, /would be missing/],
    ['a remote stylesheet', { 'index.html': '<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="https://fonts.example/x.css"></head><body></body></html>', 'assets/index-abc.js': null, 'assets/index-abc.css': null, 'assets/f-1.woff2': null, 'assets/f-1.woff': null }, /internet/],
    ['a remote font in CSS', { 'assets/index-abc.css': '@font-face{src:url(https://cdn.example/f.woff2)}' }, /internet/],
    ['a CSS @import', { 'assets/index-abc.css': '@import "./other.css";' }, /@import/],
    ['a modulepreload link', { 'index.html': '<!doctype html><html><head><meta charset="utf-8"><link rel="modulepreload" href="./assets/index-abc.js"></head><body></body></html>' }, /code-split/],
    ['an image still pointing at a file', { 'index.html': '<!doctype html><html><head><meta charset="utf-8"></head><body><img src="./favicon.svg"></body></html>', 'assets/index-abc.js': null, 'assets/index-abc.css': null, 'assets/f-1.woff2': null, 'assets/f-1.woff': null }, /still points at/],
    ['a missing referenced file', { 'favicon.svg': null }, /missing file/],
    ['no </body>', { 'index.html': '<!doctype html><html><head><meta charset="utf-8"></head>' }, /<\/body>/],
  ])('refuses %s', (_name, over, err) => {
    expect(() => pack(dist(over))).toThrow(err);
  });

  it('keeps quoted data: URIs with parentheses, SVG fragments and stylesheet media', () => {
    const svg = `url("data:image/svg+xml,%3Csvg transform='rotate(45)'%3E%3C/svg%3E")`;
    const html = pack(
      dist({
        'index.html': `<!doctype html><html><head><meta charset="utf-8"><script type="module" src="./assets/index-abc.js"></script><link rel="stylesheet" href="./assets/index-abc.css" media="screen and (min-width: 1px)"><link rel="stylesheet" href="./assets/print.css" media="print"></head><body></body></html>`,
        'assets/index-abc.css': `a{background:${svg}}b{mask:url(./sprite.svg#star)}`,
        'assets/sprite.svg': '<svg/>',
        'assets/print.css': 'body{display:none}',
        'assets/f-1.woff2': null,
        'assets/f-1.woff': null,
        'favicon.svg': null,
      }),
    );
    expect(html).toContain(svg);
    expect(html).toMatch(/url\("data:image\/svg\+xml;base64,[A-Za-z0-9+/=]+#star"\)/);
    expect(html).toContain('<style media="print">body{display:none}</style>');
    expect(html).toContain('<style media="screen and (min-width: 1px)">');
  });

  it('declares the charset first even when the source has none', () => {
    const html = pack(dist({ 'index.html': '<!doctype html><html><head><title>t</title><script type="module" src="./assets/index-abc.js"></script><link rel="stylesheet" href="./assets/index-abc.css"></head><body></body></html>', 'favicon.svg': null }));
    expect(html).toMatch(/<head>\n    <meta charset="UTF-8" \/>/);
    expect(html.match(/charset/g)).toHaveLength(1);
  });

  it('injects the game before the real </body>, not one inside a classic script', () => {
    const html = pack(dist({ 'index.html': '<!doctype html><html><head><meta charset="utf-8"><script type="module" src="./assets/index-abc.js"></script><link rel="stylesheet" href="./assets/index-abc.css"><link rel="icon" href="./favicon.svg"></head><body><script>var s = "</body>";</script></body></html>' }));
    expect(html.indexOf('var s = "</body>"')).toBeLessThan(html.indexOf('<script type="module">'));
    expect(html.trimEnd().endsWith('</body></html>')).toBe(true);
  });

  it('drops hint/PWA links and ignores sourcemaps, dotfiles and look-alike names', () => {
    const html = pack(
      dist({
        'index.html': `<!doctype html><html><head><meta charset="utf-8"><link rel="manifest" href="./site.webmanifest"><link rel="preload" as="font" href="./assets/f-1.woff2"><script type="module" src="./assets/index-abc.js"></script><link rel="stylesheet" href="./assets/index-abc.css"><link rel="icon" href="./favicon.svg"></head><body></body></html>`,
        'site.webmanifest': '{}',
        'assets/index-abc.js': 'const t = "Customs: the import (smuggled spices) came from \\"/dev/lab\\" via button.png";',
        'assets/index-abc.js.map': '{}',
        'assets/.DS_Store': 'x',
        'on.png': 'png',
      }),
    );
    expect(html).not.toContain('manifest');
    expect(html).not.toContain('rel="preload"');
  });

  it.each([
    ['a remote ES import', { 'assets/index-abc.js': 'import{a}from"https://cdn.example/x.js";a()' }, /internet/],
    ['an import map', { 'index.html': '<!doctype html><html><head><meta charset="utf-8"><script type="importmap">{}</script></head><body></body></html>' }, /import map/],
    ['an image-set() string', { 'assets/index-abc.css': 'a{background:image-set("./bg.png" 1x)}', 'assets/bg.png': 'png' }, /still references/],
    ['an alternate stylesheet', { 'index.html': '<!doctype html><html><head><meta charset="utf-8"><link rel="alternate stylesheet" href="./assets/index-abc.css"></head><body></body></html>' }, /alternate/],
    ['a <use> pointing at a sprite file', { 'index.html': '<!doctype html><html><head><meta charset="utf-8"><script type="module" src="./assets/index-abc.js"></script><link rel="stylesheet" href="./assets/index-abc.css"><link rel="icon" href="./favicon.svg"></head><body><svg><use href="./favicon.svg#x"></use></svg></body></html>' }, /still points at/],
  ])('refuses %s', (_name, over, err) => {
    expect(() => pack(dist(over))).toThrow(err);
  });

  it('ignores non-fetching links and schemes', () => {
    const html = pack(
      dist({
        'index.html': `<!doctype html><html><head><meta charset="utf-8"><link rel="canonical" href="https://example.com/"><script type="module" src="./assets/index-abc.js"></script><link rel="stylesheet" href="./assets/index-abc.css"></head><body><a href="mailto:a@b.c">m</a><a href="tel:1">t</a><a href="#top">x</a></body></html>`,
        'favicon.svg': null,
      }),
    );
    expect(html).toContain('rel="canonical"');
  });
});
