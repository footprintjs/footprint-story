/**
 * `hand-sketch` (family `sketch`): a drawing of shapes, drawn as a hand draws it — the order (outline, then detail, then
 * fills, piece by piece from the top left, in as few strokes as the corners allow: order.js), each stroke's pace,
 * width, hooks and tremor (pen.js), hatching and scribbles (fills.js), and the pen's lifts between strokes (plan.js).
 *
 *   intent  { do: 'sketch', shapes: [{points, closed?, layer?, group?, edge?, fill?, holes?}] (shapes.js), seconds?, speed?: px a second (400) }
 *   options tremor (px across, 0 to 8; 0.8), wavelength (px; 24), width (px, 0.25 to 20; 2.5), overshoot (px, 0 to 12; 3)
 *   sample  { x, y, width, down, stroke, progress } (sample.js)
 *   basis   { shapes, strokes, lifts, leastStrokes, points, length, seconds, secondsGiven, speed, speedDefaulted, tremor, width, overshoot, hooks, fills }
 *
 * Checked by `pen-lifts` (more strokes than the order needs), `stroke-order` (detail drawn before its outline) and
 * `hatch-gaps` (a band across a hatch no line passes through).
 */
import { readNumber, stored } from '../read.js';
import { intentKeys, optionNumber, readSeconds, round } from '../models/options.js';
import { planSketch, SKETCH } from './plan.js';
import { sampleSketch } from './sample.js';
import { TREMOR } from '../laws/tremor.js';
import { CORNER } from './pen.js';

export const SKETCH_KEYS = Object.freeze(['shapes', 'seconds', 'speed']);

export const sketchModel = Object.freeze({
  family: 'sketch',
  name: 'hand-sketch',
  options: Object.freeze(['tremor', 'wavelength', 'width', 'overshoot']),
  check(options) {
    optionNumber(options, 'tremor', 'hand-sketch', 0, 8);
    optionNumber(options, 'wavelength', 'hand-sketch', 4, 1000);
    optionNumber(options, 'width', 'hand-sketch', 0.25, 20);
    optionNumber(options, 'overshoot', 'hand-sketch', 0, 12);
  },
  plan(intent, { who, options, random }) {
    intentKeys(intent, SKETCH_KEYS, who);
    const given = readSeconds(intent, who), speed = readNumber(intent, 'speed', who, { lo: 0, hi: 100000, above: true, usual: SKETCH.speed });
    const tremor = optionNumber(options, 'tremor', 'hand-sketch', 0, 8, TREMOR.amplitude), wavelength = optionNumber(options, 'wavelength', 'hand-sketch', 4, 1000, TREMOR.wavelength);
    const width = optionNumber(options, 'width', 'hand-sketch', 0.25, 20, SKETCH.width), overshoot = optionNumber(options, 'overshoot', 'hand-sketch', 0, 12, CORNER.most);
    const sketch = planSketch(stored(intent, 'shapes', `${who}'s shapes`), { random, who, speed, fillSpeed: SKETCH.fillSpeed * (speed / SKETCH.speed), width, tremor, wavelength, overshoot, seconds: given });
    const lines = sketch.strokes.filter((s) => s.layer !== 'fill').length, fills = sketch.sets.length, length = sketch.strokes.reduce((s, x) => s + x.length, 0);
    const speedDefaulted = stored(intent, 'speed', '') === undefined;
    return { ...sketch, pushes: sketch.strokes.length,
      basis: { shapes: sketch.shapes, strokes: sketch.strokes.length, lifts: sketch.lifts.length, leastStrokes: sketch.least.outline + sketch.least.detail, points: sketch.points, length,
        seconds: sketch.seconds, secondsGiven: given !== undefined, speed, speedDefaulted, tremor, width, overshoot, hooks: sketch.hooks, fills },
      why: `${sketch.shapes} shape${sketch.shapes === 1 ? '' : 's'} drawn in ${sketch.strokes.length} stroke${sketch.strokes.length === 1 ? '' : 's'} (${lines} of lines, the least the corners allow being ${sketch.least.outline + sketch.least.detail}${fills ? `; ${fills} set${fills === 1 ? '' : 's'} of fill lines` : ''}) over ${round(sketch.seconds)} s — outline, then detail, then fills, from the top left; slower in the bends, thinner when fast, tapered at the ends${tremor ? `, with a ${round(tremor, 1)} px tremor` : ''}` };
  },
  sample: sampleSketch,
  checks: Object.freeze(['pen-lifts', 'stroke-order', 'hatch-gaps']),
});
