import { describe, expect, it } from 'vitest';
import { defaultSave } from '../src/core/save';
import { makeRng } from '../src/core/util';
import { LEVELS } from '../src/data/levels';
import { Progress } from '../src/game/progress';
import { Shift } from '../src/game/shift';

function mkShift(levelId: number, seed = 1, saveMod?: (s: ReturnType<typeof defaultSave>) => void) {
  const data = defaultSave();
  saveMod?.(data);
  const progress = new Progress(() => data);
  const level = LEVELS[levelId - 1];
  const shift = new Shift({ mode: 'campaign', level, difficulty: 0, tools: progress.toolsFor(level.id, level.mods) }, progress, makeRng(seed));
  return { shift, progress, data };
}

describe('Shift', () => {
  it('builds lineups that contain the answer and respect size', () => {
    for (const l of LEVELS) {
      const { shift } = mkShift(l.id, l.id * 7);
      for (const c of shift.cases) {
        expect(c.lineup).toContain(c.answer);
        expect(c.lineup.length).toBeLessThanOrEqual(l.size);
        expect(new Set(c.lineup).size).toBe(c.lineup.length);
      }
      expect(shift.totalTime).toBeGreaterThan(20);
    }
  });

  it('greedy best-tool play always isolates the answer', () => {
    for (const l of LEVELS) {
      for (let seed = 1; seed < 6; seed++) {
        const { shift } = mkShift(l.id, seed * 31 + l.id);
        while (true) {
          let guard = 0;
          while (shift.remaining().length > 1 && guard++ < 20) {
            const t = shift.bestTool();
            expect(t, `L${l.id} no useful tool`).not.toBeNull();
            shift.applyReading(t!);
          }
          expect(shift.remaining()).toEqual([shift.current.answer]);
          const r = shift.submit(shift.current.answer);
          expect(r.correct).toBe(true);
          if (!shift.next()) break;
        }
        const res = shift.finalize();
        expect(res.cleared).toBe(true);
        expect(res.stars[1]).toBe(true);
      }
    }
  });

  it('wrong answers cost hearts and can fail the shift', () => {
    const { shift } = mkShift(19); // inspector level → 1 heart
    expect(shift.maxHearts).toBe(1);
    const wrong = shift.current.lineup.find((s) => s !== shift.current.answer)!;
    const r = shift.submit(wrong);
    expect(r.correct).toBe(false);
    shift.takeHit('mistake', false);
    expect(shift.over).toBe(true);
    expect(shift.failReason).toBe('inspector');
  });

  it('bold calls pay more', () => {
    const { shift } = mkShift(5);
    const fee = shift.caseFee();
    const n = shift.remaining().length;
    const r = shift.submit(shift.current.answer);
    expect(r.bold).toBe(n > 1);
    expect(r.coins).toBeGreaterThanOrEqual(Math.round(fee));
  });

  it('time runs out', () => {
    const { shift } = mkShift(3);
    expect(shift.tick(shift.totalTime + 1)).toBe(true);
    expect(shift.failReason).toBe('time');
    shift.revive();
    expect(shift.over).toBe(false);
    expect(shift.timeLeft).toBeGreaterThanOrEqual(25);
  });

  it('upgrades and skills change derived stats', () => {
    const { progress } = mkShift(1, 1, (s) => {
      s.equip.ph2 = true;
      s.skills.tough = 2;
      s.perks.shower = true;
      s.xp = 100000;
    });
    expect(progress.toolTier('ph')).toBe(2);
    expect(progress.maxHearts()).toBe(6);
    expect(progress.skillPointsFree()).toBeGreaterThan(0);
  });
});
