import { dist } from '../../model/geometry';
import { closeness, coverPoint, teamCtx } from '../helpers';
import { TERM_TEXT } from '../explain/templates';
import type { ScoringTerm } from '../types';

/** Closeness to a point 5 m behind and to the inside of the presser. */
export const cover: ScoringTerm = {
  id: 'cover',
  minLevel: 2,
  evaluate(ctx, player, p) {
    return closeness(dist(p, coverPoint(ctx, teamCtx(ctx, player), ctx.assignments[player.id]?.refs?.presser)), 3);
  },
  explain: TERM_TEXT.cover,
};
