import { describe, expect, it } from 'vitest';
import { defaultSave } from '../src/core/save';
import { ACHIEVEMENTS } from '../src/data/achievements';
import { LEVELS } from '../src/data/levels';
import { ICONS, TOOL_ICONS } from '../src/ui/icons';

describe('achievements', () => {
  it('have unique ids, known icons and a reward', () => {
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
    for (const a of ACHIEVEMENTS) {
      expect(ICONS[a.icon] ?? TOOL_ICONS[a.icon], `icon ${a.icon} for ${a.id}`).toBeTruthy();
      expect((a.reward.coins ?? 0) + (a.reward.skill ?? 0)).toBeGreaterThan(0);
    }
  });

  it('start locked on a fresh save', () => {
    const d = defaultSave();
    for (const a of ACHIEVEMENTS) {
      const [cur, goal] = a.progress(d, 0, 0);
      expect(goal).toBeGreaterThan(0);
      expect(cur, a.id).toBeLessThan(goal);
    }
  });

  it('star goals are reachable', () => {
    const maxStars = LEVELS.length * 3;
    for (const a of ACHIEVEMENTS.filter((x) => x.id.startsWith('stars'))) {
      expect(a.progress(defaultSave(), maxStars, 0)[0]).toBeGreaterThanOrEqual(a.progress(defaultSave(), maxStars, 0)[1]);
    }
  });
});
