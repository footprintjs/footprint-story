// footprint-storyreel src/kits/isometric/motion-side.mjs at 307d0f7 (0.44.0), lines 34 (worldPx) and 121–124 (sideFoot); src/kits/isometric/motion.mjs lines 216–218 (SAMPLE_RATE, SAMPLES_MOST, samplesOf), `export` added to samplesOf.
export const worldPx = (grid) => grid.tile[0] / Math.SQRT2;
export function sideFoot({origin, heading, unit, offset, levels}, sample) {
  const along = sample.x / unit, lift = -sample.y / unit - offset;
  return [origin[0] + along * heading[0], origin[1] + along * heading[1], levels.find((l) => Math.abs(l - lift) < 1e-9) ?? Math.max(0, lift)];
}
const SAMPLE_RATE = 30, SAMPLES_MOST = 900;
/** The moments a move is checked at: its start, its end, and SAMPLE_RATE a second between. */
export const samplesOf = (m) => { const n = Math.min(SAMPLES_MOST, Math.max(2, Math.ceil(m.seconds * SAMPLE_RATE))); return Array.from({length: n + 1}, (_, k) => m.start + (k / n) * m.seconds); };
