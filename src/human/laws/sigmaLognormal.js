/**
 * Sigma-lognormal strokes: handwriting as a sum of quick pushes, each a speed pulse shaped like a lognormal curve,
 * overlapping in time (Plamondon 1995; the sigma-lognormal form, Plamondon & Djioua 2006). A stroke goes `distance` px
 * along an arc whose direction turns evenly from `angleFrom` to `angleTo` (radians, y down: 0 is right, π/2 is down)
 * as it goes; its speed at time t, from its `start` t0, is
 *
 *   distance / (sigma · √(2π) · (t − t0)) · exp(−(ln(t − t0) − mu)² / (2 sigma²))
 *
 * and the share of it done by then is the lognormal's spread, ½ (1 + erf((ln(t − t0) − mu) / (sigma √2))). The pen is
 * where the strokes have taken it, added together. WHY this law for lettering: the overlap of one push with the next is
 * what rounds a corner as a hand does, and a letter's speed then rises and falls in the bumps a real pen's does.
 *
 * Our defaults (SIGMA_LOGNORMAL): mu = −1.6, sigma = 0.3 — a stroke's speed peaks about 0.19 s after it starts and it
 * is nearly done by 0.5 s; gap = 0.16 s from one stroke's start to the next, so each begins near the last one's peak.
 * They are a stroke's usual scale, not a fit to anyone's hand.
 */
import { refuse, shown, finite } from '../read.js';

export const SIGMA_LOGNORMAL = Object.freeze({ mu: -1.6, sigma: 0.3, gap: 0.16 });
/** How many sigmas past mu a stroke counts as done (its spread then is 0.99865). */
export const STROKE_SIGMAS = 3;

/**
 * erf, to within 1.5e-7 (Abramowitz & Stegun 1964, 7.1.26). WHY close enough: a stroke's share is used only through
 * its ratio to the share at the end (sigmaLognormalAt's `end`), so the pen still lands on its point exactly.
 */
export function erf(x) {
  const s = x < 0 ? -1 : 1, a = Math.abs(x), k = 1 / (1 + 0.3275911 * a);
  const y = 1 - (((((1.061405429 * k - 1.453152027) * k) + 1.421413741) * k - 0.284496736) * k + 0.254829592) * k * Math.exp(-a * a);
  return s * y;
}

/** The share of a stroke done by time t: 0 before its start, rising to 1. */
export function lognormalShare(t, stroke) {
  const dt = t - stroke.start;
  if (!(dt > 0)) return 0;
  return 0.5 * (1 + erf((Math.log(dt) - stroke.mu) / (stroke.sigma * Math.SQRT2)));
}

/** A stroke's speed at time t, in px a second: 0 before its start. */
export function lognormalSpeed(t, stroke) {
  const dt = t - stroke.start;
  if (!(dt > 0)) return 0;
  const z = (Math.log(dt) - stroke.mu) / stroke.sigma;
  return (stroke.distance / (stroke.sigma * Math.sqrt(2 * Math.PI) * dt)) * Math.exp(-0.5 * z * z);
}

/** When a stroke counts as done: start + e^(mu + STROKE_SIGMAS · sigma). */
export const strokeEnd = (stroke) => stroke.start + Math.exp(stroke.mu + STROKE_SIGMAS * stroke.sigma);

/** Where a stroke has taken the pen when `share` of it is done: [dx, dy], along its arc (a straight line when it does not turn). */
export function strokeOffset(stroke, share) {
  // sin(a + b) − sin a = 2 cos(a + b/2) sin(b/2), and the same for cos: the arc's chord, d · sinc(half the turn) along
  // its middle direction — exact, and stable however little the stroke turns (no radius of 1e10 px to cancel)
  const d = stroke.distance * share, half = ((stroke.angleTo - stroke.angleFrom) * share) / 2, mid = stroke.angleFrom + half;
  const sinc = Math.abs(half) < 1e-4 ? 1 - (half * half) / 6 : Math.sin(half) / half;
  return [d * sinc * Math.cos(mid), d * sinc * Math.sin(mid)];
}

/**
 * The pen at time t: {x, y, vx, vy}, from `origin` [x, y] and the strokes added together. With `end` (seconds), each
 * stroke's share is taken over its share at `end` and t is held at `end` after it — so at `end` the pen is exactly where
 * the strokes' full distances take it, and it stays there.
 */
export function sigmaLognormalAt(strokes, t, origin = [0, 0], end = undefined) {
  const at = end !== undefined && t > end ? end : t;
  let x = origin[0], y = origin[1], vx = 0, vy = 0;
  for (const s of strokes) {
    const whole = end === undefined ? 1 : lognormalShare(end, s) || 1;
    const share = Math.min(1, lognormalShare(at, s) / whole), speed = end !== undefined && t > end ? 0 : lognormalSpeed(at, s) / whole;
    const [dx, dy] = strokeOffset(s, share), phi = s.angleFrom + (s.angleTo - s.angleFrom) * share;
    x += dx; y += dy; vx += speed * Math.cos(phi); vy += speed * Math.sin(phi);
  }
  return { x, y, vx, vy };
}

/**
 * A stroke from point p to point q: its chord turned by `bend` radians (the arc bulges to the left of p → q, as seen on the frame, when bend
 * is above 0, with y down), starting at `start` with the given mu and sigma. Its distance is the arc's length.
 */
export function strokeBetween(p, q, { bend = 0, start = 0, mu = SIGMA_LOGNORMAL.mu, sigma = SIGMA_LOGNORMAL.sigma } = {}) {
  if (!(finite(bend) && Math.abs(bend) < 2 * Math.PI)) refuse(`a stroke's bend is how far it turns, in radians, less than a full turn either way — not ${shown(bend)}`);
  const chord = Math.hypot(q[0] - p[0], q[1] - p[1]), heading = Math.atan2(q[1] - p[1], q[0] - p[0]);
  const distance = Math.abs(bend) < 1e-4 ? chord * (1 + (bend * bend) / 24) : (chord * (bend / 2)) / Math.sin(bend / 2);
  return { distance, start, mu, sigma, angleFrom: heading - bend / 2, angleTo: heading + bend / 2 };
}
