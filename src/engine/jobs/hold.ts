import { dist } from '../../model/geometry';
import { JOB_TEXT } from '../explain/templates';
import { shapeHome, teamCtx } from '../helpers';
import type { JobRule } from '../types';

/** Loose ball: everyone who is not the chaser stays where they can help. */
export const hold: JobRule = {
  id: 'hold',
  phase: 'loose',
  minLevel: 1,
  priority: 8,
  assign: (_ctx, free) => free.map((p) => ({ playerId: p.id, jobId: 'hold' })),
  anchor: (ctx, player) => (ctx.level.id >= 2 ? shapeHome(ctx, player) : null),
  // Never end up nearer the ball than our chaser.
  allow(ctx, player, p) {
    const chaser = teamCtx(ctx, player).players.find((m) => ctx.assignments[m.id]?.jobId === 'chaser');
    if (!chaser) return true;
    return dist(p, ctx.ball) >= dist(ctx.targets[chaser.id] ?? chaser.pos, ctx.ball);
  },
  explain: JOB_TEXT.hold,
};
