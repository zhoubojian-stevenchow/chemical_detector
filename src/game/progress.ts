import { CHAPTERS, LEVELS } from '../data/levels';
import { EQUIPMENT, PERKS } from '../data/shop';
import { SKILLS, rankFromXp } from '../data/skills';
import { TOOLS } from '../data/tools';
import type { Modifier, ToolId } from '../data/types';
import type { SaveData } from '../core/save';
import type { Tier } from './deduction';

/** Derived gameplay stats from the save file. Pure helpers (easy to test). */
export class Progress {
  constructor(private get: () => SaveData) {}

  get d(): SaveData {
    return this.get();
  }

  // ── tools ──
  toolTier(id: ToolId): Tier {
    let t: Tier = 1;
    for (const u of EQUIPMENT) if (this.d.equip[u.id] && u.tools.includes(id) && u.tier > t) t = u.tier;
    return t;
  }

  toolUnlocked(id: ToolId, levelId: number): boolean {
    const def = TOOLS.find((t) => t.id === id)!;
    return def.introLevel <= Math.max(levelId, this.highestCleared() + 1);
  }

  /** Tools available in a given level (campaign: by intro level; endless/daily: everything unlocked so far). */
  toolsFor(levelId: number, mods: Modifier[] = []): ToolId[] {
    const broken = mods.filter((m) => m.startsWith('broken:')).map((m) => m.slice(7));
    return TOOLS.filter((t) => t.introLevel <= levelId && !broken.includes(t.id)).map((t) => t.id);
  }

  isAuto(id: ToolId): boolean {
    const def = TOOLS.find((t) => t.id === id)!;
    if (def.minigame === 'instant' || def.minigame === 'machine') return true;
    return this.toolTier(id) >= 3;
  }

  // ── skills / perks ──
  skill(id: string): number {
    return this.d.skills[id] ?? 0;
  }
  perk(id: string): boolean {
    return !!this.d.perks[id];
  }
  rank(): number {
    return rankFromXp(this.d.xp);
  }
  skillPointsTotal(): number {
    return this.rank() + this.d.bonusSkillPoints;
  }
  skillPointsSpent(): number {
    return Object.values(this.d.skills).reduce((a, b) => a + b, 0);
  }
  skillPointsFree(): number {
    return Math.max(0, this.skillPointsTotal() - this.skillPointsSpent());
  }
  canRaiseSkill(id: string): boolean {
    const def = SKILLS.find((s) => s.id === id);
    return !!def && this.skill(id) < def.max && this.skillPointsFree() > 0;
  }

  maxHearts(mods: Modifier[] = []): number {
    if (mods.includes('inspector')) return 1;
    return 3 + this.skill('tough') + (this.perk('shower') ? 1 : 0);
  }
  timeMultiplier(): number {
    return 1 + (this.perk('coffee') ? 0.1 : 0) + 0.06 * this.skill('caffeine');
  }
  zoneMultiplier(tool: ToolId): number {
    return 1 + 0.12 * this.skill('steady') + (this.perk('chair') ? 0.1 : 0) + (this.toolTier(tool) >= 2 ? 0.3 : 0);
  }
  coinMultiplier(): number {
    return 1 + 0.1 * this.skill('talker') + (this.perk('cat') ? 0.1 : 0);
  }
  xpMultiplier(): number {
    return 1 + (this.perk('trophy') ? 0.2 : 0);
  }
  machineTime(tool: ToolId, base: number): number {
    let t = base * (1 - 0.15 * this.skill('quick'));
    if (tool === 'geiger' && this.d.equip.geiger2) t *= 0.5;
    if (tool === 'massspec') {
      if (this.d.equip.mass3) t *= 0.4;
      else if (this.d.equip.mass2) t *= 0.7;
    }
    return t;
  }
  /** Coins per mass-spectrometer run (machine time is expensive!). */
  massCost(): number {
    if (this.d.equip.mass3) return 5;
    if (this.d.equip.mass2) return 15;
    return 25;
  }
  sniffProtection(): number {
    if (this.toolTier('sniff') >= 3) return 99;
    return this.skill('nose') + (this.perk('hood') ? 1 : 0) + (this.toolTier('sniff') >= 2 ? 1 : 0);
  }
  luckyChance(): number {
    return 0.08 * this.skill('lucky');
  }
  boldBonus(): number {
    return 0.5 + 0.25 * this.skill('gambler');
  }
  animSpeed(): number {
    return 1 + 0.12 * this.skill('quick');
  }

  // ── campaign ──
  starsFor(levelId: number): number {
    const r = this.d.levels[levelId];
    return r ? r.stars.filter(Boolean).length : 0;
  }
  totalStars(): number {
    let n = 0;
    for (const k in this.d.levels) n += this.d.levels[k].stars.filter(Boolean).length;
    return n;
  }
  highestCleared(): number {
    let h = 0;
    for (const l of LEVELS) if (this.d.levels[l.id]?.stars[0]) h = Math.max(h, l.id);
    return h;
  }
  chapterUnlocked(ch: number): boolean {
    const def = CHAPTERS.find((c) => c.id === ch);
    if (!def) return false;
    if (ch === 1) return true;
    const prevBoss = (ch - 1) * 10;
    return !!this.d.levels[prevBoss]?.stars[0] && this.totalStars() >= def.starsToUnlock;
  }
  levelUnlocked(id: number): boolean {
    if (id === 1) return true;
    const ch = Math.ceil(id / 10);
    if (!this.chapterUnlocked(ch)) return false;
    return !!this.d.levels[id - 1]?.stars[0];
  }
  nextLevel(): number {
    for (const l of LEVELS) if (!this.d.levels[l.id]?.stars[0]) return l.id;
    return LEVELS.length;
  }
  /** Highest level id whose tools the player has seen (for endless/daily tool sets). */
  toolLevel(): number {
    return Math.min(LEVELS.length, Math.max(1, this.highestCleared()));
  }

  perkDefs = PERKS;
}
