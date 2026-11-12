import { JOB_TEXT } from '../explain/templates';
import { nearestFirst, pressPoint, teamCtx } from '../helpers';
import type { JobRule } from '../types';

/** Nearest defender to the ball goes to it. */
export const presser: JobRule = {
  id: 'presser',
  phase: 'defend',
  minLevel: 1,
  priority: 2,
  assign: (ctx, free) =>
    nearestFirst(ctx, free, ctx.ball, 'presser')
      .slice(0, 1)
      .map((p) => ({ playerId: p.id, jobId: 'presser', refs: { mark: ctx.carrierId ?? undefined } })),
  anchor: (ctx, player) => pressPoint(ctx, teamCtx(ctx, player)),
  explain: JOB_TEXT.presser,
};
