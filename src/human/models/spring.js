/**
 * `spring` (family `settle`): a thing coming to rest at `to` on a damped spring — the package's own closed-form spring
 * (src/motion/spring.js, by way of physics/settle.js), so a settle here and a settle on a slide feel the same.
 *
 *   intent  { do: 'settle', from: [x, y], to: [x, y] }
 *   options feel (snappy, default, heavy, playful; default), or k and d (a stiffness and a damping of your own, both)
 *   sample  { x, y, progress }: progress 0 at the start, exactly 1 at the end (a playful feel passes 1 on the way)
 *   basis   { distance, k, d, damping, overshoot, seconds }: damping the ratio d / 2√k; overshoot the share of the way it
 *           passes its end, e^(−πζ/√(1 − ζ²)) under 1 (0 at 1 and over), said in the reason from OVERSHOOT_SEEN
 *
 * WHY no seconds: a spring's time is its feel's — settleTime, when it comes within half a percent and stays — so the
 * intent never guesses it.
 */
import { readPoint, refuse, shown, stored } from '../read.js';
import { FEEL_NAMES, FEELS, spring } from '../../motion/spring.js';
import { settleLeft, settleSeconds } from '../physics/settle.js';
import { intentKeys, optionNumber, round } from './options.js';

/** The least overshoot the reason mentions: half a percent of the way (the default feel's, e^−40, is not seen). */
export const OVERSHOOT_SEEN = 0.005;

/** The spring's feel from the options: a feel's name, or {k, d}. */
function readSpringFeel(options) {
  const feel = stored(options, 'feel', 'model "spring"\'s feel'), k = stored(options, 'k', 'model "spring"\'s k'), d = stored(options, 'd', 'model "spring"\'s d');
  if (feel !== undefined && (k !== undefined || d !== undefined)) refuse('model "spring" takes a feel, or k and d — not both');
  if (k !== undefined || d !== undefined) {
    if (k === undefined || d === undefined) refuse('model "spring" takes k and d together: a stiffness and a damping');
    return { k: optionNumber(options, 'k', 'spring', 1, 10000), d: optionNumber(options, 'd', 'spring', 0.1, 1000) };
  }
  if (feel === undefined) return 'default';
  if (typeof feel !== 'string' || !FEEL_NAMES.includes(feel)) refuse(`model "spring"'s feel is one of ${FEEL_NAMES.join(', ')} — not ${shown(feel)}`);
  return feel;
}

export const springModel = Object.freeze({
  family: 'settle',
  name: 'spring',
  options: Object.freeze(['feel', 'k', 'd']),
  check(options) { readSpringFeel(options); },
  plan(intent, { who, options }) {
    intentKeys(intent, ['from', 'to'], who);
    const from = readPoint(stored(intent, 'from', `${who}'s from`), `${who}'s from`), to = readPoint(stored(intent, 'to', `${who}'s to`), `${who}'s to`);
    const feel = readSpringFeel(options), { k, d } = typeof feel === 'string' ? FEELS[feel] : feel, seconds = settleSeconds(feel);
    // a spring of one's own may be too soft to settle within the motion spring's scan (30 s): refused, never cut short
    if (Math.abs(1 - spring(seconds, feel)) > 0.005) refuse(`${who}: its spring (k ${k}, d ${d}) does not settle within ${round(seconds, 0)} s, the longest a settle is read — a larger k or d`);
    const ratio = d / (2 * Math.sqrt(k)), distance = Math.hypot(to[0] - from[0], to[1] - from[1]);
    const overshoot = ratio < 1 ? Math.exp((-Math.PI * ratio) / Math.sqrt(1 - ratio * ratio)) : 0;
    return { seconds, from: [...from], to: [...to], feel, pushes: 1,
      basis: { distance, k, d, damping: ratio, overshoot, seconds },
      why: `settles ${round(distance, 1)} px on ${typeof feel === 'string' ? `the "${feel}" spring` : 'its own spring'} (k ${round(k, 1)}, d ${round(d, 1)}: damping ratio ${round(ratio)}${overshoot >= OVERSHOOT_SEEN ? `, passing its end by ${round(overshoot * 100, 1)}%` : ''}) in ${round(seconds)} s, its feel's settle time` };
  },
  sample(plan, t) {
    const progress = 1 - settleLeft(t, plan.feel);
    return { x: plan.from[0] + (plan.to[0] - plan.from[0]) * progress, y: plan.from[1] + (plan.to[1] - plan.from[1]) * progress, progress };
  },
  checks: Object.freeze([]),
});
