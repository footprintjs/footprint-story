/**
 * A planned path and its pace: where the camera is s of the way along, and how fast the picture changes there.
 *
 *   poseAt(plan, from, to, s)   the camera s of the way along (0 ≤ s ≤ 1)
 *   lookOf(camera)              its look as a quaternion: the axes `lens.js · aim` gives it
 *   paceBetween(a, b)           what changes from one camera to the next: {turn (°), slide (frame heights), zoom (ln of size)}
 *   paceOf(plan, from, to)      the most of each per unit of progress, read over 512 steps
 *   timingFor(pace, seconds?)   the seconds the limits allow, which limit set them, and the peaks a second at those seconds
 *
 * WHY three measures: a turn is not the only way a picture rushes. A fly to a thing far off moves the target across the
 * frame (slide: how many frame heights it travels, the frame's height at the target being distance / focal), and a zoom
 * or a dolly grows the subject (zoom: the change in ln(focal / distance), its size on the frame). A move timed by its turn
 * alone took 0.5 s to fly 400 m.
 */
import { MIN_JERK_PEAK } from '../timing/minJerk.js';
import { quatAngle, quatFromAxes } from '../geom/quat.js';
import { aim } from './lens.js';
import { CAMERA_MOVES } from './moveRules.js';

const DEG = Math.PI / 180, STEPS = 512;

/** The camera's look as a quaternion: the axes `aim` gives it (right, top, back), so a sample and the lens agree. */
export function lookOf(camera) {
  const lens = aim(camera, [1, 1]);
  return quatFromAxes(lens.right, lens.up, lens.forward.map((v) => -v));
}

const lerp = (a, b, s) => a + (b - a) * s;
/** By equal ratios when both are above 0 (a zoom at one rate), else in a line. */
const ratio = (a, b, s) => (a > 0 && b > 0 ? a * (b / a) ** s : lerp(a, b, s));

/** The camera s of the way along a planned path (0 ≤ s ≤ 1). */
export function poseAt(plan, from, to, s) {
  const elevation = lerp(plan.elevation[0], plan.elevation[1], s) + plan.lift * Math.sin(Math.PI * s), distance = ratio(from.distance, to.distance, s);
  return { target: from.target.map((v, i) => lerp(v, to.target[i], s)), azimuth: plan.azimuth + plan.swing * s, elevation, distance, focal: ratio(from.focal, to.focal, s),
    aperture: lerp(from.aperture, to.aperture, s), focus: plan.focusFollows ? distance : ratio(from.focus, to.focus, s), shift: from.shift.map((v, i) => lerp(v, to.shift[i], s)) };
}

/** The frame's height at the target, in the scene's units; 0 for a camera on its target. */
const heightAt = (c) => c.distance / c.focal;

/**
 * What changes between two cameras (with their looks): the turn in degrees, the target's travel in frame heights (over the
 * tighter of the two frames, so it says more, never less), and the change in the subject's size as |Δ ln(focal / distance)|.
 * A camera on its target (distance 0) has no size to compare: its zoom counts 0, its slide counts over the other frame.
 */
export function paceBetween(a, b, lookA = lookOf(a), lookB = lookOf(b)) {
  const travel = Math.hypot(b.target[0] - a.target[0], b.target[1] - a.target[1], b.target[2] - a.target[2]);
  const tight = Math.min(...[heightAt(a), heightAt(b)].filter((h) => h > 0)), slide = travel === 0 ? 0 : Number.isFinite(tight) ? travel / tight : 0;
  const zoom = a.distance > 0 && b.distance > 0 ? Math.abs(Math.log((b.focal / b.distance) / (a.focal / a.distance))) : 0;
  return { turn: quatAngle(lookA, lookB) / DEG, slide, zoom };
}

/** The most of each measure per unit of progress along a planned path, read over 512 steps. */
export function paceOf(plan, from, to) {
  const most = { turn: 0, slide: 0, zoom: 0 };
  let last = from, lastLook = lookOf(from);
  for (let k = 1; k <= STEPS; k++) {
    const pose = poseAt(plan, from, to, k / STEPS), look = lookOf(pose), step = paceBetween(last, pose, lastLook, look);
    for (const key of ['turn', 'slide', 'zoom']) most[key] = Math.max(most[key], step[key] * STEPS);
    last = pose; lastLook = look;
  }
  return most;
}

/** Each measure's limit a second, in its own units: degrees, frame heights, ln of a factor. */
export const LIMITS = Object.freeze({ turn: CAMERA_MOVES.comfort, slide: CAMERA_MOVES.slide, zoom: Math.log(CAMERA_MOVES.zoom) });
const ceil2 = (v) => Math.ceil(v * 100 - 1e-9) / 100;

/**
 * The timing: `comfortSeconds`, the fewest seconds that keep every measure's minimum-jerk peak (rate × 15/8 ÷ seconds, an
 * upper bound) at planShare of its limit; `by`, the measure that set them ('least' when the shortest beat did); and the
 * peaks a second at `seconds` (the given, or comfortSeconds).
 */
export function timingFor(pace, given = null) {
  const need = Object.fromEntries(Object.entries(LIMITS).map(([k, limit]) => [k, (pace[k] * MIN_JERK_PEAK) / (limit * CAMERA_MOVES.planShare)]));
  const by = Object.keys(need).reduce((a, b) => (need[b] > need[a] ? b : a)), comfortSeconds = Math.max(CAMERA_MOVES.leastSeconds, ceil2(need[by]));
  const seconds = given ?? comfortSeconds;
  return { seconds, comfortSeconds, by: ceil2(need[by]) > CAMERA_MOVES.leastSeconds ? by : 'least', peaks: { turn: (pace.turn * MIN_JERK_PEAK) / seconds, slide: (pace.slide * MIN_JERK_PEAK) / seconds, zoom: (pace.zoom * MIN_JERK_PEAK) / seconds } };
}
