/**
 * The `hatch-gaps` critic: the widest band across a hatch that no line of it passes through, over its spacing. Each
 * set of fill lines is read across (along the normal to its angle): every drawn point of its strokes is placed by how
 * far across it lies, and the bands between are measured — between two lines, and from the shape's edge (`lo`, `hi`)
 * to the line nearest it, counted twice (the hatch's own margin is at most half a spacing, so an edge band of half a
 * spacing weighs as a whole one between lines). A concave shape's arms are read together.
 * A missing line leaves a stripe the eye reads as a mistake; a band over 1.5 spacings is one (HATCH_GAP_MOST, ours).
 */
import { sketchOf } from './critique.js';

export const HATCH_GAP_MOST = 1.5;

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
      const bands = across.length ? [{ gap: across[0] - set.lo, edge: true }, { gap: set.hi - across[across.length - 1], edge: true }] : [{ gap: set.hi - set.lo, edge: true }];
      for (let i = 1; i < across.length; i += 1) bands.push({ gap: across[i] - across[i - 1], edge: false });
      for (const b of bands) {
        const ratio = (b.edge ? 2 * b.gap : b.gap) / set.spacing;
        if (!worst || ratio > worst.ratio) worst = { ratio, gap: b.gap, spacing: set.spacing, set: index, edge: b.edge };
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
