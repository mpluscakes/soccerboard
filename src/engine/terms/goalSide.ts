import { clamp, dist } from '../../model/geometry';
import { closeness, goalSidePoint, keeperZone, teamCtx, wallPoint } from '../helpers';
import { TERM_TEXT } from '../explain/templates';
import type { ScoringTerm } from '../types';

/**
 * With a mark: closeness to the point on the line from the mark to our goal
 * centre, goalSideGap metres from the mark.
 * Without one (level 1): closer to our goal than the ball by the gap, and near
 * the player's own slot in the wall between the ball and our goal.
 */
export const goalSide: ScoringTerm = {
  id: 'goalSide',
  minLevel: 1,
  evaluate(ctx, player, p) {
    const team = teamCtx(ctx, player);
    const markId = ctx.assignments[player.id]?.refs?.mark;
    const mark = markId ? ctx.byId[markId] : undefined;
    if (mark) return closeness(dist(p, goalSidePoint(ctx, team, mark.pos)), 3);
    const behind = dist(ctx.ball, team.ownGoal) - dist(p, team.ownGoal);
    const depth = clamp(behind / ctx.level.goalSideGap, 0, 1);
    // Do not drop all the way onto our own goal line: that is the keeper's spot.
    const out = clamp(dist(p, team.ownGoal) / keeperZone(ctx, team).depth, 0.5, 1);
    return depth * out * (0.4 + 0.6 * closeness(dist(p, wallPoint(ctx, player)), 3));
  },
  explain: TERM_TEXT.goalSide,
};
