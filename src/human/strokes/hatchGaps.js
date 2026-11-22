/**
 * The `hatch-gaps` critic: the widest band across a hatch that no line of it passes through, over its spacing. Each
 * set of fill lines is read across (along the normal to its angle): every drawn point of its strokes is placed by how
 * far across it lies, and the bands between are measured — between two lines, and from the shape's edge (`lo`, `hi`)
 * to the line nearest it, counted twice (the hatch's own margin is at most half a spacing, so an edge band of half a
 * spacing weighs as a whole one between lines). A concave shape's arms are read together.
 *
 * Only where the shape is: when a set carries its `ring` (and `holes`), a band that would be faulted is measured again
 * as the widest stretch of it where a line across would cross at least REGION_LEAST px of the shape — a hole that
 * covers a band from side to side leaves nothing to hatch there, and is no gap.
 * A missing line leaves a stripe the eye reads as a mistake; a band over 1.5 spacings is one (HATCH_GAP_MOST, ours).
 */
import { finite } from '../read.js';
import { sketchOf } from './critique.js';

export const HATCH_GAP_MOST = 1.5;
/** The least a line across must cross of the shape for that stretch of the band to count, in px. Ours: a pixel. */
export const REGION_LEAST = 1;

const ringLike = (r) => Array.isArray(r) && r.length >= 3 && r.every((p) => Array.isArray(p) && finite(p[0]) && finite(p[1]));

/** Where the line `across = c` is inside one ring, as intervals along it (the even-odd rule). */
function insideAlong(r, n, c) {
  const d = [n[1], -n[0]], hits = [];
  r.forEach((p, i) => {
    const q = r[(i + 1) % r.length], pa = p[0] * n[0] + p[1] * n[1] - c, qa = q[0] * n[0] + q[1] * n[1] - c;
    if ((pa < 0) !== (qa < 0)) { const f = pa / (pa - qa); hits.push((p[0] + (q[0] - p[0]) * f) * d[0] + (p[1] + (q[1] - p[1]) * f) * d[1]); }
  });
  hits.sort((a, b) => a - b);
  const out = [];
  for (let k = 1; k < hits.length; k += 2) out.push([hits[k - 1], hits[k]]);
  return out;
}

/** How much of the shape — inside its ring, outside every hole — the line `across = c` crosses, in px. */
function chordAt(rings, n, c) {
  let parts = insideAlong(rings[0], n, c);
  for (const hole of rings.slice(1)) {
    for (const [h0, h1] of insideAlong(hole, n, c)) parts = parts.flatMap(([a, b]) => [[a, Math.min(b, h0)], [Math.max(a, h1), b]].filter(([x, y]) => y > x));
  }
  return parts.reduce((sum, [a, b]) => sum + b - a, 0);
}

/** The widest stretch of the band from a to b (across) where the shape is, read every h px. */
function widestThere(rings, n, a, b, h) {
  let best = 0, run = 0;
  for (let u = a + h / 2; u < b; u += h) {
    run = chordAt(rings, n, u) >= REGION_LEAST ? run + h : 0;
    best = Math.max(best, run);
  }
  return Math.min(b - a, best);
}

export const hatchGaps = Object.freeze({
  name: 'hatch-gaps',
  limit: HATCH_GAP_MOST,
  measure(track) {
    const sketch = sketchOf(track);
    if (!sketch || !sketch.sets.some(Boolean)) return null;
    let worst = null;
    sketch.sets.forEach((set, index) => {
      if (!set) return;
      const rad = (set.angle * Math.PI) / 180, n = [-Math.sin(rad), Math.cos(rad)], across = [];
      for (const s of sketch.strokes) if (s.set === index && s.xs) s.xs.forEach((x, i) => across.push(x * n[0] + s.ys[i] * n[1]));
      across.sort((a, b) => a - b);
      const bands = across.length ? [{ from: set.lo, to: across[0], edge: true }, { from: across[across.length - 1], to: set.hi, edge: true }] : [{ from: set.lo, to: set.hi, edge: true }];
      for (let i = 1; i < across.length; i += 1) bands.push({ from: across[i - 1], to: across[i], edge: false });
      const rings = ringLike(set.ring) ? [set.ring, ...(Array.isArray(set.holes) ? set.holes.filter(ringLike) : [])] : null;
      for (const b of bands) {
        const weigh = (gap) => (b.edge ? 2 * gap : gap) / set.spacing;
        let gap = b.to - b.from;
        // a band that would be faulted, read again where the shape is: a hole across it is nothing to hatch
        if (rings && weigh(gap) > HATCH_GAP_MOST) gap = widestThere(rings, n, b.from, b.to, Math.min(0.5, set.spacing / 8));
        if (!worst || weigh(gap) > worst.ratio) worst = { ratio: weigh(gap), gap, spacing: set.spacing, set: index, edge: b.edge };
      }
    });
    return { value: worst.ratio, basis: worst };
  },
  finding(ratio, who, basis) {
    if (!(ratio > HATCH_GAP_MOST)) return null;
    return { level: 'warn', message: `${who}: its fill ${basis.set} leaves a band ${basis.gap.toFixed(1)} px wide ${basis.edge ? 'at its edge' : 'between two lines'} with no line through it, where its lines are ${basis.spacing} px apart — it reads as a missed line`,
      fix: `hatch every line: use model: 'hand-sketch', or give the shape's fill a closer spacing (fill: {spacing: ${Math.max(3, Math.round(basis.spacing * 0.75))}})` };
  },
});
