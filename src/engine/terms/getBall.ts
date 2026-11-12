import { dist } from '../../model/geometry';
import { closeness } from '../helpers';
import { TERM_TEXT } from '../explain/templates';
import type { ScoringTerm } from '../types';

/** Closeness to the loose ball. */
export const getBall: ScoringTerm = {
  id: 'getBall',
  minLevel: 1,
  evaluate(ctx, _player, p) {
    return closeness(dist(p, ctx.ball), 3);
  },
  explain: TERM_TEXT.getBall,
};
