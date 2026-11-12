import { closeness } from '../helpers';
import { TERM_TEXT } from '../explain/templates';
import type { ScoringTerm } from '../types';

/** Closeness to the flank channel (outer 20% of the width) on the player's side. */
export const width: ScoringTerm = {
  id: 'width',
  minLevel: 2,
  evaluate(ctx, player, p) {
    const side = ctx.assignments[player.id]?.refs?.side ?? (player.pos.y >= 0 ? 1 : -1);
    const inner = 0.3 * ctx.pitch.width; // channel runs from 0.3 W to the side line
    const gap = Math.max(0, inner - side * p.y);
    return closeness(gap, 0.1 * ctx.pitch.width);
  },
  explain: TERM_TEXT.width,
};
