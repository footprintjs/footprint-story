/**
 * Angles between points, and angles as numbers that wrap round.
 *
 *   angleAt(a, b, c)        the angle at b in a–b–c, 0..π, in 2D or 3D; null when a or c sits on b
 *   dihedral(a, b, c, d)    the twist about b→c from a's side to d's, −π..π, signed (IUPAC); null when a, b, c or b, c, d are in a line
 *   wrapAngle(θ)            the same angle in (−π, π]
 *   shortestTurn(from, to)  the smallest turn from one angle to another, (−π, π]; half a turn goes the positive way
 *   unwrapAngles(list)      a list of angles with no jump past half a turn between neighbours: a path that turns smoothly
 *
 * WHY atan2 and never acos: acos loses half its digits near 0 and π (a hinge almost straight, a joint almost shut), while
 * atan2 of the cross and dot products keeps them all. Each vector is made unit length first, so a huge or tiny scene
 * neither overflows nor underflows.
 */
import { cross, dot, numberOf, sub, together, unit, vectorOf } from './vec.js';

const TURN = 2 * Math.PI;

/** The angle at b between the rays b→a and b→c, in radians from 0 to π. Points are all 2D or all 3D. */
export function angleAt(a, b, c) {
  const [p, q, r] = together(vectorOf(a, [2, 3], 'angleAt\'s a'), vectorOf(b, [a.length], 'angleAt\'s b'), vectorOf(c, [a.length], 'angleAt\'s c'));
  const u = unit(sub(p, q)), v = unit(sub(r, q));
  if (!u || !v) return null;
  const across = u.length === 2 ? Math.abs(u[0] * v[1] - u[1] * v[0]) : Math.hypot(...cross(u, v));
  return Math.atan2(across, dot(u, v));
}

/**
 * The dihedral (torsion) angle of four 3D points: how far the plane a–b–c is turned about the line b→c to reach the plane
 * b–c–d, in radians from −π to π. Positive is the right-hand turn about b→c (IUPAC's sign: seen along b→c, a–b turns
 * clockwise to cover c–d). The formula is atan2(|b₂| b₁·(b₂×b₃), (b₁×b₂)·(b₂×b₃)), with bᵢ the three bonds.
 */
export function dihedral(a, b, c, d) {
  const [p, q, r, s] = together(...[a, b, c, d].map((v, i) => vectorOf(v, [3], `dihedral's ${'abcd'[i]}`)));
  const b1 = unit(sub(q, p)), b2 = unit(sub(r, q)), b3 = unit(sub(s, r));
  if (!b1 || !b2 || !b3) return null;
  const n1 = cross(b1, b2), n2 = cross(b2, b3);
  // a bond along b→c leaves no plane: the twist is not defined (1e-12: below this the sine is rounding, not a plane)
  if (Math.hypot(...n1) < 1e-12 || Math.hypot(...n2) < 1e-12) return null;
  return Math.atan2(dot(b1, n2), dot(n1, n2));
}

/** The same angle, in (−π, π]. */
export function wrapAngle(angle) {
  numberOf(angle, 'wrapAngle\'s angle');
  let r = (angle + Math.PI) % TURN;
  if (r < 0) r += TURN;
  r -= Math.PI;
  return r <= -Math.PI ? Math.PI : r;
}

/** The smallest turn from `from` to `to`, in (−π, π]: add it to `from` to face `to`. Exactly half a turn is +π. */
export const shortestTurn = (from, to) => wrapAngle(numberOf(to, 'shortestTurn\'s to') - numberOf(from, 'shortestTurn\'s from'));

/** The angles again, each moved by whole turns so no step between neighbours is more than half a turn. The first is kept. */
export function unwrapAngles(angles) {
  if (!Array.isArray(angles) || angles.length > 1e6) throw new TypeError('unwrapAngles takes a list of at most 1e6 angles');
  const out = [];
  angles.forEach((v, i) => { numberOf(v, `unwrapAngles' angles[${i}]`); out.push(i ? out[i - 1] + wrapAngle(v - angles[i - 1]) : v); });
  return out;
}
