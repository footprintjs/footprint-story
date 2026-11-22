/**
 * A camera's move between two views, planned from an intent and sampled over time. The author writes where to go; a rule
 * table picks how (moveRules.js), and the minimum-jerk law (src/timing/minJerk.js, shared with the human door) sets the
 * timing, its seconds the fewest that keep the turn, the slide and the zoom under their limits (movePace.js).
 *
 *   planCameraMove(intent, scene?)   → frozen {do, kind, who, seconds, from, to, on, line, reason, choice, basis, plan}
 *   sampleCameraMove(move, t)        → frozen {t, progress, camera, eye, look}
 *   cameraTrack(move, {rate?})       → frozen {who, kind, seconds, on, line, samples}: the path sampled evenly in time
 *
 * How a move goes (CAMERA_MOVE_RULES, first match): a fly whose look turns past `cutPast` is a CUT (a swing that far turns
 * the whole world round, and a cut reads cleaner), and so does a fly its limits would stretch past `longest` (12 s) unless
 * its seconds are given; a turn of at most `smallTurn` keeps its height and turns at one speed (a
 * SLERP about the vertical: the camera circles at the angles it has); any other turn is an ARC that rises over its middle,
 * so the subject stays above what stands round it. An orbit is the move asked for and never cuts. The rule decides on the
 * turn to a tenth of a degree, the number the reason shows, so the sentence always agrees with the choice.
 *
 * The path is in the camera's own numbers: the target moves in a line, the azimuth by the shorter way round (an orbit by
 * its `by`), the elevation in a line plus the arc's lift, the distance and focal length by equal ratios (so the subject
 * grows at one rate). Every sample is a camera `readCamera` takes, with its eye and its look as a quaternion — the turn that
 * `lens.js · aim` gives it, so its horizon is level. Each end is the camera handed in, exactly.
 */
import { minJerk } from '../timing/minJerk.js';
import { quatAngle } from '../geom/quat.js';
import { shortestTurn } from '../geom/angles.js';
import { toSpherical, fromSpherical } from '../geom/sphere.js';
import { deepFreeze, orRefuse, readAll } from './fields.js';
import { aim } from './lens.js';
import { intentFrom } from './moveRead.js';
import { CAMERA_MOVES, CAMERA_MOVE_RULES, CAMERA_MOVE_KINDS, KIND_TESTS, shownAgainst, tenth } from './moveRules.js';
import { lookOf, paceOf, poseAt, timingFor } from './movePace.js';

const DEG = Math.PI / 180;

/** A camera's angles as a place round its target, with the elevation within ±90° (past it, the same view the other way round). */
function anglesOf(c) {
  if (Math.abs(c.elevation) <= Math.PI / 2) return { azimuth: c.azimuth, elevation: c.elevation };
  const s = toSpherical(fromSpherical({ azimuth: c.azimuth, elevation: c.elevation, distance: 1 }));
  return { azimuth: s.azimuth, elevation: s.elevation };
}

const two = (v) => Number(v.toFixed(2));
const SET_BY = { turn: 'its turn', slide: 'its slide, how fast the target crosses the frame', zoom: 'its zoom, how fast the subject grows or shrinks', least: 'the shortest beat: it barely moves' };

/** At its fastest: each peak beside its limit, printed so it reads on the side of the limit it is on. */
function fastest(p) {
  const zoom = Math.exp(p.zoom);
  return `at its fastest it turns ${shownAgainst(p.turn, CAMERA_MOVES.comfort)}°/s (limit ${CAMERA_MOVES.comfort}), slides ${shownAgainst(p.slide, CAMERA_MOVES.slide)} frame heights a second (limit ${CAMERA_MOVES.slide}) and zooms ${shownAgainst(zoom, CAMERA_MOVES.zoom)}× a second (limit ${CAMERA_MOVES.zoom}×)`;
}
const timingText = (read, timing) => (read.seconds === null ? `over ${timing.seconds} s of minimum jerk, set by ${SET_BY[timing.by]} — ${fastest(timing.peaks)}` : `over the ${timing.seconds} s given, of minimum jerk — ${fastest(timing.peaks)}`);

/** The path a move that is not a cut would take, and its timing: its kind by the turn alone, then its lift and pace. */
function pathFor(read, from, to, turn) {
  const kind = turn <= CAMERA_MOVES.smallTurn ? 'slerp' : 'arc';
  const a = anglesOf(from), b = anglesOf(to), swing = read.do === 'orbit' ? read.by * DEG : shortestTurn(a.azimuth, b.azimuth);
  const wanted = read.lift ?? (kind === 'arc' ? CAMERA_MOVES.rise : 0), room = Math.max(0, CAMERA_MOVES.highest - (a.elevation + b.elevation) / 2 / DEG), lift = Math.min(wanted, room);
  const plan = { azimuth: a.azimuth, swing, elevation: [a.elevation, b.elevation], lift: lift * DEG, focusFollows: from.focus === from.distance && to.focus === to.distance };
  return { plan, swing, wanted, lift, timing: timingFor(paceOf(plan, from, to), read.seconds) };
}

function planned(read) {
  const { from } = read, to = read.do === 'orbit' ? { ...from, azimuth: from.azimuth + read.by * DEG } : read.to;
  // decided on the number the reason shows, so "45°" is never "more than 45°"; a tenth also keeps engines' last digits out
  const turn = read.do === 'orbit' ? Math.abs(read.by) : tenth(quatAngle(lookOf(from), lookOf(to)) / DEG);
  const path = pathFor(read, from, to, turn);
  const facts = { do: read.do, turn, smallTurn: CAMERA_MOVES.smallTurn, cutPast: read.cutPast ?? CAMERA_MOVES.cutPast, comfortSeconds: path.timing.comfortSeconds, secondsGiven: read.seconds !== null };
  const { rule, kind } = CAMERA_MOVE_RULES.find((r) => KIND_TESTS[r.rule](facts));
  const choice = { rule, kind, turn, smallTurn: facts.smallTurn, cutPast: read.do === 'fly' ? facts.cutPast : null };
  const base = { do: read.do, kind, who: read.who, from, to, on: read.on, line: read.line, choice };
  if (kind === 'cut') {
    const unused = read.seconds === null ? '' : `; seconds: ${read.seconds} is not used`;
    const why = rule === 'too-far' ? `the look turns ${turn}°, but at a comfortable pace the fly would take ${path.timing.comfortSeconds} s, longer than ${CAMERA_MOVES.longest} s, set by ${SET_BY[path.timing.by]} — a cut reads cleaner; give seconds to fly anyway`
      : `the look turns ${turn}°, past cutPast ${facts.cutPast}° — a swing that far turns the whole world round, and a cut reads cleaner${unused}`;
    return { ...base, seconds: 0, reason: `do: 'fly' → cut: ${why}`, plan: null,
      basis: { turn, swing: null, lift: null, liftCapped: false, seconds: 0, secondsGiven: read.seconds !== null, comfortSeconds: path.timing.comfortSeconds, limitedBy: path.timing.by, comfort: CAMERA_MOVES.comfort, peak: 0, slide: 0, zoom: 1 } };
  }
  const { plan, swing, wanted, lift, timing } = path, { seconds, peaks } = timing;
  const turning = turn === 0 ? 'so it keeps its height and does not turn' : 'so it keeps its height and turns at one speed';
  const how = kind === 'slerp' ? `at most ${facts.smallTurn}°, ${turning}` : `more than ${facts.smallTurn}°${read.do === 'fly' ? ` and not past cutPast ${facts.cutPast}°` : ''}, so it rises ${tenth(lift)}° over its middle to keep the subject in sight`;
  const capped = lift < wanted ? ` (${tenth(wanted)}° asked; ${CAMERA_MOVES.highest}° is the highest its middle goes)` : '';
  const reason = `do: '${read.do}' → ${kind}: the look turns ${turn}°, ${how}${capped}, ${timingText(read, timing)}`;
  return { ...base, seconds, reason, plan, basis: { turn, swing: tenth(swing / DEG), lift: tenth(lift), liftCapped: lift < wanted, seconds, secondsGiven: read.seconds !== null,
    comfortSeconds: timing.comfortSeconds, limitedBy: timing.by, comfort: CAMERA_MOVES.comfort, peak: tenth(peaks.turn), slide: two(peaks.slide), zoom: two(Math.exp(peaks.zoom)) } };
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
