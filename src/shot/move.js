/**
 * A camera's move between two views, planned from an intent and sampled over time. The author writes where to go; a rule
 * table picks how, and the minimum-jerk law (src/timing/minJerk.js, shared with the human door) sets the timing.
 *
 *   planCameraMove(intent, scene?)   → frozen {do, kind, who, seconds, from, to, on, line, reason, choice, basis, plan}
 *   sampleCameraMove(move, t)        → frozen {t, progress, camera, eye, look}
 *   cameraTrack(move, {rate?})       → frozen {who, kind, seconds, on, line, samples}: the path sampled evenly in time
 *
 * How a move goes (CAMERA_MOVE_RULES, first match): a fly whose look turns past `cutPast` is a CUT (a swing that far turns
 * the whole world round, and a cut reads cleaner); a turn of at most SMALL_TURN keeps its height and turns at one speed (a
 * SLERP about the vertical: the camera circles at the angles it has); any other turn is an ARC that rises over its middle,
 * so the subject stays above what stands round it. An orbit is the move asked for and never cuts.
 *
 * The path is in the camera's own numbers: the target moves in a line, the azimuth by the shorter way round (an orbit by
 * its `by`), the elevation in a line plus the arc's lift, the distance and focal length by equal ratios (so the subject
 * grows at one rate). Every sample is a camera `readCamera` takes, with its eye and its look as a quaternion — the turn that
 * `lens.js · aim` gives it, so its horizon is level. Each end is the camera handed in, exactly.
 */
import { minJerk, MIN_JERK_PEAK } from '../timing/minJerk.js';
import { quatAngle, quatFromAxes } from '../geom/quat.js';
import { shortestTurn } from '../geom/angles.js';
import { toSpherical, fromSpherical } from '../geom/sphere.js';
import { deepFreeze, orRefuse, readAll } from './fields.js';
import { aim } from './lens.js';
import { intentFrom } from './moveRead.js';

const DEG = Math.PI / 180;

/** The numbers the rule table and the timing use, each ours, a starting choice and not a measurement. */
export const CAMERA_MOVES = deepFreeze({
  /** A turn of at most this many degrees keeps its height. */
  smallTurn: 45,
  /** A fly whose look turns past this many degrees cuts (an intent's `cutPast` says otherwise; 180 never cuts). */
  cutPast: 150,
  /** How many degrees an arc rises over its middle (an intent's `lift` says otherwise). */
  rise: 10,
  /** The highest an arc's middle goes, in degrees: above this the view looks down on the subject's top. */
  highest: 75,
  /** The fastest the look may turn, in degrees a second; the `turn-speed` critic's limit. */
  comfort: 45,
  /** The share of `comfort` a planned move's fastest turn is held to, so a check sampled at any rate stays under it. */
  planShare: 0.9,
  /** The shortest move, in seconds: even a move that barely turns takes a beat. */
  leastSeconds: 0.5,
});

/** The rule table, first match: which kind of move, and the words for why. The tests are in `KIND_TESTS`, keyed by rule. */
export const CAMERA_MOVE_RULES = deepFreeze([
  { rule: 'turn-past-cut', kind: 'cut', when: 'a fly whose look turns past cutPast' },
  { rule: 'small-turn', kind: 'slerp', when: 'a turn of at most smallTurn: the same height, one speed' },
  { rule: 'large-turn', kind: 'arc', when: 'any other turn: it rises over its middle' },
]);
const KIND_TESTS = { 'turn-past-cut': (b) => b.do === 'fly' && b.turn > b.cutPast, 'small-turn': (b) => b.turn <= b.smallTurn, 'large-turn': () => true };
/** The kinds a camera move can be. */
export const CAMERA_MOVE_KINDS = Object.freeze(['slerp', 'arc', 'cut']);

/** The camera's look as a quaternion: the axes `aim` gives it (right, top, back), so a sample and the lens agree. */
export function lookOf(camera) {
  const lens = aim(camera, [1, 1]);
  return quatFromAxes(lens.right, lens.up, lens.forward.map((v) => -v));
}

/** A camera's angles as a place round its target, with the elevation within ±90° (past it, the same view the other way round). */
function anglesOf(c) {
  if (Math.abs(c.elevation) <= Math.PI / 2) return { azimuth: c.azimuth, elevation: c.elevation };
  const s = toSpherical(fromSpherical({ azimuth: c.azimuth, elevation: c.elevation, distance: 1 }));
  return { azimuth: s.azimuth, elevation: s.elevation };
}

const lerp = (a, b, s) => a + (b - a) * s;
/** By equal ratios when both are above 0 (a zoom at one rate), else in a line. */
const ratio = (a, b, s) => (a > 0 && b > 0 ? a * (b / a) ** s : lerp(a, b, s));

/** The camera s of the way along a planned path (0 ≤ s ≤ 1). */
function poseAt(plan, from, to, s) {
  const elevation = lerp(plan.elevation[0], plan.elevation[1], s) + plan.lift * Math.sin(Math.PI * s), distance = ratio(from.distance, to.distance, s);
  return { target: from.target.map((v, i) => lerp(v, to.target[i], s)), azimuth: plan.azimuth + plan.swing * s, elevation, distance, focal: ratio(from.focal, to.focal, s),
    aperture: lerp(from.aperture, to.aperture, s), focus: plan.focusFollows ? distance : ratio(from.focus, to.focus, s), shift: from.shift.map((v, i) => lerp(v, to.shift[i], s)) };
}

const STEPS = 512;
/** The most the look turns per unit of progress, sampled finely: the planned speed is read from it. */
function turnRate(plan, from, to) {
  let most = 0, last = lookOf(from);
  for (let k = 1; k <= STEPS; k++) { const look = lookOf(poseAt(plan, from, to, k / STEPS)); most = Math.max(most, quatAngle(last, look) * STEPS); last = look; }
  return most;
}

const one = (v) => Number(v.toFixed(1));
const ceil2 = (v) => Math.ceil(v * 100 - 1e-9) / 100;

function planned(read) {
  const { from } = read, to = read.do === 'orbit' ? { ...from, azimuth: from.azimuth + read.by * DEG } : read.to;
  // to a millionth of a degree: rounding in the last digits (which differs across engines) never flips a named view's choice
  const turn = read.do === 'orbit' ? Math.abs(read.by) : Number((quatAngle(lookOf(from), lookOf(to)) / DEG).toFixed(6));
  const facts = { do: read.do, turn, smallTurn: CAMERA_MOVES.smallTurn, cutPast: read.cutPast ?? CAMERA_MOVES.cutPast };
  const { rule, kind } = CAMERA_MOVE_RULES.find((r) => KIND_TESTS[r.rule](facts));
  const choice = { rule, kind, turn: one(turn), smallTurn: facts.smallTurn, cutPast: read.do === 'fly' ? facts.cutPast : null };
  const base = { do: read.do, kind, who: read.who, from, to, on: read.on, line: read.line, choice };
  if (kind === 'cut') {
    const unused = read.seconds === null ? '' : `; seconds: ${read.seconds} is not used`;
    const reason = `do: 'fly' → cut: the look turns ${one(turn)}°, past cutPast ${facts.cutPast}° — a swing that far turns the whole world round, and a cut reads cleaner${unused}`;
    return { ...base, seconds: 0, reason, basis: { turn: one(turn), swing: null, lift: null, liftCapped: false, seconds: 0, secondsGiven: read.seconds !== null, comfort: CAMERA_MOVES.comfort, peak: 0 }, plan: null };
  }
  const a = anglesOf(from), b = anglesOf(to), swing = read.do === 'orbit' ? read.by * DEG : shortestTurn(a.azimuth, b.azimuth);
  const wanted = read.lift ?? (kind === 'arc' ? CAMERA_MOVES.rise : 0), room = Math.max(0, CAMERA_MOVES.highest - (a.elevation + b.elevation) / 2 / DEG), lift = Math.min(wanted, room);
  const plan = { azimuth: a.azimuth, swing, elevation: [a.elevation, b.elevation], lift: lift * DEG, focusFollows: from.focus === from.distance && to.focus === to.distance };
  const rate = turnRate(plan, from, to), byComfort = Math.max(CAMERA_MOVES.leastSeconds, ceil2(rate / DEG * MIN_JERK_PEAK / (CAMERA_MOVES.comfort * CAMERA_MOVES.planShare)));
  const seconds = read.seconds ?? byComfort, peak = rate / DEG * MIN_JERK_PEAK / seconds;
  const how = kind === 'slerp' ? `at most ${facts.smallTurn}°, so it keeps its height and turns at one speed` : `more than ${facts.smallTurn}°${read.do === 'fly' ? ` and not past cutPast ${facts.cutPast}°` : ''}, so it rises ${one(lift)}° over its middle to keep the subject in sight`;
  const timing = read.seconds === null ? `over ${seconds} s of minimum jerk, set so its fastest turn (${one(peak)}°/s) stays under ${CAMERA_MOVES.comfort}°/s` : `over the ${seconds} s given, of minimum jerk (its fastest turn ${one(peak)}°/s)`;
  const capped = lift < wanted ? ` (${one(wanted)}° asked; ${CAMERA_MOVES.highest}° is the highest its middle goes)` : '';
  const reason = `do: '${read.do}' → ${kind}: the look turns ${one(turn)}°, ${how}${capped}, ${timing}`;
  return { ...base, seconds, reason, basis: { turn: one(turn), swing: one(swing / DEG), lift: one(lift), liftCapped: lift < wanted, seconds, secondsGiven: read.seconds !== null, comfort: CAMERA_MOVES.comfort, peak: one(peak) }, plan };
}

/** A camera move planned from its intent: frozen plain data a record keeps whole. Throws, listing every problem at once. */
export const planCameraMove = (intent, scene = undefined) => deepFreeze(orRefuse(readAll((f) => { const read = intentFrom(intent, scene, f); return read && planned(read); }), 'camera move'));

/** A sample: the camera, its eye and its look. */
const sampleOf = (t, progress, camera, cut) => deepFreeze({ t, progress, camera, eye: aim(camera, [1, 1]).eye, look: lookOf(camera), ...(cut ? { cut: true } : {}) });

/** Where the camera is t seconds into a move: frozen {t, progress, camera, eye, look}. A cut is its second view at every t. */
export function sampleCameraMove(move, t) {
  if (move === null || typeof move !== 'object' || !CAMERA_MOVE_KINDS.includes(move.kind)) throw new TypeError('sampleCameraMove takes a move from planCameraMove');
  if (typeof t !== 'number' || Number.isNaN(t)) throw new TypeError(`sampleCameraMove's t is a number of seconds — not ${String(t)}`);
  if (move.kind === 'cut') return sampleOf(t, 1, move.to, true);
  const u = t <= 0 ? 0 : t >= move.seconds ? 1 : t / move.seconds, s = minJerk(u);
  return sampleOf(t, s, s === 0 ? move.from : s === 1 ? move.to : poseAt(move.plan, move.from, move.to, s), false);
}

/** The most samples a track may hold. */
export const MOST_CAMERA_SAMPLES = 36001;

/** The move sampled `rate` times a second (60 unless given), both ends included: frozen {who, kind, seconds, on, line, samples}. A cut is its two views at 0 s. */
export function cameraTrack(move, settings = undefined) {
  const rate = settings?.rate ?? 60;
  if (typeof rate !== 'number' || !(rate >= 1 && rate <= 240)) throw new TypeError(`cameraTrack's rate is from 1 to 240 samples a second — not ${String(rate)}`);
  sampleCameraMove(move, 0);
  const head = { who: move.who, kind: move.kind, seconds: move.seconds, on: move.on, line: move.line };
  if (move.kind === 'cut') return deepFreeze({ ...head, samples: [sampleOf(0, 0, move.from, false), sampleOf(0, 1, move.to, true)] });
  const count = Math.min(MOST_CAMERA_SAMPLES - 1, Math.max(1, Math.ceil(move.seconds * rate)));
  return deepFreeze({ ...head, samples: Array.from({ length: count + 1 }, (_, i) => sampleCameraMove(move, i === count ? move.seconds : (move.seconds * i) / count)) });
}
