// Inline SVG icon set (cartoon style with ink outlines). No emoji / font dependency.

const S = (body: string, vb = 64) => `<svg viewBox="0 0 ${vb} ${vb}" xmlns="http://www.w3.org/2000/svg" stroke-linejoin="round" stroke-linecap="round">${body}</svg>`;
const INK = '#22223b';

export const ICONS: Record<string, string> = {
  coin: S(`<circle cx="32" cy="32" r="26" fill="#ffd23f" stroke="${INK}" stroke-width="5"/><circle cx="32" cy="32" r="17" fill="none" stroke="#e0a800" stroke-width="4"/><path d="M32 21v22M26 26h9a4 4 0 0 1 0 8h-6a4 4 0 0 0 0 8h9" fill="none" stroke="${INK}" stroke-width="4"/>`),
  star: S(`<path d="M32 5l8 17 18 2-13 12 4 18-17-9-17 9 4-18L6 24l18-2z" fill="#ffd23f" stroke="${INK}" stroke-width="5"/><path d="M24 25l5-1" stroke="#fff" stroke-width="4" opacity=".8"/>`),
  starEmpty: S(`<path d="M32 5l8 17 18 2-13 12 4 18-17-9-17 9 4-18L6 24l18-2z" fill="#c9c6bd" stroke="${INK}" stroke-width="5"/>`),
  heart: S(`<path d="M32 56S6 40 6 22a13 13 0 0 1 26-4 13 13 0 0 1 26 4c0 18-26 34-26 34z" fill="#ff5a5f" stroke="${INK}" stroke-width="5"/><path d="M15 20a6 6 0 0 1 6-5" stroke="#fff" stroke-width="4" fill="none" opacity=".8"/>`),
  clock: S(`<circle cx="32" cy="34" r="24" fill="#fff" stroke="${INK}" stroke-width="5"/><path d="M32 20v15l9 6" stroke="${INK}" stroke-width="5" fill="none"/><path d="M24 6h16M32 6v5" stroke="${INK}" stroke-width="5"/>`),
  pause: S(`<rect x="15" y="12" width="12" height="40" rx="4" fill="#fff" stroke="${INK}" stroke-width="4"/><rect x="37" y="12" width="12" height="40" rx="4" fill="#fff" stroke="${INK}" stroke-width="4"/>`),
  play: S(`<path d="M20 10l34 22-34 22z" fill="#fff" stroke="${INK}" stroke-width="5"/>`),
  back: S(`<path d="M38 12L18 32l20 20" fill="none" stroke="#fff" stroke-width="9"/><path d="M38 12L18 32l20 20" fill="none" stroke="${INK}" stroke-width="3" opacity=".25"/>`),
  close: S(`<path d="M16 16l32 32M48 16L16 48" stroke="#fff" stroke-width="9"/>`),
  check: S(`<path d="M12 34l13 13 27-29" fill="none" stroke="#fff" stroke-width="9"/>`),
  lock: S(`<rect x="12" y="28" width="40" height="30" rx="7" fill="#ffd23f" stroke="${INK}" stroke-width="5"/><path d="M21 28v-8a11 11 0 0 1 22 0v8" fill="none" stroke="${INK}" stroke-width="5"/><circle cx="32" cy="42" r="4" fill="${INK}"/>`),
  cart: S(`<path d="M6 10h8l7 30h30l6-22H17" fill="#fff" stroke="${INK}" stroke-width="5"/><circle cx="25" cy="52" r="5" fill="${INK}"/><circle cx="47" cy="52" r="5" fill="${INK}"/>`),
  brain: S(`<path d="M32 10c-6-5-17-2-17 7-7 1-10 10-5 15-4 6 1 15 9 14 2 6 10 8 13 3 3 5 11 3 13-3 8 1 13-8 9-14 5-5 2-14-5-15 0-9-11-12-17-7z" fill="#ff9fc6" stroke="${INK}" stroke-width="5"/><path d="M32 12v40M22 24c4 2 6 6 4 10M42 24c-4 2-6 6-4 10" stroke="${INK}" stroke-width="3.5" fill="none"/>`),
  book: S(`<path d="M8 12c8-3 16-3 24 3 8-6 16-6 24-3v40c-8-3-16-3-24 3-8-6-16-6-24-3z" fill="#4da6ff" stroke="${INK}" stroke-width="5"/><path d="M32 15v40" stroke="${INK}" stroke-width="4"/><path d="M15 22c4-1 8-1 11 1M15 30c4-1 8-1 11 1M38 23c3-2 7-2 11-1" stroke="#fff" stroke-width="3"/>`),
  gear: S(`<path d="M28 6h8l1 7 6 3 6-4 6 6-4 6 3 6 7 1v8l-7 1-3 6 4 6-6 6-6-4-6 3-1 7h-8l-1-7-6-3-6 4-6-6 4-6-3-6-7-1v-8l7-1 3-6-4-6 6-6 6 4 6-3z" fill="#9aa3b2" stroke="${INK}" stroke-width="4.5"/><circle cx="32" cy="32" r="9" fill="#fff" stroke="${INK}" stroke-width="4.5"/>`),
  gift: S(`<rect x="8" y="26" width="48" height="30" rx="5" fill="#ff5a5f" stroke="${INK}" stroke-width="5"/><rect x="5" y="17" width="54" height="12" rx="4" fill="#ff7b80" stroke="${INK}" stroke-width="5"/><path d="M32 17v39" stroke="#ffd23f" stroke-width="7"/><path d="M32 17c-4-10-16-12-14-3 1 4 9 3 14 3 5 0 13 1 14-3 2-9-10-7-14 3z" fill="#ffd23f" stroke="${INK}" stroke-width="4"/>`),
  bolt: S(`<path d="M36 4L12 36h16l-6 24 26-34H32z" fill="#ffd23f" stroke="${INK}" stroke-width="5"/>`),
  calendar: S(`<rect x="8" y="12" width="48" height="44" rx="7" fill="#fff" stroke="${INK}" stroke-width="5"/><path d="M8 24h48" stroke="${INK}" stroke-width="5"/><rect x="8" y="12" width="48" height="12" rx="6" fill="#ff5a5f" stroke="${INK}" stroke-width="5"/><path d="M20 6v10M44 6v10" stroke="${INK}" stroke-width="5"/><path d="M22 40l7 7 14-14" fill="none" stroke="#21c7a8" stroke-width="6"/>`),
  music: S(`<path d="M24 46V14l28-6v32" fill="none" stroke="${INK}" stroke-width="5"/><circle cx="18" cy="46" r="8" fill="#7b5cff" stroke="${INK}" stroke-width="5"/><circle cx="46" cy="40" r="8" fill="#7b5cff" stroke="${INK}" stroke-width="5"/>`),
  speaker: S(`<path d="M8 24h12l14-12v40L20 40H8z" fill="#fff" stroke="${INK}" stroke-width="5"/><path d="M42 22c5 5 5 15 0 20M48 16c9 9 9 23 0 32" fill="none" stroke="${INK}" stroke-width="5"/>`),
  ad: S(`<rect x="6" y="12" width="52" height="36" rx="7" fill="#ffd23f" stroke="${INK}" stroke-width="5"/><path d="M27 22l12 8-12 8z" fill="${INK}"/><path d="M22 54h20" stroke="${INK}" stroke-width="5"/>`),
  trophy: S(`<path d="M18 8h28v14a14 14 0 0 1-28 0z" fill="#ffd23f" stroke="${INK}" stroke-width="5"/><path d="M18 14H8c0 10 6 14 12 14M46 14h10c0 10-6 14-12 14" fill="none" stroke="${INK}" stroke-width="5"/><path d="M32 36v10M20 56h24l-3-10H23z" fill="#ffd23f" stroke="${INK}" stroke-width="5"/>`),
  map: S(`<path d="M6 14l16-6 20 6 16-6v42l-16 6-20-6-16 6z" fill="#7bed9f" stroke="${INK}" stroke-width="5"/><path d="M22 8v42M42 14v42" stroke="${INK}" stroke-width="4"/><circle cx="32" cy="30" r="5" fill="#ff5a5f" stroke="${INK}" stroke-width="3"/>`),
  replay: S(`<path d="M50 32a18 18 0 1 1-6-13" fill="none" stroke="#fff" stroke-width="8"/><path d="M50 8v14H36" fill="none" stroke="#fff" stroke-width="8"/>`),
  next: S(`<path d="M14 12l20 20-20 20M32 12l20 20-20 20" fill="none" stroke="#fff" stroke-width="8"/>`),
  infinity: S(`<path d="M32 32c-6-8-11-12-17-12a12 12 0 0 0 0 24c6 0 11-4 17-12s11-12 17-12a12 12 0 0 1 0 24c-6 0-11-4-17-12z" fill="none" stroke="${INK}" stroke-width="6"/><path d="M32 32c-6-8-11-12-17-12a12 12 0 0 0 0 24c6 0 11-4 17-12s11-12 17-12a12 12 0 0 1 0 24c-6 0-11-4-17-12z" fill="none" stroke="#ffd23f" stroke-width="3"/>`),
  home: S(`<path d="M8 30L32 10l24 20v26H8z" fill="#ff9f43" stroke="${INK}" stroke-width="5"/><rect x="26" y="38" width="12" height="18" fill="#fff" stroke="${INK}" stroke-width="4"/>`),
  badge: S(`<path d="M32 6l20 8v16c0 14-9 22-20 28-11-6-20-14-20-28V14z" fill="#4b7bec" stroke="${INK}" stroke-width="5"/><path d="M32 18l4 8 9 1-7 6 2 9-8-5-8 5 2-9-7-6 9-1z" fill="#ffd23f" stroke="${INK}" stroke-width="3"/>`),
  apple: S(`<path d="M32 18c-8-6-24-4-24 14 0 14 10 26 17 26 3 0 4-2 7-2s4 2 7 2c7 0 17-12 17-26 0-18-16-20-24-14z" fill="#26de81" stroke="${INK}" stroke-width="5"/><path d="M32 18c0-6 2-10 8-12" fill="none" stroke="${INK}" stroke-width="5"/>`),
  leaf: S(`<path d="M10 54C10 26 26 10 56 8c-2 30-18 46-46 46z" fill="#20bf6b" stroke="${INK}" stroke-width="5"/><path d="M10 54L40 24" stroke="${INK}" stroke-width="4"/>`),
  secret: S(`<path d="M6 14h18l5 6h29v34H6z" fill="#a55eea" stroke="${INK}" stroke-width="5"/><rect x="14" y="30" width="36" height="14" rx="3" fill="#ff5a5f" stroke="${INK}" stroke-width="4" transform="rotate(-12 32 37)"/><path d="M20 37h24" stroke="#fff" stroke-width="3.5" transform="rotate(-12 32 37)"/>`),
  rat: S(`<ellipse cx="34" cy="40" rx="20" ry="15" fill="#b8b2c4" stroke="${INK}" stroke-width="4.5"/><circle cx="18" cy="30" r="12" fill="#b8b2c4" stroke="${INK}" stroke-width="4.5"/><circle cx="12" cy="18" r="7" fill="#ff9fb6" stroke="${INK}" stroke-width="4"/><circle cx="26" cy="17" r="7" fill="#ff9fb6" stroke="${INK}" stroke-width="4"/><circle cx="15" cy="30" r="2.5" fill="${INK}"/><circle cx="7" cy="35" r="3" fill="#ff9fb6"/><path d="M54 44c8 2 8 10 2 12" fill="none" stroke="#ff9fb6" stroke-width="4"/>`),
  // items
  espresso: S(`<path d="M12 22h34v14a17 17 0 0 1-34 0z" fill="#fff" stroke="${INK}" stroke-width="5"/><path d="M46 26h4a7 7 0 0 1 0 14h-6" fill="none" stroke="${INK}" stroke-width="5"/><ellipse cx="29" cy="24" rx="14" ry="3" fill="#8b5a2b"/><path d="M22 6c-3 4 3 6 0 10M32 4c-3 4 3 6 0 10" stroke="#9aa3b2" stroke-width="3.5" fill="none"/><path d="M8 58h44" stroke="${INK}" stroke-width="5"/>`),
  hint: S(`<path d="M32 6a18 18 0 0 0-10 33v7h20v-7A18 18 0 0 0 32 6z" fill="#ffd23f" stroke="${INK}" stroke-width="5"/><path d="M24 52h16M27 58h10" stroke="${INK}" stroke-width="5"/><path d="M26 18a8 8 0 0 1 8-4" stroke="#fff" stroke-width="4" fill="none"/>`),
  extinguisher: S(`<rect x="20" y="18" width="20" height="40" rx="8" fill="#ff4d4d" stroke="${INK}" stroke-width="5"/><path d="M26 18v-6h8v6M34 10h12l6 6" fill="none" stroke="${INK}" stroke-width="5"/><rect x="24" y="30" width="12" height="12" rx="2" fill="#fff" stroke="${INK}" stroke-width="3"/>`),
  firstaid: S(`<rect x="8" y="16" width="48" height="38" rx="8" fill="#2ed573" stroke="${INK}" stroke-width="5"/><path d="M24 16v-6h16v6" fill="none" stroke="${INK}" stroke-width="5"/><path d="M32 25v20M22 35h20" stroke="#fff" stroke-width="7"/>`),
  // substance states
  st_powder: S(`<path d="M6 50c4-18 14-26 26-26s22 8 26 26z" fill="currentColor" stroke="${INK}" stroke-width="4"/><circle cx="18" cy="20" r="3" fill="currentColor" stroke="${INK}" stroke-width="2"/><circle cx="46" cy="16" r="2.5" fill="currentColor" stroke="${INK}" stroke-width="2"/>`),
  st_crystals: S(`<path d="M18 52l-6-18 8-16 10 10-2 24zM30 52l2-28 12-14 10 16-6 26z" fill="currentColor" stroke="${INK}" stroke-width="4"/>`),
  st_liquid: S(`<path d="M18 6h28M22 6v16L10 52a6 6 0 0 0 6 8h32a6 6 0 0 0 6-8L42 22V6" fill="#fff" fill-opacity=".5" stroke="${INK}" stroke-width="4.5"/><path d="M15 42h34l5 10a6 6 0 0 1-6 8H16a6 6 0 0 1-6-8z" fill="currentColor"/><path d="M22 6v16L10 52a6 6 0 0 0 6 8h32a6 6 0 0 0 6-8L42 22V6" fill="none" stroke="${INK}" stroke-width="4.5"/>`),
  st_gel: S(`<rect x="12" y="20" width="40" height="38" rx="8" fill="#fff" fill-opacity=".5" stroke="${INK}" stroke-width="4.5"/><path d="M14 36c6-4 10 4 18 0s12-4 18 0v14a6 6 0 0 1-6 6H20a6 6 0 0 1-6-6z" fill="currentColor"/><rect x="10" y="10" width="44" height="10" rx="4" fill="#ffb627" stroke="${INK}" stroke-width="4.5"/><rect x="12" y="20" width="40" height="38" rx="8" fill="none" stroke="${INK}" stroke-width="4.5"/>`),
  st_gas: S(`<rect x="18" y="16" width="28" height="44" rx="12" fill="#9aa7b8" stroke="${INK}" stroke-width="4.5"/><rect x="18" y="26" width="28" height="9" fill="#ffd23f" stroke="${INK}" stroke-width="3"/><path d="M28 16V8h8v8M24 6h16" stroke="${INK}" stroke-width="4.5" fill="none"/>`),
  st_metal: S(`<path d="M8 44l10-16h38l-10 16z" fill="currentColor" stroke="${INK}" stroke-width="4"/><path d="M8 44v8h38l10-16v-8M46 44v8" fill="currentColor" stroke="${INK}" stroke-width="4"/><path d="M22 33h14" stroke="#fff" stroke-width="3" opacity=".7"/>`),
  st_chunk: S(`<path d="M10 40l6-20 18-10 18 8 4 22-16 14-22-2z" fill="currentColor" stroke="${INK}" stroke-width="4"/><path d="M20 26l10-6" stroke="#fff" stroke-width="3" opacity=".6"/>`),
  question: S(`<circle cx="32" cy="32" r="26" fill="#fff" stroke="${INK}" stroke-width="5"/><path d="M24 24a8 8 0 1 1 12 7c-3 2-4 3-4 7" fill="none" stroke="${INK}" stroke-width="6"/><circle cx="32" cy="47" r="4" fill="${INK}"/>`),
};

// ── tool icons ──
export const TOOL_ICONS: Record<string, string> = {
  ph: S(`<rect x="24" y="4" width="16" height="56" rx="4" fill="#fff" stroke="${INK}" stroke-width="4.5"/><rect x="24" y="40" width="16" height="20" rx="4" fill="#fb8c00" stroke="${INK}" stroke-width="4.5"/><rect x="8" y="12" width="10" height="8" rx="2" fill="#e53935" stroke="${INK}" stroke-width="3"/><rect x="8" y="24" width="10" height="8" rx="2" fill="#43a047" stroke="${INK}" stroke-width="3"/><rect x="46" y="12" width="10" height="8" rx="2" fill="#1e88e5" stroke="${INK}" stroke-width="3"/><rect x="46" y="24" width="10" height="8" rx="2" fill="#7b1fa2" stroke="${INK}" stroke-width="3"/>`),
  sniff: S(`<path d="M30 8c-4 14-12 24-12 34 0 8 6 12 12 12h8c6 0 10-4 10-9 0-6-6-8-10-6" fill="#f2c29e" stroke="${INK}" stroke-width="4.5"/><circle cx="30" cy="47" r="3" fill="${INK}"/><path d="M50 12c4 3 0 6 4 9M56 4c4 3 0 6 4 9" stroke="#21c7a8" stroke-width="4" fill="none"/>`),
  flame: S(`<path d="M32 4c4 12 18 18 18 34a18 18 0 0 1-36 0c0-10 6-14 8-22 4 6 4 10 8 12 2-8 0-16 2-24z" fill="#ff7b00" stroke="${INK}" stroke-width="4.5"/><path d="M32 30c3 6 9 9 9 16a9 9 0 0 1-18 0c0-5 4-7 5-12 2 3 3 4 4-4z" fill="#ffd23f"/>`),
  microscope: S(`<path d="M8 58h40M18 58c0-10 6-16 16-16" fill="none" stroke="${INK}" stroke-width="5"/><rect x="26" y="6" width="12" height="28" rx="3" fill="#4da6ff" stroke="${INK}" stroke-width="4.5" transform="rotate(-25 32 20)"/><rect x="24" y="40" width="22" height="6" rx="2" fill="#2b2d42"/><path d="M44 26c8 6 10 18 2 26" fill="none" stroke="${INK}" stroke-width="5"/>`),
  reagent: S(`<path d="M26 4h12v10l12 30a8 8 0 0 1-7 12H21a8 8 0 0 1-7-12l12-30z" fill="#fff" fill-opacity=".6" stroke="${INK}" stroke-width="4.5"/><path d="M18 38h28l4 8a8 8 0 0 1-7 10H21a8 8 0 0 1-7-10z" fill="currentColor"/><path d="M26 4h12v10l12 30a8 8 0 0 1-7 12H21a8 8 0 0 1-7-12l12-30z" fill="none" stroke="${INK}" stroke-width="4.5"/><circle cx="54" cy="12" r="4" fill="currentColor" stroke="${INK}" stroke-width="3"/>`),
  conduct: S(`<circle cx="32" cy="24" r="16" fill="#fff59d" stroke="${INK}" stroke-width="4.5"/><path d="M26 22l4 6 4-6 4 6" fill="none" stroke="#ff9f43" stroke-width="3.5"/><rect x="24" y="40" width="16" height="10" rx="2" fill="#9aa3b2" stroke="${INK}" stroke-width="4.5"/><path d="M28 50v8M36 50v8" stroke="${INK}" stroke-width="4.5"/>`),
  magnet: S(`<path d="M12 8h14v22a6 6 0 0 0 12 0V8h14v22a20 20 0 0 1-40 0z" fill="#e63946" stroke="${INK}" stroke-width="4.5"/><rect x="12" y="8" width="14" height="10" fill="#dfe4ea" stroke="${INK}" stroke-width="4.5"/><rect x="38" y="8" width="14" height="10" fill="#dfe4ea" stroke="${INK}" stroke-width="4.5"/>`),
  uv: S(`<rect x="8" y="10" width="48" height="16" rx="6" fill="#2b2d42" stroke="${INK}" stroke-width="4.5"/><rect x="14" y="22" width="36" height="6" rx="3" fill="#b388ff"/><path d="M18 34l-4 10M32 34v12M46 34l4 10M25 34l-2 14M39 34l2 14" stroke="#b388ff" stroke-width="4"/>`),
  density: S(`<path d="M10 46h44l-4 12H14z" fill="#e6e9ef" stroke="${INK}" stroke-width="4.5"/><rect x="20" y="49" width="24" height="6" rx="1" fill="#2b2d42"/><ellipse cx="32" cy="44" rx="18" ry="4" fill="#c9ced6" stroke="${INK}" stroke-width="4"/><path d="M26 16h12v6l6 16H20l6-16z" fill="#4da6ff" stroke="${INK}" stroke-width="4"/>`),
  splint: S(`<path d="M10 54L44 20" stroke="#d4a373" stroke-width="8"/><path d="M10 54L44 20" stroke="${INK}" stroke-width="2" opacity=".3"/><circle cx="46" cy="18" r="6" fill="#ff7b00" stroke="${INK}" stroke-width="3.5"/><path d="M52 8l2-4M56 14l5-1M44 6l-1-4" stroke="#ffd23f" stroke-width="4"/>`),
  geiger: S(`<rect x="6" y="18" width="40" height="34" rx="6" fill="#ffd23f" stroke="${INK}" stroke-width="4.5"/><path d="M14 38a12 12 0 0 1 24 0" fill="#fff" stroke="${INK}" stroke-width="3.5"/><path d="M26 38l7-8" stroke="#e63946" stroke-width="3.5"/><path d="M46 28h8v-12" fill="none" stroke="${INK}" stroke-width="4.5"/><rect x="50" y="6" width="8" height="14" rx="3" fill="#2b2d42"/>`),
  massspec: S(`<rect x="6" y="8" width="52" height="48" rx="7" fill="#eef1f5" stroke="${INK}" stroke-width="4.5"/><rect x="12" y="14" width="40" height="26" rx="3" fill="#0d2b2a"/><path d="M14 36h6l3-4 3 4h4l4-18 4 18h12" fill="none" stroke="#7dffb2" stroke-width="3"/><circle cx="18" cy="48" r="3" fill="#ff4d4d"/><circle cx="28" cy="48" r="3" fill="#2ecc71"/>`),
};

export function icon(name: string): string {
  return ICONS[name] ?? TOOL_ICONS[name] ?? ICONS.question;
}

export function toolIcon(id: string, reagentColor?: string): string {
  if (['iodine', 'acid', 'agno3', 'naoh', 'bacl2', 'luminol'].includes(id)) {
    return `<span class="tool-ico" style="color:${reagentColor ?? '#fff'}">${TOOL_ICONS.reagent}</span>`;
  }
  return `<span class="tool-ico">${TOOL_ICONS[id] ?? ICONS.question}</span>`;
}

export function stateIcon(state: string, color: string): string {
  return `<span style="color:${color};display:contents">${ICONS['st_' + state] ?? ICONS.question}</span>`;
}
