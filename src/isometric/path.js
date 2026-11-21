/**
 * A way through points with its corners rounded: what a route (routes.js) is drawn as, once its points are on the frame.
 *
 *   const way = rounded([[0, 0], [100, 0], [100, 80]], 20)
 *   way.start                → [0, 0]
 *   way.pieces               → [{ to: [80, 0] }, { corner: [100, 0], to: [100, 20] }, { to: [100, 80] }]
 *   way.length               → how long it is
 *   way.at(0.5)              → [x, y]: the point halfway along it, by length
 *
 * A straight piece runs to `to`. A rounded corner is one curve from where the piece before ended to `to`, drawn
 * towards `corner` (a quadratic Bézier curve: SVG's Q, a canvas's quadraticCurveTo). Each tool draws the pieces its own
 * way; `at` is where a thing riding the way stands, so a deck's packet and a film's frame agree.
 *
 * WHY here and not in each tool: the corner, the length and the place along it must be the same numbers in a deck and
 * in a film, or the same picture rides differently in the two.
 */
import { numbers, own, refuse, shown } from './thing.js';

export const MOST_WAY = 4096;   // the most points one way has (stopShort asks it too, before it reads a point)
const CHORDS = 12;       // the straight runs a rounded corner is measured in
const far = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const curve = (from, corner, to, t) => [0, 1].map((k) => (1 - t) * (1 - t) * from[k] + 2 * (1 - t) * t * corner[k] + t * t * to[k]);

/**
 * `points`: [[x, y], …], two or more; `radius`: how far from a corner its rounding starts (never over half the shorter
 * of the two runs that meet there; 0: sharp corners). Points one on the other are read once, and a point on the
 * straight line between its neighbours is no corner.
 */
export function rounded(points, radius = 0) {
  if (!Array.isArray(points) || points.length < 2 || points.length > MOST_WAY) refuse(`rounded takes a way of 2 to ${MOST_WAY} points, [[x, y], …] — not ${shown(points)}`);
  if (!(typeof radius === 'number' && radius >= 0 && Number.isFinite(radius))) refuse(`rounded takes a radius of 0 or more — not ${shown(radius)}`);
  const read = [];
  for (let i = 0; i < points.length; i += 1) {
    const p = numbers(own(points, i), [2], `point ${i + 1} of the way`, '[x, y]');
    if (!read.length || far(read.at(-1), p) > 0) read.push(p);
  }
  if (read.length < 2) refuse('rounded takes a way that goes somewhere: its points are all one place');
  const start = read[0], pieces = [];
  let from = start;
  for (let i = 1; i < read.length - 1; i += 1) {
    const corner = read[i], next = read[i + 1], into = far(read[i - 1], corner), out = far(corner, next);
    const r = Math.min(radius, into / 2, out / 2);
    const turn = (corner[0] - read[i - 1][0]) * (next[1] - corner[1]) - (corner[1] - read[i - 1][1]) * (next[0] - corner[0]);
    if (!(r > 0) || turn === 0) { pieces.push({ to: corner }); from = corner; continue; }
    const before = [corner[0] - (corner[0] - read[i - 1][0]) * r / into, corner[1] - (corner[1] - read[i - 1][1]) * r / into];
    const after = [corner[0] + (next[0] - corner[0]) * r / out, corner[1] + (next[1] - corner[1]) * r / out];
    if (far(from, before) > 0) pieces.push({ to: before });
    pieces.push({ corner, to: after });
    from = after;
  }
  pieces.push({ to: read.at(-1) });
  // each piece's length, and for a corner the lengths along its chords: `at` walks them
  const runs = [];
  let length = 0, at = start;
  for (const piece of pieces) {
    const chords = piece.corner ? Array.from({ length: CHORDS + 1 }, (_, k) => curve(at, piece.corner, piece.to, k / CHORDS)) : [at, piece.to];
    const lengths = chords.slice(1).map((p, k) => far(chords[k], p)), whole = lengths.reduce((a, b) => a + b, 0);
    runs.push({ chords, lengths, from: length, whole });
    length += whole; at = piece.to;
  }
  const place = (share) => {
    if (!(typeof share === 'number' && share >= 0 && share <= 1)) refuse(`a place along a way is a share of it, from 0 to 1 — not ${shown(share)}`);
    if (share === 1) return [...read.at(-1)];
    const want = share * length, run = runs.find((r) => want <= r.from + r.whole) ?? runs.at(-1);
    let left = want - run.from;
    for (let k = 0; k < run.lengths.length; k += 1) {
      if (left <= run.lengths[k] || k === run.lengths.length - 1) {
        const t = run.lengths[k] ? Math.min(1, Math.max(0, left / run.lengths[k])) : 0, a = run.chords[k], b = run.chords[k + 1];
        return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      }
      left -= run.lengths[k];
    }
    return [...run.chords.at(-1)];   // not reached: every run has a chord
  };
  return { start, pieces, length, at: place };
}
