/**
 * Under: the floor under a box of the frame, and whether a way on the frame passes through a box. Words that float over
 * a picture — a name, a note, a callout — stand in a box of the frame, not on the floor; a route keeps off the floor
 * they cover (`routes` · `keep`) only once that floor is known in tiles. And whether a route that could not keep off
 * really runs under the words is asked of the box itself, on the frame.
 *
 *   floorUnder({x, y, w, h}, grid, {lift})   → {stretches: [{at: [col, row, lift], size: [wide, deep]}, …], why: null}
 *                                              (`routes`' keep, as it takes it) — or {stretches: null, why, squares}
 *   crossesBox(points, {x, y, w, h})          → whether a way through `points` passes strictly inside the box
 *
 * WHY the floor under the box: a route lies on the floor, so words cover it where the floor under them is — the points
 * of the floor whose place on the frame falls in the box. Both came from StoryDeck 0.27.0 (deck/keepClear.js),
 * unchanged in what they give for what that gave them (a property test against a copy of that code, test/control/);
 * the reasons a box gets no floor are the kit's words now (NO_UNDER), so each tool says them in its own.
 */
import { readGrid } from './grid.js';
import { FAR, finite, framePoints, own, refuse, shown } from './thing.js';

/** The floor under a box is found in squares this many tiles a side (the router's lattice step, at its finest usual). */
export const UNDER_CELL = 0.5;
/**
 * Tiles each stretch reaches past its squares: the router asks whether a way is strictly inside kept floor, and two
 * stretches side by side meet on a line of the floor — a way along that line would be inside neither. A hair more
 * makes them overlap, so the line between them is kept floor too.
 */
const SEAM = 0.01;
/** The most squares of floor one box is asked over: a box the size of a slide on the smallest tile is far fewer. */
export const MOST_UNDER_SQUARES = 200_000;
/** Why a box has no floor under it here: the sentence `why` is, one of these. */
export const NO_UNDER = Object.freeze({
  far: `the box stands further than ${FAR} px from the frame`,
  big: `the box covers more than ${MOST_UNDER_SQUARES} squares of floor`,
  most: 'the floor under the box is more stretches than the most asked for',
});

/** A box of the frame, {x, y, w, h}, read by its own stored fields: finite numbers, wide and tall above 0 when `solid`. */
function readBox(box, solid, what) {
  const read = box !== null && typeof box === 'object' && !Array.isArray(box) ? ['x', 'y', 'w', 'h'].map((k) => own(box, k)) : null;
  if (!read || !read.every(finite) || (solid && !(read[2] > 0 && read[3] > 0))) refuse(`${what} is a box of the frame, {x, y, w, h} in pixels${solid ? ', w and h above 0' : ''} — not ${read ? shown(read) : shown(box)}`);
  return read;
}

/**
 * The floor under a box of the frame at a height, as stretches: {stretches: [{at: [col, row, lift], size: [wide,
 * deep]}, …], why: null} — every UNDER_CELL square of the floor at `lift` whose drawn diamond meets the box (exactly:
 * the box grown by the diamond, asked at its middle), those side by side along a row joined into one, each reaching
 * SEAM past its squares; row by row, then along the cols. `grid`: an isometric grid (its tile, origin and rise are
 * read). `most`: the most stretches to make (all, when left out) — counted as they are made, so many boxes sharing one
 * budget stop at it, not after.
 *
 * A box with no floor here gives {stretches: null, why, squares}: `why` one of NO_UNDER — `far` (a corner of the box,
 * or of it lowered to the floor at `lift`, is further than FAR px from the frame's 0), `big` (it covers more than
 * MOST_UNDER_SQUARES squares: counted before any square is looked at, so a box many frames wide on a tiny tile is
 * answered at once; `squares` says how many, Infinity past counting) or `most` (more stretches than `most`).
 */
export function floorUnder(box, grid, options = undefined) {
  const [x, y, w, h] = readBox(box, true, 'floorUnder: the box'), g = readGrid(grid, 'floorUnder');
  if (options !== undefined && options !== null && (typeof options !== 'object' || Array.isArray(options))) refuse(`floorUnder's options are {lift, most} — not ${shown(options)}`);
  const lift = (options && own(options, 'lift')) ?? 0, most = (options && own(options, 'most')) ?? Infinity;
  if (!(finite(lift) && Math.abs(lift) <= FAR)) refuse(`floorUnder's lift is the floor's height, a number no further than ${FAR} from 0 — not ${shown(lift)}`);
  if (!(most === Infinity || (Number.isInteger(most) && most >= 0))) refuse(`floorUnder's most is the most stretches to make, a whole number from 0 (or Infinity) — not ${shown(most)}`);
  const [tw, th] = g.tile, hw = UNDER_CELL * tw / 2, hh = UNDER_CELL * th / 2, up = lift * g.rise;
  // the floor at `lift` is drawn `up` px higher: the point of it under a frame point is the floor's under that point lowered
  if (![x, y, x + w, y + h + up].every((v) => Math.abs(v) <= FAR)) return { stretches: null, why: NO_UNDER.far, squares: null };
  const corners = [[x, y], [x + w, y], [x, y + h], [x + w, y + h]].map(([px, py]) => g.tileAt(px, py + up));
  const snap = (v, high) => (high ? Math.ceil(v / UNDER_CELL) : Math.floor(v / UNDER_CELL)) * UNDER_CELL;
  const c0 = snap(Math.min(...corners.map((p) => p.col)), false) - UNDER_CELL, c1 = snap(Math.max(...corners.map((p) => p.col)), true) + UNDER_CELL;
  const r0 = snap(Math.min(...corners.map((p) => p.row)), false) - UNDER_CELL, r1 = snap(Math.max(...corners.map((p) => p.row)), true) + UNDER_CELL;
  // counted before any square is looked at: a box many frames wide on a tiny tile is answered, never scanned
  const cells = ((c1 - c0) / UNDER_CELL) * ((r1 - r0) / UNDER_CELL);
  if (!(cells <= MOST_UNDER_SQUARES)) return { stretches: null, why: NO_UNDER.big, squares: Number.isFinite(cells) ? cells : Infinity };
  const meets = (col, row) => {
    const { x: cx, y: cy } = g.at(col + UNDER_CELL / 2, row + UNDER_CELL / 2, lift);
    const dx = Math.max(0, Math.abs(cx - (x + w / 2)) - w / 2), dy = Math.max(0, Math.abs(cy - (y + h / 2)) - h / 2);
    return dx / hw + dy / hh < 1;
  };
  const out = [];
  for (let row = r0; row < r1 - 1e-9; row += UNDER_CELL) {
    let from = null;
    for (let col = c0; col < c1 + 1e-9; col += UNDER_CELL) {
      const on = col < c1 - 1e-9 && meets(col, row);
      if (on && from === null) from = col;
      if (!on && from !== null) {
        if (out.length >= most) return { stretches: null, why: NO_UNDER.most, squares: cells };
        out.push({ at: [from - SEAM, row - SEAM, lift], size: [col - from + 2 * SEAM, UNDER_CELL + 2 * SEAM] }); from = null;
      }
    }
  }
  return { stretches: out, why: null, squares: cells };
}

/**
 * Whether a way on the frame, through `points` ([[x, y], …], straight between), passes strictly inside a box {x, y, w,
 * h}: a stretch of it that runs inside the box, not one along its edge or touching a corner. Each stretch is clipped to
 * the box's slab along x and along y in turn; what is left of it, if anything, is inside both.
 */
export function crossesBox(points, box) {
  const way = framePoints(points, 'crossesBox: the way');
  const [x, y, w, h] = readBox(box, false, 'crossesBox: the box');
  return way.slice(1).some(([qx, qy], k) => {
    const [px, py] = way[k];
    let t0 = 0, t1 = 1;
    for (const [delta, lo, hi, from] of [[qx - px, x, x + w, px], [qy - py, y, y + h, py]]) {
      if (Math.abs(delta) < 1e-12) { if (!(from > lo + 1e-9 && from < hi - 1e-9)) return false; continue; }
      let a = (lo - from) / delta, b = (hi - from) / delta;
      if (a > b) [a, b] = [b, a];
      t0 = Math.max(t0, a); t1 = Math.min(t1, b);
      if (t1 - t0 <= 1e-9) return false;
    }
    return true;
  });
}
