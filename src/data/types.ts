// Shared data types for Chem Detective.

export type State = 'powder' | 'crystals' | 'liquid' | 'gel' | 'gas' | 'metal' | 'chunk';
export type Container = 'dish' | 'jar' | 'beaker' | 'flask' | 'bottle' | 'canister' | 'vial' | 'bag';

export type Odor =
  | 'none' | 'vinegar' | 'citrus' | 'rotten-egg' | 'ammonia' | 'chlorine' | 'alcohol' | 'nail-polish'
  | 'sweet' | 'fruity' | 'floral' | 'minty' | 'vanilla' | 'coffee' | 'tomato' | 'earthy' | 'metallic'
  | 'pungent' | 'gasoline' | 'sea' | 'fishy' | 'spicy' | 'squeaky' | 'gunpowder' | 'chocolate' | 'mothball';

export type Flame =
  | 'none' | 'yellow' | 'lilac' | 'brick-red' | 'crimson' | 'apple-green' | 'blue-green' | 'bright-green'
  | 'white-flash' | 'chars' | 'burns-blue' | 'burns-yellow' | 'burns-invisible' | 'sparks' | 'pop' | 'rainbow';

export type Conduct = 'high' | 'low' | 'none';

export type Crystal =
  | 'none' | 'cubes' | 'prisms' | 'needles' | 'grains' | 'plates' | 'shards' | 'rhombs' | 'octahedra'
  | 'amorphous' | 'metal-grain' | 'blood-cells' | 'plant-cells' | 'droplets' | 'pollen' | 'microbes'
  | 'algae' | 'crosshatch' | 'hexagons';

export type Uv = 'none' | 'blue' | 'green' | 'yellow' | 'orange' | 'red' | 'purple';
export type AcidResult = 'none' | 'fizz' | 'vigorous' | 'stink' | 'hot' | 'toxic-gas';
export type AgResult = 'none' | 'white' | 'cream' | 'yellow' | 'cloudy' | 'black';
export type BaResult = 'none' | 'white';
export type NaohResult = 'none' | 'blue' | 'green' | 'rust' | 'white' | 'ammonia' | 'pink' | 'yellow' | 'red';
export type IodineResult = 'none' | 'blue-black';
export type LuminolResult = 'none' | 'glow' | 'flash';
export type SplintResult = 'none' | 'pop' | 'relight' | 'out' | 'burns';

export interface SubstanceProps {
  ph: number;
  odor: Odor;
  flame: Flame;
  conduct: Conduct;
  magnet: boolean;
  crystal: Crystal;
  uv: Uv;
  rad: 0 | 1 | 2 | 3;
  /** g/cm³ (gases are stored in g/cm³ too and displayed as g/L) */
  density: number;
  /** g/mol of the most interesting molecule. POLYMER means "huge molecule / messy mixture". */
  mass: number;
  acid: AcidResult;
  agno3: AgResult;
  bacl2: BaResult;
  naoh: NaohResult;
  iodine: IodineResult;
  luminol: LuminolResult;
  splint: SplintResult;
}

export type PropKey = keyof SubstanceProps;

export interface Substance {
  id: string;
  name: string;
  formula: string;
  state: State;
  /** main colour (hex) */
  color: string;
  /** short description of appearance shown on the card */
  look: string;
  container: Container;
  props: SubstanceProps;
  /** 0 harmless, 1 coughing fit, 2 hurts on a bad sniff, 3 hurts unless the waft is perfect */
  toxic: 0 | 1 | 2 | 3;
  flammable: boolean;
  fizzy?: boolean;
  smoky?: boolean;
  glow?: boolean;
  opacity?: number;
  fictional?: boolean;
  fact: string;
}

export type ToolId =
  | 'ph' | 'sniff' | 'flame' | 'microscope' | 'iodine' | 'acid' | 'luminol' | 'conduct' | 'agno3'
  | 'magnet' | 'uv' | 'density' | 'naoh' | 'bacl2' | 'splint' | 'geiger' | 'massspec';

export type MinigameKind = 'hold' | 'rhythm' | 'timing' | 'focus' | 'drops' | 'instant' | 'sweep' | 'machine';

export type StationId =
  | 'burner' | 'reagents' | 'phbox' | 'conductivity' | 'microscope' | 'scale' | 'uvlamp' | 'geiger'
  | 'massspec' | 'magnet' | 'nose';

export interface ToolDef {
  id: ToolId;
  name: string;
  /** tiny label for buttons */
  short: string;
  prop: PropKey;
  introLevel: number;
  minigame: MinigameKind;
  /** base processing seconds for machines */
  machineTime?: number;
  station: StationId;
  /** one-line explanation shown in tooltips & tutorials */
  desc: string;
  /** how to play its mini-game */
  howTo: string;
  /** reagent bottle colour for drop tests */
  reagentColor?: string;
  /** used for the timing mini-game's skin */
  skin?: 'flame' | 'gauge' | 'bar' | 'splint' | 'scale';
}

export interface Look {
  skin: string;
  shirt: string;
  body?: 'normal' | 'wide' | 'tall' | 'small';
  hair?: { style: 'bun' | 'short' | 'spiky' | 'long' | 'wild' | 'curly' | 'ponytail' | 'mohawk' | 'side'; color: string };
  hat?:
    | 'cap' | 'police' | 'chief' | 'chef' | 'fedora' | 'hardhat' | 'propeller' | 'top' | 'straw' | 'beret'
    | 'military' | 'space' | 'miner' | 'bucket' | 'headband' | 'hairnet' | 'beekeeper' | 'cowboy' | 'wizard';
  hatColor?: string;
  eyewear?: 'glasses' | 'sunglasses' | 'goggles' | 'monocle';
  face?: ('mustache' | 'beard' | 'freckles' | 'blush' | 'stubble' | 'lashes')[];
  extra?: ('tie' | 'badge' | 'vest' | 'medals' | 'sash' | 'antenna' | 'apron' | 'earpiece' | 'pearls' | 'labcoat' | 'bowtie' | 'scarf')[];
  threeEyes?: boolean;
}

export interface Voice {
  pitch: number; // base frequency Hz
  speed: number; // syllables per second
  wave: OscillatorType;
}

export interface ClientDef {
  id: string;
  name: string;
  title: string;
  look: Look;
  voice: Voice;
  hello: string[];
  happy: string[];
  angry: string[];
  /** fee multiplier */
  pay: number;
}

export interface CaseTemplate {
  id: string;
  client: string;
  /** substances that can appear in the lineup */
  pool: string[];
  /** substances allowed to be the true answer (defaults to the whole pool) */
  answers?: string[];
  /** request text. {count} → number of candidates */
  text: string;
  /** outcome lines. {answer} → true answer name, {guess} → player's guess */
  win: string;
  lose: string;
  /** label written on the sample */
  label?: string;
}

export type Modifier = 'rush' | 'inspector' | 'night' | 'boss' | `broken:${ToolId}`;

export interface LevelDef {
  id: number;
  chapter: number;
  title: string;
  blurb: string;
  cases: string[];
  size: number;
  /** extra time multiplier (1 = default) */
  timeMul?: number;
  mods?: Modifier[];
}

export interface ChapterDef {
  id: number;
  name: string;
  subtitle: string;
  starsToUnlock: number;
  color: string;
  icon: string;
}
