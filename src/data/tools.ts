import type { ToolDef, ToolId } from './types';

export const TOOLS: ToolDef[] = [
  {
    id: 'ph', name: 'pH Strip', short: 'pH', prop: 'ph', introLevel: 1, minigame: 'hold', station: 'phbox',
    desc: 'Shows how acidic or basic a sample is.',
    howTo: 'HOLD to dip the strip. Let go when the marker is in the green zone!',
  },
  {
    id: 'sniff', name: 'Sniff Test', short: 'Sniff', prop: 'odor', introLevel: 2, minigame: 'rhythm', station: 'nose',
    desc: 'Waft the fumes toward your nose. Some samples are… spicy.',
    howTo: 'TAP each time the ring hits the circle — gentle wafts! Bad timing = big whiff.',
  },
  {
    id: 'flame', name: 'Flame Test', short: 'Flame', prop: 'flame', introLevel: 3, minigame: 'timing', station: 'burner', skin: 'flame',
    desc: 'Metals colour a flame; organic stuff chars; fuels catch fire.',
    howTo: 'TAP when the loop is in the hottest part of the flame (green zone).',
  },
  {
    id: 'microscope', name: 'Microscope', short: 'Scope', prop: 'crystal', introLevel: 5, minigame: 'focus', station: 'microscope',
    desc: 'Zoom in on crystal shapes, cells and tiny critters.',
    howTo: 'DRAG the focus knob until the picture is sharp, then hold it there.',
  },
  {
    id: 'iodine', name: 'Iodine Drop', short: 'Iodine', prop: 'iodine', introLevel: 7, minigame: 'drops', station: 'reagents', reagentColor: '#b5651d',
    desc: 'Turns blue-black if there is starch.',
    howTo: 'TAP to release each drop when it is the perfect size.',
  },
  {
    id: 'acid', name: 'Acid Drop', short: 'Acid', prop: 'acid', introLevel: 9, minigame: 'drops', station: 'reagents', reagentColor: '#ff6b6b',
    desc: 'Carbonates and some metals fizz. Bases get hot. Some things… gas you.',
    howTo: 'TAP to release each drop when it is the perfect size.',
  },
  {
    id: 'luminol', name: 'Luminol Spray', short: 'Luminol', prop: 'luminol', introLevel: 11, minigame: 'hold', station: 'reagents', reagentColor: '#6ab7ff',
    desc: 'Glows eerie blue with blood (and a few sneaky look-alikes).',
    howTo: 'HOLD to spray, release in the green zone. Lights go out, then look!',
  },
  {
    id: 'conduct', name: 'Conductivity Probe', short: 'Zap', prop: 'conduct', introLevel: 13, minigame: 'timing', station: 'conductivity', skin: 'gauge',
    desc: 'Dissolved salts and acids carry electricity. Sugar and alcohol do not.',
    howTo: 'TAP to close the circuit when the needle is in the green zone.',
  },
  {
    id: 'agno3', name: 'Silver Nitrate', short: 'AgNO₃', prop: 'agno3', introLevel: 15, minigame: 'drops', station: 'reagents', reagentColor: '#d9dde3',
    desc: 'Chlorides go white, bromides cream, iodides yellow.',
    howTo: 'TAP to release each drop when it is the perfect size.',
  },
  {
    id: 'magnet', name: 'Magnet', short: 'Magnet', prop: 'magnet', introLevel: 17, minigame: 'instant', station: 'magnet',
    desc: 'Iron, nickel and a few minerals jump to it. Instant!',
    howTo: 'No skill needed — it is a magnet. Just watch.',
  },
  {
    id: 'uv', name: 'UV Lamp', short: 'UV', prop: 'uv', introLevel: 21, minigame: 'sweep', station: 'uvlamp',
    desc: 'Some substances glow under black light.',
    howTo: 'DRAG the lamp around the dark sample to find the glowing spot.',
  },
  {
    id: 'density', name: 'Density Scale', short: 'Density', prop: 'density', introLevel: 23, minigame: 'timing', station: 'scale', skin: 'scale',
    desc: 'Weighs a measured volume. Heavy metals sink, oils float.',
    howTo: 'TAP when the wobbling needle is centred to lock the reading.',
  },
  {
    id: 'naoh', name: 'Sodium Hydroxide', short: 'NaOH', prop: 'naoh', introLevel: 25, minigame: 'drops', station: 'reagents', reagentColor: '#c7a6ff',
    desc: 'Metal ions make coloured gunk: copper blue, iron green or rust.',
    howTo: 'TAP to release each drop when it is the perfect size.',
  },
  {
    id: 'bacl2', name: 'Barium Chloride', short: 'BaCl₂', prop: 'bacl2', introLevel: 27, minigame: 'drops', station: 'reagents', reagentColor: '#9be8a8',
    desc: 'A thick white cloud means sulfate.',
    howTo: 'TAP to release each drop when it is the perfect size.',
  },
  {
    id: 'splint', name: 'Splint Test', short: 'Splint', prop: 'splint', introLevel: 31, minigame: 'timing', station: 'burner', skin: 'splint',
    desc: 'Poke a glowing splint in. Pop = hydrogen. Relight = oxygen.',
    howTo: 'TAP when the ember glows brightest (green zone).',
  },
  {
    id: 'geiger', name: 'Geiger Counter', short: 'Geiger', prop: 'rad', introLevel: 35, minigame: 'machine', machineTime: 5, station: 'geiger',
    desc: 'Counts radiation clicks. Runs by itself while you do other tests.',
    howTo: 'It runs in the background — keep testing while it counts!',
  },
  {
    id: 'massspec', name: 'Mass Spectrometer', short: 'Mass', prop: 'mass', introLevel: 41, minigame: 'machine', machineTime: 8, station: 'massspec',
    desc: 'Weighs the molecule itself. Slow, costs coins per run, but brutally precise.',
    howTo: 'It runs in the background — keep testing while it crunches!',
  },
];

export const TOOL_MAP = Object.fromEntries(TOOLS.map((t) => [t.id, t])) as Record<ToolId, ToolDef>;

export function toolsAvailableAt(level: number): ToolDef[] {
  return TOOLS.filter((t) => t.introLevel <= level);
}

/** Human readable results ------------------------------------------------- */

export interface ValueInfo {
  label: string;
  color: string;
}

const GREY = '#9aa3b2';

export const ODOR_INFO: Record<string, ValueInfo & { lines: string[] }> = {
  none: { label: 'No smell', color: GREY, lines: ['Smells like… nothing. Suspiciously nothing.', 'Not a whiff. Your nose is disappointed.'] },
  vinegar: { label: 'Sour vinegar', color: '#c9d16b', lines: ['Smells like a pickle jar sneezed.', 'Sour! Your eyes are doing a little squint.'] },
  citrus: { label: 'Lemony fresh', color: '#ffe14d', lines: ['Zesty! It smells like a fancy lemonade stand.', 'Citrus burst. Your nose feels sparkly.'] },
  'rotten-egg': { label: 'Rotten eggs', color: '#b8a940', lines: ['UGH. Rotten eggs. Gerald has left the bench.', 'Smells like a dragon burped after an egg buffet.'] },
  ammonia: { label: 'Sharp ammonia', color: '#a6d9ff', lines: ['Sharp! Like a cat litter box in a sauna.', 'Your nose hairs just packed their bags.'] },
  chlorine: { label: 'Pool chlorine', color: '#bff0ff', lines: ['Smells like the public swimming pool. Flashbacks!', 'Chlorine! Somewhere a lifeguard blows a whistle.'] },
  alcohol: { label: 'Boozy alcohol', color: '#e0d4ff', lines: ['Smells like a hand sanitiser factory.', 'Boozy! Do not tell the boss.'] },
  'nail-polish': { label: 'Nail-polish remover', color: '#ffb3e6', lines: ['Smells like a nail salon on a busy Saturday.', 'Sharp and sweetish — very nail-polish-remover.'] },
  sweet: { label: 'Sweet', color: '#ffc4dd', lines: ['Sweet… suspiciously sweet.', 'Smells like candy. Do NOT taste it.'] },
  fruity: { label: 'Fruity', color: '#ff9f6b', lines: ['Fruity! Like a smoothie with a secret.', 'Smells like a fruit salad doing jazz hands.'] },
  floral: { label: 'Flowery', color: '#f4a6ff', lines: ['Flowery! Like grandma\'s bathroom.', 'Smells like a bouquet that went to college.'] },
  minty: { label: 'Minty fresh', color: '#7dffcf', lines: ['Minty! Your nose feels like it brushed its teeth.', 'Cool mint. Very refreshing. Very toothpaste.'] },
  vanilla: { label: 'Vanilla', color: '#f5e1b8', lines: ['Mmm, vanilla. Like a bakery hugging you.', 'Vanilla! Your stomach growls loudly.'] },
  coffee: { label: 'Coffee', color: '#a0703f', lines: ['Coffee! You are now 12% more awake.', 'Smells like Monday morning salvation.'] },
  tomato: { label: 'Tangy tomato', color: '#ff6b5b', lines: ['Tangy tomato… are there fries nearby?', 'Smells like a burger joint.'] },
  earthy: { label: 'Earthy', color: '#a4895e', lines: ['Smells like a garden after rain.', 'Earthy. Like a worm\'s living room.'] },
  metallic: { label: 'Metallic', color: '#c4ccd6', lines: ['Smells like a handful of old coins.', 'Metallic… like licking a battery (please don\'t).'] },
  pungent: { label: 'Eye-watering fumes', color: '#ffdf6b', lines: ['AAARGH! Sharp fumes! Your eyes are crying.', 'That burned. Your nose files a complaint.'] },
  gasoline: { label: 'Petrol', color: '#d4b26b', lines: ['Smells like a gas station.', 'Petrol! Somewhere a lawnmower revs.'] },
  sea: { label: 'Salty sea breeze', color: '#8fd8ff', lines: ['Smells like a beach holiday you did not get.', 'Seaside vibes. A seagull would steal this.'] },
  fishy: { label: 'Fishy', color: '#8fb3a8', lines: ['Fishy. Very, very fishy.', 'Smells like the bottom of a fish tank.'] },
  spicy: { label: 'Warm spice', color: '#ffb347', lines: ['Spicy and warm — like a curry hug.', 'Smells like a spice market. ACHOO!'] },
  squeaky: { label: 'No smell — but SQUEAKY voice!', color: '#ffe0ff', lines: ['No smell… "WHY IS MY VOICE SO SQUEAKY?!"', 'You say "hmm" and sound like a cartoon chipmunk.'] },
  gunpowder: { label: 'Spent fireworks', color: '#9a9a9a', lines: ['Smells like the morning after fireworks night.', 'Smoky gunpowder. Very… astronaut-y?'] },
  chocolate: { label: 'Chocolate!', color: '#8b5a2b', lines: ['CHOCOLATE. Focus. FOCUS. Do not eat the evidence.', 'Smells like a brownie. You are now hungry. Thanks.'] },
  mothball: { label: 'Mothballs', color: '#e8e8d8', lines: ['Smells exactly like grandma\'s wardrobe.', 'Mothballs! Somewhere, a moth is screaming.'] },
};

export const FLAME_INFO: Record<string, ValueInfo> = {
  none: { label: 'No colour change', color: '#6fa8ff' },
  yellow: { label: 'Bright yellow-orange', color: '#ffd21f' },
  lilac: { label: 'Lilac (pale purple)', color: '#c58cff' },
  'brick-red': { label: 'Brick red', color: '#e2512b' },
  crimson: { label: 'Crimson red', color: '#e0103a' },
  'apple-green': { label: 'Apple green', color: '#97e64a' },
  'blue-green': { label: 'Blue-green', color: '#1fd1b0' },
  'bright-green': { label: 'Vivid green', color: '#3dff2a' },
  'white-flash': { label: 'Blinding white flash', color: '#ffffff' },
  chars: { label: 'Blackens and chars', color: '#3a3a3a' },
  'burns-blue': { label: 'Catches fire — blue flame', color: '#3d7bff' },
  'burns-yellow': { label: 'Catches fire — smoky yellow', color: '#ff9a3c' },
  'burns-invisible': { label: 'Burns almost invisibly', color: '#bcd6ff' },
  sparks: { label: 'Orange sparkles', color: '#ffb347' },
  pop: { label: 'Squeaky POP!', color: '#fff3a0' },
  rainbow: { label: 'RAINBOW?!', color: '#ff4dd2' },
};

export const PH_BUCKETS = [
  { max: 2.5, label: 'Very acidic', color: '#e53935' },
  { max: 6.4, label: 'Acidic', color: '#fb8c00' },
  { max: 7.6, label: 'Neutral', color: '#43a047' },
  { max: 11.0, label: 'Basic', color: '#1e88e5' },
  { max: 99, label: 'Very basic', color: '#7b1fa2' },
];

export const CONDUCT_INFO: Record<string, ValueInfo> = {
  high: { label: 'Bright bulb — strong conductor', color: '#ffe14d' },
  low: { label: 'Dim bulb — weak conductor', color: '#c7a94a' },
  none: { label: 'Bulb stays dark — no conduction', color: GREY },
};

export const CRYSTAL_INFO: Record<string, ValueInfo> = {
  none: { label: 'Just liquid — nothing to see', color: GREY },
  cubes: { label: 'Neat little cubes', color: '#9ad7ff' },
  prisms: { label: 'Chunky prisms', color: '#b6f0ff' },
  needles: { label: 'Thin needles', color: '#d5f5ff' },
  grains: { label: 'Round starch grains', color: '#fff2c4' },
  plates: { label: 'Flat stacked plates', color: '#d8d8e8' },
  shards: { label: 'Jagged shards', color: '#d0d6de' },
  rhombs: { label: 'Slanted rhombs', color: '#e8f0c0' },
  octahedra: { label: 'Double pyramids', color: '#c4e4ff' },
  amorphous: { label: 'Shapeless blobs', color: '#c9c9c9' },
  'metal-grain': { label: 'Shiny metal grains', color: '#c9d1d9' },
  'blood-cells': { label: 'Red donut-shaped cells', color: '#e04848' },
  'plant-cells': { label: 'Boxy plant cells', color: '#8fd16b' },
  droplets: { label: 'Tiny round droplets', color: '#fff7d6' },
  pollen: { label: 'Spiky pollen grains', color: '#ffd84d' },
  microbes: { label: 'Wiggly microbes!', color: '#9df0c0' },
  algae: { label: 'Green algae strands', color: '#5ec46b' },
  crosshatch: { label: 'Criss-cross metal pattern', color: '#b0b6bd' },
  hexagons: { label: 'Perfect hexagons', color: '#9de6ff' },
};

export const UV_INFO: Record<string, ValueInfo> = {
  none: { label: 'No glow', color: '#3b2f5e' },
  blue: { label: 'Glows electric blue', color: '#4da6ff' },
  green: { label: 'Glows vivid green', color: '#59ff59' },
  yellow: { label: 'Glows yellow', color: '#fff23d' },
  orange: { label: 'Glows orange', color: '#ff9b2f' },
  red: { label: 'Glows deep red', color: '#ff3355' },
  purple: { label: 'Glows ultraviolet purple', color: '#c04dff' },
};

export const RAD_INFO: ValueInfo[] = [
  { label: 'Silence — background only', color: '#7fd17f' },
  { label: 'A few clicks — slightly radioactive', color: '#e6e64d' },
  { label: 'Steady clicking — radioactive!', color: '#ffa43d' },
  { label: 'FRANTIC clicking — very radioactive!', color: '#ff4040' },
];

export const ACID_INFO: Record<string, ValueInfo> = {
  none: { label: 'No reaction', color: GREY },
  fizz: { label: 'Fizzes — gas bubbles', color: '#bfefff' },
  vigorous: { label: 'Fizzes VIOLENTLY', color: '#7fe0ff' },
  stink: { label: 'Rotten-egg gas!', color: '#c9b84a' },
  hot: { label: 'Gets hot — neutralises', color: '#ff7a45' },
  'toxic-gas': { label: 'Choking green gas!', color: '#c5f04a' },
};

export const AG_INFO: Record<string, ValueInfo> = {
  none: { label: 'Stays clear', color: GREY },
  white: { label: 'White precipitate (chloride)', color: '#ffffff' },
  cream: { label: 'Cream precipitate (bromide)', color: '#fff0c4' },
  yellow: { label: 'Yellow precipitate (iodide)', color: '#ffe25a' },
  cloudy: { label: 'Faint cloudiness', color: '#dde6ee' },
  black: { label: 'Black precipitate (sulfide)', color: '#222222' },
};

export const BA_INFO: Record<string, ValueInfo> = {
  none: { label: 'Stays clear', color: GREY },
  white: { label: 'Thick white cloud (sulfate)', color: '#ffffff' },
};

export const NAOH_INFO: Record<string, ValueInfo> = {
  none: { label: 'No precipitate', color: GREY },
  blue: { label: 'Blue precipitate (copper)', color: '#2f7cff' },
  green: { label: 'Green precipitate (iron II)', color: '#5fa34a' },
  rust: { label: 'Rust-brown precipitate (iron III)', color: '#a0471c' },
  white: { label: 'White precipitate', color: '#f4f4f4' },
  ammonia: { label: 'Releases ammonia smell', color: '#a6d9ff' },
  pink: { label: 'Pinkish precipitate (cobalt)', color: '#e2729b' },
  yellow: { label: 'Turns yellow / yellow solid', color: '#ffd84a' },
  red: { label: 'Turns blood red', color: '#c3141f' },
};

export const IODINE_INFO: Record<string, ValueInfo> = {
  none: { label: 'Stays orange-brown', color: '#c17a2c' },
  'blue-black': { label: 'Turns blue-black (starch!)', color: '#141a4a' },
};

export const LUMINOL_INFO: Record<string, ValueInfo> = {
  none: { label: 'No glow', color: '#2a2f4a' },
  glow: { label: 'Eerie blue glow!', color: '#5ab4ff' },
  flash: { label: 'Bright flash, then fades', color: '#e8f4ff' },
};

export const SPLINT_INFO: Record<string, ValueInfo> = {
  none: { label: 'Nothing special', color: GREY },
  pop: { label: 'Squeaky POP!', color: '#fff3a0' },
  relight: { label: 'Bursts into flame!', color: '#ff9a3c' },
  out: { label: 'Splint goes out', color: '#7d7d7d' },
  burns: { label: 'Gas catches fire', color: '#4d8bff' },
};

export const MAGNET_INFO: Record<string, ValueInfo> = {
  true: { label: 'CLANK! It is magnetic', color: '#ff5a5f' },
  false: { label: 'Not magnetic', color: GREY },
};
