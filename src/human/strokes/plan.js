/**
 * A drawing planned as a hand draws it: shapes in, strokes out — the order and why, each stroke's timed points and
 * widths, and the pen's lifts between them. Plain data, the same for the same shapes and the same random().
 *
 *   planSketch(shapes, {random | seed, speed, fillSpeed, width, tremor, wavelength, overshoot, seconds, who})
 *     → {seconds, strokes, lifts, order, sets, least, boilSeed, rule}
 *
 *   strokes [{layer: 'outline' | 'detail' | 'fill', group, kind: 'line' | 'hatch' | 'cross-hatch' | 'scribble',
 *             shape (the shape it is of, or for lines the first shape that had its first line), set (a fill's set, or null),
 *             path (its corners, before the hook and the tremor), start, seconds, length, amplitude,
 *             xs, ys, ws, ts (seconds from the sketch's start), sx, sy, rs (pen.js)}]
 *   lifts   [{after (the stroke before), seconds, distance}]: the pen in the air from one stroke's end to the next's start
 *   order   [{stroke, layer, group, rule, at: [x, y]}]: where each stroke starts and the rule that put it there (order.js)
 *   least   {outline, detail}: the fewest strokes each layer of lines allows, summed over the pieces (graph.js)
 *
 * The numbers (ours): lines at `speed` (400 px a second, the `power-law` pen's), fills at `fillSpeed` (800: hatching is
 * quick); widths `width` (2.5 px, the ink line) for an outline, 70% of it for detail, 40% for a fill (WIDTH_SHARE); the
 * tremor `tremor` (0.8 px) on lines and a scribble, half of it on hatching (a hatch reads by its even spacing); a lift
 * 0.06 s and 1500 px a second through the air (LIFT). `seconds`, when given, scales every time so the sketch takes it.
 */
import { refuse, shown, finite, isRecord, stored, MOST_SECONDS } from '../read.js';
import { seeded } from '../../seed/seeded.js';
import { TREMOR } from '../laws/tremor.js';
import { PEN_SPEED } from '../models/powerLawPen.js';
import { readShapes } from './shapes.js';
import { plainCopy } from '../plain.js';
import { piecesInOrder, walkLines, ORDER_RULE } from './order.js';
import { fillStrokes } from './fills.js';
import { penStroke, CORNER, STROKE_STEP } from './pen.js';

export const SKETCH = Object.freeze({ speed: PEN_SPEED, fillSpeed: 800, width: 2.5, fillTremor: 0.5 });
export const WIDTH_SHARE = Object.freeze({ outline: 1, detail: 0.7, fill: 0.4 });
export const LIFT = Object.freeze({ seconds: 0.06, speed: 1500 });
/** The most points one sketch's strokes hold: the step grows to keep under it. */
export const MOST_SKETCH_POINTS = 16000;
/** The most points one stroke holds: the step of a long stroke grows to keep under it. The isometric paint list's
 *  MOST_PAINT_POINTS (src/isometric/paint.js; a test pins the two equal), so every stroke fits one `stroke` item. */
export const MOST_STROKE_POINTS = 4096;

/** Every stroke of the drawing, in order, before the pen draws them: [{layer, group, kind, shape, set, path, rule}], least, sets. */
function strokesInOrder(shapes) {
  const out = [], sets = [], least = { outline: 0, detail: 0 };
  let pen = null;
  for (const piece of piecesInOrder(shapes)) {
    for (const layer of ['outline', 'detail']) {
      const lines = piece.shapes.filter((s) => s.layer === layer && s.edge);
      if (!lines.length) continue;
      const walked = walkLines(lines, pen);
      least[layer] += walked.least;
      for (const s of walked.strokes) out.push({ layer, group: piece.group, kind: 'line', shape: s.owners[0], set: null, path: s.points, rule: s.rule });
      pen = walked.pen;
    }
    // fills: the filled shapes from the one nearest the pen, each filled line by line from its nearer side
    const filled = piece.shapes.filter((s) => s.fill);
    while (filled.length) {
      const d = (s) => (pen ? Math.min(...s.points.map((p) => Math.hypot(p[0] - pen[0], p[1] - pen[1]))) : 0);
      const k = filled.reduce((b, s, i) => (d(s) < d(filled[b]) ? i : b), 0), shape = filled.splice(k, 1)[0];
      const made = fillStrokes(shape, pen, sets.length);
      sets.push(...made.sets);
      for (const s of made.strokes) out.push({ layer: 'fill', group: piece.group, kind: s.kind, shape: shape.index, set: s.set, path: s.points, rule: 'fill', clip: shape });
      pen = made.pen;
    }
  }
  return { strokes: out, sets, least };
}

const lengthOf = (path) => path.reduce((s, p, i) => (i ? s + Math.hypot(p[0] - path[i - 1][0], p[1] - path[i - 1][1]) : 0), 0);

const SETTINGS = Object.freeze(['random', 'seed', 'who', 'speed', 'fillSpeed', 'width', 'tremor', 'wavelength', 'overshoot', 'seconds']);

/** The settings' numbers, each by its own stored field, checked; `random`, or a `seed` text it is made from. */
function readSettings(settings) {
  if (!isRecord(settings)) refuse(`planSketch's settings are {random or seed, speed, width, tremor, …} — not ${shown(settings)}`);
  for (const k of Object.keys(settings)) if (!SETTINGS.includes(k)) refuse(`planSketch's settings are ${SETTINGS.join(', ')} — not ${shown(k)}`);
  const get = (k) => stored(settings, k, `planSketch's ${k}`), who = get('who') ?? 'the sketch';
  if (typeof who !== 'string' || !who.trim() || who.length > 200) refuse(`planSketch's who is the words for where the sketch was written, 1 to 200 letters — not ${shown(who)}`);
  const num = (k, lo, hi, usual, above = false) => { const v = get(k); if (v === undefined) return usual; if (!(finite(v) && (above ? v > lo : v >= lo) && v <= hi)) refuse(`${who}'s ${k} is a number ${above ? 'above' : 'from'} ${lo} to ${hi} — not ${shown(v)}`); return v; };
  const random = get('random'), seed = get('seed');
  if (random !== undefined ? typeof random !== 'function' : typeof seed !== 'string' || seed.length > 1024) refuse(`${who} is drawn with random() (numbers from 0 to 1) or a seed text (at most 1024 letters) — not ${shown(random ?? seed)}`);
  return { who, random: random ?? seeded(`human:sketch|${seed}`), speed: num('speed', 0, 100000, SKETCH.speed, true), fillSpeed: num('fillSpeed', 0, 100000, SKETCH.fillSpeed, true),
    width: num('width', 0.25, 20, SKETCH.width), tremor: num('tremor', 0, 8, TREMOR.amplitude), wavelength: num('wavelength', 4, 1000, TREMOR.wavelength),
    overshoot: num('overshoot', 0, 12, CORNER.most), seconds: num('seconds', 0, MOST_SECONDS, undefined, true) };
}

/** The sketch planned: the order, then each stroke drawn by the pen, then the lifts between them, timed. */
export function planSketch(rawShapes, settings) {
  const { who, random, speed, fillSpeed, width, tremor, wavelength, overshoot, seconds: given } = readSettings(settings);
  const shapes = readShapes(rawShapes, who);
  // drawn first, so a boil's seed never moves with what the strokes draw from random() after it
  const boilSeed = Math.floor(random() * 4294967296);
  const { strokes: planned, sets, least } = strokesInOrder(shapes);
  if (!planned.length) refuse(`${who} has nothing to draw: its shapes' lines fold onto single points and it has no fill with a line inside it`);
  // a step long enough that the drawn points stay under MOST_SKETCH_POINTS (each corner adds at most a hook's two)
  const total = planned.reduce((s, p) => s + lengthOf(p.path), 0), corners = planned.reduce((s, p) => s + 3 * p.path.length, 0);
  const step = Math.max(STROKE_STEP, total / Math.max(1, MOST_SKETCH_POINTS - corners));
  if (corners >= MOST_SKETCH_POINTS) refuse(`${who} has ${corners / 3} corners to draw — at most ${Math.floor(MOST_SKETCH_POINTS / 3)}: draw it in parts`);
  const strokes = [], lifts = [], order = [];
  let t = 0;
  planned.forEach((p, i) => {
    if (i) {
      const prev = strokes[i - 1], end = [prev.xs[prev.xs.length - 1], prev.ys[prev.ys.length - 1]], distance = Math.hypot(p.path[0][0] - end[0], p.path[0][1] - end[1]);
      const seconds = LIFT.seconds + distance / LIFT.speed;
      lifts.push({ after: i - 1, seconds, distance });
      t += seconds;
    }
    const fill = p.layer === 'fill', amplitude = fill && p.kind !== 'scribble' ? tremor * SKETCH.fillTremor : tremor;
    // each edge walked in steps adds at most one point past its length's share, a hook two edges: 3 a corner at most
    const room = MOST_STROKE_POINTS - 3 * p.path.length;
    if (room < 1) refuse(`${who}'s stroke ${i} turns at ${p.path.length} corners — one stroke holds at most ${Math.floor((MOST_STROKE_POINTS - 1) / 3)}: draw it in parts`);
    const own = Math.max(step, lengthOf(p.path) / room);
    const drawn = penStroke(p.path, { random, speed: fill ? fillSpeed : speed, width: width * WIDTH_SHARE[p.layer], amplitude, wavelength, overshoot: fill ? 0 : overshoot, step: own, clip: fill ? { ring: p.clip.points, holes: p.clip.holes } : null });
    strokes.push({ layer: p.layer, group: p.group, kind: p.kind, shape: p.shape, set: p.set, path: p.path.map((q) => [q[0], q[1]]), start: t, seconds: drawn.seconds, length: drawn.length, amplitude,
      xs: drawn.xs, ys: drawn.ys, ws: drawn.ws, ts: drawn.ts.map((u) => t + u), sx: drawn.sx, sy: drawn.sy, rs: drawn.rs, hooks: drawn.hooks, step: own });
    order.push({ stroke: i, layer: p.layer, group: p.group, rule: p.rule, at: [p.path[0][0], p.path[0][1]] });
    t += drawn.seconds;
  });
  const points = strokes.reduce((s, x) => s + x.xs.length, 0);
  if (points > MOST_SKETCH_POINTS) refuse(`${who} draws ${points} points — at most ${MOST_SKETCH_POINTS}: draw it in parts`);
  const natural = t, scale = given !== undefined ? given / natural : 1;
  if (scale !== 1) {
    for (const s of strokes) { s.start *= scale; s.seconds *= scale; s.ts = s.ts.map((u) => u * scale); }
    for (const l of lifts) l.seconds *= scale;
  }
  return plainCopy({ seconds: natural * scale, natural, strokes, lifts, order, sets, least, boilSeed, rule: ORDER_RULE, step, tremor, wavelength, width, overshoot,
    hooks: strokes.reduce((s, x) => s + x.hooks, 0), shapes: shapes.length, points }, who);
}
