import { JOB_TEXT } from '../explain/templates';
import { nearestFirst } from '../helpers';
import type { JobRule } from '../types';

/** Loose ball: the nearest player on each team goes for it. */
export const chaser: JobRule = {
  id: 'chaser',
  phase: 'loose',
  minLevel: 1,
  priority: 2,
  assign: (ctx, free) =>
    nearestFirst(ctx, free, ctx.ball, 'chaser')
      .slice(0, 1)
      .map((p) => ({ playerId: p.id, jobId: 'chaser' })),
  anchor: (ctx) => ctx.ball,
  explain: JOB_TEXT.chaser,
};
