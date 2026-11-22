/**
 * The `volume` critic: the largest change of area a squash or a stretch makes, |sx · sy − 1| over the samples that
 * carry a scale. A body that squashes on landing keeps its volume — flatter and wider at once (the animators' "squash
 * and stretch", Thomas & Johnston 1981); one that grows or shrinks as it squashes reads as rubber, not as mass.
 */

/** The most a squash may change the area: 10%. Ours. */
export const VOLUME_MOST = 0.1;

export const volume = Object.freeze({
  name: 'volume',
  limit: VOLUME_MOST,
  measure(track) {
    let most = 0, at = null, scaled = 0;
    for (const s of track.samples) {
      if (s.sx === undefined && s.sy === undefined) continue;
      scaled += 1;
      const change = Math.abs((s.sx ?? 1) * (s.sy ?? 1) - 1);
      if (change > most) { most = change; at = s.t; }
    }
    if (!scaled) return null;   // it never squashes: there is no area to keep
    return { value: most, basis: { at, scaled } };
  },
  finding(value, who, basis) {
    if (!(value > VOLUME_MOST)) return null;
    return { level: 'warn', message: `${who}: its squash changes its area by ${(value * 100).toFixed(0)}% (at ${basis.at.toFixed(2)} s) — it reads as rubber, not as a body with mass`,
      fix: "keep its area: sy = 1 / sx when it squashes (model: {name: 'bounce', squash: 0.2} does)" };
  },
});
