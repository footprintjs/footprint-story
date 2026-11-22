/**
 * Two isometric style choices built on hand-drawn strokes, for later looks: a `line` that sketches a piece's edges and
 * a `texture` that hatches its faces. Each has the interface of a style choice (src/isometric/style.js:
 * `{column, name, options, check, clashes, apply(items, context)}`) and gives back paint items as plain data, the
 * strokes as `stroke` items (src/isometric/paint.js · PAINT_ITEMS) with their widths and times.
 *
 *   isoStyle({ line: 'human:sketchy', texture: 'human:hatch' }, { choices: [sketchyLine, hatchTexture] })
 *
 * WHY named under `human:` and handed in, not built into the isometric door: the isometric door never loads src/human
 * (test/doors.test.js), and a style's choice with a prefix is one a caller hands in — so a tool turns these on when its
 * painter draws `stroke` items, and not before.
 *
 *   line    human:sketchy  the faces keep their fills and lose their ink outline; their edges are drawn as a hand
 *                          would (strokes/plan.js): the silhouette first, then the inner edges, as few strokes as the
 *                          corners allow, hooked at sharp corners, tapered, with the seeded tremor. A floor keeps its
 *                          tile lines as the ink line keeps them. Options: width (0.5 to 20 px; 2.5), tremor (0 to 8;
 *                          0.8), overshoot (0 to 12 px; 3), speed (50 to 5000 px a second; 400).
 *   texture human:hatch    a left face and a cylinder's side hatched, a right face cross-hatched (the darker side), the
 *                          top left clear (the lit face) — ROLE_FILLS; each kept out of the faces painted over it.
 *                          Its strokes start after the line's (a hand hatches once the outline is in). Options:
 *                          spacing (3 to 200 px; 8), angle (-360 to 360; -45), width (0.25 to 20 px; 2.5, a fill drawn
 *                          at 40% of it), tremor (0 to 8; 0.8, a hatch at half of it).
 *
 * Seeded by the style, the piece's name and the column (the `random` a style hands each choice): the same piece, the
 * same strokes, in a deck and in a film.
 */
import { refuse, shown, finite } from '../read.js';
import { planSketch, LIFT, SKETCH, WIDTH_SHARE } from './plan.js';
import { shapesOfPaint, ringOf, strokeItems } from './paint.js';

const SOLID = new Set(['top', 'left', 'right', 'side']);
/** The most items one piece's paint list holds: the isometric MOST_PAINT_ITEMS (src/isometric/paint.js; a test pins the two equal). */
export const MOST_PIECE_ITEMS = 512;
/** A floor's tile lines, as the isometric `ink` and `none` lines keep them (src/isometric/styleChoices.js · gridStroke;
 *  a test pins the two equal). */
const gridStroke = (colours) => ({ colour: colours.ink, alpha: 0.16, width: 1.5, join: 'miter', cap: 'butt' });
/** Which faces a hatch fills, and how. */
export const ROLE_FILLS = Object.freeze({ left: 'hatch', right: 'cross-hatch', side: 'hatch' });

const number = (options, key, name, lo, hi) => { const v = options[key]; if (v !== undefined && !(finite(v) && v >= lo && v <= hi)) refuse(`the style's ${name} takes a ${key} from ${lo} to ${hi} — not ${shown(v)}`); return v; };
const area = (ring) => Math.abs(ring.reduce((s, p, i) => { const q = ring[(i + 1) % ring.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;

function checkSketchy(options) {
  number(options, 'width', 'line "human:sketchy"', 0.5, 20); number(options, 'tremor', 'line "human:sketchy"', 0, 8);
  number(options, 'overshoot', 'line "human:sketchy"', 0, 12); number(options, 'speed', 'line "human:sketchy"', 50, 5000);
}

function sketchy(items, { piece, colours, options, random }) {
  const kept = items.map((it) => (SOLID.has(it.role) ? { ...it, stroke: null } : it.role === 'grid' ? { ...it, stroke: gridStroke(colours) } : it));
  const shapes = shapesOfPaint(items, { group: piece.name });
  if (!shapes.length) return kept;
  const width = options.width ?? SKETCH.width;
  const plan = planSketch(shapes, { random, who: `the style's line "human:sketchy" on "${piece.name}"`, width, tremor: options.tremor, overshoot: options.overshoot, speed: options.speed });
  return [...kept, ...strokeItems(plan, { of: piece.name, role: 'ink', colour: colours.ink, width })];
}

function checkHatch(options) {
  number(options, 'spacing', 'texture "human:hatch"', 3, 200); number(options, 'angle', 'texture "human:hatch"', -360, 360);
  number(options, 'width', 'texture "human:hatch"', 0.25, 20); number(options, 'tremor', 'texture "human:hatch"', 0, 8);
}

function hatch(items, { piece, colours, options, random }) {
  const faces = items.map((it, index) => ({ it, index, ring: SOLID.has(it.role) ? ringOf(it) : [] })).filter((f) => f.ring.length >= 3 && area(f.ring) > 1e-9);
  const shapes = faces.filter((f) => ROLE_FILLS[f.it.role]).map((f) => ({ points: f.ring, closed: true, edge: false, group: piece.name,
    fill: { kind: ROLE_FILLS[f.it.role], angle: options.angle ?? -45, spacing: options.spacing ?? 8 },
    // kept out of every face painted after it: a later face covers what is under it
    holes: faces.filter((g) => g.index > f.index).slice(0, 16).map((g) => g.ring) }));
  if (!shapes.length) return items;
  // after the line's strokes, if it drew any: a hand hatches once the outline is in
  const drawn = items.filter((it) => it.item === 'stroke').flatMap((it) => it.points.map((p) => p[3]));
  const at = drawn.length ? Math.max(...drawn) + LIFT.seconds : 0, width = options.width ?? SKETCH.width;
  const who = `the style's texture "human:hatch" on "${piece.name}"`, spacing = options.spacing ?? 8;
  const plan = planSketch(shapes, { random, who, width, tremor: options.tremor });
  // a piece's list holds at most MOST_PIECE_ITEMS: past it, refused with the spacing that fits (lines go as 1 / spacing)
  const room = MOST_PIECE_ITEMS - items.length;
  if (plan.strokes.length > room) refuse(`${who} draws ${plan.strokes.length} hatch lines, and its piece holds ${room} more items (${MOST_PIECE_ITEMS} in all) — give a wider spacing: texture: {name: 'human:hatch', spacing: ${Math.ceil((spacing * plan.strokes.length) / room) + 1}}`);
  return [...items, ...strokeItems(plan, { of: piece.name, role: 'hatch', colour: colours.ink, width: width * WIDTH_SHARE.fill, at })];
}

/** `speed` says when, not what: left out of the seed (`unseeded`), so a slower draw keeps its wobble (the seed rule, UNSEEDED_KEYS). */
export const sketchyLine = Object.freeze({ column: 'line', name: 'human:sketchy', options: Object.freeze(['width', 'tremor', 'overshoot', 'speed']), unseeded: Object.freeze(['speed']), check: checkSketchy, clashes: Object.freeze([]), apply: sketchy });
export const hatchTexture = Object.freeze({ column: 'texture', name: 'human:hatch', options: Object.freeze(['spacing', 'angle', 'width', 'tremor']), unseeded: Object.freeze([]), check: checkHatch, clashes: Object.freeze([]), apply: hatch });
