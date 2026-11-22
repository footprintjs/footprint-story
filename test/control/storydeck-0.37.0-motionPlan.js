// storydeck deck/motionPlan.js at 502681d (0.37.0), lines 33–36 (sideFoot) and 136–138 (SAMPLE_RATE, SAMPLES_MOST, checkTimes); `export` added to sideFoot.
export function sideFoot({origin, heading, unit, levels}, sample) {
  const along = sample.x / unit, lift = -sample.y / unit;
  return [origin[0] + along * heading[0], origin[1] + along * heading[1], levels.find((l) => Math.abs(l - lift) < 1e-9) ?? Math.max(0, lift)];
}
const SAMPLE_RATE = 30, SAMPLES_MOST = 900;
/** The moments of its click a move is checked at: its start, its end, and SAMPLE_RATE a second between. */
export const checkTimes = (m) => { const n = Math.min(SAMPLES_MOST, Math.max(2, Math.ceil(m.seconds * SAMPLE_RATE))); return Array.from({length: n + 1}, (_, k) => (k / n) * m.seconds); };
