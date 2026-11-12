import { JOB_TEXT } from '../explain/templates';
import { shapeHome, teamCtx } from '../helpers';
import type { JobRule } from '../types';

/** Everyone without a more specific job keeps the team's shape. */
export const shape: JobRule = {
  id: 'shape',
  phase: 'any',
  minLevel: 1,
  priority: 9,
  assign: (_ctx, free) => free.map((p) => ({ playerId: p.id, jobId: 'shape' })),
  anchor: (ctx, player) => (ctx.level.id >= 2 ? shapeHome(ctx, player) : null),
  explain: (ctx, player) => (teamCtx(ctx, player).phase === 'defend' ? JOB_TEXT.shapeDefend : JOB_TEXT.shapeAttack),
};
