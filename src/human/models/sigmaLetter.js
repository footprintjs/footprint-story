/**
 * `sigma-lognormal` (family `letter`): lettering as overlapping lognormal strokes (laws/sigmaLognormal.js). An intent
 * gives the points a letter's pen passes (one stroke from each to the next, each starting `gap` after the last, so they
 * overlap and round the corners as a hand does), or the strokes themselves as the law's numbers.
 *
 *   intent  { do: 'write', points: [[x, y], …] (2 to 256) }  or  { do: 'write', strokes: [{distance, start, mu, sigma, angleFrom, angleTo}, …], at?: [x, y] }
 *           seconds? — the strokes are slowed or sped up together to take that long
 *   options mu (−1.6), sigma (0.3), gap (s; 0.16), bend (radians each stroke turns; 0)
 *   sample  { x, y, progress }: progress the share of the time gone
 *   basis   { strokes, from: 'points' | 'strokes', seconds, secondsGiven, mu, sigma, gap, bend } (the last four null for strokes)
 *
 * The pen lands on the last point exactly at the plan's `seconds` (each stroke's share is taken over its share then).
 */
import { refuse, shown, stored, readPoint, readPoints, isRecord, onlyKeys, finite, FAR, MOST_SECONDS } from '../read.js';
import { SIGMA_LOGNORMAL, sigmaLognormalAt, strokeBetween, strokeEnd } from '../laws/sigmaLognormal.js';
import { intentKeys, optionNumber, readSeconds, round } from './options.js';

export const MOST_STROKES = 256;
const STROKE_KEYS = ['distance', 'start', 'mu', 'sigma', 'angleFrom', 'angleTo'];
const RANGES = { distance: [0, 4 * FAR], start: [0, MOST_SECONDS], mu: [-10, 5], sigma: [0.01, 3], angleFrom: [-100, 100], angleTo: [-100, 100] };

/** The strokes an intent writes as the law's numbers, each checked. */
function readStrokes(v, who) {
  if (!Array.isArray(v) || v.length < 1 || v.length > MOST_STROKES) refuse(`${who}'s strokes are 1 to ${MOST_STROKES} strokes {${STROKE_KEYS.join(', ')}} — not ${Array.isArray(v) ? `${v.length} of them` : shown(v)}`);
  return v.map((s, i) => {
    const what = `${who}'s strokes[${i}]`;
    if (!isRecord(s)) refuse(`${what} is {${STROKE_KEYS.join(', ')}} — not ${shown(s)}`);
    onlyKeys(s, STROKE_KEYS, what);
    return Object.fromEntries(STROKE_KEYS.map((k) => {
      const n = stored(s, k, `${what}'s ${k}`), [lo, hi] = RANGES[k];
      if (!(finite(n) && n >= lo && n <= hi)) refuse(`${what}'s ${k} is a number from ${lo} to ${hi} — not ${shown(n)}`);
      return [k, n];
    }));
  });
}

export const sigmaLognormalModel = Object.freeze({
  family: 'letter',
  name: 'sigma-lognormal',
  options: Object.freeze(['mu', 'sigma', 'gap', 'bend']),
  check(options) {
    optionNumber(options, 'mu', 'sigma-lognormal', -10, 5);
    optionNumber(options, 'sigma', 'sigma-lognormal', 0.01, 3);
    optionNumber(options, 'gap', 'sigma-lognormal', 0, 10);
    optionNumber(options, 'bend', 'sigma-lognormal', -3, 3);
  },
  plan(intent, { who, options }) {
    intentKeys(intent, ['points', 'strokes', 'at', 'seconds'], who);
    const rawPoints = stored(intent, 'points', `${who}'s points`), rawStrokes = stored(intent, 'strokes', `${who}'s strokes`);
    if ((rawPoints === undefined) === (rawStrokes === undefined)) refuse(`${who} writes its letter as points (where the pen passes) or as strokes (the law's numbers) — one of the two, not ${rawPoints === undefined ? 'neither' : 'both'}`);
    const given = readSeconds(intent, who);
    let origin, strokes, chose = { mu: null, sigma: null, gap: null, bend: null };
    if (rawPoints !== undefined) {
      if (stored(intent, 'at', '') !== undefined) refuse(`${who}'s at is where strokes start; written as points, the letter starts at its first point — leave at out`);
      const points = readPoints(rawPoints, `${who}'s points`, { least: 2, most: MOST_STROKES + 1 });
      const mu = optionNumber(options, 'mu', 'sigma-lognormal', -10, 5, SIGMA_LOGNORMAL.mu), sigma = optionNumber(options, 'sigma', 'sigma-lognormal', 0.01, 3, SIGMA_LOGNORMAL.sigma);
      const gap = optionNumber(options, 'gap', 'sigma-lognormal', 0, 10, SIGMA_LOGNORMAL.gap), bend = optionNumber(options, 'bend', 'sigma-lognormal', -3, 3, 0);
      origin = [...points[0]];
      chose = { mu, sigma, gap, bend };
      strokes = points.slice(1).map((q, i) => strokeBetween(points[i], q, { bend, start: i * gap, mu, sigma }));
    } else {
      const at = stored(intent, 'at', `${who}'s at`);
      origin = at === undefined ? [0, 0] : [...readPoint(at, `${who}'s at`)];
      strokes = readStrokes(rawStrokes, who);
    }
    let seconds = Math.max(...strokes.map(strokeEnd));
    if (given !== undefined) {
      // every stroke slowed or sped up together: its start scaled, its mu moved by the log of the scale
      const f = given / seconds;
      strokes = strokes.map((s) => ({ ...s, start: s.start * f, mu: s.mu + Math.log(f) }));
      seconds = given;
    }
    return { seconds, origin, strokes, pushes: strokes.length,
      basis: { strokes: strokes.length, from: rawPoints !== undefined ? 'points' : 'strokes', seconds, secondsGiven: given !== undefined, ...chose },
      why: `${strokes.length} stroke${strokes.length === 1 ? '' : 's'}, each a lognormal push overlapping the next (sigma-lognormal), over ${round(seconds)} s${given === undefined ? '' : ' (the seconds the intent gave)'}` };
  },
  sample(plan, t) {
    const p = sigmaLognormalAt(plan.strokes, t, plan.origin, plan.seconds);
    return { x: p.x, y: p.y, progress: plan.seconds > 0 ? Math.max(0, Math.min(1, t / plan.seconds)) : 1 };
  },
  checks: Object.freeze(['jerk']),
});
