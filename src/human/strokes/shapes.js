/**
 * What a hand is asked to draw: shapes as plain data, read once and checked.
 *
 *   { points: [[x, y], …],            2 to MOST_SHAPE_POINTS points
 *     closed?: false,                 true: the last point joins the first (a polygon, a face)
 *     layer?: 'outline' | 'detail',   what the hand draws first (outline) and after (detail); 'outline' unless given
 *     group?: '',                     which piece it belongs to: a hand draws a piece's outline before its detail
 *     edge?: true,                    false: only filled, its edge never drawn (a texture over a face that has its line)
 *     fill?: { kind: 'hatch' | 'cross-hatch' | 'scribble', angle?: 45, spacing?: 8 },   a closed shape only
 *     holes?: [[[x, y], …], …] }      what its fill keeps out of (a face painted over it)
 *
 * WHY a group: "outline before detail" is a rule within one piece — a hand blocks in a box, then draws its inner
 * edges, then hatches it; it does not outline every piece on the page first. WHY holes: a face painted later hides
 * what is under it, and a hatch drawn over it would show through.
 */
import { refuse, shown, stored, isRecord, readPoints, finite } from '../read.js';

export const SKETCH_LAYERS = Object.freeze(['outline', 'detail']);
export const FILL_KINDS = Object.freeze(['hatch', 'cross-hatch', 'scribble']);
/** A fill's usual numbers (ours): hatched at −45° — "/" on a frame whose y runs down, a right hand's hatch, lower left
 *  to upper right — and 8 px apart, about three widths of a 2.5 px ink line, so the hatch reads as a tone, not lines. */
export const HATCH = Object.freeze({ angle: -45, spacing: 8, least: 3, most: 200 });
/** The most shapes one sketch holds, the most points one shape holds, and the most points of all its shapes. */
export const MOST_SHAPES = 1024;
export const MOST_SHAPE_POINTS = 1024;
export const MOST_SKETCH_INPUT = 8192;
const SHAPE_KEYS = Object.freeze(['points', 'closed', 'layer', 'group', 'edge', 'fill', 'holes']);
const MOST_HOLES = 16;

/** A shape's fill: {kind, angle, spacing}, its numbers checked, the usual ones filled in. */
function readFill(fill, what) {
  if (!isRecord(fill)) refuse(`${what}'s fill is {kind: 'hatch' | 'cross-hatch' | 'scribble', angle?, spacing?} — not ${shown(fill)}`);
  for (const k of Object.keys(fill)) if (!['kind', 'angle', 'spacing'].includes(k)) refuse(`${what}'s fill takes kind, angle and spacing — not ${shown(k)}`);
  const kind = stored(fill, 'kind', `${what}'s fill kind`), angle = stored(fill, 'angle', `${what}'s fill angle`) ?? HATCH.angle, spacing = stored(fill, 'spacing', `${what}'s fill spacing`) ?? HATCH.spacing;
  if (!FILL_KINDS.includes(kind)) refuse(`${what}'s fill kind is ${FILL_KINDS.map((k) => `'${k}'`).join(', ')} — not ${shown(kind)}`);
  if (!(finite(angle) && angle >= -360 && angle <= 360)) refuse(`${what}'s fill angle is degrees from -360 to 360 (from the x axis toward y, which runs down) — not ${shown(angle)}`);
  if (!(finite(spacing) && spacing >= HATCH.least && spacing <= HATCH.most)) refuse(`${what}'s fill spacing is px between its lines, from ${HATCH.least} to ${HATCH.most} — not ${shown(spacing)}`);
  return Object.freeze({ kind, angle, spacing });
}

/** One shape, checked: a frozen {index, points, closed, layer, group, edge, fill, holes}. */
function readShape(raw, i, who) {
  const what = `${who}'s shapes[${i}]`;
  if (!isRecord(raw)) refuse(`${what} is a shape {points, closed?, layer?, group?, edge?, fill?, holes?} — not ${shown(raw)}`);
  for (const k of Object.keys(raw)) if (!SHAPE_KEYS.includes(k)) refuse(`${what} takes ${SHAPE_KEYS.join(', ')} — not ${shown(k)}`);
  const get = (k) => stored(raw, k, `${what}'s ${k}`);
  const points = readPoints(get('points'), `${what}'s points`, { least: 2, most: MOST_SHAPE_POINTS });
  const closed = get('closed') ?? false, layer = get('layer') ?? 'outline', group = get('group') ?? '', edge = get('edge') ?? true;
  if (typeof closed !== 'boolean' || typeof edge !== 'boolean') refuse(`${what}'s closed and edge are true or false — not ${shown([closed, edge])}`);
  if (!SKETCH_LAYERS.includes(layer)) refuse(`${what}'s layer is ${SKETCH_LAYERS.map((l) => `'${l}'`).join(' or ')} — not ${shown(layer)}`);
  if (typeof group !== 'string' || [...group].length > 64) refuse(`${what}'s group is a piece's name, at most 64 letters — not ${shown(group)}`);
  const fill = get('fill') === undefined ? null : readFill(get('fill'), what);
  if (fill && !(closed && points.length >= 3)) refuse(`${what} has a fill, and only a closed shape of 3 points or more holds one — give it closed: true`);
  if (!edge && !fill) refuse(`${what} has edge: false and no fill: nothing of it would be drawn`);
  const rawHoles = get('holes') ?? [];
  if (!Array.isArray(rawHoles) || rawHoles.length > MOST_HOLES) refuse(`${what}'s holes are a list of at most ${MOST_HOLES} rings [[x, y], …] — not ${shown(rawHoles)}`);
  if (rawHoles.length && !fill) refuse(`${what} has holes and no fill: a hole keeps a fill out, so give it a fill or leave the holes out`);
  const holes = Array.from({ length: rawHoles.length }, (_, h) => readPoints(stored(rawHoles, h, `${what}'s holes[${h}]`), `${what}'s holes[${h}]`, { least: 3, most: MOST_SHAPE_POINTS }));
  return Object.freeze({ index: i, points, closed, layer, group, edge, fill, holes: Object.freeze(holes) });
}

/** The shapes of a sketch, each read by its own stored fields: a frozen list. */
export function readShapes(list, who) {
  if (!Array.isArray(list) || list.length < 1 || list.length > MOST_SHAPES) refuse(`${who}'s shapes are a list of 1 to ${MOST_SHAPES} shapes [{points: [[x, y], …], closed?}] — not ${Array.isArray(list) ? `${list.length} of them` : shown(list)}`);
  const shapes = Array.from({ length: list.length }, (_, i) => readShape(Object.hasOwn(list, i) ? stored(list, i, `${who}'s shapes[${i}]`) : undefined, i, who));
  const total = shapes.reduce((s, sh) => s + sh.points.length + sh.holes.reduce((h, r) => h + r.length, 0), 0);
  if (total > MOST_SKETCH_INPUT) refuse(`${who}'s shapes hold ${total} points — at most ${MOST_SKETCH_INPUT}: draw it in parts`);
  return Object.freeze(shapes);
}

/** A shape's edges as pairs of point indices: each point to the next, and the last back to the first when closed. */
export function edgesOf(shape) {
  const n = shape.points.length, out = [];
  for (let i = 0; i < n - 1; i += 1) out.push([i, i + 1]);
  if (shape.closed && n > 2) out.push([n - 1, 0]);
  return out;
}
