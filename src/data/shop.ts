import type { ToolId } from './types';

export interface EquipmentUpgrade {
  id: string;
  /** tools affected (reagent rack upgrades affect every drop test) */
  tools: ToolId[];
  tier: 2 | 3;
  name: string;
  desc: string;
  price: number;
  /** shop shows it once this level is unlocked */
  minLevel: number;
  requires?: string;
}

export const EQUIPMENT: EquipmentUpgrade[] = [
  { id: 'ph2', tools: ['ph'], tier: 2, name: 'Digital pH Meter', desc: 'Reads the exact pH number instead of a colour band. Bigger sweet spot.', price: 350, minLevel: 3 },
  { id: 'ph3', tools: ['ph'], tier: 3, name: 'Smart pH Probe', desc: 'Fully automatic and even more precise. No mini-game!', price: 1800, minLevel: 12, requires: 'ph2' },
  { id: 'sniff2', tools: ['sniff'], tier: 2, name: 'Nose Clip Pro', desc: 'Toxic fumes hurt less and the waft rhythm is more forgiving.', price: 450, minLevel: 4 },
  { id: 'sniff3', tools: ['sniff'], tier: 3, name: 'Robo-Nose 3000', desc: 'A robot sniffs for you. Zero damage, zero effort, mild robot jealousy.', price: 2400, minLevel: 15, requires: 'sniff2' },
  { id: 'flame2', tools: ['flame', 'splint'], tier: 2, name: 'Turbo Burner', desc: 'Steadier flame: bigger sweet spot for flame and splint tests.', price: 600, minLevel: 5 },
  { id: 'flame3', tools: ['flame', 'splint'], tier: 3, name: 'Flame Spectrometer', desc: 'Reads flames automatically. No mini-game for flame or splint tests.', price: 2800, minLevel: 18, requires: 'flame2' },
  { id: 'scope2', tools: ['microscope'], tier: 2, name: 'Auto-Focus Lens', desc: 'Much wider focus window. Squinting optional.', price: 750, minLevel: 7 },
  { id: 'scope3', tools: ['microscope'], tier: 3, name: 'Electron Microscope', desc: 'Instant crystal-clear images. No mini-game!', price: 3200, minLevel: 22, requires: 'scope2' },
  { id: 'drops2', tools: ['iodine', 'acid', 'agno3', 'naoh', 'bacl2', 'luminol'], tier: 2, name: 'Steady Dropper', desc: 'Every reagent drop gets a bigger sweet spot.', price: 900, minLevel: 10 },
  { id: 'drops3', tools: ['iodine', 'acid', 'agno3', 'naoh', 'bacl2', 'luminol'], tier: 3, name: 'Robo-Pipette', desc: 'All reagent tests become automatic. Your thumbs can retire.', price: 4200, minLevel: 26, requires: 'drops2' },
  { id: 'conduct2', tools: ['conduct'], tier: 3, name: 'Auto-Clamp Probe', desc: 'Conductivity tests run automatically.', price: 1300, minLevel: 15 },
  { id: 'uv2', tools: ['uv'], tier: 2, name: 'Wide-Beam UV Lamp', desc: 'A much bigger beam makes glow spots easy to find.', price: 1100, minLevel: 22 },
  { id: 'uv3', tools: ['uv'], tier: 3, name: 'UV Scanner', desc: 'Scans the whole sample instantly. No mini-game!', price: 3400, minLevel: 30, requires: 'uv2' },
  { id: 'density2', tools: ['density'], tier: 2, name: 'Precision Scale', desc: 'Readings 3× more precise — tell near-twins apart.', price: 1500, minLevel: 24 },
  { id: 'density3', tools: ['density'], tier: 3, name: 'Digital Densitometer', desc: 'Automatic and ultra-precise.', price: 3800, minLevel: 32, requires: 'density2' },
  { id: 'geiger2', tools: ['geiger'], tier: 2, name: 'Turbo Geiger Tube', desc: 'Counts twice as fast.', price: 2200, minLevel: 36 },
  { id: 'mass2', tools: ['massspec'], tier: 2, name: 'HD Spectrometer', desc: 'Faster, sharper peaks, and each run costs only 15 coins.', price: 3500, minLevel: 42 },
  { id: 'mass3', tools: ['massspec'], tier: 3, name: 'Quantum Spectrometer', desc: 'Blazing fast, insanely precise, and runs cost just 5 coins.', price: 7500, minLevel: 48, requires: 'mass2' },
];

export interface Perk {
  id: string;
  name: string;
  desc: string;
  price: number;
  minLevel: number;
}

export const PERKS: Perk[] = [
  { id: 'coffee', name: 'Coffee Machine', desc: '+10% time on every shift. Fuel for science.', price: 700, minLevel: 4 },
  { id: 'chair', name: 'Comfy Lab Chair', desc: 'All mini-game sweet spots +10%. Relaxed hands, steady hands.', price: 1000, minLevel: 6 },
  { id: 'hood', name: 'Fume Hood', desc: 'Sucks away nasty fumes: sniffing is one level safer.', price: 1200, minLevel: 8 },
  { id: 'blanket', name: 'Fire Blanket', desc: 'The first accident of every shift costs no heart.', price: 1500, minLevel: 10 },
  { id: 'shower', name: 'Safety Shower', desc: '+1 max heart on every shift.', price: 2500, minLevel: 14 },
  { id: 'training', name: 'Gerald\'s Training', desc: 'If you stall for a few seconds, Gerald points at a useful tool.', price: 1800, minLevel: 12 },
  { id: 'cat', name: 'Lucky Cat Statue', desc: '+10% coins from every case. It waves. Constantly.', price: 3000, minLevel: 16 },
  { id: 'trophy', name: 'Golden Beaker', desc: '+20% XP forever. Shiny. So shiny.', price: 6000, minLevel: 25 },
];

export interface Item {
  id: 'espresso' | 'hint' | 'extinguisher' | 'firstaid';
  name: string;
  desc: string;
  price: number;
  color: string;
}

export const ITEMS: Item[] = [
  { id: 'espresso', name: 'Espresso Shot', desc: '+20 seconds on the shift clock.', price: 60, color: '#8b5a2b' },
  { id: 'hint', name: 'Lab Notes', desc: 'Rules out one wrong answer and highlights the best test.', price: 90, color: '#ffd23f' },
  { id: 'extinguisher', name: 'Extinguisher', desc: 'Automatically cancels the next accident.', price: 75, color: '#ff4d4d' },
  { id: 'firstaid', name: 'First-Aid Kit', desc: 'Restores one heart.', price: 110, color: '#2ed573' },
];

export interface Cosmetic {
  id: string;
  kind: 'hat' | 'theme';
  name: string;
  desc: string;
  price: number;
  /** theme colours: wall, floor A, floor B, accent */
  colors?: [string, string, string, string];
}

export const COSMETICS: Cosmetic[] = [
  { id: 'hat_none', kind: 'hat', name: 'No Hat', desc: 'Gerald, au naturel.', price: 0 },
  { id: 'hat_party', kind: 'hat', name: 'Party Hat', desc: 'Every shift is a celebration.', price: 300 },
  { id: 'hat_chef', kind: 'hat', name: 'Chef Hat', desc: 'Gerald dreams of cooking. Like that movie.', price: 600 },
  { id: 'hat_propeller', kind: 'hat', name: 'Propeller Cap', desc: 'Spins when he is excited.', price: 700 },
  { id: 'hat_top', kind: 'hat', name: 'Top Hat', desc: 'Distinguished rodent.', price: 1200 },
  { id: 'hat_wizard', kind: 'hat', name: 'Wizard Hat', desc: 'Chemistry is just science magic.', price: 2000 },
  { id: 'hat_crown', kind: 'hat', name: 'Royal Crown', desc: 'King of the lab.', price: 4000 },
  { id: 'theme_classic', kind: 'theme', name: 'Classic Lab', desc: 'Clean teal walls.', price: 0, colors: ['#bfe9e1', '#f2efe6', '#d9d4c7', '#21c7a8'] },
  { id: 'theme_sunny', kind: 'theme', name: 'Sunny Side', desc: 'Warm buttery yellow.', price: 900, colors: ['#ffe8a8', '#fff6dc', '#f2dfb1', '#ffb627'] },
  { id: 'theme_candy', kind: 'theme', name: 'Candy Lab', desc: 'Bubblegum chemistry.', price: 1600, colors: ['#ffc8e1', '#fff0f6', '#f5cfe2', '#ff5fa2'] },
  { id: 'theme_midnight', kind: 'theme', name: 'Midnight Lab', desc: 'Moody deep blue.', price: 2400, colors: ['#3a4a7a', '#5a6a96', '#4a5884', '#7b9cff'] },
  { id: 'theme_retro', kind: 'theme', name: 'Retro 70s', desc: 'Orange. So much orange.', price: 3000, colors: ['#f4a259', '#f9dcb0', '#e8c08a', '#bc4b51'] },
];

export const FREE_COINS_AD = 150;
export const FREE_COINS_COOLDOWN_MS = 4 * 60 * 1000;
