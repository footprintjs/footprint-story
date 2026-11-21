/**
 * Outlines on the frame: how far a ray runs before it leaves a shape (an outline, or a box), and a round thing's outline
 * as points round it. Plain numbers in, plain numbers out; nothing is drawn.
 *
 *   exitOutline(points, p, u)        → px from p along the unit vector u until the outline is left (Infinity: never)
 *   exitBox({x, y, w, h}, p, u)      → the same for a box, p inside it
 *   roundOutline(top, bottom)        → [{x, y}, …]: the upper half of a cylinder's top, then the lower half of its foot
 *
 * WHY here: a wire drawn straight between two blocks starts where a ray from a block's middle leaves what the block
 * draws, a label keeps off what a block draws, and a deck and a film must find the same edge. They came from StoryDeck
 * 0.29.0 (deck/boxes.js · exitOutline, exit; deck/iso.js · roundOutline), which StoryReel 0.34.0 had copied (its
 * cables.mjs · exitOutline, build.mjs · roundOutline); a property test holds each to those copies (test/control/).
 */
import { framePoints, own, refuse, shown } from './thing.js';

/** The most points an outline read here may have, and the most steps a round outline is drawn in. */
export const MOST_OUTLINE = 65_536;
const MOST_STEPS = 1024;

/** [x, y], any two numbers (a ray's arithmetic answers NaN and Infinity as it always did); a new list. */
export function pairOf(v, what) {
  const p = Array.isArray(v) && v.length === 2 ? [own(v, 0), own(v, 1)] : null;
  if (!p || !p.every((n) => typeof n === 'number')) refuse(`${what} is [x, y], two numbers — not ${shown(v)}`);
  return p;
}

/** A box {x, y, w, h}, each its own stored number. */
export function boxOf(v, what) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) refuse(`${what} is a box {x, y, w, h} — not ${shown(v)}`);
  const b = { x: own(v, 'x'), y: own(v, 'y'), w: own(v, 'w'), h: own(v, 'h') };
  if (!Object.values(b).every((n) => typeof n === 'number')) refuse(`${what} is a box {x, y, w, h}, four numbers — not ${shown([b.x, b.y, b.w, b.h])}`);
  return b;
}

/** The ray itself, both its points read once. */
function rayOf(p, u) { return [pairOf(p, 'the ray\'s start'), pairOf(u, 'the ray\'s way')]; }

/** exitOutline on points already read. */
export function exitPoints(points, [px, py], [ux, uy]) {
  let least = Infinity;
  points.forEach(([ax, ay], i) => {
    const [bx, by] = points[(i + 1) % points.length], ex = bx - ax, ey = by - ay, cross = ux * ey - uy * ex;
    if (Math.abs(cross) < 1e-12) return;   // the ray runs along this side: it leaves by another
    const t = ((ax - px) * ey - (ay - py) * ex) / cross, along = ((ax - px) * uy - (ay - py) * ux) / cross;
    if (t > 1e-9 && along >= -1e-9 && along <= 1 + 1e-9) least = Math.min(least, t);
  });
  return least;
}

/**
 * How far a ray from `p` along the unit vector `u` runs before it leaves an outline: `points` round a shape with no
 * dent, [[x, y], …], `p` inside it. Infinity when it never does (a point outside, running away; an empty outline).
 */
export function exitOutline(points, p, u) {
  const read = framePoints(points, 'an outline', { anyNumber: true, most: MOST_OUTLINE }), [from, way] = rayOf(p, u);
  return exitPoints(read, from, way);
}

/** exitBox on a box already read. */
export function exitBoxRead(b, [px, py], [ux, uy]) {
  const tx = ux > 0 ? (b.x + b.w - px) / ux : ux < 0 ? (b.x - px) / ux : Infinity;
  const ty = uy > 0 ? (b.y + b.h - py) / uy : uy < 0 ? (b.y - py) / uy : Infinity;
  return Math.min(tx, ty);
}

/** How far a ray from `p` (inside the box {x, y, w, h}) along the unit vector `u` runs before it leaves the box. */
export function exitBox(box, p, u) {
  const b = boxOf(box, 'exitBox\'s box'), [from, way] = rayOf(p, u);
  return exitBoxRead(b, from, way);
}

/** An ellipse {cx, cy, rx, ry} (what grid.cylinder gives as top and bottom), each its own stored number. */
function ellipseOf(v, what) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) refuse(`${what} is an ellipse {cx, cy, rx, ry} (grid.cylinder's top or bottom) — not ${shown(v)}`);
  const e = { cx: own(v, 'cx'), cy: own(v, 'cy'), rx: own(v, 'rx'), ry: own(v, 'ry') };
  if (!Object.values(e).every((n) => typeof n === 'number')) refuse(`${what} is an ellipse {cx, cy, rx, ry}, four numbers — not ${shown([e.cx, e.cy, e.rx, e.ry])}`);
  return e;
}

/**
 * A round thing's outline as points round it: the upper half of its top, then the lower half of its foot, each in
 * `steps` runs — [{x, y}, …], 2 × (steps + 1) points, as grid.block gives a block's `outline`. `top`, `bottom`: what
 * grid.cylinder gives.
 */
export function roundOutline(top, bottom, steps = 12) {
  const t = ellipseOf(top, 'roundOutline\'s top'), b = ellipseOf(bottom, 'roundOutline\'s bottom');
  if (!(Number.isInteger(steps) && steps >= 1 && steps <= MOST_STEPS)) refuse(`roundOutline draws each half in 1 to ${MOST_STEPS} steps, a whole number — not ${shown(steps)}`);
  const arc = (e, from) => Array.from({ length: steps + 1 }, (_, i) => { const a = from + (Math.PI * i) / steps; return { x: e.cx + e.rx * Math.cos(a), y: e.cy + e.ry * Math.sin(a) }; });
  return [...arc(t, Math.PI), ...arc(b, 0)];
}
