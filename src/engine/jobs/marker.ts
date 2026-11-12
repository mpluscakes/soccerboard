import { add, dist, norm, scale, sub } from '../../model/geometry';
import { JOB_TEXT } from '../explain/templates';
import { byId, goalSidePoint, teamCtx } from '../helpers';
import type { Assignment, JobRule, PlayerInfo } from '../types';

/**
 * Level 1: every other defender gets between the ball and our goal.
 * Level 2+: defenders are matched 1-to-1 to the nearest free attacker.
 */
export const marker: JobRule = {
  id: 'marker',
  phase: 'defend',
  minLevel: 1,
  priority: 4,
  assign(ctx, free) {
    if (!ctx.level.markOneToOne) return free.map((p) => ({ playerId: p.id, jobId: 'marker' }));
    // Only attackers level with or ahead of the ball need a marker; the ones
    // well behind it are no danger yet, and their would-be markers keep shape.
    const att = ctx.team.dir === 1 ? -1 : 1;
    const line = ctx.ball.x * att - 0.1 * ctx.pitch.length;
    const attackers = ctx.team.opponents.filter((o) => o.id !== ctx.carrierId && o.role !== 'GK' && o.pos.x * att >= line);
    const sticky = (d: PlayerInfo, a: PlayerInfo): number => {
      const was = ctx.prev?.[d.id];
      return was?.jobId === 'marker' && was.refs?.mark === a.id ? 0.08 * ctx.pitch.length : 0;
    };
    const pairs = free.flatMap((d) => attackers.map((a) => ({ d, a, dist: dist(d.pos, a.pos) - sticky(d, a) })));
    pairs.sort((p, q) => p.dist - q.dist || byId(p.d, q.d) || byId(p.a, q.a));
    const usedD = new Set<string>();
    const usedA = new Set<string>();
    const out: Assignment[] = [];
    for (const { d, a } of pairs) {
      if (usedD.has(d.id) || usedA.has(a.id)) continue;
      usedD.add(d.id);
      usedA.add(a.id);
      out.push({ playerId: d.id, jobId: 'marker', refs: { mark: a.id } });
    }
    return out;
  },
  anchor(ctx, player) {
    const team = teamCtx(ctx, player);
    const markId = ctx.assignments[player.id]?.refs?.mark;
    if (markId) return goalSidePoint(ctx, team, ctx.byId[markId].pos);
    // No mark: drop straight back until we are goal-side of the ball.
    const want = Math.max(0, dist(ctx.ball, team.ownGoal) - ctx.level.goalSideGap);
    if (dist(player.pos, team.ownGoal) <= want) return null;
    return add(team.ownGoal, scale(norm(sub(player.pos, team.ownGoal), { x: team.dir, y: 0 }), want));
  },
  allow(ctx, player, p) {
    if (ctx.assignments[player.id]?.refs?.mark) return true;
    const team = teamCtx(ctx, player);
    return dist(p, team.ownGoal) < dist(ctx.ball, team.ownGoal);
  },
  explain: JOB_TEXT.marker,
};
