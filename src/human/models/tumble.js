/**
 * `free-spin` (family `tumble`): a thing spinning through the air — a ballistic flight (physics/flight.js) whose spin
 * is kept all the way (no torque in flight) — that lands on the floor at `to` and is handed over to a roll or a slide.
 *
 *   intent   { do: 'tumble', from, to (where its middle lands; the floor `radius` below), radius (px, at least 1),
 *              apex? or seconds?, spin? (rad/s, + clockwise on the frame), angle? (its start turn, radians),
 *              shape? ('ball' | 'disc' | 'ring' | 'box'), then? ('roll' | 'slide'), floor? (to's y + radius, or left out),
 *              boxes? }
 *   options  gravity; resistance (the roll after it lands); kinetic, static (the slide after it lands)
 *   sample   { x, y, angle, spin, air: 1 in flight | 0 on the floor, rolls: 1 while it rolls | 0 }
 *   basis    { across, apex, apexDefaulted, launch, speed, gravity, flightSeconds, secondsGiven, spin, spinDefaulted,
 *              flightTurns, shape, inertia, landing ('roll' | 'slide'), landingRule, landSpeed, landAngle, slant (a slide's
 *              degrees off a face at landing, null for a roll), groundSpeed,
 *              groundDistance, endedBy, box, seconds }
 *
 * THE HAND-OVER RULE, as data (LANDING_RULES, first match, in the shape of footprintjs decide() rules): the `then` the
 * intent names, else a round shape rolls on and a box slides on. At the landing its fall is stopped (no bounce: that is
 * the bounce model's work) and its speed across goes on:
 *   - a roll keeps its turning about the contact point (physics/rolling.js · landRoll): v′ = (v + k r ω) / (1 + k) —
 *     the usual spin is v / r, so it lands already rolling at its speed and rolls on at it;
 *   - a slide keeps v and the floor stops its spin; the usual spin is the one nearest v / r that lands it on a face
 *     (physics/spin.js · faceSpin), so it slides flat. A spin the intent gives is kept as given: then it may land at a
 *     slant, which `basis.slant` and the reason say (never snapped, which would be a jump).
 * Then it runs on the level floor (models/ground.js) to rest, or until a box stops it.
 */
import { refuse, stored, readNumber, shown } from '../read.js';
import { flightAt } from '../physics/flight.js';
import { readWorld, touchAlong } from '../physics/collide.js';
import { glide as runGlide, glideAt } from '../physics/glide.js';
import { ROLL_SHAPES, ROLLING_RESISTANCE, landRoll, rollTurn, rollingPush } from '../physics/rolling.js';
import { slidingPush } from '../physics/friction.js';
import { faceSpin, spinAt } from '../physics/spin.js';
import { MOST_PHYSICS_SECONDS } from '../physics/step.js';
import { readGravity, readThrow } from './ballistic.js';
import { stoppingCoefficient } from './ground.js';
import { readFriction } from './slide.js';
import { readRound } from './roll.js';
import { firstRule } from './rules.js';
import { optionNumber, round } from './options.js';

/** The keys a tumble reads beside a throw's. */
export const TUMBLE_KEYS = Object.freeze(['spin', 'angle', 'shape', 'then']);
export const TUMBLE_SHAPES = Object.freeze([...Object.keys(ROLL_SHAPES), 'box']);

const rule = (when, then, label) => Object.freeze({ when: Object.freeze(Object.fromEntries(Object.entries(when).map(([k, t]) => [k, Object.freeze(t)]))), then, label });
/** What a tumble does once it lands, first match wins: facts {then: the intent's then or null, round: its shape is not a box}. */
export const LANDING_RULES = Object.freeze([
  rule({ then: { eq: 'roll' } }, 'roll', 'the intent says then: roll'),
  rule({ then: { eq: 'slide' } }, 'slide', 'the intent says then: slide'),
  rule({ round: { eq: true } }, 'roll', 'a round thing rolls on'),
  rule({ round: { eq: false } }, 'slide', 'a box slides on'),
]);

const readOptions = (options) => ({ gravity: readGravity(options, 'free-spin'), resistance: optionNumber(options, 'resistance', 'free-spin', 0, 1, ROLLING_RESISTANCE), ...readFriction(options, 'free-spin') });

/** The flight: a throw landing its middle on `to`, the floor `radius` below it. */
function readFlight(intent, who, gravity) {
  const { radius, shape } = readRound(intent, who, TUMBLE_SHAPES);
  const to = stored(intent, 'to', `${who}'s to`), floor = Array.isArray(to) && typeof to[1] === 'number' ? to[1] + radius : null;
  const written = stored(intent, 'floor', `${who}'s floor`);
  if (written !== undefined && written !== null && written !== floor) refuse(`${who}: a tumble lands on the floor at to (y ${floor}) — drop floor, or set to's y to ${written - radius}`);
  const flight = readThrow(intent, who, gravity, { extra: TUMBLE_KEYS, world: floor === null ? null : readWorld({ floor, boxes: stored(intent, 'boxes', `${who}'s boxes`) }, who) });
  if (flight.from[1] > flight.to[1]) refuse(`${who}: a tumble starts at y ${flight.from[1]}, below the floor it lands on (to's y ${flight.to[1]}) — start it above the floor`);
  return { ...flight, radius, shape };
}

function plan(intent, { who, options }) {
  const o = readOptions(options), f = readFlight(intent, who, o.gravity);
  const then = stored(intent, 'then', `${who}'s then`) ?? null;
  if (then !== null && then !== 'roll' && then !== 'slide') refuse(`${who}'s then is 'roll' or 'slide' — what it does once it lands; not ${shown(then)}`);
  if (then === 'roll' && f.shape === 'box') refuse(`${who}: a box does not roll — then: 'slide', or a round shape (shape: 'ball')`);
  const chosen = firstRule(LANDING_RULES, { then, round: f.shape !== 'box' }), landing = chosen.then;
  const angle = readNumber(intent, 'angle', who, { usual: 0 }), T = f.seconds, across = f.velocity[0];
  const given = stored(intent, 'spin', `${who}'s spin`) !== undefined ? readNumber(intent, 'spin', who) : undefined;
  const usual = rollTurn(across, f.radius), spin = given ?? (landing === 'slide' ? faceSpin(angle, usual, T) : usual);
  const landAngle = spinAt(angle, spin, T), inertia = f.shape === 'box' ? null : ROLL_SHAPES[f.shape];
  // the hand-over: its fall stopped, its speed across goes on, as a roll (the turning about the contact kept) or a slide
  const groundSpeed = landing === 'roll' ? landRoll(across, spin, f.radius, inertia) : across, way = groundSpeed < 0 ? -1 : 1;
  const push = landing === 'roll' ? rollingPush({ along: 0, normal: o.gravity, resistance: o.resistance, inertia }) : slidingPush({ along: 0, normal: o.gravity, kinetic: o.kinetic, still: o.still });
  const ahead = touchAlong(f.to, [way, 0], f.world, f.radius), behind = touchAlong(f.to, [-way, 0], f.world, f.radius);
  if (ahead.inside !== null) refuse(`${who} lands inside its boxes[${ahead.inside}] — move to out of it, or the box`);
  const g = runGlide({ speed: Math.abs(groundSpeed), ...push, ahead: ahead.distance, behind: behind.distance, most: MOST_PHYSICS_SECONDS - T });
  if (g.endedBy === 'time') {
    const need = stoppingCoefficient({ along: 0, normal: o.gravity, speed: Math.abs(groundSpeed), seconds: MOST_PHYSICS_SECONDS - T, share: landing === 'roll' ? 1 + inertia : 1 });
    const fix = landing === 'roll' ? (need <= 1 ? `, or a resistance that stops it in time (model: {name: 'free-spin', resistance: ${need}})` : '') : (need <= 2 ? `, or a friction that stops it in time (model: {name: 'free-spin', kinetic: ${need}})` : '');
    refuse(`${who}: after it lands it would still be ${landing === 'roll' ? 'rolling' : 'sliding'} at ${MOST_PHYSICS_SECONDS} s — a slower throw or a box in its way${fix}`);
  }
  const box = g.endedBy === 'box' ? (g.q > 0 ? ahead.box : behind.box) : null, seconds = T + g.seconds;
  const spinHow = given !== undefined ? 'the spin the intent gave' : landing === 'roll' ? 'the usual: a roll\'s spin at its speed across, v / r' : 'the usual: the spin nearest v / r that lands it on a face';
  const after = g.seconds === 0 ? 'stays where it lands' : `goes ${round(g.travelled, 1)} px ${g.endedBy === 'box' ? `until its boxes[${box}] stops it dead` : 'to rest'}`;
  // a slide lands on a face only with the usual spin: a spin the intent gives is kept, so it may land at a slant — said, never snapped
  const face = Math.PI / 2, slant = landing === 'slide' ? (Math.abs(landAngle - Math.round(landAngle / face) * face) * 180) / Math.PI : null;
  const slantWords = slant !== null && slant > 0.5 ? `, at a slant ${round(slant, 1)}° off a face (the spin given; leave spin out to land flat)` : '';
  const onWords = landing === 'roll' ? `rolls on at ${round(Math.abs(groundSpeed), 0)} px a second (its turning about the contact kept: (v + k r ω) / (1 + k))` : `slides on at ${round(Math.abs(groundSpeed), 0)} px a second, its spin stopped by the floor${slantWords}`;
  return {
    seconds, from: [...f.from], to: [...f.to], velocity: f.velocity, gravity: o.gravity, angle, spin, landAt: T, landAngle, landing, radius: f.radius,
    way, glide: g, world: f.world, pushes: 1,
    // landing into a roll on the level floor, its turn per px of travel after it lands (wrap.js turns the rolling samples)
    ...(landing === 'roll' ? { turnVector: [1 / f.radius, 0], turnFrom: T } : {}),
    basis: { across: f.basis.across, apex: f.basis.apex, apexDefaulted: f.basis.apexDefaulted, launch: f.basis.angle, speed: f.basis.speed, gravity: o.gravity, flightSeconds: T, secondsGiven: f.basis.secondsGiven,
      spin, spinDefaulted: given === undefined, flightTurns: (spin * T) / (2 * Math.PI), shape: f.shape, inertia, landing, landingRule: chosen.label, landSpeed: Math.abs(across), landAngle, slant, groundSpeed, groundDistance: g.travelled, endedBy: g.endedBy, box, seconds },
    why: `${f.why}; spinning at ${round(spin, 2)} rad/s (${spinHow}), ${round(Math.abs(spin * T) / (2 * Math.PI), 2)} turns in the air with no torque on it; it lands at ${round(T)} s and ${onWords} (${chosen.label}), then ${after}, ${round(seconds)} s in all`,
  };
}

function sample(p, t) {
  if (t < p.landAt) {
    const u = t > 0 ? t : 0, [x, y] = u > 0 ? flightAt(p.from, p.velocity, p.gravity, u) : p.from;
    return { x, y, angle: spinAt(p.angle, p.spin, u), spin: p.spin, air: 1, rolls: 0 };
  }
  const { q, v } = glideAt(p.glide, t - p.landAt), x = p.to[0] + p.way * q, y = p.to[1];
  if (p.landing === 'roll') return { x, y, angle: p.landAngle + p.way * rollTurn(q, p.radius), spin: p.way * rollTurn(v, p.radius) || 0, air: 0, rolls: 1 };
  return { x, y, angle: p.landAngle, spin: 0, air: 0, rolls: 0 };
}

export const tumbleModel = Object.freeze({
  family: 'tumble',
  name: 'free-spin',
  options: Object.freeze(['gravity', 'resistance', 'kinetic', 'static']),
  check(options) { readOptions(options); },
  plan,
  sample,
  checks: Object.freeze(['spin', 'spacing', 'contact', 'roll-slip']),
});
