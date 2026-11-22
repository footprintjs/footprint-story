/**
 * `no-slip` (family `roll`): a round thing rolling without slipping along a floor — side on, level or on a slope, or on a
 * floor seen from above — slowed to rest by rolling resistance, sped or slowed by the slope, stopped dead by a box.
 *
 *   intent   { do: 'roll', from: [x, y] (its middle), radius (px, at least 1), to?, speed?, slope? (degrees, + falls to
 *              the right), plane? ('side' | 'floor'), heading? (degrees, on the floor), shape? ('ball' | 'disc' | 'ring'),
 *              angle? (its start turn, radians), boxes? }
 *   options  gravity (1960 px/s²); resistance (rolling resistance C_rr, 0 to 1, ROLLING_RESISTANCE = 0.05)
 *   sample   { x, y, angle, spin } and on the floor `heading` (radians): `angle` its turn — side on, + clockwise on the
 *            frame (y down), so a roll to the right turns it +; on the floor, about the line in the floor across its
 *            heading — always distance / radius from its start turn, unwrapped (it never jumps back at ±π); `spin` dθ/dt
 *   plan     its glide, and `turnVector` [Tx, Ty]: the turn per px of travel, so a wrapper keeps it rolling
 *   basis    { plane, slope, radius, shape, inertia, resistance, gravity, speed, speedDefaulted, distance, turn, turns,
 *              seconds, endedBy ('rest' | 'end' | 'box'), endSpeed, hitSpeed, box, rolledBack }
 *
 * WHY the turn is distance / radius: a wheel that does not slip lays its rim down on the floor, so the arc it turns is
 * the ground it covers — the `roll-slip` critic measures exactly that on the drawn track. Sources: physics/rolling.js.
 */
import { readNumber } from '../read.js';
import { ROLL_SHAPES, ROLLING_RESISTANCE, rollTurn, rollingPush } from '../physics/rolling.js';
import { readGravity } from './ballistic.js';
import { intentKeys, optionNumber, round } from './options.js';
import { readGround, planGround, groundAt, stoppedBy, floorWords, endWords, readWord, stoppingCoefficient } from './ground.js';
import { MOST_PHYSICS_SECONDS } from '../physics/step.js';

export const ROLL_KEYS = Object.freeze(['from', 'to', 'speed', 'heading', 'slope', 'plane', 'radius', 'shape', 'angle', 'boxes']);
/** The smallest radius a roll takes (px): under a pixel a turn cannot be seen. */
export const MIN_ROLL_RADIUS = 1;

const readResistance = (options, model) => optionNumber(options, 'resistance', model, 0, 1, ROLLING_RESISTANCE);

/** The intent's radius (at least MIN_ROLL_RADIUS) and shape: what a round thing is. */
export function readRound(intent, who, shapes = Object.keys(ROLL_SHAPES)) {
  return { radius: readNumber(intent, 'radius', who, { lo: MIN_ROLL_RADIUS }), shape: readWord(intent, 'shape', who, shapes, 'ball') };
}

function plan(intent, { who, options }) {
  intentKeys(intent, ROLL_KEYS, who);
  const gravity = readGravity(options, 'no-slip'), resistance = readResistance(options, 'no-slip');
  const { radius, shape } = readRound(intent, who), inertia = ROLL_SHAPES[shape];
  const angle = readNumber(intent, 'angle', who, { usual: 0 });
  const line = readGround(intent, who, { gravity, radius });
  const push = rollingPush({ along: line.along, normal: line.normal, resistance, inertia });
  const hint = (v) => {
    const need = v > 0 ? stoppingCoefficient({ along: line.along, normal: line.normal, speed: v, seconds: MOST_PHYSICS_SECONDS, share: 1 + inertia }) : Infinity;
    return need <= 1 ? `a resistance that stops it in time (model: {name: 'no-slip', resistance: ${need}})` : '';
  };
  const { glide, speed, defaulted } = planGround(line, push, who, hint);
  const turn = line.turnSign * rollTurn(glide.q, radius), rolledBack = glide.travelled - Math.abs(glide.q) > 1e-6;
  const how = !defaulted ? `from ${round(speed, 0)} px a second` : speed ? `from ${round(speed, 0)} px a second (the speed that brings it to rest at to under rolling resistance ${resistance})` : 'from rest (the slope starts it)';
  return {
    seconds: glide.seconds, plane: line.plane, from: [...line.from], to: line.to && [...line.to], u: line.u, turnSign: line.turnSign, heading: line.heading,
    radius, angle, glide, world: line.world, pushes: 1,
    // its wheel's turn per px of travel (turn = T · travel): a wrapper that moves it turns it too (wrap.js)
    turnVector: [(line.turnSign * line.u[0]) / radius, (line.turnSign * line.u[1]) / radius],
    basis: { plane: line.plane, slope: line.slope, radius, shape, inertia, resistance, gravity, speed, speedDefaulted: defaulted, distance: glide.travelled, turn, turns: turn / (2 * Math.PI), seconds: glide.seconds, endedBy: glide.endedBy, endSpeed: Math.abs(glide.v), hitSpeed: glide.hitSpeed, box: stoppedBy(line, glide), rolledBack },
    why: `a ${shape} of radius ${round(radius, 1)} px rolling ${round(glide.travelled, 1)} px ${floorWords(line)} ${how}${rolledBack ? ', climbs, stops and rolls back' : ''}, ${endWords(line, glide)}, turning ${round(Math.abs(turn) / (2 * Math.PI), 2)} turns: distance / radius`,
  };
}

function sample(p, t) {
  const { x, y, q, v } = groundAt(p, t);
  const out = { x, y, angle: p.angle + p.turnSign * rollTurn(q, p.radius), spin: p.turnSign * rollTurn(v, p.radius) || 0 };   // || 0: at rest it spins 0, never −0
  if (p.heading !== null) out.heading = p.heading;
  return out;
}

export const rollModel = Object.freeze({
  family: 'roll',
  name: 'no-slip',
  options: Object.freeze(['gravity', 'resistance']),
  check(options) { readGravity(options, 'no-slip'); readResistance(options, 'no-slip'); },
  plan,
  sample,
  checks: Object.freeze(['roll-slip', 'spin', 'contact']),
});
