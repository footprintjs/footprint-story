/**
 * What a roll and a slide share: a thing on a straight floor, read from the intent, its motion planned on the glide law
 * (physics/glide.js), and its place at t. The tumble model's landing runs on the same planner.
 *
 *   readGround(intent, who, { gravity, radius })  → the line: {plane, from, u, turnSign, slope, heading, to, end, speed,
 *                                                  along, normal, world, ahead, behind}
 *   planGround(line, push, who, more)              → {glide, speed, defaulted}: refused, naming the entry and the fix,
 *                                                  when nothing moves it, it stops short of `to`, or it never stops
 *   groundAt(plan, t)                              → {x, y, q, v}
 *
 * Two planes. `plane: 'side'` (the usual) is the frame seen side on, y down: the floor is the line through `from` at
 * `slope` degrees (+ falls to the right), and `speed`'s sign is the way it goes (+ right). `plane: 'floor'` is a floor
 * seen from above, in its own px (x across, y deep — what the isometric door lays out; the tool projects): level, so no
 * slope, and the way is toward `to` or along `heading` (degrees, 0 along +x, 90 along +y). `to` is where it ends; with no
 * `speed` the law picks the start speed that brings it to rest exactly there (√(2·a·d)), or starts it from rest when
 * the slope runs it down.
 */
import { readPoint, readNumber, refuse, shown, stored } from '../read.js';
import { readWorld, touchAlong } from '../physics/collide.js';
import { glide, glideAt, restSpeed } from '../physics/glide.js';
import { MOST_SLOPE } from '../physics/rolling.js';
import { MOST_PHYSICS_SECONDS } from '../physics/step.js';
import { round } from './options.js';

export const GROUND_PLANES = Object.freeze(['side', 'floor']);
/** The fastest start a roll or a slide takes (px a second). Ours: 50 frames of 2000 px a second. */
export const MOST_GROUND_SPEED = 1e5;
/** How far `to` may sit off the floor's line, side on (px): half a pixel, a drawing's own rounding. */
export const OFF_LINE = 0.5;

const has = (intent, key, who) => stored(intent, key, `${who}'s ${key}`) !== undefined;

/** One of `names`, or `usual` when left out. */
export function readWord(intent, key, who, names, usual) {
  const v = stored(intent, key, `${who}'s ${key}`);
  if (v === undefined) return usual;
  if (!names.includes(v)) refuse(`${who}'s ${key} is ${names.map((n) => `'${n}'`).join(', ')} — not ${shown(v)}`);
  return v;
}

/** The way side on: +1 right, −1 left, from `to`, else speed's sign, else down the slope. */
function sideWay(intent, who, from, to, slope) {
  if (has(intent, 'heading', who)) refuse(`${who}: heading is for a floor seen from above (plane: 'floor') — side on, speed's sign is its way (+ right)`);
  const phi = (slope * Math.PI) / 180, tau = [Math.cos(phi), Math.sin(phi)];
  const signed = has(intent, 'speed', who) ? readNumber(intent, 'speed', who, { lo: -MOST_GROUND_SPEED, hi: MOST_GROUND_SPEED }) : undefined;
  let way, end = null;
  if (to) {
    const d = [to[0] - from[0], to[1] - from[1]], off = d[0] * tau[1] - d[1] * tau[0], along = d[0] * tau[0] + d[1] * tau[1];
    if (Math.abs(off) > OFF_LINE) refuse(`${who}'s to is ${round(Math.abs(off), 1)} px off its floor: side on it moves along the line through from${slope ? ` at ${slope}°` : ''} — put to's y at ${round(from[1] + d[0] * Math.tan(phi), 2)}`);
    if (along === 0) refuse(`${who}'s to is where it starts — move to along its floor`);
    way = Math.sign(along); end = Math.abs(along);
    if (signed && Math.sign(signed) !== way) refuse(`${who}'s speed ${signed} sends it ${signed > 0 ? 'right' : 'left'}, and to is to its ${way > 0 ? 'right' : 'left'} — drop speed, or flip its sign`);
  } else way = signed ? Math.sign(signed) : Math.sign(slope) || 1;
  return { u: [way * tau[0], way * tau[1]], turnSign: way, end, speed: signed === undefined ? undefined : Math.abs(signed), cos: tau[0] };
}

/** The way on a floor seen from above: toward `to`, or along `heading` with a speed. */
function floorWay(intent, who, from, to) {
  if (has(intent, 'slope', who)) refuse(`${who}: a floor seen from above is level — a slope is drawn side on (plane: 'side'): drop slope`);
  const speed = has(intent, 'speed', who) ? readNumber(intent, 'speed', who, { lo: 0, hi: MOST_GROUND_SPEED }) : undefined;
  if (to) {
    if (has(intent, 'heading', who)) refuse(`${who}: on the floor it goes toward to or along heading, not both — drop one`);
    const d = [to[0] - from[0], to[1] - from[1]], length = Math.hypot(d[0], d[1]);
    if (length === 0) refuse(`${who}'s to is where it starts — move to`);
    return { u: [d[0] / length, d[1] / length], end: length, speed };
  }
  if (speed === undefined || !has(intent, 'heading', who)) refuse(`${who}: on the floor it goes toward to, or from a speed along a heading (degrees, 0 along +x) — give to, or speed and heading`);
  const h = (readNumber(intent, 'heading', who, { lo: -360, hi: 360 }) * Math.PI) / 180;
  return { u: [Math.cos(h), Math.sin(h)], end: null, speed };
}

/** The line a roll or a slide runs along, read from the intent: where, which way, its push from gravity, what is in the way. */
export function readGround(intent, who, { gravity, radius }) {
  const from = readPoint(stored(intent, 'from', `${who}'s from`), `${who}'s from`);
  const to = has(intent, 'to', who) ? readPoint(stored(intent, 'to', `${who}'s to`), `${who}'s to`) : null;
  const plane = readWord(intent, 'plane', who, GROUND_PLANES, 'side');
  const slope = plane === 'side' ? readNumber(intent, 'slope', who, { lo: -MOST_SLOPE, hi: MOST_SLOPE, usual: 0 }) : 0;
  let way;
  if (plane === 'side') {
    const w = sideWay(intent, who, from, to, slope);
    // y down: gravity is (0, g); its share along the way, and pressing into the floor
    way = { ...w, along: gravity * w.u[1], normal: gravity * w.cos, heading: null };
  } else {
    const w = floorWay(intent, who, from, to);
    way = { ...w, turnSign: 1, along: 0, normal: gravity, heading: Math.atan2(w.u[1], w.u[0]) };
  }
  // side on and level, the floor is the line `radius` below from: a box must stand on it, and the contact critic reads it
  const world = readWorld({ floor: plane === 'side' && slope === 0 ? from[1] + radius : null, boxes: stored(intent, 'boxes', `${who}'s boxes`) }, who);
  const ahead = touchAlong(from, way.u, world, radius), behind = touchAlong(from, [-way.u[0], -way.u[1]], world, radius);
  if (ahead.inside !== null) refuse(`${who} starts inside its boxes[${ahead.inside}] — move from out of it`);
  return Object.freeze({ plane, from, u: way.u, turnSign: way.turnSign, slope, heading: way.heading, to, end: way.end, speed: way.speed, along: way.along, normal: way.normal, world, ahead, behind });
}

/** The glide along the line under `push` ({along, resist, hold}), its start speed picked when `to` asks for it. */
export function planGround(line, push, who, more) {
  const forward = push.along - push.resist, { end, ahead } = line;
  if (end !== null && ahead.box !== null && ahead.distance < end) refuse(`${who}: its boxes[${ahead.box}] stands between from and to — it would stop there, ${round(ahead.distance, 1)} px along: move to before it, or the box`);
  let speed = line.speed, defaulted = false;
  if (speed === undefined && end !== null) {
    defaulted = true;
    if (forward < 0) speed = restSpeed(end, -forward);
    else if (push.along > push.hold) speed = 0;
    else refuse(`${who}: on this slope it neither slows down nor starts by itself — give it a push: speed`);
  }
  const g = glide({ speed: speed ?? 0, ...push, ahead: ahead.distance, behind: line.behind.distance, end, most: MOST_PHYSICS_SECONDS });
  if (g.seconds === 0) refuse(g.endedBy === 'box' ? `${who} starts against a box and moves into it — move from, or send it the other way` : `${who}: nothing moves it — give speed, to (where it comes to rest), or a slope`);
  if (end !== null && g.endedBy !== 'end') {
    const furthest = forward < 0 ? ((speed ?? 0) ** 2) / (-2 * forward) : null;
    refuse(`${who}: from ${round(speed ?? 0, 1)} px a second it stops ${furthest === null ? 'before' : `${round(furthest, 1)} px along,`} short of to (${round(end, 1)} px away) — drop speed (the law picks it)${forward < 0 ? `, or speed: ${Math.ceil(restSpeed(end, -forward))}` : ''}`);
  }
  if (g.endedBy === 'time') refuse(`${who}: it would still be moving after ${MOST_PHYSICS_SECONDS} s — ${more}`);
  return { glide: g, speed: speed ?? 0, defaulted };
}

/** Where a planned ground move is at t: {x, y} on its line, `to` exactly when it ended there, and q, v along it. */
export function groundAt(p, t) {
  const { q, v } = glideAt(p.glide, t);
  if (t >= p.seconds && p.glide.endedBy === 'end') return { x: p.to[0], y: p.to[1], q, v };
  return { x: p.from[0] + q * p.u[0], y: p.from[1] + q * p.u[1], q, v };
}

/** The box that stopped a glide (its index), or null. */
export const stoppedBy = (line, g) => (g.endedBy !== 'box' ? null : g.q > 0 ? line.ahead.box : line.behind.box);

/** Words for the floor, the way it runs. */
export function floorWords(line) {
  if (line.plane === 'floor') return 'on the floor (seen from above)';
  if (!line.slope) return 'on a level floor';
  return `on a floor sloping ${round(Math.abs(line.slope), 1)}° ${line.along > 0 ? 'down' : 'up'} the way it starts`;
}

/** Words for how it ended. */
export function endWords(line, g) {
  const s = round(g.seconds);
  if (g.endedBy === 'rest') return `to rest after ${s} s`;
  if (g.endedBy === 'box') return `until its boxes[${stoppedBy(line, g)}] stops it dead after ${s} s (it hit at ${round(g.hitSpeed, 0)} px a second)`;
  return g.v ? `reaching to after ${s} s, still at ${round(Math.abs(g.v), 0)} px a second` : `to rest at to after ${s} s`;
}
