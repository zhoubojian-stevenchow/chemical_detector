import { audio } from '../core/audio';
import type { SaveData } from '../core/save';
import { fmtNum, todayKey, wait } from '../core/util';
import { CHAPTERS, LEVELS, getLevel } from '../data/levels';
import { getCase } from '../data/cases';
import { getClient } from '../data/clients';
import { rankTitle, xpForRank } from '../data/skills';
import { MOD_INFO, TIPS } from '../data/text';
import { TOOLS } from '../data/tools';
import { GAME } from '../config';
import type { Progress } from '../game/progress';
import { parFraction, type ShiftResult } from '../game/shift';
import { $, avatarHtml, countUp, esc, h, modal, onAct, toast } from './dom';
import { icon, toolIcon } from './icons';

export interface Host {
  layer: HTMLElement;
  progress: Progress;
  data: SaveData;
  rewardedAvailable: boolean;
  showTitle(): void;
  showMap(chapter?: number): void;
  showShop(tab?: string): void;
  showSkills(): void;
  showDex(): void;
  showAchievements(): void;
  showSettings(onClose?: () => void): void;
  openDaily(): void;
  openLevel(id: number): void;
  startLevel(id: number): void;
  startEndless(): void;
  startDailyCase(): void;
  rewarded(): Promise<boolean>;
  persist(): void;
  dailyAvailable(): boolean;
  dailyCaseAvailable(): boolean;
  playPressed(): Promise<void>;
}

export function howToPlay(host: Host): void {
  const steps: [string, string][] = [
    ['question', 'A client brings a mystery sample. The <b>Suspects</b> list shows what it could be.'],
    ['flame', 'Run tests from the tray. Each test is a quick skill game — nail it for a <b>PERFECT</b> combo bonus.'],
    ['check', 'Every reading stamps <b>RULED OUT</b> on suspects that don\'t match. Tap any suspect to see what each test <i>should</i> show.'],
    ['star', 'Tap the last suspect and press <b>IDENTIFY</b> — or make a risky <b>Bold Call</b> early for bigger pay.'],
    ['heart', 'Botched tests can backfire (fires, fumes!) and wrong reports cost hearts. Run out of hearts or time and the shift fails.'],
    ['cart', 'Spend coins on upgrades, perks and items. Rank up to unlock skills. Collect all substances in the <b>Chem Dex</b>!'],
  ];
  const m = modal(
    host.layer,
    `<button class="btn icon small white close-x" data-act="close">${icon('close').replace(/#fff/g, '#22223b')}</button>
    <h2 class="modal-title">How to play</h2>
    <div class="objectives">${steps.map(([ic, t]) => `<div class="objective">${ic === 'flame' ? toolIcon('flame') : ic === 'question' ? icon(ic) : icon(ic).replace(/#fff"/g, '#22223b"')}<span>${t}</span></div>`).join('')}</div>
    <p class="modal-sub" style="font-size:14px">Keyboard: <b>1–9</b> tools · <b>Space</b> mini-games · <b>Esc</b> pause</p>
    <div class="modal-actions"><button class="btn yellow big" data-act="close">Got it!</button></div>`,
  );
  onAct(m.root, (act) => act === 'close' && m.close());
}

export function clearLayer(host: Host): void {
  // keep transient notices (toasts, achievement banners) alive across screen changes
  for (const el of [...host.layer.children]) if (!el.matches('.toast, .ach-banner')) el.remove();
}

function pill(iconName: string, value: string, cls = ''): string {
  return `<div class="pill ${cls}">${icon(iconName)}<span>${value}</span></div>`;
}

// ───────────────────────── title ─────────────────────────
export function titleScreen(host: Host): void {
  clearLayer(host);
  const p = host.progress;
  const endlessLocked = p.highestCleared() < 10;
  const dailyLocked = p.highestCleared() < 5;
  const el = h(`<div class="screen title-screen">
    <div style="width:100%;display:flex;justify-content:space-between;align-items:center">
      ${pill('star', String(p.totalStars()))}
      ${pill('coin', fmtNum(host.data.coins))}
    </div>
    <div class="logo"><div class="logo-main">${titleHtml()}</div><div class="logo-sub">${esc(GAME.subtitle)}</div></div>
    <div class="title-buttons">
      <button class="btn big yellow pulse" data-act="play">${icon('play').replace('#fff', '#22223b')} ${p.highestCleared() > 0 ? 'CONTINUE' : 'PLAY'}</button>
      <div class="title-row">
        <button class="btn purple ${endlessLocked ? 'disabled' : ''}" data-act="endless"${endlessLocked ? ' data-locked="Clear level 10 to unlock Rush Hour!"' : ''}>${icon(endlessLocked ? 'lock' : 'infinity')} Rush Hour</button>
        <button class="btn blue ${dailyLocked ? 'disabled' : ''}" data-act="dailycase"${dailyLocked ? ' data-locked="Clear level 5 to unlock the Daily Case!"' : ''}>${icon(dailyLocked ? 'lock' : 'calendar')} Daily Case${host.dailyCaseAvailable() && !dailyLocked ? ' !' : ''}</button>
      </div>
      <div class="title-row">
        <button class="btn icon white" data-act="shop" title="Shop">${icon('cart')}</button>
        <button class="btn icon white" data-act="skills" title="Skills" style="position:relative">${icon('brain')}${p.skillPointsFree() > 0 ? `<span class="badge-dot">${p.skillPointsFree()}</span>` : ''}</button>
        <button class="btn icon white" data-act="dex" title="Chem Dex">${icon('book')}</button>
        <button class="btn icon white" data-act="ach" title="Achievements">${icon('trophy')}</button>
        <button class="btn icon white" data-act="settings" title="Settings">${icon('gear')}</button>
        <button class="btn icon white" data-act="help" title="How to play">${icon('question')}</button>
      </div>
      <div class="title-foot">v${GAME.version} · ${esc(GAME.company)}</div>
    </div>
  </div>`);
  host.layer.appendChild(el);
  onAct(el, (act) => {
    if (act === 'play') void host.playPressed();
    if (act === 'help') howToPlay(host);
    if (act === 'endless') host.startEndless();
    if (act === 'dailycase') host.startDailyCase();
    if (act === 'shop') host.showShop();
    if (act === 'skills') host.showSkills();
    if (act === 'dex') host.showDex();
    if (act === 'ach') host.showAchievements();
    if (act === 'settings') host.showSettings();
  });
}

function titleHtml(): string {
  const parts = GAME.title.split(' ');
  if (parts.length < 2) return esc(GAME.title);
  return `${esc(parts[0])}<br><span class="accent">${esc(parts.slice(1).join(' '))}</span>`;
}

function lockedToast(host: Host, text: string): void {
  toast(host.layer, text);
}

// ───────────────────────── map ─────────────────────────
export function mapScreen(host: Host, chapter: number): void {
  clearLayer(host);
  const p = host.progress;
  const ch = CHAPTERS[chapter - 1];
  const unlocked = p.chapterUnlocked(chapter);
  const levels = LEVELS.filter((l) => l.chapter === chapter);
  const next = p.nextLevel();
  const chStars = levels.reduce((a, l) => a + p.starsFor(l.id), 0);
  const el = h(`<div class="screen meta-screen">
    <div class="topbar">
      <button class="btn icon small white" data-act="back">${icon('back').replace(/#fff/g, '#22223b')}</button>
      <div class="screen-title">Case Files</div><div class="spacer"></div>
      ${pill('star', String(p.totalStars()))}${pill('coin', fmtNum(host.data.coins))}
    </div>
    <div class="meta-body">
      <div class="chapter-tabs">${CHAPTERS.map((c) => `<button class="chapter-tab ${c.id === chapter ? 'active' : ''} ${p.chapterUnlocked(c.id) ? '' : 'locked'}" data-act="chapter" data-ch="${c.id}">${p.chapterUnlocked(c.id) ? c.id : icon('lock')}</button>`).join('')}</div>
      <div class="chapter-card panel">
        <div class="chapter-head"><div class="chapter-badge" style="background:${ch.color}">${icon(ch.icon)}</div>
          <div><div class="chapter-name">Chapter ${ch.id}: ${esc(ch.name)}</div><div class="chapter-sub">${esc(ch.subtitle)}</div></div>
          <div class="chapter-stars chip">${icon('star')} ${chStars}/30</div></div>
        ${
          unlocked
            ? `<div class="level-grid">${levels
                .map((l) => {
                  const open = p.levelUnlocked(l.id);
                  const stars = p.d.levels[l.id]?.stars ?? [false, false, false];
                  const boss = (l.mods ?? []).includes('boss');
                  const cur = open && l.id === next;
                  return `<div class="level-node ${open ? '' : 'locked'} ${boss ? 'boss' : ''} ${cur ? 'current' : ''}" data-act="level" data-id="${l.id}">
                    <div class="level-btn">${open ? l.id : icon('lock')}</div>
                    <div class="mini-stars">${stars.map((s) => icon(s ? 'star' : 'starEmpty')).join('')}</div></div>`;
                })
                .join('')}</div>`
            : `<div class="lock-note">${icon('lock')}<br>Chapter locked<br><span style="font-size:15px;font-weight:500">Beat the chapter ${ch.id - 1} boss and collect <b>${ch.starsToUnlock}</b> stars (you have ${p.totalStars()}).<br>Replay earlier shifts for more stars!</span></div>`
        }
      </div>
    </div>
    <div class="map-nav">
      <button class="btn white nav-btn" data-act="shop">${icon('cart')}Shop</button>
      <button class="btn white nav-btn" data-act="skills">${icon('brain')}Skills${p.skillPointsFree() > 0 ? `<span class="badge-dot">${p.skillPointsFree()}</span>` : ''}</button>
      <button class="btn white nav-btn" data-act="dex">${icon('book')}Chem Dex</button>
      <button class="btn white nav-btn" data-act="ach">${icon('trophy')}Awards</button>
      <button class="btn white nav-btn" data-act="daily">${icon('gift')}Daily${host.dailyAvailable() ? '<span class="badge-dot">!</span>' : ''}</button>
      <button class="btn white nav-btn ${p.highestCleared() < 10 ? 'disabled' : ''}" data-act="endless"${p.highestCleared() < 10 ? ' data-locked="Clear level 10 to unlock Rush Hour!"' : ''}>${icon('infinity')}Rush</button>
    </div>
  </div>`);
  host.layer.appendChild(el);
  onAct(el, (act, t) => {
    if (act === 'back') host.showTitle();
    if (act === 'chapter') mapScreen(host, Number(t.dataset.ch));
    if (act === 'level') {
      const id = Number(t.dataset.id);
      if (p.levelUnlocked(id)) {
        audio.play('click');
        host.openLevel(id);
      } else {
        audio.play('error');
        lockedToast(host, 'Finish the previous shift first!');
      }
    }
    if (act === 'shop') host.showShop();
    if (act === 'skills') host.showSkills();
    if (act === 'dex') host.showDex();
    if (act === 'daily') host.openDaily();
    if (act === 'ach') host.showAchievements();
    if (act === 'endless') host.startEndless();
  });
}

// ───────────────────────── level intro ─────────────────────────
export function levelIntro(host: Host, id: number): void {
  const l = getLevel(id);
  const ch = CHAPTERS[l.chapter - 1];
  const p = host.progress;
  const rec = p.d.levels[id];
  const newTools = TOOLS.filter((t) => t.introLevel === id);
  const clients = [...new Set(l.cases.map((c) => getCase(c).client))].map(getClient);
  const mods = (l.mods ?? []).map((m) => (m.startsWith('broken:') ? { ...MOD_INFO.broken, name: `${TOOLS.find((t) => t.id === m.slice(7))?.name ?? 'Tool'} broken` } : MOD_INFO[m]));
  const stars = rec?.stars ?? [false, false, false];
  const m = modal(
    host.layer,
    `<button class="btn icon small white close-x" data-act="close">${icon('close').replace(/#fff/g, '#22223b')}</button>
    <div style="text-align:center;font-weight:700;color:${ch.color};-webkit-text-stroke:0">Shift ${id} · ${esc(ch.name)}</div>
    <h2 class="modal-title">${esc(l.title)}</h2>
    <p class="modal-sub">${esc(l.blurb)}</p>
    ${newTools.map((t) => `<div class="new-tool">${toolIcon(t.id, t.reagentColor)}<div><div style="font-size:13px;color:#7b5cff">NEW EQUIPMENT!</div><div style="font-size:18px">${esc(t.name)}</div><div style="font-size:14px;font-weight:500">${esc(t.desc)}</div></div></div>`).join('')}
    ${mods.length ? `<div class="mods">${mods.map((x) => `<span class="chip mod-chip" style="background:${x.color}">${esc(x.name)} · ${esc(x.desc)}</span>`).join('')}</div>` : ''}
    <div class="clients-row">${clients.map((c) => `<div style="display:flex;flex-direction:column;align-items:center;font-size:12px;font-weight:600;width:76px;text-align:center">${avatarHtml(c)}${esc(c.name)}</div>`).join('')}</div>
    <div class="objectives">
      <div class="objective">${icon(stars[0] ? 'star' : 'starEmpty')} ${l.cases.length > 1 ? `Solve all ${l.cases.length} cases` : 'Solve the case'} before the clock runs out</div>
      <div class="objective">${icon(stars[1] ? 'star' : 'starEmpty')} Flawless: no wrong reports, no accidents</div>
      <div class="objective">${icon(stars[2] ? 'star' : 'starEmpty')} Speedy: finish with ${Math.round(parFraction(id) * 100)}% of the clock left</div>
    </div>
    <div style="text-align:center;font-size:13px;color:#4a4e69">${esc(TIPS[(id * 7) % TIPS.length])}</div>
    <div class="modal-actions"><button class="btn big yellow pulse" data-act="start">${icon('play').replace('#fff', '#22223b')} START SHIFT</button></div>`,
  );
  onAct(m.root, (act) => {
    if (act === 'close') m.close();
    if (act === 'start') {
      m.close();
      host.startLevel(id);
    }
  });
}

// ───────────────────────── pause ─────────────────────────
export function pauseMenu(host: Host, cb: { resume(): void; restart(): void; quit(): void }): void {
  const m = modal(
    host.layer,
    `<h2 class="modal-title">Paused</h2><p class="modal-sub">The samples will wait. Probably.</p>
    <div style="display:flex;flex-direction:column;gap:12px;align-items:stretch;max-width:300px;margin:0 auto">
      <button class="btn big yellow" data-act="resume">${icon('play').replace('#fff', '#22223b')} Resume</button>
      <button class="btn" data-act="restart">${icon('replay')} Restart shift</button>
      <button class="btn white" data-act="settings">${icon('gear')} Settings</button>
      <button class="btn red" data-act="quit">${icon('map')} Quit to map</button>
    </div>`,
    { cls: 'pause-modal' },
  );
  onAct(m.root, (act) => {
    if (act === 'resume') {
      m.close();
      cb.resume();
    }
    if (act === 'restart') {
      m.close();
      cb.restart();
    }
    if (act === 'quit') {
      m.close();
      cb.quit();
    }
    if (act === 'settings') host.showSettings();
  });
}

// ───────────────────────── results ─────────────────────────
export interface ResultsOpts {
  title: string;
  result: ShiftResult;
  xpBefore: number;
  xpAfter: number;
  newDex: number;
  hasNext: boolean;
  endless?: { score: number; best: number; isBest: boolean };
  daily?: { bonus: number };
  firstClear: boolean;
}

export function resultsModal(host: Host, o: ResultsOpts, cb: { double(): Promise<boolean>; next(): void; retry(): void; map(): void }): void {
  const r = o.result;
  const starLabels = ['Shift cleared', 'Flawless', 'Speedy'];
  const endless = !!o.endless;
  const m = modal(
    host.layer,
    `<h2 class="modal-title" style="font-size:32px">${esc(o.title)}</h2>
    ${
      endless
        ? `<p class="modal-sub" style="font-size:20px">Cases solved: <b>${o.endless!.score}</b> · Best: <b>${o.endless!.best}</b>${o.endless!.isBest ? ' — NEW RECORD!' : ''}</p>`
        : `<div class="stars-row">${r.stars.map((s, i) => `<div class="star-slot ${s ? 'on' : 'off'}" style="animation-delay:${0.3 + i * 0.35}s">${icon('star').replace('<svg', `<svg style="animation-delay:${0.3 + i * 0.35}s"`)}${starLabels[i]}</div>`).join('')}</div>`
    }
    <div class="res-lines">
      ${endless ? '' : `<div class="res-line"><span>Cases solved</span><b>${r.correct} / ${r.total}</b></div>`}
      <div class="res-line"><span>Client fees</span><b>${icon('coin')} ${fmtNum(r.caseCoins)}</b></div>
      ${r.timeBonus ? `<div class="res-line"><span>Time bonus</span><b>${icon('coin')} ${fmtNum(r.timeBonus)}</b></div>` : ''}
      ${r.flawlessBonus ? `<div class="res-line"><span>Flawless bonus</span><b>${icon('coin')} ${fmtNum(r.flawlessBonus)}</b></div>` : ''}
      ${o.daily ? `<div class="res-line"><span>Daily case bonus</span><b>${icon('coin')} ${fmtNum(o.daily.bonus)}</b></div>` : ''}
      ${o.newDex ? `<div class="res-line"><span>New Chem Dex entries</span><b>${icon('book')} +${o.newDex}</b></div>` : ''}
    </div>
    <div class="res-total">${icon('coin')}<span class="total-val">0</span></div>
    <div class="rank-line"><span class="rank-name">${esc(rankTitle(host.progress.rank()))}</span><span>+${r.xp} XP</span></div>
    <div class="xpbar"><div style="width:0%"></div><span class="xp-text"></span></div>
    <div class="modal-actions">
      ${host.rewardedAvailable && (r.totalCoins + (o.daily?.bonus ?? 0)) > 0 ? `<button class="btn purple pulse" data-act="double">${icon('ad')} x2 COINS</button>` : ''}
      <button class="btn white" data-act="map">${icon('map')} Map</button>
      <button class="btn" data-act="retry">${icon('replay')} ${endless ? 'Again' : 'Retry'}</button>
      ${o.hasNext ? `<button class="btn yellow big" data-act="next">Next ${icon('next').replace(/#fff/g, '#22223b')}</button>` : ''}
    </div>`,
  );
  const totalEl = $(m.box, '.total-val');
  const total = r.totalCoins + (o.daily?.bonus ?? 0);
  void (async () => {
    if (!endless) for (let i = 0; i < 3; i++) setTimeout(() => r.stars[i] && audio.play('star', i), 300 + i * 350);
    await wait(endless ? 200 : 1200);
    await countUp(totalEl, 0, total, 900);
    animateXp(host, m.box, o.xpBefore, o.xpAfter);
  })();
  let doubled = false;
  onAct(m.root, async (act, el) => {
    if (act === 'double' && !doubled) {
      el.classList.add('disabled');
      const ok = await cb.double();
      if (ok) {
        doubled = true;
        el.remove();
        audio.play('cash');
        await countUp(totalEl, total, total * 2, 700);
      } else el.classList.remove('disabled');
    }
    if (act === 'next') {
      m.close();
      cb.next();
    }
    if (act === 'retry') {
      m.close();
      cb.retry();
    }
    if (act === 'map') {
      m.close();
      cb.map();
    }
  });
}

function animateXp(host: Host, box: HTMLElement, before: number, after: number): void {
  const p = host.progress;
  const r = p.rank();
  const lo = xpForRank(r);
  const hi = xpForRank(r + 1);
  const bar = $(box, '.xpbar > div');
  const txt = $(box, '.xp-text');
  const startK = Math.max(0, (before - lo) / (hi - lo));
  bar.style.transition = 'none';
  bar.style.width = `${startK * 100}%`;
  void bar.offsetWidth;
  bar.style.transition = '';
  bar.style.width = `${Math.min(1, (after - lo) / (hi - lo)) * 100}%`;
  txt.textContent = `${fmtNum(after - lo)} / ${fmtNum(hi - lo)} XP to ${rankTitle(r + 1)}`;
}

export function failModal(host: Host, o: { title: string; text: string; result: ShiftResult; canRevive: boolean; partial: number }, cb: { revive(): Promise<boolean>; retry(): void; map(): void }): void {
  const m = modal(
    host.layer,
    `<h2 class="modal-title" style="color:#c9353a">${esc(o.title)}</h2>
    <p class="modal-sub">${esc(o.text)}</p>
    <div class="res-lines"><div class="res-line"><span>Cases solved</span><b>${o.result.correct} / ${o.result.total}</b></div>
    <div class="res-line"><span>Consolation pay</span><b>${icon('coin')} ${fmtNum(o.partial)}</b></div></div>
    ${o.canRevive && host.rewardedAvailable ? `<div class="modal-actions"><button class="btn purple big pulse" data-act="revive">${icon('ad')} Keep going! <span style="font-size:15px">(+25s &amp; +1 heart)</span></button></div>` : ''}
    <div class="modal-actions"><button class="btn white" data-act="map">${icon('map')} Map</button><button class="btn yellow" data-act="retry">${icon('replay').replace(/#fff/g, '#22223b')} Try again</button></div>`,
  );
  onAct(m.root, async (act, el) => {
    if (act === 'revive') {
      el.classList.add('disabled');
      const ok = await cb.revive();
      if (ok) m.close();
      else el.classList.remove('disabled');
    }
    if (act === 'retry') {
      m.close();
      cb.retry();
    }
    if (act === 'map') {
      m.close();
      cb.map();
    }
  });
}

export function rankUpModal(host: Host, rank: number, onSkills: () => void): Promise<void> {
  return new Promise((resolve) => {
    audio.play('levelup');
    const m = modal(
      host.layer,
      `<div style="text-align:center">${icon('trophy').replace('<svg', '<svg style="width:90px;height:90px"')}</div>
      <h2 class="modal-title">PROMOTED!</h2><p class="modal-sub">You are now a <b>${esc(rankTitle(rank))}</b>.<br>+1 Skill Point to spend!</p>
      <div class="modal-actions"><button class="btn white" data-act="later">Later</button><button class="btn purple" data-act="skills">${icon('brain')} Spend it</button></div>`,
    );
    onAct(m.root, (act) => {
      m.close();
      if (act === 'skills') onSkills();
      resolve();
    });
  });
}

export function chapterUnlockedModal(host: Host, ch: number): Promise<void> {
  return new Promise((resolve) => {
    const c = CHAPTERS[ch - 1];
    audio.play('fanfare');
    const m = modal(
      host.layer,
      `<div style="text-align:center"><div class="chapter-badge" style="background:${c.color};margin:0 auto;width:90px;height:90px">${icon(c.icon).replace('<svg', '<svg style="width:56px;height:56px"')}</div></div>
      <h2 class="modal-title">New chapter unlocked!</h2><p class="modal-sub">Chapter ${c.id}: <b>${esc(c.name)}</b><br>${esc(c.subtitle)}</p>
      <div class="modal-actions"><button class="btn yellow big" data-act="ok">Let's go!</button></div>`,
    );
    onAct(m.root, () => {
      m.close();
      resolve();
    });
  });
}

export function dailyKey(): string {
  return todayKey();
}
