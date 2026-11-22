/**
 * What a block at rest hides: another block's name (its lines and small line on its top) that a moved block is drawn
 * over. A ball thrown onto a server's top sits on the server's name. Plain numbers in frame pixels; nothing is drawn.
 *
 *   nameBox(name, small, centre)          a name's box on the frame, from its fitted lines alone (NAME_WIDTH a letter)
 *   overlapsBox(points, box)              whether a convex outline and a box overlap
 *   orderAt(grid, things)                 the paint order of things where a moment puts them (grid.backToFront), by index
 *   hiddenNames(grid, things, names, covers)   which resting block hides each name, or null
 *   coverFinding(name, label)             a move that comes to rest over a name, as a finding {critic: 'covers', …}
 *
 * WHY a tool asks: a name a moved block covers is not there to read, so the tool ends its reading span while it is
 * covered and says so, rather than leaving a contrast check to find a word "too faint" behind a block — which would
 * depend on how wide the host's font draws it. Only a block at REST hides a name: one passing over it in flight is a
 * moment of natural occlusion, drawn as it is. Moved from StoryReel 0.44.0 (motion-cover.mjs) and StoryDeck 0.37.0
 * (motionPlace.js · nameBox, overlapsBox; motionPlan.js · coversOf).
 */
import { readGrid } from './grid.js';
import { finite, framePoints, own, refuse, shown } from './thing.js';

/**
 * How wide a letter of a name is taken, as a share of its size. Ours: the widest letters a sans font draws — a bold "W",
 * a full-width character — are about one em (DejaVu Sans Bold's "W" 1.03, Avenir Next's 0.95, a full-width form 1.0), so
 * 1.2 holds for any font a tool may meet, with room. Font-free: every host decides the same, and a name that could peek
 * out from under a block on any host is counted covered.
 */
export const NAME_WIDTH = 1.2;
/** A line of a name, as tall as 1.15 of its size; the small line 2 px under the name. The map's names step's numbers (mapSteps.js · names). */
const LINE = 1.15, SMALL_GAP = 2;

/** A letter: a code point (a mark written apart counts as one more, so the box only grows). */
const letters = (s) => [...s].length;

/**
 * A block's words on its top as a box on the frame, [x0, y0, x1, y1], round `centre` ([x, y], the top's middle), or null
 * when its name has no lines. `name` is {lines, size} as wordsToFit gives it; `small` (or null) is {text, size}: the
 * small line under it as drawn, one line. Each line is NAME_WIDTH of its size a letter wide, the name's lines LINE of
 * its size tall, the small line SMALL_GAP under them.
 */
export function nameBox(name, small, centre) {
  if (!name || typeof name !== 'object') refuse(`nameBox's name is {lines, size}, as wordsToFit gives it — not ${shown(name)}`);
  const lines = own(name, 'lines') ?? [], size = own(name, 'size');
  if (!Array.isArray(lines) || !lines.every((l) => typeof l === 'string')) refuse(`nameBox's name's lines is a list of words — not ${shown(lines)}`);
  if (!lines.length) return null;
  if (!(finite(size) && size > 0)) refuse(`nameBox's name's size is its letters' size in pixels, above 0 — not ${shown(size)}`);
  let low = 0, smallWide = 0;
  if (small !== null && small !== undefined) {
    const text = own(small, 'text'), smallSize = own(small, 'size');
    if (typeof text !== 'string' || !(finite(smallSize) && smallSize > 0)) refuse(`nameBox's small is null, or {text, size}: its words and their size in pixels — not ${shown(small)}`);
    if (text.length) { low = smallSize * LINE + SMALL_GAP; smallWide = letters(text) * smallSize; }
  }
  const [cx, cy] = framePoints([centre], "nameBox's centre")[0], height = lines.length * size * LINE + low;
  const wide = Math.max(...lines.map((l) => letters(l) * size), smallWide) * NAME_WIDTH;
  return [cx - wide / 2, cy - height / 2, cx + wide / 2, cy + height / 2];
}

const area = (p) => p.reduce((s, [x, y], i) => { const [x2, y2] = p[(i + 1) % p.length]; return s + x * y2 - x2 * y; }, 0);
const boxOf = (v, what) => {
  const b = Array.isArray(v) && v.length === 4 ? [0, 1, 2, 3].map((i) => own(v, i)) : null;
  if (!b || !b.every(finite) || !(b[0] <= b[2] && b[1] <= b[3])) refuse(`${what} is [x0, y0, x1, y1] with x0 ≤ x1 and y0 ≤ y1 — not ${shown(v)}`);
  return b;
};

/**
 * Whether a convex outline (frame points, in order round it, either way) and a box ([x0, y0, x1, y1]) overlap: their
 * bounds meet (a shared edge is no overlap) and no side of the outline has every corner of the box beyond it. The two
 * tests together are the separating-axis test for a convex outline and a box.
 */
export function overlapsBox(points, box) {
  const p = framePoints(points, "overlapsBox's points"), [x0, y0, x1, y1] = boxOf(box, "overlapsBox's box");
  if (!p.length) return false;
  const xs = p.map((q) => q[0]), ys = p.map((q) => q[1]);
  if (Math.max(...xs) <= x0 || Math.min(...xs) >= x1 || Math.max(...ys) <= y0 || Math.min(...ys) >= y1) return false;
  const corners = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], n = p.length, turn = Math.sign(area(p));
  for (let i = 0; i < n; i += 1) {
    const [ax, ay] = p[i], [bx, by] = p[(i + 1) % n];
    if (corners.every(([x, y]) => turn * ((bx - ax) * (y - ay) - (by - ay) * (x - ax)) < 0)) return false;
  }
  return true;
}

/**
 * The paint order of `things` ({at, size} each: every piece the picture draws, where the moment puts it, in the tool's
 * own list order) on `grid`: their indices, the furthest first — grid.backToFront, the one sort. WHY every piece and not
 * the two in question: what is drawn over what is the whole picture's order, and two pieces that do not meet on the
 * frame are ordered only through the pieces between them (README.md · "Moving pieces").
 */
export function orderAt(grid, things) {
  if (!Array.isArray(things)) refuse(`orderAt's things is a list of {at, size} — not ${shown(things)}`);
  return readGrid(grid, 'orderAt').backToFront(things.map((_, i) => i), (i) => things[i]);
}

/**
 * Which resting block hides each name, at one moment: for each of `names` ({piece, box}: the index in `things` of the
 * block it is written on, and its box on the frame where that block is drawn now) the index of the first of `covers`
 * ({piece, outline}: a resting moved block's index in `things` and its outline on the frame now) that is another block,
 * whose outline overlaps the box (overlapsBox) and which is painted after the named block (orderAt of every piece in
 * `things`) — or null. The order is worked out only when an outline meets a box.
 */
export function hiddenNames(grid, things, names, covers) {
  if (!Array.isArray(things)) refuse(`hiddenNames' things is a list of {at, size} — not ${shown(things)}`);
  const index = (v, what) => { if (!(Number.isInteger(v) && v >= 0 && v < things.length)) refuse(`${what} is the index of a thing in things, 0 to ${things.length - 1} — not ${shown(v)}`); return v; };
  if (!Array.isArray(names)) refuse(`hiddenNames' names is a list of {piece, box} — not ${shown(names)}`);
  if (!Array.isArray(covers)) refuse(`hiddenNames' covers is a list of {piece, outline} — not ${shown(covers)}`);
  const by = covers.map((c, j) => ({ piece: index(own(c ?? {}, 'piece'), `hiddenNames' covers[${j}].piece`), outline: framePoints(own(c ?? {}, 'outline'), `hiddenNames' covers[${j}].outline`) }));
  let rank = null;
  const rankOf = () => (rank ??= new Map(orderAt(grid, things).map((i, r) => [i, r])));
  return names.map((n, k) => {
    const piece = index(own(n ?? {}, 'piece'), `hiddenNames' names[${k}].piece`), box = boxOf(own(n ?? {}, 'box'), `hiddenNames' names[${k}].box`);
    const hit = by.find((c) => c.piece !== piece && overlapsBox(c.outline, box) && rankOf().get(c.piece) > rankOf().get(piece));
    return hit ? hit.piece : null;
  });
}

/**
 * A move that comes to rest over another block's name, as a finding: {critic: 'covers', level: 'warn', message, fix},
 * in words free of any tool's syntax — a tool puts its own prefix on the critic ('reel:covers', 'deck:covers'). `name` is
 * the named block's name, `label` its words as drawn.
 */
export function coverFinding(name, label) {
  if (typeof name !== 'string' || typeof label !== 'string') refuse(`coverFinding takes the block's name and its words, two strings — not ${shown([name, label])}`);
  return { critic: 'covers', level: 'warn', message: `it comes to rest over "${name}"'s name ("${label}"), which is hidden from then`,
    fix: `land it clear of the name (a place beside "${name}", or a corner of its top), or accept it when it is meant` };
}
