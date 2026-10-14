import type { SaveData } from '../core/save';
import { EQUIPMENT } from './shop';
import { SUBSTANCES } from './substances';

export interface Achievement {
  id: string;
  name: string;
  desc: string;
  icon: string;
  reward: { coins?: number; skill?: number };
  /** [current, goal] */
  progress(d: SaveData, stars: number, rank: number): [number, number];
}

const cleared = (d: SaveData, id: number) => (d.levels[id]?.stars[0] ? 1 : 0);
const dexCount = (d: SaveData) => SUBSTANCES.filter((s) => d.dex[s.id]).length;

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first', name: 'First Day Survived', desc: 'Clear your very first shift.', icon: 'check', reward: { coins: 100 }, progress: (d) => [cleared(d, 1), 1] },
  { id: 'ch1', name: 'Kitchen Champion', desc: 'Beat the Great Bake-Off Sabotage (shift 10).', icon: 'home', reward: { coins: 300 }, progress: (d) => [cleared(d, 10), 1] },
  { id: 'ch2', name: 'Donut Defender', desc: 'Solve the Great Donut Heist (shift 20).', icon: 'badge', reward: { coins: 600, skill: 1 }, progress: (d) => [cleared(d, 20), 1] },
  { id: 'ch3', name: 'Fraud Buster', desc: 'Bust the Counterfeit Cartel (shift 30).', icon: 'apple', reward: { coins: 900 }, progress: (d) => [cleared(d, 30), 1] },
  { id: 'ch4', name: 'Hard Hat Hero', desc: 'Stop the factory meltdown (shift 40).', icon: 'gear', reward: { coins: 1200, skill: 1 }, progress: (d) => [cleared(d, 40), 1] },
  { id: 'ch5', name: 'River Guardian', desc: 'Save the river (shift 50).', icon: 'leaf', reward: { coins: 1500 }, progress: (d) => [cleared(d, 50), 1] },
  { id: 'ch6', name: 'Nemesis of Mixup', desc: 'Defeat Professor Mixup (shift 60).', icon: 'secret', reward: { coins: 3000, skill: 2 }, progress: (d) => [cleared(d, 60), 1] },
  { id: 'stars30', name: 'Star Student', desc: 'Collect 30 stars.', icon: 'star', reward: { coins: 300 }, progress: (_d, s) => [s, 30] },
  { id: 'stars90', name: 'Star Scientist', desc: 'Collect 90 stars.', icon: 'star', reward: { coins: 900, skill: 1 }, progress: (_d, s) => [s, 90] },
  { id: 'stars180', name: 'Superstar Lab', desc: 'Collect all 180 stars.', icon: 'trophy', reward: { coins: 5000, skill: 2 }, progress: (_d, s) => [s, 180] },
  { id: 'dex25', name: 'Curious Collector', desc: 'Identify 25 different substances.', icon: 'book', reward: { coins: 250 }, progress: (d) => [dexCount(d), 25] },
  { id: 'dex75', name: 'Walking Encyclopedia', desc: 'Identify 75 different substances.', icon: 'book', reward: { coins: 1000 }, progress: (d) => [dexCount(d), 75] },
  { id: 'dexall', name: 'Element Whisperer', desc: `Complete the Chem Dex (${SUBSTANCES.length} substances).`, icon: 'trophy', reward: { coins: 6000, skill: 2 }, progress: (d) => [dexCount(d), SUBSTANCES.length] },
  { id: 'perfect50', name: 'Steady Hands', desc: 'Score 50 PERFECT mini-games.', icon: 'flame', reward: { coins: 400 }, progress: (d) => [d.stats.perfects, 50] },
  { id: 'perfect300', name: 'Human Pipette', desc: 'Score 300 PERFECT mini-games.', icon: 'flame', reward: { coins: 1500, skill: 1 }, progress: (d) => [d.stats.perfects, 300] },
  { id: 'combo8', name: 'Combo Chemist', desc: 'Reach an 8× PERFECT combo.', icon: 'bolt', reward: { coins: 600 }, progress: (d) => [d.stats.bestCombo ?? 0, 8] },
  { id: 'boom5', name: 'Eyebrows Optional', desc: 'Cause 5 lab accidents. Oops.', icon: 'extinguisher', reward: { coins: 150 }, progress: (d) => [d.stats.accidents, 5] },
  { id: 'boom25', name: 'Walking Fire Hazard', desc: 'Cause 25 lab accidents. Please stop.', icon: 'extinguisher', reward: { coins: 500 }, progress: (d) => [d.stats.accidents, 25] },
  { id: 'bold10', name: 'Bold Move', desc: 'Make 10 Bold Calls.', icon: 'bolt', reward: { coins: 300 }, progress: (d) => [d.stats.bold, 10] },
  { id: 'cases100', name: 'Case Cracker', desc: 'Solve 100 cases correctly.', icon: 'check', reward: { coins: 800 }, progress: (d) => [d.stats.correct, 100] },
  { id: 'cases400', name: 'Lab Legend', desc: 'Solve 400 cases correctly.', icon: 'trophy', reward: { coins: 3000, skill: 1 }, progress: (d) => [d.stats.correct, 400] },
  { id: 'rush15', name: 'Rush Hour Hero', desc: 'Solve 15 cases in one Rush Hour.', icon: 'infinity', reward: { coins: 1000 }, progress: (d) => [d.endlessBest, 15] },
  { id: 'gear8', name: 'Gearhead', desc: 'Buy 8 equipment upgrades.', icon: 'cart', reward: { coins: 700 }, progress: (d) => [EQUIPMENT.filter((u) => d.equip[u.id]).length, 8] },
  { id: 'rank10', name: 'Senior Chemist', desc: 'Reach lab rank 10.', icon: 'brain', reward: { coins: 800 }, progress: (_d, _s, r) => [r + 1, 10] },
  { id: 'streak7', name: 'Employee of the Week', desc: 'Claim the daily bonus 7 days in a row.', icon: 'calendar', reward: { coins: 700 }, progress: (d) => [d.daily.streak, 7] },
];
