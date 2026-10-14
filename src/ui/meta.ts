import { audio } from '../core/audio';
import { daysBetween, fmtNum, todayKey } from '../core/util';
import { GAME } from '../config';
import { COSMETICS, EQUIPMENT, FREE_COINS_AD, FREE_COINS_COOLDOWN_MS, ITEMS, PERKS } from '../data/shop';
import { SKILLS, rankTitle, xpForRank } from '../data/skills';
import { SUBSTANCES } from '../data/substances';
import { TOOLS, TOOL_MAP } from '../data/tools';
import type { ToolId } from '../data/types';
import { referenceValue } from '../game/deduction';
import { $, confirmBox, esc, h, modal, onAct, swatchHtml, toast } from './dom';
import { icon, toolIcon } from './icons';
import type { Host } from './menus';
import { clearLayer } from './menus';

function topbar(host: Host, title: string, back: () => void): string {
  void back;
  return `<div class="topbar"><button class="btn icon small white" data-act="back">${icon('back').replace(/#fff/g, '#22223b')}</button><div class="screen-title">${esc(title)}</div><div class="spacer"></div><div class="pill coins-total">${icon('coin')}<span>${fmtNum(host.data.coins)}</span></div></div>`;
}

function refreshCoins(host: Host, root: HTMLElement): void {
  const el = root.querySelector('.coins-total span');
  if (el) el.textContent = fmtNum(host.data.coins);
}

function spend(host: Host, price: number): boolean {
  if (host.data.coins < price) {
    audio.play('error');
    toast(host.layer, 'Not enough coins! Play shifts or watch an ad for free coins.');
    return false;
  }
  host.data.coins -= price;
  audio.play('buy');
  host.persist();
  return true;
}

// ───────────────────────── shop ─────────────────────────
export function shopScreen(host: Host, tab = 'equip', back: () => void): void {
  clearLayer(host);
  const p = host.progress;
  const d = host.data;
  const reach = Math.max(1, p.highestCleared() + 1);
  const tabs: [string, string][] = [['equip', 'Equipment'], ['perks', 'Lab Perks'], ['items', 'Supplies'], ['style', 'Style']];
  let body = '';
  if (tab === 'equip') {
    body = EQUIPMENT.map((u) => {
      const owned = !!d.equip[u.id];
      const tool = TOOL_MAP[u.tools[0]];
      const locked = reach < u.minLevel || TOOLS.find((t) => t.id === u.tools[0])!.introLevel > reach;
      const needs = u.requires && !d.equip[u.requires];
      const iconHtml = u.tools.length > 2 ? toolIcon('iodine', '#c7a6ff') : toolIcon(tool.id, tool.reagentColor);
      return `<div class="shop-item panel ${owned ? 'owned' : ''} ${locked ? 'locked' : ''}">
        <div class="shop-item-head"><div class="shop-ico">${iconHtml}</div><div><div class="shop-tier">${u.tier === 3 ? 'TIER 3 · AUTO' : 'TIER 2 · PRO'}</div><div class="shop-name">${esc(u.name)}</div></div></div>
        <div class="shop-desc">${esc(u.desc)}</div>
        ${
          owned
            ? `<button class="btn green small disabled">${icon('check')} Owned</button>`
            : locked
              ? `<button class="btn white small disabled">${icon('lock')} Unlocks at shift ${Math.max(u.minLevel, tool.introLevel)}</button>`
              : needs
                ? `<button class="btn white small disabled">Needs ${esc(EQUIPMENT.find((x) => x.id === u.requires)!.name)}</button>`
                : `<button class="btn yellow small" data-act="buy-equip" data-id="${u.id}">${icon('coin')} ${fmtNum(u.price)}</button>`
        }</div>`;
    }).join('');
  } else if (tab === 'perks') {
    body = PERKS.map((pk) => {
      const owned = !!d.perks[pk.id];
      const locked = reach < pk.minLevel;
      return `<div class="shop-item panel ${owned ? 'owned' : ''} ${locked ? 'locked' : ''}">
        <div class="shop-item-head"><div class="shop-ico">${icon(perkIcon(pk.id))}</div><div><div class="shop-tier">LAB PERK</div><div class="shop-name">${esc(pk.name)}</div></div></div>
        <div class="shop-desc">${esc(pk.desc)}</div>
        ${owned ? `<button class="btn green small disabled">${icon('check')} Installed</button>` : locked ? `<button class="btn white small disabled">${icon('lock')} Unlocks at shift ${pk.minLevel}</button>` : `<button class="btn yellow small" data-act="buy-perk" data-id="${pk.id}">${icon('coin')} ${fmtNum(pk.price)}</button>`}
      </div>`;
    }).join('');
  } else if (tab === 'items') {
    body = ITEMS.map((it) => `<div class="shop-item panel">
        <div class="shop-item-head"><div class="shop-ico">${icon(it.id)}</div><div><div class="shop-tier">YOU HAVE ${d.items[it.id] ?? 0}</div><div class="shop-name">${esc(it.name)}</div></div></div>
        <div class="shop-desc">${esc(it.desc)}</div>
        <div style="display:flex;gap:6px"><button class="btn yellow small" style="flex:1" data-act="buy-item" data-id="${it.id}" data-n="1">${icon('coin')} ${it.price}</button><button class="btn yellow small" style="flex:1" data-act="buy-item" data-id="${it.id}" data-n="5">5 for ${icon('coin')} ${it.price * 4}</button></div>
      </div>`).join('');
  } else {
    body = COSMETICS.map((c) => {
      const owned = !!d.cosmetics[c.id];
      const equipped = d.hat === c.id || d.theme === c.id;
      const preview = c.kind === 'theme' ? `<div style="display:flex;gap:3px">${c.colors!.map((x) => `<span style="width:14px;height:40px;border-radius:5px;background:${x};border:2px solid #22223b"></span>`).join('')}</div>` : icon('rat');
      return `<div class="shop-item panel ${equipped ? 'owned' : ''}">
        <div class="shop-item-head"><div class="shop-ico">${preview}</div><div><div class="shop-tier">${c.kind === 'hat' ? "GERALD'S HAT" : 'LAB THEME'}</div><div class="shop-name">${esc(c.name)}</div></div></div>
        <div class="shop-desc">${esc(c.desc)}</div>
        ${equipped ? `<button class="btn green small disabled">${icon('check')} Equipped</button>` : owned ? `<button class="btn small" data-act="equip-style" data-id="${c.id}">Equip</button>` : `<button class="btn yellow small" data-act="buy-style" data-id="${c.id}">${icon('coin')} ${fmtNum(c.price)}</button>`}
      </div>`;
    }).join('');
  }
  const cooldown = Math.max(0, FREE_COINS_COOLDOWN_MS - (Date.now() - d.lastFreeCoins));
  const el = h(`<div class="screen meta-screen">${topbar(host, 'Lab Shop', back)}
    <div class="meta-body">
      ${host.rewardedAvailable ? `<div class="free-coins"><button class="btn purple ${cooldown > 0 ? 'disabled' : 'pulse'}" data-act="free">${icon('ad')} Free ${FREE_COINS_AD} coins${cooldown > 0 ? ` (in ${Math.ceil(cooldown / 60000)} min)` : ''}</button></div>` : ''}
      <div class="tabs">${tabs.map(([id, name]) => `<button class="tab ${id === tab ? 'active' : ''}" data-act="tab" data-tab="${id}">${name}</button>`).join('')}</div>
      <div class="shop-grid">${body}</div>
    </div></div>`);
  host.layer.appendChild(el);
  onAct(el, async (act, t) => {
    const id = t.dataset.id!;
    if (act === 'back') back();
    if (act === 'tab') shopScreen(host, t.dataset.tab, back);
    if (act === 'buy-equip') {
      const u = EQUIPMENT.find((x) => x.id === id)!;
      if (spend(host, u.price)) {
        d.equip[id] = true;
        host.persist();
        toast(host.layer, `${u.name} installed!`);
        shopScreen(host, tab, back);
      }
    }
    if (act === 'buy-perk') {
      const pk = PERKS.find((x) => x.id === id)!;
      if (spend(host, pk.price)) {
        d.perks[id] = true;
        host.persist();
        toast(host.layer, `${pk.name} installed!`);
        shopScreen(host, tab, back);
      }
    }
    if (act === 'buy-item') {
      const it = ITEMS.find((x) => x.id === id)!;
      const n = Number(t.dataset.n);
      const price = n === 5 ? it.price * 4 : it.price;
      if (spend(host, price)) {
        d.items[it.id] = (d.items[it.id] ?? 0) + n;
        host.persist();
        shopScreen(host, tab, back);
      }
    }
    if (act === 'buy-style') {
      const c = COSMETICS.find((x) => x.id === id)!;
      if (spend(host, c.price)) {
        d.cosmetics[id] = true;
        if (c.kind === 'hat') d.hat = id;
        else d.theme = id;
        host.persist();
        shopScreen(host, tab, back);
      }
    }
    if (act === 'equip-style') {
      const c = COSMETICS.find((x) => x.id === id)!;
      if (c.kind === 'hat') d.hat = id;
      else d.theme = id;
      host.persist();
      shopScreen(host, tab, back);
    }
    if (act === 'free') {
      const ok = await host.rewarded();
      if (ok) {
        d.coins += FREE_COINS_AD;
        d.lastFreeCoins = Date.now();
        host.persist();
        audio.play('cash');
        toast(host.layer, `+${FREE_COINS_AD} coins!`);
        shopScreen(host, tab, back);
      }
    }
    refreshCoins(host, el);
  });
}

function perkIcon(id: string): string {
  return ({ coffee: 'espresso', chair: 'home', hood: 'leaf', blanket: 'extinguisher', shower: 'heart', training: 'rat', cat: 'coin', trophy: 'trophy' } as Record<string, string>)[id] ?? 'star';
}

// ───────────────────────── skills ─────────────────────────
export function skillsScreen(host: Host, back: () => void): void {
  clearLayer(host);
  const p = host.progress;
  const r = p.rank();
  const lo = xpForRank(r);
  const hi = xpForRank(r + 1);
  const el = h(`<div class="screen meta-screen">${topbar(host, 'Skills', back)}
    <div class="meta-body">
      <div class="panel" style="max-width:720px;margin:0 auto 12px;padding:12px 14px">
        <div class="rank-line"><span>${icon('trophy').replace('<svg', '<svg style="width:22px;height:22px;vertical-align:-5px"')} ${esc(rankTitle(r))}</span><span>Rank ${r + 1}</span></div>
        <div class="xpbar"><div style="width:${Math.min(100, ((host.data.xp - lo) / (hi - lo)) * 100)}%"></div><span>${fmtNum(host.data.xp - lo)} / ${fmtNum(hi - lo)} XP</span></div>
      </div>
      <div class="skill-points">${p.skillPointsFree()} skill point${p.skillPointsFree() === 1 ? '' : 's'} available · earn more by ranking up</div>
      ${SKILLS.map((s) => {
        const rank = p.skill(s.id);
        return `<div class="skill-row panel"><div class="skill-info"><div class="skill-name">${esc(s.name)}</div><div class="skill-desc">${esc(rank > 0 ? s.desc(rank) : s.desc(1))}${rank < s.max && rank > 0 ? ` → next: ${esc(s.desc(rank + 1))}` : ''}</div>
          <div class="pips">${Array.from({ length: s.max }, (_, i) => `<span class="pip ${i < rank ? 'on' : ''}"></span>`).join('')}</div></div>
          <button class="btn purple small ${p.canRaiseSkill(s.id) ? '' : 'disabled'}" data-act="raise" data-id="${s.id}">${rank >= s.max ? 'MAX' : '+1'}</button></div>`;
      }).join('')}
      <div style="text-align:center;margin-top:8px"><button class="btn white small" data-act="respec">Reset skills (free)</button></div>
    </div></div>`);
  host.layer.appendChild(el);
  onAct(el, async (act, t) => {
    if (act === 'back') back();
    if (act === 'raise') {
      const id = t.dataset.id!;
      if (p.canRaiseSkill(id)) {
        host.data.skills[id] = p.skill(id) + 1;
        audio.play('levelup');
        host.persist();
        skillsScreen(host, back);
      }
    }
    if (act === 'respec') {
      if (await confirmBox(host.layer, 'Reset skills?', 'All skill points will be refunded so you can try a new build.', 'Reset')) {
        host.data.skills = {};
        host.persist();
        skillsScreen(host, back);
      }
    }
  });
}

// ───────────────────────── chem dex ─────────────────────────
export function dexScreen(host: Host, back: () => void): void {
  clearLayer(host);
  const d = host.data;
  const found = SUBSTANCES.filter((s) => d.dex[s.id]).length;
  const el = h(`<div class="screen meta-screen">${topbar(host, 'Chem Dex', back)}
    <div class="meta-body">
      <div class="dex-progress">${found} / ${SUBSTANCES.length} substances identified</div>
      <div class="dex-grid">${SUBSTANCES.map((s) =>
        d.dex[s.id]
          ? `<div class="dex-card panel" data-act="sub" data-id="${s.id}">${swatchHtml(s)}${esc(s.name)}</div>`
          : `<div class="dex-card panel unknown">${icon('question').replace('<svg', '<svg style="width:46px;height:46px;opacity:.5"')}???</div>`,
      ).join('')}</div>
    </div></div>`);
  host.layer.appendChild(el);
  onAct(el, (act, t) => {
    if (act === 'back') back();
    if (act === 'sub') {
      const s = SUBSTANCES.find((x) => x.id === t.dataset.id)!;
      const tools = TOOLS.filter((x) => x.introLevel <= Math.max(1, host.progress.highestCleared() + 1));
      const m = modal(
        host.layer,
        `<button class="btn icon small white close-x" data-act="close">${icon('close').replace(/#fff/g, '#22223b')}</button>
        <div class="sub-head">${swatchHtml(s)}<div><div class="sub-name">${esc(s.name)}</div><div class="sub-formula">${esc(s.formula)} · ${esc(s.look)}</div></div></div>
        <div style="font-size:13px;color:#4a4e69">Identified ${d.dex[s.id]} time${d.dex[s.id] === 1 ? '' : 's'}${s.fictional ? ' · (not a real substance!)' : ''}</div>
        <table class="ref-table">${tools.map((tl) => {
          const r = referenceValue(tl.id as ToolId, host.progress.toolTier(tl.id), s);
          return `<tr><td><span class="ico-cell">${toolIcon(tl.id, tl.reagentColor).replace('tool-ico', 'tool-ico" style="width:22px;height:22px;display:inline-block')}${esc(tl.short)}</span></td><td><span class="dot" style="background:${r.color}"></span>${esc(r.label)}</td></tr>`;
        }).join('')}</table>
        <div class="fact"><b>Fun fact:</b> ${esc(s.fact)}</div>`,
      );
      onAct(m.root, (a) => a === 'close' && m.close());
      m.root.querySelector('.dim-bg')?.addEventListener('click', () => m.close());
    }
  });
}

// ───────────────────────── settings ─────────────────────────
export function settingsModal(host: Host, apply: () => void, onReset: () => void): void {
  const s = host.data.settings;
  const m = modal(
    host.layer,
    `<button class="btn icon small white close-x" data-act="close">${icon('close').replace(/#fff/g, '#22223b')}</button>
    <h2 class="modal-title">Settings</h2>
    <div class="set-row">${icon('music').replace('<svg', '<svg style="width:28px;height:28px"')} Music <input type="range" min="0" max="1" step="0.05" value="${s.music}" data-k="music"></div>
    <div class="set-row">${icon('speaker').replace('<svg', '<svg style="width:28px;height:28px"')} Sound FX <input type="range" min="0" max="1" step="0.05" value="${s.sfx}" data-k="sfx"></div>
    <div class="set-row">Graphics <div class="seg">${(['auto', 'low', 'high'] as const).map((q) => `<button class="${s.quality === q ? 'on' : ''}" data-act="q" data-q="${q}">${q[0].toUpperCase() + q.slice(1)}</button>`).join('')}</div></div>
    <div class="set-row">Screen shake <div class="seg"><button class="${s.shake ? 'on' : ''}" data-act="shake" data-v="1">On</button><button class="${!s.shake ? 'on' : ''}" data-act="shake" data-v="0">Off</button></div></div>
    <div class="modal-actions"><button class="btn red small" data-act="reset">Reset all progress</button></div>
    <div class="credits">${esc(GAME.title)} v${GAME.version}\n${esc(GAME.credits)}</div>`,
  );
  m.root.querySelectorAll('input[type=range]').forEach((inp) =>
    inp.addEventListener('input', (e) => {
      const el = e.target as HTMLInputElement;
      (s as any)[el.dataset.k!] = Number(el.value);
      apply();
      host.persist();
    }),
  );
  m.root.querySelectorAll('input[type=range]').forEach((inp) => inp.addEventListener('change', () => audio.play('click')));
  onAct(m.root, async (act, t) => {
    if (act === 'close') m.close();
    if (act === 'q') {
      s.quality = t.dataset.q as any;
      m.root.querySelectorAll('[data-act=q]').forEach((b) => b.classList.toggle('on', b === t));
      apply();
      host.persist();
    }
    if (act === 'shake') {
      s.shake = t.dataset.v === '1';
      m.root.querySelectorAll('[data-act=shake]').forEach((b) => b.classList.toggle('on', b === t));
      apply();
      host.persist();
    }
    if (act === 'reset') {
      if (await confirmBox(host.layer, 'Reset everything?', 'All coins, stars, upgrades and skills will be erased. This cannot be undone!', 'Erase it all')) {
        m.close();
        onReset();
      }
    }
  });
}

// ───────────────────────── daily reward ─────────────────────────
export const DAILY_REWARDS = [100, 150, 200, 250, 300, 400, 750];

export function dailyStatus(host: Host): { available: boolean; day: number } {
  const d = host.data.daily;
  const today = todayKey();
  if (d.last === today) return { available: false, day: d.streak };
  const gap = d.last ? daysBetween(d.last, today) : 99;
  const day = gap === 1 ? (d.streak % 7) + 1 : 1;
  return { available: true, day };
}

export function dailyModal(host: Host, onDone: () => void): void {
  const st = dailyStatus(host);
  const day = st.available ? st.day : host.data.daily.streak;
  const m = modal(
    host.layer,
    `<button class="btn icon small white close-x" data-act="close">${icon('close').replace(/#fff/g, '#22223b')}</button>
    <h2 class="modal-title">Daily Bonus</h2>
    <p class="modal-sub">${st.available ? 'Come back every day for bigger rewards!' : 'Already claimed today — see you tomorrow!'}</p>
    <div class="daily-grid">${DAILY_REWARDS.map((c, i) => `<div class="day ${i + 1 < day || (!st.available && i + 1 === day) ? 'done' : ''} ${st.available && i + 1 === day ? 'today' : ''}">Day ${i + 1}<br>${icon(i === 6 ? 'gift' : 'coin')}<br>${c}</div>`).join('')}</div>
    <div class="modal-actions">
      ${st.available ? `<button class="btn yellow big" data-act="claim">${icon('coin')} Claim ${DAILY_REWARDS[day - 1]}</button>${host.rewardedAvailable ? `<button class="btn purple big" data-act="claim2">${icon('ad')} Claim x2</button>` : ''}` : `<button class="btn" data-act="close">OK</button>`}
    </div>`,
  );
  const claim = (mult: number) => {
    const amount = DAILY_REWARDS[day - 1] * mult;
    host.data.coins += amount;
    host.data.daily = { last: todayKey(), streak: day };
    if (day === 7) host.data.items.hint = (host.data.items.hint ?? 0) + 2;
    host.persist();
    audio.play('cash');
    toast(host.layer, `+${amount} coins!${day === 7 ? ' +2 Lab Notes!' : ''}`);
    m.close();
    onDone();
  };
  onAct(m.root, async (act, el) => {
    if (act === 'close') {
      m.close();
      onDone();
    }
    if (act === 'claim') claim(1);
    if (act === 'claim2') {
      el.classList.add('disabled');
      if (await host.rewarded()) claim(2);
      else el.classList.remove('disabled');
    }
  });
  void $;
}
