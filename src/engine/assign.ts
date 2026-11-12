import { byId } from './helpers';
import { jobRules } from './registry';
import type { EngineCtx } from './types';

/**
 * Hand out jobs in priority order. Each rule sees the players of one team
 * that are still free; whoever is left at the end keeps the catch-all job.
 */
export function assignJobs(ctx: EngineCtx): void {
  for (const rule of jobRules()) {
    if (rule.minLevel > ctx.level.id) continue;
    for (const teamId of ['A', 'B'] as const) {
      const team = ctx.teams[teamId];
      if (rule.phase !== 'any' && rule.phase !== team.phase) continue;
      const free = team.players.filter((p) => !ctx.assignments[p.id]).sort(byId);
      if (free.length === 0) continue;
      ctx.team = team;
      for (const a of rule.assign(ctx, free)) {
        if (!ctx.assignments[a.playerId] && ctx.byId[a.playerId]?.teamId === teamId) ctx.assignments[a.playerId] = a;
      }
    }
  }
  for (const p of ctx.players) {
    if (!ctx.assignments[p.id]) ctx.assignments[p.id] = { playerId: p.id, jobId: 'shape' };
  }
}
