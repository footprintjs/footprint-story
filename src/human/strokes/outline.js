/**
 * A drawn stroke as a painter fills it: the ring round it, its ends capped, and the stroke as drawn up to a time — the
 * one rule both tools paint by (a deck's SVG path, a film's canvas fill), so neither works out geometry of its own.
 *
 *   strokeAt(points, t)                 → the points drawn by t: those at or before it, and the pen's place at t between two
 *   strokeOutline(points, {cap})        → one ring [[x, y], …] round the stroke, its two ends capped: what a painter fills
 *
 * `points` are a stroke item's (src/isometric/paint.js · stroke): [[x, y, width, t], …], t in seconds from the piece's
 * start, rising. So a stroke being drawn at time `now` is `strokeOutline(strokeAt(item.points, now - start), {cap:
 * item.stroke.cap})`: the ring of the part drawn so far, capped at both ends as the finished stroke is.
 *
 * WHY the caps are in the ring, not left to the painter: a painter that fills a ring draws no cap of its own (an SVG
 * path's fill has none; a canvas fill none), so StoryDeck drew flat ends and StoryReel drew its own circles — the same
 * picture worked out twice, and differently. A cap is geometry; it belongs here, once.
 * WHY one ring, not a ring and two discs: one fill, one path; no seam where a disc meets the ring. The ring CAN cross
 * itself — at a round cap on a short, sharply turning stroke (seen on about 1 in 86 real map strokes), as any offset
 * ring can at a tight bend — so a painter fills it by the NON-ZERO rule (SVG's and a canvas's default), never even-odd,
 * which would leave a hole where it crosses.
 */
import { refuse, shown, finite } from '../read.js';
import { MOST_STROKE_POINTS } from './plan.js';

/** The caps a stroke's end takes — the paint list's (src/isometric/paint.js · checkPaint) and SVG's and canvas's names. */
export const STROKE_CAPS = Object.freeze(['round', 'butt', 'square']);
/**
 * The segments of a round cap's half circle. Ours: 12 keeps the drawn edge within 0.09 px of the true circle at the
 * widest stroke the styles take (20 px: 10 (1 − cos(π / 24)) ≈ 0.086), and within 0.011 px at the usual 2.5 px.
 */
export const CAP_STEPS = 12;

const OPTIONS = Object.freeze(['cap']);

/** A stroke's points, checked: a plain list of at most MOST_STROKE_POINTS, each [x, y, width, …] of finite numbers, the width from 0. */
function readPoints(points, call, timed) {
  if (!Array.isArray(points) || points.length > MOST_STROKE_POINTS) refuse(`${call} takes a stroke's points [[x, y, width, t], …], at most ${MOST_STROKE_POINTS} — not ${Array.isArray(points) ? `${points.length} of them` : shown(points)}`);
  let last = -Infinity;
  for (let i = 0; i < points.length; i += 1) {
    const p = points[i];
    if (!(Array.isArray(p) && p.length >= (timed ? 4 : 3) && finite(p[0]) && finite(p[1]) && finite(p[2]) && p[2] >= 0 && (!timed || (finite(p[3]) && p[3] >= last)))) {
      refuse(`${call}'s point ${i + 1} is [x, y, width${timed ? ', t' : ''}]: finite numbers, the width from 0${timed ? `, t in seconds rising along the stroke (from ${last})` : ''} — not ${shown(p)}`);
    }
    if (timed) last = p[3];
  }
  return points;
}

/**
 * The stroke as drawn by time `t` (seconds, the points' own clock): every point at or before `t`, then — when `t` falls
 * between two points — the pen's place at `t` on the line between them, its width and its time taken as far along as
 * `t` is (linear). Before the first point, nothing (`[]`); at or after the last, every point. Gives new lists
 * [[x, y, width, t], …]; the points handed in are never edited.
 * WHY a point between, not a cut at the last point before `t`: a stroke then grows smoothly, frame by frame, at the
 * speed the pen drew it — a cut at the last point jumps a whole step (2 px, more on a long stroke) at a time.
 */
export function strokeAt(points, t) {
  if (typeof t !== 'number' || Number.isNaN(t)) refuse(`strokeAt's t is a time in seconds on the points' own clock (from the piece's start), a number, or Infinity for the whole stroke — not ${shown(t)}`);
  const ps = readPoints(points, 'strokeAt', true), n = ps.length;
  // the last point at or before t: the times rise, so a binary search
  let lo = 0, hi = n;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (ps[mid][3] <= t) lo = mid + 1; else hi = mid; }
  const k = lo - 1;
  if (k < 0) return [];
  const out = [];
  for (let i = 0; i <= k; i += 1) out.push([ps[i][0], ps[i][1], ps[i][2], ps[i][3]]);
  const a = ps[k];
  if (k < n - 1 && a[3] < t) {
    // a[3] < t < b[3]: the next point is the first after t, so the share is above 0 and below 1
    const b = ps[k + 1], s = (t - a[3]) / (b[3] - a[3]);
    out.push([a[0] + s * (b[0] - a[0]), a[1] + s * (b[1] - a[1]), a[2] + s * (b[2] - a[2]), t]);
  }
  return out;
}

function readCap(options) {
  if (options === undefined || options === null) return 'round';
  if (typeof options !== 'object' || Array.isArray(options)) refuse(`strokeOutline's options are {cap}, or none (a round cap, as a pen's end is) — not ${shown(options)}`);
  for (const k of Object.keys(options)) if (!OPTIONS.includes(k)) refuse(`strokeOutline's options are {cap} — not ${shown(k)}`);
  const cap = options.cap ?? 'round';
  if (!STROKE_CAPS.includes(cap)) refuse(`strokeOutline's cap is ${STROKE_CAPS.map((c) => `"${c}"`).join(', ')} (the stroke item's stroke.cap) — not ${shown(cap)}`);
  return cap;
}

/** The way the stroke runs at an end, as a unit [tx, ty]: along its end chord; past a run of points in one place, to the first that is not; (1, 0) for a stroke drawn in one place. */
function endHeading(ps, i, chord) {
  if (chord[2] > 0) return [chord[0] / chord[2], chord[1] / chord[2]];
  const n = ps.length, p = ps[i], step = i === 0 ? 1 : -1;
  for (let j = i + step; j >= 0 && j < n; j += step) {
    const dx = (ps[j][0] - p[0]) * step, dy = (ps[j][1] - p[1]) * step, len = Math.hypot(dx, dy);
    if (len > 0) return [dx / len, dy / len];
  }
  return [1, 0];
}

/**
 * The ring round a stroke whose width changes along it: up its left side, round its far end by its cap, back down its
 * right side, round its near end — each point moved half its width along the normal of the chord through its
 * neighbours. `cap` (the item's `stroke.cap`; round when left out, as `strokeItems` writes it):
 *   round   a half circle of the end's width round each end point (CAP_STEPS segments), out past it the way the stroke runs
 *   butt    flat, across the end point: nothing past it
 *   square  half the end's width out past it, square
 * A stroke of one point is a dot: a circle (round), a square (square), nothing (butt, two points of no area) — as SVG and
 * canvas draw a line of no length. An end of no width takes no cap. A painter fills this ring and draws no cap of its own.
 */
export function strokeOutline(points, options = undefined) {
  const cap = readCap(options), ps = readPoints(points, 'strokeOutline', false), n = ps.length;
  if (!n) return [];
  const left = [], right = [], heads = [];
  for (let i = 0; i < n; i += 1) {
    const a = ps[Math.max(0, i - 1)], b = ps[Math.min(n - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy), h = ps[i][2] / 2;
    // an end's normal is its heading's, so its cap meets the sides exactly; inside, as before: a chord of no length pinches
    const [tx, ty] = i === 0 || i === n - 1 ? endHeading(ps, i, [dx, dy, len]) : [dx / (len || 1), dy / (len || 1)];
    if (i === 0) heads[0] = [tx, ty];
    if (i === n - 1) heads[1] = [tx, ty];
    left.push([ps[i][0] + ty * h, ps[i][1] - tx * h]);
    right.push([ps[i][0] - ty * h, ps[i][1] + tx * h]);
  }
  // the cap round end point p, from its side `from` (the unit offset to the side the ring arrives on) the way `forward` runs
  const capOf = (p, from, forward) => {
    const h = p[2] / 2;
    if (h === 0 || cap === 'butt') return [];
    if (cap === 'square') return [[p[0] + (from[0] + forward[0]) * h, p[1] + (from[1] + forward[1]) * h], [p[0] + (forward[0] - from[0]) * h, p[1] + (forward[1] - from[1]) * h]];
    return Array.from({ length: CAP_STEPS - 1 }, (_, k) => {
      const phi = (Math.PI * (k + 1)) / CAP_STEPS, c = Math.cos(phi), s = Math.sin(phi);
      return [p[0] + (c * from[0] + s * forward[0]) * h, p[1] + (c * from[1] + s * forward[1]) * h];
    });
  };
  const [ex, ey] = heads[1], [sx, sy] = heads[0];
  // far end: from the left side (ty, −tx) round through the heading to the right; near end: from the right side back to the left, through the way it came from
  const far = capOf(ps[n - 1], [ey, -ex], [ex, ey]), near = capOf(ps[0], [-sy, sx], [-sx, -sy]);
  return [...left, ...far, ...right.reverse(), ...near];
}
