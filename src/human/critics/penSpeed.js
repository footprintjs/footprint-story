/**
 * The `pen-speed` critic: how far a pen's speed is from the two-thirds power law (speed ∝ curvature^−1/3). The track is
 * walked again every few px (so samples bunched in time do not weigh more), its bend read over the width the pen model
 * reads it over (paths/curvature.js · curvaturesOver: a tremor's wobble is not the path's bend), and the law fitted
 * with its exponent held at 1/3; the answer is what is left, as the root mean square of the log speeds (0.1 ≈ 10% off).
 * The ramps at the two ends are left out: a pen starting from rest is slow because it starts, not because it bends. A
 * pen that keeps one speed round a curl reads as a plotter.
 */
import { POWER_LAW, powerLawFit } from '../laws/powerLaw.js';
import { curvaturesOver } from '../paths/curvature.js';
import { BEND_WIDTH } from '../models/powerLawPen.js';

/** The most a pen's log speed may be off the law, on average, before it reads as a machine: 0.2 (about 22%). Ours. */
export const PEN_SPEED_MOST = 0.2;
/** The share of the line at each end left out (the ramps), and the step the track is walked at, in px. */
const ENDS = 0.15, STEP = 4;

/** The track walked every `step` px: [{x, y, t}] by distance, the time found between the samples it falls between. */
function byDistance(samples, step) {
  const out = [{ x: samples[0].x, y: samples[0].y, t: samples[0].t }];
  let next = step, along = 0;
  for (let i = 1; i < samples.length; i += 1) {
    const a = samples[i - 1], b = samples[i], ds = Math.hypot(b.x - a.x, b.y - a.y);
    while (ds > 0 && along + ds >= next) {
      const f = (next - along) / ds;
      out.push({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, t: a.t + (b.t - a.t) * f });
      next += step;
    }
    along += ds;
  }
  return { points: out, length: along };
}

export const penSpeed = Object.freeze({
  name: 'pen-speed',
  limit: PEN_SPEED_MOST,
  measure(track) {
    let total = 0;
    for (let i = 1; i < track.samples.length; i += 1) total += Math.hypot(track.samples[i].x - track.samples[i - 1].x, track.samples[i].y - track.samples[i - 1].y);
    const step = Math.max(STEP, total / 8000), { points, length } = byDistance(track.samples, step);
    if (points.length < 12) return null;   // too short a line to say how its speed follows its bends
    const bends = curvaturesOver(points.map((p) => [p.x, p.y]), Math.max(1, Math.round(BEND_WIDTH / step))), speeds = [], kappa = [];
    for (let i = 1; i < points.length - 1; i += 1) {
      const share = (i * step) / length, dt = points[i + 1].t - points[i - 1].t;
      if (share < ENDS || share > 1 - ENDS || !(dt > 0)) continue;
      speeds.push((2 * step) / dt); kappa.push(bends[i] + POWER_LAW.floor);
    }
    const fit = powerLawFit(speeds, kappa, { exponent: POWER_LAW.exponent });
    return fit ? fit.error : null;
  },
  finding(error, who) {
    if (!(error > PEN_SPEED_MOST)) return null;
    return { level: 'warn', message: `${who}: its pen keeps its speed round the bends (${(error * 100).toFixed(0)}% off the two-thirds power law) — it reads as a plotter, not a hand`,
      fix: "use do: 'draw' with model: 'power-law', which slows where the line bends" };
  },
});
