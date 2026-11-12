import { JOB_TEXT } from '../explain/templates';
import type { JobRule } from '../types';

export const carrier: JobRule = {
  id: 'carrier',
  phase: 'attack',
  minLevel: 1,
  priority: 0,
  assign: (ctx, free) => free.filter((p) => p.id === ctx.carrierId).map((p) => ({ playerId: p.id, jobId: 'carrier' })),
  explain: JOB_TEXT.carrier,
};
