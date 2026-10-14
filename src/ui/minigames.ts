import { audio } from '../core/audio';
import { clamp } from '../core/util';
import { DT_CAP } from '../config';
import type { Crystal, Substance, ToolDef } from '../data/types';
import { UV_INFO } from '../data/tools';
import type { Quality } from '../game/shift';
import { toolIcon } from './icons';

export interface MinigameOpts {
  tool: ToolDef;
  sub: Substance;
  /** sweet-spot multiplier from skills/upgrades */
  zoneMul: number;
  /** 0..1 */
  difficulty: number;
  firstTime: boolean;
  /** lucky charm chance to convert a miss */
  lucky: number;
}

type Ctx = CanvasRenderingContext2D;

const INK = '#22223b';

function setupCanvas(area: HTMLElement): { c: HTMLCanvasElement; g: Ctx; w: number; h: number } {
  const c = document.createElement('canvas');
  area.appendChild(c);
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = area.clientWidth || 400;
  const h = area.clientHeight || 96;
  c.width = Math.round(w * dpr);
  c.height = Math.round(h * dpr);
  const g = c.getContext('2d')!;
  g.scale(dpr, dpr);
  return { c, g, w, h };
}

function rr(g: Ctx, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** Input helper: tap (pointer/space), hold state, drag x. */
class Input {
  onTap: () => void = () => {};
  holding = false;
  dragX = 0.5;
  dragY = 0.5;
  dragging = false;
  private cleanups: (() => void)[] = [];
  constructor(private area: HTMLElement, catcher: HTMLElement) {
    const down = (e: PointerEvent) => {
      if (paused) return;
      e.preventDefault();
      this.holding = true;
      this.dragging = true;
      this.updateDrag(e);
      this.onTap();
    };
    const up = () => {
      this.holding = false;
      this.dragging = false;
    };
    const move = (e: PointerEvent) => {
      if (this.dragging || e.pointerType === 'mouse') this.updateDrag(e);
    };
    const key = (e: KeyboardEvent) => {
      if (paused) return;
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        if (e.type === 'keydown') {
          if (!e.repeat) {
            this.holding = true;
            this.onTap();
          }
        } else this.holding = false;
      }
      if (e.type === 'keydown' && (e.code === 'ArrowLeft' || e.code === 'ArrowRight')) {
        this.dragX = clamp(this.dragX + (e.code === 'ArrowLeft' ? -0.04 : 0.04), 0, 1);
      }
    };
    for (const el of [area, catcher]) {
      el.addEventListener('pointerdown', down);
      this.cleanups.push(() => el.removeEventListener('pointerdown', down));
    }
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    window.addEventListener('pointermove', move);
    window.addEventListener('keydown', key);
    window.addEventListener('keyup', key);
    this.cleanups.push(() => {
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('keydown', key);
      window.removeEventListener('keyup', key);
    });
  }
  private updateDrag(e: PointerEvent) {
    const r = this.area.getBoundingClientRect();
    this.dragX = clamp((e.clientX - r.left) / r.width, 0, 1);
    this.dragY = clamp((e.clientY - r.top) / r.height, 0, 1);
  }
  dispose() {
    this.cleanups.forEach((f) => f());
  }
}

const AUTOTEST = import.meta.env.DEV && typeof location !== 'undefined' && /[?&]autotest=1/.test(location.search);
let paused = false;
let currentArea: HTMLElement | null = null;

/** Freeze mini-games while the pause menu or an ad is on screen. */
export function setMinigamePaused(p: boolean): void {
  paused = p;
}

function loop(fn: (dt: number, t: number) => boolean | void): Promise<void> {
  return new Promise((resolve) => {
    let last = performance.now();
    let t = 0;
    const area = currentArea;
    const step = () => {
      const now = performance.now();
      const dt = Math.min(DT_CAP, (now - last) / 1000);
      last = now;
      if (area && !area.isConnected) return resolve(); // panel was torn down (shift ended)
      if (paused) {
        requestAnimationFrame(step);
        return;
      }
      t += dt;
      if (fn(dt, t) === true) resolve();
      else requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

function params(o: MinigameOpts) {
  const d = o.difficulty;
  const good = clamp((0.3 - 0.12 * d) * o.zoneMul, 0.08, 0.62);
  return { good, perfect: good * 0.34, speed: 0.75 + 0.85 * d };
}

function judge(dist: number, good: number, perfect: number): Quality {
  if (dist <= perfect / 2) return 'perfect';
  if (dist <= good / 2) return 'good';
  return 'miss';
}

// ───────────────────────── games ─────────────────────────

/** Moving marker; tap inside the green zone. Skins: flame / gauge / bar / splint / scale */
async function timingGame(area: HTMLElement, input: Input, o: MinigameOpts): Promise<Quality> {
  const { g, w, h } = setupCanvas(area);
  const { good, perfect, speed } = params(o);
  const skin = o.tool.skin ?? 'bar';
  const center = 0.25 + Math.random() * 0.5;
  let p = Math.random() < 0.5 ? 0 : 1;
  let dir = p === 0 ? 1 : -1;
  let result: Quality | null = null;
  let sweeps = 0;
  input.onTap = () => {
    if (result) return;
    result = judge(Math.abs(p - center), good, perfect);
  };
  await loop((dt, t) => {
    if (skin === 'scale') {
      const amp = Math.max(0.16, 0.45 * Math.exp(-t * 0.35));
      p = center + Math.sin(t * Math.PI * 2 * speed * 0.9) * amp;
      if (t > 7) result = result ?? 'miss';
    } else {
      p += dir * dt * speed;
      if (p > 1) {
        p = 1;
        dir = -1;
        sweeps++;
      }
      if (p < 0) {
        p = 0;
        dir = 1;
        sweeps++;
      }
      if (sweeps >= 6) result = result ?? 'miss';
    }
    // draw
    g.clearRect(0, 0, w, h);
    if (skin === 'gauge' || skin === 'scale') {
      const cx = w / 2;
      const cy = h - 6;
      const R = Math.min(w / 2 - 20, h - 14);
      const a0 = Math.PI * 1.05;
      const a1 = Math.PI * 1.95;
      const ang = (k: number) => a0 + (a1 - a0) * k;
      g.lineWidth = 16;
      g.strokeStyle = '#e8e3d6';
      g.beginPath();
      g.arc(cx, cy, R, a0, a1);
      g.stroke();
      g.strokeStyle = '#7bed9f';
      g.beginPath();
      g.arc(cx, cy, R, ang(center - good / 2), ang(center + good / 2));
      g.stroke();
      g.strokeStyle = '#2ed573';
      g.beginPath();
      g.arc(cx, cy, R, ang(center - perfect / 2), ang(center + perfect / 2));
      g.stroke();
      g.strokeStyle = INK;
      g.lineWidth = 3;
      g.beginPath();
      g.arc(cx, cy, R + 9, a0, a1);
      g.stroke();
      const a = ang(clamp(p, 0, 1));
      g.lineWidth = 5;
      g.strokeStyle = '#e63946';
      g.beginPath();
      g.moveTo(cx, cy);
      g.lineTo(cx + Math.cos(a) * (R + 4), cy + Math.sin(a) * (R + 4));
      g.stroke();
      g.fillStyle = INK;
      g.beginPath();
      g.arc(cx, cy, 8, 0, Math.PI * 2);
      g.fill();
    } else {
      const x0 = 14;
      const bw = w - 28;
      const y0 = h / 2 - 16;
      const grad = g.createLinearGradient(x0, 0, x0 + bw, 0);
      if (skin === 'flame') {
        grad.addColorStop(0, '#6fa8ff');
        grad.addColorStop(0.5, '#ffd23f');
        grad.addColorStop(1, '#ff5a1f');
      } else if (skin === 'splint') {
        grad.addColorStop(0, '#5a3b20');
        grad.addColorStop(1, '#ff9a3c');
      } else {
        grad.addColorStop(0, '#dfe6ee');
        grad.addColorStop(1, '#b8c4d6');
      }
      g.fillStyle = grad;
      rr(g, x0, y0, bw, 32, 10);
      g.fill();
      g.fillStyle = 'rgba(46, 213, 115, 0.55)';
      g.fillRect(x0 + bw * (center - good / 2), y0, bw * good, 32);
      g.fillStyle = 'rgba(30, 166, 90, 0.95)';
      g.fillRect(x0 + bw * (center - perfect / 2), y0, bw * perfect, 32);
      g.lineWidth = 3;
      g.strokeStyle = INK;
      rr(g, x0, y0, bw, 32, 10);
      g.stroke();
      const mx = x0 + bw * clamp(p, 0, 1);
      g.fillStyle = '#fff';
      g.strokeStyle = INK;
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(mx, y0 - 4);
      g.lineTo(mx - 10, y0 - 18);
      g.lineTo(mx + 10, y0 - 18);
      g.closePath();
      g.fill();
      g.stroke();
      rr(g, mx - 4, y0 - 4, 8, 40, 3);
      g.fill();
      g.stroke();
    }
    return result !== null;
  });
  return result!;
}

/** Hold to fill, release inside the zone (pH dip, luminol spray). */
async function holdGame(area: HTMLElement, input: Input, o: MinigameOpts): Promise<Quality> {
  const { g, w, h } = setupCanvas(area);
  const { good, perfect, speed } = params(o);
  const center = 0.45 + Math.random() * 0.35;
  let fill = 0;
  let started = false;
  let result: Quality | null = null;
  let idle = 0;
  const spray = o.tool.id === 'luminol';
  input.onTap = () => {
    started = true;
  };
  await loop((dt) => {
    if (input.holding && !result) {
      started = true;
      fill += dt * (0.32 + fill * 0.9) * (0.8 + speed * 0.5);
      if (fill >= 1) {
        fill = 1;
        result = 'miss';
      }
    } else if (started && !result && fill > 0.02) {
      result = judge(Math.abs(fill - center), good, perfect);
    } else if (!started) {
      idle += dt;
      if (idle > 6) result = 'miss';
    }
    g.clearRect(0, 0, w, h);
    const x0 = 14;
    const bw = w - 28;
    const y0 = h / 2 - 18;
    g.fillStyle = '#efeadf';
    rr(g, x0, y0, bw, 36, 12);
    g.fill();
    g.fillStyle = 'rgba(46,213,115,0.45)';
    g.fillRect(x0 + bw * (center - good / 2), y0, bw * good, 36);
    g.fillStyle = 'rgba(30,166,90,0.9)';
    g.fillRect(x0 + bw * (center - perfect / 2), y0, bw * perfect, 36);
    const fg = g.createLinearGradient(x0, 0, x0 + bw, 0);
    if (spray) {
      fg.addColorStop(0, '#bfe3ff');
      fg.addColorStop(1, '#4da6ff');
    } else {
      fg.addColorStop(0, '#fff6b0');
      fg.addColorStop(1, '#fb8c00');
    }
    g.fillStyle = fg;
    g.globalAlpha = 0.85;
    rr(g, x0, y0 + 6, Math.max(12, bw * fill), 24, 9);
    g.fill();
    g.globalAlpha = 1;
    g.lineWidth = 3;
    g.strokeStyle = INK;
    rr(g, x0, y0, bw, 36, 12);
    g.stroke();
    g.fillStyle = INK;
    g.font = '700 14px Fredoka, sans-serif';
    g.textAlign = 'left';
    g.fillText(spray ? 'SPRAY' : 'DIP', x0 + 4, y0 - 6);
    return result !== null;
  });
  return result!;
}

/** Tap when each drop is the right size. */
async function dropsGame(area: HTMLElement, input: Input, o: MinigameOpts): Promise<Quality> {
  const { g, w, h } = setupCanvas(area);
  const { good, perfect, speed } = params(o);
  const n = o.difficulty > 0.45 ? 3 : 2;
  const results: Quality[] = [];
  let r = 0;
  let falling = -1;
  let fallY = 0;
  const maxR = Math.min(34, h * 0.36);
  const target = 0.6 + Math.random() * 0.2;
  const color = o.tool.reagentColor ?? '#9fe0ff';
  let done = false;
  input.onTap = () => {
    if (falling >= 0 || done) return;
    const k = r / maxR;
    results.push(judge(Math.abs(k - target), good * 1.1, perfect * 1.1));
    audio.play('drop', results.length);
    falling = r;
    fallY = 0;
    r = 0;
  };
  await loop((dt) => {
    if (falling < 0 && !done) {
      r += dt * maxR * (0.55 + speed * 0.45);
      if (r >= maxR) {
        results.push('miss');
        audio.play('miss');
        falling = r;
        fallY = 0;
        r = 0;
      }
    }
    if (falling >= 0) {
      fallY += dt * 380;
      if (fallY > h) {
        falling = -1;
        if (results.length >= n) done = true;
      }
    }
    g.clearRect(0, 0, w, h);
    const cx = w / 2;
    // dropper
    g.fillStyle = '#2b2d42';
    rr(g, cx - 14, -10, 28, 26, 6);
    g.fill();
    g.fillStyle = 'rgba(200,230,255,0.9)';
    g.strokeStyle = INK;
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(cx - 10, 14);
    g.lineTo(cx + 10, 14);
    g.lineTo(cx + 4, 30);
    g.lineTo(cx - 4, 30);
    g.closePath();
    g.fill();
    g.stroke();
    // target ring
    const ty = 30 + maxR * target + 4;
    g.setLineDash([5, 5]);
    g.strokeStyle = '#2ed573';
    g.lineWidth = 3;
    g.beginPath();
    g.arc(cx, ty, maxR * target, 0, Math.PI * 2);
    g.stroke();
    g.setLineDash([]);
    // growing drop
    if (falling < 0 && !done) {
      g.fillStyle = color;
      g.strokeStyle = INK;
      g.lineWidth = 3;
      g.beginPath();
      g.arc(cx, 30 + r + 2, Math.max(2, r), 0, Math.PI * 2);
      g.fill();
      g.stroke();
    } else if (falling >= 0) {
      g.fillStyle = color;
      g.beginPath();
      g.arc(cx, 30 + falling + fallY, Math.max(2, falling), 0, Math.PI * 2);
      g.fill();
    }
    // pips
    for (let i = 0; i < n; i++) {
      const q = results[i];
      g.fillStyle = q === 'perfect' ? '#1ea65a' : q === 'good' ? '#7bed9f' : q === 'miss' ? '#ff5a5f' : '#efeadf';
      g.strokeStyle = INK;
      g.lineWidth = 2;
      g.beginPath();
      g.arc(20 + i * 24, h - 18, 8, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    }
    return done;
  });
  const misses = results.filter((q) => q === 'miss').length;
  if (results.every((q) => q === 'perfect')) return 'perfect';
  if (misses >= Math.ceil(n / 2)) return 'miss';
  return 'good';
}

/** Gentle wafts: tap as the ring meets the circle. */
async function rhythmGame(area: HTMLElement, input: Input, o: MinigameOpts): Promise<Quality> {
  const { g, w, h } = setupCanvas(area);
  const { good, speed } = params(o);
  const beats = 3;
  const interval = 0.95 - speed * 0.12;
  const window = 0.09 + good * 0.42; // seconds
  const pwin = window * 0.38;
  const first = 0.9;
  const times = Array.from({ length: beats }, (_, i) => first + i * interval);
  const res: Quality[] = [];
  let t = 0;
  let extra = 0;
  let flashT = 0;
  input.onTap = () => {
    const i = res.length;
    if (i >= beats) return;
    const d = Math.abs(t - times[i]);
    if (d <= window) {
      res.push(d <= pwin ? 'perfect' : 'good');
      audio.play('sniff');
      flashT = 0.2;
    } else if (t < times[i] - window) {
      extra++;
      audio.play('miss');
    }
  };
  await loop((dt) => {
    t += dt;
    const i = res.length;
    if (i < beats && t > times[i] + window) {
      res.push('miss');
      audio.play('miss');
    }
    flashT = Math.max(0, flashT - dt);
    g.clearRect(0, 0, w, h);
    const cx = w / 2;
    const cy = h / 2;
    const R = Math.min(h / 2 - 8, 34);
    g.fillStyle = flashT > 0 ? '#c8ffd9' : '#f3fff8';
    g.strokeStyle = INK;
    g.lineWidth = 4;
    g.beginPath();
    g.arc(cx, cy, R, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    // nose icon
    g.fillStyle = '#f2c29e';
    g.beginPath();
    g.ellipse(cx, cy + 4, 10, 14, 0, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    if (i < beats) {
      const k = (times[i] - t) / interval;
      const rr2 = R * (1 + Math.max(0, k) * 2.2);
      g.strokeStyle = Math.abs(t - times[i]) <= window ? '#2ed573' : '#21c7a8';
      g.lineWidth = 5;
      g.beginPath();
      g.arc(cx, cy, rr2, 0, Math.PI * 2);
      g.stroke();
    }
    // wafts
    for (let k = 0; k < beats; k++) {
      const q = res[k];
      g.fillStyle = q === 'perfect' ? '#1ea65a' : q === 'good' ? '#7bed9f' : q === 'miss' ? '#ff5a5f' : '#efeadf';
      g.strokeStyle = INK;
      g.lineWidth = 2;
      g.beginPath();
      g.arc(24 + k * 24, h - 18, 8, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    }
    return res.length >= beats && t > times[beats - 1] + 0.15;
  });
  const misses = res.filter((q) => q === 'miss').length + (extra > 1 ? 1 : 0);
  if (misses === 0 && res.every((q) => q === 'perfect')) return 'perfect';
  if (misses >= 2) return 'miss';
  return misses === 1 && extra > 0 ? 'miss' : 'good';
}

/** Drag the focus knob until the image is sharp. */
async function focusGame(area: HTMLElement, input: Input, o: MinigameOpts): Promise<Quality> {
  area.classList.add('tall');
  const { c, g, w, h } = setupCanvas(area);
  const { good } = params(o);
  const target = 0.15 + Math.random() * 0.7;
  input.dragX = target > 0.5 ? 0.05 : 0.95;
  drawCrystal(g, w, h - 26, o.sub.props.crystal, o.sub.color);
  // knob track
  let held = 0;
  let result: Quality | null = null;
  const tol = good * 0.45;
  const track = document.createElement('div');
  track.style.cssText = 'position:absolute;left:12px;right:12px;bottom:6px;height:18px;border-radius:9px;background:#efeadf;border:2px solid #22223b';
  const knob = document.createElement('div');
  knob.style.cssText = 'position:absolute;top:-8px;width:30px;height:30px;margin-left:-15px;border-radius:50%;background:#ffb627;border:3px solid #22223b;box-shadow:0 2px 0 #22223b';
  track.appendChild(knob);
  area.appendChild(track);
  c.style.height = `${h - 26}px`;
  await loop((dt, t) => {
    const d = Math.abs(input.dragX - target);
    const blur = Math.min(14, d * 40);
    c.style.filter = `blur(${blur.toFixed(1)}px)`;
    knob.style.left = `${input.dragX * 100}%`;
    if (d <= tol) {
      held += dt;
      if (held > 0.45 && !result) result = t < 2.6 ? 'perfect' : 'good';
    } else held = 0;
    if (t > 7 && !result) result = 'miss';
    return result !== null;
  });
  c.style.filter = 'none';
  return result!;
}

/** Drag the UV lamp to scan the sample. */
async function sweepGame(area: HTMLElement, input: Input, o: MinigameOpts): Promise<Quality> {
  area.classList.add('tall');
  const { g, w, h } = setupCanvas(area);
  const lampR = Math.min(70, 34 * o.zoneMul + 8);
  const cols = 10;
  const rows = 5;
  const seen = new Set<number>();
  const glow = o.sub.props.uv !== 'none';
  const gc = UV_INFO[o.sub.props.uv]?.color ?? '#ffffff';
  const spots = Array.from({ length: 5 }, () => ({ x: 0.15 + Math.random() * 0.7, y: 0.2 + Math.random() * 0.6, r: 12 + Math.random() * 18 }));
  let result: Quality | null = null;
  let moved = false;
  input.dragX = 0.5;
  input.dragY = 0.5;
  let lastX = 0.5;
  await loop((_dt, t) => {
    const lx = input.dragX * w;
    const ly = input.dragY * h;
    if (Math.abs(input.dragX - lastX) > 0.002) moved = true;
    lastX = input.dragX;
    if (moved)
      for (let cx = 0; cx < cols; cx++)
        for (let cy = 0; cy < rows; cy++) {
          const px = ((cx + 0.5) / cols) * w;
          const py = ((cy + 0.5) / rows) * h;
          if (Math.hypot(px - lx, py - ly) < lampR) seen.add(cx * rows + cy);
        }
    const cover = seen.size / (cols * rows);
    g.fillStyle = '#120d24';
    g.fillRect(0, 0, w, h);
    // revealed area
    g.save();
    g.beginPath();
    g.arc(lx, ly, lampR, 0, Math.PI * 2);
    g.clip();
    g.fillStyle = '#3a2370';
    g.fillRect(0, 0, w, h);
    if (glow) {
      for (const s of spots) {
        const grd = g.createRadialGradient(s.x * w, s.y * h, 0, s.x * w, s.y * h, s.r * 1.8);
        grd.addColorStop(0, gc);
        grd.addColorStop(0.5, gc + 'aa');
        grd.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = grd;
        g.fillRect(0, 0, w, h);
      }
    }
    g.restore();
    // faint memory of seen cells
    g.fillStyle = 'rgba(160,120,255,0.12)';
    for (const id of seen) {
      const cx = Math.floor(id / rows);
      const cy = id % rows;
      g.fillRect((cx / cols) * w, (cy / rows) * h, w / cols, h / rows);
    }
    g.strokeStyle = '#b388ff';
    g.lineWidth = 3;
    g.beginPath();
    g.arc(lx, ly, lampR, 0, Math.PI * 2);
    g.stroke();
    // coverage bar
    g.fillStyle = 'rgba(255,255,255,0.15)';
    g.fillRect(10, h - 14, w - 20, 8);
    g.fillStyle = '#b388ff';
    g.fillRect(10, h - 14, (w - 20) * Math.min(1, cover / 0.7), 8);
    if (cover >= 0.7 && !result) result = t < 3.2 ? 'perfect' : 'good';
    if (t > 8 && !result) result = cover > 0.45 ? 'good' : 'miss';
    return result !== null;
  });
  return result!;
}

// ───────────────────────── crystal art ─────────────────────────

export function drawCrystal(g: Ctx, w: number, h: number, kind: Crystal, color: string): void {
  const bg = g.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, Math.max(w, h) / 1.4);
  bg.addColorStop(0, '#fffef6');
  bg.addColorStop(1, '#d7e6ef');
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  let seed = kind.length * 977;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const fill = color === '#ffffff' || color === '#fbfbf6' || color === '#fefefe' ? '#d9ecff' : color;
  g.lineWidth = 2.5;
  g.strokeStyle = INK;
  const N = 14;
  const each = (fn: (x: number, y: number, s: number, a: number) => void, n = N) => {
    for (let i = 0; i < n; i++) fn(rnd() * w, rnd() * h, 8 + rnd() * 16, rnd() * Math.PI);
  };
  g.fillStyle = fill;
  switch (kind) {
    case 'cubes':
      each((x, y, s) => {
        g.fillRect(x, y, s, s);
        g.strokeRect(x, y, s, s);
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + s * 0.3, y - s * 0.3);
        g.lineTo(x + s * 1.3, y - s * 0.3);
        g.lineTo(x + s, y);
        g.stroke();
      });
      break;
    case 'prisms':
    case 'needles':
      each((x, y, s, a) => {
        g.save();
        g.translate(x, y);
        g.rotate(a);
        const len = kind === 'needles' ? s * 3 : s * 1.6;
        const wid = kind === 'needles' ? 3 : s * 0.7;
        g.beginPath();
        g.moveTo(-len / 2, 0);
        g.lineTo(-len / 2 + wid * 0.6, -wid / 2);
        g.lineTo(len / 2 - wid * 0.6, -wid / 2);
        g.lineTo(len / 2, 0);
        g.lineTo(len / 2 - wid * 0.6, wid / 2);
        g.lineTo(-len / 2 + wid * 0.6, wid / 2);
        g.closePath();
        g.fill();
        g.stroke();
        g.restore();
      }, kind === 'needles' ? 22 : N);
      break;
    case 'grains':
    case 'droplets':
    case 'pollen':
      each((x, y, s) => {
        g.beginPath();
        g.arc(x, y, s * (kind === 'droplets' ? 0.5 : 0.7), 0, Math.PI * 2);
        g.fill();
        g.stroke();
        if (kind === 'grains') {
          g.beginPath();
          g.arc(x, y, s * 0.25, 0, Math.PI * 2);
          g.stroke();
        }
        if (kind === 'pollen') {
          for (const sx of [-1, 1]) {
            g.beginPath();
            g.arc(x + sx * s * 0.75, y - s * 0.3, s * 0.45, 0, Math.PI * 2);
            g.fill();
            g.stroke();
          }
        }
      });
      break;
    case 'plates':
      each((x, y, s, a) => {
        g.save();
        g.translate(x, y);
        g.rotate(a * 0.2);
        for (let k = 0; k < 3; k++) {
          g.fillRect(-s + k * 3, -s * 0.3 + k * 4, s * 2, s * 0.5);
          g.strokeRect(-s + k * 3, -s * 0.3 + k * 4, s * 2, s * 0.5);
        }
        g.restore();
      }, 8);
      break;
    case 'shards':
    case 'amorphous':
      each((x, y, s) => {
        g.beginPath();
        const n = kind === 'shards' ? 4 + Math.floor(rnd() * 3) : 9;
        for (let k = 0; k < n; k++) {
          const a = (k / n) * Math.PI * 2;
          const r = s * (kind === 'shards' ? 0.5 + rnd() * 0.7 : 0.8 + rnd() * 0.25);
          const px = x + Math.cos(a) * r;
          const py = y + Math.sin(a) * r;
          if (k === 0) g.moveTo(px, py);
          else g.lineTo(px, py);
        }
        g.closePath();
        g.fill();
        g.stroke();
      });
      break;
    case 'rhombs':
      each((x, y, s) => {
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + s, y - s * 0.2);
        g.lineTo(x + s * 1.4, y + s * 0.6);
        g.lineTo(x + s * 0.4, y + s * 0.8);
        g.closePath();
        g.fill();
        g.stroke();
      });
      break;
    case 'octahedra':
      each((x, y, s) => {
        g.beginPath();
        g.moveTo(x, y - s);
        g.lineTo(x + s * 0.8, y);
        g.lineTo(x, y + s);
        g.lineTo(x - s * 0.8, y);
        g.closePath();
        g.fill();
        g.stroke();
        g.beginPath();
        g.moveTo(x - s * 0.8, y);
        g.lineTo(x + s * 0.8, y);
        g.stroke();
      });
      break;
    case 'hexagons':
      each((x, y, s) => {
        g.beginPath();
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2;
          const px = x + Math.cos(a) * s * 0.8;
          const py = y + Math.sin(a) * s * 0.8;
          if (k === 0) g.moveTo(px, py);
          else g.lineTo(px, py);
        }
        g.closePath();
        g.fill();
        g.stroke();
      });
      break;
    case 'metal-grain':
      g.fillStyle = '#c9d1d9';
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 40; i++) {
        g.fillStyle = `hsl(210, 8%, ${60 + rnd() * 25}%)`;
        const x = rnd() * w;
        const y = rnd() * h;
        g.beginPath();
        g.moveTo(x, y);
        for (let k = 0; k < 5; k++) g.lineTo(x + (rnd() - 0.5) * 50, y + (rnd() - 0.5) * 40);
        g.closePath();
        g.fill();
        g.stroke();
      }
      break;
    case 'crosshatch':
      g.fillStyle = '#b0b6bd';
      g.fillRect(0, 0, w, h);
      g.strokeStyle = '#6c737b';
      g.lineWidth = 3;
      for (let i = -h; i < w; i += 14) {
        g.beginPath();
        g.moveTo(i, 0);
        g.lineTo(i + h, h);
        g.stroke();
        g.beginPath();
        g.moveTo(i + h, 0);
        g.lineTo(i, h);
        g.stroke();
      }
      break;
    case 'blood-cells':
      each((x, y, s) => {
        g.fillStyle = '#d93636';
        g.beginPath();
        g.arc(x, y, s * 0.8, 0, Math.PI * 2);
        g.fill();
        g.stroke();
        g.fillStyle = '#a81e1e';
        g.beginPath();
        g.arc(x, y, s * 0.35, 0, Math.PI * 2);
        g.fill();
      }, 18);
      break;
    case 'plant-cells':
      g.fillStyle = '#c8eba6';
      for (let x = 0; x < w; x += 34)
        for (let y = 0; y < h; y += 26) {
          g.fillStyle = color === '#ffffff' ? '#c8eba6' : fill;
          g.globalAlpha = 0.65;
          g.fillRect(x + 2, y + 2, 30, 22);
          g.globalAlpha = 1;
          g.strokeRect(x + 2, y + 2, 30, 22);
          g.fillStyle = '#2a9d8f';
          g.beginPath();
          g.arc(x + 17, y + 13, 3, 0, Math.PI * 2);
          g.fill();
        }
      break;
    case 'microbes':
      each((x, y, s, a) => {
        g.save();
        g.translate(x, y);
        g.rotate(a);
        g.fillStyle = '#9df0c0';
        g.beginPath();
        g.ellipse(0, 0, s, s * 0.45, 0, 0, Math.PI * 2);
        g.fill();
        g.stroke();
        g.beginPath();
        g.moveTo(s, 0);
        g.quadraticCurveTo(s * 1.6, s * 0.5, s * 2, 0);
        g.stroke();
        g.fillStyle = INK;
        g.beginPath();
        g.arc(-s * 0.4, -2, 2, 0, Math.PI * 2);
        g.fill();
        g.restore();
      }, 10);
      break;
    case 'algae':
      g.strokeStyle = '#3c9a46';
      g.lineWidth = 5;
      for (let i = 0; i < 9; i++) {
        g.beginPath();
        let x = rnd() * w;
        let y = rnd() * h;
        g.moveTo(x, y);
        for (let k = 0; k < 6; k++) {
          x += (rnd() - 0.3) * 40;
          y += (rnd() - 0.5) * 30;
          g.lineTo(x, y);
        }
        g.stroke();
      }
      break;
    default:
      // just liquid: a few bubbles
      g.strokeStyle = 'rgba(34,34,59,0.35)';
      for (let i = 0; i < 8; i++) {
        g.beginPath();
        g.arc(rnd() * w, rnd() * h, 4 + rnd() * 10, 0, Math.PI * 2);
        g.stroke();
      }
  }
}

// ───────────────────────── runner ─────────────────────────

export async function playMinigame(root: HTMLElement, o: MinigameOpts): Promise<Quality> {
  const catcher = document.createElement('div');
  catcher.style.cssText = 'position:absolute;inset:0;z-index:7;touch-action:none';
  const panel = document.createElement('div');
  panel.className = 'mg panel';
  panel.innerHTML = `<div class="mg-head">${toolIcon(o.tool.id, o.tool.reagentColor)}<div><div class="mg-title">${o.tool.name}</div><div class="mg-how">${o.tool.howTo}</div></div></div><div class="mg-area"></div><div class="mg-tapnote">${tapNote(o.tool.minigame)}</div>`;
  root.appendChild(catcher);
  root.appendChild(panel);
  const area = panel.querySelector('.mg-area') as HTMLElement;
  currentArea = area;
  const input = new Input(area, catcher);
  if (o.firstTime) await new Promise((r) => setTimeout(r, 650));
  let q: Quality;
  if (AUTOTEST) {
    // automated QA runs: skip the skill check
    await new Promise((r) => setTimeout(r, 400));
    input.dispose();
    panel.remove();
    catcher.remove();
    return 'good';
  }
  try {
    switch (o.tool.minigame) {
      case 'hold':
        q = await holdGame(area, input, o);
        break;
      case 'drops':
        q = await dropsGame(area, input, o);
        break;
      case 'rhythm':
        q = await rhythmGame(area, input, o);
        break;
      case 'focus':
        q = await focusGame(area, input, o);
        break;
      case 'sweep':
        q = await sweepGame(area, input, o);
        break;
      default:
        q = await timingGame(area, input, o);
    }
  } finally {
    input.dispose();
  }
  q = q ?? 'miss';
  if (!area.isConnected) {
    catcher.remove();
    return q;
  }
  let lucky = false;
  if (q === 'miss' && Math.random() < o.lucky) {
    q = 'good';
    lucky = true;
  }
  const res = document.createElement('div');
  res.className = 'mg-result';
  res.textContent = lucky ? 'LUCKY!' : q === 'perfect' ? 'PERFECT!' : q === 'good' ? 'GOOD' : 'BOTCHED!';
  res.style.color = q === 'perfect' ? '#ffd23f' : q === 'good' ? '#7bed9f' : '#ff5a5f';
  area.appendChild(res);
  audio.play(q === 'perfect' ? 'perfect' : q === 'good' ? 'good' : 'miss');
  await new Promise((r) => setTimeout(r, 520));
  panel.remove();
  catcher.remove();
  return q;
}

function tapNote(kind: string): string {
  switch (kind) {
    case 'hold':
      return 'HOLD anywhere (or SPACE) — release in the green!';
    case 'drops':
      return 'TAP anywhere (or SPACE) when the drop fills the ring';
    case 'rhythm':
      return 'TAP when the ring meets the circle';
    case 'focus':
      return 'DRAG the knob (or ← →) until it is sharp';
    case 'sweep':
      return 'DRAG the lamp all over the sample';
    default:
      return 'TAP anywhere (or SPACE) in the green zone';
  }
}
