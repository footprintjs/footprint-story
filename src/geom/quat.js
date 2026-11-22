/**
 * Quaternions [w, x, y, z]: a turn in 3D with no gimbal lock. q and −q are the same turn.
 *
 *   quatFromAxisAngle(axis, angle)   the turn by `angle` (right hand) about `axis`
 *   quatMultiply(a, b)               b, then a (Hamilton's product)
 *   quatNormalize(q)                 length 1 again
 *   quatRotate(q, v)                 a 3D vector turned by q
 *   quatAngle(a, b)                  how far apart two turns are, 0..π: the one turn that takes a to b
 *   quatLook(forward, up?)           the turn that points a camera along `forward` with its top towards `up`
 *   quatForward(q)                   where a camera turned by q looks: its −z turned
 *   quatFromAxes(right, up, back)    the turn whose x, y, z axes land on these three
 *
 * The camera's own axes are the graphics ones: it looks along −z, x is the frame's right, y its top. WHY quaternions for a
 * camera: three angles (yaw, pitch, roll) lose a turn's axis looking straight up or down — gimbal lock — and blend badly;
 * a quaternion has neither fault (Shoemake 1985). Every angle uses atan2 of a sine and a cosine, never acos (see angles.js).
 */
import { cross, dot, numberOf, together, unit, vectorOf } from './vec.js';

const quatOf = (q, what) => vectorOf(q, [4], what);
/** How far from length 1 and right angles three axes may be and still be read as a turn: rounding, not a shear. */
const AXES_WITHIN = 1e-6;

/** q scaled to length 1. A quaternion of no length is no turn: refused. */
export function quatNormalize(q) {
  const [v] = together(quatOf(q, 'quatNormalize\'s q')), n = Math.hypot(...v);   // scaled first: the length of [1e308, …] overflows
  if (!(n > 0) || !Number.isFinite(n)) throw new TypeError('quatNormalize\'s q has no length: it is no turn');
  return v.map((c) => c / n);
}

/** The turn by `angle` radians about `axis` (right hand: thumb along the axis, fingers curl the way it turns). */
export function quatFromAxisAngle(axis, angle) {
  const n = unit(vectorOf(axis, [3], 'quatFromAxisAngle\'s axis')), half = numberOf(angle, 'quatFromAxisAngle\'s angle') / 2;
  if (!n) throw new TypeError('quatFromAxisAngle\'s axis has no length: a turn needs a line to turn about');
  const s = Math.sin(half);
  return [Math.cos(half), n[0] * s, n[1] * s, n[2] * s];
}

/** Hamilton's product a·b: the turn b, then the turn a. */
export function quatMultiply(a, b) {
  const [aw, ax, ay, az] = quatOf(a, 'quatMultiply\'s a'), [bw, bx, by, bz] = quatOf(b, 'quatMultiply\'s b');
  return [aw * bw - ax * bx - ay * by - az * bz, aw * bx + ax * bw + ay * bz - az * by, aw * by - ax * bz + ay * bw + az * bx, aw * bz + ax * by - ay * bx + az * bw];
}

/** The same turn backwards (for a unit quaternion, its inverse). */
export const conjugate = ([w, x, y, z]) => [w, -x, -y, -z];

/** A 3D vector turned by q (q is made unit length first): v + 2w(u×v) + 2u×(u×v), u the vector part. */
export function quatRotate(q, v) {
  const [w, x, y, z] = quatNormalize(q), p = vectorOf(v, [3], 'quatRotate\'s v'), u = [x, y, z];
  const t = cross(u, p).map((c) => 2 * c), s = cross(u, t);
  return [p[0] + w * t[0] + s[0], p[1] + w * t[1] + s[1], p[2] + w * t[2] + s[2]];
}

/** How far apart two turns are, in radians from 0 to π: the angle of the one turn taking a to b. q and −q are 0 apart. */
export function quatAngle(a, b) {
  const d = quatMultiply(conjugate(quatNormalize(a)), quatNormalize(b));
  return 2 * Math.atan2(Math.hypot(d[1], d[2], d[3]), Math.abs(d[0]));
}

/**
 * The turn whose x, y and z axes land on `right`, `up` and `back` (an orthonormal right-handed frame: back = right × up),
 * read from its rotation matrix by Shepperd's method — the largest of four sums first, so no division by a small number.
 */
export function quatFromAxes(right, up, back) {
  const r0 = vectorOf(right, [3], 'quatFromAxes\' right'), u0 = vectorOf(up, [3], 'quatFromAxes\' up'), b0 = vectorOf(back, [3], 'quatFromAxes\' back');
  // a turn keeps lengths, right angles and handedness: anything else is not a turn, and the matrix read would mean nothing
  const off = Math.max(...[r0, u0, b0].map((v) => Math.abs(Math.hypot(...v) - 1)), Math.abs(dot(r0, u0)), Math.abs(dot(u0, b0)), Math.abs(dot(r0, b0)));
  if (off > AXES_WITHIN) throw new TypeError(`quatFromAxes takes three axes of length 1 at right angles — these are ${off.toPrecision(3)} off`);
  if (dot(cross(r0, u0), b0) < 0) throw new TypeError('quatFromAxes takes a right-handed frame (back = right × up): these three are a mirror, which no turn makes');
  const [m00, m10, m20] = r0, [m01, m11, m21] = u0, [m02, m12, m22] = b0;
  const trace = m00 + m11 + m22, sums = [trace, m00 - m11 - m22, m11 - m00 - m22, m22 - m00 - m11], big = sums.indexOf(Math.max(...sums));
  const r = Math.sqrt(1 + sums[big]) * 2;
  const q = big === 0 ? [r / 4, (m21 - m12) / r, (m02 - m20) / r, (m10 - m01) / r]
    : big === 1 ? [(m21 - m12) / r, r / 4, (m01 + m10) / r, (m02 + m20) / r]
      : big === 2 ? [(m02 - m20) / r, (m01 + m10) / r, r / 4, (m12 + m21) / r]
        : [(m10 - m01) / r, (m02 + m20) / r, (m12 + m21) / r, r / 4];
  return quatNormalize(q);
}

/**
 * The turn that points a camera along `forward` with its top as near `up` (world +y unless given) as it can be: the camera's
 * horizon level. Looking straight along `up` there is no level: it takes the side nearest +x (or +z when forward lies along
 * x), so the answer is the same every time.
 */
export function quatLook(forward, up = [0, 1, 0]) {
  const f = unit(vectorOf(forward, [3], 'quatLook\'s forward')), u = unit(vectorOf(up, [3], 'quatLook\'s up'));
  if (!f || !u) throw new TypeError('quatLook takes a forward and an up with some length');
  let right = unit(cross(f, u));
  if (!right || Math.hypot(...cross(f, u)) < 1e-12) {
    const hint = Math.abs(f[0]) < 0.9 ? [1, 0, 0] : [0, 0, 1], along = dot(hint, f);
    right = unit(hint.map((c, i) => c - along * f[i]));
  }
  return quatFromAxes(right, cross(right, f), f.map((c) => -c));
}

/** Where a camera turned by q looks: its −z axis, turned. */
export const quatForward = (q) => quatRotate(q, [0, 0, -1]);

/** log of a unit quaternion: [0, θ n] for the half-angle θ about n. */
export function quatLog([w, x, y, z]) {
  const s = Math.hypot(x, y, z), theta = Math.atan2(s, w), k = s > 1e-300 ? theta / s : 1;
  return [0, x * k, y * k, z * k];
}

/** exp of a pure quaternion [0, v]: [cos |v|, sin |v| v/|v|]. */
export function quatExp([, x, y, z]) {
  const a = Math.hypot(x, y, z), k = a > 1e-300 ? Math.sin(a) / a : 1;
  return [Math.cos(a), x * k, y * k, z * k];
}
