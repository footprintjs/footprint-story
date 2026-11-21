/**
 * Settling: a thing that has gone past where it belongs comes back on a spring — the package's own spring
 * (src/motion/spring.js · spring, settleTime), reused, never copied, so a settle here and a settle on a slide feel the
 * same under the same name.
 *
 *   settleSeconds('default')       → how long the feel takes to arrive for good (s)
 *   settleLeft(t, 'default')       → how much of the way back is still to go at t: 1 at 0, exactly 0 at settleSeconds
 *
 * WHY exactly 0 at the end: a spring only comes within half a percent of its end by settleTime. The small remainder is
 * taken off along the way (a straight share of it), so the last frame is the end state to the bit and a wrapper keeps it.
 */
import { readFeel, settleTime, spring } from '../../motion/spring.js';

export const settleSeconds = (feel = 'default') => settleTime(feel);

export function settleLeft(t, feel = 'default') {
  const total = settleTime(feel);
  if (!(t > 0)) return 1;
  if (t >= total) return 0;
  const left = (s) => 1 - spring(s, feel), rest = left(total);
  return left(t) - rest * (t / total);
}

/** A feel, checked by the spring's own reader: a name (snappy, default, heavy, playful) or {k, d}. Plain data back. */
export function readSettleFeel(feel) {
  const f = readFeel(feel);
  return typeof feel === 'string' ? feel : Object.freeze({ k: f.k, d: f.d });
}
