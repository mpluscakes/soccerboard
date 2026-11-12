import type { BoardState, JobId, PitchSpec, Player, Rect, Setup, Team, TeamId, TermId, Vec2 } from '../model/types';

export type { JobId, TermId };
export type PlayerId = string;
export type Phase = 'attack' | 'defend' | 'loose';

export interface ExplainTemplate {
  kid: string;
  coach: string;
} // {carrier}, {mark}, {presser} placeholders

/** Weights and knobs for one difficulty level (shipped as JSON in levels/). */
export interface LevelConfig {
  id: number;
  name: string;
  /** Score lost per metre a player would have to move. */
  moveCost: number;
  /** A new target must beat last tick's by more than this. */
  hysteresis: number;
  /** How many supporters the team on the ball gets. */
  supporters: number;
  /** Metres between a marker and the player (or ball) they are goal-side of. */
  goalSideGap: number;
  /** false: markers stay goal-side of the ball. true: matched 1-to-1 to attackers. */
  markOneToOne: boolean;
  /** spaceDist = spaceDistFactor x pitch width. */
  spaceDistFactor: number;
  weights: Record<JobId, Record<TermId, number>>;
}

export interface PlayerInfo extends Player {
  pos: Vec2;
  pinned: boolean;
  /** The engine will not move this player (pinned or on the ball). */
  fixed: boolean;
}

export interface TeamCtx {
  team: Team;
  phase: Phase;
  dir: 1 | -1;
  ownGoal: Vec2;
  oppGoal: Vec2;
  keeperArea: Rect | null;
  players: PlayerInfo[];
  opponents: PlayerInfo[];
}

export interface Assignment {
  playerId: PlayerId;
  jobId: JobId;
  /** Other players this job refers to; used for anchors and {placeholders}. */
  refs?: { carrier?: PlayerId; mark?: PlayerId; presser?: PlayerId; side?: 1 | -1 };
}

export interface EngineCtx {
  board: BoardState;
  setup: Setup;
  pitch: PitchSpec;
  level: LevelConfig;
  /** Where targets may go: pitch or active area, shrunk by the 0.5 m margin. */
  bounds: Rect;
  ball: Vec2;
  /** Player on the ball (or about to receive a pass), if any. */
  carrierId: PlayerId | null;
  spaceDist: number;
  players: PlayerInfo[];
  byId: Record<PlayerId, PlayerInfo>;
  teams: Record<TeamId, TeamCtx>;
  /** The team a JobRule.assign call is handing jobs to. */
  team: TeamCtx;
  assignments: Record<PlayerId, Assignment>;
  /** Targets already decided this tick (fixed players first, then by job priority). */
  targets: Record<PlayerId, Vec2>;
  /** How many movable players have had their target decided so far this tick. */
  decided: number;
  /** Last tick's reasons, so jobs do not swap between players on a whim. */
  prev: Record<PlayerId, Reason> | null;
  /** Scratch cache for anchor points; cleared whenever targets change. */
  memo: Map<string, Vec2>;
}

export interface JobRule {
  id: JobId; // 'presser', 'supporter', ...
  phase: Phase | 'any';
  minLevel: number;
  priority: number; // lower assigns first
  assign(ctx: EngineCtx, free: PlayerInfo[]): Assignment[]; // who gets this job
  anchor?(ctx: EngineCtx, player: PlayerInfo): Vec2 | null; // optional extra candidate
  /** Optional hard rule a candidate must pass (dropped if nothing passes). */
  allow?(ctx: EngineCtx, player: PlayerInfo, p: Vec2): boolean;
  explain: ExplainTemplate | ((ctx: EngineCtx, player: PlayerInfo) => ExplainTemplate); // kid + coach text
}

export interface ScoringTerm {
  id: TermId; // 'passLane', 'goalSide', ...
  minLevel: number;
  evaluate(ctx: EngineCtx, player: PlayerInfo, p: Vec2): number; // 0..1
  explain: ExplainTemplate;
}

export interface Reason {
  jobId: JobId;
  topTermId: TermId | null;
  kid: string; // rendered job sentence, names filled in
  coach: string; // e.g. "Second defender: cover depth"
  /** Detail line of the term that contributed most at the chosen point ('' if none). */
  kidDetail: string;
  coachDetail: string;
  breakdown: { termId: TermId; contribution: number }[]; // for a debug overlay
  /** Who the job referred to (carrier, mark, presser, flank side). */
  refs?: Assignment['refs'];
}

export interface EngineResult {
  targets: Record<PlayerId, Vec2>;
  reasons: Record<PlayerId, Reason>;
}

export interface EngineOptions {
  /** Over-budget fallback: 2 m grid, then refine around the best point at 0.5 m. */
  coarse?: boolean;
}
