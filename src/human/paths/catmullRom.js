/**
 * A smooth line through points: a centripetal Catmull-Rom spline (alpha 0.5), in Barry and Goldman's pyramid form.
 * WHY centripetal: the uniform kind loops and the chordal kind can cusp where points crowd; the centripetal one never
 * makes a cusp or a loop within a stretch and keeps close to the points (Yuksel, Schaefer & Keyser 2011). It passes
 * through every point it is given, exactly.
 *
 * The ends: a point mirrored past each end (2·p0 − p1) stands in for the neighbour there is none of. Points that sit on
 * one another are taken once (a stretch of no length has no direction). Each stretch is cut into pieces about `spacing`
 * px long (4 unless given), at most 1024 a stretch.
 */
import { refuse, shown, readPoints } from '../read.js';

export const MOST_CURVE_POINTS = 16384;

/** One point of the stretch from p1 to p2 (p0 and p3 its neighbours) at its own parameter t between t1 and t2. */
function pyramid(p0, p1, p2, p3, t0, t1, t2, t3, t) {
  const mix = (a, b, ta, tb) => { const w = (t - ta) / (tb - ta); return [a[0] + (b[0] - a[0]) * w, a[1] + (b[1] - a[1]) * w]; };
  const a1 = mix(p0, p1, t0, t1), a2 = mix(p1, p2, t1, t2), a3 = mix(p2, p3, t2, t3);
  return mix(mix(a1, a2, t0, t2), mix(a2, a3, t1, t3), t1, t2);
}

/** The points taken once each where they sit on one another (within 1e-9 px). */
export function distinct(points) {
  const out = [points[0]];
  for (let i = 1; i < points.length; i += 1) { const p = out[out.length - 1]; if (Math.hypot(points[i][0] - p[0], points[i][1] - p[1]) > 1e-9) out.push(points[i]); }
  return out;
}

/**
 * The line through `points` ([[x, y], …], 2 to 4096), as points about `spacing` px apart, each given point
 * among them exactly. `alpha` 0.5 is the centripetal kind (0 the uniform, 1 the chordal). Two points give the straight line.
 */
export function catmullRom(points, { spacing = 4, alpha = 0.5 } = {}) {
  if (!(spacing >= 0.25 && spacing <= 10000)) refuse(`a curve's spacing is from 0.25 to 10000 px — not ${shown(spacing)}`);
  if (!(alpha >= 0 && alpha <= 1)) refuse(`a Catmull-Rom alpha is from 0 to 1 (0.5: centripetal) — not ${shown(alpha)}`);
  const p = distinct(readPoints(points, "catmullRom's points", { least: 2, most: 4096 })), n = p.length;
  if (n < 2) refuse('a curve goes through at least two points that are not on one another');
  const ext = [[2 * p[0][0] - p[1][0], 2 * p[0][1] - p[1][1]], ...p, [2 * p[n - 1][0] - p[n - 2][0], 2 * p[n - 1][1] - p[n - 2][1]]];
  const knot = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]) ** alpha;
  const out = [];
  for (let i = 0; i < n - 1; i += 1) {
    const [p0, p1, p2, p3] = ext.slice(i, i + 4);
    const t0 = 0, t1 = t0 + knot(p0, p1), t2 = t1 + knot(p1, p2), t3 = t2 + knot(p2, p3);
    const steps = Math.max(1, Math.min(1024, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / spacing)));
    out.push(p1);
    for (let k = 1; k < steps; k += 1) out.push(pyramid(p0, p1, p2, p3, t0, t1, t2, t3, t1 + ((t2 - t1) * k) / steps));
    if (out.length > MOST_CURVE_POINTS) refuse(`a curve of more than ${MOST_CURVE_POINTS} points — give a larger spacing, or fewer points`);
  }
  out.push(p[n - 1]);
  return Object.freeze(out.map((q) => Object.freeze([q[0], q[1]])));
}
