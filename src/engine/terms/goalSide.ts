import { clamp, dist, distToSegment } from '../../model/geometry';
import { closeness, goalSidePoint, keeperZone, teamCtx } from '../helpers';
import { TERM_TEXT } from '../explain/templates';
import type { ScoringTerm } from '../types';

/**
 * With a mark: closeness to the point on the line from the mark to our goal
 * centre, goalSideGap metres from the mark.
 * Without one (level 1): how well the point is between the ball and our goal:
 * closer to our goal than the ball by the gap, and near the ball-to-goal line.
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
    const lane = closeness(distToSegment(p, ctx.ball, team.ownGoal), 0.25 * ctx.pitch.width);
    // Do not drop all the way onto our own goal line: that is the keeper's spot.
    const out = clamp(dist(p, team.ownGoal) / keeperZone(ctx, team).depth, 0.5, 1);
    return depth * out * (0.75 + 0.25 * lane);
  },
  explain: TERM_TEXT.goalSide,
};
