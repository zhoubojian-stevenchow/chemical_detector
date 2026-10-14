import { describe, expect, it } from 'vitest';
import { CASES, getCase } from '../src/data/cases';
import { CLIENT_MAP } from '../src/data/clients';
import { LEVELS } from '../src/data/levels';
import { SUBSTANCES, SUBSTANCE_MAP, getSubstance } from '../src/data/substances';
import { TOOLS } from '../src/data/tools';
import type { ToolId } from '../src/data/types';
import { averageGreedyTests, indistinguishablePairs, type ToolChoice } from '../src/game/deduction';

function toolsFor(levelId: number, broken: ToolId[] = []): ToolChoice[] {
  return TOOLS.filter((t) => t.introLevel <= levelId && !broken.includes(t.id)).map((t) => ({ id: t.id, tier: 1 as const, cost: 4 }));
}

function stateGroup(state: string): string {
  if (state === 'powder' || state === 'crystals') return 'fine';
  if (state === 'liquid' || state === 'gel') return 'goo';
  if (state === 'metal' || state === 'chunk') return 'lump';
  return state;
}

function hexDist(a: string, b: string): number {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return Math.hypot(pa[0] - pb[0], pa[1] - pb[1], pa[2] - pb[2]);
}

describe('game data', () => {
  it('has at least 60 levels', () => {
    expect(LEVELS.length).toBeGreaterThanOrEqual(60);
    LEVELS.forEach((l, i) => expect(l.id).toBe(i + 1));
  });

  it('references valid substances and clients', () => {
    for (const c of CASES) {
      expect(CLIENT_MAP[c.client], `client ${c.client} in ${c.id}`).toBeTruthy();
      for (const s of c.pool) expect(SUBSTANCE_MAP[s], `substance ${s} in ${c.id}`).toBeTruthy();
      expect(new Set(c.pool).size, `duplicate in pool ${c.id}`).toBe(c.pool.length);
      expect(c.pool.length).toBeGreaterThanOrEqual(3);
    }
    for (const l of LEVELS) for (const id of l.cases) expect(() => getCase(id)).not.toThrow();
  });

  it('every level case is solvable with the tools available at that level', () => {
    const problems: string[] = [];
    for (const l of LEVELS) {
      const broken = (l.mods ?? []).filter((m) => m.startsWith('broken:')).map((m) => m.slice(7) as ToolId);
      const tools = toolsFor(l.id, broken);
      for (const cid of l.cases) {
        const bad = indistinguishablePairs(tools, getCase(cid).pool);
        if (bad.length) problems.push(`L${l.id} ${cid}: ${bad.map((p) => p.join('~')).join(', ')}`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('pools are visual look-alikes', () => {
    const problems: string[] = [];
    for (const c of CASES) {
      const subs = c.pool.map(getSubstance);
      for (const a of subs) for (const b of subs) {
        if (a.id >= b.id) continue;
        if (a.state !== 'gas' && b.state !== 'gas' && stateGroup(a.state) !== stateGroup(b.state)) problems.push(`${c.id}: state ${a.id}/${b.id}`);
        if (a.state !== 'gas' && hexDist(a.color, b.color) > 135) problems.push(`${c.id}: colour ${a.id}/${b.id} ${hexDist(a.color, b.color).toFixed(0)}`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('every substance can be discovered somewhere', () => {
    const used = new Set(CASES.flatMap((c) => c.pool));
    const unused = SUBSTANCES.filter((s) => !used.has(s.id)).map((s) => s.id);
    expect(unused).toEqual([]);
  });

  it('levels need a reasonable number of tests', () => {
    const report: string[] = [];
    for (const l of LEVELS) {
      const tools = toolsFor(l.id);
      for (const cid of l.cases) {
        const pool = getCase(cid).pool.map(getSubstance);
        const t = averageGreedyTests(tools, pool);
        expect(Number.isFinite(t)).toBe(true);
        report.push(`L${l.id} ${cid}: ${t.toFixed(2)}`);
      }
    }
    if ((globalThis as any).process?.env?.REPORT) console.log(report.join('\n'));
  });
});
