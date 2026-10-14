import { audio } from '../core/audio';
import { escapeHtml } from '../core/util';
import type { ClientDef, Substance } from '../data/types';
import { icon, stateIcon } from './icons';

export function h<T extends HTMLElement = HTMLElement>(html: string): T {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild as T;
}

export function $(root: ParentNode, sel: string): HTMLElement {
  return root.querySelector(sel) as HTMLElement;
}

export function $$(root: ParentNode, sel: string): HTMLElement[] {
  return Array.from(root.querySelectorAll(sel)) as HTMLElement[];
}

/** Delegated click handling on [data-act] elements. */
export function onAct(root: HTMLElement, handler: (act: string, el: HTMLElement, e: Event) => void): void {
  root.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement).closest('[data-act]') as HTMLElement | null;
    if (!el || !root.contains(el)) return;
    if (el.classList.contains('disabled') || (el as HTMLButtonElement).disabled) {
      audio.play('error');
      // locked features explain how to unlock them
      if (el.dataset.locked) toast((el.closest('#ui') as HTMLElement | null) ?? root, el.dataset.locked);
      return;
    }
    if (el.classList.contains('btn') || el.classList.contains('tab') || el.classList.contains('chapter-tab')) audio.play('click');
    handler(el.dataset.act!, el, e);
  });
}

export const esc = escapeHtml;

export function avatarHtml(c: ClientDef, cls = ''): string {
  const initials = c.name
    .split(' ')
    .filter((w) => /^[A-Z]/.test(w))
    .slice(-2)
    .map((w) => w[0])
    .join('');
  return `<div class="avatar ${cls}" style="background:${c.look.shirt === '#ffffff' || c.look.shirt === '#f2f2f2' ? '#9aa3b2' : c.look.shirt}">${esc(initials || c.name[0])}</div>`;
}

export function swatchHtml(s: Substance): string {
  const light = isLight(s.color);
  const bg = s.state === 'gas' ? '#e8eef5' : s.color;
  const fg = s.state === 'gas' ? '#9aa7b8' : light ? shadeHex(s.color, 0.82) : '#ffffff';
  return `<div class="swatch" style="background:${bg}">${stateIcon(s.state, fg)}</div>`;
}

export function isLight(hex: string): boolean {
  const c = hex.replace('#', '');
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 170;
}

export function shadeHex(hex: string, k: number): string {
  const c = hex.replace('#', '');
  const f = (i: number) => Math.max(0, Math.min(255, Math.round(parseInt(c.slice(i, i + 2), 16) * k)));
  return `#${[f(0), f(2), f(4)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

export function coinHtml(n: number | string, cls = ''): string {
  return `<span class="${cls}" style="display:inline-flex;align-items:center;gap:4px">${icon('coin').replace('<svg', '<svg style="width:22px;height:22px"')}${n}</span>`;
}

export function floatText(parent: HTMLElement, text: string, x: number, y: number, color = '#ffd23f', size = 28): void {
  const el = document.createElement('div');
  el.className = 'float-text';
  el.textContent = text;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  el.style.color = color;
  el.style.fontSize = `${size}px`;
  parent.appendChild(el);
  setTimeout(() => el.remove(), 1350);
}

let toastEl: HTMLElement | null = null;
export function toast(parent: HTMLElement, text: string, ms = 1800): void {
  toastEl?.remove();
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = text;
  parent.appendChild(el);
  toastEl = el;
  setTimeout(() => {
    if (toastEl === el) toastEl = null;
    el.remove();
  }, ms);
}

/** Generic modal; returns the modal root and a close function. */
export function modal(parent: HTMLElement, inner: string, opts: { wide?: boolean; dim?: boolean; cls?: string } = {}): { root: HTMLElement; box: HTMLElement; close: () => void } {
  const root = h(`<div class="modal ${opts.cls ?? ''}">${opts.dim === false ? '' : '<div class="dim-bg"></div>'}<div class="modal-box panel ${opts.wide ? 'wide' : ''}">${inner}</div></div>`);
  parent.appendChild(root);
  return { root, box: $(root, '.modal-box'), close: () => root.remove() };
}

export function confirmBox(parent: HTMLElement, title: string, text: string, yes = 'Yes', no = 'Cancel'): Promise<boolean> {
  return new Promise((resolve) => {
    const m = modal(parent, `<h2 class="modal-title">${esc(title)}</h2><p class="modal-sub">${esc(text)}</p><div class="modal-actions"><button class="btn white" data-act="no">${esc(no)}</button><button class="btn red" data-act="yes">${esc(yes)}</button></div>`);
    onAct(m.root, (act) => {
      m.close();
      resolve(act === 'yes');
    });
  });
}

/** Animated number count-up. */
export function countUp(el: HTMLElement, from: number, to: number, ms = 900, fmt = (n: number) => Math.round(n).toLocaleString('en-US')): Promise<void> {
  return new Promise((resolve) => {
    const start = performance.now();
    let lastTick = 0;
    const step = () => {
      const k = Math.min(1, (performance.now() - start) / ms);
      const v = from + (to - from) * (1 - Math.pow(1 - k, 3));
      el.textContent = fmt(v);
      if (k - lastTick > 0.08 && to !== from) {
        lastTick = k;
        audio.play('coin', Math.floor(k * 10));
      }
      if (k < 1) requestAnimationFrame(step);
      else resolve();
    };
    step();
  });
}
