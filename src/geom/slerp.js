/**
 * Moving between turns at an even speed.
 *
 *   slerp(a, b, s)    the turn s of the way from a to b, at constant angular speed, by the shorter way round (Shoemake 1985)
 *   squad(keys, s)    a smooth turn through several keys, passing through each, s from 0 to 1 spread evenly over the gaps
 *                     (Shoemake 1987's spherical quadrangle: slerp's cubic, C¹ at every key)
 *
 * WHY slerp and not a blend of angles: blending yaw, pitch and roll speeds up and slows down, and near straight up it
 * swings wildly; slerp turns at one speed about one axis. Near-parallel turns (less than 1e-6 apart) blend in a line and are
 * made unit length again: at 0 apart the sines would divide 0 by 0, and below 1e-6 the line blend differs from slerp by
 * about ω²/8 of ω, under 1e-13 — the threshold is a guard, not a tuning.
 */
import { conjugate, quatExp, quatLog, quatMultiply, quatNormalize } from './quat.js';
import { numberOf } from './vec.js';

const NEAR = 1e-6;
const dot4 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];

/** slerp of two unit quaternions as given, with no turn round to the shorter way (squad needs the long way kept). */
function slerpAsGiven(a, b, s) {
  if (s === 0) return a;
  if (s === 1) return b;
  // the angle between them, from both the sum and the difference: exact near 0 and near π alike
  const omega = 2 * Math.atan2(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2], a[3] - b[3]), Math.hypot(a[0] + b[0], a[1] + b[1], a[2] + b[2], a[3] + b[3]));
  if (omega < NEAR) return quatNormalize(a.map((c, i) => c + (b[i] - c) * s));
  const sin = Math.sin(omega), p = Math.sin((1 - s) * omega) / sin, q = Math.sin(s * omega) / sin;
  return quatNormalize(a.map((c, i) => c * p + b[i] * q));
}

/** The turn s of the way from a to b (both made unit length), by the shorter way: at s = 1 it is b, or −b, the same turn. */
export function slerp(a, b, s) {
  const p = quatNormalize(a), q0 = quatNormalize(b), t = numberOf(s, 'slerp\'s s');
  return slerpAsGiven(p, dot4(p, q0) < 0 ? q0.map((c) => -c) : q0, t);
}

const MOST_KEYS = 4096;

/** Keys made unit length, each on the same side as the one before (q and −q are one turn; the path must not jump). */
function alignedKeys(keys) {
  if (!Array.isArray(keys) || keys.length < 2 || keys.length > MOST_KEYS) throw new TypeError(`squad takes a list of 2 to ${MOST_KEYS} quaternions`);
  const out = [];
  keys.forEach((k, i) => { let q = quatNormalize(k); if (i && dot4(q, out[i - 1]) < 0) q = q.map((c) => -c); out.push(q); });
  return out;
}

/** The inner control of key i: qᵢ·exp(−(log(qᵢ⁻¹qᵢ₊₁) + log(qᵢ⁻¹qᵢ₋₁)) / 4). The end keys are their own. */
function control(q, i) {
  if (i === 0 || i === q.length - 1) return q[i];
  const inv = conjugate(q[i]), next = quatLog(quatMultiply(inv, q[i + 1])), prev = quatLog(quatMultiply(inv, q[i - 1]));
  return quatNormalize(quatMultiply(q[i], quatExp(next.map((c, k) => -(c + prev[k]) / 4))));
}

/**
 * The turn s of the way through `keys` (s from 0 to 1; key i at s = i / (keys − 1)), on Shoemake's squad:
 * squad(qᵢ, qᵢ₊₁, sᵢ, sᵢ₊₁, h) = slerp(slerp(qᵢ, qᵢ₊₁, h), slerp(sᵢ, sᵢ₊₁, h), 2h(1 − h)). Two keys give slerp.
 */
export function squad(keys, s) {
  const q = alignedKeys(keys), t = numberOf(s, 'squad\'s s'), gaps = q.length - 1;
  const at = Math.min(1, Math.max(0, t)) * gaps, i = Math.min(gaps - 1, Math.floor(at)), h = at - i;
  if (h === 0) return q[i];
  const c0 = control(q, i), c1 = control(q, i + 1);
  return slerpAsGiven(slerpAsGiven(q[i], q[i + 1], h), slerpAsGiven(c0, c1, h), 2 * h * (1 - h));
}
