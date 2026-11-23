/**
 * FABRIK: a chain of 2 to 16 parts in the plane reaching for a point, by forward and backward passes over the joints'
 * positions (A. Aristidou, J. Lasenby, "FABRIK: A fast, iterative solver for the Inverse Kinematics problem", Graphical
 * Models 73 (5), 2011), each part's child turned back into its angle window about its joint when the chain has limits
 * (A. Aristidou, Y. Chrysanthou, J. Lasenby, "Extending FABRIK with model constraints", Computer Animation and Virtual
 * Worlds 27 (1), 2016). The spec is docs/design/2026-11-bodies.md §1 and §3.
 *
 *   fabrik({ points, target, lengths?, limits?, parentAngle?, passes? })
 *     → { points, angles, reached, miss, passes, bound }
 *
 * A pass is one forward sweep (the end set on the target, each joint set back to its part's length toward where it was,
 * end to root) and one backward sweep (the root set back on its place, each joint set to its length, root to end). The
 * backward sweep is always last, so after every pass the root is where it was given, every part has its length, and every
 * limited part's relative angle is inside its window.
 *
 * WHY positions, not angles: a part's length is restored exactly by every sweep, it settles in few passes, and a spine
 * bends along its length instead of curling at its tip as cyclic coordinate descent does.
 * WHY at most 16 passes in one fixed order, stopping only when the end is under 0.1 px from the target: the same chain and
 * target always give the same answer, bit for bit, and the work is bounded by passes × parts whatever the data.
 * WHY it starts from the given points and never from a previous answer (purity, §3): a move samples its body at any t in
 * any order, so each solve begins at the move's start pose and gives the same answer however often it is asked.
 * WHY an epsilon and never a test for zero: a direction shorter than 1e-9 of the chain's length is rounding, not a
 * direction; that part takes its direction in the start pose instead (and a start part with no direction takes its
 * parent's), so the answer never depends on the last digit.
 * WHY report and never promise with limits: with windows FABRIK may not reach a reachable point (the windows can trap it),
 * so the result says how far the end stayed (`miss`) and which windows bound (`bound`); nothing is hidden.
 *
 * Angles follow §1: radians on the frame, y down (a positive turn is clockwise on screen), 0 along +x. A part's relative
 * angle is its world angle minus its parent's; the first part's parent is outside the chain, at `parentAngle`. A window
 * [min, max] reads a relative angle as the value plus the multiple of 2π nearest the window's middle
 * (geom/angles.js · wrapAngle, reused). Facing is the caller's: it solves in the frame it is given (the rig's written
 * frame) and the caller mirrors.
 */
import { wrapAngle } from '../geom/angles.js';

/** §3 and §10: the fewest and most parts a chain may have, the most passes, the miss under which a pass stops early (px). */
const LEAST_PARTS = 2;
const MOST_PARTS = 16;
const MOST_PASSES = 16;
const TOLERANCE = 0.1;
/** §10: the longest part (px), the furthest a point may be from 0 (px), and the share of the chain's length under which a
 *  direction counts as none (§3, degenerate targets). */
const MOST_LENGTH = 10000;
const FAR = 1e6;
const NONE_SHARE = 1e-9;
/** Ours: the turn (radians, clockwise on screen) each joint is given when the start pose and the target lie on one line.
 *  WHY: FABRIK moves every joint along the line to its neighbour, so a chain lying on the target's line stays on it for
 *  ever and a target inside its reach is never met; bent a little first, it settles. 0.1 settled the most of the chains
 *  measured (0.01, 0.05, 0.1, 0.2 tried: 2 to 16 parts, straight and folded, targets at 5% to 99% of reach). */
const IN_LINE_BEND = 0.1;
const TURN = 2 * Math.PI;
const KEYS = ['points', 'target', 'lengths', 'limits', 'parentAngle', 'passes'];

// ---- reading the chain: every field by its own stored value (a getter is code and never runs), every number checked ----
// (here, and small, because this file stands alone until the body door lands; that door's own reader may take these over)

function refuse(fix) { throw new Error(`body: fabrik's ${fix}`); }

const finite = (n) => typeof n === 'number' && Number.isFinite(n);

/** A value's own stored field, or undefined; a getter is refused, never run. */
function stored(o, key, what) {
  const d = Object.getOwnPropertyDescriptor(o, key);
  if (d && !('value' in d)) refuse(`${what} is read as a stored value, and this one is a getter (code, never run) — give the value itself`);
  return d ? d.value : undefined;
}

/** A value as a refusal shows it: numbers as JavaScript writes them, a list by its length, an object only named. */
function shown(v) {
  if (Array.isArray(v)) return `a list of ${v.length}`;
  if (v !== null && typeof v === 'object') return 'an object';
  if (typeof v === 'string') return JSON.stringify(v.length > 40 ? `${v.slice(0, 40)}…` : v);
  return typeof v === 'function' ? 'a function' : String(v);
}

/** A list's stored entries, copied; refused unless it is a list of `least` to `most`. */
function listOf(v, what, least, most, words) {
  if (!Array.isArray(v) || v.length < least || v.length > most) refuse(`${what} is ${words} — not ${shown(v)}`);
  return Array.from({ length: v.length }, (_, i) => stored(v, i, `${what}[${i}]`));
}

/** A point [x, y], two finite numbers no further than FAR from 0. */
function pointOf(v, what) {
  const xy = Array.isArray(v) && v.length === 2 ? listOf(v, what, 2, 2, '') : null;
  if (!(xy && xy.every((c) => finite(c) && Math.abs(c) <= FAR))) refuse(`${what} is a point [x, y], two numbers no further than ${FAR} from 0 — not ${xy ? `[${xy.map(shown).join(',')}]` : shown(v)}`);
  return xy;
}

const distance = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);

/** The chain as plain numbers: the start points, the lengths, the target, the windows (null for none), the parent's angle. */
function readChain(chain) {
  if (chain === null || typeof chain !== 'object' || Array.isArray(chain)) refuse(`chain is an object {points, target, lengths?, limits?, parentAngle?, passes?} — not ${shown(chain)}`);
  for (const k of Object.keys(chain)) if (!KEYS.includes(k)) refuse(`chain takes ${KEYS.join(', ')} — not ${shown(k)}`);
  const points = listOf(stored(chain, 'points', 'points'), 'points', LEAST_PARTS + 1, MOST_PARTS + 1, `the joints' points from the root to the end, ${LEAST_PARTS + 1} to ${MOST_PARTS + 1} of them (a chain of ${LEAST_PARTS} to ${MOST_PARTS} parts)`)
    .map((p, i) => pointOf(p, `points[${i}]`));
  const n = points.length - 1;
  const given = stored(chain, 'lengths', 'lengths');
  const lengths = given === undefined ? points.slice(1).map((p, i) => distance(points[i], p)) : listOf(given, 'lengths', n, n, `${n} part lengths, one a part (the points make ${n} parts)`);
  lengths.forEach((l, i) => {
    if (!(finite(l) && l > 0 && l <= MOST_LENGTH)) refuse(`lengths[${i}] is a part's length in px, above 0 and at most ${MOST_LENGTH} — not ${shown(l)}${given === undefined ? ' (measured between points ' + i + ' and ' + (i + 1) + '; give `lengths`, or points apart)' : ''}`);
  });
  const target = pointOf(stored(chain, 'target', 'target'), 'target');
  const windows = stored(chain, 'limits', 'limits');
  const limits = windows === undefined ? lengths.map(() => null) : listOf(windows, 'limits', n, n, `${n} windows, one a part, each [min, max] or null`).map((w, i) => windowOf(w, `limits[${i}]`));
  const parentAngle = stored(chain, 'parentAngle', 'parentAngle') ?? 0;
  if (!(finite(parentAngle) && Math.abs(parentAngle) <= FAR)) refuse(`parentAngle is the world angle (radians) of the part the chain hangs from, a number no further than ${FAR} from 0 — not ${shown(parentAngle)}`);
  const passes = stored(chain, 'passes', 'passes') ?? MOST_PASSES;
  if (!(Number.isInteger(passes) && passes >= 1 && passes <= MOST_PASSES)) refuse(`passes is the most passes to run, a whole number from 1 to ${MOST_PASSES} — not ${shown(passes)}`);
  return { points, lengths, target, limits, parentAngle, passes };
}

/** A window [min, max] (§1): finite, each end within [−2π, 2π], min ≤ max, less than a turn wide; null or left out for none. */
function windowOf(w, what) {
  if (w === null || w === undefined) return null;
  const words = `a window [min, max] in radians, each end within [−2π, 2π], min ≤ max and less than a whole turn (2π) wide, or null`;
  const [lo, hi] = Array.isArray(w) && w.length === 2 ? listOf(w, what, 2, 2, words) : refuse(`${what} is ${words} — not ${shown(w)}`);
  if (!(finite(lo) && finite(hi) && Math.abs(lo) <= TURN && Math.abs(hi) <= TURN && lo <= hi && hi - lo < TURN)) refuse(`${what} is ${words} — not [${shown(lo)},${shown(hi)}]`);
  return { lo, hi, mid: (lo + hi) / 2 };
}

// ---- the solve ----

/** A relative angle read in its window (§1: the value plus the multiple of 2π nearest the window's middle). */
const readIn = (relative, w) => w.mid + wrapAngle(relative - w.mid);
/** A read angle held inside its window: the nearer end when it lies outside (within half a turn of the middle, the
 *  nearer end on the line is the nearer one round the circle, because the window is less than a turn wide). */
const held = (read, w) => (read < w.lo ? w.lo : read > w.hi ? w.hi : read);

const angleOf = (u) => Math.atan2(u[1], u[0]);
const along = (angle) => [Math.cos(angle), Math.sin(angle)];

/** The way from a to b as a unit vector, or `otherwise` when they are closer than `none` (no direction, only rounding). */
function wayOr(a, b, none, otherwise) {
  const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy);
  return d > none ? [dx / d, dy / d] : otherwise;
}

const step = (from, u, length) => [from[0] + u[0] * length, from[1] + u[1] * length];

/** Whether every joint and the target lie within `none` of one line through the root (along the way to the furthest of
 *  them; along `otherwise` when all sit on the root). */
function inLine(p, target, none, otherwise) {
  const all = [...p.slice(1), target], root = p[0];
  const far = all.reduce((a, q) => (distance(root, q) > distance(root, a) ? q : a), root);
  const u = wayOr(root, far, none, otherwise);
  return all.every((q) => Math.abs((q[0] - root[0]) * u[1] - (q[1] - root[1]) * u[0]) <= none);
}

/** Forward: the end on the target, then each joint back to its length from its child, end to root. A limited child is
 *  turned back into its window about its joint by turning this part (the 2016 paper's rule, read from the end). */
function forward(p, c) {
  const n = c.lengths.length;
  p[n] = c.target;
  for (let i = n - 1; i >= 0; i--) {
    let u = wayOr(p[i], p[i + 1], c.none, c.start[i]); // this part's way, from its joint to its child's
    const w = i + 1 < n ? c.limits[i + 1] : null;
    if (w) {
      const child = angleOf(wayOr(p[i + 1], p[i + 2], c.none, c.start[i + 1]));
      const read = readIn(child - angleOf(u), w), kept = held(read, w);
      if (kept !== read) u = along(child - kept);
    }
    p[i] = step(p[i + 1], u, -c.lengths[i]);
  }
}

/** Backward: the root on its place, then each joint at its length from its parent, root to end, each limited part turned
 *  back into its window about its joint. Gives the indices of the parts whose window bound. */
function backward(p, c) {
  const n = c.lengths.length, bound = [];
  p[0] = c.root;
  let parent = c.parentAngle;
  for (let i = 0; i < n; i++) {
    let u = wayOr(p[i], p[i + 1], c.none, c.start[i]);
    const w = c.limits[i];
    if (w) {
      const read = readIn(angleOf(u) - parent, w), kept = held(read, w);
      if (kept !== read) { u = along(parent + kept); bound.push(i); }
      parent += kept;
    } else if (i + 1 < n && c.limits[i + 1]) parent = angleOf(u);
    p[i + 1] = step(p[i], u, c.lengths[i]);
  }
  return bound;
}

/** Each part's relative angle from the solved points: in its window when it has one, else the turn nearest its relative
 *  angle in the start pose (so a part never jumps a whole turn between two solves of one move, §3 continuity). */
function relativeAngles(p, c) {
  let parent = c.parentAngle;
  return c.lengths.map((_, i) => {
    const relative = angleOf(wayOr(p[i], p[i + 1], c.none, c.start[i])) - parent, w = c.limits[i];
    const before = wrapAngle(angleOf(c.start[i]) - (i ? angleOf(c.start[i - 1]) : c.parentAngle));
    const read = w ? held(readIn(relative, w), w) : before + wrapAngle(relative - before);
    parent += read;
    return read;
  });
}

/**
 * Solve a chain for a target. `points` are the start pose's joints, the root first and the chain's end last; `lengths` the
 * parts' lengths (left out: the start's own distances); `limits` one window [min, max] or null a part, on its relative
 * angle; `parentAngle` the world angle of the part the chain hangs from (0); `passes` the most passes (16).
 * Gives frozen plain data: the solved `points` (the root where it was given), each part's relative `angles`, `reached`
 * (the end under 0.1 px from the target), `miss` (px), the `passes` run, and `bound` (the parts whose window held them).
 * A target past the whole chain's length, with no limits, is met by the chain laid straight toward it (no pass needed).
 */
export function fabrik(chain) {
  const read = readChain(chain), n = read.lengths.length, total = read.lengths.reduce((s, l) => s + l, 0);
  const none = NONE_SHARE * total, root = read.points[0];
  // each part's way in the start pose: the fallback for a direction lost to rounding; a start part with none takes its parent's
  const start = [];
  read.lengths.forEach((_, i) => start.push(wayOr(read.points[i], read.points[i + 1], none, i ? start[i - 1] : along(read.parentAngle))));
  let p = read.points.map((q) => [...q]), passes = 0, bound = [];
  if (read.limits.every((w) => w === null) && distance(root, read.target) >= total - none) {
    // out of reach (or exactly at full reach): straight toward the target, the closest the end can come
    const u = wayOr(root, read.target, none, start[0]);
    for (let i = 0; i < n; i++) p[i + 1] = step(p[i], u, read.lengths[i]);
  } else {
    if (inLine(p, read.target, none, start[0])) {
      // §10's named degenerate case, the joints and the target in a line: each joint bent IN_LINE_BEND, the same way every time
      const turns = start.map((u, i) => (i ? wrapAngle(angleOf(u) - angleOf(start[i - 1])) : angleOf(u)));
      let world = 0;
      p = [root];
      turns.forEach((turn, i) => { world += turn + IN_LINE_BEND; start[i] = along(world); p.push(step(p[i], start[i], read.lengths[i])); });
    }
    const c = { ...read, root, start, none };
    while (passes < read.passes) {
      forward(p, c);
      bound = backward(p, c);
      passes++;
      if (distance(p[n], read.target) < TOLERANCE) break;
    }
  }
  const miss = distance(p[n], read.target);
  return Object.freeze({
    points: Object.freeze(p.map((q) => Object.freeze(q))),
    angles: Object.freeze(relativeAngles(p, { ...read, start, none })),
    reached: miss < TOLERANCE,
    miss,
    passes,
    bound: Object.freeze(bound),
  });
}
