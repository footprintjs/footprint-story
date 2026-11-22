/**
 * Where the pen is at t, on a planned sketch (plan.js): drawing a stroke, or in the air between two.
 *
 *   sampleSketch(plan, t) → {x, y, width, down, stroke, progress}
 *
 * `down` is 1 while the pen draws and 0 in the air; `width` the line it lays down there (0 in the air); `stroke` the
 * index of the stroke it is drawing or has just drawn; `progress` the share of all the strokes' length drawn so far.
 * In the air the pen goes from one stroke's end to the next's start by minimum jerk (src/timing/minJerk.js): a reach.
 * Before 0 it waits at the first point; from the end on it rests on the last, the pen still down.
 */
import { indexAt } from '../paths/arcLength.js';
import { minJerk } from '../../timing/minJerk.js';

/** The index of the last stroke that started at or before t. */
function strokeAt(strokes, t) {
  let lo = 0, hi = strokes.length - 1;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (strokes[mid].start <= t) lo = mid; else hi = mid - 1; }
  return lo;
}

/** Where the pen is at t (seconds from the sketch's start): frozen. */
export function sampleSketch(plan, t) {
  return Object.freeze(penAt(plan, t));
}

function penAt(plan, t) {
  const { strokes } = plan, total = strokes.reduce((s, x) => s + x.length, 0);
  const drawnBefore = (i) => strokes.slice(0, i).reduce((s, x) => s + x.length, 0);
  const at = (s, i, f, k) => {
    const j = Math.min(i + 1, s.xs.length - 1);
    return { x: s.xs[i] + (s.xs[j] - s.xs[i]) * f, y: s.ys[i] + (s.ys[j] - s.ys[i]) * f, width: s.ws[i] + (s.ws[j] - s.ws[i]) * f, down: 1, stroke: k };
  };
  if (!(t > strokes[0].start)) return { ...at(strokes[0], 0, 0, 0), progress: 0 };
  const k = strokeAt(strokes, t), s = strokes[k], end = s.start + s.seconds, last = s.xs.length - 1;
  if (t <= end || k === strokes.length - 1) {
    if (t >= end && k === strokes.length - 1) return { ...at(s, last, 0, k), progress: 1 };
    const i = Math.min(indexAt(s.ts, t), last - 1), span = s.ts[i + 1] - s.ts[i], f = span > 0 ? (t - s.ts[i]) / span : 0;
    // how far along the stroke: along its line before the tremor, to point i and the share f of the step after it
    let along = 0;
    for (let j = 1; j <= i; j += 1) along += Math.hypot(s.sx[j] - s.sx[j - 1], s.sy[j] - s.sy[j - 1]);
    along += f * Math.hypot(s.sx[i + 1] - s.sx[i], s.sy[i + 1] - s.sy[i]);
    return { ...at(s, i, f, k), progress: total > 0 ? (drawnBefore(k) + along) / total : 1 };
  }
  // in the air, from this stroke's end to the next one's start
  const next = strokes[k + 1], u = minJerk(Math.min(1, (t - end) / Math.max(next.start - end, 1e-12)));
  const x0 = s.xs[last], y0 = s.ys[last];
  return { x: x0 + (next.xs[0] - x0) * u, y: y0 + (next.ys[0] - y0) * u, width: 0, down: 0, stroke: k, progress: total > 0 ? drawnBefore(k + 1) / total : 1 };
}
