import { dist } from '../../model/geometry';
import { closeness, shapeHome } from '../helpers';
import { TERM_TEXT } from '../explain/templates';
import type { ScoringTerm } from '../types';

/** Closeness to the player's formation home, shifted toward the ball. */
export const shape: ScoringTerm = {
  id: 'shape',
  minLevel: 2,
  evaluate(ctx, player, p) {
    return closeness(dist(p, shapeHome(ctx, player)), 0.1 * ctx.pitch.length);
  },
  explain: TERM_TEXT.shape,
};
