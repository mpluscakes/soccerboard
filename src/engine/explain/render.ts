import type { Assignment, EngineCtx, ExplainTemplate, PlayerInfo } from '../types';

/** What we call a player inside a sentence. */
export function nameOf(p: { label?: string; number: number }): string {
  return p.label?.trim() ? p.label.trim() : `number ${p.number}`;
}

function fill(text: string, ctx: EngineCtx, a: Assignment): string {
  const name = (id: string | undefined, fallback: string): string => (id && ctx.byId[id] ? nameOf(ctx.byId[id]) : fallback);
  return text
    .replaceAll('{carrier}', name(a.refs?.carrier ?? ctx.carrierId ?? undefined, 'your teammate'))
    .replaceAll('{mark}', name(a.refs?.mark, 'the ball'))
    .replaceAll('{presser}', name(a.refs?.presser, 'your teammate'));
}

export function renderTemplate(t: ExplainTemplate, ctx: EngineCtx, a: Assignment): ExplainTemplate {
  return { kid: fill(t.kid, ctx, a), coach: fill(t.coach, ctx, a) };
}

export function resolveExplain(
  explain: ExplainTemplate | ((ctx: EngineCtx, player: PlayerInfo) => ExplainTemplate),
  ctx: EngineCtx,
  player: PlayerInfo,
): ExplainTemplate {
  return typeof explain === 'function' ? explain(ctx, player) : explain;
}
