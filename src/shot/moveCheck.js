/**
 * A camera move checked: its path sampled, each critic run, and what is wrong said in words with the fix.
 *
 *   checkCameraMove(move, {scene?, frame?, on?, line?, rate?, who?})
 *     → frozen {measures: {critic: number | null}, bases: {critic: {…} | null}, findings: [{critic, level, message, fix, basis}]}
 *
 * `move` is a planned move (planCameraMove) or a path made by hand, {samples: [{t, camera, look?, cut?}], who?, on?, line?}:
 * WHY both: a tool that flies its own camera can ask the same questions of its path. A hand sample's eye is worked out from
 * its camera; its look is the camera's own unless given (a quaternion [w, x, y, z]), so a path that leans can be checked.
 * The sight and line critics need the scene (and the frame); without it they say null, never a guess.
 */
import { deepFreeze, orRefuse, readAll } from './fields.js';
import { aim } from './lens.js';
import { cameraFrom, frameFrom } from './camera.js';
import { namesFrom, sceneFrom } from './scene.js';
import { cameraTrack, MOST_CAMERA_SAMPLES } from './move.js';
import { CAMERA_MOVE_KINDS } from './moveRules.js';
import { lookOf } from './movePace.js';
import { filled, MOST_LIFT } from './moveRead.js';
import { CAMERA_CRITICS_LIST, SIGHT_DROP } from './moveCritics.js';

const SETTINGS = ['scene', 'frame', 'on', 'line', 'rate', 'who'], SAMPLE = ['t', 'camera', 'look', 'cut', 'progress', 'eye'], TRACK = ['samples', 'who', 'on', 'line', 'kind', 'seconds'];
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** A planned move's own numbers, checked before it is sampled: a copy that went astray is refused, not drawn. */
function movedFrom(move, f) {
  if (!CAMERA_MOVE_KINDS.includes(move.kind)) return f.say('move.kind', `must be ${CAMERA_MOVE_KINDS.join(', ')}: pass a move from planCameraMove`);
  cameraFrom(move.from, f, 'move.from');
  cameraFrom(move.to, f, 'move.to');
  if (move.kind !== 'cut') {
    f.number(move.seconds, 'move.seconds', { least: 0, above: true });
    const plan = isObject(move.plan) ? move.plan : f.say('move.plan', 'must be the plan planCameraMove made');
    if (plan) { f.number(plan.azimuth, 'move.plan.azimuth'); f.number(plan.swing, 'move.plan.swing'); f.number(plan.lift, 'move.plan.lift'); f.numbers(plan.elevation, 'move.plan.elevation', 2, {}, 'two numbers'); }
  }
  return move;
}

/** A path made by hand, read: {who, on, line, samples} or null. */
function handFrom(raw, f) {
  const own = f.object(raw, 'move', TRACK);
  if (!own) return null;
  if (!Array.isArray(own.samples) || own.samples.length < 2 || own.samples.length > MOST_CAMERA_SAMPLES) return f.say('move.samples', `must be a list of 2 to ${MOST_CAMERA_SAMPLES} samples, each {t, camera, look?, cut?}`);
  const samples = [];
  own.samples.forEach((rawSample, i) => {
    const at = `move.samples[${i}]`, s = f.object(rawSample, at, SAMPLE);
    if (!s) return;
    const t = f.number(s.t, `${at}.t`), camera = cameraFrom(s.camera, f, `${at}.camera`), cut = s.cut === undefined ? false : s.cut === true || s.cut === false ? s.cut : f.say(`${at}.cut`, 'must be true or false');
    const look = s.look === undefined ? null : f.numbers(s.look, `${at}.look`, 4, {}, 'a quaternion [w, x, y, z]');
    if (look && Math.hypot(...look) === 0) f.say(`${at}.look`, 'has no length: it is no turn');
    const before = samples[samples.length - 1];
    if (t !== null && before && (t < before.t || (t === before.t && !cut))) f.say(`${at}.t`, `is ${t}, before or at the sample before (${before.t}): times go forward, and only a cut takes none`);
    const eye = camera ? aim(camera, [1, 1]).eye : null;
    // an eye is worked out from the camera; one handed in (a track read back) must say the same, or the path says two things
    if (eye && s.eye !== undefined && !(Array.isArray(s.eye) && s.eye.length === 3 && s.eye.every((v, k) => Math.abs(v - eye[k]) <= 1e-9 * Math.max(1, Math.abs(eye[k]))))) f.say(`${at}.eye`, 'is not where its camera stands: leave it out, and it is worked out from the camera');
    if (t !== null && camera) samples.push({ t, camera: filled(camera), look: look ?? lookOf(camera), looked: look !== null, eye, cut: Boolean(cut) });
  });
  return { who: own.who, on: own.on, line: own.line, samples };
}

/** The scene, frame, subjects and line the critics read, from the settings or the move. */
function worldFrom(settings, track, f) {
  const scene = settings.scene === undefined ? null : sceneFrom(settings.scene, f, 'scene'), frame = settings.frame === undefined ? null : frameFrom(settings.frame, f, 'frame');
  // names the caller gives need the scene; the move's own (from its shots) are simply not read without one
  const named = (given, own, at) => (given !== undefined ? (scene ? namesFrom(given, scene, f, at) : f.say(at, 'names things in the scene: pass it, {scene}')) : scene && own?.length ? namesFrom(own, scene, f, `move.${at}`) : null);
  const on = named(settings.on, track.on, 'on'), line = named(settings.line, track.line, 'line');
  if (line && line.length !== 2) f.say('line', 'must name two different things');
  // two subjects are the line of action unless one is named: a planned move and a hand path alike
  return { scene, frame, on: on ?? [], line: line ?? (on?.length === 2 ? on : null) };
}

/** The checks run over a camera move's path: the numbers, and a finding for each past its limit. Throws, listing every problem at once. */
export const checkCameraMove = (move, settings = undefined) => deepFreeze(orRefuse(readAll((f) => {
  const own = settings === undefined ? {} : f.object(settings, 'settings', SETTINGS);
  if (!own || !isObject(move)) return own ? f.say('move', 'must be a move from planCameraMove or a path {samples}') : null;
  const rate = own.rate === undefined ? 30 : f.number(own.rate, 'settings.rate', { least: 1, most: 240 });
  const hand = Object.hasOwn(move, 'samples'), read = hand ? handFrom(move, f) : movedFrom(move, f);
  if (!read || rate === null || f.problems.length) return null;
  const track = hand ? read : cameraTrack(read, { rate }), world = worldFrom(own, track, f);
  const who = own.who === undefined ? (typeof track.who === 'string' ? track.who : 'the camera move') : f.name(own.who, 'who', { most: 120 });
  if (f.problems.length) return null;
  const hint = hand ? null : { do: move.do, turn: move.choice?.turn ?? 0, lift: move.basis?.lift ?? null, swing: move.basis?.swing ?? null, seconds: move.seconds, comfortSeconds: move.basis?.comfortSeconds ?? null };
  const measures = {}, bases = {}, findings = [];
  for (const critic of CAMERA_CRITICS_LIST) {
    const got = critic.measure({ ...track, on: world.on, line: world.line }, world);
    // a move that hides its subject: the same move kept level, and lifted 15° more, are measured too, so the fix it names is
    // one that helps (an arc whose rise is what hides it is told lift: 0 first), never a guess that sends the author round
    if (critic.name === 'in-sight' && got && got.value > SIGHT_DROP && hint && move.plan) {
      const tried = (lift) => critic.measure({ ...cameraTrack({ ...move, plan: { ...move.plan, lift: lift * Math.PI / 180 } }, { rate }), on: world.on, line: world.line }, world)?.value ?? null;
      hint.levelDrop = move.plan.lift > 0 ? tried(0) : null;
      hint.higherDrop = (hint.lift ?? 0) < MOST_LIFT ? tried(Math.min(MOST_LIFT, (hint.lift ?? 0) + 15)) : null;
    }
    measures[critic.name] = got ? got.value : null;
    bases[critic.name] = got ? got.basis : null;
    const found = got ? critic.finding(got.value, who, got.basis, hint) : null;
    if (found) findings.push({ critic: critic.name, ...found, basis: got.basis });
  }
  return { measures, bases, findings };
}), 'camera move check'));
