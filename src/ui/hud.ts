import { audio } from '../core/audio';
import { formatTime } from '../core/util';
import type { ClientDef, Substance, ToolId } from '../data/types';
import { TOOL_MAP } from '../data/tools';
import type { Reading } from '../game/deduction';
import { $, $$, avatarHtml, esc, floatText, h, modal, onAct, swatchHtml } from './dom';
import { icon, toolIcon } from './icons';

export interface ToolView {
  id: ToolId;
  used: boolean;
  busy: boolean;
  progress: number;
  auto: boolean;
  cost: number;
  hint: boolean;
  key: string;
}

export interface ItemView {
  id: string;
  name: string;
  count: number;
  ad: boolean;
}

export interface CardRow {
  tool: ToolId;
  label: string;
  color: string;
  status: 'match' | 'miss' | 'unknown';
}

export interface HudCallbacks {
  tool(id: ToolId): void;
  card(sub: Substance): void;
  item(id: string): void;
  pause(): void;
  request(): void;
}

export class Hud {
  readonly root: HTMLElement;
  private parent: HTMLElement;
  private cb: HudCallbacks;
  private dialogEl: HTMLElement | null = null;
  private readingTimer = 0;
  private bubbleEl: HTMLElement | null = null;
  private bubbleTimer = 0;
  private lastHearts = -1;
  busy = false;
  /** called when panel sizes change (so the 3D view can re-centre) */
  onLayout: () => void = () => {};

  constructor(parent: HTMLElement, cb: HudCallbacks) {
    this.parent = parent;
    this.cb = cb;
    this.root = h(`<div class="hud">
      <div class="hud-top">
        <button class="btn icon small white" data-act="pause" aria-label="Pause">${icon('pause')}</button>
        <div class="hud-level"></div>
        <div class="timer"><span class="t-ico">${icon('clock')}</span><span class="t-val">0:00</span><div class="par-mark"></div></div>
        <div class="hearts"></div>
        <div class="pill case-count"></div>
        <div class="pill coins-pill">${icon('coin')}<span class="c-val">0</span></div>
      </div>
      <div class="cands panel" style="display:none">
        <div class="cands-head"><span>Suspects</span><span class="count"></span></div>
        <div class="evidence"></div>
        <div class="cand-list"></div>
        <div class="identify-hint" style="font-size:12.5px;color:#4a4e69;text-align:center">Tap a substance to inspect &amp; identify it</div>
      </div>
      <div class="tray panel" style="display:none"></div>
    </div>`);
    parent.appendChild(this.root);
    onAct(this.root, (act, el) => {
      if (act === 'pause') this.cb.pause();
      else if (act === 'reagents') this.busy ? audio.play('error') : this.toggleReagents();
      else if (act === 'tool' && !this.busy) {
        if (this.reagentsOpen) {
          this.reagentsOpen = false;
          this.root.querySelector('.reagent-pop')?.remove();
          this.root.querySelector('.tool.group')?.classList.remove('open');
        }
        this.cb.tool(el.dataset.id as ToolId);
      }
      else if (act === 'tool' && this.busy) audio.play('error');
      else if (act === 'item') this.cb.item(el.dataset.id!);
      else if (act === 'request') this.cb.request();
    });
    this.root.addEventListener('click', (e) => {
      const c = (e.target as HTMLElement).closest('.cand') as HTMLElement | null;
      if (c && !c.classList.contains('out') && this.candSubs.has(c.dataset.id!)) {
        audio.play('click');
        this.cb.card(this.candSubs.get(c.dataset.id!)!);
      }
    });
  }

  private candSubs = new Map<string, Substance>();

  destroy(): void {
    this.root.remove();
    this.dialogEl?.remove();
    this.bubbleEl?.remove();
  }

  // ── top bar ──
  setLevel(title: string): void {
    $(this.root, '.hud-level').textContent = title;
  }

  setTimer(left: number, total: number, par: number, running: boolean): void {
    const t = $(this.root, '.timer');
    $(t, '.t-val').textContent = formatTime(left);
    t.classList.toggle('low', left <= 15 && running && left > 0);
    t.classList.toggle('paused', !running);
    const bar = $(t, '.par-mark');
    bar.style.width = `${Math.max(0, Math.min(1, left / Math.max(1, total))) * 100}%`;
    bar.style.background = left >= par ? '#2ed573' : left > 15 ? '#ffb627' : '#ff5a5f';
  }

  setHearts(n: number, max: number): void {
    const el = $(this.root, '.hearts');
    const lost = this.lastHearts > n;
    el.innerHTML = Array.from({ length: max }, (_, i) => `<span class="${i < n ? '' : 'lost'} ${lost && i === n ? 'pop' : ''}">${icon('heart')}</span>`).join('');
    this.lastHearts = n;
  }

  setCoins(n: number): void {
    $(this.root, '.c-val').textContent = String(Math.max(0, Math.round(n)));
  }

  setCaseCount(i: number, n: number | null): void {
    $(this.root, '.case-count').textContent = n === null ? `Case ${i}` : `Case ${i}/${n}`;
  }

  coinsPillPos(): { x: number; y: number } {
    const r = $(this.root, '.coins-pill').getBoundingClientRect();
    const p = this.parent.getBoundingClientRect();
    return { x: r.left - p.left + r.width / 2, y: r.top - p.top + r.height / 2 };
  }

  // ── dialog ──
  dialog(client: ClientDef, text: string, opts: { label?: string; next?: string; speak?: boolean } = {}): Promise<void> {
    this.closeDialog();
    return new Promise((resolve) => {
      const el = h(`<div class="dialog panel">${avatarHtml(client)}<div class="dialog-body"><div class="dialog-name">${esc(client.name)}<small>${esc(client.title)}</small>${opts.label ? `<span class="label-tag">${esc(opts.label)}</span>` : ''}</div><div class="dialog-text"></div></div><div class="dialog-next" style="display:none">${esc(opts.next ?? 'Tap to continue ▸')}</div></div>`);
      this.parent.appendChild(el);
      this.dialogEl = el;
      const txt = $(el, '.dialog-text');
      let i = 0;
      let done = false;
      const speak = opts.speak !== false;
      const finish = () => {
        done = true;
        txt.textContent = text;
        $(el, '.dialog-next').style.display = '';
      };
      const step = () => {
        if (done || !el.isConnected) return;
        i += 2;
        txt.textContent = text.slice(0, i);
        if (speak && i % 4 === 0 && /[a-z]/i.test(text[i] ?? '')) audio.babble(client.voice.pitch, client.voice.wave, 1);
        if (i >= text.length) finish();
        else setTimeout(step, 1000 / (client.voice.speed * 5));
      };
      step();
      const onTap = () => {
        if (!done) {
          finish();
          return;
        }
        audio.play('click');
        el.removeEventListener('click', onTap);
        window.removeEventListener('keydown', onKey);
        el.remove();
        if (this.dialogEl === el) this.dialogEl = null;
        resolve();
      };
      const onKey = (e: KeyboardEvent) => {
        if (e.code === 'Space' || e.code === 'Enter') {
          e.preventDefault();
          onTap();
        }
      };
      el.addEventListener('click', onTap);
      window.addEventListener('keydown', onKey);
    });
  }

  closeDialog(): void {
    this.dialogEl?.remove();
    this.dialogEl = null;
  }

  showRequest(client: ClientDef, text: string): void {
    this.hideRequest();
    const el = h(`<div class="request-chip panel" data-act="request">${avatarHtml(client)}<span>${esc(text)}</span></div>`);
    el.title = text;
    this.root.appendChild(el);
  }

  hideRequest(): void {
    this.root.querySelector('.request-chip')?.remove();
  }

  // ── suspects ──
  showPanels(on: boolean): void {
    $(this.root, '.cands').style.display = on ? '' : 'none';
    $(this.root, '.tray').style.display = on ? '' : 'none';
    this.onLayout();
    const items = this.root.querySelector('.items') as HTMLElement | null;
    if (items) items.style.display = on ? '' : 'none';
    if (!on && this.reagentsOpen) this.toggleReagents(false);
  }

  setCandidates(lineup: Substance[], eliminated: Set<string>, discovered: (id: string) => boolean): void {
    this.candSubs = new Map(lineup.map((s) => [s.id, s]));
    const list = $(this.root, '.cand-list');
    list.innerHTML = lineup
      .map(
        (s, i) => `<div class="cand ${eliminated.has(s.id) ? 'out' : ''}" data-id="${s.id}" style="animation-delay:${i * 0.05}s">
          ${swatchHtml(s)}<div class="cand-text"><div class="cand-name">${esc(s.name)}</div><div class="cand-formula">${esc(s.formula)} · ${esc(s.look)}</div></div>
          ${eliminated.has(s.id) ? '<div class="stamp">RULED OUT</div>' : ''}
          ${discovered(s.id) ? '' : '<div class="cand-new">NEW</div>'}
        </div>`,
      )
      .join('');
    this.updateCount(lineup.length - eliminated.size, lineup.length);
  }

  ruleOut(ids: string[], remaining: number, total: number): void {
    ids.forEach((id, i) => {
      const el = this.root.querySelector(`.cand[data-id="${id}"]`) as HTMLElement | null;
      if (!el) return;
      setTimeout(() => {
        el.classList.add('out');
        if (!el.querySelector('.stamp')) el.insertAdjacentHTML('beforeend', '<div class="stamp">RULED OUT</div>');
        audio.play('stamp');
      }, 120 + i * 140);
    });
    this.updateCount(remaining, total);
  }

  private updateCount(remaining: number, total: number): void {
    $(this.root, '.cands-head .count').textContent = `${remaining} of ${total} left`;
  }

  hintCandidate(id: string | null): void {
    $$(this.root, '.cand').forEach((c) => c.classList.toggle('hinted', c.dataset.id === id));
  }

  setEvidence(readings: Reading[]): void {
    $(this.root, '.evidence').innerHTML = readings
      .map((r) => `<span class="ev" title="${esc(TOOL_MAP[r.tool].name)}: ${esc(r.label)}">${toolIcon(r.tool, TOOL_MAP[r.tool].reagentColor).replace('tool-ico', 'tool-ico" style="width:18px;height:18px;display:inline-block')}<span class="dot" style="background:${r.color}"></span>${esc(r.short)}</span>`)
      .join('');
  }

  // ── tools ──
  private reagentsOpen = false;
  private lastTools: ToolView[] = [];
  private lastItems: ItemView[] = [];

  private toolButton(t: ToolView, inPop = false): string {
    const d = TOOL_MAP[t.id];
    const tag = t.cost > 0 ? `<span class="tag cost">${t.cost}¢</span>` : t.auto && d.minigame !== 'instant' && d.minigame !== 'machine' ? '<span class="tag">AUTO</span>' : '';
    const ring = t.busy ? `<svg class="ring" viewBox="0 0 52 52"><circle cx="26" cy="26" r="22" fill="none" stroke="#ffd23f" stroke-width="5" stroke-dasharray="${(t.progress * 138).toFixed(1)} 200" transform="rotate(-90 26 26)"/></svg>` : '';
    return `<button class="tool ${inPop ? 'in-pop' : ''} ${t.used ? 'used' : ''} ${t.busy ? 'busy' : ''} ${t.hint ? 'hint' : ''}" data-act="tool" data-id="${t.id}" title="${esc(d.name)}: ${esc(d.desc)}">
      ${toolIcon(t.id, d.reagentColor)}${ring}<span>${esc(d.short)}</span>${tag}${t.used ? `<span class="check">${icon('check')}</span>` : ''}</button>`;
  }

  setTools(tools: ToolView[], items: ItemView[]): void {
    this.lastTools = tools;
    this.lastItems = items;
    const tray = $(this.root, '.tray');
    const reagents = tools.filter((t) => TOOL_MAP[t.id].station === 'reagents');
    const others = tools.filter((t) => TOOL_MAP[t.id].station !== 'reagents');
    // group the reagent drops behind one "Reagents" button once there are 2+
    const group = reagents.length >= 2;
    const firstReagentIdx = tools.findIndex((t) => TOOL_MAP[t.id].station === 'reagents');
    const parts: string[] = [];
    others.forEach((t) => {
      if (group && tools.indexOf(t) > firstReagentIdx && !parts.some((p) => p.includes('data-act="reagents"'))) parts.push(this.groupButton(reagents));
      parts.push(this.toolButton(t));
    });
    if (group && !parts.some((p) => p.includes('data-act="reagents"'))) parts.push(this.groupButton(reagents));
    if (!group) reagents.forEach((t) => parts.splice(Math.min(parts.length, firstReagentIdx), 0, this.toolButton(t)));
    tray.innerHTML = parts.join('');
    tray.classList.remove('two-rows');
    if (!document.body.classList.contains('portrait') && tray.offsetHeight > 120) {
      tray.classList.add('two-rows');
      tray.style.setProperty('--per-row', String(Math.ceil(tray.children.length / 2)));
    }
    document.documentElement.style.setProperty('--tray-real', `${tray.offsetHeight || 92}px`);
    this.onLayout();
    tray.querySelectorAll(':scope > button').forEach((b, i) => {
      if (i < 9) b.insertAdjacentHTML('afterbegin', `<span class="kbd">${i + 1}</span>`);
    });
    // reagent pop-up
    this.root.querySelector('.reagent-pop')?.remove();
    if (group && this.reagentsOpen) {
      const pop = h(`<div class="reagent-pop panel"><div class="pop-title">Reagent Rack</div><div class="pop-row">${reagents.map((t) => this.toolButton(t, true)).join('')}</div></div>`);
      pop.querySelectorAll('.tool').forEach((b, i) => b.insertAdjacentHTML('afterbegin', `<span class="kbd">${i + 1}</span>`));
      this.root.appendChild(pop);
      const btn = tray.querySelector('[data-act="reagents"]') as HTMLElement | null;
      if (btn) {
        const r = btn.getBoundingClientRect();
        const pr = this.root.getBoundingClientRect();
        const w = pop.offsetWidth;
        pop.style.left = `${Math.max(8, Math.min(pr.width - w - 8, r.left - pr.left + r.width / 2 - w / 2))}px`;
        pop.style.bottom = `${pr.bottom - r.top + 10}px`;
      }
    }
    // consumables live in their own little column
    let itemsEl = this.root.querySelector('.items') as HTMLElement | null;
    if (!itemsEl) {
      itemsEl = h('<div class="items"></div>');
      this.root.appendChild(itemsEl);
    }
    itemsEl.style.display = $(this.root, '.tray').style.display;
    itemsEl.innerHTML = items
      .map((it) => `<button class="item-btn ${it.count <= 0 && !it.ad ? 'empty' : ''}" data-act="item" data-id="${it.id}" title="${esc(it.name)}">${icon(it.id)}<span>${esc(it.name.split(' ')[0])}</span>${it.count > 0 ? `<span class="count">${it.count}</span>` : it.ad ? `<span class="count ad">AD</span>` : ''}</button>`)
      .join('');
  }

  private groupButton(reagents: ToolView[]): string {
    const left = reagents.filter((t) => !t.used).length;
    const hint = reagents.some((t) => t.hint);
    return `<button class="tool group ${left === 0 ? 'used' : ''} ${hint ? 'hint' : ''} ${this.reagentsOpen ? 'open' : ''}" data-act="reagents" title="Reagent Rack: drop tests">
      ${toolIcon('iodine', '#c7a6ff')}<span>Reagents</span><span class="tag">${left}/${reagents.length}</span>${left === 0 ? `<span class="check">${icon('check')}</span>` : ''}</button>`;
  }

  /** Buttons that number keys 1-9 map to (the reagent pop-up when it is open). */
  keyButtons(): HTMLElement[] {
    const pop = this.root.querySelector('.reagent-pop');
    return Array.from((pop ?? $(this.root, '.tray')).querySelectorAll(pop ? '.tool' : ':scope > button')) as HTMLElement[];
  }

  toggleReagents(open?: boolean): void {
    this.reagentsOpen = open ?? !this.reagentsOpen;
    this.setTools(this.lastTools, this.lastItems);
  }

  toolEl(id: ToolId): HTMLElement | null {
    return this.root.querySelector(`.tool[data-id="${id}"]`) ?? (TOOL_MAP[id].station === 'reagents' ? this.root.querySelector('.tool[data-act="reagents"]') : null);
  }

  setBusy(b: boolean): void {
    this.busy = b;
    $$(this.root, '.tool').forEach((t) => t.classList.toggle('disabled', b && !t.classList.contains('busy')));
  }

  // ── readings / floating ──
  showReading(r: Reading, ruled: number): void {
    this.parent.querySelector('.reading')?.remove();
    const d = TOOL_MAP[r.tool];
    const el = h(`<div class="reading panel"><div class="big-dot" style="background:${r.color}">${toolIcon(r.tool, d.reagentColor)}</div><div><div class="reading-tool">${esc(d.name)}</div><div class="reading-label">${esc(r.label)}</div>${r.flavor ? `<div class="reading-flavor">${esc(r.flavor)}</div>` : ''}<div class="reading-ruled">${ruled > 0 ? `${ruled} suspect${ruled === 1 ? '' : 's'} ruled out!` : 'No suspects ruled out this time.'}</div></div></div>`);
    this.parent.appendChild(el);
    window.clearTimeout(this.readingTimer);
    this.readingTimer = window.setTimeout(() => el.remove(), r.flavor ? 2600 : 2000);
  }

  float(text: string, x: number, y: number, color?: string, size?: number): void {
    floatText(this.parent, text, x, y, color, size);
  }

  say(text: string, x: number, y: number, ms = 2600): void {
    this.bubbleEl?.remove();
    const el = h(`<div class="bubble">${esc(text)}</div>`);
    el.style.left = `${Math.max(120, Math.min(window.innerWidth - 120, x))}px`;
    el.style.top = `${Math.max(90, y)}px`;
    this.parent.appendChild(el);
    this.bubbleEl = el;
    window.clearTimeout(this.bubbleTimer);
    this.bubbleTimer = window.setTimeout(() => el.remove(), ms);
  }

  // ── card detail ──
  openCard(
    sub: Substance,
    rows: CardRow[],
    fact: string | null,
    identify: { label: string; sub: string; enabled: boolean },
    onIdentify: () => void,
  ): void {
    const m = modal(
      this.parent,
      `<button class="btn icon small white close-x" data-act="close">${icon('close').replace(/#fff/g, '#22223b')}</button>
      <div class="sub-head">${swatchHtml(sub)}<div><div class="sub-name">${esc(sub.name)}</div><div class="sub-formula">${esc(sub.formula)} · ${esc(sub.look)}</div></div></div>
      <div style="font-size:13px;color:#4a4e69;margin:4px 0 2px">What each test would show for this substance:</div>
      <table class="ref-table">${rows
        .map((r) => `<tr class="${r.status}"><td><span class="ico-cell">${toolIcon(r.tool, TOOL_MAP[r.tool].reagentColor).replace('tool-ico', 'tool-ico" style="width:22px;height:22px;display:inline-block')}${esc(TOOL_MAP[r.tool].short)}</span></td><td><span class="dot" style="background:${r.color}"></span>${esc(r.label)}${r.status === 'match' ? ' ✓' : r.status === 'miss' ? ' ✗' : ''}</td></tr>`)
        .join('')}</table>
      ${fact ? `<div class="fact"><b>Fun fact:</b> ${esc(fact)}</div>` : ''}
      <div class="modal-actions"><button class="btn big ${identify.enabled ? 'yellow' : 'white'} identify-btn ${identify.enabled ? '' : 'disabled'}" data-act="identify">${esc(identify.label)}<small>${esc(identify.sub)}</small></button></div>`,
    );
    onAct(m.root, (act) => {
      if (act === 'close') m.close();
      if (act === 'identify') {
        m.close();
        onIdentify();
      }
    });
    m.root.querySelector('.dim-bg')?.addEventListener('click', () => m.close());
  }
}
