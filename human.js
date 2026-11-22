// footprint-story/human — how people move and draw, as numbers: the laws (minimum jerk, Fitts's law, the two-thirds
// power law, sigma-lognormal strokes, a seeded tremor), the paths they run on (length tables, centripetal Catmull-Rom,
// curvature, resampling), light physics (ballistic flight, bounces, hanging chains, a floor and boxes, a fixed step),
// named models that turn an intent into a plan, wrappers that reshape a move (anticipate, follow-through, hold,
// overshoot), critics that say in words what still looks wrong, and hand-drawn strokes (a drawing's order, pen, fills, boil). Pure: runs anywhere (browser or Node), imports nothing, and loads only when imported. Nothing here draws
// — StoryReel paints a canvas, StoryDeck writes SVG or CSS from the samples.
//
//   const move = planMove({ do: 'reach', name: 'hand', from: [200, 600], to: [900, 420], target: 60 })
//   move.reason                      → "do: 'reach' → min-jerk, the usual for do: 'reach' — over 0.83 s from Fitts's law: …"
//   sampleMove(move, 0.4)            → { x, y, progress }: the same t, the same answer
//   checkMove(move).findings         → [] — or [{critic, level, message, fix}]: what looks wrong, in words, and the fix
//   sampleMove(overshoot(planMove({ do: 'throw', from: [0, 600], to: [600, 600] }), { by: 12 }), 0.5)   → a throw landing 12 px past

// laws — the maths of a body's moves
export { minJerk, minJerkSpeed, minJerkAccel, MIN_JERK_PEAK } from './src/timing/minJerk.js';
export { FITTS, fittsIndex, fittsSeconds } from './src/human/laws/fitts.js';
export { POWER_LAW, powerLawSpeed, powerLawTimes, powerLawFit } from './src/human/laws/powerLaw.js';
export { SIGMA_LOGNORMAL, STROKE_SIGMAS, lognormalShare, lognormalSpeed, strokeEnd, strokeOffset, strokeBetween, sigmaLognormalAt } from './src/human/laws/sigmaLognormal.js';
export { TREMOR, MOST_TREMOR_KNOTS, tremorKnots, tremorAt } from './src/human/laws/tremor.js';

// paths — what the laws run along
export { arcTable, pointAt, shareToDistance, distanceToShare, MOST_TABLE_POINTS } from './src/human/paths/arcLength.js';
export { catmullRom, MOST_CURVE_POINTS } from './src/human/paths/catmullRom.js';
export { curvatures, curvaturesOver } from './src/human/paths/curvature.js';
export { resample, MOST_RESAMPLED } from './src/human/paths/resample.js';
export { legGaps } from './src/human/paths/gap.js';

// physics — flight, bounces, chains, collisions on a fixed step (Jakobsen 2001), and settling on the motion spring
export { launch, flightAt, headingAt, fallSeconds, APEX_SHARE, MIN_APEX } from './src/human/physics/flight.js';
export { bounces, bounceAt, MIN_BOUNCE, MOST_BOUNCES } from './src/human/physics/bounce.js';
export { runChain, relaxChain, pinAt, substepsFor, stretchOf, MIN_CHAIN_PASSES, CHAIN_REST_SPEED, CHAIN_LENGTH_TOLERANCE, MIN_CHAIN_LINK, MOST_STEP_SAG, MOST_SUBSTEPS, LAYOUT_ROUNDS } from './src/human/physics/chain.js';
export { makeWorld, readWorld, pushOut, collide, depthIn, MOST_BOXES } from './src/human/physics/collide.js';
export { verletStep, simulate, PHYSICS_STEP, STEPS_PER_FRAME, GRAVITY, MOST_PHYSICS_SECONDS } from './src/human/physics/step.js';
export { settleLeft, settleSeconds, checkSettles, SETTLED_WITHIN } from './src/human/physics/settle.js';

// models — an intent planned by a named model, and sampled
export { HUMAN_FAMILIES, HUMAN_DOS, HUMAN_MODELS, USUAL_MODELS } from './src/human/models/registry.js';
export { planMove, sampleMove, sampleTrack, MOST_TRACK_SAMPLES, MOST_SAMPLE_LIST, UNSEEDED_KEYS } from './src/human/models/move.js';
export { MIN_JERK_BEND, MOST_BEND } from './src/human/models/minJerk.js';
export { PEN_SPEED, BEND_WIDTH } from './src/human/models/powerLawPen.js';
export { MOST_STROKES } from './src/human/models/sigmaLetter.js';
export { THROW_KEYS, FALL_KEYS, MIN_THROW_SECONDS } from './src/human/models/ballistic.js';
export { SQUASH_SECONDS } from './src/human/models/bounce.js';
export { MOST_CHAIN_LINKS, MOST_CHAIN_SECONDS, MOST_PATH_KEYS, MOST_CHAIN_GRAVITY, USUAL_LINKS, USUAL_DAMPING } from './src/human/models/verlet.js';
export { OVERSHOOT_SEEN } from './src/human/models/spring.js';

// wrappers — a move reshaped by the animation principles, read by sampleMove like any other
export { anticipate, followThrough, hold, overshoot, basePlan, isWrapped, BY_SHARE, MIN_TRAVEL, MOST_WRAPPERS, WRAPPER_NAMES, ADDED_BELLS, wrappedPushes } from './src/human/models/wrap.js';

// critics — what still looks wrong, measured and said
export { HUMAN_CRITICS, FINDING_LEVELS } from './src/human/critics/registry.js';
export { checkMove } from './src/human/critics/check.js';
export { JERK_PEAK_SHARE } from './src/human/critics/jerk.js';
export { ARC_LEAST } from './src/human/critics/arc.js';
export { PEN_SPEED_MOST } from './src/human/critics/penSpeed.js';
export { SPACING_LEAST, SPACING_MOST } from './src/human/critics/spacing.js';
export { VOLUME_MOST } from './src/human/critics/volume.js';
export { CONTACT_MOST } from './src/human/critics/contact.js';

// the intent decider — an author's intents in, every move decided: steps in one list, run in order (footprint-story/humanflow runs the same list as a chart)
export { HUMAN_STEPS, HUMAN_INPUT, planIntents } from './src/human/intents/steps.js';
export { MOST_INTENTS } from './src/human/intents/read.js';
export { SUMMARY_POINTS } from './src/human/intents/summary.js';
export { CHOOSE_RULES } from './src/human/models/rules.js';
export { PER_INTENT, intentKey } from './src/human/intents/keys.js';

// hand-drawn strokes — a drawing planned as a hand draws it: the order and why, each stroke's pace, width, hooks and
// tremor, hatching and scribbles, a frame-to-frame boil, the `hand-sketch` model (do: 'sketch') and its critics, and two
// isometric style choices on strokes (src/human/strokes/README.md)
export { planSketch, SKETCH, WIDTH_SHARE, LIFT, MOST_SKETCH_POINTS } from './src/human/strokes/plan.js';
export { sampleSketch } from './src/human/strokes/sample.js';
export { boilSketch, BOIL, MOST_BOIL_FRAME } from './src/human/strokes/boil.js';
export { hatchLines, MIN_PIECE, MOST_HATCH_LINES, CROSS_TURN } from './src/human/strokes/fills.js';
export { ORDER_RULE, MOST_BRIDGE_EDGES } from './src/human/strokes/order.js';
export { leastStrokes, MERGE } from './src/human/strokes/graph.js';
export { withOvershoot, CORNER, PEN_WIDTH, STROKE_STEP } from './src/human/strokes/pen.js';
export { SKETCH_LAYERS, FILL_KINDS, HATCH, MOST_SHAPES, MOST_SHAPE_POINTS, MOST_SKETCH_INPUT } from './src/human/strokes/shapes.js';
export { shapesOfPaint, strokeItems, strokeOutline, ELLIPSE_POINTS, HIDDEN } from './src/human/strokes/paint.js';
export { sketchyLine, hatchTexture, ROLE_FILLS } from './src/human/strokes/styleChoices.js';
export { SKETCH_KEYS } from './src/human/strokes/model.js';
export { PEN_LIFTS_MOST } from './src/human/strokes/penLifts.js';
export { STROKE_ORDER_MOST } from './src/human/strokes/strokeOrder.js';
export { HATCH_GAP_MOST } from './src/human/strokes/hatchGaps.js';
