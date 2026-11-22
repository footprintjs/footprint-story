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

// ── physics ────────────────────────────────────────────────────────────────────────────────────────────────

/** An axis-aligned box on the frame. */
export interface HumanBox { readonly x: number; readonly y: number; readonly w: number; readonly h: number }
/** A floor line (a y; below it is a larger y) and boxes that do not overlap and stand on or above the floor. */
export interface HumanWorld { readonly floor: number | null; readonly boxes: readonly HumanBox[] }
/** The usual apex: a quarter of the distance across (a 45° throw for level ends), at least MIN_APEX px. */
export const APEX_SHARE: number;
export const MIN_APEX: number;
/** The launch from `from` that lands on `to`: with an apex (px above the higher end) or seconds, not both. */
export function launch(from: HumanPoint, to: HumanPoint, options: { readonly apex?: number; readonly seconds?: number; readonly gravity: number }, who?: string): { velocity: [number, number]; seconds: number };
export function flightAt(from: HumanPoint, velocity: HumanPoint, gravity: number, t: number): [number, number];
/** The heading at t (radians, y down). */
export function headingAt(velocity: HumanPoint, gravity: number, t: number): number;
/** The time to fall from y0 to `floor` starting at vertical speed vy; null when it never gets there. */
export function fallSeconds(y0: number, vy: number, floor: number, gravity: number): number | null;
export interface BounceSegment { readonly at: number; readonly seconds: number; readonly from: HumanPoint; readonly velocity: HumanPoint }
export const MIN_BOUNCE: number;
export const MOST_BOUNCES: number;
export function bounces(from: HumanPoint, velocity: HumanPoint, options: { readonly floor: number; readonly gravity: number; readonly restitution: number; readonly keep: number; readonly firstSeconds?: number | null }): { readonly segments: readonly BounceSegment[]; readonly impacts: readonly { readonly at: number; readonly speed: number }[]; readonly rest: HumanPoint; readonly duration: number; readonly stoppedBy: 'low' | 'count' | 'time'; readonly nextHeight: number };
export function bounceAt(plan: { readonly segments: readonly BounceSegment[]; readonly rest: HumanPoint; readonly landed: number; readonly gravity: number }, t: number): [number, number];
export const MIN_CHAIN_PASSES: number;
export const CHAIN_REST_SPEED: number;
export const CHAIN_LENGTH_TOLERANCE: number;
export const MIN_CHAIN_LINK: number;
/** How far gravity may move a point in one sub-step, as a share of a link (0.005); the most sub-steps a step is cut into; the most rounds a chain's layout is relaxed before its first frame. */
export const MOST_STEP_SAG: number;
export const MOST_SUBSTEPS: number;
export const LAYOUT_ROUNDS: number;
/** The sub-steps a step is cut into for this gravity and link length. */
export function substepsFor(gravity: number, rest: number): number;
/** The longest any link is past its length, as a share of it (flat points, the pin first). */
export function stretchOf(points: readonly number[], rest: number): number;
/** A chain's kept frames (flat [x0, y0, x1, y1, …], the pin first, every STEPS_PER_FRAME steps). */
export function runChain(options: { readonly pin: HumanPoint; readonly path: readonly (readonly [number, number, number])[]; readonly points: readonly number[]; readonly rest: number; readonly gravity: number; readonly keep: number; readonly world: HumanWorld; readonly steps: number; readonly settle: boolean }): { readonly frames: readonly (readonly number[])[]; readonly steps: number; readonly substeps: number; readonly stretch: number };
export function relaxChain(points: number[], rest: number, pin: HumanPoint, passes?: number): number[];
export function pinAt(pin: HumanPoint, path: readonly (readonly [number, number, number])[], t: number): HumanPoint;
export const MOST_BOXES: number;
export function makeWorld(world: { readonly floor?: number | null; readonly boxes?: readonly HumanBox[] }, who?: string): HumanWorld;
/** The world an intent names (its floor and boxes), checked. */
export function readWorld(intent: object, who: string): HumanWorld;
export function pushOut(x: number, y: number, world: HumanWorld): [number, number];
export function collide(points: number[], world: HumanWorld, from?: number): number[];
export function depthIn(x: number, y: number, world: HumanWorld, radius?: number): number;
export function verletStep(now: readonly number[], before: readonly number[], accel: HumanPoint, dt: number, keep?: number): number[];
export function simulate<S extends { readonly points: readonly number[] }>(start: S, advance: (state: S, n: number) => S, options: { readonly steps: number; readonly every?: number; readonly stop?: ((state: S, n: number) => boolean) | null }): { readonly frames: readonly (readonly number[])[]; readonly steps: number };
/** The fixed step (1/240 s), the steps to each kept frame (4: 60 a second), gravity (px/s², down), the longest physics plan (s). */
export const PHYSICS_STEP: number;
export const STEPS_PER_FRAME: number;
export const GRAVITY: number;
export const MOST_PHYSICS_SECONDS: number;
export type SpringFeel = 'snappy' | 'default' | 'heavy' | 'playful' | { readonly k: number; readonly d: number };
/** How much of the way back is still to go at t on a spring: 1 at 0, exactly 0 at settleSeconds. */
export function settleLeft(t: number, feel?: SpringFeel): number;
export function settleSeconds(feel?: SpringFeel): number;
/** How near its end a spring must come to count as settled (0.005). */
export const SETTLED_WITHIN: number;
/** Refuses a spring that does not settle within the motion spring's scan (30 s); gives its settle seconds. */
export function checkSettles(feel: SpringFeel, who: string): number;

// ── models ─────────────────────────────────────────────────────────────────────────────────────────────────

export type HumanFamily = 'reach' | 'pen' | 'letter' | 'settle' | 'fall' | 'throw' | 'hang' | 'sketch';
export type HumanDo = 'reach' | 'draw' | 'write' | 'settle' | 'fall' | 'throw' | 'hang' | 'sketch';
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
/** The intent keys of a throw and of a fall (the ballistic and bounce models read them). */
export const THROW_KEYS: readonly string[];
export const FALL_KEYS: readonly string[];
/** The shortest a throw may take: one frame at 60 a second. */
export const MIN_THROW_SECONDS: number;
/** A landing squashes a bouncing body for this long either side of it (s). */
export const SQUASH_SECONDS: number;
export const MOST_CHAIN_LINKS: number;
export const MOST_CHAIN_SECONDS: number;
export const MOST_PATH_KEYS: number;
/** The strongest gravity a chain takes (px/s²), its links and damping when the intent names none. */
export const MOST_CHAIN_GRAVITY: number;
export const USUAL_LINKS: number;
export const USUAL_DAMPING: number;
/** The least overshoot a settle's reason mentions (half a percent of the way). */
export const OVERSHOOT_SEEN: number;

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
  /** The family it serves, or a list of them (ballistic: ['throw', 'fall']). */
  readonly family: HumanFamily | readonly HumanFamily[];
  readonly name: string;
  readonly options?: readonly string[];
  check?(options: HumanOptions): void;
  plan(intent: any, context: HumanContext): HumanPlan;
  sample(plan: any, t: number): { readonly x: number; readonly y: number; readonly [key: string]: HumanSampleValue };
  readonly checks?: readonly string[];
}
/** A sampled track, as the critics read it. */
/** A sampled track, as the critics read it: each sample whole, and the plan (a wrapped one as it is). */
export interface HumanTrack { readonly who: string; readonly family: HumanFamily; readonly model: string; readonly seconds: number; readonly pushes: number; readonly samples: readonly (HumanSample & { readonly t: number })[]; readonly plan: HumanPlan;
  /** A wrapped move's model's own plan, sampled alone: the jerk critic scores the model and the wrappers apart. */
  readonly base?: { readonly seconds: number; readonly pushes: number; readonly samples: readonly (HumanSample & { readonly t: number })[] } }
/** A critic: a number measured on a track, and a finding in words past its limit (null within it). */
export interface HumanCritic {
  readonly name: string;
  readonly limit: number;
  measure(track: HumanTrack): number | { readonly value: number; readonly basis?: HumanBasis | null } | null;
  finding(value: number, who: string, basis: HumanBasis | null): { readonly level: 'warn' | 'note'; readonly message: string; readonly fix: string } | null;
}
export interface HumanSettings { readonly models?: readonly HumanModel[] | null; readonly critics?: readonly HumanCritic[] | null }
/** A move, as planMove gives it: frozen plain data a record keeps. */
export interface HumanMove { readonly model: string; readonly family: HumanFamily; readonly do: HumanDo; readonly who: string; readonly options: HumanOptions; readonly choice: { readonly by: 'named' | 'usual' }; readonly reason: string; readonly plan: HumanPlan; readonly checks: readonly string[]; readonly wrappers?: readonly WrapperName[] }
export function planMove(intent: HumanIntent, settings?: (HumanSettings & { readonly frame?: HumanPoint }) | null): HumanMove;
export function sampleMove(move: HumanMove, t: number, settings?: HumanSettings | null): HumanSample;
export function sampleTrack(move: HumanMove, settings?: (HumanSettings & { readonly rate?: number }) | null): HumanTrack;

// ── wrappers ───────────────────────────────────────────────────────────────────────────────────────────────

export type WrapperName = 'anticipate' | 'follow-through' | 'hold' | 'overshoot';
/** A wrapped plan: the inner plan unchanged, the wrapper's name and numbers, its seconds the inner's plus what it adds. */
export type WrappedPlan = HumanPlan & { readonly wrapper: WrapperName; readonly inner: HumanPlan } & (
  | { readonly wrapper: 'anticipate' | 'follow-through'; readonly share: number; readonly by: number | null }
  | { readonly wrapper: 'hold'; readonly at: number; readonly held: number }
  | { readonly wrapper: 'overshoot'; readonly share: number; readonly by: number | null; readonly feel: SpringFeel; readonly tail: number });
/** A pull back opposite the first direction of travel, released into the move: adds share × its seconds before it. */
export function anticipate(move: HumanMove, options?: { readonly share?: number; readonly by?: number | null }): HumanMove;
/** Carries on past the end and swings back: adds share × its seconds after it. */
export function followThrough(move: HumanMove, options?: { readonly share?: number; readonly by?: number | null }): HumanMove;
/** Still for `seconds` at the move's time `at`. */
export function hold(move: HumanMove, options: { readonly at: number; readonly seconds: number }): HumanMove;
/** Arrives `by` px past the end, then settles back on the spring `feel`: adds settleSeconds(feel). */
export function overshoot(move: HumanMove, options?: { readonly by?: number | null; readonly share?: number; readonly feel?: SpringFeel }): HumanMove;
/** The plan the model made, under every wrapper. */
export function basePlan(plan: HumanPlan): HumanPlan;
export function isWrapped(plan: unknown): plan is WrappedPlan;
export const BY_SHARE: number;
export const MIN_TRAVEL: number;
export const MOST_WRAPPERS: number;
export const WRAPPER_NAMES: readonly WrapperName[];
/** The speed bells each wrapper adds to a move's pushes (none when its by is 0; a hold only inside the move). */
export const ADDED_BELLS: Readonly<Record<WrapperName, number>>;
/** The pushes a plan is made of: its model's own, and the bells each wrapper adds when it makes motion (what sampleTrack hands the critics). */
export function wrappedPushes(plan: HumanPlan, sampleInner: (plan: any, t: number) => { readonly x: number; readonly y: number }): number;

// ── critics ────────────────────────────────────────────────────────────────────────────────────────────────

export const HUMAN_CRITICS: readonly string[];
export const FINDING_LEVELS: readonly ('warn' | 'note')[];
export const JERK_PEAK_SHARE: number;
export const ARC_LEAST: number;
export const PEN_SPEED_MOST: number;
/** The least share of its gravity a fall's vertical acceleration must show to read as falling (0.5), the most a squash may change the area (10%), the deepest a body may go into something solid (0.5 px). */
export const SPACING_LEAST: number;
/** The most share of its gravity a fall may show before it reads as thrown down (2). */
export const SPACING_MOST: number;
export const VOLUME_MOST: number;
export const CONTACT_MOST: number;
export interface HumanFinding { readonly critic: string; readonly level: 'warn' | 'note'; readonly message: string; readonly fix: string; readonly basis: HumanBasis | null }
export function checkMove(move: HumanMove, settings?: (HumanSettings & { readonly rate?: number }) | null): { readonly measures: Readonly<Record<string, number | null>>; readonly bases: Readonly<Record<string, HumanBasis | null>>; readonly findings: readonly HumanFinding[] };

// ── the intent decider ─────────────────────────────────────────────────────────────────────────────────────

/** A rule of the choice, in the shape of footprintjs decide() rules: tests over an intent's facts {do, family, named, usual}. */
export interface ChooseRule { readonly when: Readonly<Record<string, Readonly<{ eq?: unknown; ne?: unknown }>>>; readonly then: 'named' | 'usual'; readonly label: string }
/** How a model is chosen, first match wins: the model the intent names, else its family's usual. */
export const CHOOSE_RULES: readonly ChooseRule[];
/** The most intents planIntents takes in one list. */
export const MOST_INTENTS: number;
/** The most samples a track summary keeps. */
export const SUMMARY_POINTS: number;
/** A wrapper an intent asks for: its name and its options (as anticipate, followThrough, hold and overshoot take them). */
export type HumanWrapEntry = { readonly wrapper: WrapperName; readonly [option: string]: unknown };
/** An intent as an author writes it in a list: an intent, and the wrappers it asks for, innermost first. */
export type HumanIntentEntry = HumanIntent & { readonly wrap?: readonly HumanWrapEntry[] };
/** Each intent's choice: its family by its do, its model by the first rule that held (the rule's words), and whether the model is a tool's own. */
export interface HumanChoice { readonly who: string; readonly do: HumanDo; readonly family: HumanFamily; readonly model: string; readonly by: 'named' | 'usual'; readonly rule: string; readonly own: boolean }
/** A move's sampled track, summed up: at most SUMMARY_POINTS points [t, x, y]. */
export interface HumanTrackSummary { readonly seconds: number; readonly count: number; readonly pushes: number; readonly distance: number; readonly peakSpeed: number; readonly bounds: readonly [number, number, number, number]; readonly points: readonly (readonly [number, number, number])[] }
/** What planIntents gives: the last state of HUMAN_STEPS, each list in the intents' order. */
export interface HumanIntentsResult extends HumanPerIntent {
  readonly intents: readonly (HumanIntent & { readonly who: string })[];
  readonly wraps: readonly (readonly HumanWrapEntry[])[];
  readonly frame: HumanPoint | null;
  readonly choices: readonly HumanChoice[];
  /** 'ours' when this package's models plan every move, 'own' when a tool's own model plans one (its code is outside a record). */
  readonly chose: 'ours' | 'own';
  readonly choseWhy: string;
  readonly plans: readonly HumanMove[];
  readonly moves: readonly HumanMove[];
  readonly durations: readonly { readonly seconds: number; readonly model: string; readonly basis: HumanBasis | null; readonly wrappers: readonly WrapperName[]; readonly who: string }[];
  readonly tracks: readonly HumanTrackSummary[];
  readonly checks: readonly ReturnType<typeof checkMove>[];
  readonly findings: readonly { readonly intent: number; readonly who: string; readonly model: string; readonly critic: string; readonly level: 'warn' | 'note'; readonly message: string; readonly fix: string }[];
}
/** What is decided per intent, written under a key of its own beside the list keys, and the step that decides it. */
export const PER_INTENT: Readonly<{ model: 'choose'; duration: 'wrap'; findings: 'findings' }>;
/** The key one intent's value is written under: intentKey('duration', 3) → 'duration-3' (ask whyFromRecord for it). */
export function intentKey<W extends keyof typeof PER_INTENT>(what: W, i: number): `${W}-${number}`;
/** One intent's duration under its own key: the seconds and its model's basis, flat; a wrapped move's wrappers and the model's own seconds. */
export type HumanIntentDuration = Readonly<{ seconds: number; wrappers?: string; planned?: number | null }> & Readonly<Record<string, number | string | boolean | null>>;
/** The per-intent keys of planIntents' result. */
export type HumanPerIntent = {
  readonly [key: `model-${number}`]: { readonly model: string; readonly family: HumanFamily; readonly by: 'named' | 'usual'; readonly rule: string; readonly own: boolean };
  readonly [key: `duration-${number}`]: HumanIntentDuration;
  readonly [key: `findings-${number}`]: readonly { readonly critic: string; readonly level: 'warn' | 'note'; readonly fix: string }[];
};
/** A step of the intent decider: the keys it reads and writes, and its pure run; a step that chooses has `decides` and `branches`. */
export interface HumanStep {
  readonly name: string; readonly about: string; readonly reads: readonly string[]; readonly writes: readonly string[];
  run(state: any, tools?: { readonly models?: readonly HumanModel[]; readonly critics?: readonly HumanCritic[] }): any;
  readonly input?: true;
  /** The per-intent prefixes it writes (PER_INTENT): one key per intent each. */
  readonly each: readonly string[];
  readonly decides?: { readonly key: string; readonly why: string; readonly name: string; readonly reads: readonly string[]; readonly writes: readonly string[]; readonly each: readonly string[]; run(state: any, tools: any): any };
  readonly branches?: Readonly<Record<string, { readonly name: string; readonly reads: readonly string[]; readonly writes: readonly string[]; readonly each: readonly string[]; run(state: any, tools: any): any }>>;
}
/** read → choose? (ours | own: plan) → wrap → sample → check → findings. */
export const HUMAN_STEPS: readonly HumanStep[];
/** The keys the read step writes: intents, wraps, frame. */
export const HUMAN_INPUT: readonly string[];
/** An author's intents decided: per intent the model and why, the plan and its basis, the wrapped move, a track summary, the critics' measures and findings. Frozen plain data. */
export function planIntents(intents: readonly HumanIntentEntry[], settings?: (HumanSettings & { readonly frame?: HumanPoint | null }) | null): HumanIntentsResult;

// ── hand-drawn strokes (src/human/strokes/README.md) ───────────────────────────────────────────────────────

export type SketchLayer = 'outline' | 'detail';
export type FillKind = 'hatch' | 'cross-hatch' | 'scribble';
/** A fill: parallel lines at `angle` degrees (from the x axis toward y, which runs down), `spacing` px apart. */
export interface SketchFill { readonly kind: FillKind; readonly angle?: number; readonly spacing?: number }
/** What a hand is asked to draw: points, closed or not; its layer (outline first, then detail) and piece (`group`); a fill on a closed shape, kept out of its holes; edge: false draws only the fill. */
export interface SketchShape { readonly points: readonly HumanPoint[]; readonly closed?: boolean; readonly layer?: SketchLayer; readonly group?: string; readonly edge?: boolean; readonly fill?: SketchFill; readonly holes?: readonly (readonly HumanPoint[])[] }
/** A stroke as the hand draws it: its corners (`path`), then its points with widths and times (seconds from the sketch's start), its smooth line and the room its tremor had. */
export interface SketchStroke {
  readonly layer: SketchLayer | 'fill'; readonly group: string; readonly kind: 'line' | FillKind; readonly shape: number; readonly set: number | null;
  readonly path: readonly HumanPoint[]; readonly start: number; readonly seconds: number; readonly length: number; readonly amplitude: number; readonly hooks: number;
  readonly xs: readonly number[]; readonly ys: readonly number[]; readonly ws: readonly number[]; readonly ts: readonly number[];
  readonly sx: readonly number[]; readonly sy: readonly number[]; readonly rs: readonly number[];
}
/** A set of fill lines: its shape, kind, angle and spacing, and how far across the shape reaches (lo to hi, along the normal). */
export interface SketchSet { readonly shape: number; readonly kind: FillKind; readonly angle: number; readonly spacing: number; readonly lo: number; readonly hi: number; readonly lines: number }
/** A sketch planned: the strokes in order, the lifts between them, where each stroke starts and the rule that put it there. */
export interface SketchPlan {
  readonly seconds: number; readonly natural: number; readonly strokes: readonly SketchStroke[];
  readonly lifts: readonly { readonly after: number; readonly seconds: number; readonly distance: number }[];
  readonly order: readonly { readonly stroke: number; readonly layer: SketchLayer | 'fill'; readonly group: string; readonly rule: 'first' | 'odd' | 'nearest' | 'fill'; readonly at: HumanPoint }[];
  readonly sets: readonly SketchSet[]; readonly least: { readonly outline: number; readonly detail: number }; readonly boilSeed: number; readonly rule: string;
  readonly step: number; readonly tremor: number; readonly wavelength: number; readonly width: number; readonly overshoot: number; readonly hooks: number; readonly shapes: number; readonly points: number;
}
export interface SketchSettings { readonly random?: () => number; readonly seed?: string; readonly who?: string; readonly speed?: number; readonly fillSpeed?: number; readonly width?: number; readonly tremor?: number; readonly wavelength?: number; readonly overshoot?: number; readonly seconds?: number }
/** A drawing planned as a hand draws it: piece by piece from the top left; outline, detail, fills; as few strokes as the corners allow (ORDER_RULE). */
export function planSketch(shapes: readonly SketchShape[], settings: SketchSettings): SketchPlan;
/** Where the pen is at t: drawing (down 1, the width it lays) or in the air between strokes (down 0, width 0). */
export function sampleSketch(plan: SketchPlan, t: number): { readonly x: number; readonly y: number; readonly width: number; readonly down: number; readonly stroke: number; readonly progress: number };
/** The finished sketch redrawn for a frame: a fresh seeded tremor every `every` frames (3), within each stroke's room. */
export function boilSketch(plan: SketchPlan, frame: number, options?: { readonly every?: number; readonly amplitude?: number }): { readonly frame: number; readonly held: number; readonly strokes: readonly { readonly xs: readonly number[]; readonly ys: readonly number[] }[] };
/** One set of hatch lines over a ring, outside its holes: pieces exactly inside, `spacing` apart across, centred. */
export function hatchLines(ring: readonly HumanPoint[], options: { readonly angle: number; readonly spacing: number; readonly holes?: readonly (readonly HumanPoint[])[] }): { readonly segments: readonly { readonly a: HumanPoint; readonly b: HumanPoint; readonly line: number }[]; readonly normal: HumanPoint; readonly direction: HumanPoint; readonly lo: number; readonly hi: number; readonly offsets: readonly number[] };
/** The fewest strokes that draw a graph's edges, each once (Euler): one per connected part, or half its odd corners. */
export function leastStrokes(graph: { readonly corners: readonly HumanPoint[]; readonly edges: readonly { readonly a: number; readonly b: number }[] }): number;
/** Corners with a hook past each turn of CORNER.angle or more: out along the line it came in on, and back. */
export function withOvershoot(points: readonly HumanPoint[], most?: number): HumanPoint[];
/** An isometric paint list's faces as sketch shapes: an edge one face has is the outline, one two share is detail; an edge a later face hides is left out. */
export function shapesOfPaint(items: readonly { readonly item: string; readonly role: string; readonly [key: string]: unknown }[], options?: { readonly roles?: readonly string[]; readonly group?: string }): SketchShape[];
/** A plan's strokes as isometric paint items: {item: 'stroke', points: [[x, y, width, t], …]}. */
export function strokeItems(plan: SketchPlan, options: { readonly of: string; readonly role: string; readonly colour?: string | null; readonly alpha?: number; readonly width: number; readonly at?: number; readonly strokes?: readonly SketchStroke[] }): { readonly item: 'stroke'; readonly role: string; readonly of: string; readonly points: (readonly [number, number, number, number])[]; readonly fill: null; readonly stroke: { readonly colour: string | null; readonly alpha: number; readonly width: number; readonly join: 'round'; readonly cap: 'round' } }[];
/** The ring round a stroke of changing width (points [x, y, width, …]): what a painter that cannot vary a line's width fills. */
export function strokeOutline(points: readonly (readonly number[])[]): [number, number][];
/** An isometric style choice, as src/isometric/style.js takes a tool's own (handed in under `choices`). */
export interface StrokeStyleChoice { readonly column: 'line' | 'texture'; readonly name: string; readonly options: readonly string[]; check(options: Readonly<Record<string, unknown>>): void; readonly clashes: readonly never[]; apply(items: readonly any[], context: any): any[] }
/** The line 'human:sketchy': a piece's edges drawn by hand (silhouette, then inner edges). Hand it to isoStyle in choices. */
export const sketchyLine: StrokeStyleChoice;
/** The texture 'human:hatch': left faces and sides hatched, right faces cross-hatched, after the line's strokes. */
export const hatchTexture: StrokeStyleChoice;
export const ROLE_FILLS: Readonly<Record<string, FillKind>>;
export const SKETCH: Readonly<{ speed: number; fillSpeed: number; width: number; fillTremor: number }>;
export const WIDTH_SHARE: Readonly<{ outline: number; detail: number; fill: number }>;
export const LIFT: Readonly<{ seconds: number; speed: number }>;
export const MOST_SKETCH_POINTS: number;
export const BOIL: Readonly<{ every: number; most: number }>;
export const MOST_BOIL_FRAME: number;
export const MIN_PIECE: number;
export const MOST_HATCH_LINES: number;
export const CROSS_TURN: number;
export const ORDER_RULE: string;
export const MOST_BRIDGE_EDGES: number;
export const MERGE: number;
export const CORNER: Readonly<{ angle: number; share: number; most: number }>;
export const PEN_WIDTH: Readonly<{ thin: number; taper: number; taperShare: number; tip: number }>;
export const STROKE_STEP: number;
export const SKETCH_LAYERS: readonly SketchLayer[];
export const FILL_KINDS: readonly FillKind[];
export const HATCH: Readonly<{ angle: number; spacing: number; least: number; most: number }>;
export const MOST_SHAPES: number;
export const MOST_SHAPE_POINTS: number;
export const MOST_SKETCH_INPUT: number;
export const ELLIPSE_POINTS: number;
export const HIDDEN: number;
export const SKETCH_KEYS: readonly string[];
/** The most extra strokes over the least (0), the most strokes drawn before their outline (0), the widest band in a hatch over its spacing (1.5). */
export const PEN_LIFTS_MOST: number;
export const STROKE_ORDER_MOST: number;
export const HATCH_GAP_MOST: number;
