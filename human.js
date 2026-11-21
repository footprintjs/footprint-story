// footprint-story/human — how people move and draw, as numbers: the laws (minimum jerk, Fitts's law, the two-thirds
// power law, sigma-lognormal strokes, a seeded tremor), the paths they run on (length tables, centripetal Catmull-Rom,
// curvature, resampling), named models that turn an intent into a plan, and critics that say in words what still
// looks wrong. Pure: runs anywhere (browser or Node), imports nothing, and loads only when imported. Nothing here draws
// — StoryReel paints a canvas, StoryDeck writes SVG or CSS from the samples.
//
//   const move = planMove({ do: 'reach', name: 'hand', from: [200, 600], to: [900, 420], target: 60 })
//   move.reason                      → "do: 'reach' → min-jerk, the usual for do: 'reach' — over 0.83 s from Fitts's law: …"
//   sampleMove(move, 0.4)            → { x, y, progress }: the same t, the same answer
//   checkMove(move).findings         → [] — or [{critic, level, message, fix}]: what looks wrong, in words, and the fix

// laws — the maths of a body's moves
export { minJerk, minJerkSpeed, minJerkAccel, MIN_JERK_PEAK } from './src/human/laws/minJerk.js';
export { FITTS, fittsIndex, fittsSeconds } from './src/human/laws/fitts.js';
export { POWER_LAW, powerLawSpeed, powerLawTimes, powerLawFit } from './src/human/laws/powerLaw.js';
export { SIGMA_LOGNORMAL, STROKE_SIGMAS, lognormalShare, lognormalSpeed, strokeEnd, strokeOffset, strokeBetween, sigmaLognormalAt } from './src/human/laws/sigmaLognormal.js';
export { TREMOR, MOST_TREMOR_KNOTS, tremorKnots, tremorAt } from './src/human/laws/tremor.js';

// paths — what the laws run along
export { arcTable, pointAt, shareToDistance, distanceToShare, MOST_TABLE_POINTS } from './src/human/paths/arcLength.js';
export { catmullRom, MOST_CURVE_POINTS } from './src/human/paths/catmullRom.js';
export { curvatures } from './src/human/paths/curvature.js';
export { resample, MOST_RESAMPLED } from './src/human/paths/resample.js';

// models — an intent planned by a named model, and sampled
export { HUMAN_FAMILIES, HUMAN_DOS, HUMAN_MODELS, USUAL_MODELS } from './src/human/models/registry.js';
export { planMove, sampleMove, sampleTrack, MOST_TRACK_SAMPLES } from './src/human/models/move.js';
export { MIN_JERK_BEND } from './src/human/models/minJerk.js';
export { PEN_SPEED } from './src/human/models/powerLawPen.js';
export { MOST_STROKES } from './src/human/models/sigmaLetter.js';

// critics — what still looks wrong, measured and said
export { HUMAN_CRITICS, FINDING_LEVELS } from './src/human/critics/registry.js';
export { checkMove } from './src/human/critics/check.js';
export { JERK_PEAK_SHARE } from './src/human/critics/jerk.js';
export { ARC_LEAST } from './src/human/critics/arc.js';
export { PEN_SPEED_MOST } from './src/human/critics/penSpeed.js';
