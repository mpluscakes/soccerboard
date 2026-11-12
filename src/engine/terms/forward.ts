import { clamp, dist } from '../../model/geometry';
import { keeperZone, teamCtx } from '../helpers';
import { TERM_TEXT } from '../explain/templates';
import type { EngineCtx, ScoringTerm, TeamCtx } from '../types';

/** Distance from the opponent goal at which "forward" stops paying (no camping on the goal line). */
export function forwardStop(ctx: EngineCtx, team: TeamCtx): number {
  const opp = ctx.teams[team.team.id === 'A' ? 'B' : 'A'];
  return Math.max(keeperZone(ctx, opp).depth, 0.15 * ctx.pitch.length);
}

/** Progress toward the opponent goal. */
export const forward: ScoringTerm = {
  id: 'forward',
  minLevel: 1,
  evaluate(ctx, player, p) {
    const team = teamCtx(ctx, player);
    const d = Math.max(0, dist(p, team.oppGoal) - forwardStop(ctx, team));
    return clamp(1 - d / ctx.pitch.length, 0, 1);
  },
  explain: TERM_TEXT.forward,
};
