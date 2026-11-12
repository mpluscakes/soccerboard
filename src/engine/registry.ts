import { carrier } from './jobs/carrier';
import { chaser } from './jobs/chaser';
import { cover as coverJob } from './jobs/cover';
import { hold } from './jobs/hold';
import { keeper } from './jobs/keeper';
import { marker } from './jobs/marker';
import { presser } from './jobs/presser';
import { runner } from './jobs/runner';
import { shape as shapeJob } from './jobs/shape';
import { supporter } from './jobs/supporter';
import { width as widthJob } from './jobs/width';
import { cover } from './terms/cover';
import { forward } from './terms/forward';
import { getBall } from './terms/getBall';
import { goalSide } from './terms/goalSide';
import { keeperArc } from './terms/keeperArc';
import { onside } from './terms/onside';
import { passDistance } from './terms/passDistance';
import { passLane } from './terms/passLane';
import { pressBall } from './terms/pressBall';
import { shape } from './terms/shape';
import { spacing } from './terms/spacing';
import { supportAngle } from './terms/supportAngle';
import { width } from './terms/width';
import type { JobRule, ScoringTerm } from './types';

// Jobs and terms are registered, not hard-wired: new principles (and later
// strategy-specific behaviour) plug in here without touching the pipeline.
const jobs: JobRule[] = [];
const terms = new Map<string, ScoringTerm>();

export function registerJob(rule: JobRule): void {
  jobs.push(rule);
  jobs.sort((a, b) => a.priority - b.priority || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
export function registerTerm(term: ScoringTerm): void {
  terms.set(term.id, term);
}
/** Job rules in assignment order (priority, then id). */
export const jobRules = (): readonly JobRule[] => jobs;
export const getJob = (id: string): JobRule | undefined => jobs.find((j) => j.id === id);
export const getTerm = (id: string): ScoringTerm | undefined => terms.get(id);
export const allTerms = (): ScoringTerm[] => [...terms.values()];

[carrier, keeper, presser, chaser, supporter, coverJob, runner, marker, widthJob, hold, shapeJob].forEach(registerJob);
[spacing, passLane, passDistance, supportAngle, forward, goalSide, pressBall, cover, width, shape, keeperArc, onside, getBall].forEach(
  registerTerm,
);
