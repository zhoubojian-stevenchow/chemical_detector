import { audio } from '../core/audio';
import { esc, h } from './dom';

/** Spotlight + speech box tutorial helper. */
export class Tutor {
  private ring: HTMLElement | null = null;
  private box: HTMLElement | null = null;
  private target: HTMLElement | null = null;
  private raf = 0;

  constructor(private layer: HTMLElement) {}

  /** Highlight a target. If `next` is given, waits for the button. */
  show(target: HTMLElement | null, text: string, next?: string): Promise<void> {
    this.clear();
    this.target = target;
    if (target) {
      this.ring = h('<div class="tut-ring"></div>');
      this.layer.appendChild(this.ring);
    }
    this.box = h(`<div class="tut-box panel"><div class="tut-who">GERALD (Senior Lab Rat)</div>${esc(text)}${next ? `<div><button class="btn small yellow">${esc(next)}</button></div>` : ''}</div>`);
    this.layer.appendChild(this.box);
    audio.play('squeak');
    this.place();
    const loop = () => {
      this.place();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
    if (!next) return Promise.resolve();
    return new Promise((resolve) => {
      this.box!.querySelector('button')!.addEventListener('click', () => {
        audio.play('click');
        this.clear();
        resolve();
      });
    });
  }

  private place(): void {
    if (!this.box) return;
    const L = this.layer.getBoundingClientRect();
    const bw = this.box.offsetWidth;
    const bh = this.box.offsetHeight;
    if (this.target && this.ring) {
      const r = this.target.getBoundingClientRect();
      const pad = 6;
      Object.assign(this.ring.style, {
        left: `${r.left - L.left - pad}px`,
        top: `${r.top - L.top - pad}px`,
        width: `${r.width + pad * 2}px`,
        height: `${r.height + pad * 2}px`,
      });
      // put the box above or below the target, whichever has room
      let x = r.left - L.left + r.width / 2 - bw / 2;
      x = Math.max(8, Math.min(L.width - bw - 8, x));
      let y = r.top - L.top - bh - 18;
      if (y < 60) y = r.bottom - L.top + 18;
      if (y + bh > L.height - 8) y = Math.max(60, (L.height - bh) / 2);
      // avoid covering the target horizontally if it is tall (side panel)
      if (r.height > L.height * 0.4) {
        x = r.left - L.left - bw - 18;
        if (x < 8) x = Math.min(L.width - bw - 8, r.right - L.left + 18);
        y = Math.max(70, r.top - L.top + 30);
      }
      this.box.style.left = `${x}px`;
      this.box.style.top = `${y}px`;
    } else {
      this.box.style.left = `${(L.width - bw) / 2}px`;
      this.box.style.top = `${L.height * 0.32}px`;
    }
  }

  clear(): void {
    cancelAnimationFrame(this.raf);
    this.ring?.remove();
    this.box?.remove();
    this.ring = null;
    this.box = null;
    this.target = null;
  }
}
