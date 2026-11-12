import { dist } from '../../model/geometry';
import { closeness, keeperPoint, teamCtx } from '../helpers';
import { TERM_TEXT } from '../explain/templates';
import type { ScoringTerm } from '../types';

/** Closeness to the keeper's spot for this ball position (see keeperPoint). */
export const keeperArc: ScoringTerm = {
  id: 'keeperArc',
  minLevel: 1,
  evaluate(ctx, player, p) {
    return closeness(dist(p, keeperPoint(ctx, teamCtx(ctx, player))), 2);
  },
  explain: TERM_TEXT.keeperArc,
};
