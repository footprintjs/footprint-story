/**
 * Strokes and the isometric paint list (src/isometric/paint.js), both ways, as plain data — this file reads and writes
 * the list's items by their documented shape and imports nothing from src/isometric (a page that moves a hand never
 * loads the map maths: test/doors.test.js).
 *
 *   shapesOfPaint(items, {roles})       → shapes (shapes.js): the faces' edges, the outline first
 *   ringOf(item)                        → a face's ring [[x, y], …]: a polygon's points, an ellipse or a path walked round
 *   strokeItems(plan, {of, role, colour, alpha, width, at}) → paint items {item: 'stroke', points: [[x, y, width, t], …]}
 *   (the ring round a stroke, its caps, and a stroke as drawn by a time: outline.js · strokeOutline, strokeAt)
 *
 * Which edges are the outline: an edge one face has is on the piece's silhouette (outline); one two faces share is an
 * inner edge (detail) — a box's three inner edges, where its faces meet. An edge a face painted later covers (its
 * middle more than HIDDEN px inside that face) is dropped: a painter's later face would hide it, and a stroke laid over
 * the whole list would not be hidden (the straight close of a cylinder's side, across its top).
 */
import { mergeCorners } from './graph.js';
import { insideRing, toRing } from './geometry.js';

/** The points an ellipse is walked round with, and an arc per this many radians. Ours: smooth at a 2 px step for a map's sizes. */
export const ELLIPSE_POINTS = 48;
const ARC_STEP = Math.PI / 24;
/** How far inside a later face an edge's middle must be to count as hidden, in px. */
export const HIDDEN = 0.5;
const SOLID = Object.freeze(['top', 'left', 'right', 'side']);

/** An arc's points from angle `from` to `to` (radians, y down), its first left out. The paint list keeps an arc's
 *  sweep the way it turns (anticlockwise: `from` above `to`), so `to - from` is the sweep either way. */
function arcPoints(cx, cy, rx, ry, from, to) {
  const sweep = to - from, n = Math.max(2, Math.ceil(Math.abs(sweep) / ARC_STEP));
  return Array.from({ length: n }, (_, k) => { const a = from + (sweep * (k + 1)) / n; return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)]; });
}

/** A face's rings: a polygon's points; an ellipse walked round; a path's sub-paths walked, each a ring when closed. */
export function ringsOf(item) {
  if (item.item === 'polygon') return [{ points: item.points.map((p) => [p[0], p[1]]), closed: true }];
  if (item.item === 'ellipse') return [{ points: Array.from({ length: ELLIPSE_POINTS }, (_, k) => { const a = (2 * Math.PI * k) / ELLIPSE_POINTS; return [item.cx + item.rx * Math.cos(a), item.cy + item.ry * Math.sin(a)]; }), closed: true }];
  if (item.item === 'path') {
    const out = [];
    let cur = null;
    for (const s of item.segments) {
      if (s[0] === 'move') { cur = { points: [[s[1], s[2]]], closed: false }; out.push(cur); }
      else if (s[0] === 'line') cur.points.push([s[1], s[2]]);
      else if (s[0] === 'arc') { cur.points.push([s[1] + s[3] * Math.cos(s[5]), s[2] + s[4] * Math.sin(s[5])], ...arcPoints(s[1], s[2], s[3], s[4], s[5], s[6])); }
      else cur.closed = true;
    }
    // a point the next one repeats (an arc reached from where the pen already was) is one point
    for (const r of out) r.points = r.points.filter((p, i) => i === 0 || Math.hypot(p[0] - r.points[i - 1][0], p[1] - r.points[i - 1][1]) > 1e-9);
    return out.filter((r) => r.points.length >= 2);
  }
  if (item.item === 'lines') return item.segments.map((s) => ({ points: [[s[0], s[1]], [s[2], s[3]]], closed: false }));
  return [];
}

/** A face's one ring (its first closed sub-path, or its points as they come): what a hatch fills. */
export const ringOf = (item) => ringsOf(item)[0]?.points ?? [];

/**
 * The faces' edges as shapes, the outline (an edge one face has) before the detail (one two faces share), each a line
 * of two points in the group `group`; an edge a later face hides left out. `roles`: the faces read (top, left, right
 * and side unless given — what the ink line draws round).
 */
export function shapesOfPaint(items, { roles = SOLID, group = '' } = {}) {
  const faces = items.map((it, index) => ({ it, index })).filter(({ it }) => roles.includes(it.role)).map(({ it, index }) => ({ index, rings: ringsOf(it) }));
  const all = faces.flatMap((f) => f.rings.flatMap((r) => r.points)), { ids, corners } = mergeCorners(all);
  const edges = new Map();
  let base = 0;
  for (const f of faces) {
    for (const r of f.rings) {
      const n = r.points.length, pairs = Array.from({ length: r.closed && n > 2 ? n : n - 1 }, (_, i) => [i, (i + 1) % n]);
      for (const [i, j] of pairs) {
        const a = ids[base + i], b = ids[base + j];
        if (a === b) continue;
        const key = a < b ? `${a},${b}` : `${b},${a}`;
        if (!edges.has(key)) edges.set(key, { a, b, faces: new Set(), first: f.index });
        edges.get(key).faces.add(f.index);
      }
      base += n;
    }
  }
  const shapes = [];
  for (const e of edges.values()) {
    const p = corners[e.a], q = corners[e.b], mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
    const hidden = faces.some((f) => f.index > e.first && !e.faces.has(f.index) && f.rings.some((r) => r.closed && insideRing(mx, my, r.points) && toRing(mx, my, r.points) > HIDDEN));
    if (!hidden) shapes.push({ points: [[p[0], p[1]], [q[0], q[1]]], layer: e.faces.size === 1 ? 'outline' : 'detail', group });
  }
  return shapes;
}

/**
 * A plan's strokes as paint items: `{item: 'stroke', role, of, points: [[x, y, width, t], …], fill: null, stroke}` —
 * each point where the pen is, the width it lays down there, and when (seconds from the piece's start: `at` plus the
 * plan's time), so a painter may draw the piece being drawn. `stroke.width` is the line's own width (the widest a
 * point may be); `cap` round, as a pen's end is.
 */
export function strokeItems(plan, { of, role, colour = null, alpha = 1, width, at = 0, strokes = plan.strokes }) {
  return strokes.map((s) => ({ item: 'stroke', role, of, points: s.xs.map((x, i) => [x, s.ys[i], s.ws[i], at + s.ts[i]]), fill: null,
    stroke: { colour, alpha, width, join: 'round', cap: 'round' } }));
}
