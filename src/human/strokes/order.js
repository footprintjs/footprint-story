/**
 * The order a hand draws a drawing's lines in, as data: which strokes, from where, and why each starts where it does.
 *
 * ORDER_RULE, in words (the rule the plan records):
 *   1. Piece by piece (`group`), from the top left: the piece whose points reach the least x + y first.
 *   2. In each piece: its outline, then its detail, then its fills.
 *   3. In a layer of lines, the lines are a graph (graph.js: a line two shapes share is drawn once). The first stroke
 *      starts at the corner nearest the pen — the page's top left for the first stroke of all — choosing among the
 *      corners that meet an odd number of lines left when there are any (a trail that draws the most lines in one
 *      stroke starts and ends at one), and goes on along the straightest line left that does not cut the rest in two
 *      (Fleury's rule); the first line of a stroke is the one heading most toward the bottom right. A stroke ends where
 *      no line is left; the next starts by the same rule.
 *   4. Ties go to the least x + y, then the least y, then the order the shapes were given in.
 * WHY: a hand blocks in a shape before it adds detail and shading, works across the page the way it reads, and lifts
 * the pen as little as it can (Van Sommers 1984, "Drawing and cognition": drawers anchor at the top left, start from an
 * end of a line, and chain lines that meet without lifting). The fewest strokes a layer allows is a fact about its graph
 * (graph.js · leastStrokes); rule 3 reaches it whenever a stroke can be drawn to its end without a choice that strands
 * lines, and the `pen-lifts` critic says when it does not.
 */
import { graphOf, incidence, isBridge, leastStrokes } from './graph.js';
import { edgesOf } from './shapes.js';

export const ORDER_RULE = 'piece by piece from the top left; in each its outline, then its detail, then its fills; in a layer of lines each stroke starts at the corner nearest the pen (an odd corner first, the page\'s top left for the first) and follows the straightest line left that does not cut the rest in two; ties to the least x + y, then y, then the order given';
/** Past this many edges in a layer, the bridge test is left out (each test walks the layer): rule 3 is then plain greedy. Ours. */
export const MOST_BRIDGE_EDGES = 2048;
/** The way a stroke's first line heads when it may choose: toward the bottom right (y runs down). */
const DOWN_RIGHT = [Math.SQRT1_2, Math.SQRT1_2];

const topLeft = (p) => p[0] + p[1];
/** The least x + y over a list of points, then the least y: a piece's or a fill's place from the top left. */
export function topLeftKey(points) {
  let best = null;
  for (const p of points) if (!best || topLeft(p) < topLeft(best) || (topLeft(p) === topLeft(best) && p[1] < best[1])) best = p;
  return best;
}
const before = (a, b) => topLeft(a) - topLeft(b) || a[1] - b[1];

/** The pieces, in order: each its name and its shapes, the piece reaching furthest to the top left first. */
export function piecesInOrder(shapes) {
  const byGroup = new Map();
  for (const s of shapes) { if (!byGroup.has(s.group)) byGroup.set(s.group, []); byGroup.get(s.group).push(s); }
  const pieces = [...byGroup].map(([group, list]) => ({ group, shapes: list, key: topLeftKey(list.flatMap((s) => s.points)), first: list[0].index }));
  return pieces.sort((a, b) => before(a.key, b.key) || a.first - b.first);
}

/** The direction from corner a to corner b, as a unit vector (none for a line of no length). */
const heading = (a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy); return l > 0 ? [dx / l, dy / l] : [0, 0]; };
/** How far a turn from one heading to another is, in radians (0: straight on). */
const turn = (u, v) => Math.abs(Math.atan2(u[0] * v[1] - u[1] * v[0], u[0] * v[0] + u[1] * v[1]));

/**
 * One layer of lines walked into strokes by rule 3: [{points: corners in drawing order, rule, owners}], and where the
 * pen ends. `pen` is where it is ([x, y]), or null before the first stroke. Each stroke's `rule` says why it starts
 * there: 'first' (the page's top left), 'odd' (the nearest corner meeting an odd number of lines left) or 'nearest'.
 */
export function walkLines(shapes, pen) {
  const graph = graphOf(shapes.map((s) => ({ points: s.points, edges: edgesOf(s), owner: s.index })));
  const at = incidence(graph), used = graph.edges.map(() => false), left = at.map((list) => list.length);
  const bridges = graph.edges.length <= MOST_BRIDGE_EDGES, strokes = [];
  let remaining = graph.edges.length, here = pen;
  while (remaining > 0) {
    const live = graph.corners.map((_, i) => i).filter((i) => left[i] > 0), odd = live.filter((i) => left[i] % 2 === 1), choice = odd.length ? odd : live;
    const far = (i) => (here ? Math.hypot(graph.corners[i][0] - here[0], graph.corners[i][1] - here[1]) : 0);
    const start = choice.reduce((b, i) => (far(i) < far(b) || (far(i) === far(b) && (before(graph.corners[i], graph.corners[b]) < 0 || (before(graph.corners[i], graph.corners[b]) === 0 && i < b))) ? i : b));
    const stroke = { points: [graph.corners[start]], corners: [start], owners: [], rule: here ? (odd.length ? 'odd' : 'nearest') : 'first' };
    let v = start, dir = null;
    for (;;) {
      let options = at[v].filter((k) => !used[k]);
      if (!options.length) break;
      if (bridges && options.length > 1) { const safe = options.filter((k) => !isBridge(graph, at, used, k, v)); if (safe.length) options = safe; }
      const other = (k) => (graph.edges[k].a === v ? graph.edges[k].b : graph.edges[k].a);
      const cost = (k) => turn(dir ?? DOWN_RIGHT, heading(graph.corners[v], graph.corners[other(k)]));
      const k = options.reduce((b, x) => (cost(x) < cost(b) - 1e-12 || (Math.abs(cost(x) - cost(b)) <= 1e-12 && x < b) ? x : b));
      const w = other(k);
      used[k] = true; left[v] -= 1; left[w] -= 1; remaining -= 1;
      dir = heading(graph.corners[v], graph.corners[w]);
      stroke.points.push(graph.corners[w]); stroke.corners.push(w); stroke.owners.push(graph.edges[k].owner);
      v = w;
    }
    strokes.push(stroke);
    here = graph.corners[v];
  }
  return { strokes, pen: here, least: leastStrokes(graph), edges: graph.edges.length };
}
