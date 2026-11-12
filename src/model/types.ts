// Shared data model. The engine and the UI both read these types; nothing here
// imports from React, the DOM or the engine.

// ---- geometry ----
export type Vec2 = { x: number; y: number }; // metres, origin at centre spot
export type Rect = { x: number; y: number; w: number; h: number };

// ---- static setup ----
export type PitchPreset = '4v4' | '5v5' | '7v7' | '9v9' | '11v11' | 'custom';
export interface PitchSpec {
  preset: PitchPreset;
  length: number;
  width: number;
  goalWidth: number;
  /**
   * Keeper area in front of the goal at the -x end (x = -length/2 is its goal
   * line). The other end is its mirror image. null = no keeper area.
   */
  keeperArea: Rect | null;
  offside: boolean; // only matters at L3
}
export type TeamId = 'A' | 'B';
export interface Team {
  id: TeamId;
  name: string;
  color: string;
  attacksDir: 1 | -1;
}
export type Role = 'GK' | 'DEF' | 'MID' | 'FWD';
export interface Player {
  id: string;
  teamId: TeamId;
  number: number;
  label?: string;
  role: Role;
  /**
   * Formation slot, normalised -1..1 in the team's own half-frame:
   * x = -1 is the own goal line, x = +1 the halfway line; y = -1..1 across.
   */
  home: Vec2;
}
export interface Setup {
  pitch: PitchSpec;
  teams: [Team, Team];
  players: Player[];
  formationIds: Record<TeamId, string>;
  activeArea?: Rect; // confines tokens + targets (small scenarios)
}

// ---- moving parts ----
export interface PlayerState {
  pos: Vec2;
  pinned: boolean;
}
export type Ball =
  /** dir = unit vector the carrier last moved in; the ball sits 0.7 m that way. */
  | { kind: 'held'; carrierId: string; dir?: Vec2 }
  | { kind: 'loose'; pos: Vec2 }
  /** toId is set for a pass: the ball homes in on that player. */
  | { kind: 'travelling'; from: Vec2; to: Vec2; t0: number; toId?: string };
export interface Snapshot {
  players: Record<string, PlayerState>;
  ball: Ball;
}

// ---- view + session (not part of saved scenarios) ----
export type LevelId = 1 | 2 | 3;
export type Perspective = 'attack' | 'defend' | 'both';
export interface ViewState {
  viewport: Rect;
  youId: string | null;
  levelId: LevelId;
  perspective: Perspective;
  autoMove: boolean;
  paused: boolean;
  textMode: 'kid' | 'coach';
  /** Visual glide speed in m/s (2..10). */
  glideSpeed: number;
  /** Draw X and O glyphs instead of numbers. */
  glyphs: boolean;
}
export interface BoardState {
  schemaVersion: 1;
  setup: Setup;
  snapshot: Snapshot;
  view: ViewState;
}

// ---- every change is an Action ----
export type Action =
  | { type: 'MOVE_PLAYER'; id: string; to: Vec2 }
  /** snap=false keeps the ball loose while it is being dragged past players. */
  | { type: 'MOVE_BALL'; to: Vec2; snap?: boolean }
  | { type: 'PASS'; fromId: string; toId: string; t0?: number }
  | { type: 'KICK'; to: Vec2; t0?: number }
  | { type: 'BALL_ARRIVE' }
  | { type: 'PIN' | 'UNPIN'; id: string }
  | { type: 'SET_YOU'; id: string | null }
  | { type: 'SET_ROLE'; id: string; role: Role }
  | { type: 'SET_LABEL'; id: string; label: string }
  | { type: 'SET_ACTIVE_AREA'; area: Rect | null }
  | { type: 'SET_VIEW'; patch: Partial<ViewState> }
  | { type: 'NEW_BOARD'; setup: Setup }
  | { type: 'APPLY_TARGETS'; targets: Record<string, Vec2> } // engine result committed
  | { type: 'LOAD_SNAPSHOT'; snapshot: Snapshot };

// ---- later phases (typed now, unused in v1) ----
export type JobId = string; // 'presser', 'supporter', ... (registered, not hard-wired)
export type TermId = string; // 'passLane', 'goalSide', ...

export interface Scenario {
  id: string;
  title: string;
  description?: string;
  setup: Setup;
  start: Snapshot;
  levelId: LevelId;
  perspective: Perspective;
  youId?: string;
}
export interface Step {
  id: string;
  snapshot?: Snapshot; // absolute position for this step, or
  actions?: Action[]; // actions replayed from the previous step
  engine: 'auto' | 'scripted'; // auto = engine moves everyone; scripted = positions as authored
  narration: { kid: string; coach?: string };
  highlights?: { playerIds?: string[]; zones?: Rect[]; arrows?: { from: Vec2; to: Vec2 }[] };
}
export interface Play {
  id: string;
  title: string;
  scenarioId: string;
  side: 'attack' | 'defend';
  steps: Step[];
  strategyId?: string; // optional engine weight overrides
}
export interface Strategy {
  id: string;
  name: string;
  weightOverrides: Partial<Record<JobId, Partial<Record<TermId, number>>>>;
  extraJobs?: JobId[]; // e.g. 'overlap', 'thirdMan'
}
