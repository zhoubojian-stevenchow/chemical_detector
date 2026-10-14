import { describe, expect, it } from 'vitest';
import { SaveManager, defaultSave } from '../src/core/save';

function load(raw: string) {
  const m = new SaveManager();
  m.setStore({ getItem: () => raw, setItem: () => {} });
  return m.load();
}

describe('save loading', () => {
  it('keeps progress from a valid save', () => {
    const d = load(JSON.stringify({ coins: 1234, levels: { 1: { stars: [true, false, true], best: 90 } }, stats: { cases: 7 } }));
    expect(d.coins).toBe(1234);
    expect(d.levels[1].stars).toEqual([true, false, true]);
    expect(d.stats.cases).toBe(7);
    expect(d.stats.correct).toBe(0); // missing fields fall back to defaults
  });

  it('survives null and wrongly-typed fields (corrupt or foreign saves)', () => {
    const d = load(JSON.stringify({ coins: 'lots', settings: null, levels: null, stats: [], dex: { salt: 2 }, achievements: 5 }));
    const def = defaultSave();
    expect(d.coins).toBe(def.coins);
    expect(d.settings).toEqual(def.settings);
    expect(d.levels).toEqual({});
    expect(d.stats).toEqual(def.stats);
    expect(d.dex).toEqual({ salt: 2 });
    expect(d.achievements).toEqual({});
  });

  it('falls back to a fresh save on unreadable data', () => {
    expect(load('{not json')).toEqual(defaultSave());
  });
});
