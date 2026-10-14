import { audio } from '../core/audio';
import { pick, vibrate, wait } from '../core/util';
import { CLOCK_SCALE, DT_CAP } from '../config';
import { ITEMS } from '../data/shop';
import { FAIL_REASONS, GERALD } from '../data/text';
import { TOOLS, TOOL_MAP } from '../data/tools';
import type { Substance, ToolId } from '../data/types';
import { ads } from '../platform';
import { TOOL_STATION } from '../scene/lab';
import { $, toast } from '../ui/dom';
import { Hud, type CardRow, type ItemView, type ToolView } from '../ui/hud';
import { failModal, pauseMenu } from '../ui/menus';
import { playMinigame, setMinigamePaused } from '../ui/minigames';
import { Tutor } from '../ui/tutorial';
import type { App } from './app';
import { describe, matches, referenceValue, type Reading } from './deduction';
import type { Accident, Quality, Shift, ShiftResult } from './shift';

export type ShiftExit = { kind: 'done'; result: ShiftResult; newDex: number } | { kind: 'quit' } | { kind: 'restart' } | { kind: 'failed'; result: ShiftResult; newDex: number };

interface Machine {
  end: number;
  dur: number;
  q: Quality;
}

/** Runs one shift: cases, tools, mini-games, scoring, failure & revive. */
export class ShiftController {
  private hud!: Hud;
  private tutor: Tutor;
  private running = false;
  private paused = false;
  private busy = false;
  private elapsed = 0;
  private raf = 0;
  private last = 0;
  private machines = new Map<ToolId, Machine>();
  private exit: ShiftExit | null = null;
  private analysisDone: (() => void) | null = null;
  private failing = false;
  private reviveUsed = false;
  private adItemUsed = false;
  private hintTool: ToolId | null = null;
  private idle = 0;
  private lastQuip = 0;
  private lowWarned = false;
  private newDex = 0;
  private tutorialStep = 0;
  private visHandler = () => this.onVisibility();
  private resizeTimer = 0;
  private resizeHandler = () => {
    window.clearTimeout(this.resizeTimer);
    this.resizeTimer = window.setTimeout(() => this.refreshTools(), 150);
  };
  private keyHandler = (e: KeyboardEvent) => this.onKey(e);

  constructor(private app: App, private shift: Shift) {
    this.tutor = new Tutor(app.layer);
  }

  private get lab() {
    return this.app.lab;
  }
  private get data() {
    return this.app.data;
  }
  private get level() {
    return this.shift.cfg.level;
  }
  private get mode() {
    return this.shift.cfg.mode;
  }

  // ───────────────────────── lifecycle ─────────────────────────

  async run(): Promise<ShiftExit> {
    const s = this.shift;
    this.hud = new Hud(this.app.layer, {
      tool: (id) => void this.useTool(id),
      card: (sub) => this.openCard(sub),
      item: (id) => void this.useItem(id),
      pause: () => this.pause(),
      request: () => toast(this.app.layer, s.current.template.text, 3500),
    });
    this.hud.onLayout = () => this.app.updateInsets();
    const title = this.mode === 'endless' ? 'Rush Hour' : this.mode === 'daily' ? 'Daily Case' : `${this.level.id}. ${this.level.title}`;
    this.hud.setLevel(title);
    this.hud.setHearts(s.hearts, s.maxHearts);
    this.hud.setCoins(0);
    this.updateTimer();
    const newTools = this.mode === 'campaign' ? TOOLS.filter((t) => t.introLevel === this.level.id).map((t) => t.id) : [];
    this.lab.setTools(s.cfg.tools.filter((t) => !newTools.includes(t)));
    this.lab.setNight(s.mods.includes('night'));
    this.lab.resetMachines();
    this.lab.speed = this.app.progress.animSpeed();
    this.lab.setAccidentDays(this.data.accStreak);
    audio.playMusic(s.mods.includes('boss') ? 'boss' : 'lab');
    audio.setIntensity(0);
    ads.gameplayStart();
    window.addEventListener('keydown', this.keyHandler);
    window.addEventListener('resize', this.resizeHandler);
    document.addEventListener('visibilitychange', this.visHandler);
    this.last = performance.now();
    this.raf = requestAnimationFrame(() => this.tick());

    await this.lab.focus('overview', 0.8);
    if (newTools.length) {
      this.lab.setTools(s.cfg.tools, true);
      audio.play('fanfare');
      this.say(pick(GERALD.newTool));
      await wait(700);
    } else this.say(pick(GERALD.shiftStart));

    try {
      while (!this.exit) {
        await this.presentCase();
        if (this.exit) break;
        await this.analysis();
        if (this.exit) break;
        if (!s.next()) break;
      }
    } finally {
      this.cleanup();
    }
    if (this.exit) return this.exit;
    return { kind: 'done', result: s.finalize(), newDex: this.newDex };
  }

  private cleanup(): void {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('keydown', this.keyHandler);
    window.removeEventListener('resize', this.resizeHandler);
    document.removeEventListener('visibilitychange', this.visHandler);
    this.tutor.clear();
    this.hud.destroy();
    this.app.layer.querySelectorAll('.reading,.bubble,.mg,.soot,.green-face,.toast').forEach((e) => e.remove());
    this.lab.setHint(null);
    this.lab.resetMachines();
    ads.gameplayStop();
    audio.setIntensity(0);
  }

  // ───────────────────────── clock ─────────────────────────

  private tick(): void {
    this.raf = requestAnimationFrame(() => this.tick());
    const now = performance.now();
    const dt = Math.min(DT_CAP, (now - this.last) / 1000);
    this.last = now;
    if (this.paused || ads.busy) return;
    if (this.running && !this.failing) {
      this.elapsed += dt;
      const out = this.shift.tick(dt * CLOCK_SCALE);
      this.updateTimer();
      if (!this.lowWarned && this.shift.timeLeft < 15 && this.mode !== 'endless') {
        this.lowWarned = true;
        this.say(pick(GERALD.lowTime));
        audio.setIntensity(1);
      }
      if (out) void this.fail('time');
      // machines
      for (const [tool, m] of this.machines) {
        if (m.end > 0 && this.elapsed >= m.end) {
          m.end = -1;
          void this.finishMachine(tool);
        }
      }
      if (this.machines.size) this.refreshTools();
      // idle hint (Gerald's Training perk)
      if (!this.busy) {
        this.idle += dt;
        if (this.idle > 7 && this.app.progress.perk('training') && !this.hintTool) {
          const best = this.shift.bestTool();
          if (best) this.setHint(best, true);
        }
      }
    }
  }

  private updateTimer(): void {
    const s = this.shift;
    this.hud.setTimer(s.timeLeft, Math.max(s.totalTime, s.timeLeft), this.mode === 'endless' ? 0 : s.par, this.running);
    if (this.mode !== 'endless') this.lab.setClock(s.timeLeft / Math.max(1, s.totalTime));
  }

  // ───────────────────────── case flow ─────────────────────────

  private async presentCase(): Promise<void> {
    const s = this.shift;
    const c = s.current;
    this.running = false;
    this.busy = true;
    this.hud.setBusy(true);
    this.hud.showPanels(false);
    this.hud.hideRequest();
    this.hud.setCaseCount(s.index + 1, this.mode === 'endless' ? null : s.cases.length);
    this.setHint(null);
    this.machines.clear();
    this.lab.resetMachines();
    await this.lab.focus('client', 0.6);
    if (this.exit) return;
    await this.lab.clientEnter(c.client);
    if (this.exit) return;
    this.lab.clientTalk(2.5);
    const greeting = pick(c.client.hello);
    await this.hud.dialog(c.client, `${greeting} ${c.template.text}`, { label: c.template.label, next: 'Tap to start testing ▸' });
    if (this.exit) return;
    void this.lab.focus('overview', 0.7);
    await this.lab.showSample(c.answer, c.template.label ?? '???');
    if (this.exit) return;
    this.hud.setCandidates(c.lineup, c.eliminated, (id) => !!this.data.dex[id]);
    this.hud.setEvidence([]);
    this.hud.showRequest(c.client, c.template.text);
    this.hud.showPanels(true);
    this.busy = false;
    this.hud.setBusy(false);
    this.refreshTools();
    this.idle = 0;
    this.running = true;
    this.updateTimer();
    await this.tutorialCaseStart();
  }

  private analysis(): Promise<void> {
    return new Promise((resolve) => {
      this.analysisDone = resolve;
    });
  }

  private endAnalysis(): void {
    const r = this.analysisDone;
    this.analysisDone = null;
    r?.();
  }

  // ───────────────────────── tools ─────────────────────────

  private toolViews(): ToolView[] {
    const s = this.shift;
    const c = s.current;
    return s.cfg.tools.map((id, i) => {
      const m = this.machines.get(id);
      return {
        id,
        used: c.used.has(id),
        busy: !!m,
        progress: m && m.end > 0 ? Math.min(1, 1 - (m.end - this.elapsed) / m.dur) : 1,
        auto: this.app.progress.isAuto(id),
        cost: s.runCost(id),
        hint: this.hintTool === id,
        key: i < 9 ? String(i + 1) : '',
      };
    });
  }

  private itemViews(): ItemView[] {
    return ITEMS.filter((it) => it.id !== 'extinguisher').map((it) => ({
      id: it.id,
      name: it.name,
      short: it.short,
      count: this.data.items[it.id] ?? 0,
      ad: this.app.rewardedAvailable && !this.adItemUsed,
    }));
  }

  private refreshTools(): void {
    this.hud.setTools(this.toolViews(), this.itemViews());
    this.hud.setBusy(this.busy);
  }

  private setHint(tool: ToolId | null, fromGerald = false): void {
    this.hintTool = tool;
    this.lab.setHint(tool ? TOOL_STATION[tool] === 'nose' ? null : TOOL_STATION[tool] : null);
    this.refreshTools();
    if (tool && fromGerald) this.say(`Psst! Try the ${TOOL_MAP[tool].name}.`);
  }

  private async useTool(id: ToolId): Promise<void> {
    const s = this.shift;
    const c = s.current;
    if (!this.running || this.busy || this.failing || this.paused) return;
    const def = TOOL_MAP[id];
    if (this.machines.has(id)) {
      toast(this.app.layer, `${def.name} is still running…`);
      return;
    }
    if (c.used.has(id)) {
      const r = c.readings.find((x) => x.tool === id);
      if (r) this.hud.showReading(r, 0);
      toast(this.app.layer, 'Already tested! Try a different tool.');
      return;
    }
    this.idle = 0;
    if (this.hintTool === id) this.setHint(null);
    this.tutor.clear();
    const firstTime = !this.data.flags['tool_' + id];
    if (firstTime) {
      this.data.flags['tool_' + id] = true;
      this.app.persist();
    }
    if (def.minigame === 'machine') {
      this.startMachine(id);
      return;
    }
    this.busy = true;
    this.hud.setBusy(true);
    const sub = c.answer;
    const station = TOOL_STATION[id];
    const pose = station === 'nose' || id === 'splint' || id === 'uv' ? 'sample' : station;
    await Promise.all([this.lab.focus(pose, 0.55), this.lab.prepTest(id, sub)]);
    let q: Quality;
    const auto = this.app.progress.isAuto(id);
    if (def.minigame === 'instant') q = 'good';
    else if (auto) {
      await wait(250);
      q = 'perfect';
    } else {
      q = await playMinigame(this.app.layer, {
        tool: def,
        sub,
        zoneMul: this.app.progress.zoneMultiplier(id),
        difficulty: this.difficulty(),
        firstTime,
        lucky: this.app.progress.luckyChance(),
      });
    }
    if (this.exit || this.failing) return; // shift ended / failed while the mini-game was on screen
    if (def.minigame !== 'instant') {
      s.registerQuality(q);
      if (s.combo > (this.data.stats.bestCombo ?? 0)) this.data.stats.bestCombo = s.combo;
      if (q === 'perfect') {
        this.data.stats.perfects++;
        if (!auto) {
          const bonus = s.perfectBonus();
          s.coins += bonus;
          this.hud.setCoins(s.coins - s.spent);
          const p = this.hud.coinsPillPos();
          this.hud.float(`+${bonus}${s.combo > 1 ? ` COMBO x${s.combo}` : ''}`, p.x - 60, p.y + 40, '#ffd23f', 22);
          if (s.combo >= 3 && s.combo % 3 === 0) this.say(pick(GERALD.perfect));
        }
      } else if (q === 'miss') this.say(pick(GERALD.miss));
    }
    const accident = s.accidentFor(id, q);
    const result = q !== 'miss' ? s.applyReading(id) : null;
    if (accident && q !== 'miss') {
      // e.g. a strong whiff of something nasty: you still smelled it, but it hurt
      await this.accident(accident);
    }
    await this.lab.playTest(id, sub, result?.reading ?? describe(id, s.tierOf(id), sub), q);
    if (accident && q === 'miss') await this.accident(accident);
    if (this.failing || this.exit) return;
    if (result) this.showResult(result.reading, result.ruledOut);
    else toast(this.app.layer, 'Botched! No reading — you can try that test again.');
    if (s.runCost(id)) this.hud.setCoins(s.coins - s.spent);
    await this.lab.focus('overview', 0.55);
    if (this.exit) return;
    this.busy = false;
    this.hud.setBusy(false);
    this.refreshTools();
    if (result) await this.tutorialAfterTest(); // a botched test ruled nothing out: explain after the next one
  }

  private difficulty(): number {
    if (this.mode === 'endless') return Math.min(1, 0.15 + this.shift.solved * 0.04);
    return Math.min(1, (this.level.id - 1) / 59);
  }

  private showResult(r: Reading, ruled: Substance[]): void {
    const s = this.shift;
    this.hud.showReading(r, ruled.length);
    this.hud.ruleOut(
      ruled.map((x) => x.id),
      s.remaining().length,
      s.current.lineup.length,
    );
    this.hud.setEvidence(s.current.readings);
    if (s.remaining().length === 1) {
      setTimeout(() => this.say(pick(GERALD.oneLeft)), 900);
    } else if (ruled.length >= 2 && Math.random() < 0.5) setTimeout(() => this.say(pick(GERALD.eliminated)), 900);
  }

  private startMachine(id: ToolId): void {
    const s = this.shift;
    const def = TOOL_MAP[id];
    const dur = this.app.progress.machineTime(id, def.machineTime ?? 6);
    const r = describe(id, s.tierOf(id), s.current.answer);
    this.machines.set(id, { end: this.elapsed + dur, dur, q: 'good' });
    this.lab.machineStart(id, s.current.answer, dur, r.short);
    const cost = s.runCost(id);
    if (cost) {
      // the cost is charged when the reading arrives (Shift.applyReading)
      const p = this.hud.coinsPillPos();
      this.hud.float(`-${cost}`, p.x, p.y + 40, '#ff5a5f', 22);
    }
    this.say(pick(GERALD.machine));
    this.refreshTools();
  }

  private async finishMachine(id: ToolId): Promise<void> {
    const s = this.shift;
    if (!this.machines.has(id)) return;
    this.machines.delete(id);
    this.lab.machineFinish(id);
    const res = s.applyReading(id);
    this.hud.setCoins(s.coins - s.spent);
    this.showResult(res.reading, res.ruledOut);
    this.refreshTools();
  }

  // ───────────────────────── accidents ─────────────────────────

  private async accident(kind: NonNullable<Accident>): Promise<void> {
    const s = this.shift;
    const hasExt = (this.data.items.extinguisher ?? 0) > 0;
    const absorbed = s.takeHit('accident', hasExt);
    this.data.stats.accidents++;
    this.data.accStreak = 0;
    this.lab.setAccidentDays(0);
    const overlay = document.createElement('div');
    overlay.className = kind === 'fire' ? 'soot' : 'green-face';
    this.app.layer.appendChild(overlay);
    setTimeout(() => overlay.remove(), 2600);
    const anim = this.lab.accident(kind);
    vibrate(kind === 'fire' ? [60, 40, 160] : 200);
    if (absorbed === 'extinguisher') {
      this.data.items.extinguisher = Math.max(0, (this.data.items.extinguisher ?? 0) - 1);
      toast(this.app.layer, 'Phew! Your Extinguisher saved a heart.');
    } else if (absorbed === 'blanket') toast(this.app.layer, 'Phew! The Fire Blanket saved a heart.');
    else {
      const lines: Record<string, string> = {
        fire: 'KABOOM! Your eyebrows have left the building. −1 heart',
        fumes: 'You inhaled way too hard. Your nose files a complaint. −1 heart',
        gas: 'Toxic gas! Everyone out! (Come back in.) −1 heart',
      };
      toast(this.app.layer, lines[kind], 2400);
    }
    this.hud.setHearts(s.hearts, s.maxHearts);
    this.say(pick(GERALD.accident));
    this.app.persist();
    await anim;
    if (s.over) await this.fail(s.failReason ?? 'hearts');
  }

  // ───────────────────────── identify ─────────────────────────

  private openCard(sub: Substance): void {
    if (this.busy || !this.running) return;
    this.tutor.clear();
    const s = this.shift;
    const c = s.current;
    const rows: CardRow[] = s.cfg.tools.map((t) => {
      const tier = s.tierOf(t);
      const ref = referenceValue(t, tier, sub);
      const tested = c.readings.find((r) => r.tool === t);
      const status: CardRow['status'] = tested ? (matches(t, tier, c.answer, sub) ? 'match' : 'miss') : 'unknown';
      return { tool: t, label: ref.label, color: ref.color, status };
    });
    const remaining = s.remaining().length;
    const mult = s.boldMultiplier(remaining);
    const bold = remaining > 1;
    const out = c.eliminated.has(sub.id);
    this.hud.openCard(
      sub,
      rows,
      this.data.dex[sub.id] ? sub.fact : null,
      {
        label: out ? 'RULED OUT' : bold ? `IDENTIFY · BOLD CALL x${mult.toFixed(1)}` : 'IDENTIFY!',
        sub: out ? 'The evidence says it is not this one.' : bold ? `${remaining} suspects left — risky, but pays more!` : 'Send the report to the client',
        enabled: !out,
      },
      () => void this.submit(sub),
    );
  }

  private async submit(sub: Substance): Promise<void> {
    const s = this.shift;
    if (this.busy || !this.running || this.failing) return;
    this.busy = true;
    this.running = false;
    this.tutor.clear();
    this.hud.setBusy(true);
    for (const t of this.machines.keys()) this.lab.machineCancel(t);
    this.machines.clear();
    this.setHint(null);
    const c = s.current;
    const res = s.submit(sub);
    this.data.stats.cases++;
    if (res.bold) this.data.stats.bold++;
    this.hud.hideRequest();
    this.hud.showPanels(false);
    this.app.layer.querySelector('.reading')?.remove();
    this.updateTimer();
    await this.lab.focus('client', 0.6);
    const fill = (t: string) => t.replace(/\{answer\}/g, c.answer.name).replace(/\{guess\}/g, sub.name);
    let line: string;
    if (res.correct) {
      audio.play('correct');
      this.lab.clientReact('happy');
      this.data.stats.correct++;
      if (!this.data.dex[c.answer.id]) this.newDex++;
      this.data.dex[c.answer.id] = (this.data.dex[c.answer.id] ?? 0) + 1;
      const p = this.lab.clientScreen();
      this.hud.float(`+${res.coins}`, p.x, p.y, '#ffd23f', 40);
      if (res.bold) setTimeout(() => this.hud.float(`BOLD CALL x${res.multiplier.toFixed(1)}!`, p.x, p.y + 60, '#b388ff', 30), 350);
      if (this.mode === 'endless') setTimeout(() => this.hud.float('+TIME', p.x, p.y + 110, '#7bed9f', 26), 600);
      setTimeout(() => audio.play('cash'), 300);
      this.hud.setCoins(s.coins - s.spent);
      this.say(pick(res.bold ? GERALD.bold : GERALD.correct));
      line = `${pick(c.client.happy)} ${fill(c.template.win)}`;
    } else {
      audio.play('wrong');
      vibrate(120);
      this.lab.clientReact('angry');
      s.takeHit('mistake', false);
      this.hud.setHearts(s.hearts, s.maxHearts);
      this.say(pick(GERALD.wrong));
      line = `${pick(c.client.angry)} ${fill(c.template.lose)}`;
    }
    this.app.persist();
    await this.hud.dialog(c.client, line, { next: 'Next ▸' });
    if (this.exit) return;
    void this.lab.clientLeave();
    await this.lab.tossSample();
    this.lab.removeClient();
    this.busy = false;
    if (s.over) {
      await this.fail(s.failReason ?? 'hearts');
      if (this.exit) {
        this.endAnalysis();
        return;
      }
    }
    this.endAnalysis();
  }

  // ───────────────────────── items ─────────────────────────

  private async useItem(id: string): Promise<void> {
    const s = this.shift;
    if (!this.running || this.busy || this.failing) return;
    let count = this.data.items[id as 'hint'] ?? 0;
    if (id === 'firstaid' && s.hearts >= s.maxHearts) {
      toast(this.app.layer, 'Your hearts are already full!');
      return;
    }
    if (id === 'hint' && s.remaining().length <= 1) {
      toast(this.app.layer, 'Only one suspect left — just identify it!');
      return;
    }
    if (count <= 0) {
      if (!this.app.rewardedAvailable || this.adItemUsed) {
        toast(this.app.layer, 'None left! Buy more in the shop.');
        return;
      }
      this.running = false;
      const ok = await this.app.rewarded();
      this.running = true;
      if (!ok) return;
      this.adItemUsed = true;
      count = 1;
      this.data.items[id as 'hint'] = 1;
    }
    this.data.items[id as 'hint'] = count - 1;
    this.app.persist();
    audio.play('pop');
    if (id === 'espresso') {
      s.addTime(20);
      this.updateTimer();
      const t = $(this.hud.root, '.timer').getBoundingClientRect();
      this.hud.float('+20s', t.left + t.width / 2, t.bottom + 20, '#7bed9f', 30);
    } else if (id === 'firstaid') {
      s.hearts = Math.min(s.maxHearts, s.hearts + 1);
      this.hud.setHearts(s.hearts, s.maxHearts);
      audio.play('good');
    } else if (id === 'hint') {
      const h = s.hint();
      if (h.ruledOut) this.hud.ruleOut([h.ruledOut.id], s.remaining().length, s.current.lineup.length);
      if (h.best) this.setHint(h.best);
      this.say(h.best ? `My notes say: use the ${TOOL_MAP[h.best].name}!` : 'Ruled one out for you!');
    }
    this.refreshTools();
  }

  // ───────────────────────── failure / pause ─────────────────────────

  private async fail(reason: 'time' | 'hearts' | 'inspector'): Promise<void> {
    if (this.failing) return;
    this.failing = true;
    this.running = false;
    this.busy = true;
    this.hud.setBusy(true);
    ads.gameplayStop();
    audio.play('fail');
    const s = this.shift;
    if (this.mode === 'endless') {
      // endless runs end here (with one optional ad continue)
      const choice = await this.endlessContinue();
      if (choice) {
        s.revive();
        this.afterRevive();
        return;
      }
      this.exit = { kind: 'done', result: s.finalize(), newDex: this.newDex };
      this.failing = false;
      this.endAnalysis();
      return;
    }
    const res = s.finalize();
    const partial = Math.round(Math.max(0, res.caseCoins) * 0.5);
    const info = FAIL_REASONS[reason];
    await new Promise<void>((resolve) => {
      failModal(
        this.app,
        { title: info.title, text: info.text, result: res, canRevive: !this.reviveUsed, partial },
        {
          revive: async () => {
            const ok = await this.app.rewarded();
            if (ok) {
              this.reviveUsed = true;
              s.revive();
              this.afterRevive();
              resolve();
            }
            return ok;
          },
          retry: () => {
            this.exit = { kind: 'restart' };
            this.app.grantPartial(partial, res.xp);
            resolve();
          },
          map: () => {
            this.exit = { kind: 'failed', result: res, newDex: this.newDex };
            this.app.grantPartial(partial, res.xp);
            resolve();
          },
        },
      );
    });
    this.failing = false;
    if (this.exit) this.endAnalysis();
  }

  private afterRevive(): void {
    const s = this.shift;
    this.failing = false;
    this.hud.setHearts(s.hearts, s.maxHearts);
    this.updateTimer();
    this.lowWarned = false;
    audio.setIntensity(0);
    ads.gameplayStart();
    toast(this.app.layer, 'Back to work! +time & +1 heart');
    // resume analysis if a case is in progress
    this.busy = false;
    this.hud.setBusy(false);
    if (this.analysisDone) {
      this.running = true;
      this.hud.showPanels(true);
      this.refreshTools();
    }
  }

  private endlessContinue(): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.reviveUsed || !this.app.rewardedAvailable) return resolve(false);
      const s = this.shift;
      failModal(
        this.app,
        { title: s.failReason === 'time' ? "Time's up!" : 'Out of hearts!', text: `You solved ${s.solved} case${s.solved === 1 ? '' : 's'}. Keep the rush going?`, result: s.finalize(), canRevive: true, partial: 0 },
        {
          revive: async () => {
            const ok = await this.app.rewarded();
            if (ok) {
              this.reviveUsed = true;
              resolve(true);
            }
            return ok;
          },
          retry: () => resolve(false),
          map: () => resolve(false),
        },
      );
    });
  }

  pause(): void {
    if (this.paused || this.failing || this.exit) return;
    this.paused = true;
    setMinigamePaused(true);
    this.tutor.setHidden(true);
    ads.gameplayStop();
    pauseMenu(this.app, {
      resume: () => this.resume(),
      restart: () => {
        this.paused = false;
        setMinigamePaused(false);
        this.exit = { kind: 'restart' };
        this.endAnalysis();
        this.closeTransient();
      },
      quit: () => {
        this.paused = false;
        setMinigamePaused(false);
        this.exit = { kind: 'quit' };
        this.endAnalysis();
        this.closeTransient();
      },
    });
  }

  private resume(): void {
    this.paused = false;
    setMinigamePaused(false);
    this.tutor.setHidden(false);
    this.last = performance.now();
    ads.gameplayStart();
  }

  /** Close dialogs/minigames so an awaiting flow can't keep the shift alive. */
  private closeTransient(): void {
    this.hud.closeDialog();
    this.tutor.setHidden(false);
    this.tutor.clear();
    this.app.layer.querySelectorAll('.mg, .modal').forEach((e) => e.remove());
  }

  private onVisibility(): void {
    if (document.hidden && this.running && !this.paused) this.pause();
  }

  private onKey(e: KeyboardEvent): void {
    if (e.code === 'Escape' || e.code === 'KeyP') {
      if (!this.paused) this.pause();
      else if (e.code === 'Escape') {
        const m = this.app.layer.querySelector('.pause-modal');
        if (m) {
          m.remove();
          this.resume();
        }
      }
      return;
    }
    if (!this.running || this.busy || this.app.layer.querySelector('.modal, .mg')) return;
    const n = Number(e.key);
    if (n >= 1 && n <= 9) this.hud.keyButtons()[n - 1]?.click();
  }

  private say(text: string): void {
    const now = performance.now();
    if (now - this.lastQuip < 1200) return;
    this.lastQuip = now;
    const p = this.lab.geraldScreen();
    if (!p.visible) return;
    audio.play('squeak');
    this.hud.say(text, p.x, p.y - 10);
  }

  // ───────────────────────── tutorial ─────────────────────────

  private async tutorialCaseStart(): Promise<void> {
    if (this.mode !== 'campaign') return;
    const id = this.level.id;
    if (id === 1 && !this.data.flags.tut1 && this.shift.index === 0) {
      this.running = false;
      await this.tutor.show($(this.hud.root, '.cands'), 'These are the SUSPECTS. The sample is one of them — your job is to find out which!', 'Got it');
      if (this.exit) return;
      await this.tutor.show(this.hud.toolEl('ph'), 'Run a test! Tap the pH Strip to check how acidic the sample is.');
      this.tutorialStep = 1;
      this.running = true;
    } else if (id === 2 && !this.data.flags.tut2 && this.shift.index === 0) {
      this.data.flags.tut2 = true;
      this.running = false;
      await this.tutor.show($(this.hud.root, '.cand-list'), 'Pro tip: tap any suspect to see what each test SHOULD show for it. Pick the test that tells them apart!', 'Nice');
      this.running = true;
    } else if (id === 3 && !this.data.flags.tut3 && this.shift.index === 0) {
      this.data.flags.tut3 = true;
      this.running = false;
      await this.tutor.show(null, 'BOLD CALL: you can identify a sample while several suspects are left. If you are right, you earn a big bonus. If not… ouch.', 'Risky!');
      this.running = true;
    }
  }

  private async tutorialAfterTest(): Promise<void> {
    if (this.tutorialStep !== 1) return;
    this.tutorialStep = 2;
    this.running = false;
    await wait(600);
    if (this.exit) return;
    await this.tutor.show($(this.hud.root, '.cands'), 'Look! Every suspect that does not match the reading got RULED OUT.', 'Cool');
    if (this.exit) return;
    const rem = this.shift.remaining();
    if (rem.length === 1) {
      const el = this.hud.root.querySelector(`.cand[data-id="${rem[0].id}"]`) as HTMLElement | null;
      void this.tutor.show(el, 'Only one suspect left! Tap it and press IDENTIFY to send your report.');
    } else {
      void this.tutor.show(null, 'Keep testing until one suspect is left, then tap it and press IDENTIFY.');
      setTimeout(() => this.tutor.clear(), 3500);
    }
    this.data.flags.tut1 = true;
    this.app.persist();
    this.running = true;
  }
}
