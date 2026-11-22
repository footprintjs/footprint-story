/**
 * A ball on the grid (0.37.0): a round thing every way, the kind StoryReel 0.44.0 added (`kind: 'ball'`, the thing that
 * rolls). Pure numbers on the map's grid, as `grid.block` and `grid.cylinder` are; the shape column (styleChoices.js ·
 * boxShape) makes its faces from them, and every style then paints it.
 *
 *   ballOf(grid, {at, size})   → {outline, centre, seams, box}
 *
 * The contract, StoryReel 0.44.0's (kits/isometric/turn.mjs · ballPicture, centreOf; read.mjs: `size: [d, d, d]`):
 *   where it stands   a ball of size [d, d, d] at [col, row, lift?] fills the box of tiles a block of that size and
 *                     place would: its middle at [col + d / 2, row + d / 2, lift + d / 2] in tiles, its radius d / 2
 *   its outline       the great circle across the way to the viewer, put on the frame by the grid's own numbers
 *                     (`grid.at`): ROUND points, from the point across the view round through the top. A circle on
 *                     the usual grid; an ellipse on a grid written with another tile or rise, which is still the
 *                     ball's true silhouette (in a parallel view the silhouette is the great circle square to the view)
 *   its centre        its middle on the frame: where its name stands
 *   its seams         two great circles, as a beach ball's, as it was built (unturned): the level one and the upright
 *                     one along the rows, each the half of it the viewer sees — ROUND / 2 + 1 points round the point
 *                     of it that leans most toward the viewer. WHY marks: a ball's outline is the same however it
 *                     turns, so a still ball with none reads as a disc; the seams say it is round, and a film that
 *                     turns the ball turns them (StoryReel's own `ballPicture(grid, centre, radius, turn)`)
 *   its box           round its outline
 * The numbers are worked in StoryReel's order, step for step, so a ball here lands on the very points StoryReel's lands
 * on (a test runs StoryReel's copy beside it, for any ball on any grid).
 */
import { readThing, refuse, shown } from './thing.js';

/** How many points a ball's outline is drawn with (each seam: half as many and one): StoryReel's ROUND, far finer than a pixel at any size a frame shows. */
export const BALL_ROUND = 72;

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => { const n = Math.hypot(...a); return a.map((v) => v / n); };

/**
 * The way to the viewer in tiles, a unit: the direction the grid draws as a point (the null of its projection), the
 * one with height (the viewer looks down). Read from the grid's own numbers only.
 */
function towardViewer(grid) {
  const o = grid.at(0, 0, 0), [a, b, c] = [grid.at(1, 0, 0), grid.at(0, 1, 0), grid.at(0, 0, 1)].map((p) => [p.x - o.x, p.y - o.y]);
  const n = cross([a[0], b[0], c[0]], [a[1], b[1], c[1]]);
  return unit(n[2] < 0 ? n.map((v) => -v) : n);
}

/** A ball, checked: a thing {at, size} whose size is one number three times. */
export function readBall(thing, what = 'a ball') {
  const read = readThing(thing, what), [d, deep, high] = read.size;
  if (!(d === deep && deep === high)) refuse(`${what} is round every way — its size is [wide, wide, wide], one number three times (1 1 1) — not ${shown(read.size)}`);
  return read;
}

/** A ball's outline, centre, seams and box on the frame (see above). */
export function ballOf(grid, thing) {
  const { at: [c, r, lift], size: [d] } = readBall(thing), radius = d / 2, centre = [c + d / 2, r + d / 2, lift + d / 2];
  const view = towardViewer(grid);
  const across = Math.abs(view[2]) < 1 - 1e-9 ? unit(cross(view, [0, 0, 1])) : [1, 0, 0], up = cross(view, across);
  const round = (a, b, t) => [0, 1, 2].map((k) => centre[k] + radius * (Math.cos(t) * a[k] + Math.sin(t) * b[k]));
  const frame = ([x, y, z]) => { const p = grid.at(x, y, z); return [p.x, p.y]; };
  const outline = Array.from({ length: BALL_ROUND }, (_, n) => frame(round(across, up, (2 * Math.PI * n) / BALL_ROUND)));
  // a great circle's seen half is one arc: the half round the point that leans most toward the viewer
  const seams = [[[1, 0, 0], [0, 1, 0]], [[0, 1, 0], [0, 0, 1]]].map(([a, b]) => {
    const facing = Math.atan2(dot(b, view), dot(a, view));
    return Array.from({ length: BALL_ROUND / 2 + 1 }, (_, n) => frame(round(a, b, facing - Math.PI / 2 + (Math.PI * n) / (BALL_ROUND / 2))));
  });
  const xs = outline.map((p) => p[0]), ys = outline.map((p) => p[1]), x = Math.min(...xs), y = Math.min(...ys);
  return { outline, centre: frame(centre), seams, box: { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y } };
}
