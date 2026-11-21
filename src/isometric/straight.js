/**
 * A wire drawn straight, through the air, between two pieces on the frame — where no cable is laid along the floor, or
 * where one is written with a bend. Plain numbers in, plain numbers out; nothing is drawn.
 *
 *   lanesOf(pairs)                    → each wire's lane among those joining the same two pieces: {k, count, flip}
 *   straightRun(a, b, lane)           → {start, end}: from CABLE.gap off a's edge to CABLE.gap off b's — or {why}
 *   bentWire(a, e, bend, back)        → {corner, tip, heading}: one curve `bend` px off the line, its tip pulled back
 *   curveWay(a, c, e)                 → a curve as a way ({start, pieces, length, at}), walked in 64 straight runs
 *   headingOf(from, to)               → the unit vector from one point to the other
 *   arrowHead(tip, heading, size?)    → the arrow head's three corners: [tip, left, right]
 *
 * The rule, StoryDeck's: the wires joining one pair are spread across the line between the two pieces' middles, those
 * running one way first (each keeps to its left: a request above its answer), CABLE.lane apart at most and always
 * inside both pieces; each runs from CABLE.gap px off one piece's edge to CABLE.gap px off the other's, and fewer than
 * CABLE.least px of it between is refused (the pieces touch or overlap). A piece's edge is its outline (what a block
 * draws), or its box (a flat piece).
 *
 * WHY here: a deck and a film draw the same straight wire, so it must start, bend, end and ride the same. They came
 * from StoryDeck 0.29.0 (deck/transforms.js · wiresBetween, wireSvg, headAt; deck/rides.js · curveLength), which
 * StoryReel 0.34.0 had copied (kits/isometric/cables.mjs · layStraight, curveWay; draw.mjs · drawHead); a property test
 * holds each to those copies (test/control/).
 */
import { framePoints, own, refuse, shown } from './thing.js';
import { boxOf, exitBoxRead, exitPoints, pairOf, MOST_OUTLINE } from './outline.js';
import { CABLE } from './cable.js';

/** The most wires one call of lanesOf reads, and the most straight runs a curve is walked in. */
export const MOST_WIRES = 65_536;
const MOST_RUNS = 4096;

/**
 * Each wire's lane among those joining the same two pieces: `pairs` one entry a wire, [from, to] by name (two
 * strings), or null for a wire that takes no lane (a cable along the floor, a wire written in numbers). Gives, in the
 * same order, null or {k, count, flip}: the wire is lane k of count across its pair's line, and `flip` says it runs
 * against the pair's own direction (its names in order: from the first name to the second) — straightRun is asked in
 * that direction, and a flipped wire's start is the run's end.
 */
export function lanesOf(pairs) {
  if (!Array.isArray(pairs)) refuse(`lanesOf takes one entry a wire, [from, to] or null — not ${shown(pairs)}`);
  if (pairs.length > MOST_WIRES) refuse(`lanesOf takes at most ${MOST_WIRES} wires — not ${pairs.length}`);
  const read = Array.from({ length: pairs.length }, (_, i) => {
    const p = Object.hasOwn(pairs, i) ? own(pairs, i) : undefined;
    if (p === null) return null;
    const names = Array.isArray(p) && p.length === 2 ? [own(p, 0), own(p, 1)] : null;
    if (!names || !names.every((n) => typeof n === 'string')) refuse(`wire ${i + 1} of lanesOf is [from, to], two names, or null — not ${shown(p)}`);
    return names;
  });
  // a pair keyed by its names in order: the wires both ways share one set of lanes
  const keyOf = (p) => [p[0], p[1]].sort().join('\u0000'), lanes = new Map();
  read.forEach((p, i) => { if (p) { const key = keyOf(p); if (!lanes.has(key)) lanes.set(key, []); lanes.get(key).push(i); } });
  const lane = new Map();
  for (const [key, ids] of lanes) {
    // those running the pair's own way first, then those running back — each on its own left
    const along = (i) => read[i][0] === key.split('\u0000')[0], ordered = [...ids.filter(along), ...ids.filter((i) => !along(i))];
    ordered.forEach((i, k) => lane.set(i, { k, count: ordered.length }));
  }
  return read.map((p, i) => (p ? { ...lane.get(i), flip: p[0] !== [p[0], p[1]].sort()[0] } : null));
}

/** One end of a straight wire, read: {middle, across(n), exit(p, u)} — by its outline, or by its box. */
function endOf(v, what) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) refuse(`${what} is {middle, outline} or {middle, box} — not ${shown(v)}`);
  const middle = pairOf(own(v, 'middle'), `${what}'s middle`), outline = own(v, 'outline');
  if (outline !== undefined) {
    const points = framePoints(outline, `${what}'s outline`, { anyNumber: true, most: MOST_OUTLINE });
    return { middle, across: (n) => Math.min(exitPoints(points, middle, n), exitPoints(points, middle, [-n[0], -n[1]])), exit: (p, u) => exitPoints(points, p, u) };
  }
  const b = boxOf(own(v, 'box'), `${what}'s box`);
  // half the box measured across the line: a lane closer to the middle than this, less CABLE.laneInset, crosses the box
  return { middle, across: (n) => (Math.abs(n[0]) * b.w + Math.abs(n[1]) * b.h) / 2, exit: (p, u) => exitBoxRead(b, p, u) };
}

/**
 * A straight wire between two pieces, in the pair's own direction (lanesOf): `a`, `b` each {middle: [x, y], outline:
 * [[x, y], …]} (what a block draws) or {middle, box: {x, y, w, h}} (a flat piece); `lane` {k, count} (lanesOf; one lane
 * when left out). Gives {start, end} — start CABLE.gap off a's edge, end CABLE.gap off b's — or {why}: 'middle' when the
 * two share a middle (no line between them), 'close' when fewer than CABLE.least px of wire is left between them.
 */
export function straightRun(a, b, lane = { k: 0, count: 1 }) {
  const A = endOf(a, 'straightRun\'s a'), B = endOf(b, 'straightRun\'s b');
  if (!lane || typeof lane !== 'object') refuse(`straightRun's lane is {k, count} (lanesOf) — not ${shown(lane)}`);
  const k = own(lane, 'k'), count = own(lane, 'count');
  if (!(Number.isInteger(count) && count >= 1 && Number.isInteger(k) && k >= 0 && k < count)) refuse(`straightRun's lane is {k, count}: lane k (from 0) of count — not ${shown([k, count])}`);
  const { gap, lane: LANE, laneInset, least } = CABLE, ca = A.middle, cb = B.middle, len = Math.hypot(cb[0] - ca[0], cb[1] - ca[1]);
  if (len === 0) return { why: 'middle' };
  const u = [(cb[0] - ca[0]) / len, (cb[1] - ca[1]) / len], n = [-u[1], u[0]];
  const most = Math.max(0, Math.min(A.across(n), B.across(n)) - laneInset);
  const step = count > 1 ? Math.min(LANE, (2 * most) / (count - 1)) : 0, off = (k - (count - 1) / 2) * step;
  const pa = [ca[0] + n[0] * off, ca[1] + n[1] * off], pb = [cb[0] + n[0] * off, cb[1] + n[1] * off];
  const ta = A.exit(pa, u) + gap, tb = B.exit(pb, [-u[0], -u[1]]) + gap;
  if (!(len - ta - tb >= least)) return { why: 'close' };
  return { start: [pa[0] + u[0] * ta, pa[1] + u[1] * ta], end: [pb[0] - u[0] * tb, pb[1] - u[1] * tb] };
}

/** The unit vector from `from` to `to` (a point onto itself: [0, 0], never NaN). */
export function headingOf(from, to) {
  const [ax, ay] = pairOf(from, 'headingOf\'s from'), [bx, by] = pairOf(to, 'headingOf\'s to'), far = Math.hypot(bx - ax, by - ay) || 1;
  return [(bx - ax) / far, (by - ay) / far];
}

/**
 * A wire from `a` to `e` bent `bend` px off its straight line (+ to the left of travel): one curve whose control point,
 * `corner`, stands beside the middle of the run — and its `tip`, the end pulled `back` px towards the corner (where an
 * arrow's head begins: CABLE.head × CABLE.headShort, or 0 for a line with no head), and `heading`, the way it arrives.
 */
export function bentWire(a, e, bend = 0, back = 0) {
  const [x1, y1] = pairOf(a, 'bentWire\'s a'), [x2, y2] = pairOf(e, 'bentWire\'s e');
  if (typeof bend !== 'number' || typeof back !== 'number') refuse(`bentWire's bend and back are numbers of px — not ${shown([bend, back])}`);
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
  const corner = [(x1 + x2) / 2 - (dy / len) * bend, (y1 + y2) / 2 + (dx / len) * bend];
  const tl = Math.hypot(x2 - corner[0], y2 - corner[1]) || 1, heading = [(x2 - corner[0]) / tl, (y2 - corner[1]) / tl];
  return { corner, tip: [x2 - heading[0] * back, y2 - heading[1] * back], heading };
}

/**
 * A quadratic curve from `a` to `e` drawn towards `c`, as a way: {start, pieces, length, at(share)} — the shape
 * rounded() gives, so a straight wire is drawn and ridden as a cable is (a packet stands at a share of its length).
 * Walked in `runs` straight runs (64): its length is theirs, and `at` stands on them (a share past 0 to 1 is held at
 * the end). Any numbers: a wire written in numbers far past a slide answers its arithmetic (Infinity, NaN) as it was.
 */
export function curveWay(a, c, e, runs = 64) {
  const [from, corner, to] = framePoints([a, c, e], 'curveWay\'s a, c and e', { anyNumber: true });
  if (!(Number.isInteger(runs) && runs >= 1 && runs <= MOST_RUNS)) refuse(`curveWay walks a curve in 1 to ${MOST_RUNS} runs, a whole number — not ${shown(runs)}`);
  // the first point is `a` itself, as a length is measured from it (deck/rides.js · curveLength)
  const pts = Array.from({ length: runs + 1 }, (_, k) => { if (!k) return [...from]; const t = k / runs; return [0, 1].map((i) => (1 - t) * (1 - t) * from[i] + 2 * (1 - t) * t * corner[i] + t * t * to[i]); });
  const along = [0];
  for (let k = 1; k <= runs; k++) along.push(along[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
  const length = along[runs];
  const at = (share) => {
    const want = Math.max(0, Math.min(1, share)) * length;
    let k = 1;
    while (k < runs && along[k] < want) k++;
    const span = along[k] - along[k - 1], u = span > 0 ? (want - along[k - 1]) / span : 0;
    return [pts[k - 1][0] + (pts[k][0] - pts[k - 1][0]) * u, pts[k - 1][1] + (pts[k][1] - pts[k - 1][1]) * u];
  };
  return { start: [...from], pieces: [{ corner: [...corner], to: [...to] }], length, at };
}

/**
 * An arrow's head at `tip`, pointing the way `heading` (a unit vector: headingOf, or bentWire's): its three corners,
 * [tip, left, right] — `size` px long (CABLE.head) and 0.6 of that to each side. A tool closes and fills them.
 */
export function arrowHead(tip, heading, size = CABLE.head) {
  const [tx, ty] = pairOf(tip, 'arrowHead\'s tip'), [ux, uy] = pairOf(heading, 'arrowHead\'s heading');
  if (!(typeof size === 'number' && size >= 0 && Number.isFinite(size))) refuse(`arrowHead's size is its length in px, 0 or more — not ${shown(size)}`);
  const back = [tx - ux * size, ty - uy * size], nx = -uy * size * 0.6, ny = ux * size * 0.6;
  return [[tx, ty], [back[0] + nx, back[1] + ny], [back[0] - nx, back[1] - ny]];
}
