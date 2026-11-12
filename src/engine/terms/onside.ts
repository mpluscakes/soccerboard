import { teamCtx } from '../helpers';
import { TERM_TEXT } from '../explain/templates';
import type { ScoringTerm } from '../types';

/** L3 only, offside on: 1 if not beyond the second-last defender (or the ball, or halfway). */
export const onside: ScoringTerm = {
  id: 'onside',
  minLevel: 3,
  evaluate(ctx, player, p) {
    if (!ctx.pitch.offside) return 1;
    const team = teamCtx(ctx, player);
    const depths = team.opponents.map((o) => o.pos.x * team.dir).sort((a, b) => b - a);
    const secondLast = depths.length >= 2 ? depths[1] : (ctx.pitch.length / 2);
    const line = Math.max(secondLast, ctx.ball.x * team.dir, 0);
    return p.x * team.dir <= line + 1e-9 ? 1 : 0;
  },
  explain: TERM_TEXT.onside,
};
