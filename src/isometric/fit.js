/**
 * Fit: the grid on which a picture fills a box of the frame — so whoever writes the picture never works out a tile's
 * size or where the floor's far corner goes.
 *
 *   gridFor(things, into, {most?, least?})  → a grid (grid.js)
 *
 * `things` are placed ({at, size}); `into` is the box they should fill, [x0, y0, x1, y1] in pixels. The grid has the
 * usual two-to-one tile, as wide as lets every thing — its height too — sit inside the box, a whole even number of
 * pixels from `least` to `most`, with the picture in the middle of the box. A picture too big for the box at `least`
 * still gets its grid: it runs past the box, and whoever asked can tell from the things' boxes.
 *
 * HOW: every number of this view grows with the tile, so the picture is measured once on a tile 100 wide and the
 * rest is one division.
 */
import { isometric } from './grid.js';
import { fin, numbers, own, refuse, shown } from './thing.js';
import { MOST_ISOMETRIC_THINGS } from './order.js';

const UNIT = 100;

/** The grid on which `things` fill the box `into` ([x0, y0, x1, y1]): its tile from `least` (24) to `most` (160) pixels wide. */
export function gridFor(things, into, { most = 160, least = 24 } = {}) {
  if (!Array.isArray(things) || !things.length) refuse(`gridFor takes the things to fit, a list of at least one {at, size} — not ${shown(things)}`);
  if (things.length > MOST_ISOMETRIC_THINGS) refuse(`gridFor fits at most ${MOST_ISOMETRIC_THINGS} things, not ${things.length}`);
  const [x0, y0, x1, y1] = numbers(into, [4], 'the box to fill', '[x0, y0, x1, y1] in pixels');
  if (!(x1 > x0 && y1 > y0)) refuse(`the box to fill is [x0, y0, x1, y1] with x1 past x0 and y1 past y0 — not ${shown(into)}`);
  if (!(fin(least) && fin(most) && least >= 2 && most >= least)) refuse(`a tile is from least to most pixels wide, least 2 or more and most no less — not ${shown([least, most])}`);
  const unit = isometric({ tile: UNIT });
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  for (let i = 0; i < things.length; i += 1) {
    const { box } = unit.block(own(things, i));   // a round thing is inside the box of the block on its tiles
    left = Math.min(left, box.x); top = Math.min(top, box.y); right = Math.max(right, box.x + box.w); bottom = Math.max(bottom, box.y + box.h);
  }
  const fits = Math.min((x1 - x0) / (right - left), (y1 - y0) / (bottom - top)) * UNIT;
  const tile = Math.min(most, Math.max(least, 2 * Math.floor(fits / 2))), scale = tile / UNIT;
  return isometric({ tile, origin: [(x0 + x1) / 2 - (left + right) / 2 * scale, (y0 + y1) / 2 - (top + bottom) / 2 * scale] });
}
