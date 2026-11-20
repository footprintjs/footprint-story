/**
 * Isometric: one grid for a picture seen from a corner, so flat drawings sit on a floor and stand up from it. The floor
 * is tiles; a thing stands on some of them and has a height; the grid says where each of its corners lands on the frame.
 * Nothing recedes: a thing far away is as big as one near (a parallel view), which is why a diagram drawn this way stays
 * readable at every corner.
 *
 *   const grid = isometric({tile: 120, origin: [960, 240]})
 *   grid.at(col, row, height?)        → {x, y}        a point on the frame
 *   grid.tileAt(x, y)                 → {col, row}    the floor point under a place on the frame
 *   grid.block({at, size})            → {top, left, right, outline, centre, box, room}   the faces of a box
 *   grid.cylinder({at, size})         → {top, bottom, centre, box, room}                 a round thing: two ellipses
 *   grid.floor({cols, rows, at?})     → {outline, lines, box}                      the tile lines
 *   grid.route(a, b, {first?})        → [{x, y}, …]   a line along the floor, turning once
 *   grid.backToFront(things)          → the things, the furthest first: the order to draw them in (order.js)
 *
 * `col` grows down and to the right of the frame, `row` down and to the left, `height` up. A thing is
 * {at: [col, row, lift?], size: [wide, deep, high]}: it stands on the tiles from `at`, `lift` above the floor.
 * `tile` is a tile's width on the frame in pixels, twice its height (or [width, height] for another angle);
 * `rise` is a unit of height in pixels, and by default it is what makes a cube look like a cube.
 *
 * Pure numbers: a tool draws with them, back to front. Every number may come from anyone: each is checked (thing.js),
 * and a refusal says what to give.
 */
import { backToFront } from './order.js';
import { FAR, fin, numbers, readThing, refuse, shown } from './thing.js';

const MOST_TILES = 256;

const boundsOf = (points) => {
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y), x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
};

/** A grid, checked: a tile wider than it is tall, a rise above 0. */
export function isometric({ tile = 120, origin = [0, 0], rise } = {}) {
  const [w, h] = typeof tile === 'number' ? [tile, tile / 2] : numbers(tile, [2], 'tile', "a tile's width in pixels (its height is half), or [width, height]");
  if (!(fin(w) && fin(h) && h > 0 && w > h)) refuse(`a tile is wider than it is tall, both above 0 (120, or [120, 60]) — not ${shown(tile)}`);
  const [ox, oy] = numbers(origin, [2], 'origin', '[x, y]: where the floor\'s far corner lands on the frame');
  // The parallel camera that draws a tile w wide and h tall stands at 45° round and asin(h / w) up: a unit of height is
  // then √((w² − h²) / 2) pixels — 0.61 of the tile's width for the usual two-to-one tile.
  const up = rise ?? Math.sqrt((w * w - h * h) / 2);
  if (!(fin(up) && up > 0)) refuse(`rise is a unit of height in pixels, above 0 — not ${shown(rise)}`);

  const at = (col, row, height = 0) => {
    if (!fin(col) || !fin(row) || !fin(height)) refuse(`at(col, row, height?) takes numbers — not ${shown([col, row, height])}`);
    return { x: ox + (col - row) * w / 2, y: oy + (col + row) * h / 2 - height * up };
  };

  const tileAt = (x, y) => {
    if (!fin(x) || !fin(y)) refuse(`tileAt(x, y) takes a place on the frame — not ${shown([x, y])}`);
    const u = (x - ox) / (w / 2), v = (y - oy) / (h / 2);
    return { col: (u + v) / 2, row: (v - u) / 2 };
  };

  /**
   * How wide an upright box `high` pixels tall may be, standing on a thing's top with its middle on the top's centre
   * and staying inside the top: what words set on that face have for room. `least(high)` is that width for a top of
   * the kind. WHY here: the top of a box is a slanted diamond, not the rectangle round it — a long thin box has a top
   * as wide across its middle as its SHORT side is, however long it is — and a deck and a film must count alike.
   */
  const roomOf = (widest) => (high = 0) => {
    if (!(fin(high) && high >= 0)) refuse(`room(high) takes how tall the words stand, in pixels, 0 or more — not ${shown(high)}`);
    return Math.max(0, widest(high));
  };

  /** A box: its top, the side towards the lower left (`left`), the side towards the lower right (`right`), each four points round. */
  const block = (thing) => {
    const { at: [c, r, lift], size: [wide, deep, high] } = readThing(thing, 'a block'), top = lift + high;
    const far = at(c, r, top), east = at(c + wide, r, top), near = at(c + wide, r + deep, top), west = at(c, r + deep, top);
    const eastFoot = at(c + wide, r, lift), nearFoot = at(c + wide, r + deep, lift), westFoot = at(c, r + deep, lift);
    const outline = [far, east, eastFoot, nearFoot, westFoot, west];
    return { top: [far, east, near, west], left: [west, near, nearFoot, westFoot], right: [near, east, eastFoot, nearFoot], outline,
      centre: at(c + wide / 2, r + deep / 2, top), box: boundsOf(outline),
      // across its middle the top is as wide as the shorter side is long; each pixel up or down, both edges come in by w / h
      room: roomOf((tall) => Math.min(wide, deep) * w - tall * w / h) };
  };

  /** A round thing on a square of tiles: the ellipse of its top and of its foot. Its sides are the two lines between their ends. */
  const cylinder = (thing) => {
    const { at: [c, r, lift], size: [wide, deep, high] } = readThing(thing, 'a cylinder');
    if (wide !== deep) refuse(`a cylinder is round: give it the same width and depth (2 2 1.5) — not ${shown([wide, deep, high])}`);
    const rx = wide / 2 * w / Math.SQRT2, ry = wide / 2 * h / Math.SQRT2;
    const head = at(c + wide / 2, r + wide / 2, lift + high), foot = at(c + wide / 2, r + wide / 2, lift);
    return { top: { cx: head.x, cy: head.y, rx, ry }, bottom: { cx: foot.x, cy: foot.y, rx, ry }, centre: head,
      room: roomOf((tall) => (tall < 2 * ry ? 2 * rx * Math.sqrt(1 - (tall / (2 * ry)) ** 2) : 0)),   // the chord of the top's ellipse half that far from its middle
      box: { x: head.x - rx, y: head.y - ry, w: 2 * rx, h: foot.y - head.y + 2 * ry } };
  };

  /** A floor of cols × rows tiles from `at`: its four corners and every tile line, [x1, y1, x2, y2]. */
  const floor = ({ cols, rows, at: from = [0, 0] } = {}) => {
    if (!(Number.isInteger(cols) && Number.isInteger(rows) && cols >= 1 && rows >= 1 && cols <= MOST_TILES && rows <= MOST_TILES)) refuse(`a floor is cols × rows tiles, whole numbers from 1 to ${MOST_TILES} — not ${shown([cols, rows])}`);
    const [c, r] = numbers(from, [2], "a floor's at", '[col, row]: its far corner');
    const line = (a, b) => [a.x, a.y, b.x, b.y], lines = [];
    for (let i = 0; i <= cols; i += 1) lines.push(line(at(c + i, r), at(c + i, r + rows)));
    for (let j = 0; j <= rows; j += 1) lines.push(line(at(c, r + j), at(c + cols, r + j)));
    const outline = [at(c, r), at(c + cols, r), at(c + cols, r + rows), at(c, r + rows)];
    return { outline, lines, box: boundsOf(outline) };
  };

  /**
   * A line along the floor from a to b ([col, row, lift?]), turning once: along the cols first (`first: 'col'`, the
   * default) or the rows first. Two points when a and b share a col or a row. It runs at a's lift.
   */
  const route = (a, b, { first = 'col' } = {}) => {
    const from = numbers(a, [2, 3], "a route's start", '[col, row] or [col, row, lift]'), to = numbers(b, [2, 3], "a route's end", '[col, row] or [col, row, lift]');
    if (first !== 'col' && first !== 'row') refuse(`a route goes along the cols first or the rows first (first: 'col' or 'row') — not ${shown(first)}`);
    const lift = from[2] ?? 0, corner = first === 'col' ? [to[0], from[1]] : [from[0], to[1]];
    const straight = from[0] === to[0] || from[1] === to[1];
    return [[from[0], from[1]], ...(straight ? [] : [corner]), [to[0], to[1]]].map(([col, row]) => at(col, row, lift));
  };

  return Object.freeze({ tile: Object.freeze([w, h]), origin: Object.freeze([ox, oy]), rise: up, at, tileAt, block, cylinder, floor, route,
    /** `items` sorted so the furthest is drawn first; `thingOf(item)` gives an item's {at, size} (default: the item is one). */
    backToFront: (items, thingOf = (item) => item) => backToFront(items, thingOf, { tileHeight: h, rise: up }) });
}
