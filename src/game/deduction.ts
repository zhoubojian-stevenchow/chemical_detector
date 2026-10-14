import { POLYMER, getSubstance } from '../data/substances';
import {
  ACID_INFO, AG_INFO, BA_INFO, CONDUCT_INFO, CRYSTAL_INFO, FLAME_INFO, IODINE_INFO, LUMINOL_INFO, MAGNET_INFO,
  NAOH_INFO, ODOR_INFO, PH_BUCKETS, RAD_INFO, SPLINT_INFO, TOOL_MAP, UV_INFO,
} from '../data/tools';
import type { Substance, ToolId } from '../data/types';

/** Tool tiers: 1 = basic, 2 = pro, 3 = auto/precise */
export type Tier = 1 | 2 | 3;

export function phBucket(ph: number): number {
  for (let i = 0; i < PH_BUCKETS.length; i++) if (ph < PH_BUCKETS[i].max || i === PH_BUCKETS.length - 1) return i;
  return PH_BUCKETS.length - 1;
}

const PH_TOL = [0, 0, 0.5, 0.3];
const DENSITY_TOL = [0, 0.06, 0.02, 0.01];
const MASS_TOL = [0, 1.5, 0.5, 0.1];

function rawValue(tool: ToolId, s: Substance): number | string | boolean {
  return s.props[TOOL_MAP[tool].prop];
}

/**
 * Would `candidate` still be consistent with the reading obtained from `observed`?
 */
export function matches(tool: ToolId, tier: Tier, observed: Substance, candidate: Substance): boolean {
  const a = rawValue(tool, observed);
  const b = rawValue(tool, candidate);
  switch (tool) {
    case 'ph':
      if (tier === 1) return phBucket(a as number) === phBucket(b as number);
      return Math.abs((a as number) - (b as number)) <= PH_TOL[tier] + 1e-9;
    case 'density':
      return Math.abs((a as number) - (b as number)) <= DENSITY_TOL[tier] * (a as number) + 1e-12;
    case 'massspec': {
      const ma = a as number;
      const mb = b as number;
      if (ma === POLYMER || mb === POLYMER) return ma === mb;
      return Math.abs(ma - mb) <= MASS_TOL[tier] + 1e-9;
    }
    default:
      return a === b;
  }
}

/** True if, when `a` is the answer, testing with `tool` would rule out `b`. */
export function separates(tool: ToolId, tier: Tier, a: Substance, b: Substance): boolean {
  return !matches(tool, tier, a, b);
}

export interface Reading {
  tool: ToolId;
  label: string;
  /** short value for chips */
  short: string;
  color: string;
  /** extra flavour text (sniff jokes etc.) */
  flavor?: string;
}

function fmtDensity(d: number, tier: Tier, gas: boolean): string {
  const v = gas ? d * 1000 : d;
  const unit = gas ? 'g/L' : 'g/cm³';
  if (tier === 1) return `≈ ${v < 1 ? v.toPrecision(1) : v.toPrecision(2)} ${unit}`;
  if (tier === 2) return `${v.toFixed(v < 10 ? 2 : 1)} ${unit}`;
  return `${v.toFixed(v < 10 ? 3 : 2)} ${unit}`;
}

function fmtMass(m: number, tier: Tier): string {
  if (m === POLYMER) return 'Giant molecules';
  if (tier === 1) return `m/z ≈ ${Math.round(m)}`;
  if (tier === 2) return `m/z ${m.toFixed(1)}`;
  return `m/z ${m.toFixed(2)}`;
}

export function describe(tool: ToolId, tier: Tier, s: Substance, rnd = Math.random): Reading {
  const p = s.props;
  switch (tool) {
    case 'ph': {
      const b = PH_BUCKETS[phBucket(p.ph)];
      if (tier === 1) return { tool, label: b.label, short: b.label, color: b.color };
      return { tool, label: `pH ${p.ph.toFixed(1)} — ${b.label}`, short: `pH ${p.ph.toFixed(1)}`, color: b.color };
    }
    case 'sniff': {
      const o = ODOR_INFO[p.odor];
      return { tool, label: o.label, short: o.label, color: o.color, flavor: o.lines[Math.floor(rnd() * o.lines.length)] };
    }
    case 'flame': { const i = FLAME_INFO[p.flame]; return { tool, label: i.label, short: i.label, color: i.color }; }
    case 'microscope': { const i = CRYSTAL_INFO[p.crystal]; return { tool, label: i.label, short: i.label, color: i.color }; }
    case 'iodine': { const i = IODINE_INFO[p.iodine]; return { tool, label: i.label, short: i.label, color: i.color }; }
    case 'acid': { const i = ACID_INFO[p.acid]; return { tool, label: i.label, short: i.label, color: i.color }; }
    case 'luminol': { const i = LUMINOL_INFO[p.luminol]; return { tool, label: i.label, short: i.label, color: i.color }; }
    case 'conduct': { const i = CONDUCT_INFO[p.conduct]; return { tool, label: i.label, short: i.label.split(' — ')[1] ?? i.label, color: i.color }; }
    case 'agno3': { const i = AG_INFO[p.agno3]; return { tool, label: i.label, short: i.label, color: i.color }; }
    case 'magnet': { const i = MAGNET_INFO[String(p.magnet)]; return { tool, label: i.label, short: p.magnet ? 'Magnetic' : 'Not magnetic', color: i.color }; }
    case 'uv': { const i = UV_INFO[p.uv]; return { tool, label: i.label, short: i.label, color: i.color }; }
    case 'density': {
      const label = fmtDensity(p.density, tier, s.state === 'gas');
      return { tool, label: `Density ${label}`, short: label, color: '#9be3ff' };
    }
    case 'naoh': { const i = NAOH_INFO[p.naoh]; return { tool, label: i.label, short: i.label, color: i.color }; }
    case 'bacl2': { const i = BA_INFO[p.bacl2]; return { tool, label: i.label, short: i.label, color: i.color }; }
    case 'splint': { const i = SPLINT_INFO[p.splint]; return { tool, label: i.label, short: i.label, color: i.color }; }
    case 'geiger': { const i = RAD_INFO[p.rad]; return { tool, label: i.label, short: i.label.split(' — ')[0], color: i.color }; }
    case 'massspec': {
      const label = fmtMass(p.mass, tier);
      return { tool, label: p.mass === POLYMER ? 'Giant molecules (polymer / protein mix)' : `Main peak at ${label}`, short: label, color: '#ffb3f0' };
    }
  }
}

/** Reference value shown on a candidate card before testing (what the handbook says). */
export function referenceValue(tool: ToolId, tier: Tier, s: Substance): Reading {
  const r = describe(tool, tier, s, () => 0);
  return { ...r, flavor: undefined };
}

/** Expected number of candidates left after running `tool` (uniform prior over `remaining`). */
export function expectedRemaining(tool: ToolId, tier: Tier, remaining: Substance[]): number {
  let total = 0;
  for (const a of remaining) {
    let n = 0;
    for (const b of remaining) if (matches(tool, tier, a, b)) n++;
    total += n;
  }
  return total / remaining.length;
}

export interface ToolChoice {
  id: ToolId;
  tier: Tier;
  /** estimated cost in seconds (for tie-breaks) */
  cost: number;
}

export function bestTool(choices: ToolChoice[], remaining: Substance[], used: Set<ToolId>): ToolId | null {
  let best: ToolId | null = null;
  let bestScore = Infinity;
  for (const c of choices) {
    if (used.has(c.id)) continue;
    const e = expectedRemaining(c.id, c.tier, remaining);
    if (e >= remaining.length - 1e-9) continue; // useless
    const score = e + c.cost * 0.02;
    if (score < bestScore) {
      bestScore = score;
      best = c.id;
    }
  }
  return best;
}

/** Number of tests a sensible (greedy) player needs to pin down `answer`. Infinity if impossible. */
export function greedyTests(choices: ToolChoice[], lineup: Substance[], answer: Substance): number {
  let remaining = lineup.slice();
  const used = new Set<ToolId>();
  let n = 0;
  while (remaining.length > 1) {
    const t = bestTool(choices, remaining, used);
    if (!t) return Infinity;
    const tier = choices.find((c) => c.id === t)!.tier;
    used.add(t);
    remaining = remaining.filter((b) => matches(t, tier, answer, b));
    n++;
    if (n > 20) return Infinity;
  }
  return n;
}

export function averageGreedyTests(choices: ToolChoice[], lineup: Substance[]): number {
  let sum = 0;
  for (const a of lineup) sum += greedyTests(choices, lineup, a);
  return sum / lineup.length;
}

/** Can every pair in the pool be told apart with these tools? Returns the offending pairs. */
export function indistinguishablePairs(choices: ToolChoice[], ids: string[]): [string, string][] {
  const bad: [string, string][] = [];
  const subs = ids.map(getSubstance);
  for (const a of subs) {
    for (const b of subs) {
      if (a === b) continue;
      const ok = choices.some((c) => separates(c.id, c.tier, a, b));
      if (!ok) bad.push([a.id, b.id]);
    }
  }
  return bad;
}
