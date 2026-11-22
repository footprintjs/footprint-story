/**
 * The lines of a drawing as a graph: its corners (points within MERGE px of each other are one corner) and its edges
 * (each pair of corners joined once, however many shapes share the line). WHY a graph: a hand draws a line once — two
 * faces of a box share an edge, and drawing each face whole would draw it twice — and the fewest strokes that draw a
 * set of lines is a fact about its graph (Euler 1736): one stroke a connected part when every corner meets an even
 * number of lines, else one stroke for each two corners that meet an odd number.
 *
 *   graphOf(paths)           → {corners: [[x, y]], edges: [{a, b, owner}]}: paths are [{points, edges: [[i, j]], owner}]
 *   leastStrokes(graph)      → the fewest strokes that draw every edge once without drawing one twice
 *   isBridge(graph, used, e) → whether drawing edge e now cuts the lines left into two (Fleury's rule)
 */

/** Points this close (px) are one corner: well under a line's width, well over the last digits of a sum. Ours. */
export const MERGE = 0.5;

/** Corners for points, in the order first met: {ids: the corner of each point, corners}. A grid of MERGE-wide cells keeps it one pass. */
export function mergeCorners(points, tolerance = MERGE) {
  const cells = new Map(), corners = [], key = (cx, cy) => `${cx},${cy}`;
  const ids = points.map(([x, y]) => {
    const cx = Math.floor(x / tolerance), cy = Math.floor(y / tolerance);
    let best = -1, bestD = Infinity;
    for (let gx = cx - 1; gx <= cx + 1; gx += 1) for (let gy = cy - 1; gy <= cy + 1; gy += 1) {
      for (const id of cells.get(key(gx, gy)) ?? []) {
        const d = Math.hypot(corners[id][0] - x, corners[id][1] - y);
        if (d <= tolerance && (d < bestD || (d === bestD && id < best))) { best = id; bestD = d; }
      }
    }
    if (best >= 0) return best;
    corners.push([x, y]);
    const c = key(cx, cy);
    if (!cells.has(c)) cells.set(c, []);
    cells.get(c).push(corners.length - 1);
    return corners.length - 1;
  });
  return { ids, corners };
}

/**
 * The graph of some paths: each path's points merged into corners, each of its edges (pairs of point indices) joined
 * once. An edge whose two ends merge into one corner is dropped (it draws nothing). `owner` is the first path that had it.
 */
export function graphOf(paths) {
  const all = paths.flatMap((p) => p.points), { ids, corners } = mergeCorners(all);
  const seen = new Set(), edges = [];
  let base = 0;
  for (const p of paths) {
    for (const [i, j] of p.edges) {
      const a = ids[base + i], b = ids[base + j], k = a < b ? `${a},${b}` : `${b},${a}`;
      if (a === b || seen.has(k)) continue;
      seen.add(k);
      edges.push({ a, b, owner: p.owner });
    }
    base += p.points.length;
  }
  return { corners, edges };
}

/** The edges at each corner: lists of edge indices. */
export function incidence(graph) {
  const at = graph.corners.map(() => []);
  graph.edges.forEach((e, i) => { at[e.a].push(i); at[e.b].push(i); });
  return at;
}

/**
 * The fewest strokes that draw every edge of the graph, each edge once: over each connected part with an edge, one
 * stroke when no corner meets an odd number of its edges, else half the corners that do (Euler's theorem on trails).
 */
export function leastStrokes(graph) {
  const parent = graph.corners.map((_, i) => i), find = (i) => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  const degree = graph.corners.map(() => 0);
  for (const e of graph.edges) { degree[e.a] += 1; degree[e.b] += 1; parent[find(e.a)] = find(e.b); }
  const odd = new Map();
  degree.forEach((d, i) => { if (d > 0) { const r = find(i); odd.set(r, (odd.get(r) ?? 0) + (d % 2)); } });
  let strokes = 0;
  for (const o of odd.values()) strokes += Math.max(1, o / 2);
  return strokes;
}

/**
 * Whether drawing edge `e` now would leave the lines not yet drawn in two parts: its far end can no longer be reached
 * from its near end `from` along the edges left. Fleury's rule (1883): a stroke that crosses such a bridge too early
 * strands the lines behind it, and they cost another stroke.
 */
export function isBridge(graph, at, used, e, from) {
  const to = graph.edges[e].a === from ? graph.edges[e].b : graph.edges[e].a, seen = new Set([from]), todo = [from];
  while (todo.length) {
    const v = todo.pop();
    for (const k of at[v]) {
      if (k === e || used[k]) continue;
      const w = graph.edges[k].a === v ? graph.edges[k].b : graph.edges[k].a;
      if (w === to) return false;
      if (!seen.has(w)) { seen.add(w); todo.push(w); }
    }
  }
  return true;
}
