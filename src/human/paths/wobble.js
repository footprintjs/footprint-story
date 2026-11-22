/**
 * A tremor laid across a line, never larger than the room beside it. Shared by the `power-law` pen
 * (models/powerLawPen.js) and the hand-drawn strokes (strokes/pen.js, strokes/boil.js), so the cap is one rule.
 *
 *   wobbleRooms(gaps, k, amplitude)                                → the room for a wobble at each point
 *   wobbleAcross(points, along, length, knots, rooms, {amplitude, wavelength}) → {xs, ys}: the line moved across itself
 *
 * WHY a room: a wobble wider than the space it wobbles in makes two legs a pixel apart cross and knot, and a hatch line
 * near its polygon's edge leave the polygon. The caller says what the room is (half the gap to another leg of the line,
 * paths/gap.js · legGaps; a hatch line adds its distance to the edge it is clipped by).
 */
import { tremorAt } from '../laws/tremor.js';

/**
 * The room for a wobble at each point: the narrowest half-gap within 2k points either side (never more than the
 * amplitude: more room changes nothing), averaged over k either side. Every point the average reads looked as far as
 * this one, so the room is never more than half this point's own gap — and it eases in and out, never jumps.
 */
export function wobbleRooms(gaps, k, amplitude) {
  const n = gaps.length, least = gaps.map((_, i) => { let m = amplitude; for (let j = Math.max(0, i - 2 * k); j <= Math.min(n - 1, i + 2 * k); j += 1) m = Math.min(m, gaps[j] / 2); return m; });
  return least.map((_, i) => { let sum = 0, c = 0; for (let j = Math.max(0, i - k); j <= Math.min(n - 1, i + k); j += 1) { sum += least[j]; c += 1; } return sum / c; });
}

/**
 * The line's points moved across it by the tremor: at each point along the left normal of the chord through its
 * neighbours (y down), scaled by its room over the amplitude — scaled, never clipped: a clipped swing has corners, and
 * a corner is a bend. `rooms` null: no cap.
 */
export function wobbleAcross(points, along, length, knots, rooms, { amplitude, wavelength }) {
  const xs = [], ys = [];
  points.forEach((p, i) => {
    const a = points[Math.max(0, i - 1)], b = points[Math.min(points.length - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
    const wobble = tremorAt(knots, along[i], length, { amplitude, wavelength }), room = rooms ? rooms[i] : Infinity;
    const off = len > 0 ? (wobble * Math.min(1, room / amplitude)) / len : 0;
    xs.push(p[0] + dy * off); ys.push(p[1] - dx * off);
  });
  return { xs, ys };
}
