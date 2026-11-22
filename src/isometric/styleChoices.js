/**
 * The style choices this package ships, one object per choice: `{column, name, apply, options, check, clashes}` — the same interface a
 * tool's own choice has (style.js). These are today's look, written out: what StoryDeck 0.32.0 and StoryReel 0.38.0
 * draw for a block, a cylinder and a floor.
 *
 *   shape   box     the faces `grid.block` / `grid.cylinder` / `grid.floor` give, as items (no fill, no stroke yet),
 *                   with the box, the centre (where a name stands) and the outline round the piece; a ball (0.37.0,
 *                   ball.js) its silhouette as a top and its two seams (role "seam", stroked by each line as SEAM says)
 *   shading tones   top 20% toward white, left 6% toward black, right and a cylinder's side 18% toward black
 *                   (StoryReel's `mix`, StoryDeck's CSS `color-mix`); a floor's ground is its own colour
 *   line    ink     the ink round every face, 2.5 px, round joins (StoryReel's ISO_LOOK.line); a floor's tile lines
 *                   the ink at 16%, 1.5 px; option `width` (0.5 to 20 px) for an outlined look
 *   line    none    no outline on the faces; a floor keeps its tile lines (they are its tiles, not an outline)
 *   palette theme   the colours as the caller gave them
 *   texture none    nothing over the faces
 *
 * And two for the named looks (looks.js · ISO_LOOKS, 0.34.0):
 *
 *   shading paper   every face, and a floor's ground, the paper's colour (option `colour`, "#ffffff"): line art, the
 *                   page's paper showing through the shapes. The colour is given even when the base is the page's —
 *                   it is the paper, whatever the base — so a painter that colours a face by its role (StoryDeck's
 *                   CSS) still draws it white. Clashes with line "none": white on white with no line shows nothing.
 *   line    contour a bold, even contour round the piece and lighter inner lines (the sticker look): under the faces,
 *                   each face again with no fill and a wide stroke; over them, the faces with a thin one. The faces'
 *                   fills trim the wide strokes to the outside, so what shows outside is an even band round the whole
 *                   piece with round corners — however the faces meet, with no silhouette worked out. Options:
 *                   width (the contour as it shows, 1 to 20 px; 5), inner (the inner lines, 0.25 px to the width; 1.5).
 *                   A floor keeps its tile lines (the ground the pieces stand on, not a piece); a face with no fill
 *                   (a tool's own shading) is refused: the wide stroke under it would show whole.
 *
 * And one for the named look "duotone" (0.35.0; duotone.js):
 *
 *   palette duotone two inks on paper: every line the ink, every fill with a colour a tint of the accent on the paper,
 *                   as dark as the fill it replaces; a fill the page colours (a tool's ok / warn / bad) is left to it
 *                   (options `ink`, `accent`, `paper`; DUOTONE). Refused when a name in the ink would stand under
 *                   4.5 : 1 on a tint it can give.
 */
import { mixColour, readColour } from './paint.js';
import { roundOutline } from './outline.js';
import { refuse, shown } from './thing.js';
import { duotone, checkDuotone } from './duotone.js';
import { ballOf } from './ball.js';

const xy = (p) => [p.x, p.y];
const solid = new Set(['top', 'left', 'right', 'side']);

/** The faces of a piece, in paint order, with no fill and no stroke: the box shape. */
function boxShape({ piece, grid }) {
  const of = piece.name;
  if (piece.kind === 'ball') {
    // a ball (0.37.0, ball.js): its silhouette a face as a cylinder's top is (role "top": lit, outlined, filled as a top
    // by every shading and line), then its two seams over it (role "seam": marks, drawn by the line as a floor's tile lines are)
    const b = ballOf(grid, piece), path = (line) => [['move', ...line[0]], ...line.slice(1).map((p) => ['line', ...p])];
    return { box: b.box, centre: b.centre, outline: b.outline, items: [
      { item: 'polygon', role: 'top', of, points: b.outline, fill: null, stroke: null },
      ...b.seams.map((seam) => ({ item: 'path', role: 'seam', of, segments: path(seam), fill: null, stroke: null })),
    ] };
  }
  if (piece.kind === 'floor') {
    const f = grid.floor({ cols: piece.size[0], rows: piece.size[1], at: piece.at.slice(0, 2) });
    // a floor's centre: the middle of its four corners (it holds no name; a tool may frame it)
    const centre = [f.outline.reduce((s, q) => s + q.x, 0) / 4, f.outline.reduce((s, q) => s + q.y, 0) / 4];
    return { box: f.box, centre, outline: f.outline.map(xy), items: [
      { item: 'polygon', role: 'ground', of, points: f.outline.map(xy), fill: null, stroke: null },
      { item: 'lines', role: 'grid', of, segments: f.lines.map((l) => [...l]), fill: null, stroke: null },
    ] };
  }
  if (piece.kind === 'cylinder') {
    const c = grid.cylinder({ at: piece.at, size: piece.size }), t = c.top, b = c.bottom;
    // the side: down the left edge, round the front of the foot (half its ellipse, through its nearest point), up the right edge
    const side = [['move', t.cx - t.rx, t.cy], ['line', b.cx - b.rx, b.cy], ['arc', b.cx, b.cy, b.rx, b.ry, Math.PI, 0, true], ['line', t.cx + t.rx, t.cy], ['close']];
    // its outline: the upper half of its top, then the lower half of its foot (outline.js · roundOutline, as both tools have it)
    return { box: c.box, centre: xy(c.centre), outline: roundOutline(t, b).map(xy), items: [
      { item: 'path', role: 'side', of, segments: side, fill: null, stroke: null },
      { item: 'ellipse', role: 'top', of, cx: t.cx, cy: t.cy, rx: t.rx, ry: t.ry, fill: null, stroke: null },
    ] };
  }
  const k = grid.block({ at: piece.at, size: piece.size });
  return { box: k.box, centre: xy(k.centre), outline: k.outline.map(xy), items: ['left', 'right', 'top'].map((role) => ({ item: 'polygon', role, of, points: k[role].map(xy), fill: null, stroke: null })) };
}

/** How far each face's colour moves from the base, and toward what: today's three tones. */
const TONES = Object.freeze({ top: ['#ffffff', 0.2], left: ['#000000', 0.06], right: ['#000000', 0.18], side: ['#000000', 0.18] });

function tones(items, { colours }) {
  return items.map((it) => {
    if (it.role === 'ground') return { ...it, fill: { mix: null, colour: colours.base } };
    const mix = TONES[it.role];
    if (!mix) return it;
    return { ...it, fill: { mix: [...mix], colour: colours.base === null ? null : mixColour(colours.base, mix[0], mix[1]) } };
  });
}

/** The tile lines of a floor, as every line choice keeps them. */
const gridStroke = (colours) => ({ colour: colours.ink, alpha: 0.16, width: 1.5, join: 'miter', cap: 'butt' });

/**
 * A ball's seams (0.37.0): the ink at half, four fifths of the line's width (worked as width × 4 / 5, so 2.5 px gives 2
 * exactly), round — StoryReel 0.44.0's marks
 * (ISO_LOOK.mark 0.5, markLine 2 beside its 2.5 px line), so a ball the usual style paints is the ball StoryReel drew.
 * Ours (theirs): half the ink so the seams read as marks on the ball, not as edges; under the line so the silhouette
 * stays the boldest line on it. Each line choice draws them at its own fold weight (ink: its width; contour: its
 * inner lines), and line "none" keeps them at the usual 2.5 px's share — a seam is a mark, not an outline.
 */
export const SEAM = Object.freeze({ alpha: 0.5, share: 4 / 5 });
const seamStroke = (colours, width) => ({ colour: colours.ink, alpha: SEAM.alpha, width: (width * 4) / 5, join: 'round', cap: 'round' });

/** The ink line's options, checked once when the style is made. */
function checkInk(options) {
  if (options.width !== undefined && !(typeof options.width === 'number' && options.width >= 0.5 && options.width <= 20)) refuse(`the style's line "ink" takes a width from 0.5 to 20 px — not ${shown(options.width)}`);
}

function ink(items, { colours, options }) {
  const width = options.width ?? 2.5;
  return items.map((it) => (solid.has(it.role) ? { ...it, stroke: { colour: colours.ink, alpha: 1, width, join: 'round', cap: 'butt' } }
    : it.role === 'grid' ? { ...it, stroke: gridStroke(colours) } : it.role === 'seam' ? { ...it, stroke: seamStroke(colours, width) } : it));
}

/**
 * The contour line's numbers. All ours (no source: chosen by eye on the README's stills, src/isometric/look-*.svg):
 *   width 5   the contour as it shows: twice today's 2.5 px ink, so the piece's edge reads first at a glance
 *   inner 1.5 the inner lines: under today's 2.5, so they say where the faces fold without competing with the edge
 *             (5 : 1.5, a little over 3 : 1 — less and the edge stops reading as the outline; more and the folds vanish
 *             at a small tile)
 * WHY `width` is what shows, not the stroke drawn: the stroke under the faces shows only its outer half, and the thin
 * line over the faces adds its own outer half, so it is drawn at 2 · width − inner (8.5 px for 5 and 1.5) and shows
 * width − inner / 2 outside the faces plus inner / 2 inside them: `width` in all.
 */
export const CONTOUR = Object.freeze({ width: 5, inner: 1.5, least: 1, most: 20, leastInner: 0.25 });

function checkContour(options) {
  const { width, inner } = options;
  if (width !== undefined && !(typeof width === 'number' && width >= CONTOUR.least && width <= CONTOUR.most)) refuse(`the style's line "contour" takes a width from ${CONTOUR.least} to ${CONTOUR.most} px (the contour as it shows) — not ${shown(width)}`);
  const w = width ?? CONTOUR.width;
  if (inner !== undefined && !(typeof inner === 'number' && inner >= CONTOUR.leastInner && inner <= w)) refuse(`the style's line "contour" takes an inner from ${CONTOUR.leastInner} px to its width, ${w} px (the inner lines are never bolder than the contour) — not ${shown(inner)}`);
}

function contour(items, { piece, colours, options }) {
  const width = options.width ?? CONTOUR.width, inner = options.inner ?? CONTOUR.inner;
  const line = (w) => ({ colour: colours.ink, alpha: 1, width: w, join: 'round', cap: 'round' });
  const faces = items.filter((it) => solid.has(it.role));
  // the wide stroke under a face shows only where no fill covers it: a face with no fill would show it whole
  const bare = faces.find((it) => it.fill === null);
  if (bare) refuse(`the style's line "contour" on "${piece.name}": its contour is a wide stroke under the faces, which their fills trim to the outside, and the ${bare.role} face has no fill — use a shading that fills every face ("tones", "paper"), or line "ink"`);
  // under: each face again, no fill, the wide stroke (role "contour": a painter that colours by role colours none)
  const under = faces.map((it) => ({ ...it, role: 'contour', fill: null, stroke: line(2 * width - inner) }));
  return [...under, ...items.map((it) => (solid.has(it.role) ? { ...it, stroke: line(inner) } : it.role === 'grid' ? { ...it, stroke: gridStroke(colours) }
    : it.role === 'seam' ? { ...it, stroke: seamStroke(colours, inner) } : it))];
}

/** The paper shading's colour, checked once: a colour as this package reads one. */
function checkPaper(options) {
  if (options.colour !== undefined) readColour(options.colour, `the style's shading "paper"'s colour`);
}

/** Every face and a floor's ground the paper's colour: given whatever the base, since it does not depend on it. */
function paper(items, { options }) {
  const colour = readColour(options.colour ?? '#ffffff', `the style's shading "paper"'s colour`);
  return items.map((it) => (solid.has(it.role) || it.role === 'ground' ? { ...it, fill: { mix: [colour, 1], colour } } : it));
}

function noLine(items, { colours }) {
  return items.map((it) => (solid.has(it.role) ? { ...it, stroke: null } : it.role === 'grid' ? { ...it, stroke: gridStroke(colours) }
    : it.role === 'seam' ? { ...it, stroke: seamStroke(colours, 2.5) } : it));
}

const same = (items) => items;

/** Every choice this package ships, by column. */
export const BUILT_IN_CHOICES = Object.freeze([
  { column: 'shape', name: 'box', apply: boxShape, options: [] },
  { column: 'shading', name: 'tones', apply: tones, options: [] },
  { column: 'shading', name: 'paper', apply: paper, options: ['colour'], check: checkPaper,
    clashes: [{ column: 'line', name: 'none', fix: 'paper faces on a paper page show only by their lines: use line "contour" or "ink", or a shading that colours the faces ("tones")' }] },
  { column: 'line', name: 'ink', apply: ink, options: ['width'], check: checkInk },
  { column: 'line', name: 'none', apply: noLine, options: [] },
  { column: 'line', name: 'contour', apply: contour, options: ['width', 'inner'], check: checkContour },
  { column: 'palette', name: 'theme', apply: same, options: [] },
  { column: 'palette', name: 'duotone', apply: duotone, options: ['ink', 'accent', 'paper'], check: checkDuotone },
  { column: 'texture', name: 'none', apply: same, options: [] },
].map((c) => Object.freeze({ check: null, ...c, options: Object.freeze(c.options), unseeded: Object.freeze([]), clashes: Object.freeze((c.clashes ?? []).map((x) => Object.freeze(x))) })));
