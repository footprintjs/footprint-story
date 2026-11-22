/**
 * A sampled track, summed up in a bounded record: what the intent decider keeps of a move's samples. WHY bounded: a
 * track at 120 samples a second runs to thousands of samples, and the decider's state lands on a run's record every
 * step — the summary keeps the numbers a reader asks about (how long, how far, how fast at most, where it went) and
 * SUMMARY_POINTS samples spread evenly over the track, both ends in. The full track is sampleTrack's, made again on ask.
 *
 *   trackSummary(track) → {seconds, count, pushes, distance, peakSpeed, bounds: [minX, minY, maxX, maxY], points: [[t, x, y]]}
 */

/** The most samples a summary keeps: the first, the last, and evenly between. */
export const SUMMARY_POINTS = 16;

/** The track summed up: frozen plain data, at most SUMMARY_POINTS points however long the track. */
export function trackSummary(track) {
  const { samples } = track, n = samples.length;
  let distance = 0, peakSpeed = 0, minX = samples[0].x, minY = samples[0].y, maxX = minX, maxY = minY;
  for (let i = 1; i < n; i += 1) {
    const { x, y } = samples[i];
    minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    const step = Math.hypot(samples[i].x - samples[i - 1].x, samples[i].y - samples[i - 1].y), dt = samples[i].t - samples[i - 1].t;
    distance += step;
    // two samples at one time (a move of no seconds) say nothing of speed
    if (dt > 0) peakSpeed = Math.max(peakSpeed, step / dt);
  }
  const kept = n <= SUMMARY_POINTS ? samples.map((_, i) => i) : Array.from({ length: SUMMARY_POINTS }, (_, k) => Math.round((k * (n - 1)) / (SUMMARY_POINTS - 1)));
  return Object.freeze({
    seconds: track.seconds, count: n, pushes: track.pushes, distance, peakSpeed,
    bounds: Object.freeze([minX, minY, maxX, maxY]),
    points: Object.freeze(kept.map((i) => Object.freeze([samples[i].t, samples[i].x, samples[i].y]))),
  });
}
