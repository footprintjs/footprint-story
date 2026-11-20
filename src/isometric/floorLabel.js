/**
 * A floor's label: its name, laid flat on the floor along its front edge, the way a diagram heads a group box. The words
 * run along the floor's cols (toward the lower right of the frame), just in from the edge nearest the viewer on the
 * left, from its far end; they are fitted to that edge as a block's name is fitted to its top (`wordsToFit`: one line,
 * then two, then smaller down to a least size), and moved along it, half a tile at a time, clear of what is drawn over
 * the floor. A label that still does not fit is given at the least size and said (`fits: false`) — never cut.
 *
 *   floorLabelPlace({at, size}, grid, 'Production account', covers, {icon})
 *     → {x, y, matrix, size, lines, fits, covered}
 *
 * WHY flat on the floor and not a plate standing on it: a plate reads as one more object; words on the ground read as
 * the name of the ground. WHY a size from the tile, with a least: a camera zooms the whole picture, so a label is as
 * readable as the floor it names, and never smaller than the least at the picture's own size. WHY here: a deck and a
 * film lay the same floor's name in the same place. It came from StoryDeck 0.27.0 (deck/floorLabel.js), unchanged in
 * what it gives for what that gave it (a property test against a copy of that code, test/control/); what is new is
 * that every value is checked.
 */
import { readGrid } from './grid.js';
import { framePoints, numbers, own, refuse, shown, stored } from './thing.js';
import { wordsToFit } from './words.js';

/** Where the words start: tiles in along the edge from its far end, and in from the edge. */
const ALONG = 0.3, IN = 0.15;
/** The label's size for each px of a tile's side on the frame, and the most and least it is drawn at. */
const SIZE = Object.freeze({ per: 0.3, most: 28, least: 14 });
/** The most letters a floor's label has: a name, not a paragraph. */
export const MOST_FLOOR_LABEL = 120;
/** How wide a letter is for each px of its size — `wordsToFit`'s count, a bold sans face — and a capital. */
const LETTER = 0.6, CAPITAL = 0.7;
/** An icon beside the label: how wide it is with its gap, for each px of the label's size (1.15em and a .35em gap). */
export const FLOOR_LABEL_ICON = 1.5;
/** Tiles of floor kept clear past the counted end of the words. */
const CLEARANCE = 0.25;
/** Tiles all round the words that what is drawn over the floor must also keep off. */
const MARGIN = 0.1;
/** The most points the outlines a label keeps clear of may hold between them. */
export const MOST_COVER_POINTS = 1_000_000;
/** The most points one outline may have: a block's is 6, a stretch of a route 2; two outlines are compared side by side. */
export const MOST_OUTLINE_POINTS = 64;
/** The most tiles a labelled floor is a side (as a floor is: grid.floor): so at most 512 places along its edge. */
const MOST_SIDE = 256;
/**
 * The most looks one label spends finding its place: a look is one outline's box asked against the words' strip, or one
 * point projected in the overlap test. WHY a limit: whatever is handed in, a label costs no more than this (well under
 * a second). Outlines are asked by their boxes first, so a picture's own — a few near the edge — spend a few thousand.
 */
export const MOST_LABEL_LOOKS = 50_000_000;

/** Spend `n` of a label's looks; past the most, refused in words. */
function spend(looks, n) {
  if ((looks.left -= n) < 0) refuse(`there is too much drawn over this floor's edge to look through for its label (more than ${MOST_LABEL_LOOKS} looks) — draw fewer things over it, or ask without them`);
}
/** The box round an outline: [left, top, right, bottom] (an empty outline's is empty: it meets nothing). */
const boxOf = (points) => points.reduce(([l, t, r, b], [x, y]) => [Math.min(l, x), Math.min(t, y), Math.max(r, x), Math.max(b, y)], [Infinity, Infinity, -Infinity, -Infinity]);
/** How far apart two boxes may be and still be asked by the overlap test: a hair, so the test's own tolerance decides at the edge. */
const SLACK = 1e-6;
const apart = (p, q) => p[2] < q[0] - SLACK || q[2] < p[0] - SLACK || p[3] < q[1] - SLACK || q[3] < p[1] - SLACK;

/**
 * Whether two convex outlines on the frame ([[x, y], …], each in order round it) overlap: no line parts them (the
 * separating-axis test). `looks`: {left}, spent by every point projected.
 */
function overlap(a, b, looks) {
  spend(looks, (a.length + b.length) * (a.length + b.length));
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % poly.length], nx = y2 - y1, ny = x1 - x2;
      if (Math.abs(nx) + Math.abs(ny) < 1e-9) continue;   // a side of no length (a flat block's outline repeats points) parts nothing
      const span = (pts) => pts.map(([x, y]) => x * nx + y * ny);
      const pa = span(a), pb = span(b);
      if (Math.max(...pa) <= Math.min(...pb) + 1e-9 || Math.max(...pb) <= Math.min(...pa) + 1e-9) return false;
    }
  }
  return true;
}

/** What a floor's label is asked of, read by own stored fields: the floor, its words, what covers it, whether an icon goes first. */
function readLabel(floor, text, covers, options) {
  if (!floor || typeof floor !== 'object' || Array.isArray(floor)) refuse(`a floor's label lies on a floor, {at: [col, row], size: [cols, rows]} — not ${shown(floor)}`);
  const [col, row] = numbers(own(floor, 'at'), [2, 3], "a labelled floor's at", '[col, row]: its far corner');
  const [cols, rows] = numbers(own(floor, 'size'), [2], "a labelled floor's size", '[cols, rows], in tiles');
  if (!(cols > 0 && rows > 0 && cols <= MOST_SIDE && rows <= MOST_SIDE)) refuse(`a labelled floor's size is [cols, rows], each above 0 and at most ${MOST_SIDE} — not ${shown([cols, rows])}`);
  const letters = typeof text === 'string' ? [...text].length : 0;
  if (typeof text !== 'string' || !letters || letters > MOST_FLOOR_LABEL) refuse(`a floor's label is a name of 1 to ${MOST_FLOOR_LABEL} letters — not ${typeof text === 'string' ? `${letters} letters` : shown(text)}`);
  if (!Array.isArray(covers)) refuse(`what covers a floor is outlines on the frame, [[[x, y], …], …] — not ${shown(covers)}`);
  let total = 0;
  const outlines = Array.from({ length: covers.length }, (_, i) => {
    const outline = framePoints(Object.hasOwn(covers, i) ? own(covers, i) : undefined, `outline ${i + 1} over the floor`, { most: MOST_OUTLINE_POINTS });
    total += outline.length;
    if (total > MOST_COVER_POINTS) refuse(`what covers a floor is at most ${MOST_COVER_POINTS} points of outline in all — draw fewer things over it, or ask without them`);
    return outline;
  });
  if (options !== undefined && options !== null && (typeof options !== 'object' || Array.isArray(options))) refuse(`a floor label's options are {icon} — not ${shown(options)}`);
  const icon = (options && stored(options, 'icon', "a floor label's icon")) ?? false;
  if (typeof icon !== 'boolean') refuse(`icon says whether an icon goes before the label, true or false — not ${shown(icon)}`);
  return { col, row, cols, rows, outlines, icon };
}

/**
 * A floor's label placed: `floor` {at: [col, row], size: [cols, rows]}, `grid` an isometric grid (its tile, origin and
 * rise are read), `text` the label's words (1 to MOST_FLOOR_LABEL letters), `covers` the outlines on the frame of what
 * is drawn over the floor ([[[x, y], …], …], each convex: the blocks, and each stretch of a laid route as two points;
 * at most MOST_OUTLINE_POINTS points an outline and MOST_COVER_POINTS in all), `icon` whether an icon goes first. The
 * floor is at most 256 tiles a side, so there are at most 512 places along its edge; at each, only the outlines whose
 * box meets the words' strip are compared, and the whole search spends at most MOST_LABEL_LOOKS looks (past that it is
 * refused in words, never left to run). Gives {x, y} where the line's foot starts on the
 * frame, `matrix` [a, b, c, d] (the CSS transform, or a canvas's, that lays the words on the floor: a line along the
 * cols, a line's height toward the far rows), `size` the font size in px, `lines` the words as set, `fits` false when
 * they do not fit along the edge even at the least size, `covered` true when no place along the edge is clear of what
 * stands there.
 *
 * WHERE along the edge: from its far end, the first place (half a tile at a time) where the words' strip of floor, as
 * drawn on the frame, meets no outline — a block is drawn over the floor, so one there would hide them, and a route
 * there would run through them. `fits` is false too when two lines are deeper than the floor.
 */
export function floorLabelPlace(floor, grid, text, covers = [], options = undefined) {
  const { col, row, cols, rows, outlines, icon } = readLabel(floor, text, covers, options), g = readGrid(grid, 'floorLabelPlace');
  const [tw, th] = g.tile, side = Math.hypot(tw / 2, th / 2);   // a tile's side on the frame, in px
  const matrix = [tw / 2 / side, th / 2 / side, -tw / 2 / side, th / 2 / side];
  const size = Math.max(SIZE.least, Math.min(SIZE.most, Math.round(SIZE.per * side)));
  // a letter as wide as wordsToFit counts it, a capital wider; the icon's room (at the largest size, so never short) first
  const chars = [...text], letter = chars.reduce((sum, ch) => sum + (ch !== ch.toLowerCase() ? CAPITAL : LETTER), 0) / Math.max(1, chars.length);
  const room = Math.max(0, (cols - 2 * ALONG) * side - (icon ? FLOOR_LABEL_ICON * size : 0)) * (LETTER / letter);
  const fit = wordsToFit(text, () => room, { size, least: SIZE.least });
  const drawnSize = fit.size ?? size, lines = Math.max(1, fit.lines.length);
  // the words' strip of floor, in tiles: how long along the cols (a quarter tile more: the letters are counted, not
  // measured), how deep toward the far rows — and whether that depth is on the floor at all
  const long = (Math.max(...fit.lines.map((line) => [...line].length), 1) * letter + (icon ? FLOOR_LABEL_ICON : 0)) * drawnSize / side + CLEARANCE;
  const deep = lines * 1.15 * drawnSize / side, fits = fit.fits && deep + 2 * IN <= rows + 1e-9;
  const near = row + rows - IN, far = near - deep;
  // asked a little wider than the words (MARGIN all round): a route is a line with width, and lies on the half-tile
  // lanes the words' far edge can fall on
  const strip = (from) => [[from - MARGIN, far - MARGIN], [from + long + MARGIN, far - MARGIN], [from + long + MARGIN, near + MARGIN], [from - MARGIN, near + MARGIN]].map(([c, r]) => { const p = g.at(c, r); return [p.x, p.y]; });
  // each outline's box once; at each place only the outlines whose box meets the strip's are asked (convex outlines whose
  // boxes are apart do not overlap, so this answers as asking them all would)
  const boxes = outlines.map(boxOf), looks = { left: MOST_LABEL_LOOKS };
  const clear = (from) => {
    const s = strip(from), sb = boxOf(s);
    return outlines.every((outline, k) => { spend(looks, 1); return apart(sb, boxes[k]) || !overlap(s, outline, looks); });
  };
  let from = col + ALONG;
  for (let at = col + ALONG; at + long <= col + cols - ALONG + 1e-9; at += 0.5) if (clear(at)) { from = at; break; }
  const start = g.at(from, near);
  // covered is said only of a label that fits: one that does not is said as that, once
  return { x: start.x, y: start.y, matrix, size: drawnSize, lines: fit.lines, fits, covered: fits && !clear(from) };
}
