import { dist } from '../../model/geometry';
import { closeness, pressPoint, teamCtx } from '../helpers';
import { TERM_TEXT } from '../explain/templates';
import type { ScoringTerm } from '../types';

/** Closeness to a point 1.5 m from the carrier on our goal side. */
export const pressBall: ScoringTerm = {
  id: 'pressBall',
  minLevel: 1,
  evaluate(ctx, player, p) {
    return closeness(dist(p, pressPoint(ctx, teamCtx(ctx, player))), 3);
  },
  explain: TERM_TEXT.pressBall,
};
