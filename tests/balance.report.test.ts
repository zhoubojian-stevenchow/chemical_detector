import { it } from 'vitest';
import { defaultSave } from '../src/core/save';
import { makeRng } from '../src/core/util';
import { LEVELS } from '../src/data/levels';
import { averageGreedyTests } from '../src/game/deduction';
import { Progress } from '../src/game/progress';
import { Shift } from '../src/game/shift';

// Prints a time-budget table (run with REPORT=1). Not an assertion test.
it('balance report', () => {
  if (!(globalThis as any).process?.env?.REPORT) return;
  const data = defaultSave();
  const progress = new Progress(() => data);
  const rows: string[] = [];
  for (const l of LEVELS) {
    let tot = 0, need = 0, needSkilled = 0;
    const N = 20;
    for (let i = 0; i < N; i++) {
      const s = new Shift({ mode: 'campaign', level: l, difficulty: 0, tools: progress.toolsFor(l.id, l.mods) }, progress, makeRng(i * 13 + l.id));
      tot += s.totalTime;
      for (const c of s.cases) {
        const g = averageGreedyTests(s.toolChoices(), c.lineup);
        need += 9 + (g + 1.2) * 5.5;      // average player: one extra test, reads & decides
        needSkilled += 5 + g * 5.0;       // skilled player
      }
    }
    rows.push(`L${String(l.id).padStart(2)} cases ${l.cases.length} size ${l.size}  time ${(tot / N).toFixed(0).padStart(3)}s  avgPlayer ${(need / N).toFixed(0).padStart(3)}s  skilled ${(needSkilled / N).toFixed(0).padStart(3)}s  par(left) ${(tot / N * 0.3).toFixed(0)}s  ${(l.mods ?? []).join(',')}`);
  }
  console.log(rows.join('\n'));
});
