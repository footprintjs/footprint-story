/**
 * The two-thirds power law: a hand slows where its path bends (Lacquaniti, Terzuolo & Viviani 1983). Its angular speed
 * goes as the curvature to the power 2/3; said of the speed along the path, speed = gain · curvature^(−1/3). WHY: a pen
 * that keeps one speed round a tight curl reads as a plotter; one that slows into it reads as a hand.
 *
 * Two of our own, both named in POWER_LAW:
 *   floor = 0.002 per px — added to the curvature, so a straight stretch (no curvature, where the law asks for endless
 *           speed) runs at a top speed: a bend wider than 500 px counts as nearly straight.
 *   ramp = 0.1 — the pen gathers speed from rest over the first tenth of the length and slows to rest over the last
 *           (speed ∝ the square root of the distance from the end: an even push), because a hand starts and stops still.
 */
import { refuse, shown, finite } from '../read.js';

export const POWER_LAW = Object.freeze({ exponent: 1 / 3, floor: 0.002, ramp: 0.1 });

/** The speed the law gives at a curvature (per px), for a gain of 1 unless given: gain · (curvature + floor)^(−exponent). */
export function powerLawSpeed(curvature, { gain = 1, exponent = POWER_LAW.exponent, floor = POWER_LAW.floor } = {}) {
  if (!(finite(curvature) && curvature >= 0)) refuse(`a curvature is from 0 (per px: 1 over the bend's radius) — not ${shown(curvature)}`);
  if (!(finite(floor) && floor >= 0 && curvature + floor > 0)) refuse(`the power law's floor is from 0 per px, and above 0 where the curvature is 0 — not ${shown(floor)}`);
  return gain * (curvature + floor) ** -exponent;
}

/** How fast the pen goes at distance s of a line `length` long, as a share of its top speed there: the ramps at the ends. */
export function rampShare(s, length, ramp = POWER_LAW.ramp) {
  if (!(ramp > 0)) return 1;
  const r = ramp * length;
  return Math.sqrt(Math.max(0, Math.min(1, s / r, (length - s) / r)));
}

/**
 * When the pen reaches each point of a line, in seconds from 0 to `seconds`: `along` the distance to each point (from
 * 0, rising), `curvatures` the curvature at each. Each stretch takes its length over the law's speed at its middle
 * (times the ramp), and the times are scaled so the last is `seconds` exactly.
 */
export function powerLawTimes(along, curvatures, seconds, { exponent = POWER_LAW.exponent, floor = POWER_LAW.floor, ramp = POWER_LAW.ramp } = {}) {
  const n = along.length, length = along[n - 1], raw = [0];
  for (let i = 1; i < n; i += 1) {
    const ds = along[i] - along[i - 1];
    const speed = powerLawSpeed((curvatures[i - 1] + curvatures[i]) / 2, { exponent, floor }) * rampShare((along[i - 1] + along[i]) / 2, length, ramp);
    raw.push(raw[i - 1] + (ds > 0 ? ds / speed : 0));
  }
  const total = raw[n - 1];
  return raw.map((t, i) => (i === n - 1 ? seconds : total > 0 ? (t / total) * seconds : (i / (n - 1)) * seconds));
}

/**
 * How well speeds follow the law, by least squares on the logs: log speed = log gain − exponent · log curvature. With
 * `exponent` given, only the gain is fitted. Gives {exponent, gain, error, count}: `error` is the root mean square of
 * what is left, in natural log units (0.1 ≈ speeds 10% off the law), over the pairs with a speed and a curvature above
 * 0; null when fewer than 3 such pairs (no fit).
 */
export function powerLawFit(speeds, curvatures, { exponent } = {}) {
  const xs = [], ys = [];
  for (let i = 0; i < Math.min(speeds.length, curvatures.length); i += 1) {
    if (finite(speeds[i]) && speeds[i] > 0 && finite(curvatures[i]) && curvatures[i] > 0) { xs.push(Math.log(curvatures[i])); ys.push(Math.log(speeds[i])); }
  }
  const m = xs.length;
  if (m < 3) return null;
  const mx = xs.reduce((s, x) => s + x, 0) / m, my = ys.reduce((s, y) => s + y, 0) / m;
  let beta = exponent;
  if (beta === undefined) {
    let sxy = 0, sxx = 0;
    for (let i = 0; i < m; i += 1) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; }
    beta = sxx > 0 ? -sxy / sxx : 0;
  }
  const c = my + beta * mx;
  const error = Math.sqrt(xs.reduce((s, x, i) => s + (ys[i] - (c - beta * x)) ** 2, 0) / m);
  return Object.freeze({ exponent: beta, gain: Math.exp(c), error, count: m });
}
