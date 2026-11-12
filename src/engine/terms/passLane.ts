import { laneClearance } from '../helpers';
import { TERM_TEXT } from '../explain/templates';
import type { ScoringTerm } from '../types';

/** Closest opponent distance to the ball-to-point line / 3 m, capped. */
export const passLane: ScoringTerm = {
  id: 'passLane',
  minLevel: 1,
  evaluate(ctx, player, p) {
    return Math.min(1, laneClearance(ctx, player, p) / 3);
  },
  explain: TERM_TEXT.passLane,
};
