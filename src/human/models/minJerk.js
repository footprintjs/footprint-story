/**
 * `min-jerk` (family `reach`): a hand reaching from one place to another, rest to rest, on the minimum-jerk curve
 * (laws/minJerk.js), its duration from Fitts's law (laws/fitts.js) unless the intent says how long.
 *
 *   intent  { do: 'reach', from: [x, y], to: [x, y], target?: px (how big the thing it ends on is; 40), seconds? }
 *   options bend (how far it bows to the left as seen, as a share of its length, at most 0.3 either way; 0.06 — 0 is
 *           straight), a, b (Fitts's)
 *   sample  { x, y, progress }: progress the share of the way along
 *   basis   { distance, target, targetDefaulted, bits, a, b, seconds, secondsGiven, bend }: the numbers the plan chose by
 *
 * WHY a bow: Flash & Hogan measured a hand's reach near straight, but on a frame a dead-straight slide reads as pulled
 * on a wire (the `arc` critic): 6% of its length is ours, enough to read as a hand.
 */
import { readPoint, readNumber, stored, FAR } from '../read.js';
import { minJerk } from '../laws/minJerk.js';
import { FITTS, fittsIndex, fittsSeconds } from '../laws/fitts.js';
import { intentKeys, optionNumber, readSeconds, round } from './options.js';

export const MIN_JERK_BEND = 0.06;
/** The most a reach may bow, either way: past about 0.45 its speed along the bow gains a second peak, and the `jerk`
 *  critic would find fault with this model's own move; 0.3 keeps a margin (a property test sweeps the range). */
export const MOST_BEND = 0.3;

export const minJerkModel = Object.freeze({
  family: 'reach',
  name: 'min-jerk',
  options: Object.freeze(['bend', 'a', 'b']),
  check(options) {
    optionNumber(options, 'bend', 'min-jerk', -MOST_BEND, MOST_BEND);
    optionNumber(options, 'a', 'min-jerk', 0, 10);
    optionNumber(options, 'b', 'min-jerk', 0.001, 10);
  },
  plan(intent, { who, options }) {
    intentKeys(intent, ['from', 'to', 'target', 'seconds'], who);
    const from = readPoint(stored(intent, 'from', `${who}'s from`), `${who}'s from`), to = readPoint(stored(intent, 'to', `${who}'s to`), `${who}'s to`);
    const target = readNumber(intent, 'target', who, { lo: 0, hi: FAR, above: true, usual: FITTS.target }), given = readSeconds(intent, who);
    const bend = optionNumber(options, 'bend', 'min-jerk', -MOST_BEND, MOST_BEND, MIN_JERK_BEND);
    const a = optionNumber(options, 'a', 'min-jerk', 0, 10, FITTS.a), b = optionNumber(options, 'b', 'min-jerk', 0.001, 10, FITTS.b);
    const distance = Math.hypot(to[0] - from[0], to[1] - from[1]);
    const seconds = given ?? fittsSeconds(distance, target, { a, b });
    const targetDefaulted = stored(intent, 'target', '') === undefined, bits = fittsIndex(distance, target);
    return { seconds, from: [...from], to: [...to], bend, distance, pushes: 1,
      basis: { distance, target, targetDefaulted, bits, a, b, seconds, secondsGiven: given !== undefined, bend },
      why: `over ${round(seconds)} s ${given === undefined ? `from Fitts's law: ${Math.round(distance)} px to a ${round(target, 1)} px target${targetDefaulted ? ' (the usual: none was given)' : ''}, ${round(bits)} bits` : '(the seconds the intent gave)'}${bend ? `, bowed ${round(bend * 100, 1)}% of its length` : ', straight'}` };
  },
  sample(plan, t) {
    const u = plan.seconds > 0 ? t / plan.seconds : t >= 0 ? 1 : 0, s = minJerk(u);
    const dx = plan.to[0] - plan.from[0], dy = plan.to[1] - plan.from[1], bow = plan.bend * 4 * s * (1 - s);
    // the bow is along the left normal as seen on the frame (y down): (dy, −dx), of the move's length already
    return { x: plan.from[0] + dx * s + dy * bow, y: plan.from[1] + dy * s - dx * bow, progress: s };
  },
  checks: Object.freeze(['jerk', 'arc']),
});
