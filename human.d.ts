/**
 * footprint-story/human — how people move and draw, as numbers: the laws, the paths they run on, named models that
 * turn an intent into a plan, and critics that say in words what still looks wrong. Pure: runs anywhere, imports
 * nothing. Nothing here draws.
 */

/** A point on the frame, [x, y], in px (y down). */
export type HumanPoint = readonly [number, number];

// ── laws ───────────────────────────────────────────────────────────────────────────────────────────────────

/** How far along a minimum-jerk move is at u (0..1, clamped): 10u³ − 15u⁴ + 6u⁵. */
export function minJerk(u: number): number;
/** Its speed per unit of u: 30u²(1 − u)², MIN_JERK_PEAK at the middle. */
export function minJerkSpeed(u: number): number;
/** Its acceleration per unit of u squared: 60u(1 − u)(1 − 2u). */
export function minJerkAccel(u: number): number;
/** The highest minimum-jerk speed per unit: 1.875. */
export const MIN_JERK_PEAK: number;

/** Fitts's law's defaults: a (s), b (s a bit), and the target width (px) used when an intent names none. */
export const FITTS: { readonly a: number; readonly b: number; readonly target: number };
/** A move's index of difficulty, in bits: log2(distance / width + 1). */
export function fittsIndex(distance: number, width: number): number;
/** How long a move takes, in seconds: a + b · fittsIndex(distance, width). */
export function fittsSeconds(distance: number, width?: number, constants?: { readonly a?: number; readonly b?: number }): number;

/** The two-thirds power law's numbers: its exponent (1/3), the curvature floor (per px) and the ramp share at each end. */
export const POWER_LAW: { readonly exponent: number; readonly floor: number; readonly ramp: number };
/** gain · (curvature + floor)^(−exponent). */
export function powerLawSpeed(curvature: number, settings?: { readonly gain?: number; readonly exponent?: number; readonly floor?: number }): number;
/** When the pen reaches each point (seconds, 0 to `seconds`), from the distances along and the curvatures. */
export function powerLawTimes(along: readonly number[], curvatures: readonly number[], seconds: number, settings?: { readonly exponent?: number; readonly floor?: number; readonly ramp?: number }): number[];
/** The law fitted to speeds and curvatures by least squares on the logs (the exponent held when given); null under 3 pairs. */
export function powerLawFit(speeds: readonly number[], curvatures: readonly number[], settings?: { readonly exponent?: number }): { readonly exponent: number; readonly gain: number; readonly error: number; readonly count: number } | null;

/** One lognormal stroke: its distance (px), start (s), mu and sigma (of the log of the time since its start), and the angles it turns from and to (radians, y down). */
export interface LognormalStroke { readonly distance: number; readonly start: number; readonly mu: number; readonly sigma: number; readonly angleFrom: number; readonly angleTo: number }
/** The letter model's defaults: mu, sigma, and the gap (s) from one stroke's start to the next. */
export const SIGMA_LOGNORMAL: { readonly mu: number; readonly sigma: number; readonly gap: number };
/** How many sigmas past mu a stroke counts as done. */
export const STROKE_SIGMAS: number;
export function lognormalShare(t: number, stroke: LognormalStroke): number;
export function lognormalSpeed(t: number, stroke: LognormalStroke): number;
export function strokeEnd(stroke: LognormalStroke): number;
export function strokeOffset(stroke: LognormalStroke, share: number): [number, number];
/** A stroke from p to q, its chord turned by `bend` radians. */
export function strokeBetween(p: HumanPoint, q: HumanPoint, settings?: { readonly bend?: number; readonly start?: number; readonly mu?: number; readonly sigma?: number }): LognormalStroke;
/** The pen at t from `origin`, the strokes added; with `end`, landing exactly at end and held there. */
export function sigmaLognormalAt(strokes: readonly LognormalStroke[], t: number, origin?: HumanPoint, end?: number): { x: number; y: number; vx: number; vy: number };

/** The tremor's defaults: amplitude (px) and wavelength (px). */
export const TREMOR: { readonly amplitude: number; readonly wavelength: number };
export const MOST_TREMOR_KNOTS: number;
/** A tremor's knots for a line `length` px long, from a seeded random(). */
export function tremorKnots(random: () => number, length: number, settings?: { readonly wavelength?: number }): number[];
/** The tremor's offset across the line at distance s, brought to 0 at both ends. */
export function tremorAt(knots: readonly number[], s: number, length: number, settings?: { readonly amplitude?: number; readonly wavelength?: number }): number;

// ── paths ──────────────────────────────────────────────────────────────────────────────────────────────────

/** A line's length table: how far along each point is. Made only by arcTable. */
export interface ArcTable { readonly points: readonly HumanPoint[]; readonly along: readonly number[]; readonly length: number }
export const MOST_TABLE_POINTS: number;
export function arcTable(points: readonly HumanPoint[]): ArcTable;
export function pointAt(table: ArcTable, distance: number): HumanPoint;
export function shareToDistance(table: ArcTable, share: number): number;
export function distanceToShare(table: ArcTable, distance: number): number;
export const MOST_CURVE_POINTS: number;
/** A centripetal Catmull-Rom line through the points (each among the result exactly), about `spacing` px apart. */
export function catmullRom(points: readonly HumanPoint[], settings?: { readonly spacing?: number; readonly alpha?: number }): readonly HumanPoint[];
/** The curvature (per px) at each point; a turn past a right angle reads as at least 2 · cos(B/2) / its shorter side. */
export function curvatures(points: readonly HumanPoint[]): readonly number[];
/** The curvature after averaging each point with the k either side, held at a circle as wide as that half-width; a fold reads across it. */
export function curvaturesOver(points: readonly HumanPoint[], k: number): readonly number[];
export const MOST_RESAMPLED: number;
/** The gap beside each point to another stretch of the same line (a hairpin's other leg), up to `within` px; Infinity where none. */
export function legGaps(points: readonly HumanPoint[], within: number): readonly number[];
/** The points again, every `spacing` px along, or `count` points evenly along. */
export function resample(points: readonly HumanPoint[], settings: { readonly spacing: number } | { readonly count: number }): readonly HumanPoint[];

// ── models ─────────────────────────────────────────────────────────────────────────────────────────────────

export type HumanFamily = 'reach' | 'pen' | 'letter' | 'settle' | 'fall' | 'throw' | 'hang';
export type HumanDo = 'reach' | 'draw' | 'write' | 'settle' | 'fall' | 'throw' | 'hang';
export const HUMAN_FAMILIES: readonly HumanFamily[];
export const HUMAN_DOS: Readonly<Record<HumanDo, HumanFamily>>;
export const HUMAN_MODELS: Readonly<Record<HumanFamily, readonly string[]>>;
export const USUAL_MODELS: Readonly<Partial<Record<HumanFamily, string>>>;
export const MIN_JERK_BEND: number;
/** The most a reach may bow, either way (0.3 of its length). */
export const MOST_BEND: number;
/** How far either side, in px, the pen model and the pen-speed critic read a bend over. */
export const BEND_WIDTH: number;
/** The most numbers or points one list in a sample may hold. */
export const MOST_SAMPLE_LIST: number;
/** The intent's keys left out of the seed: where it was written, and how long it takes. */
export const UNSEEDED_KEYS: readonly string[];
export const PEN_SPEED: number;
export const MOST_STROKES: number;
export const MOST_TRACK_SAMPLES: number;

export type HumanOptions = Readonly<Record<string, number | string | boolean>>;
/** What an author writes: what happens. Each family reads its own keys (see src/human/README.md). */
export interface HumanIntent {
  readonly do: HumanDo;
  readonly name?: string;
  readonly who?: string;
  readonly model?: string | ({ readonly name: string } & HumanOptions);
  readonly [key: string]: unknown;
}
/** What a model is handed beside the intent. */
export interface HumanContext { readonly who: string; readonly name: string | null; readonly options: HumanOptions; random(): number; readonly frame: HumanPoint | null }
/** A flat record of the numbers (and words, true/false) a plan or a critic chose by: data for a record, beside the words. */
export type HumanBasis = Readonly<Record<string, number | string | boolean | null>>;
/** A plan: plain data with how long the move takes; `why` in words, `basis` its numbers, `pushes` how many pushes it is made of. */
export interface HumanPlan { readonly seconds: number; readonly why?: string; readonly basis?: HumanBasis; readonly pushes?: number; readonly [key: string]: unknown }
/** What a sample may hold besides x and y: a number, or a list of at most MOST_SAMPLE_LIST numbers or points (a hanging chain). */
export type HumanSampleValue = number | readonly number[] | readonly HumanPoint[];
/** A sample: where the move is, and any other numbers or lists the model gives. */
export interface HumanSample { readonly x: number; readonly y: number; readonly [key: string]: HumanSampleValue }
/** A model: a named strategy for one family of move. A tool's own is named under its prefix ('reel:chalk-pen'). */
export interface HumanModel {
  readonly family: HumanFamily;
  readonly name: string;
  readonly options?: readonly string[];
  check?(options: HumanOptions): void;
  plan(intent: any, context: HumanContext): HumanPlan;
  sample(plan: any, t: number): { readonly x: number; readonly y: number; readonly [key: string]: HumanSampleValue };
  readonly checks?: readonly string[];
}
/** A sampled track, as the critics read it. */
export interface HumanTrack { readonly who: string; readonly family: HumanFamily; readonly model: string; readonly seconds: number; readonly pushes: number; readonly samples: readonly { readonly t: number; readonly x: number; readonly y: number }[] }
/** A critic: a number measured on a track, and a finding in words past its limit (null within it). */
export interface HumanCritic {
  readonly name: string;
  readonly limit: number;
  measure(track: HumanTrack): number | { readonly value: number; readonly basis?: HumanBasis | null } | null;
  finding(value: number, who: string, basis: HumanBasis | null): { readonly level: 'warn' | 'note'; readonly message: string; readonly fix: string } | null;
}
export interface HumanSettings { readonly models?: readonly HumanModel[] | null; readonly critics?: readonly HumanCritic[] | null }
/** A move, as planMove gives it: frozen plain data a record keeps. */
export interface HumanMove { readonly model: string; readonly family: HumanFamily; readonly do: HumanDo; readonly who: string; readonly options: HumanOptions; readonly choice: { readonly by: 'named' | 'usual' }; readonly reason: string; readonly plan: HumanPlan; readonly checks: readonly string[] }
export function planMove(intent: HumanIntent, settings?: (HumanSettings & { readonly frame?: HumanPoint }) | null): HumanMove;
export function sampleMove(move: HumanMove, t: number, settings?: HumanSettings | null): HumanSample;
export function sampleTrack(move: HumanMove, settings?: (HumanSettings & { readonly rate?: number }) | null): HumanTrack;

// ── critics ────────────────────────────────────────────────────────────────────────────────────────────────

export const HUMAN_CRITICS: readonly string[];
export const FINDING_LEVELS: readonly ('warn' | 'note')[];
export const JERK_PEAK_SHARE: number;
export const ARC_LEAST: number;
export const PEN_SPEED_MOST: number;
export interface HumanFinding { readonly critic: string; readonly level: 'warn' | 'note'; readonly message: string; readonly fix: string; readonly basis: HumanBasis | null }
export function checkMove(move: HumanMove, settings?: (HumanSettings & { readonly rate?: number }) | null): { readonly measures: Readonly<Record<string, number | null>>; readonly bases: Readonly<Record<string, HumanBasis | null>>; readonly findings: readonly HumanFinding[] };
