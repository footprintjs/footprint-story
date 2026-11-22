/**
 * Where a moving block stands on an isometric floor, and what holds it: its foot and its top, the top it lands on, whether
 * its middle is over that top, and whether one block rests on another. Plain numbers in tiles; nothing is drawn.
 *
 *   footOf(at, size) · topOf(at, size) · cornerOf(foot, size)   a block's foot and top from its corner `at`, and back
 *   landingUnder(at, size, others)                              the highest top under a block that is not above it
 *   overTop(foot, under)                                        whether a foot is over that top (the floor holds everywhere)
 *   ridesOn(rider, base)                                        whether `rider` rests on the top of `base`
 *
 * A block is {at: [col, row, lift?], size: [wide, deep, high]}; `at` is its corner, as the grid takes it. A block moves by
 * its FOOT: the middle of its footprint, at its lift — the point a fall drops and a throw lands. Moved from StoryReel
 * 0.44.0 (src/kits/isometric/motion-place.mjs) and StoryDeck 0.37.0 (deck/motionPlace.js), which held the same rules
 * twice (README.md · "Moving pieces").
 */
import { numbers, own, refuse, shown } from './thing.js';

/** How close two numbers may be and still count as one place, in tiles: far under what a pixel shows. Ours. */
export const SAME_PLACE = 1e-6;

const point = (v, what) => { const p = numbers(v, [2, 3], what, '[col, row] or [col, row, lift], in tiles'); return [p[0], p[1], p[2] ?? 0]; };
const sizeOf = (v, what) => {
  const s = numbers(v, [3], what, '[wide, deep, high], in tiles');
  if (!(s[0] > 0 && s[1] > 0 && s[2] >= 0)) refuse(`${what} is [wide, deep, high] with wide and deep above 0 and high 0 or more — not ${shown(v)}`);
  return s;
};
/** A {block, at} pair read: the block as given (it is handed back by identity), its size and its corner checked. */
function standing(o, what) {
  if (!o || typeof o !== 'object') refuse(`${what} is {block: {size}, at: [col, row, lift?]} — not ${shown(o)}`);
  const block = own(o, 'block');
  if (!block || typeof block !== 'object') refuse(`${what}'s block is an object with a size — not ${shown(block)}`);
  return { block, size: sizeOf(own(block, 'size'), `${what}'s block's size`), at: point(own(o, 'at'), `${what}'s at`) };
}

/** A block's foot in tiles: the middle of its footprint, at its lift. */
export function footOf(at, size) { const [c, r, z] = point(at, "footOf's at"), s = sizeOf(size, "footOf's size"); return [c + s[0] / 2, r + s[1] / 2, z]; }
/** A block's top in tiles: the middle of its footprint, at its lift and its height. */
export function topOf(at, size) { const [c, r, z] = point(at, "topOf's at"), s = sizeOf(size, "topOf's size"); return [c + s[0] / 2, r + s[1] / 2, z + s[2]]; }
/** A block's corner from its foot: what `at` a block of `size` has when its foot stands there. */
export function cornerOf(foot, size) { const [c, r, z] = point(foot, "cornerOf's foot"), s = sizeOf(size, "cornerOf's size"); return [c - s[0] / 2, r - s[1] / 2, z]; }

/** How far two spans overlap (0 when they do not). */
const overlap = (a0, a1, b0, b1) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));

/**
 * Where a block falls to: the highest top of the `others` ({block: {size}, at} each, `at` its corner) whose footprint
 * overlaps its own by more than SAME_PLACE both ways and which is not above its foot, else the floor — {lift, block, at}:
 * `block` the other as given (null for the floor), `at` its corner (null for the floor). Of two tops at one height the
 * first given. WHY the highest: a box dropped over a server lands on the server, never through it to the floor. WHY an
 * overlap past SAME_PLACE: a block standing beside another, edge to edge, is not on it.
 */
export function landingUnder(at, size, others) {
  const [c, r, z] = point(at, "landingUnder's at"), s = sizeOf(size, "landingUnder's size");
  if (!Array.isArray(others)) refuse(`landingUnder's others is a list of {block, at} — not ${shown(others)}`);
  let best = { lift: 0, block: null, at: null };
  others.forEach((o, i) => {
    const other = standing(o, `landingUnder's others[${i}]`), top = other.at[2] + other.size[2];
    if (top > z + SAME_PLACE || top <= best.lift) return;
    if (overlap(c, c + s[0], other.at[0], other.at[0] + other.size[0]) > SAME_PLACE && overlap(r, r + s[1], other.at[1], other.at[1] + other.size[1]) > SAME_PLACE) best = { lift: top, block: other.block, at: other.at };
  });
  return best;
}

/**
 * Whether a foot (the middle of a footprint, tiles) is over what holds it — `under` as landingUnder gives it: inside that
 * block's top, edges included (within SAME_PLACE), or anywhere on the floor (`block` null). WHY its middle: a body whose
 * middle is past the edge of the top it rests on would tip off it, however much of its footprint still overlaps the top.
 */
export function overTop(foot, under) {
  const [c, r] = point(foot, "overTop's foot");
  if (!under || typeof under !== 'object') refuse(`overTop's under is what landingUnder gives, {block, at} — not ${shown(under)}`);
  if (own(under, 'block') === null || own(under, 'block') === undefined) return true;
  const top = standing(under, "overTop's under");
  return [c, r].every((v, k) => v >= top.at[k] - SAME_PLACE && v <= top.at[k] + top.size[k] + SAME_PLACE);
}

/**
 * Whether `rider` ({block, at}) rests on the top of `base` ({block, at}): its footprint overlaps base's top (as
 * landingUnder reads an overlap) and its lift is base's top, within SAME_PLACE. WHY a tool asks: a block moved from
 * under a rider would leave the rider standing on nothing — a picture that is wrong — and only the writer knows whether
 * the rider goes too, so the tool refuses the move and names both.
 */
export function ridesOn(rider, base) {
  const r = standing(rider, "ridesOn's rider"), b = standing(base, "ridesOn's base"), top = b.at[2] + b.size[2];
  return Math.abs(r.at[2] - top) < SAME_PLACE && landingUnder(r.at, r.size, [{ block: b.block, at: b.at }]).block === b.block;
}
