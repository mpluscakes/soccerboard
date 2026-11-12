import { add } from '../../model/geometry';
import { JOB_TEXT } from '../explain/templates';
import { laneClearance, nearestFirst, teamCtx } from '../helpers';
import type { JobRule } from '../types';

/** The nearest teammate(s) to the carrier get open for a pass. */
export const supporter: JobRule = {
  id: 'supporter',
  phase: 'attack',
  minLevel: 1,
  priority: 3,
  assign(ctx, free) {
    if (!ctx.carrierId) return [];
    const carrier = ctx.byId[ctx.carrierId];
    return nearestFirst(ctx, free, carrier.pos, 'supporter')
      .slice(0, ctx.level.supporters)
      .map((p) => ({ playerId: p.id, jobId: 'supporter', refs: { carrier: carrier.id } }));
  },
  // A good first guess: 45 degrees ahead of the ball on the supporter's own side.
  anchor(ctx, player) {
    const team = teamCtx(ctx, player);
    const side = player.pos.y >= ctx.ball.y ? 1 : -1;
    const r = 0.2 * ctx.pitch.length * Math.SQRT1_2;
    return add(ctx.ball, { x: team.dir * r, y: side * r });
  },
  // Never stand where a defender is on the line of the pass.
  allow: (ctx, player, p) => laneClearance(ctx, player, p) >= 1,
  explain: JOB_TEXT.supporter,
};
