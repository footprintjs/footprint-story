/**
 * `ballistic` (families `throw` and `fall`): a thing in flight under gravity, in closed form (physics/flight.js).
 *
 *   throw intent  { do: 'throw', from: [x, y], to: [x, y], apex?: px above the higher end, seconds?, floor?, boxes?, radius? }
 *   fall intent   { do: 'fall', from: [x, y], floor: y, velocity?: [vx, vy] px a second, boxes?, radius? }
 *   options       gravity (px/s², down; 1960: 9.8 m/s² at 200 px to the metre)
 *   sample        { x, y, angle }: angle the heading (radians, y down); `to` exactly at the end
 *   basis         throw { across, apex, apexDefaulted, angle, speed, gravity, seconds, secondsGiven }
 *                 fall  { drop, startSpeed, gravity, seconds }
 *
 * One strategy for two families, one name: a throw is a flight aimed at a point, a fall a flight down to the floor.
 * `floor`, `boxes` and `radius` are the world the `contact` critic checks the flight against (a flight does not
 * collide; the critic says when it passes through something). WHY the usual apex is a quarter of the distance across:
 * for two ends at one height that is a 45° launch, the angle that reaches furthest for a given speed.
 */
import { readPoint, readNumber, refuse, stored, FAR } from '../read.js';
import { fallSeconds, flightAt, headingAt, launch, APEX_SHARE, MIN_APEX } from '../physics/flight.js';
import { readWorld } from '../physics/collide.js';
import { GRAVITY, MOST_PHYSICS_SECONDS } from '../physics/step.js';
import { intentKeys, optionNumber, readSeconds, round } from './options.js';

/** The shortest a throw may take: one frame at 60 a second. WHY: a throw over in 1e-9 s would fly at 1e11 px a second, a
 *  number no painter can draw and no viewer can see — refused with the fix rather than sampled. */
export const MIN_THROW_SECONDS = 1 / 60;
export const THROW_KEYS = Object.freeze(['from', 'to', 'apex', 'seconds', 'floor', 'boxes', 'radius']);
export const FALL_KEYS = Object.freeze(['from', 'floor', 'velocity', 'boxes', 'radius']);

/** The model's gravity option, or the usual. */
export const readGravity = (options, model) => optionNumber(options, 'gravity', model, 1, FAR, GRAVITY);
const radiusOf = (intent, who) => readNumber(intent, 'radius', who, { lo: 0, usual: 0 });

/** A throw read and launched: {from, to, velocity, seconds, world, radius, basis, why}. `extra` are the keys a variant adds. */
export function readThrow(intent, who, gravity, { extra = [], world = null } = {}) {
  intentKeys(intent, [...THROW_KEYS, ...extra], who);
  const from = readPoint(stored(intent, 'from', `${who}'s from`), `${who}'s from`), to = readPoint(stored(intent, 'to', `${who}'s to`), `${who}'s to`);
  const apex = stored(intent, 'apex', `${who}'s apex`) === undefined ? undefined : readNumber(intent, 'apex', who, { lo: 0 });
  const given = readSeconds(intent, who);
  if (given !== undefined && given < MIN_THROW_SECONDS) refuse(`${who}'s seconds is at least ${round(MIN_THROW_SECONDS, 4)} for a throw (one frame at 60 a second) — not ${given}`);
  if (given !== undefined && given > MOST_PHYSICS_SECONDS) refuse(`${who}'s seconds is at most ${MOST_PHYSICS_SECONDS} for a throw — not ${given}`);
  const { velocity, seconds } = launch(from, to, { apex, seconds: given, gravity }, who);
  if (seconds < MIN_THROW_SECONDS) refuse(`${who}'s throw would be over in ${seconds.toPrecision(2)} s, under one frame (${round(MIN_THROW_SECONDS, 4)} s) — a higher apex, or less gravity`);
  if (!(seconds <= MOST_PHYSICS_SECONDS)) refuse(`${who}'s throw would take ${seconds.toFixed(2)} s — at most ${MOST_PHYSICS_SECONDS} s: a lower apex, or seconds`);
  const across = Math.abs(to[0] - from[0]), top = Math.min(from[1], to[1]);
  const usual = Math.max(MIN_APEX, APEX_SHARE * across);
  // the apex reached: the highest point of the flight, above the higher end
  const tTop = Math.min(Math.max(-velocity[1] / gravity, 0), seconds), reached = top - flightAt(from, velocity, gravity, tTop)[1];
  const angle = (Math.atan2(-velocity[1], Math.abs(velocity[0])) * 180) / Math.PI, speed = Math.hypot(velocity[0], velocity[1]);
  const how = given !== undefined ? 'the seconds the intent gave' : apex !== undefined ? 'the apex the intent gave' : `the usual: a quarter of the ${Math.round(across)} px across${usual === MIN_APEX ? ` (at least ${MIN_APEX} px)` : ''}`;
  return {
    from, to, velocity, seconds, world: world ?? readWorld(intent, who), radius: radiusOf(intent, who),
    basis: { across, apex: reached, apexDefaulted: apex === undefined && given === undefined, angle, speed, gravity, seconds, secondsGiven: given !== undefined },
    why: `a throw over ${round(seconds)} s, up ${round(reached, 1)} px above its higher end (${how}), launched at ${round(angle, 1)}° under ${round(gravity, 0)} px/s²`,
  };
}

/** A fall read: {from, velocity, land, seconds, world, radius, basis, why}; `land` is where the body's centre lands. */
export function readFall(intent, who, gravity, { extra = [] } = {}) {
  intentKeys(intent, [...FALL_KEYS, ...extra], who);
  const rawFloor = stored(intent, 'floor', `${who}'s floor`);
  if (rawFloor === undefined || rawFloor === null) refuse(`${who}'s fall needs the floor it lands on: floor: <y in px>`);
  const from = readPoint(stored(intent, 'from', `${who}'s from`), `${who}'s from`), world = readWorld(intent, who), radius = radiusOf(intent, who);
  const velocity = stored(intent, 'velocity', `${who}'s velocity`) === undefined ? Object.freeze([0, 0]) : readPoint(stored(intent, 'velocity', `${who}'s velocity`), `${who}'s velocity`);
  const land = world.floor - radius, seconds = fallSeconds(from[1], velocity[1], land, gravity);
  if (seconds === null || from[1] > land) refuse(`${who}'s fall starts at y ${from[1]}, which is not above the floor it lands on (y ${land}) — move from above the floor, or the floor below it`);
  if (seconds > MOST_PHYSICS_SECONDS) refuse(`${who}'s fall would take ${seconds.toFixed(2)} s — at most ${MOST_PHYSICS_SECONDS} s: a nearer floor`);
  const drop = land - from[1], startSpeed = Math.hypot(velocity[0], velocity[1]);
  return {
    from, velocity, land, seconds, world, radius,
    basis: { drop, startSpeed, gravity, seconds },
    why: `a fall of ${round(drop, 1)} px onto the floor at y ${round(world.floor, 1)}${startSpeed ? ` from ${round(startSpeed, 0)} px a second` : ' from rest'}, over ${round(seconds)} s under ${round(gravity, 0)} px/s²`,
  };
}

/** A flight at t: on its parabola, `to` exactly at the end and `from` at the start; `angle` the heading. */
export function sampleFlight(plan, t) {
  const u = t > 0 ? Math.min(t, plan.seconds) : 0;
  const [x, y] = u >= plan.seconds ? plan.to : u <= 0 ? plan.from : flightAt(plan.from, plan.velocity, plan.gravity, u);
  return { x, y, angle: headingAt(plan.velocity, plan.gravity, u) };
}

export const ballisticModel = Object.freeze({
  family: Object.freeze(['throw', 'fall']),
  name: 'ballistic',
  options: Object.freeze(['gravity']),
  check(options) { readGravity(options, 'ballistic'); },
  plan(intent, { who, options }) {
    const gravity = readGravity(options, 'ballistic');
    if (intent.do === 'fall') {
      const f = readFall(intent, who, gravity);
      const to = [f.from[0] + f.velocity[0] * f.seconds, f.land];
      return { seconds: f.seconds, from: [...f.from], to, velocity: [...f.velocity], gravity, world: f.world, radius: f.radius, pushes: 1, basis: f.basis, why: f.why };
    }
    const r = readThrow(intent, who, gravity);
    return { seconds: r.seconds, from: [...r.from], to: [...r.to], velocity: r.velocity, gravity, world: r.world, radius: r.radius, pushes: 1, basis: r.basis, why: r.why };
  },
  sample: sampleFlight,
  checks: Object.freeze(['spacing', 'contact']),
});
