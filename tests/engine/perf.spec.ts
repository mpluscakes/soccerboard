import { describe, expect, it } from 'vitest';
import { computeTargets, getLevel } from '../../src/engine';
import { fixture } from './loadFixtures';

// Criterion 19 is a manual check on a phone (the app's debug overlay logs the
// time per run). This keeps an eye on the same number on the build machine.
describe('performance', () => {
  it('11v11 run stays within budget (median, warm)', () => {
    const f = fixture('08');
    const level = getLevel(2);
    const time = (coarse: boolean): number => {
      let prev = computeTargets(f.board, level, undefined, { coarse });
      for (let i = 0; i < 15; i++) prev = computeTargets(f.board, level, prev, { coarse });
      const times: number[] = [];
      for (let i = 0; i < 31; i++) {
        const t0 = performance.now();
        prev = computeTargets(f.board, level, prev, { coarse });
        times.push(performance.now() - t0);
      }
      return times.sort((a, b) => a - b)[15];
    };
    const full = time(false);
    const coarse = time(true);
    console.info(`11v11 median: ${full.toFixed(2)} ms (1 m grid), ${coarse.toFixed(2)} ms (coarse fallback)`);
    expect(coarse).toBeLessThan(full);
    expect(full).toBeLessThan(40); // generous: CI machines vary
  });
});
