import { sub } from '../../model/geometry';
import { laneClearance, teamCtx } from '../helpers';
import { TERM_TEXT } from '../explain/templates';
import type { ScoringTerm } from '../types';

/**
 * 1 when the point is 30 to 60 degrees off the carrier's forward line (a
 * triangle), 0 when flat or hidden behind a defender.
 */
export const supportAngle: ScoringTerm = {
  id: 'supportAngle',
  minLevel: 2,
  evaluate(ctx, player, p) {
    const d = sub(p, ctx.ball);
    const l = Math.hypot(d.x, d.y);
    if (l < 0.5) return 0;
    if (laneClearance(ctx, player, p) < 1) return 0; // hidden behind a defender
    const forward = teamCtx(ctx, player).dir;
    let deg = (Math.acos(Math.max(-1, Math.min(1, (d.x * forward) / l))) * 180) / Math.PI;
    // Support behind the ball makes a triangle too, but is worth a bit less.
    let k = 1;
    if (deg > 90) {
      deg = 180 - deg;
      k = 0.6;
    }
    if (deg >= 30 && deg <= 60) return k;
    return k * (deg < 30 ? deg / 30 : (90 - deg) / 30);
  },
  explain: TERM_TEXT.supportAngle,
};
