/**
 * How sharply a line bends at each of its points: the curvature (1 over the radius of the circle through a point and
 * its two neighbours — Menger's curvature, 4 · the triangle's area / the product of its sides), per px. WHY three
 * points: a sampled line has no derivatives, and the circle through neighbours is exact on a circle and needs no
 * smoothing. An end has one neighbour, so it takes the curvature next to it.
 *
 * A turn past a right angle is read as at least the bend of the tightest circle its shorter side allows,
 * 2 · cos(half the angle at the point) / the shorter side — which is what the circle gives when the two sides are equal,
 * and 2 / the shorter side for a full reversal. WHY: the circle through a point and two neighbours that lie back on one
 * line (a hairpin, [[0, 0], [10, 0], [0, 0]]) has no radius, and reading it as straight would send a pen round the
 * sharpest turn there is at full speed.
 */
import { readPoints } from '../read.js';

/** The curvature at each point of a line ([[x, y], …]), from 0 (straight) up; a line of two points is straight. */
export function curvatures(points) {
  points = readPoints(points, "curvatures' points", { least: 1, most: 16384 });
  const n = points.length, out = new Array(n).fill(0);
  for (let i = 1; i < n - 1; i += 1) {
    const [a, b, c] = [points[i - 1], points[i], points[i + 1]];
    const ab = Math.hypot(b[0] - a[0], b[1] - a[1]), bc = Math.hypot(c[0] - b[0], c[1] - b[1]), ca = Math.hypot(a[0] - c[0], a[1] - c[1]);
    const cross = Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
    if (!(ab > 0 && bc > 0)) continue;   // a point on its neighbour bends nothing
    const menger = ca > 0 ? (2 * cross) / (ab * bc * ca) : 0;
    const dot = (b[0] - a[0]) * (c[0] - b[0]) + (b[1] - a[1]) * (c[1] - b[1]);
    // past a right angle: cos(half the angle at b) = √((1 + cos B) / 2), where cos B = −dot / (ab · bc)
    out[i] = dot < 0 ? Math.max(menger, (2 * Math.sqrt(Math.max(0, (1 - dot / (ab * bc)) / 2))) / Math.min(ab, bc)) : menger;
  }
  if (n > 2) { out[0] = out[1]; out[n - 1] = out[n - 2]; }
  return Object.freeze(out);
}

/**
 * The curvature at each point after each point is averaged with the `k` either side: the bend a hand follows, not the
 * kinks a few px wide (a tremor, a sharp joint between sampled pieces). Read this way no bend is tighter than a circle
 * as wide as the half-width averaged over (k times the points' mean spacing), so each point's curvature is held there
 * (a hairpin is that greatest bend, never a spike where the averaged points bunch at its tip), and then averaged over
 * the same k either side, so a fold spreads over the width it stands for. The pen model and the `pen-speed` critic
 * both read curvature this way, over the same width in px and the same 2 px step, so the law they share is the law
 * they measure.
 */
export function curvaturesOver(points, k) {
  points = readPoints(points, "curvaturesOver's points", { least: 1, most: 16384 });
  const n = points.length, sx = [0], sy = [0];
  let length = 0;
  for (let i = 0; i < n; i += 1) {
    sx.push(sx[i] + points[i][0]); sy.push(sy[i] + points[i][1]);
    if (i) length += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  }
  const most = n > 1 && length > 0 ? (2 * (n - 1)) / (k * length) : Infinity;
  const avg = points.map((_, i) => { const lo = Math.max(0, i - k), hi = Math.min(n - 1, i + k), c = hi - lo + 1; return [(sx[hi + 1] - sx[lo]) / c, (sy[hi + 1] - sy[lo]) / c]; });
  const out = curvatures(avg).map((v) => Math.min(v, most));
  // the bends averaged over the same points: a fold the averaging squeezed into one point spreads over the width it
  // stands for, and where exactly the samples fall no longer decides whether it is seen
  const sum = [0];
  for (const v of out) sum.push(sum[sum.length - 1] + v);
  return Object.freeze(out.map((_, i) => { const lo = Math.max(0, i - k), hi = Math.min(n - 1, i + k); return (sum[hi + 1] - sum[lo]) / (hi - lo + 1); }));
}
