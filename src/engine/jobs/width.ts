import { JOB_TEXT } from '../explain/templates';
import { byId, teamCtx } from '../helpers';
import type { Assignment, JobRule } from '../types';

/** One player per flank keeps the team wide. */
export const width: JobRule = {
  id: 'width',
  phase: 'attack',
  minLevel: 2,
  priority: 5,
  assign(ctx, free) {
    const out: Assignment[] = [];
    const pool = [...free];
    for (const side of [1, -1] as const) {
      if (pool.length === 0) break;
      const flankY = side * 0.4 * ctx.pitch.width;
      const d = (p: (typeof pool)[number]): number => {
        const was = ctx.prev?.[p.id];
        const same = was?.jobId === 'width' && was.refs?.side === side;
        return Math.abs(p.pos.y - flankY) - (same ? 0.08 * ctx.pitch.length : 0);
      };
      pool.sort((a, b) => d(a) - d(b) || byId(a, b));
      const p = pool.shift()!;
      out.push({ playerId: p.id, jobId: 'width', refs: { side, carrier: ctx.carrierId ?? undefined } });
    }
    return out;
  },
  anchor(ctx, player) {
    const team = teamCtx(ctx, player);
    const side = ctx.assignments[player.id]?.refs?.side ?? 1;
    return { x: ctx.ball.x + team.dir * 0.1 * ctx.pitch.length, y: side * 0.4 * ctx.pitch.width };
  },
  explain: JOB_TEXT.width,
};
