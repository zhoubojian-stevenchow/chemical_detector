import type { Item } from '../data/shop';

export type ItemId = Item['id'];

export interface LevelRecord {
  /** [clear, flawless, speedy] */
  stars: [boolean, boolean, boolean];
  best: number;
}

export interface Settings {
  music: number;
  sfx: number;
  quality: 'auto' | 'low' | 'high';
  shake: boolean;
}

export interface SaveData {
  v: number;
  coins: number;
  xp: number;
  bonusSkillPoints: number;
  skills: Record<string, number>;
  equip: Record<string, boolean>;
  perks: Record<string, boolean>;
  items: Record<ItemId, number>;
  cosmetics: Record<string, boolean>;
  hat: string;
  theme: string;
  levels: Record<number, LevelRecord>;
  dex: Record<string, number>;
  flags: Record<string, boolean>;
  settings: Settings;
  stats: { cases: number; correct: number; accidents: number; perfects: number; shifts: number; bold: number; bestCombo: number };
  /** unlocked achievements */
  achievements: Record<string, boolean>;
  daily: { last: string; streak: number };
  dailyCase: { last: string };
  endlessBest: number;
  lastFreeCoins: number;
  /** shifts in a row without an accident (shown on the lab sign) */
  accStreak: number;
}

export const SAVE_VERSION = 1;

export function defaultSave(): SaveData {
  return {
    v: SAVE_VERSION,
    coins: 0,
    xp: 0,
    bonusSkillPoints: 0,
    skills: {},
    equip: {},
    perks: {},
    items: { espresso: 1, hint: 2, extinguisher: 1, firstaid: 0 },
    cosmetics: { hat_none: true, theme_classic: true },
    hat: 'hat_none',
    theme: 'theme_classic',
    levels: {},
    dex: {},
    flags: {},
    settings: { music: 0.6, sfx: 0.85, quality: 'auto', shake: true },
    stats: { cases: 0, correct: 0, accidents: 0, perfects: 0, shifts: 0, bold: 0, bestCombo: 0 },
    achievements: {},
    daily: { last: '', streak: 0 },
    dailyCase: { last: '' },
    endlessBest: 0,
    lastFreeCoins: 0,
    accStreak: 0,
  };
}

/** Key/value storage. Platforms may replace it (e.g. CrazyGames cloud saves). */
export interface KVStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

class SafeLocalStorage implements KVStore {
  private mem = new Map<string, string>();
  getItem(key: string): string | null {
    try {
      const v = window.localStorage.getItem(key);
      if (v !== null) return v;
    } catch {
      /* storage blocked (private mode / iframe) */
    }
    return this.mem.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.mem.set(key, value);
    try {
      window.localStorage.setItem(key, value);
    } catch {
      /* ignore */
    }
  }
}

const KEY = 'chemdetective_save_v1';

export class SaveManager {
  data: SaveData = defaultSave();
  private store: KVStore = new SafeLocalStorage();
  private timer: number | null = null;

  setStore(store: KVStore): void {
    this.store = store;
  }

  load(): SaveData {
    try {
      const raw = this.store.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<SaveData>;
        this.data = merge(defaultSave(), parsed);
      }
    } catch {
      this.data = defaultSave();
    }
    return this.data;
  }

  /** Debounced save. */
  save(): void {
    if (this.timer !== null) return;
    this.timer = window.setTimeout(() => {
      this.timer = null;
      this.flush();
    }, 250);
  }

  flush(): void {
    try {
      this.store.setItem(KEY, JSON.stringify(this.data));
    } catch {
      /* ignore */
    }
  }

  reset(): void {
    const settings = this.data.settings;
    this.data = defaultSave();
    this.data.settings = settings;
    this.flush();
  }
}

/** Same JSON "shape" (array / object / null / primitive type)? */
function sameKind(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b);
  return typeof a === typeof b && (a === null) === (b === null);
}

function merge<T>(base: T, over: Partial<T>): T {
  const out: any = Array.isArray(base) ? [...(base as any)] : { ...base };
  for (const k in over) {
    const v = (over as any)[k];
    const b = (base as any)[k];
    if (v === undefined) continue;
    // a corrupt or foreign value (null where an object belongs, wrong type…) keeps the default
    if (b !== undefined && b !== null && !sameKind(v, b)) continue;
    if (v && typeof v === 'object' && !Array.isArray(v) && b && typeof b === 'object' && !Array.isArray(b)) {
      out[k] = merge(b, v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

export const save = new SaveManager();
