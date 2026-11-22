/**
 * The `pace` critic: how many times faster than a hand's own pace a sketch's pen draws. Each stroke's length is the time
 * a hand needs for it at the pen's usual speed for its layer (SKETCH: 400 px a second along a line, 800 along a fill),
 * summed; over the time the plan gives its pen down, summed, that is how fast the drawing runs: 1 at the usual pace,
 * 4.9 when a 4.9 s drawing is played in 1 s. The lifts are left out: a hand in the air is not drawing, and a plan squeezed
 * by `seconds` squeezes them by the same share anyway.
 *
 * WHY a critic of its own, not `pen-speed`: `pen-speed` asks whether the pen slows in the bends (the two-thirds power
 * law). A plan squeezed into too short a `seconds` keeps every time's share, so it still slows in the bends exactly as
 * the law says — at 34× the pace. Only the pace itself says that no hand draws that fast. The order critics cannot say
 * it either: the order is the same at any speed.
 */
import { sketchOf } from './critique.js';
import { SKETCH } from './plan.js';
import { MOST_SECONDS } from '../read.js';

/**
 * The most times its usual pace a sketch may be drawn: 2. Ours. WHY: the usual pace is already a quick, sure hand (the
 * `power-law` pen's 400 px a second); a hand in a hurry draws about as fast again before its lines go loose, and a
 * drawing played faster than that reads as a recording run fast — the "speed drawing" look — not a person drawing.
 */
export const PACE_MOST = 2;
// WHY a margin: a plan given the fix's own seconds measures at the limit up to floating rounding, and must pass
const ROUNDING = 1e-9;

/** A stroke's drawn length: its own `length`, else the length of its drawn points, else null (it cannot say). */
function lengthOf(s) {
  if (s.length !== null) return s.length;
  if (!s.xs) return null;
  let total = 0;
  for (let i = 1; i < s.xs.length; i += 1) total += Math.hypot(s.xs[i] - s.xs[i - 1], s.ys[i] - s.ys[i - 1]);
  return total;
}

const up = (x) => Math.ceil(x * 100) / 100;
const tenth = (x) => (Math.round(x * 10) / 10).toFixed(1);

export const pace = Object.freeze({
  name: 'pace',
  limit: PACE_MOST,
  measure(track) {
    const sketch = sketchOf(track);
    if (!sketch) return null;
    let needs = 0, drawn = 0, lineLength = 0, lineSeconds = 0;
    for (const s of sketch.strokes) {
      const length = lengthOf(s);
      if (length === null || !(length > 0)) continue;
      needs += length / (s.layer === 'fill' ? SKETCH.fillSpeed : SKETCH.speed);
      drawn += Math.max(0, s.seconds);
      if (s.layer !== 'fill') { lineLength += length; lineSeconds += Math.max(0, s.seconds); }
    }
    if (!(drawn > 0)) return null;   // no drawn length, or none of it given any time: no pace to read
    const value = needs / drawn, first = Math.min(...sketch.strokes.map((s) => s.start)), seconds = Math.max(...sketch.strokes.map((s) => s.start + s.seconds)) - first;
    return { value, basis: { pace: value, lineSpeed: lineSeconds > 0 ? lineLength / lineSeconds : null, seconds, handSeconds: seconds * value } };
  },
  finding(value, who, basis) {
    if (!(value > PACE_MOST * (1 + ROUNDING))) return null;
    // the seconds that bring it to the limit, rounded up; a hand's own pace beside it (every time scales by `seconds`)
    const need = up((basis.seconds * value) / PACE_MOST), along = basis.lineSpeed === null ? 'along its fills' : `${Math.round(basis.lineSpeed)} px a second along its lines, where a hand draws ${SKETCH.speed}`;
    const message = `${who}: its pen draws at ${tenth(value)}× a hand's pace (${along}) — past ${PACE_MOST}×, it reads as a drawing played fast, not a hand drawing it`;
    if (need > MOST_SECONDS) return { level: 'warn', message, fix: `too much to draw at a hand's pace in one move (${need} s; the most is ${MOST_SECONDS}): draw it in parts` };
    return { level: 'warn', message, fix: `slow it: seconds: ${need} (or more; ${up(basis.handSeconds)} draws it at a hand's own pace)` };
  },
});
