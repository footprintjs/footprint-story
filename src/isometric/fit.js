/**
 * Fit: the grid on which a picture fills a box of the frame — so whoever writes the picture never works out a tile's
 * size or where the floor's far corner goes.
 *
 *   gridFor(things, into, {most?, least?, also?})  → a grid (grid.js)
 *
 * `things` are placed ({at, size}); `into` is the box they should fill, [x0, y0, x1, y1] in pixels. `also` is points
 * of the floor the picture holds too ([[col, row, lift?], …]): the corners of the links laid between the things
 * (routes.js), which run round them and so reach past them — a picture fitted to its things alone cuts those off. The grid has the
 * usual two-to-one tile, as wide as lets every thing — its height too — sit inside the box, a whole even number of
 * pixels from `least` to `most` (each read as the even number inside it: least up, most down), with the picture in
 * the middle of the box. A picture too big for the box at `least` still gets its grid: it runs past the box, and
 * whoever asked can tell from the things' boxes.
 *
 * HOW: every number of this view grows with the tile, so the picture is measured once on a tile 100 wide and the
 * rest is one division.
 */
import { isometric } from './grid.js';
import { fin, numbers, own, readThing, refuse, shown } from './thing.js';
import { MOST_ISOMETRIC_THINGS } from './order.js';

const UNIT = 100;
/** The most floor points a picture is fitted to beside its things. */
export const MOST_ALSO = 65_536;

/** The grid on which `things` (and the floor points `also`) fill the box `into` ([x0, y0, x1, y1]): its tile from `least` (24) to `most` (160) pixels wide. */
export function gridFor(things, into, options = undefined) {
  if (!Array.isArray(things) || !things.length) refuse(`gridFor takes the things to fit, a list of at least one {at, size} — not ${shown(things)}`);
  if (things.length > MOST_ISOMETRIC_THINGS) refuse(`gridFor fits at most ${MOST_ISOMETRIC_THINGS} things, not ${things.length}`);
  const [x0, y0, x1, y1] = numbers(into, [4], 'the box to fill', '[x0, y0, x1, y1] in pixels');
  if (!(x1 > x0 && y1 > y0)) refuse(`the box to fill is [x0, y0, x1, y1] with x1 past x0 and y1 past y0 — not ${shown(into)}`);
  // an option by its own stored value: a getter is somebody's code, which is never run
  const given = (key, usual) => (options !== null && typeof options === 'object' ? own(options, key) ?? usual : usual);
  const asked = [given('least', 24), given('most', 160)];
  if (!(fin(asked[0]) && fin(asked[1]) && asked[0] >= 2)) refuse(`a tile is from least to most pixels wide, least 2 or more and most no less — not ${shown(asked)}`);
  const least = 2 * Math.ceil(asked[0] / 2), most = 2 * Math.floor(asked[1] / 2);   // the even numbers inside what was asked
  if (most < least) refuse(`a tile is from least to most pixels wide, least 2 or more and most no less, with an even number between them — not ${shown(asked)}`);
  const also = given('also', []);
  if (!Array.isArray(also) || also.length > MOST_ALSO) refuse(`also is the floor points the picture holds too, at most ${MOST_ALSO} of [col, row] or [col, row, lift] — not ${shown(also)}`);
  const unit = isometric({ tile: UNIT });
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  for (let i = 0; i < also.length; i += 1) {
    const [col, row, lift = 0] = numbers(own(also, i), [2, 3], `point ${i + 1} of also`, '[col, row] on the floor, or [col, row, lift] above it'), { x, y } = unit.at(col, row, lift);
    left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y);
  }
  for (let i = 0; i < things.length; i += 1) {
    const { box } = unit.block(readThing(own(things, i), `thing ${i + 1}`));   // a round thing is inside the box of the block on its tiles
    left = Math.min(left, box.x); top = Math.min(top, box.y); right = Math.max(right, box.x + box.w); bottom = Math.max(bottom, box.y + box.h);
  }
  const fits = Math.min((x1 - x0) / (right - left), (y1 - y0) / (bottom - top)) * UNIT;
  const tile = Math.min(most, Math.max(least, 2 * Math.floor(fits / 2))), scale = tile / UNIT;
  return isometric({ tile, origin: [(x0 + x1) / 2 - (left + right) / 2 * scale, (y0 + y1) / 2 - (top + bottom) / 2 * scale] });
}
