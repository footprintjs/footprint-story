/**
 * How sharply a line bends at each of its points: the curvature (1 over the radius of the circle through a point and
 * its two neighbours — Menger's curvature, 4 · the triangle's area / the product of its sides), per px. WHY three
 * points: a sampled line has no derivatives, and the circle through neighbours is exact on a circle and needs no
 * smoothing. An end has one neighbour, so it takes the curvature next to it.
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
    out[i] = ab > 0 && bc > 0 && ca > 0 ? (2 * cross) / (ab * bc * ca) : 0;
  }
  if (n > 2) { out[0] = out[1]; out[n - 1] = out[n - 2]; }
  return Object.freeze(out);
}

/**
 * The curvature at each point after each point is averaged with the `k` either side: the bend a hand follows, not the
 * kinks a few px wide (a tremor, a sharp joint between sampled pieces). The pen model and the `pen-speed` critic both
 * read curvature this way, over the same width in px, so the law they share is the law they measure.
 */
export function curvaturesOver(points, k) {
  points = readPoints(points, "curvaturesOver's points", { least: 1, most: 16384 });
  const n = points.length, sx = [0], sy = [0];
  for (const p of points) { sx.push(sx[sx.length - 1] + p[0]); sy.push(sy[sy.length - 1] + p[1]); }
  return curvatures(points.map((_, i) => { const lo = Math.max(0, i - k), hi = Math.min(n - 1, i + k), c = hi - lo + 1; return [(sx[hi + 1] - sx[lo]) / c, (sy[hi + 1] - sy[lo]) / c]; }));
}
