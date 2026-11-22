/**
 * The `pen-lifts` critic: how many more strokes a sketch's lines take than its order needs — the fewest strokes that
 * draw each piece's outline and each piece's detail, each line once (graph.js · leastStrokes, Euler's count), summed.
 * A line drawn twice, or a shape traced piece by piece where its lines meet end to end, costs a lift a hand would not
 * make; it reads as traced, not drawn. Fills are left out: a hatch lifts between its lines by design.
 */
import { graphOf, leastStrokes } from './graph.js';
import { sketchOf } from './critique.js';

/** The most strokes over the least before it reads as traced: none. */
export const PEN_LIFTS_MOST = 0;

export const penLifts = Object.freeze({
  name: 'pen-lifts',
  limit: PEN_LIFTS_MOST,
  measure(track) {
    const sketch = sketchOf(track), lines = sketch?.strokes.filter((s) => s.layer !== 'fill' && s.path) ?? [];
    if (!lines.length) return null;
    // the least by the order: each piece's outline and its detail are drawn apart, so each is its own graph
    const parts = new Map();
    for (const s of lines) { const k = JSON.stringify([s.group, s.layer]); if (!parts.has(k)) parts.set(k, []); parts.get(k).push(s); }
    let least = 0;
    for (const list of parts.values()) least += leastStrokes(graphOf(list.map((s) => ({ points: s.path, edges: s.path.slice(1).map((_, i) => [i, i + 1]), owner: s.index }))));
    return { value: Math.max(0, lines.length - least), basis: { strokes: lines.length, least, lifts: lines.length - 1 } };
  },
  finding(extra, who, basis) {
    if (!(extra > PEN_LIFTS_MOST)) return null;
    return { level: 'warn', message: `${who}: its lines take ${basis.strokes} strokes where ${basis.least} would draw them, each line once (${extra} more lifts of the pen) — it reads as traced piece by piece, not drawn`,
      fix: "draw shared corners once: give shapes that meet the same corner points, and use model: 'hand-sketch', which walks each layer's lines in as few strokes as their corners allow" };
  },
});
