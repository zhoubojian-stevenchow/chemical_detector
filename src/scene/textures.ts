import * as THREE from 'three';
import { GAME } from '../config';

export const FONT = '"Fredoka", "Trebuchet MS", "Segoe UI", Arial, sans-serif';

export function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

export function tex(c: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

export function labelTexture(text: string, opts: { w?: number; h?: number; bg?: string; fg?: string; size?: number; border?: string } = {}): THREE.CanvasTexture {
  const w = opts.w ?? 256;
  const h = opts.h ?? 96;
  const [c, g] = canvas(w, h);
  g.fillStyle = opts.bg ?? '#fffdf3';
  roundRect(g, 4, 4, w - 8, h - 8, 14);
  g.fill();
  if (opts.border) {
    g.lineWidth = 5;
    g.strokeStyle = opts.border;
    g.stroke();
  }
  g.fillStyle = opts.fg ?? '#2b2d42';
  let size = opts.size ?? 40;
  g.font = `700 ${size}px ${FONT}`;
  while (g.measureText(text).width > w - 24 && size > 12) {
    size -= 2;
    g.font = `700 ${size}px ${FONT}`;
  }
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, w / 2, h / 2 + 2);
  return tex(c);
}

/** Painted street scene seen through the drop-off window. */
export function backdropTexture(night = false): THREE.CanvasTexture {
  const [c, g] = canvas(1024, 512);
  const sky = g.createLinearGradient(0, 0, 0, 512);
  if (night) {
    sky.addColorStop(0, '#0b1033');
    sky.addColorStop(1, '#3a2f6b');
  } else {
    sky.addColorStop(0, '#5ec8ff');
    sky.addColorStop(0.7, '#bdeaff');
    sky.addColorStop(1, '#fff3d6');
  }
  g.fillStyle = sky;
  g.fillRect(0, 0, 1024, 512);
  if (night) {
    g.fillStyle = '#fff';
    for (let i = 0; i < 90; i++) g.fillRect(Math.random() * 1024, Math.random() * 300, 2, 2);
    g.fillStyle = '#fff6c9';
    g.beginPath();
    g.arc(820, 90, 38, 0, Math.PI * 2);
    g.fill();
  } else {
    g.fillStyle = '#fff7b0';
    g.beginPath();
    g.arc(840, 90, 46, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.9)';
    for (const [x, y, s] of [[150, 90, 1], [420, 60, 1.3], [640, 130, 0.9]]) {
      for (let i = 0; i < 4; i++) {
        g.beginPath();
        g.arc(x + i * 34 * s, y + (i % 2) * 8, 30 * s, 0, Math.PI * 2);
        g.fill();
      }
    }
  }
  // buildings
  const cols = night ? ['#2a2f5a', '#323a6b', '#262a50'] : ['#f7a072', '#9ad1d4', '#ffd166', '#c3b1e1', '#80c9a5'];
  let x = -20;
  let i = 0;
  while (x < 1044) {
    const bw = 90 + ((i * 53) % 70);
    const bh = 170 + ((i * 97) % 160);
    g.fillStyle = cols[i % cols.length];
    g.fillRect(x, 512 - bh - 70, bw, bh);
    g.fillStyle = night ? '#ffe28a' : 'rgba(255,255,255,0.75)';
    for (let wy = 512 - bh - 55; wy < 512 - 90; wy += 34) {
      for (let wx = x + 12; wx < x + bw - 20; wx += 26) {
        if (!night || (wx * wy) % 7 < 4) g.fillRect(wx, wy, 14, 18);
      }
    }
    x += bw + 6;
    i++;
  }
  // street
  g.fillStyle = night ? '#1d1f33' : '#6f7787';
  g.fillRect(0, 442, 1024, 70);
  g.fillStyle = night ? '#55597a' : '#c5cad4';
  g.fillRect(0, 436, 1024, 10);
  g.fillStyle = '#ffe066';
  for (let k = 0; k < 1024; k += 80) g.fillRect(k, 476, 44, 6);
  return tex(c);
}

export function periodicTableTexture(): THREE.CanvasTexture {
  const [c, g] = canvas(512, 320);
  g.fillStyle = '#fffdf6';
  g.fillRect(0, 0, 512, 320);
  g.fillStyle = '#2b2d42';
  g.font = `700 26px ${FONT}`;
  g.textAlign = 'center';
  g.fillText('PERIODIC TABLE OF ELEMENTS', 256, 34);
  const layout = [
    '1.................2',
    '34..........567890',
    '12..........345678',
    '123456789012345678',
    '123456789012345678',
    '123456789012345678',
    '123456789012345678',
  ];
  const colors = ['#ff8a80', '#ffd180', '#ffff8d', '#ccff90', '#a7ffeb', '#80d8ff', '#b388ff', '#ff80ab'];
  const cw = 26;
  const ch = 32;
  layout.forEach((row, r) => {
    [...row].forEach((ch2, k) => {
      if (ch2 === '.') return;
      const color = colors[(k + r) % colors.length];
      g.fillStyle = color;
      g.fillRect(22 + k * cw, 52 + r * ch, cw - 3, ch - 3);
    });
  });
  return tex(c);
}

export function posterTexture(kind: 'safety' | 'notaste' | 'gerald' | 'motivation'): THREE.CanvasTexture {
  const [c, g] = canvas(256, 360);
  const bg = { safety: '#ffd23f', notaste: '#ff6b6b', gerald: '#a0e7e5', motivation: '#b4a7ff' }[kind];
  g.fillStyle = bg;
  g.fillRect(0, 0, 256, 360);
  g.strokeStyle = '#2b2d42';
  g.lineWidth = 10;
  g.strokeRect(5, 5, 246, 350);
  g.fillStyle = '#2b2d42';
  g.textAlign = 'center';
  const lines: Record<string, string[]> = {
    safety: ['SAFETY', 'FIRST!', '', '(second: snacks)'],
    notaste: ['NO', 'TASTING', 'THE', 'SAMPLES'],
    gerald: ['EMPLOYEE', 'OF THE', 'MONTH:', 'GERALD'],
    motivation: ['STAY', 'CURIOUS.', 'STAY', 'ALIVE.'],
  };
  lines[kind].forEach((t, i) => {
    g.font = `700 ${i === 3 && kind === 'safety' ? 22 : 42}px ${FONT}`;
    g.fillText(t, 128, 70 + i * 62);
  });
  // little icon
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.arc(128, 318, 22, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#2b2d42';
  g.font = `700 26px ${FONT}`;
  g.fillText(kind === 'gerald' ? '★' : '!', 128, 328);
  return tex(c);
}

export function companySignTexture(): THREE.CanvasTexture {
  const [c, g] = canvas(1024, 160);
  g.fillStyle = '#22223b';
  roundRect(g, 4, 4, 1016, 152, 30);
  g.fill();
  g.strokeStyle = '#21c7a8';
  g.lineWidth = 8;
  g.stroke();
  g.fillStyle = '#ffffff';
  g.textAlign = 'center';
  g.font = `700 64px ${FONT}`;
  g.fillText(GAME.company.toUpperCase(), 512, 80);
  g.fillStyle = '#ffd23f';
  g.font = `600 30px ${FONT}`;
  g.fillText('★ SAMPLE DROP-OFF ★ ALL RESULTS GUARANTEED-ISH ★', 512, 128);
  return tex(c);
}

export class AccidentSign {
  readonly texture: THREE.CanvasTexture;
  private c: HTMLCanvasElement;
  private g: CanvasRenderingContext2D;
  constructor() {
    [this.c, this.g] = canvas(256, 200);
    this.texture = tex(this.c);
    this.set(0);
  }
  set(days: number): void {
    const g = this.g;
    g.fillStyle = '#fffdf6';
    g.fillRect(0, 0, 256, 200);
    g.fillStyle = '#2b2d42';
    g.fillRect(0, 0, 256, 56);
    g.fillStyle = '#fff';
    g.textAlign = 'center';
    g.font = `700 22px ${FONT}`;
    g.fillText('SHIFTS WITHOUT', 128, 26);
    g.fillText('AN ACCIDENT', 128, 50);
    g.fillStyle = days === 0 ? '#ff4d4d' : '#21a87d';
    g.font = `700 108px ${FONT}`;
    g.fillText(String(Math.min(days, 999)), 128, 172);
    this.texture.needsUpdate = true;
  }
}

/** Live screen for machines (mass spec graph, scale readout…). */
export class Screen {
  readonly texture: THREE.CanvasTexture;
  readonly c: HTMLCanvasElement;
  readonly g: CanvasRenderingContext2D;
  constructor(w = 256, h = 160) {
    [this.c, this.g] = canvas(w, h);
    this.texture = tex(this.c);
    this.clear();
  }
  clear(color = '#0d2b2a'): void {
    this.g.fillStyle = color;
    this.g.fillRect(0, 0, this.c.width, this.c.height);
    this.texture.needsUpdate = true;
  }
  text(t: string, color = '#7dffb2', size = 44): void {
    const g = this.g;
    this.clear();
    g.fillStyle = color;
    g.font = `700 ${size}px ${FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(t, this.c.width / 2, this.c.height / 2);
    this.texture.needsUpdate = true;
  }
  /** spectrum with a main peak at fraction x (0..1) and progress k */
  spectrum(peakX: number, k: number, label: string): void {
    const g = this.g;
    const { width: w, height: h } = this.c;
    this.clear();
    g.strokeStyle = '#2d6b66';
    g.lineWidth = 1;
    for (let x = 0; x < w; x += 32) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, h);
      g.stroke();
    }
    g.strokeStyle = '#7dffb2';
    g.lineWidth = 3;
    g.beginPath();
    const end = Math.floor(w * k);
    for (let x = 0; x <= end; x++) {
      const fx = x / w;
      const noise = Math.abs(Math.sin(x * 0.7) * Math.sin(x * 0.13)) * 10;
      const peak = Math.exp(-Math.pow((fx - peakX) * 60, 2)) * (h - 40);
      const y = h - 12 - noise - peak;
      if (x === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
    if (k >= 1) {
      g.fillStyle = '#ffd23f';
      g.font = `700 22px ${FONT}`;
      g.textAlign = 'center';
      g.fillText(label, Math.min(w - 60, Math.max(60, peakX * w)), 24);
    }
    this.texture.needsUpdate = true;
  }
}

export function floorTexture(a: string, b: string): THREE.CanvasTexture {
  const [c, g] = canvas(256, 256);
  g.fillStyle = a;
  g.fillRect(0, 0, 256, 256);
  g.fillStyle = b;
  g.fillRect(0, 0, 128, 128);
  g.fillRect(128, 128, 128, 128);
  g.strokeStyle = 'rgba(0,0,0,0.06)';
  g.lineWidth = 3;
  g.strokeRect(0, 0, 128, 128);
  g.strokeRect(128, 128, 128, 128);
  const t = tex(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(8, 6);
  return t;
}

export function tileWallTexture(color: string): THREE.CanvasTexture {
  const [c, g] = canvas(256, 256);
  g.fillStyle = color;
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(255,255,255,0.35)';
  g.lineWidth = 4;
  for (let i = 0; i <= 256; i += 64) {
    g.beginPath();
    g.moveTo(i, 0);
    g.lineTo(i, 256);
    g.stroke();
    g.beginPath();
    g.moveTo(0, i);
    g.lineTo(256, i);
    g.stroke();
  }
  const t = tex(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Soft round sprite used by particles. */
export function dotTexture(): THREE.CanvasTexture {
  const [c, g] = canvas(64, 64);
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.45, 'rgba(255,255,255,0.85)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  return tex(c);
}
