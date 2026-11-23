/**
 * footprint-story/body — a body as data: a rig, a pose, forward kinematics, the centre of mass, joint limits, the facing
 * mirror and two-bone IK. Pure: runs anywhere, imports nothing. Every refusal is an Error whose message starts `body:`
 * and names the entry and the fix; a getter is never run. Every answer is frozen plain data.
 * Angles are radians on the frame, y down (a positive turn is clockwise on screen), 0 along +x.
 */

export type Point = readonly [number, number];
export type Layer = 'near' | 'mid' | 'far';

/** A part owns the joint at its start; it starts at its parent's end. `rest` and `limit` are relative to the parent,
 *  written for a body facing +x. */
export interface Part {
  readonly name: string;
  /** null for the root, which has no joint (its turn is the pose's turn); else a part listed before it. */
  readonly parent: string | null;
  /** px; the root may be 0, every other part above 0, at most 10,000. */
  readonly length: number;
  /** Inside the limit when there is one; 0 when left out; the root's is 0. */
  readonly rest?: number;
  /** [min, max] within ±2π, min ≤ max, narrower than 2π; left out, the joint turns freely. */
  readonly limit?: readonly [number, number] | null;
  readonly width?: number;
  readonly layer?: Layer;
  /** A share: the rig scales them to sum to 1. */
  readonly mass: number;
}

export interface TwoBoneChain { readonly name: string; readonly parts: readonly [string, string]; readonly solver: 'two-bone'; readonly bend: 'front' | 'back' }
export interface FabrikChain { readonly name: string; readonly parts: readonly string[]; readonly solver: 'fabrik' }
export type Chain = TwoBoneChain | FabrikChain;

/** A rig as written. */
export interface RigInput {
  readonly name: string;
  readonly plane?: 'side';
  /** 1 looks along +x (the default), −1 along −x: every relative angle and limit mirrored. */
  readonly facing?: 1 | -1;
  readonly root?: string;
  /** The ankle's height above the floor while a foot is down, px. */
  readonly footHeight?: number;
  readonly parts: readonly Part[];
  readonly chains?: readonly Chain[];
  readonly feet?: readonly string[];
  readonly loose?: readonly string[];
}

/** A rig as readRig made it: every field present, mass shares summing to 1, frozen. */
export interface Rig {
  readonly name: string;
  readonly plane: 'side';
  readonly facing: 1 | -1;
  readonly root: string;
  readonly footHeight: number;
  readonly parts: readonly {
    readonly name: string; readonly parent: string | null; readonly length: number; readonly rest: number;
    readonly limit: readonly [number, number] | null; readonly width: number; readonly layer: Layer; readonly mass: number;
  }[];
  readonly chains: readonly Chain[];
  readonly feet: readonly string[];
  readonly loose: readonly string[];
}

/** `turn` is the root's world angle; `angles` each part's angle relative to its parent, in rig order (the root's 0). */
export interface Pose { readonly root: Point; readonly turn: number; readonly angles: readonly number[] }
export interface PlacedPart { readonly name: string; readonly start: Point; readonly end: Point; readonly angle: number }
export interface Clamped { readonly part: string; readonly by: number }
export interface Moved { readonly chain: string; readonly by: number }
export interface ClampResult { readonly pose: Pose; readonly clamped: readonly Clamped[]; readonly moved: readonly Moved[] }
export interface TwoBoneResult extends ClampResult { readonly miss: number; readonly stretched: boolean; readonly folded: boolean }

export declare const MOST_PARTS: 64;
export declare const MOST_CHAIN: 16;
export declare const MOST_LENGTH: 10000;
/** A target in reach is met within REACH_TOLERANCE × (l1 + l2), before any limit clamps. */
export declare const REACH_TOLERANCE: 1e-9;

/** The rig checked and frozen. */
export function readRig(rig: RigInput | Rig): Rig;
/** The usual person from a height in px (1 to 10,000): Drillis & Contini's lengths, Dempster's masses (Winter). `build`
 *  scales the widths only (0.5 to 2). */
export function humanRig(options: { readonly name: string; readonly height: number; readonly build?: number; readonly facing?: 1 | -1 }): Rig;
/** Every part at rest, the root at `root` ([0, 0]); facing −1 mirrored. */
export function restPose(rig: RigInput | Rig, options?: { readonly root?: Point }): Pose;
/** Forward kinematics: each part's start, end and world angle, in rig order. World angles are never wrapped. */
export function placeParts(rig: RigInput | Rig, pose: Pose): readonly PlacedPart[];
/** The centre of mass of placed parts (each share at its part's middle). */
export function centreOf(rig: RigInput | Rig, placed: readonly { readonly start: Point; readonly end: Point; readonly name?: string }[]): Point;
/** The angle plus the multiple of 2π nearest the window's middle (not clamped); one inside comes back unchanged. */
export function windowAngle(angle: number, limit: readonly [number, number]): number;
/** Every relative angle read in its window as the rig faces and clamped into it; what moved, reported. */
export function clampPose(rig: RigInput | Rig, pose: Pose): ClampResult;
/** The pose mirrored about the vertical through its root: turn → π − turn, every angle → −angle. */
export function mirrorPose(rig: RigInput | Rig, pose: Pose): Pose;
/** A two-bone chain's two angles solved so its point reaches `target`, then the pose clamped. */
export function twoBone(rig: RigInput | Rig, pose: Pose, chain: string, target: Point): TwoBoneResult;
