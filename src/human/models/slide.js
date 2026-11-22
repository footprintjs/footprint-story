/**
 * `coulomb` (family `slide`): a thing sliding on a floor, slowed to rest by kinetic friction (Coulomb's law: the same
 * slowing at any speed), held once stopped by static friction, sped or slowed by a slope, stopped dead by a box.
 *
 *   intent   { do: 'slide', from: [x, y], to?, speed?, slope?, plane? ('side' | 'floor'), heading?, radius? (its half
 *              size, px, 0: how near a box its middle comes), angle? (radians, kept: a slide does not turn), boxes? }
 *   options  gravity (1960 px/s²); kinetic (0 to 2, KINETIC_FRICTION = 0.2); static (0 to 2, at least kinetic,
 *            STATIC_FRICTION = 0.25)
 *   sample   { x, y, angle, spin: 0 } and on the floor `heading` (radians)
 *   basis    { plane, slope, kinetic, static, gravity, speed, speedDefaulted, distance, seconds, endedBy, endSpeed,
 *              hitSpeed, box, slidBack }
 *
 * On a level floor it slides v² / (2 μ g) and stops in v / (μ g). Sources: physics/friction.js.
 */
import { readNumber, refuse } from '../read.js';
import { KINETIC_FRICTION, STATIC_FRICTION, slidingPush } from '../physics/friction.js';
import { readGravity } from './ballistic.js';
import { intentKeys, optionNumber, round } from './options.js';
import { readGround, planGround, groundAt, stoppedBy, floorWords, endWords } from './ground.js';

export const SLIDE_KEYS = Object.freeze(['from', 'to', 'speed', 'heading', 'slope', 'plane', 'radius', 'angle', 'boxes']);
/** The most a friction coefficient may be: 2 (rubber on dry concrete is about 1). */
export const MOST_FRICTION = 2;

/** The two coefficients, kinetic and static, checked: static is at least kinetic (it takes more to start a slide than to keep one going). */
export function readFriction(options, model) {
  const kinetic = optionNumber(options, 'kinetic', model, 0, MOST_FRICTION, KINETIC_FRICTION);
  const still = optionNumber(options, 'static', model, 0, MOST_FRICTION, Math.max(STATIC_FRICTION, kinetic));
  if (still < kinetic) refuse(`model "${model}"'s static friction (${still}) is under its kinetic (${kinetic}) — it takes at least as much to start a slide as to keep one going: static ≥ kinetic`);
  return { kinetic, still };
}

function plan(intent, { who, options }) {
  intentKeys(intent, SLIDE_KEYS, who);
  const gravity = readGravity(options, 'coulomb'), { kinetic, still } = readFriction(options, 'coulomb');
  const radius = readNumber(intent, 'radius', who, { lo: 0, usual: 0 }), angle = readNumber(intent, 'angle', who, { usual: 0 });
  const line = readGround(intent, who, { gravity, radius });
  const { glide, speed, defaulted } = planGround(line, slidingPush({ along: line.along, normal: line.normal, kinetic, still }), who, `give to (where it comes to rest), put a box in its way, or more friction (model: {name: 'coulomb', kinetic: ${round(Math.min(MOST_FRICTION, kinetic * 2 + 0.01), 2)}})`);
  const back = glide.travelled - Math.abs(glide.q) > 1e-6;
  const how = !defaulted ? `from ${round(speed, 0)} px a second` : speed ? `from ${round(speed, 0)} px a second (the speed that brings it to rest at to under kinetic friction ${kinetic})` : 'from rest (the slope starts it)';
  return {
    seconds: glide.seconds, plane: line.plane, from: [...line.from], to: line.to && [...line.to], u: line.u, heading: line.heading,
    radius, angle, glide, world: line.world, pushes: 1,
    basis: { plane: line.plane, slope: line.slope, kinetic, static: still, gravity, speed, speedDefaulted: defaulted, distance: glide.travelled, seconds: glide.seconds, endedBy: glide.endedBy, endSpeed: Math.abs(glide.v), hitSpeed: glide.hitSpeed, box: stoppedBy(line, glide), slidBack: back },
    why: `a slide of ${round(glide.travelled, 1)} px ${floorWords(line)} ${how}${back ? ', climbs, stops and slides back' : ''}, ${endWords(line, glide)}, slowed by kinetic friction ${kinetic} (static ${still})`,
  };
}

function sample(p, t) {
  const { x, y } = groundAt(p, t), out = { x, y, angle: p.angle, spin: 0 };
  if (p.heading !== null) out.heading = p.heading;
  return out;
}

export const slideModel = Object.freeze({
  family: 'slide',
  name: 'coulomb',
  options: Object.freeze(['gravity', 'kinetic', 'static']),
  check(options) { readGravity(options, 'coulomb'); readFriction(options, 'coulomb'); },
  plan,
  sample,
  checks: Object.freeze(['spin', 'contact']),
});
