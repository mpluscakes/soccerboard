import { dist } from '../../model/geometry';
import { JOB_TEXT } from '../explain/templates';
import { coverPoint, nearestFirst, pressPoint, teamCtx } from '../helpers';
import type { EngineCtx, JobRule, PlayerInfo } from '../types';

const presserOf = (ctx: EngineCtx, player: PlayerInfo): string | undefined => ctx.assignments[player.id]?.refs?.presser;

/** Second nearest defender backs up the presser. */
export const cover: JobRule = {
  id: 'cover',
  phase: 'defend',
  minLevel: 2,
  priority: 3,
  assign(ctx, free) {
    const presser = ctx.team.players.find((p) => ctx.assignments[p.id]?.jobId === 'presser');
    if (!presser) return [];
    return nearestFirst(ctx, free, ctx.ball, 'cover')
      .slice(0, 1)
      .map((p) => ({ playerId: p.id, jobId: 'cover', refs: { presser: presser.id } }));
  },
  anchor: (ctx, player) => coverPoint(ctx, teamCtx(ctx, player), presserOf(ctx, player)),
  // 3 to 7 m from the presser, on the goal side.
  allow(ctx, player, p) {
    const team = teamCtx(ctx, player);
    const id = presserOf(ctx, player);
    const press = (id && ctx.targets[id]) || pressPoint(ctx, team);
    const d = dist(p, press);
    return d >= 3 && d <= 7 && dist(p, team.ownGoal) < dist(press, team.ownGoal);
  },
  explain: JOB_TEXT.cover,
};
