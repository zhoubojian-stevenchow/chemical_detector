export interface SkillDef {
  id: string;
  name: string;
  max: number;
  desc: (rank: number) => string;
}

export const SKILLS: SkillDef[] = [
  { id: 'steady', name: 'Steady Hands', max: 3, desc: (r) => `Mini-game sweet spots +${r * 12}%` },
  { id: 'quick', name: 'Quick Hands', max: 3, desc: (r) => `Machines run ${r * 15}% faster, animations snappier` },
  { id: 'nose', name: 'Iron Nose', max: 2, desc: (r) => `Sniff toxicity −${r} level${r === 1 ? '' : 's'}` },
  { id: 'talker', name: 'Smooth Talker', max: 3, desc: (r) => `+${r * 10}% coins from clients` },
  { id: 'eye', name: 'Sharp Eye', max: 2, desc: (r) => `Rule out ${r} wrong answer${r === 1 ? '' : 's'} at the start of each case` },
  { id: 'caffeine', name: 'Caffeine Tolerance', max: 3, desc: (r) => `+${r * 6}% shift time` },
  { id: 'tough', name: 'Thick Skin', max: 2, desc: (r) => `+${r} max heart${r === 1 ? '' : 's'}` },
  { id: 'gambler', name: 'Gambler', max: 2, desc: (r) => `Bold Call bonus +${r * 25}%` },
  { id: 'lucky', name: 'Lucky Charm', max: 3, desc: (r) => `${r * 8}% chance a botched mini-game still works` },
];

export const RANKS = [
  'Intern', 'Coffee Fetcher', 'Beaker Washer', 'Junior Sniffer', 'Lab Tech', 'Senior Lab Tech', 'Analyst',
  'Senior Analyst', 'Chemist', 'Senior Chemist', 'Lead Scientist', 'Lab Manager', 'Lab Director',
  'Chemistry Wizard', 'Element Whisperer', 'Nobel Nominee', 'Nobel Laureate', 'Legend of the Lab',
];

/** total XP needed to reach rank r (r starts at 0) */
export function xpForRank(r: number): number {
  if (r <= 0) return 0;
  return Math.round(60 * Math.pow(r, 1.5));
}

export function rankFromXp(xp: number): number {
  let r = 0;
  while (xpForRank(r + 1) <= xp) r++;
  return r;
}

export function rankTitle(r: number): string {
  if (r < RANKS.length) return RANKS[r];
  return `${RANKS[RANKS.length - 1]} ${'★'.repeat(Math.min(5, r - RANKS.length + 1))}`;
}
