import { ballPos, boundsOf, dist, inRect, keeperAreaFor, oppGoal, ownGoal, roundVec, teamOf } from '../model/geometry';
import type { BoardState, TeamId, Vec2 } from '../model/types';
import { assignJobs } from './assign';
import { clip, gridCandidates, searchRadius, shrink } from './candidates';
import { renderTemplate, resolveExplain } from './explain/render';
import { byId } from './helpers';
import { effectiveCarrier, phaseOf } from './phase';
import { getJob, getTerm } from './registry';
import type {
  Assignment,
  EngineCtx,
  EngineOptions,
  EngineResult,
  JobRule,
  LevelConfig,
  PlayerInfo,
  Reason,
  ScoringTerm,
  TeamCtx,
} from './types';

const MARGIN = 0.5; // metres kept clear of the pitch / active-area edge
const EPS = 1e-9;

export function buildCtx(board: BoardState, level: LevelConfig, prev?: EngineResult): EngineCtx {
  const { setup, snapshot } = board;
  const carrierId = effectiveCarrier(snapshot);
  const players: PlayerInfo[] = setup.players
    .filter((p) => snapshot.players[p.id])
    .map((p) => {
      const s = snapshot.players[p.id];
      return { ...p, pos: s.pos, pinned: s.pinned, fixed: s.pinned || p.id === carrierId };
    })
    .sort(byId);
  const byIdMap: Record<string, PlayerInfo> = {};
  for (const p of players) byIdMap[p.id] = p;

  const makeTeam = (id: TeamId): TeamCtx => {
    const team = teamOf(setup, id);
    return {
      team,
      phase: phaseOf(setup, snapshot, id),
      dir: team.attacksDir,
      ownGoal: ownGoal(setup.pitch, team),
      oppGoal: oppGoal(setup.pitch, team),
      keeperArea: keeperAreaFor(setup.pitch, team),
      players: players.filter((p) => p.teamId === id),
      opponents: players.filter((p) => p.teamId !== id),
    };
  };
  const teams = { A: makeTeam('A'), B: makeTeam('B') };
  return {
    board,
    setup,
    pitch: setup.pitch,
    level,
    bounds: shrink(boundsOf(setup), MARGIN),
    ball: carrierId && snapshot.ball.kind === 'travelling' ? byIdMap[carrierId].pos : ballPos(snapshot),
    carrierId,
    spaceDist: level.spaceDistFactor * setup.pitch.width,
    players,
    byId: byIdMap,
    teams,
    team: teams.A,
    assignments: {},
    targets: {},
    decided: 0,
    prev: prev?.reasons ?? null,
    memo: new Map(),
  };
}

interface ActiveTerm {
  term: ScoringTerm;
  weight: number;
}

function activeTerms(level: LevelConfig, jobId: string): ActiveTerm[] {
  const weights = level.weights[jobId] ?? {};
  const out: ActiveTerm[] = [];
  for (const id of Object.keys(weights).sort()) {
    const term = getTerm(id);
    const weight = weights[id];
    if (!term || !weight || term.minLevel > level.id) continue;
    out.push({ term, weight });
  }
  return out;
}

function scoreAt(ctx: EngineCtx, player: PlayerInfo, terms: ActiveTerm[], p: Vec2): number {
  let s = -ctx.level.moveCost * dist(player.pos, p);
  for (const { term, weight } of terms) s += weight * term.evaluate(ctx, player, p);
  return s;
}

/** Hard spacing rule: teammates' targets stay spaceDist / 2 apart (presser and cover: 3 m). */
function minSeparation(ctx: EngineCtx, a: Assignment, b: Assignment | undefined): number {
  const half = ctx.spaceDist / 2;
  const pair = (a.jobId === 'presser' && b?.jobId === 'cover') || (a.jobId === 'cover' && b?.jobId === 'presser');
  return pair ? Math.min(3, half) : half;
}

/** Teammates' already-decided targets and how far to stay from each. */
function keepOuts(ctx: EngineCtx, player: PlayerInfo, a: Assignment): { t: Vec2; min2: number }[] {
  const out: { t: Vec2; min2: number }[] = [];
  for (const mate of ctx.teams[player.teamId].players) {
    const t = ctx.targets[mate.id];
    if (mate.id === player.id || !t) continue;
    const min = minSeparation(ctx, a, ctx.assignments[mate.id]) - EPS;
    out.push({ t, min2: min * min });
  }
  return out;
}

interface Pick {
  p: Vec2;
  score: number;
}

function better(player: PlayerInfo, a: Pick, b: Pick | null): boolean {
  if (!b) return true;
  if (Math.abs(a.score - b.score) > EPS) return a.score > b.score;
  const da = dist(player.pos, a.p);
  const db = dist(player.pos, b.p);
  if (Math.abs(da - db) > EPS) return da < db;
  return a.p.x !== b.p.x ? a.p.x < b.p.x : a.p.y < b.p.y;
}

function pickTarget(
  ctx: EngineCtx,
  player: PlayerInfo,
  a: Assignment,
  job: JobRule | undefined,
  terms: ActiveTerm[],
  prev: Vec2 | undefined,
  coarse: boolean,
): Vec2 {
  const radius = searchRadius(ctx.pitch.length);
  const here = clip(player.pos, ctx.bounds);
  const extras: Vec2[] = [here];
  const anchor = job?.anchor?.(ctx, player);
  if (anchor) extras.push(clip(anchor, ctx.bounds));
  const prevOk = prev && inRect(prev, ctx.bounds, 1e-6) ? prev : undefined;
  if (prevOk) extras.push(prevOk);

  const allowed = (p: Vec2): boolean => !job?.allow || job.allow(ctx, player, p);
  const outs = keepOuts(ctx, player, a);
  const spaced = (p: Vec2): boolean => {
    for (const o of outs) {
      const dx = o.t.x - p.x;
      const dy = o.t.y - p.y;
      if (dx * dx + dy * dy < o.min2) return false;
    }
    return true;
  };
  // Preference order: passes the job's rule and spacing; spacing only; anything.
  const tiers: ((p: Vec2) => boolean)[] = [(p) => spaced(p) && allowed(p), spaced, () => true];

  const search = (points: Vec2[], ok: (p: Vec2) => boolean): Pick | null => {
    let best: Pick | null = null;
    for (const p of points) {
      if (!ok(p)) continue;
      const score = scoreAt(ctx, player, terms, p);
      if (best && score < best.score - EPS) continue;
      const cand = { p, score };
      if (better(player, cand, best)) best = cand;
    }
    return best;
  };

  for (const ok of tiers) {
    let best: Pick | null;
    if (coarse) {
      best = search([...gridCandidates(player.pos, radius, 2, ctx.bounds), ...extras], ok);
      if (best) {
        const fine = search(gridCandidates(best.p, 1.01, 0.5, ctx.bounds), ok);
        if (fine && better(player, fine, best)) best = fine;
      }
    } else {
      best = search([...gridCandidates(player.pos, radius, 1, ctx.bounds), ...extras], ok);
    }
    if (!best) continue;
    // Hysteresis: keep last tick's target unless the new best clearly beats it.
    if (prevOk && ok(prevOk)) {
      const prevScore = scoreAt(ctx, player, terms, prevOk);
      if (best.score - prevScore <= ctx.level.hysteresis) return prevOk;
    }
    return best.p;
  }
  return here;
}

function explain(ctx: EngineCtx, player: PlayerInfo, a: Assignment, job: JobRule | undefined, terms: ActiveTerm[], at: Vec2): Reason {
  const breakdown = terms
    .map(({ term, weight }) => ({ termId: term.id, contribution: Math.round(weight * term.evaluate(ctx, player, at) * 1e4) / 1e4 }))
    .sort((x, y) => y.contribution - x.contribution || (x.termId < y.termId ? -1 : 1));
  const top = breakdown.length && breakdown[0].contribution > 0 ? getTerm(breakdown[0].termId) : undefined;
  const jobText = job ? renderTemplate(resolveExplain(job.explain, ctx, player), ctx, a) : { kid: 'Stay where you can help.', coach: 'Hold position.' };
  const detail = top ? renderTemplate(top.explain, ctx, a) : { kid: '', coach: '' };
  return {
    jobId: a.jobId,
    topTermId: top?.id ?? null,
    kid: jobText.kid,
    coach: jobText.coach,
    kidDetail: detail.kid,
    coachDetail: detail.coach,
    breakdown,
    ...(a.refs ? { refs: a.refs } : {}),
  };
}

/**
 * The movement engine. Pure: same board in, same targets and reasons out.
 * Gives every player a job, then picks the best spot for that job by scoring
 * nearby points.
 */
export function computeTargets(board: BoardState, level: LevelConfig, prev?: EngineResult, opts: EngineOptions = {}): EngineResult {
  const ctx = buildCtx(board, level, prev);
  assignJobs(ctx);

  const priorityOf = (p: PlayerInfo): number => getJob(ctx.assignments[p.id].jobId)?.priority ?? 99;
  // Fixed players (pinned, on the ball) keep their position; everyone else is
  // decided in job-priority order so later jobs can space themselves off earlier ones.
  for (const p of ctx.players) if (p.fixed) ctx.targets[p.id] = p.pos;
  const movable = ctx.players.filter((p) => !p.fixed).sort((a, b) => priorityOf(a) - priorityOf(b) || byId(a, b));

  const termsFor: Record<string, ActiveTerm[]> = {};
  const termsOf = (jobId: string): ActiveTerm[] => (termsFor[jobId] ??= activeTerms(level, jobId));

  for (const p of movable) {
    const a = ctx.assignments[p.id];
    const target = pickTarget(ctx, p, a, getJob(a.jobId), termsOf(a.jobId), prev?.targets[p.id], !!opts.coarse);
    ctx.targets[p.id] = roundVec(target);
    ctx.memo.clear(); // anchors may depend on targets
    ctx.decided++;
  }

  const result: EngineResult = { targets: {}, reasons: {} };
  for (const p of ctx.players) {
    const a = ctx.assignments[p.id];
    result.targets[p.id] = ctx.targets[p.id];
    result.reasons[p.id] = explain(ctx, p, a, getJob(a.jobId), termsOf(a.jobId), ctx.targets[p.id]);
  }
  return result;
}
