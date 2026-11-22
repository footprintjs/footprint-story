/**
 * `bounce` (families `throw` and `fall`): a flight that lands and bounces, lower each time, to rest on the floor
 * (physics/bounce.js), in closed form.
 *
 *   throw intent  as ballistic's throw; it lands on the floor at `to` (the floor `radius` below to's centre)
 *   fall intent   as ballistic's fall
 *   options       gravity; restitution (0 to 1, 0.5: the share of its speed a landing gives back); keep (0 to 1, 1:
 *                 the share of its speed across a landing keeps); squash (0 to 0.5, 0: how flat a landing presses it)
 *   sample        { x, y }, and with a squash { sx, sy }: sx · sy = 1 (its area kept), scaled about its foot
 *   basis         { restitution, keep, squash, bounces, landed, gravity, seconds, firstSeconds, stoppedBy, nextHeight }:
 *                 stoppedBy 'low' (at rest), 'count' (MOST_BOUNCES drawn) or 'time' (the longest physics plan), and the
 *                 height the next bounce would have reached (0 at rest)
 *
 * WHY restitution is at most 1: a floor gives back at most what it was given, so a bounce never gains energy. With a
 * squash the plan runs on SQUASH_SECONDS past the last landing, so its end is the body at rest and unsquashed.
 */
import { refuse, stored } from '../read.js';
import { bounceAt, bounces, MOST_BOUNCES } from '../physics/bounce.js';
import { MOST_PHYSICS_SECONDS } from '../physics/step.js';
import { readWorld } from '../physics/collide.js';
import { readFall, readGravity, readThrow } from './ballistic.js';
import { optionNumber, round } from './options.js';

/** How the reason ends, by what stopped the bounces: at rest only when it truly is. */
const STOPPED = {
  low: (floor, s) => `at rest on the floor at y ${floor} after ${s} s`,
  count: (floor, s, h) => `stopped on the floor at y ${floor} after ${s} s by the most bounces drawn (${MOST_BOUNCES}), its next bounce ${h} px high — lower restitution to let it come to rest`,
  time: (floor, s, h) => `stopped on the floor at y ${floor} after ${s} s by the longest physics plan (${MOST_PHYSICS_SECONDS} s), its next bounce ${h} px high — lower restitution or a nearer floor`,
};

/** A landing squashes the body for SQUASH_SECONDS either side of it. */
export const SQUASH_SECONDS = 0.06;

function readBounce(options) {
  const r = stored(options, 'restitution', 'model "bounce"\'s restitution');
  if (typeof r === 'number' && r > 1) refuse(`model "bounce"'s restitution is the share of its speed a landing gives back, at most 1 — above 1 the energy would grow; not ${r}`);
  return {
    restitution: optionNumber(options, 'restitution', 'bounce', 0, 1, 0.5),
    keep: optionNumber(options, 'keep', 'bounce', 0, 1, 1),
    squash: optionNumber(options, 'squash', 'bounce', 0, 0.5, 0),
  };
}

function plan(intent, { who, options }) {
  const gravity = readGravity(options, 'bounce'), b = readBounce(options);
  let flight, land, first, world;
  if (intent.do === 'fall') {
    const f = readFall(intent, who, gravity);
    flight = { from: f.from, velocity: f.velocity, radius: f.radius }; land = f.land; first = f.seconds; world = f.world;
  } else {
    // the floor is where it lands: `to` is the body's centre, the floor `radius` below it
    const to = stored(intent, 'to', `${who}'s to`), radius = stored(intent, 'radius', `${who}'s radius`) ?? 0;
    const floor = Array.isArray(to) && typeof to[1] === 'number' && typeof radius === 'number' ? to[1] + radius : null;
    const written = stored(intent, 'floor', `${who}'s floor`);
    if (written !== undefined && written !== null && written !== floor) refuse(`${who}: a bouncing throw lands on the floor at to (y ${floor}) — drop floor, or set to's y to ${written - radius}`);
    const r = readThrow(intent, who, gravity, { world: floor === null ? null : readWorld({ floor, boxes: stored(intent, 'boxes', `${who}'s boxes`) }, who) });
    if (r.from[1] > r.to[1]) refuse(`${who}: a bouncing throw starts at y ${r.from[1]}, below the floor it lands on (to's y ${r.to[1]}) — start it above the floor`);
    flight = { from: r.from, velocity: r.velocity, radius: r.radius }; land = r.to[1]; first = r.seconds; world = r.world;
  }
  const made = bounces(flight.from, flight.velocity, { floor: land, gravity, restitution: b.restitution, keep: b.keep, firstSeconds: first });
  const seconds = made.duration + (b.squash ? SQUASH_SECONDS : 0), count = made.segments.length - 1;
  return {
    seconds, landed: made.duration, gravity, segments: made.segments, impacts: made.impacts, rest: made.rest, squash: b.squash, world, radius: flight.radius, pushes: 1,
    basis: { restitution: b.restitution, keep: b.keep, squash: b.squash, bounces: count, landed: made.duration, gravity, seconds, firstSeconds: first, stoppedBy: made.stoppedBy, nextHeight: made.nextHeight },
    why: `a ${intent.do} landing after ${round(first)} s, then ${count} bounce${count === 1 ? '' : 's'} (each giving back ${round(b.restitution * 100, 0)}% of its speed), ${STOPPED[made.stoppedBy](round(land + flight.radius, 1), round(made.duration), round(made.nextHeight, 0))}${b.squash ? `, squashed ${round(b.squash * 100, 0)}% at the first landing, its area kept` : ''}`,
  };
}

/** A bounce at t: its place, and when it squashes, {sx, sy} with sx · sy = 1. */
function sample(p, t) {
  const u = t > 0 ? Math.min(t, p.seconds) : 0, [x, y] = bounceAt(p, u);
  if (!p.squash) return { x, y };
  if (u >= p.seconds) return { x, y, sx: 1, sy: 1 };
  const first = p.impacts[0].speed;
  let press = 0;
  for (const hit of p.impacts) {
    const away = Math.abs(u - hit.at);
    if (away < SQUASH_SECONDS && first > 0) press = Math.max(press, p.squash * (hit.speed / first) * (1 - away / SQUASH_SECONDS));
  }
  const sy = 1 - press;
  return { x, y, sx: 1 / sy, sy };
}

export const bounceModel = Object.freeze({
  family: Object.freeze(['throw', 'fall']),
  name: 'bounce',
  options: Object.freeze(['gravity', 'restitution', 'keep', 'squash']),
  check(options) { readGravity(options, 'bounce'); readBounce(options); },
  plan,
  sample,
  checks: Object.freeze(['spacing', 'contact', 'volume']),
});
