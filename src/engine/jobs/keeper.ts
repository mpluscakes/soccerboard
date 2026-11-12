import { JOB_TEXT } from '../explain/templates';
import { keeperPoint, teamCtx } from '../helpers';
import type { JobRule } from '../types';

export const keeper: JobRule = {
  id: 'keeper',
  phase: 'any',
  minLevel: 1,
  priority: 1,
  assign: (ctx, free) =>
    free
      .filter((p) => p.role === 'GK')
      .map((p) => ({ playerId: p.id, jobId: 'keeper', refs: ctx.carrierId ? { carrier: ctx.carrierId } : undefined })),
  anchor: (ctx, player) => keeperPoint(ctx, teamCtx(ctx, player)),
  explain: (ctx, player) => (teamCtx(ctx, player).phase === 'attack' ? JOB_TEXT.keeperAttack : JOB_TEXT.keeperDefend),
};
