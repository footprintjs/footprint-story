/**
 * What the critics read of a sampled track: the speed at each sample and the distance along. A track is
 * `{who, family, model, seconds, pushes, samples: [{t, x, y, …}, …], plan}` (src/human/models/move.js · sampleTrack makes it).
 */

/** The speed between each two samples, in px a second, set at the time between them: [{t, speed, along}]. */
export function speedsOf(samples) {
  const out = [];
  let along = 0;
  for (let i = 1; i < samples.length; i += 1) {
    const a = samples[i - 1], b = samples[i], ds = Math.hypot(b.x - a.x, b.y - a.y), dt = b.t - a.t;
    along += ds;
    if (dt > 0) out.push({ t: (a.t + b.t) / 2, speed: ds / dt, along: along - ds / 2 });
  }
  return out;
}

/**
 * How many times a list of speeds rises and falls again by more than `share` of its highest (10% unless given): its
 * peaks, each counted once however it wobbles on top. A peak still rising at the end counts.
 */
export function speedPeaks(speeds, share = 0.1) {
  const top = Math.max(0, ...speeds), h = top * share;
  if (!(top > 0)) return 0;
  let trough = speeds[0], peak = speeds[0], rising = true, count = 0;
  for (const v of speeds) {
    if (rising) {
      if (v > peak) peak = v;
      else if (peak - v > h && peak - trough > h) { count += 1; rising = false; trough = v; }
      if (v < trough) { trough = v; peak = v; }
    } else if (v < trough) trough = v;
    else if (v - trough > h) { rising = true; peak = v; }
  }
  if (rising && peak - trough > h) count += 1;
  return count;
}
