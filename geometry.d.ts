/**
 * footprint-story/geometry — angles, turns and places on a sphere, as numbers. Pure: runs anywhere, imports nothing.
 * Every function refuses what is not a finite number, or a list of the right length, with a TypeError that names it.
 */

export type Vector = readonly [number, number, number];

/** A quaternion [w, x, y, z]: a turn in 3D. q and −q are the same turn. */
export type Quat = readonly [number, number, number, number];
export type Point = readonly [number, number] | readonly [number, number, number];

/** The angle at b in a–b–c, radians 0..π, all 2D or all 3D; null when a or c sits on b. */
export function angleAt(a: Point, b: Point, c: Point): number | null;
/** The twist about b→c from a's side to d's, radians −π..π (IUPAC's sign: right hand about b→c); null when three of them are in a line. */
export function dihedral(a: Vector, b: Vector, c: Vector, d: Vector): number | null;
/** The same angle in (−π, π]. */
export function wrapAngle(angle: number): number;
/** The smallest turn from one angle to another, (−π, π]; exactly half a turn is +π. */
export function shortestTurn(from: number, to: number): number;
/** The angles moved by whole turns so no step between neighbours is past half a turn; the first is kept. */
export function unwrapAngles(angles: readonly number[]): number[];

/** The turn by `angle` radians (right hand) about `axis`. */
export function quatFromAxisAngle(axis: Vector, angle: number): Quat;
/** Hamilton's product: b, then a. */
export function quatMultiply(a: Quat, b: Quat): Quat;
/** Length 1 again. A quaternion of no length is refused. */
export function quatNormalize(q: Quat): Quat;
/** A vector turned by q. */
export function quatRotate(q: Quat, v: Vector): Vector;
/** How far apart two turns are, radians 0..π. */
export function quatAngle(a: Quat, b: Quat): number;
/** The turn pointing a camera (it looks along −z, x right, y up) along `forward` with its horizon level to `up` (+y). */
export function quatLook(forward: Vector, up?: Vector): Quat;
/** Where a camera turned by q looks. */
export function quatForward(q: Quat): Vector;
/** The turn whose x, y, z axes land on right, up, back (orthonormal). */
export function quatFromAxes(right: Vector, up: Vector, back: Vector): Quat;
/** The turn s of the way from a to b, at constant angular speed, the shorter way (Shoemake 1985). */
export function slerp(a: Quat, b: Quat, s: number): Quat;
/** A smooth turn through the keys (2 or more), passing each: key i at s = i / (keys − 1) (Shoemake's squad). */
export function squad(keys: readonly Quat[], s: number): Quat;

/** A place round a point, as the shot camera holds it: azimuth from +z towards +x, elevation up, +y up. */
export interface Spherical { readonly azimuth: number; readonly elevation: number; readonly distance: number }
export function toSpherical(v: Vector): Spherical;
export function fromSpherical(place: Spherical): Vector;
/** The unit direction s of the way from a to b on their great circle; opposite directions go over the top. */
export function greatCircle(a: Vector, b: Vector, s: number): Vector;
/** The turn aiming a camera at `eye` towards `target`, its horizon level; null when they meet. */
export function lookAt(eye: Vector, target: Vector, up?: Vector): Quat | null;
/** How far the horizon leans, radians (positive: the frame's right side raised); null looking straight up or down. */
export function horizonRoll(q: Quat): number | null;

