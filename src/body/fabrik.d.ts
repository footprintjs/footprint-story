/**
 * src/body/fabrik.js — FABRIK (Aristidou & Lasenby 2011; with windows, Aristidou, Chrysanthou & Lasenby 2016): a planar
 * chain of 2 to 16 parts reaching for a point. Pure; the answer is frozen plain data. For the body door to re-export
 * (`export * from './src/body/fabrik.js'`, these types read beside it).
 */

/** A point [x, y] on the frame, px, y down. */
export type FabrikPoint = readonly [number, number];
/** A window [min, max] on a part's relative angle, radians: each end within [−2π, 2π], min ≤ max, less than 2π wide. */
export type FabrikWindow = readonly [number, number];

export interface FabrikChain {
  /** The start pose's joints, the root first and the chain's end last: 3 to 17 points. */
  points: readonly FabrikPoint[];
  /** Where the end should go. */
  target: FabrikPoint;
  /** Each part's length, px, above 0 and at most 10,000 (left out: the start points' own distances). */
  lengths?: readonly number[];
  /** One window or null a part, on its angle relative to its parent (the first part's parent: `parentAngle`). */
  limits?: readonly (FabrikWindow | null)[];
  /** The world angle, radians, of the part the chain hangs from (0: along +x). */
  parentAngle?: number;
  /** The most passes, 1 to 16 (16). */
  passes?: number;
}

export interface FabrikResult {
  /** The solved joints; the root where it was given, every part its length. */
  readonly points: readonly FabrikPoint[];
  /** Each part's relative angle: in its window when it has one, else the turn nearest the start pose's. */
  readonly angles: readonly number[];
  /** The end under 0.1 px from the target. */
  readonly reached: boolean;
  /** How far the end stayed from the target, px. */
  readonly miss: number;
  /** The passes run: 0 for a target out of reach with no limits (the chain laid straight toward it). */
  readonly passes: number;
  /** The parts (by index) whose window held them in the last pass, in order. */
  readonly bound: readonly number[];
}

/** Solve a chain for its target. Refuses (an Error starting `body: fabrik's`) what §10 of the bodies design bounds. */
export function fabrik(chain: FabrikChain): FabrikResult;
