import { getCase } from '../data/cases';
import { getClient } from '../data/clients';
import { LEVELS } from '../data/levels';
import { getSubstance } from '../data/substances';
import { TOOL_MAP } from '../data/tools';
import type { CaseTemplate, ClientDef, LevelDef, Substance, ToolId } from '../data/types';
import { clamp, lerp, shuffle } from '../core/util';
import {
  averageGreedyTests, bestTool, describe, matches, type Reading, type Tier, type ToolChoice,
} from './deduction';
import type { Progress } from './progress';

export type Mode = 'campaign' | 'endless' | 'daily';
export type Quality = 'perfect' | 'good' | 'miss';
export type Accident = 'fire' | 'fumes' | 'gas' | null;

export interface CaseRun {
  template: CaseTemplate;
  client: ClientDef;
  lineup: Substance[];
  answer: Substance;
  eliminated: Set<string>;
  readings: Reading[];
  used: Set<ToolId>;
  allowance: number;
  outcome?: 'correct' | 'wrong';
  guess?: Substance;
  coins: number;
}

export interface ShiftConfig {
  mode: Mode;
  level: LevelDef;
  /** 0..1 */
  difficulty: number;
  tools: ToolId[];
}

export interface SubmitResult {
  correct: boolean;
  coins: number;
  bold: boolean;
  multiplier: number;
  remainingCount: number;
}

export interface ShiftResult {
  cleared: boolean;
  stars: [boolean, boolean, boolean];
  caseCoins: number;
  timeBonus: number;
  flawlessBonus: number;
  totalCoins: number;
  xp: number;
  correct: number;
  total: number;
  timeLeft: number;
  par: number;
  failReason?: 'time' | 'hearts' | 'inspector';
}

/** Fraction of the clock that must be left for the "Speedy" star (harder later in the game). */
export function parFraction(levelId: number): number {
  return Math.round(lerp(0.3, 0.4, clamp((levelId - 1) / 59, 0, 1)) * 100) / 100;
}

/** Which levels first use each case template (endless mode only draws templates the player has reached). */
export const TEMPLATE_FIRST_LEVEL: Record<string, number> = (() => {
  const m: Record<string, number> = {};
  for (const l of LEVELS) for (const c of l.cases) if (!(c in m)) m[c] = l.id;
  return m;
})();

export class Shift {
  readonly cfg: ShiftConfig;
  readonly progress: Progress;
  readonly rnd: () => number;
  cases: CaseRun[] = [];
  index = 0;
  timeLeft = 0;
  totalTime = 0;
  hearts: number;
  maxHearts: number;
  mistakes = 0;
  accidents = 0;
  combo = 0;
  bestCombo = 0;
  perfects = 0;
  coins = 0;
  xp = 0;
  blanketAvailable: boolean;
  /** coins spent on expensive machine time */
  spent = 0;
  over = false;
  failReason?: 'time' | 'hearts' | 'inspector';
  continued = false;
  /** endless: number solved */
  solved = 0;

  constructor(cfg: ShiftConfig, progress: Progress, rnd: () => number = Math.random) {
    this.cfg = cfg;
    this.progress = progress;
    this.rnd = rnd;
    const mods = cfg.level.mods ?? [];
    this.maxHearts = progress.maxHearts(mods);
    this.hearts = this.maxHearts;
    this.blanketAvailable = progress.perk('blanket');

    if (cfg.mode === 'endless') {
      this.addEndlessCase();
      this.addEndlessCase();
      this.totalTime = 75 * progress.timeMultiplier();
    } else {
      for (const id of cfg.level.cases) this.cases.push(this.buildCase(getCase(id), cfg.level.size));
      let t = this.cases.reduce((a, c) => a + c.allowance, 0);
      t *= cfg.level.timeMul ?? 1;
      t *= lerp(1.35, 0.95, clamp((cfg.level.id - 1) / 59, 0, 1));
      if (mods.includes('rush')) t *= 0.8;
      if (mods.includes('boss')) t *= 1.05;
      t *= progress.timeMultiplier();
      this.totalTime = Math.round(t / 5) * 5;
    }
    this.timeLeft = this.totalTime;
  }

  get mods() {
    return this.cfg.level.mods ?? [];
  }

  get current(): CaseRun {
    return this.cases[this.index];
  }

  get par(): number {
    return Math.round(this.totalTime * parFraction(this.cfg.mode === 'campaign' ? this.cfg.level.id : 30));
  }

  toolChoices(): ToolChoice[] {
    return this.cfg.tools.map((id) => ({
      id,
      tier: this.progress.toolTier(id),
      cost: TOOL_MAP[id].minigame === 'machine' ? 6 : this.progress.isAuto(id) ? 1.5 : 4,
    }));
  }

  tierOf(tool: ToolId): Tier {
    return this.progress.toolTier(tool);
  }

  buildCase(t: CaseTemplate, size: number): CaseRun {
    const pool = t.pool.map(getSubstance);
    const answers = (t.answers ?? t.pool).map(getSubstance);
    const answer = answers[Math.floor(this.rnd() * answers.length)];
    const others = shuffle(pool.filter((s) => s !== answer), this.rnd).slice(0, Math.max(1, Math.min(size, pool.length) - 1));
    const lineup = shuffle([answer, ...others], this.rnd);
    const choices = this.toolChoices();
    const avg = averageGreedyTests(choices, lineup);
    const allowance = 12 + 7 * ((Number.isFinite(avg) ? avg : 3) + 1.2);
    const run: CaseRun = {
      template: t,
      client: getClient(t.client),
      lineup,
      answer,
      eliminated: new Set(),
      readings: [],
      used: new Set(),
      allowance,
      coins: 0,
    };
    // Sharp Eye skill: rule out some wrong answers right away (always leave at least 2)
    const eye = this.progress.skill('eye');
    if (eye > 0) {
      const wrong = shuffle(lineup.filter((s) => s !== answer), this.rnd);
      const n = Math.min(eye, Math.max(0, lineup.length - 2));
      for (let i = 0; i < n; i++) run.eliminated.add(wrong[i].id);
    }
    return run;
  }

  /** Endless mode: append a fresh random case scaled to how far the player has got. */
  addEndlessCase(): void {
    const reach = this.progress.toolLevel();
    const ids = Object.keys(TEMPLATE_FIRST_LEVEL).filter((id) => TEMPLATE_FIRST_LEVEL[id] <= Math.max(reach, 1));
    const n = this.cases.length;
    const size = clamp(3 + Math.floor(n / 3), 3, 9);
    const id = ids[Math.floor(this.rnd() * ids.length)];
    this.cases.push(this.buildCase(getCase(id), size));
  }

  remaining(c: CaseRun = this.current): Substance[] {
    return c.lineup.filter((s) => !c.eliminated.has(s.id));
  }

  /** Apply a test. Returns the reading and which candidates were ruled out. */
  applyReading(tool: ToolId): { reading: Reading; ruledOut: Substance[] } {
    const c = this.current;
    const tier = this.tierOf(tool);
    const reading = describe(tool, tier, c.answer, this.rnd);
    c.used.add(tool);
    if (!c.readings.find((r) => r.tool === tool)) c.readings.push(reading);
    const ruledOut: Substance[] = [];
    for (const s of c.lineup) {
      if (c.eliminated.has(s.id)) continue;
      if (!matches(tool, tier, c.answer, s)) {
        c.eliminated.add(s.id);
        ruledOut.push(s);
      }
    }
    this.spent += this.runCost(tool);
    return { reading, ruledOut };
  }

  /** Coin cost of running a tool (only the mass spectrometer costs machine time). */
  runCost(tool: ToolId): number {
    return tool === 'massspec' ? this.progress.massCost() : 0;
  }

  registerQuality(q: Quality): void {
    if (q === 'perfect') {
      this.combo++;
      this.perfects++;
      this.bestCombo = Math.max(this.bestCombo, this.combo);
    } else if (q === 'miss') {
      this.combo = 0;
    }
  }

  /** Bonus coins for a perfect at the current combo. */
  perfectBonus(): number {
    return 2 + Math.min(this.combo, 10) * 2;
  }

  /** What goes wrong when a mini-game result is poor. */
  accidentFor(tool: ToolId, q: Quality): Accident {
    const s = this.current.answer;
    if (tool === 'sniff') {
      const tox = s.toxic - this.progress.sniffProtection();
      if (tox >= 3 && q !== 'perfect') return 'fumes';
      if (tox === 2 && q === 'miss') return 'fumes';
      return null;
    }
    if (q !== 'miss') return null;
    if ((tool === 'flame' || tool === 'splint') && s.flammable) return 'fire';
    if (tool === 'acid' && s.props.acid === 'toxic-gas') return 'gas';
    return null;
  }

  /** Lose a heart (unless protected). Returns what absorbed it, if anything. */
  takeHit(kind: 'accident' | 'mistake', hasExtinguisher: boolean): 'blanket' | 'extinguisher' | 'heart' {
    if (kind === 'accident') {
      this.accidents++;
      if (this.blanketAvailable) {
        this.blanketAvailable = false;
        return 'blanket';
      }
      if (hasExtinguisher) return 'extinguisher';
    }
    this.hearts = Math.max(0, this.hearts - 1);
    if (this.hearts <= 0 && !this.over) {
      this.over = true;
      this.failReason = this.mods.includes('inspector') ? 'inspector' : 'hearts';
    }
    return 'heart';
  }

  caseFee(c: CaseRun = this.current): number {
    const lvl = this.cfg.mode === 'endless' ? 5 + this.solved * 2 : this.cfg.level.id;
    let fee = (20 + 4.5 * lvl) * c.client.pay;
    if (this.mods.includes('boss')) fee *= 1.25;
    if (this.mods.includes('rush')) fee *= 1.3;
    if (this.mods.includes('night')) fee *= 1.15;
    return fee * this.progress.coinMultiplier();
  }

  boldMultiplier(remainingCount: number): number {
    if (remainingCount <= 1) return 1;
    return Math.min(3, 1 + this.progress.boldBonus() * (remainingCount - 1));
  }

  submit(guess: Substance): SubmitResult {
    const c = this.current;
    const rem = this.remaining(c).length;
    const correct = guess === c.answer;
    c.guess = guess;
    c.outcome = correct ? 'correct' : 'wrong';
    let coins = 0;
    const mult = this.boldMultiplier(rem);
    if (correct) {
      coins = Math.round(this.caseFee(c) * mult);
      c.coins = coins;
      this.coins += coins;
      const lvl = this.cfg.mode === 'endless' ? 5 + this.solved * 2 : this.cfg.level.id;
      this.xp += (10 + lvl * 0.6) * (rem > 1 ? 1.3 : 1);
      this.solved++;
      if (this.cfg.mode === 'endless') {
        this.timeLeft += 16 + Math.max(0, 8 - this.solved * 0.4);
      }
    } else {
      this.mistakes++;
    }
    return { correct, coins, bold: rem > 1, multiplier: mult, remainingCount: rem };
  }

  /** Move to next case. Returns false when the shift is finished. */
  next(): boolean {
    if (this.cfg.mode === 'endless') {
      this.index++;
      if (this.index >= this.cases.length - 1) this.addEndlessCase();
      return !this.over;
    }
    this.index++;
    return this.index < this.cases.length && !this.over;
  }

  hint(): { ruledOut?: Substance; best: ToolId | null } {
    const c = this.current;
    const wrong = this.remaining(c).filter((s) => s !== c.answer);
    let ruledOut: Substance | undefined;
    if (wrong.length) {
      ruledOut = wrong[Math.floor(this.rnd() * wrong.length)];
      c.eliminated.add(ruledOut.id);
    }
    return { ruledOut, best: this.bestTool() };
  }

  bestTool(): ToolId | null {
    const c = this.current;
    return bestTool(this.toolChoices(), this.remaining(c), c.used);
  }

  /** Advance the clock. Returns true if time just ran out. */
  tick(dt: number): boolean {
    if (this.over) return false;
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.over = true;
      this.failReason = 'time';
      return true;
    }
    return false;
  }

  addTime(sec: number): void {
    this.timeLeft += sec;
  }

  /** Watch-an-ad continue after failing. */
  revive(): void {
    this.over = false;
    this.failReason = undefined;
    this.continued = true;
    if (this.hearts <= 0) this.hearts = 1;
    if (this.timeLeft < 25) this.timeLeft = 25;
  }

  finalize(): ShiftResult {
    const total = this.cfg.mode === 'endless' ? this.solved : this.cases.length;
    const correct = this.cases.filter((c) => c.outcome === 'correct').length;
    const cleared = this.cfg.mode === 'endless' ? true : !this.over && this.index >= this.cases.length;
    const flawless = cleared && this.mistakes === 0 && this.accidents === 0;
    const speedy = cleared && this.timeLeft >= this.par;
    const lvl = this.cfg.mode === 'endless' ? 5 + this.solved * 2 : this.cfg.level.id;
    const timeBonus = cleared && this.cfg.mode !== 'endless' ? Math.round(this.timeLeft * (0.5 + lvl / 40)) : 0;
    const flawlessBonus = flawless ? Math.round(this.coins * 0.2) : 0;
    const stars: [boolean, boolean, boolean] = [cleared, flawless, speedy];
    const starCount = stars.filter(Boolean).length;
    const xp = Math.round((this.xp + starCount * 8) * this.progress.xpMultiplier());
    return {
      cleared,
      stars,
      caseCoins: this.coins - this.spent,
      timeBonus,
      flawlessBonus,
      totalCoins: Math.max(0, this.coins - this.spent + timeBonus + flawlessBonus),
      xp,
      correct,
      total,
      timeLeft: this.timeLeft,
      par: this.par,
      failReason: this.failReason,
    };
  }
}
