/**
 * The camera as numbers: a target it circles, angles in radians, a distance, a focal length as a share of the frame's height,
 * and a lens radius (`aperture`, 0 is a pinhole) in the scene's units. `focus` is the depth that is sharp, the distance
 * unless it says otherwise; `shift` slides the picture by a share of the frame, right and up. `frameOf` turns a shot into one.
 */
import { FAR, deepFreeze, orRefuse, pointOf, readAll } from './fields.js';
import { add, dot, mul, sub } from './lens.js';
import { sceneFrom } from './scene.js';
import { shotFrom } from './readShot.js';
import { LENSES, SIZES, viewFrom } from './views.js';

const FIELDS = ['target', 'azimuth', 'elevation', 'distance', 'focal', 'aperture', 'focus', 'shift'], TURNS = 1e6, MOST_FOCAL = 1e3, MOST_SHIFT = 100, MOST_FRAME = 65536;

/** Reads a camera into `f`; null when it has a problem. */
export function cameraFrom(raw, f, at = 'camera') {
  const own = f.object(raw, at, FIELDS);
  if (!own) return null;
  const before = f.problems.length, angle = { least: -TURNS, most: TURNS }, lens = { least: 0, above: true };
  const camera = { target: pointOf(f, own.target, `${at}.target`), azimuth: f.number(own.azimuth, `${at}.azimuth`, angle), elevation: f.number(own.elevation, `${at}.elevation`, angle),
    distance: f.length(own.distance, `${at}.distance`, { least: 0 }), focal: f.number(own.focal, `${at}.focal`, { least: 0, most: MOST_FOCAL, above: true }),
    aperture: own.aperture === undefined ? 0 : f.number(own.aperture, `${at}.aperture`, { least: 0 }),
    shift: own.shift === undefined ? [0, 0] : f.numbers(own.shift, `${at}.shift`, 2, { least: -MOST_SHIFT, most: MOST_SHIFT }, 'two numbers [right, up], shares of the frame') };
  camera.focus = own.focus === undefined ? camera.distance : f.length(own.focus, `${at}.focus`, lens);
  if (camera.aperture > 0 && camera.focus === 0) f.say(`${at}.distance`, 'is 0, which leaves a lens with no plane to focus on: give a focus, or an aperture of 0');
  return f.problems.length > before ? null : camera;
}

/** Reads a frame, [width, height] in pixels, into `f`; null when it has a problem. */
export const frameFrom = (raw, f, at = 'frame') => f.numbers(raw, at, 2, { least: 1, most: MOST_FRAME }, 'two numbers [width, height], in pixels');

/** A camera read and whole: frozen, with `aperture`, `focus` and `shift` filled in. Throws, listing every problem. */
export const readCamera = (raw) => deepFreeze(orRefuse(readAll((f) => cameraFrom(raw, f)), 'camera'));

/** How far to stand so a ball of `radius` fills `share` of the frame's height, straight on: exact, not the small-angle sum. */
export function distanceFor(radius, share, focal) {
  const ok = (v) => typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= FAR;
  if (!ok(radius) || !ok(share) || !ok(focal)) throw new TypeError('distanceFor(radius, share, focal) takes three finite numbers above 0');
  const tan = share / (2 * focal);
  return radius * Math.sqrt(1 + tan * tan) / tan;
}

/** The default lens radius at a distance, in the scene's units. Its first term does not scale: a scene in much smaller units goes softer. */
export function apertureFor(distance) {
  if (typeof distance !== 'number' || !Number.isFinite(distance) || distance < 0 || distance > FAR) throw new TypeError(`apertureFor(distance) takes a finite distance from 0 to ${FAR}`);
  return 0.03 + distance * 0.004;
}

/** What a shot frames: a lone thing as itself; several, by a ball that holds them all. A lone card is framed by its height, as a size word means. */
function subjectBall(things) {
  if (things.length === 1) {
    const [t] = things;
    return { at: t.at, radius: t.size ? t.size[1] / 2 : t.r ?? 0, flat: Boolean(t.size) };
  }
  const reach = (t) => (t.size ? Math.hypot(t.size[0], t.size[1]) / 2 : t.r ?? 0);
  const at = [0, 1, 2].map((i) => (Math.min(...things.map((t) => t.at[i] - reach(t))) + Math.max(...things.map((t) => t.at[i] + reach(t)))) / 2);
  return { at, radius: Math.max(...things.map((t) => Math.hypot(...sub(t.at, at)) + reach(t))), flat: false };
}

function planned(rawShot, rawScene, f) {
  const scene = sceneFrom(rawScene, f, 'scene'), shot = scene ? shotFrom(rawShot, scene, f) : null;
  if (!shot) return null;
  const { at, radius, flat } = subjectBall(shot.on.map((n) => scene.things.find((t) => t.name === n)));
  if (!radius) return f.say('on', `"${shot.on[0]}" has no size to frame: give it an r or a size, or name more things`);
  if (radius > FAR) return f.say('on', `spans ${radius}, and ${FAR} is the most a shot can frame: name fewer things`);
  const view = viewFrom(shot.from, f, 'from'), focal = LENSES[shot.lens], distance = flat ? 2 * radius * focal / SIZES[shot.size] : distanceFor(radius, SIZES[shot.size], focal);
  if (distance > FAR) return f.say('on', `would need the camera ${distance} away: make the subject smaller or the size wider`);
  const camera = { target: at, azimuth: view.azimuth, elevation: view.elevation, distance, focal, aperture: shot.focus === 'all' ? 0 : apertureFor(distance) };
  if (!shot.focus || shot.focus === 'all' || shot.on.includes(shot.focus) && shot.on.length === 1) return camera;
  const ce = Math.cos(view.elevation), back = [ce * Math.sin(view.azimuth), Math.sin(view.elevation), ce * Math.cos(view.azimuth)], eye = add(at, mul(back, distance));
  const focus = dot(sub(scene.things.find((t) => t.name === shot.focus).at, eye), mul(back, -1));
  return focus > 0 ? { ...camera, focus } : f.say('focus', `"${shot.focus}" is behind the camera from ${shot.from}: focus on what it can see`);
}

/** The camera a shot asks for: frozen {target, azimuth, elevation, distance, focal, aperture, focus?}. Throws, listing every problem. */
export const frameOf = (shot, scene) => deepFreeze(orRefuse(readAll((f) => planned(shot, scene, f)), 'shot'));
