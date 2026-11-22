/**
 * `power-law` (family `pen`): a pen tracing a line through the intent's points — a centripetal Catmull-Rom curve
 * (paths/catmullRom.js), walked every 2 px — slower where it bends by the two-thirds power law (laws/powerLaw.js),
 * from rest and back to rest, with a seeded tremor across it (laws/tremor.js). The law reads the line as drawn, tremor
 * and all, over BEND_WIDTH px either side (paths/curvature.js · curvaturesOver) — as the `pen-speed` critic reads it.
 *
 *   intent  { do: 'draw', path: [[x, y], …] (2 to 1024 points it passes through), seconds?, speed?: px a second (400) }
 *   options tremor (px across, 0 to 8; 0.8), wavelength (px; 24), ramp (0 to 0.5; 0.1), floor (per px; 0.002)
 *   sample  { x, y, progress }: progress the share of the line drawn
 *   basis   { length, speed, speedDefaulted, seconds, secondsGiven, tremor, wavelength, ramp, floor, points }
 *
 * The duration: the intent's seconds, else the line's length at `speed` (400 px a second — ours: a pen drawing a
 * diagram's line on a 1920-wide frame, quick enough to keep up with a voice).
 */
import { readPoints, readNumber, stored, refuse } from '../read.js';
import { catmullRom } from '../paths/catmullRom.js';
import { arcTable, indexAt } from '../paths/arcLength.js';
import { resample } from '../paths/resample.js';
import { curvaturesOver } from '../paths/curvature.js';
import { POWER_LAW, powerLawTimes } from '../laws/powerLaw.js';
import { TREMOR, tremorKnots, tremorAt } from '../laws/tremor.js';
import { intentKeys, optionNumber, readSeconds, round } from './options.js';

export const PEN_SPEED = 400;
/** The step the line is walked at, in px, and the most points a plan holds (a longer line is walked at a longer step). */
const STEP = 2, MOST_POINTS = 8192;
/** How far either side the bend is read over, in px: the width the `pen-speed` critic reads it over too. */
export const BEND_WIDTH = 12;

export const powerLawModel = Object.freeze({
  family: 'pen',
  name: 'power-law',
  options: Object.freeze(['tremor', 'wavelength', 'ramp', 'floor']),
  check(options) {
    optionNumber(options, 'tremor', 'power-law', 0, 8);
    optionNumber(options, 'wavelength', 'power-law', 4, 1000);
    optionNumber(options, 'ramp', 'power-law', 0, 0.5);
    optionNumber(options, 'floor', 'power-law', 0.0001, 1);
  },
  plan(intent, { who, options, random }) {
    intentKeys(intent, ['path', 'seconds', 'speed'], who);
    const path = readPoints(stored(intent, 'path', `${who}'s path`), `${who}'s path`, { least: 2, most: 1024 });
    const given = readSeconds(intent, who), speed = readNumber(intent, 'speed', who, { lo: 0, hi: 100000, above: true, usual: PEN_SPEED });
    const amplitude = optionNumber(options, 'tremor', 'power-law', 0, 8, TREMOR.amplitude), wavelength = optionNumber(options, 'wavelength', 'power-law', 4, 1000, TREMOR.wavelength);
    const ramp = optionNumber(options, 'ramp', 'power-law', 0, 0.5, POWER_LAW.ramp), floor = optionNumber(options, 'floor', 'power-law', 0.0001, 1, POWER_LAW.floor);
    const rough = arcTable(path).length;
    if (!(rough > 0)) refuse(`${who}'s path goes nowhere (every point on one place) — give at least two points that differ`);
    const curve = catmullRom(path, { spacing: Math.max(STEP, rough / MOST_POINTS) });
    const points = resample(curve, { count: Math.max(2, Math.min(MOST_POINTS, Math.ceil(arcTable(curve).length / STEP) + 1)) });
    // the length of the line as walked (a hair under the curve's: chords for arcs), so the tremor ends at its last point
    const along = arcTable(points).along, length = along[along.length - 1], seconds = given ?? length / speed;
    const knots = tremorKnots(random, length, { wavelength });
    const xs = [], ys = [];
    points.forEach((p, i) => {
      // across the line: the left normal of the chord through the neighbours (y down)
      const a = points[Math.max(0, i - 1)], b = points[Math.min(points.length - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
      const off = len > 0 ? tremorAt(knots, along[i], length, { amplitude, wavelength }) / len : 0;
      xs.push(p[0] + dy * off); ys.push(p[1] - dx * off);
    });
    // the law on the line as drawn, tremor and all: the pen's speed follows the bends it makes, as the critic reads them
    const drawn = xs.map((x, i) => [x, ys[i]]), drawnAlong = arcTable(drawn).along;
    const bends = curvaturesOver(drawn, Math.max(1, Math.round(BEND_WIDTH / (length / (points.length - 1) || STEP))));
    const times = powerLawTimes(drawnAlong, bends, seconds, { floor, ramp });
    const speedDefaulted = stored(intent, 'speed', '') === undefined;
    return { seconds, xs, ys, times, pushes: 1,
      basis: { length, speed, speedDefaulted, seconds, secondsGiven: given !== undefined, tremor: amplitude, wavelength, ramp, floor, points: points.length },
      why: `a line ${Math.round(length)} px long over ${round(seconds)} s (${given === undefined ? `at ${round(speed, 1)} px a second${speedDefaulted ? ', the usual' : ''}` : 'the seconds the intent gave'}), slower where it bends (the two-thirds power law)${amplitude ? `, with a ${round(amplitude, 1)} px tremor` : ''}` };
  },
  sample(plan, t) {
    const { xs, ys, times } = plan, last = times.length - 1;
    if (!(t > 0)) return { x: xs[0], y: ys[0], progress: 0 };
    if (t >= plan.seconds) return { x: xs[last], y: ys[last], progress: 1 };
    const i = Math.min(indexAt(times, t), last - 1), span = times[i + 1] - times[i], f = span > 0 ? (t - times[i]) / span : 0;
    return { x: xs[i] + (xs[i + 1] - xs[i]) * f, y: ys[i] + (ys[i + 1] - ys[i]) * f, progress: (i + f) / last };
  },
  checks: Object.freeze(['pen-speed']),
});
