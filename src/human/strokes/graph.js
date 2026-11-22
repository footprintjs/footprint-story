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

/**
 * Corners for points: {ids: the corner of each point, corners}. Points within `tolerance` of each other are one corner,
 * and so is every point joined to it by such a chain (transitive: 0, 0.4 and 0.8 px along are one corner), numbered in
 * the order first met, each placed where its first point is. A grid of tolerance-wide cells keeps it one pass.
 */
export function mergeCorners(points, tolerance = MERGE) {
  const parent = points.map((_, i) => i), find = (i) => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  const cells = new Map(), key = (cx, cy) => `${cx},${cy}`;
  points.forEach(([x, y], i) => {
    const cx = Math.floor(x / tolerance), cy = Math.floor(y / tolerance);
    for (let gx = cx - 1; gx <= cx + 1; gx += 1) for (let gy = cy - 1; gy <= cy + 1; gy += 1) {
      for (const j of cells.get(key(gx, gy)) ?? []) if (Math.hypot(points[j][0] - x, points[j][1] - y) <= tolerance) { const a = find(i), b = find(j); if (a !== b) parent[Math.max(a, b)] = Math.min(a, b); }
    }
    const c = key(cx, cy);
    if (!cells.has(c)) cells.set(c, []);
    cells.get(c).push(i);
  });
  const number = new Map(), corners = [];
  const ids = points.map((p, i) => { const r = find(i); if (!number.has(r)) { number.set(r, corners.length); corners.push([points[r][0], points[r][1]]); } return number.get(r); });
  return { ids, corners };
}

/**
 * A path's points with each one closer than `tolerance` to the last one kept folded into it: {kept, of} — `of[i]` the
 * kept point point i stands for. WHY before the merge: corners merge transitively, and a line sampled finer than the
 * tolerance would otherwise fold whole into one corner; folded first, a path's own neighbours are never that close.
 */
function fold(points, tolerance) {
  const kept = [], of = [];
  for (const p of points) {
    const last = kept[kept.length - 1];
    if (last && Math.hypot(p[0] - last[0], p[1] - last[1]) < tolerance) of.push(kept.length - 1);
    else { kept.push(p); of.push(kept.length - 1); }
  }
  return { kept, of };
}

/**
 * The graph of some paths: each path's points folded (fold) and merged into corners, each of its edges (pairs of point
 * indices) joined once. An edge whose two ends merge into one corner is dropped (it draws nothing). `owner` is the
 * first path that had it.
 */
export function graphOf(paths) {
  const folded = paths.map((p) => fold(p.points, MERGE)), { ids, corners } = mergeCorners(folded.flatMap((f) => f.kept));
  const seen = new Set(), edges = [];
  let base = 0;
  paths.forEach((p, k) => {
    const { kept, of } = folded[k];
    for (const [i, j] of p.edges) {
      const a = ids[base + of[i]], b = ids[base + of[j]], key = a < b ? `${a},${b}` : `${b},${a}`;
      if (a === b || seen.has(key)) continue;
      seen.add(key);
      edges.push({ a, b, owner: p.owner });
    }
    base += kept.length;
  });
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
