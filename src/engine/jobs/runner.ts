import { add, dist, norm, scale, sub } from '../../model/geometry';
import { JOB_TEXT } from '../explain/templates';
import { byId, jobDistance, teamCtx } from '../helpers';
import { forwardStop } from '../terms/forward';
import type { JobRule } from '../types';

/** The furthest-forward teammate runs toward their goal. */
export const runner: JobRule = {
  id: 'runner',
  phase: 'attack',
  minLevel: 1,
  priority: 4,
  assign(ctx, free) {
    const dir = ctx.team.dir;
    const depth = (p: (typeof free)[number]): number => -jobDistance(ctx, p, 'runner', -p.pos.x * dir);
    return [...free]
      .sort((a, b) => depth(b) - depth(a) || byId(a, b))
      .slice(0, 1)
      .map((p) => ({ playerId: p.id, jobId: 'runner', refs: { carrier: ctx.carrierId ?? undefined } }));
  },
  // Straight toward their goal, stopping at the edge of the keeper's area.
  anchor(ctx, player) {
    const team = teamCtx(ctx, player);
    const stop = forwardStop(ctx, team) + 0.5;
    if (dist(player.pos, team.oppGoal) <= stop) return null;
    return add(team.oppGoal, scale(norm(sub(player.pos, team.oppGoal), { x: -team.dir, y: 0 }), stop));
  },
  explain: JOB_TEXT.runner,
};
