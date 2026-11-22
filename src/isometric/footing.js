/**
 * A moving block's foot in tiles, worked back from footprint-story/human's samples: a sample planned on the frame
 * (footTiles), or one planned side on, in the upright plane through the block's way (sideFoot, in the world's own px:
 * worldPx). Plain numbers; only the grid's own numbers are read.
 *
 *   footTiles(grid)(point, move, share)   the foot's place in tiles from where it is drawn, during a move between two places
 *   sideFoot(side, sample)                where a side-on sample puts the foot, in tiles
 *   worldPx(grid)                         the world's own px in one tile: a tile's true length on the frame
 *
 * Moved from StoryReel 0.44.0 (motion-place.mjs · footTiles; motion-side.mjs · sideFoot, worldPx) and StoryDeck 0.37.0
 * (motionPlace.js · footTiles; motionPlan.js · sideFoot, and `grid.tile[0] / Math.SQRT2` inline).
 */
import { readGrid } from './grid.js';
import { finite, numbers, own, refuse, shown } from './thing.js';

/** How near the two ends of a move must lie to one line of places on the frame to be taken as on it. Ours: floats, not a way. */
const ONE_LINE = 1e-9;
/** How near a lift must be to a level the body keeps to be that level, in tiles: a billionth, floats worked back. Ours. */
export const LEVEL_SNAP = 1e-9;

/**
 * A foot's place in tiles from where it is on the frame, during a move from `move.from` to `move.to` (feet, tiles): a
 * point on the frame is a whole line of places, so the one taken is on the move's way — its column and row where the
 * point's across-position (col − row) puts them between the two ends, or by `share` of the move's time (0 to 1) when
 * both ends stand on one such line — and its lift is what then brings it to the point's height. A lift under the floor
 * (a wind-up's dip) is the floor. WHY: the place projects to exactly where the block is drawn, so the paint order and
 * the pass-through check find it where it is seen. Gives a function, the grid read once.
 */
export function footTiles(grid) {
  const g = readGrid(grid, 'footTiles'), o = g.at(0, 0, 0), half = g.at(1, 0, 0).y - o.y, up = o.y - g.at(0, 0, 1).y;
  return (point, move, share) => {
    const [x, y] = numbers(point, [2], "footTiles' point", '[x, y] on the frame');
    if (!move || typeof move !== 'object') refuse(`footTiles' move is {from, to}, two feet in tiles — not ${shown(move)}`);
    const from = numbers(own(move, 'from'), [2, 3], "footTiles' move's from", '[col, row] or [col, row, lift]'), to = numbers(own(move, 'to'), [2, 3], "footTiles' move's to", '[col, row] or [col, row, lift]');
    const ground = g.tileAt(x, y), u = ground.col - ground.row, u0 = from[0] - from[1], u1 = to[0] - to[1];
    const across = Math.abs(u1 - u0) > ONE_LINE;
    if (!across && !(finite(share) && share >= 0 && share <= 1)) refuse(`footTiles' share is how far through its time the move is, 0 to 1 — not ${shown(share)}`);
    const f = across ? (u - u0) / (u1 - u0) : share;
    const c = from[0] + f * (to[0] - from[0]), r = from[1] + f * (to[1] - from[1]);
    return [c, r, Math.max(0, ((c + r) - (ground.col + ground.row)) * half / up)];
  };
}

/** The world's own px in one tile: a tile's width over √2 — a level line across the frame (along col − row) is drawn at its true length. */
export function worldPx(grid) { return readGrid(grid, 'worldPx').tile[0] / Math.SQRT2; }

/**
 * Where a sample of a side-on move puts the body's foot, in tiles. `side` is {origin: [col, row] where the way starts,
 * heading: [dc, dr] a unit along it, unit: worldPx(grid), offset?: how far the tie point is above the foot in tiles (a
 * ball's radius for a roll; 0, the usual, for a slide), levels: the lifts the body keeps (where it starts, where it
 * lands)}; `sample` is footprint-story/human's {x, y}: `x` along the way from its start, `y` the tie point's height, down
 * (both world px). A lift within LEVEL_SNAP of a level is that level exactly — worked back through floats a body on a top
 * could come out a hair under it, inside the block it stands on, and be ordered behind it — and under the floor is the
 * floor.
 */
export function sideFoot(side, sample) {
  if (!side || typeof side !== 'object') refuse(`sideFoot's side is {origin, heading, unit, offset?, levels} — not ${shown(side)}`);
  const origin = numbers(own(side, 'origin'), [2], "sideFoot's origin", '[col, row]'), heading = numbers(own(side, 'heading'), [2], "sideFoot's heading", '[dc, dr], a unit');
  const unit = own(side, 'unit'), offset = own(side, 'offset') ?? 0, levels = own(side, 'levels') ?? [];
  if (!(finite(unit) && unit > 0)) refuse(`sideFoot's unit is the world's px in a tile (worldPx), above 0 — not ${shown(unit)}`);
  if (!finite(offset)) refuse(`sideFoot's offset is the tie point's height above the foot, in tiles — not ${shown(offset)}`);
  const kept = numbers(levels, Array.isArray(levels) ? [levels.length] : [0], "sideFoot's levels", 'a list of lifts, in tiles');
  if (!sample || typeof sample !== 'object' || !finite(own(sample, 'x')) || !finite(own(sample, 'y'))) refuse(`sideFoot's sample is {x, y}, finite numbers — not ${shown(sample)}`);
  const along = own(sample, 'x') / unit, lift = -own(sample, 'y') / unit - offset;
  return [origin[0] + along * heading[0], origin[1] + along * heading[1], kept.find((l) => Math.abs(l - lift) < LEVEL_SNAP) ?? Math.max(0, lift)];
}
