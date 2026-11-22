/**
 * Reading a camera move's intent: `{do: 'fly', from, to}` or `{do: 'orbit', around, by}`, every problem at once, each named
 * where it is written. An end is a shot (words, framed on the scene by `camera.js · shotCamera`) or a camera (numbers, read
 * by `camera.js · cameraFrom`): an object with `target` is a camera. WHY both: a model writes words, a tool that already
 * placed its camera hands numbers, and the move is the same either way.
 */
import { cameraFrom, shotCamera } from './camera.js';
import { namesFrom, sceneFrom } from './scene.js';
import { cleanName } from './fields.js';

/** The keys an intent may hold. */
export const MOVE_KEYS = Object.freeze(['do', 'from', 'to', 'around', 'by', 'seconds', 'cutPast', 'lift', 'line', 'who']);
/** What a camera move may do. */
export const CAMERA_MOVE_DOS = Object.freeze(['fly', 'orbit']);
/** The longest move, in seconds, and the most an orbit may turn, in degrees (two whole turns). */
export const MOST_MOVE_SECONDS = 600, MOST_ORBIT = 720;
/** The highest lift, in degrees: past this an arc is a crane shot, not a move between two views. Ours. */
export const MOST_LIFT = 45;
const MOST_WHO = 120;

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Every name a camera's shot lists, kept in order, each once. */
const union = (...lists) => [...new Set(lists.flat())];

/** A camera filled in: every key a read camera has. */
export const filled = (c) => ({ target: c.target, azimuth: c.azimuth, elevation: c.elevation, distance: c.distance, focal: c.focal, aperture: c.aperture ?? 0, focus: c.focus ?? c.distance, shift: c.shift ?? [0, 0] });

/** One end, a shot or a camera, read into `f`: {camera, on} or null. */
function endFrom(raw, scene, f, at) {
  if (isObject(raw) && Object.hasOwn(raw, 'target')) { const c = cameraFrom(raw, f, at); return c && { camera: filled(c), on: [] }; }
  if (!isObject(raw)) return f.say(at, 'must be a shot ({on, from, size?, lens?}) or a camera ({target, azimuth, elevation, distance, focal})');
  if (!scene) return f.say(at, 'is a shot, and a shot is framed on the scene: pass it, planCameraMove(intent, scene)');
  const c = shotCamera(raw, scene, f, at);
  return c && { camera: filled(c), on: union([raw.on ?? raw.shot].flat().map(cleanName)) };   // read whole by shotCamera, so each is a name
}

/** Degrees from `least` to `most`, or null with a problem. */
const degrees = (f, v, at, least, most) => f.number(v, at, { least, most });

/** The intent read: {do, from, to, by, on, line, seconds, cutPast, lift, who}, angles in degrees as written. Null when it has a problem. */
export function intentFrom(raw, rawScene, f) {
  const own = f.object(raw, 'intent', MOVE_KEYS);
  if (!own) return null;
  const before = f.problems.length, scene = rawScene === undefined ? null : sceneFrom(rawScene, f, 'scene');
  if (rawScene !== undefined && !scene) return null;
  const kind = CAMERA_MOVE_DOS.includes(own.do) ? own.do : f.say('do', `must be ${CAMERA_MOVE_DOS.map((d) => `'${d}'`).join(' or ')}`);
  const who = own.who === undefined ? 'the camera move' : f.name(own.who, 'who', { most: MOST_WHO });
  const seconds = own.seconds === undefined ? null : f.number(own.seconds, 'seconds', { least: 0, most: MOST_MOVE_SECONDS, above: true });
  const lift = own.lift === undefined ? null : degrees(f, own.lift, 'lift', 0, MOST_LIFT);
  let from = null, to = null, by = null, on = [];
  if (kind === 'fly') {
    for (const key of ['around', 'by']) if (own[key] !== undefined) f.say(key, `belongs to do: 'orbit'; a fly goes from one view to another: from, to`);
    from = own.from === undefined ? f.say('from', 'must say where the move starts: a shot or a camera') : endFrom(own.from, scene, f, 'from');
    to = own.to === undefined ? f.say('to', 'must say where the move ends: a shot or a camera') : endFrom(own.to, scene, f, 'to');
    on = union(from?.on ?? [], to?.on ?? []);
  } else if (kind === 'orbit') {
    if (own.to !== undefined) f.say('to', "belongs to do: 'fly'; an orbit says how far round: by, in degrees");
    if (own.cutPast !== undefined) f.say('cutPast', 'belongs to do: \'fly\': an orbit is the move asked for, and never cuts');
    by = own.by === undefined ? f.say('by', `must say how far round, in degrees (at most ${MOST_ORBIT} either way; positive goes from front towards right)`) : degrees(f, own.by, 'by', -MOST_ORBIT, MOST_ORBIT);
    const names = own.around === undefined ? f.say('around', 'must name what the camera circles') : scene ? namesFrom(own.around, scene, f, 'around') : f.say('around', 'names things in the scene: pass it, planCameraMove(intent, scene)');
    const words = own.from ?? { from: 'front' };
    if (isObject(words) && (Object.hasOwn(words, 'on') || Object.hasOwn(words, 'shot') || Object.hasOwn(words, 'target'))) f.say('from', 'is the view the orbit starts from ({from, size?, lens?}): around names what it circles');
    else if (names) from = endFrom({ ...(isObject(words) ? words : { from: words }), on: names }, scene, f, 'from');
    on = names ?? [];
  }
  const cutPast = own.cutPast === undefined ? null : degrees(f, own.cutPast, 'cutPast', 0, 180);
  let line = null;
  if (own.line !== undefined) {
    if (!scene) f.say('line', 'names two things in the scene: pass it, planCameraMove(intent, scene)');
    else if (!Array.isArray(own.line) || own.line.length !== 2) f.say('line', 'must name the two things the line of action runs between: [a, b]');
    else { line = namesFrom(own.line, scene, f, 'line'); if (line && line.length !== 2) f.say('line', 'must name two different things'); }
  }
  if (f.problems.length > before) return null;
  return { do: kind, from: from.camera, to: to?.camera ?? null, by, on, line: line ?? (on.length === 2 ? on : null), seconds, cutPast, lift, who };
}
