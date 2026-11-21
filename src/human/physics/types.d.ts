// footprint-story/human · physics — declarations, to be merged into human.d.ts (src/human/physics/index.js).

export type Point = readonly [number, number];
export interface Box { readonly x: number; readonly y: number; readonly w: number; readonly h: number }
/** A floor line (a y; below it is a larger y) and boxes that do not overlap and stand on or above the floor. */
export interface World { readonly floor: number | null; readonly boxes: readonly Box[] }

/** What a model is handed beside the intent: who the entry is, in its own words, and its seeded numbers. */
export interface PhysicsContext { who?: string; random?: () => number; frame?: unknown }

export interface ThrowIntent { do?: 'throw'; from: Point; to: Point; apex?: number; seconds?: number; gravity?: number; floor?: number | null; boxes?: Box[]; radius?: number }
export interface BounceThrowIntent extends ThrowIntent { restitution?: number; keep?: number; squash?: number }
export interface FallIntent { do?: 'fall'; from: Point; floor: number; velocity?: Point; gravity?: number; boxes?: Box[]; radius?: number }
export interface BounceFallIntent extends FallIntent { restitution?: number; keep?: number; squash?: number }
export interface HangIntent {
  do?: 'hang'; from: Point; to?: Point; length?: number; links?: number;
  /** The pin's moves after `from`: [t, x, y] keys, t rising, each above 0. */
  path?: readonly (readonly [number, number, number])[];
  seconds?: number; gravity?: number; damping?: number; jitter?: number; floor?: number | null; boxes?: Box[];
}
export type PhysicsIntent = ThrowIntent | BounceThrowIntent | FallIntent | BounceFallIntent | HangIntent;

interface PlanBase { readonly model: 'ballistic' | 'bounce' | 'verlet'; readonly family: 'throw' | 'fall' | 'hang'; readonly who: string; readonly duration: number; readonly world: World; readonly radius: number }
export interface BallisticPlan extends PlanBase { readonly model: 'ballistic'; readonly family: 'throw' | 'fall'; readonly from: Point; readonly to: Point; readonly velocity: Point; readonly gravity: number }
export interface BounceSegment { readonly at: number; readonly seconds: number; readonly from: Point; readonly velocity: Point }
export interface BouncePlan extends PlanBase {
  readonly model: 'bounce'; readonly family: 'throw' | 'fall'; readonly gravity: number; readonly landed: number;
  readonly segments: readonly BounceSegment[]; readonly impacts: readonly { readonly at: number; readonly speed: number }[]; readonly rest: Point; readonly squash: number;
}
export interface VerletPlan extends PlanBase { readonly model: 'verlet'; readonly family: 'hang'; readonly frameSeconds: number; readonly links: number; readonly rest: number; readonly frames: readonly (readonly number[])[] }
export type PhysicsPlan = BallisticPlan | BouncePlan | VerletPlan;

/** A sample: where it is at t; `angle` its heading (radians, y down), `sx`/`sy` a squash (sx · sy = 1), `points` a chain's. */
export interface PhysicsSample { readonly x: number; readonly y: number; readonly angle?: number; readonly sx?: number; readonly sy?: number; readonly points?: readonly Point[] }

export interface PhysicsModel<I = PhysicsIntent, P = PhysicsPlan> {
  readonly family: 'throw' | 'fall' | 'hang';
  readonly name: 'ballistic' | 'bounce' | 'verlet';
  /** The intent keys it reads besides `do`. */
  readonly options: readonly string[];
  /** The intent checked once (the reading plan() does); throws naming the entry and the fix. */
  check(intent: I, context?: PhysicsContext): void;
  plan(intent: I, context?: PhysicsContext): P;
  sample(plan: P, t: number): PhysicsSample;
  readonly checks: readonly ('spacing' | 'volume' | 'contact')[];
}
export const PHYSICS_MODELS: readonly PhysicsModel<any, any>[];
export const SQUASH_SECONDS: number;
export const MOST_LINKS: number;
export const MOST_CHAIN_SECONDS: number;

/** Any plan a model made: a duration (s) and whatever its sampler reads. */
export interface AnyPlan { readonly duration: number; readonly who?: string }
export type WrapperName = 'anticipate' | 'follow-through' | 'hold' | 'overshoot';
export type Feel = 'snappy' | 'default' | 'heavy' | 'playful' | { readonly k: number; readonly d: number };
/** A wrapped plan: the inner plan unchanged, the wrapper's name and numbers, the new duration. */
export type WrappedPlan<P extends AnyPlan = AnyPlan> = { readonly duration: number; readonly inner: P | WrappedPlan<P> } & (
  | { readonly wrapper: 'anticipate'; readonly share: number; readonly by: number | null }
  | { readonly wrapper: 'follow-through'; readonly share: number; readonly by: number | null }
  | { readonly wrapper: 'hold'; readonly at: number; readonly seconds: number }
  | { readonly wrapper: 'overshoot'; readonly share: number; readonly by: number | null; readonly feel: Feel; readonly tail: number });

export function anticipate<P extends AnyPlan>(plan: P | WrappedPlan<P>, options?: { share?: number; by?: number | null }): WrappedPlan<P>;
export function followThrough<P extends AnyPlan>(plan: P | WrappedPlan<P>, options?: { share?: number; by?: number | null }): WrappedPlan<P>;
export function hold<P extends AnyPlan>(plan: P | WrappedPlan<P>, options: { at: number; seconds: number }): WrappedPlan<P>;
export function overshoot<P extends AnyPlan>(plan: P | WrappedPlan<P>, options?: { by?: number | null; share?: number; feel?: Feel }): WrappedPlan<P>;
export function sampleWrapped<P extends AnyPlan, S extends { x: number; y: number }>(plan: P | WrappedPlan<P>, t: number, sampleInner: (plan: P, t: number) => S): S;
export function basePlan<P extends AnyPlan>(plan: P | WrappedPlan<P>): P;
export function isWrapped(plan: unknown): boolean;
export const PHYSICS_WRAPPERS: readonly { readonly name: WrapperName; readonly options: readonly string[]; wrap(plan: AnyPlan, options?: object): WrappedPlan }[];
export const WRAPPER_NAMES: readonly WrapperName[];
export const BY_SHARE: number;
export const MIN_TRAVEL: number;
export const MOST_WRAPPERS: number;

export interface TrackSample extends PhysicsSample { readonly t: number }
export interface Track { readonly who?: string; readonly samples: readonly TrackSample[]; readonly world?: World; readonly radius?: number }
export interface Finding { readonly level: 'warn' | 'error'; readonly message: string; readonly fix: string }
export interface Critic { readonly name: 'spacing' | 'volume' | 'contact'; readonly limit: number; measure(track: Track): number; finding(value: number, who: string): Finding | null }
export const spacing: Critic;
export const volume: Critic;
export const contact: Critic;
export const PHYSICS_CRITICS: readonly Critic[];
export function trackOf<P extends AnyPlan>(plan: P | WrappedPlan<P>, sample: (plan: P, t: number) => PhysicsSample, options?: { rate?: number }): Track;
export const SPACING_LIMIT: number;
export const VOLUME_LIMIT: number;
export const CONTACT_LIMIT: number;
export const MOST_SAMPLES: number;

export function launch(from: Point, to: Point, options: { apex?: number; seconds?: number; gravity: number }, who?: string): { velocity: [number, number]; seconds: number };
export function flightAt(from: Point, velocity: Point, gravity: number, t: number): [number, number];
export function headingAt(velocity: Point, gravity: number, t: number): number;
export function fallSeconds(y0: number, vy: number, floor: number, gravity: number): number | null;
export const APEX_SHARE: number;
export const MIN_APEX: number;
export function bounces(from: Point, velocity: Point, options: { floor: number; gravity: number; restitution: number; keep: number; firstSeconds?: number | null }): { segments: readonly BounceSegment[]; impacts: readonly { at: number; speed: number }[]; rest: Point; duration: number };
export function bounceAt(plan: { segments: readonly BounceSegment[]; rest: Point; landed: number; gravity: number }, t: number): [number, number];
export const MIN_BOUNCE: number;
export const MOST_BOUNCES: number;
export function runChain(options: { pin: Point; path: readonly (readonly [number, number, number])[]; points: number[]; rest: number; gravity: number; keep: number; world: World; steps: number; settle: boolean }): { frames: readonly (readonly number[])[]; steps: number };
export function relax(points: number[], rest: number, pin: Point, passes?: number): number[];
export function pinAt(pin: Point, path: readonly (readonly [number, number, number])[], t: number): Point;
export const ITERATIONS: number;
export const REST_SPEED: number;
export const LENGTH_TOLERANCE: number;
export const MIN_LINK: number;
export function makeWorld(world: { floor?: number | null; boxes?: Box[] }, who?: string): World;
export function pushOut(x: number, y: number, world: World): [number, number];
export function collide(points: number[], world: World, from?: number): number[];
export function depthIn(x: number, y: number, world: World, radius?: number): number;
export const MOST_BOXES: number;
export function verletStep(now: readonly number[], before: readonly number[], accel: Point, dt: number, keep?: number): number[];
export function simulate<S extends { points: number[] }>(start: S, advance: (state: S, n: number) => S, options: { steps: number; every?: number; stop?: ((state: S, n: number) => boolean) | null }): { frames: readonly (readonly number[])[]; steps: number };
export const STEP: number;
export const EVERY: number;
export const GRAVITY: number;
export function settleLeft(t: number, feel?: Feel): number;
export function settleSeconds(feel?: Feel): number;
export function seededRandom(text: string): () => number;
export const FAR: number;
export const MOST_SECONDS: number;
