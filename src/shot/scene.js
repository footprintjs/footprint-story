/**
 * A scene: what a tool knows about the picture in 3D, in our own shape. A thing is a ball (`r`), a point (neither `r` nor
 * `size`) or a card (`size`, with an optional `normal` it faces, front by default, and `back: true` when seeing its back is fine).
 */
import { FAR, MOST_THINGS, deepFreeze, orRefuse, pointOf, readAll } from './fields.js';

const SCENE = ['unit', 'up', 'things'], THING = ['name', 'at', 'r', 'size', 'normal', 'back'], MOST_UNIT = 8, MOST_NAMED = 8;

/** Reads one thing into `f`; null when it has a problem. */
export function thingFrom(raw, f, at) {
  const own = f.object(raw, at, THING);
  if (!own) return null;
  const name = f.name(own.name, `${at}.name`), place = pointOf(f, own.at, `${at}.at`), thing = { name, at: place };
  if (own.r !== undefined && own.size !== undefined) f.say(at, 'must have an r (a ball) or a size (a card), not both');
  if (own.r !== undefined) thing.r = f.number(own.r, `${at}.r`, { least: 0 });
  if (own.size !== undefined) thing.size = f.numbers(own.size, `${at}.size`, 2, { least: 0, above: true }, 'two numbers [width, height], above 0');
  if (own.normal !== undefined || own.back !== undefined) {
    if (own.size === undefined) f.say(at, 'has a normal or a back, and only a card (a size) has those');
    if (own.normal !== undefined) {
      const n = pointOf(f, own.normal, `${at}.normal`), length = n ? Math.hypot(...n) : 1;
      if (length === 0) f.say(`${at}.normal`, 'must point somewhere: [0, 0, 1] faces the front');
      else if (n) thing.normal = n.map((v) => v / length);
    }
    if (own.back !== undefined && typeof own.back !== 'boolean') f.say(`${at}.back`, 'must be true or false');
    else if (own.back !== undefined) thing.back = own.back;
  }
  return thing;
}

/** Reads a scene into `f`; null when it has a problem. */
export function sceneFrom(raw, f, at = '') {
  const here = (key) => (at ? `${at}.${key}` : key), own = f.object(raw, at, SCENE);
  if (!own) return null;
  const unit = own.unit === undefined || own.unit === '' ? '' : f.name(own.unit, here('unit'), { most: MOST_UNIT });
  if (own.up !== undefined && own.up !== 'y') f.say(here('up'), "must be 'y': it is the only up there is for now");
  if (!Array.isArray(own.things)) return f.say(here('things'), 'must be a list of things, each {name, at} with an r or a size');
  if (own.things.length > MOST_THINGS) return f.say(here('things'), `has ${own.things.length}, and ${MOST_THINGS} is the most: leave out what the camera need not know`);
  const before = f.problems.length, seen = new Set(), things = [];
  for (let i = 0; i < own.things.length; i++) {
    const place = `${here('things')}[${i}]`, thing = thingFrom(own.things[i], f, place);
    if (!thing?.name) continue;
    if (thing.name === 'all') f.say(`${place}.name`, "is 'all', which a shot's focus keeps for itself: choose another name");
    if (seen.has(thing.name)) f.say(`${place}.name`, `"${thing.name}" is already a thing here: names must differ once hidden characters are gone`);
    seen.add(thing.name);
    things.push(thing);
  }
  return f.problems.length > before ? null : { unit, up: 'y', things };
}

/** Names as a list, each known to the scene; null with a problem. */
export function namesFrom(v, scene, f, at) {
  const list = typeof v === 'string' ? [v] : v;
  if (!Array.isArray(list) || !list.length) return f.say(at, 'must name a thing, or list the things');
  if (list.length > MOST_THINGS) return f.say(at, `has ${list.length}, and ${MOST_THINGS} is the most`);
  const names = [];
  for (let i = 0; i < list.length; i++) {
    const place = list === v ? `${at}[${i}]` : at, name = f.name(list[i], place);
    if (name && !scene.things.some((t) => t.name === name)) f.say(place, `"${name}" is not in the scene (${knownNames(scene)})`);
    else if (name && !names.includes(name)) names.push(name);
  }
  return names.length ? names : null;
}

const knownNames = (scene) => {
  const all = scene.things.map((t) => `"${t.name}"`), more = all.length - MOST_NAMED;
  return all.length ? `it has ${all.slice(0, MOST_NAMED).join(', ')}${more > 0 ? ` and ${more} more` : ''}` : 'it is empty';
};

const reading = (raw) => readAll((f) => sceneFrom(raw, f));

/** Every problem in a scene, [{at, message}]; [] when it can be read. Never throws on what it is given. */
export const sceneProblems = (raw) => reading(raw).problems;
/** A scene read: frozen {unit, up, things}. Throws when it cannot be, its `problems` listing all of them. */
export const readScene = (raw) => deepFreeze(orRefuse(reading(raw), 'scene'));
