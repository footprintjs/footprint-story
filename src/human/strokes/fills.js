/**
 * Fills by hand: parallel lines clipped to a closed shape, and the strokes a hand draws them in.
 *
 *   hatchLines(ring, {angle, spacing, holes})  → {segments: [{a, b, line}], normal, lo, hi, offsets}: the lines, exactly
 *                                                inside the ring and outside its holes
 *   fillStrokes(shape, pen)                    → {strokes: [{points, kind, set}], sets: [{angle, spacing, lo, hi}], pen}
 *
 * The lines: every line at `angle` (degrees from the x axis toward y, which runs down) whose distance across from the
 * next is `spacing` exactly; as many as fit across the shape, centred, so the margin at each side is above 0 and at most
 * half a spacing (a line never grazes a corner). Each line is cut where it crosses the ring (and a hole's ring), and the
 * pieces inside kept — the even-odd rule, a crossing at a corner counted by the half-open rule (geometry.js · crossings).
 * A piece shorter than MIN_PIECE px is dropped: the line only touches the edge there.
 *
 * How a hand draws them (ours, from watching hatching done): `hatch` — each line its own stroke, all drawn the same way
 * (the flick of a wrist), line after line from the side nearer the pen; `cross-hatch` — a hatch, then a second at the
 * angle plus 90°; `scribble` — the lines joined end to end, back and forth, without a lift, where the link from one
 * line's end to the next line's start stays inside the shape; a lift where it would not.
 */
import { refuse } from '../read.js';
import { crossings, insideRing, toRing } from './geometry.js';

/** A piece of a hatch line shorter than this (px) is dropped: it is where a line only touches the edge. Ours — small,
 *  so no band of the shape goes without a line (the `hatch-gaps` critic measures the bands). */
export const MIN_PIECE = 0.01;
/** The most lines one set of hatching may hold. */
export const MOST_HATCH_LINES = 1024;
/** The angle a cross-hatch's second set turns from its first, in degrees. Ours: square to it, the plainest cross. */
export const CROSS_TURN = 90;

const inside = (x, y, ring, holes) => insideRing(x, y, ring) && !holes.some((h) => insideRing(x, y, h));

/** The lines of one hatch set over a ring, outside its holes: exact pieces, each with the index of its line. */
export function hatchLines(ring, { angle, spacing, holes = [] }) {
  const rad = (angle * Math.PI) / 180, d = [Math.cos(rad), Math.sin(rad)], n = [-d[1], d[0]];
  const across = ring.map((p) => p[0] * n[0] + p[1] * n[1]), along = ring.map((p) => p[0] * d[0] + p[1] * d[1]);
  const lo = Math.min(...across), hi = Math.max(...across), span = hi - lo;
  const count = span > 0 ? Math.ceil(span / spacing) - 1 : -1;
  if (count + 1 > MOST_HATCH_LINES) refuse(`a hatch ${Math.round(span)} px across at ${spacing} px apart is ${count + 1} lines — at most ${MOST_HATCH_LINES}: give a wider spacing`);
  const margin = (span - count * spacing) / 2, a0 = Math.min(...along) - 1, a1 = Math.max(...along) + 1, offsets = [], segments = [];
  for (let j = 0; j <= count; j += 1) {
    const c = lo + margin + j * spacing;
    offsets.push(c);
    // the line as a segment past the ring at both ends, then its crossings with the ring and with every hole
    const p = [n[0] * c + d[0] * a0, n[1] * c + d[1] * a0], q = [n[0] * c + d[0] * a1, n[1] * c + d[1] * a1];
    const cuts = [0, ...crossings(p, q, ring), ...holes.flatMap((h) => crossings(p, q, h)), 1].sort((u, v) => u - v);
    const at = (t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
    for (let k = 1; k < cuts.length; k += 1) {
      const t0 = cuts[k - 1], t1 = cuts[k], mid = at((t0 + t1) / 2);
      if ((t1 - t0) * (a1 - a0) >= MIN_PIECE && inside(mid[0], mid[1], ring, holes)) segments.push({ a: at(t0), b: at(t1), line: j });
    }
  }
  // pieces of one line that touch (a hole's edge crossed twice at one place) are one piece
  const joined = [];
  for (const s of segments) {
    const last = joined[joined.length - 1];
    if (last && last.line === s.line && Math.hypot(last.b[0] - s.a[0], last.b[1] - s.a[1]) < 1e-9) last.b = s.b;
    else joined.push({ ...s });
  }
  return { segments: joined, normal: n, direction: d, lo, hi, offsets };
}

/** Whether the link p–q stays inside the ring and outside its holes: no edge crossed between its ends, its middle
 *  inside or on an edge (a link between two lines' ends often runs along the edge they end on). */
function linkInside(p, q, ring, holes) {
  const cut = [ring, ...holes].some((r) => crossings(p, q, r).some((t) => t > 1e-9 && t < 1 - 1e-9));
  const m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2], edge = (r) => toRing(m[0], m[1], r) <= 1e-9;
  return !cut && (insideRing(m[0], m[1], ring) || edge(ring)) && holes.every((h) => !insideRing(m[0], m[1], h) || edge(h));
}

const far = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);

/** One set's pieces in the order a hand draws them: line by line from the side nearer the pen. */
function inOrder(set, pen) {
  const { segments } = set;
  if (!segments.length) return [];
  const first = segments[0], last = segments[segments.length - 1];
  const fromFirst = !pen || Math.min(far(pen, first.a), far(pen, first.b)) <= Math.min(far(pen, last.a), far(pen, last.b));
  return fromFirst ? segments : [...segments].reverse();
}

/** A hatch set as strokes: every piece its own stroke, all drawn along the set's direction (one flick of the wrist). */
const flicks = (pieces, set) => pieces.map((s) => ({ points: [s.a, s.b], kind: set.kind, set: set.index }));

/** A scribble: the pieces back and forth, each joined to the nearest piece of the next line when the link stays inside. */
function scribble(pieces, set, ring, holes) {
  const left = [...pieces], step = pieces[pieces.length - 1].line >= pieces[0].line ? 1 : -1, strokes = [];
  let current = null;
  while (left.length) {
    const end = current ? current.points[current.points.length - 1] : null;
    const near = (p) => Math.min(far(end, p.a), far(end, p.b));
    // the nearest piece of the next line whose link from here stays inside the shape; else a lift to the first left
    let pick = -1;
    if (current) {
      left.forEach((p, k) => { if (p.line === current.line + step && (pick < 0 || near(p) < near(left[pick])) && linkInside(end, far(end, p.b) < far(end, p.a) ? p.b : p.a, ring, holes)) pick = k; });
    }
    const linked = pick >= 0, s = left.splice(linked ? pick : 0, 1)[0];
    const flip = linked && far(end, s.b) < far(end, s.a), from = flip ? s.b : s.a, to = flip ? s.a : s.b;
    if (linked) current.points.push(from, to);
    else { current = { points: [from, to], kind: set.kind, set: set.index }; strokes.push(current); }
    current.line = s.line;
  }
  return strokes.map(({ points, kind, set: index }) => ({ points, kind, set: index }));
}

/**
 * A filled shape's fill as strokes, from where the pen is: {strokes, sets, pen}. `sets` keeps each set of lines'
 * numbers (its angle, spacing and how far across the shape reaches, `lo` to `hi`), which the `hatch-gaps` critic reads.
 */
export function fillStrokes(shape, pen, setBase = 0) {
  const { kind, angle, spacing } = shape.fill, ring = shape.points, holes = shape.holes;
  const angles = kind === 'cross-hatch' ? [angle, angle + CROSS_TURN] : [angle];
  const sets = [], strokes = [];
  let here = pen;
  angles.forEach((a, i) => {
    const lines = hatchLines(ring, { angle: a, spacing, holes }), set = { index: setBase + i, kind, ...lines };
    sets.push({ shape: shape.index, kind, angle: a, spacing, lo: lines.lo, hi: lines.hi, lines: lines.offsets.length });
    const pieces = inOrder(set, here);
    const made = kind === 'scribble' ? scribble([...pieces], set, ring, holes) : flicks(pieces, set);
    strokes.push(...made);
    if (made.length) { const s = made[made.length - 1]; here = s.points[s.points.length - 1]; }
  });
  return { strokes, sets, pen: here };
}
