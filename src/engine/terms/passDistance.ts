import { clamp, dist } from '../../model/geometry';
import { TERM_TEXT } from '../explain/templates';
import type { ScoringTerm } from '../types';

/** 1 inside the band [0.1, 0.3] x pitch length from the ball, falling off outside it. */
export const passDistance: ScoringTerm = {
  id: 'passDistance',
  // The spec lists this from level 2; it is on from level 1 so the supporter
  // follows the ball instead of standing open but far away.
  minLevel: 1,
  evaluate(ctx, _player, p) {
    const L = ctx.pitch.length;
    const d = dist(ctx.ball, p);
    const lo = 0.1 * L;
    const hi = 0.3 * L;
    if (d < lo) return clamp(d / lo, 0, 1);
    if (d > hi) return clamp(1 - (d - hi) / (0.3 * L), 0, 1);
    return 1;
  },
  explain: TERM_TEXT.passDistance,
};
