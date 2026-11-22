/**
 * Settling: a thing that has gone past where it belongs comes back on a spring — the package's own spring
 * (src/motion/spring.js · spring, settleTime), reused, never copied, so a settle here and a settle on a slide feel the
 * same under the same name.
 *
 *   settleSeconds('default')       → how long the feel takes to arrive for good (s)
 *   settleLeft(t, 'default')       → how much of the way back is still to go at t: 1 at 0, exactly 0 at settleSeconds
 *   checkSettles({k, d}, who)      → refuses a spring that does not settle within the motion spring's scan (30 s)
 *   settleCarry(t, 'default')      → how far a start speed of 1 px a second carries on the same spring, and back:
 *                                    0 at 0, moving at 1 there, exactly 0 again at settleSeconds
 *
 * WHY exactly 0 at the end: a spring only comes within half a percent of its end by settleTime. The small remainder is
 * taken off along the way (a straight share of it), so the last frame is the end state to the bit and a wrapper keeps it.
 */
import { readFeel, settleTime, spring } from '../../motion/spring.js';
import { refuse } from '../read.js';

export const settleSeconds = (feel = 'default') => settleTime(feel);

export function settleLeft(t, feel = 'default') {
  const total = settleTime(feel);
  if (!(t > 0)) return 1;
  if (t >= total) return 0;
  const left = (s) => 1 - spring(s, feel), rest = left(total);
  return left(t) - rest * (t / total);
}

/** How near its end a spring must come to count as settled: the motion spring's own (settleTime's `within`). */
export const SETTLED_WITHIN = 0.005;

/**
 * A spring that does not settle within settleTime's scan (30 s) is refused, naming `who` and the fix — never cut short
 * at the scan's end, where it would still be moving. The one rule for the spring model and the overshoot wrapper.
 */
export function checkSettles(feel, who) {
  const seconds = settleTime(feel);
  if (Math.abs(1 - spring(seconds, feel)) > SETTLED_WITHIN) {
    const f = typeof feel === 'string' ? `the "${feel}" spring` : `its spring (k ${feel.k}, d ${feel.d})`;
    refuse(`${who}: ${f} does not settle within ${Math.round(seconds)} s, the longest a settle is read — a larger k or d`);
  }
  return seconds;
}

/**
 * How far a settle carries a speed it starts with: the spring's free response from 0 moving at 1 px a second — for a
 * unit mass x″ + d·x′ + k·x = 0 that is its impulse response, in closed form (ζ = d / 2√k, ω₀ = √k):
 * e^(−ζω₀t)·sin(ω_d t)/ω_d under-damped (ω_d = ω₀√(1 − ζ²)), and t·e^(−ω₀t) from critical on, as the motion spring
 * itself takes every heavier feel (src/motion/spring.js · spring) — exactly the derivative of its step, over k. The small remainder at settleSeconds is taken
 * off along the way, as settleLeft does, so it ends at exactly 0. WHY: a wrapper that settles a move back after it
 * arrives moving must start the settle at that speed, or the move stops dead at the hand-over (wrap.js · overshoot).
 * Source: the damped oscillator's impulse response, Halliday, Resnick & Walker, ch. 15.
 */
export function settleCarry(t, feel = 'default') {
  const total = settleTime(feel);
  if (!(t > 0) || t >= total) return 0;
  const { k, d } = readFeel(feel), w0 = Math.sqrt(k), zeta = d / (2 * w0);
  const carry = (s) => {
    if (zeta < 1) { const wd = w0 * Math.sqrt(1 - zeta * zeta); return (Math.exp(-zeta * w0 * s) * Math.sin(wd * s)) / wd; }
    return s * Math.exp(-w0 * s);
  };
  return carry(t) - carry(total) * (t / total);
}
