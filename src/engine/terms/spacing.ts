import { matePositions } from '../helpers';
import { TERM_TEXT } from '../explain/templates';
import type { ScoringTerm } from '../types';

/** Nearest teammate distance / spaceDist, capped at 1. */
export const spacing: ScoringTerm = {
  id: 'spacing',
  minLevel: 1,
  evaluate(ctx, player, p) {
    let nearest2 = Infinity;
    for (const m of matePositions(ctx, player)) {
      const dx = m.x - p.x;
      const dy = m.y - p.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < nearest2) nearest2 = d2;
    }
    return nearest2 === Infinity ? 1 : Math.min(1, Math.sqrt(nearest2) / ctx.spaceDist);
  },
  explain: TERM_TEXT.spacing,
};
