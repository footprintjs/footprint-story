/**
 * Whether a moving block passes through another: swept between two samples, never only sampled. Plain numbers in tiles.
 *
 *   sweptThrough(size, from, to, others)   the block it goes deepest into on one straight stretch, and how deep, or null
 *   checkMoments(seconds, start?)          the moments a move is checked at: its ends and CHECKS_PER_SECOND between
 *   deepestPass(stretches)                 the deepest pass over a move's stretches, and when, or null
 *   passFinding(hit, move)                 that pass as a finding, {critic: 'contact', level, message, fix}
 *
 * Moved from StoryReel 0.44.0 (motion-place.mjs · sweptThrough; motion.mjs · samplesOf, throughFindings) and StoryDeck
 * 0.37.0 (motionPlace.js · sweptThrough; motionPlan.js · checkTimes, throughFindings): the same rule twice.
 */
import { finite, numbers, own, refuse, shown } from './thing.js';

/**
 * How deep a moving block may go into another before it is said to pass through it, in tiles: a twentieth of a tile.
 * Ours. WHY not 0: a block resting on a top touches it, and a place worked back from the frame (footTiles) is exact only
 * to a few billionths.
 */
export const THROUGH_MOST = 0.05;
/** How often a move is checked, a second: the film's frame rate. Ours (StoryReel's and StoryDeck's number). */
export const CHECKS_PER_SECOND = 30;
/** The most steps a move is checked in: a 30 s move at CHECKS_PER_SECOND. Ours. */
export const MOST_CHECKS = 900;
/** Golden-section steps: the stretch narrowed to 0.618⁶⁰ ≈ 3e-13 of itself, far under a pixel on any stretch a grid draws. */
const GOLDEN_STEPS = 60;
const GOLDEN = (Math.sqrt(5) - 1) / 2;

const corner = (v, what) => { const p = numbers(v, [2, 3], what, '[col, row] or [col, row, lift], a corner in tiles'); return [p[0], p[1], p[2] ?? 0]; };
const sizeOf = (v, what) => {
  const s = numbers(v, [3], what, '[wide, deep, high], in tiles');
  if (!(s[0] > 0 && s[1] > 0 && s[2] >= 0)) refuse(`${what} is [wide, deep, high] with wide and deep above 0 and high 0 or more — not ${shown(v)}`);
  return s;
};
function mover(o, what) {
  if (!o || typeof o !== 'object') refuse(`${what} is {block: {size}, from, to} — not ${shown(o)}`);
  const block = own(o, 'block');
  if (!block || typeof block !== 'object') refuse(`${what}'s block is an object with a size — not ${shown(block)}`);
  return { block, size: sizeOf(own(block, 'size'), `${what}'s block's size`), from: corner(own(o, 'from'), `${what}'s from`), to: corner(own(o, 'to'), `${what}'s to`) };
}

/**
 * The deepest a block of `size` goes into the `others` on the straight stretch from corner `from` to corner `to`, each
 * other ({block: {size}, from, to}: corners) moving straight over the same time too: {block, depth, share} — the other as
 * given, how deep (tiles, the least overlap along the three axes) and the share of the stretch where it is deepest — of
 * the deepest past THROUGH_MOST, or null. WHY swept, not sampled: a move is sampled 30 times a second, and a 30-tile
 * reach covers a tile and more between two samples — a block a tenth of a tile thin stands wholly between them. Over a
 * stretch the overlap along each axis (the lesser of two ends, less the greater of two starts, each moving straight) is
 * concave in the share, so their least is too, and its highest point is found by golden-section search: nothing between
 * the two samples is skipped.
 */
export function sweptThrough(size, from, to, others) {
  const s = sizeOf(size, "sweptThrough's size"), a = corner(from, "sweptThrough's from"), z = corner(to, "sweptThrough's to");
  if (!Array.isArray(others)) refuse(`sweptThrough's others is a list of {block, from, to} — not ${shown(others)}`);
  let deepest = null;
  const lerp = (p, q, u) => p + (q - p) * u;
  others.forEach((given, i) => {
    const o = mover(given, `sweptThrough's others[${i}]`);
    // the stretch's whole box against the other's: apart along one axis all the way, there is nothing to search
    if ([0, 1, 2].some((k) => Math.max(a[k], z[k]) + s[k] <= Math.min(o.from[k], o.to[k]) || Math.max(o.from[k], o.to[k]) + o.size[k] <= Math.min(a[k], z[k]))) return;
    const depthAt = (u) => Math.min(...[0, 1, 2].map((k) => {
      const p = lerp(a[k], z[k], u), q = lerp(o.from[k], o.to[k], u);
      return Math.min(p + s[k], q + o.size[k]) - Math.max(p, q);
    }));
    let lo = 0, hi = 1;
    for (let n = 0; n < GOLDEN_STEPS; n += 1) {
      const m1 = hi - GOLDEN * (hi - lo), m2 = lo + GOLDEN * (hi - lo);
      if (depthAt(m1) < depthAt(m2)) lo = m1; else hi = m2;
    }
    // the ends too: a deepest point at an end is reached by the search only to within its last step
    const mid = (lo + hi) / 2, best = [0, 1, mid].reduce((x, u) => (depthAt(u) > depthAt(x) ? u : x), mid), depth = depthAt(best);
    if (depth > THROUGH_MOST && (!deepest || depth > deepest.depth)) deepest = { block: o.block, depth, share: best };
  });
  return deepest;
}

/**
 * The moments a move of `seconds` is checked at, from `start` (0 when left out): its start, its end, and
 * CHECKS_PER_SECOND a second between — at least 2 steps, at most MOST_CHECKS. Each pair of neighbours is one stretch the
 * pass-through check sweeps (sweptThrough), so a fast move skips nothing however thin a block; only the bend of the way
 * within a step (a thirtieth of a second) is taken straight.
 */
export function checkMoments(seconds, start = 0) {
  if (!(finite(seconds) && seconds > 0)) refuse(`checkMoments' seconds is how long the move takes, above 0 — not ${shown(seconds)}`);
  if (!finite(start)) refuse(`checkMoments' start is when the move begins, in seconds — not ${shown(start)}`);
  const n = Math.min(MOST_CHECKS, Math.max(2, Math.ceil(seconds * CHECKS_PER_SECOND)));
  return Array.from({ length: n + 1 }, (_, k) => start + (k / n) * seconds);
}

/**
 * The deepest pass over a move's stretches: each stretch {t0, t1, size, from, to, others} (seconds; the moving block's
 * size and corners at t0 and t1; the others as sweptThrough takes them, where each stands at t0 and t1) swept, and of all
 * the passes past THROUGH_MOST the deepest (of two alike, the first) — {block, depth, t} with `t` the moment it is
 * deepest — or null. A turning block is handed as more, shorter stretches, each at the box its turned corners fill.
 */
export function deepestPass(stretches) {
  if (!Array.isArray(stretches)) refuse(`deepestPass takes a list of stretches, {t0, t1, size, from, to, others} — not ${shown(stretches)}`);
  let worst = null;
  stretches.forEach((st, i) => {
    if (!st || typeof st !== 'object') refuse(`deepestPass's stretches[${i}] is {t0, t1, size, from, to, others} — not ${shown(st)}`);
    const t0 = own(st, 't0'), t1 = own(st, 't1');
    if (!(finite(t0) && finite(t1) && t1 >= t0)) refuse(`deepestPass's stretches[${i}] has t0 and t1 in seconds, t1 not before t0 — not ${shown([t0, t1])}`);
    const hit = sweptThrough(own(st, 'size'), own(st, 'from'), own(st, 'to'), own(st, 'others'));
    if (hit && (!worst || hit.depth > worst.depth)) worst = { block: hit.block, depth: hit.depth, t: t0 + hit.share * (t1 - t0) };
  });
  return worst;
}

const round3 = (v) => Math.round(v * 1000) / 1000;
const nameOf = (block) => { const n = block !== null && typeof block === 'object' ? own(block, 'name') : undefined; return typeof n === 'string' ? n : 'a block'; };

/**
 * A pass (deepestPass's, its `t` in seconds from the move's start) as a finding: {critic: 'contact', level: 'warn',
 * message, fix}, in words free of any tool's syntax — a tool puts its own prefix on the critic ('reel:contact',
 * 'deck:contact') and may write the fix in its own syntax. `move` is {do, tie}: a move tied at its top (a hang) is told
 * to swing clear, a throw or a tumble to land clear, any other to go round.
 */
export function passFinding(hit, move) {
  if (!hit || typeof hit !== 'object' || !finite(own(hit, 't')) || !finite(own(hit, 'depth'))) refuse(`passFinding's hit is deepestPass's {block, depth, t} — not ${shown(hit)}`);
  if (!move || typeof move !== 'object') refuse(`passFinding's move is {do, tie} — not ${shown(move)}`);
  const name = nameOf(own(hit, 'block')), how = own(move, 'do');
  const fix = own(move, 'tie') === 'top' ? `move "${name}" out of its swing, or move its pin so it swings clear`
    : how === 'throw' || how === 'tumble' ? `${how} it to a place clear of "${name}", or move "${name}" out of its way`
      : `move it round "${name}": a place clear of it, or throw it over`;
  return { critic: 'contact', level: 'warn', message: `at ${round3(own(hit, 't'))} s it goes ${round3(own(hit, 'depth'))} tiles into "${name}" — it passes through a block`, fix };
}
