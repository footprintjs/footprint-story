/**
 * A bounce on a floor, in closed form: a flight, then each landing sends it up again at `restitution` of the speed it
 * came down with (and `keep` of its speed across), until a bounce would be under MIN_BOUNCE px high; then it rests.
 *
 *   bounces([x, y], [vx, vy], { floor, gravity, restitution, keep, firstSeconds })
 *     → { segments: [{ at, seconds, from, velocity }], impacts: [{ at, speed }], rest: [x, floor], duration }
 *   bounceAt(plan, t)   → [x, y]; `plan.landed` is when it lands for the last time (bounces' duration)
 *
 * WHY restitution is at most 1: a floor gives back at most what it was given. Below 1 every bounce is lower than the
 * one before, so the energy never grows (a test checks it bounce by bounce); 1 keeps it, and the count caps it.
 * WHY the rest is exact: each landing is written at the floor's y, not summed from a formula, so the last frame is
 * the rest point to the bit and a wrapper keeps it.
 */
import { flightAt, fallSeconds } from './flight.js';
import { MOST_SECONDS } from './read.js';

/** A bounce lower than this (px) is not drawn: it rests. At most MOST_BOUNCES bounces. */
export const MIN_BOUNCE = 1;
export const MOST_BOUNCES = 24;

/**
 * The flights of a body from `from` at `velocity` down to `floor`, and its bounces. `firstSeconds` is the first
 * flight's time when the caller already knows it (a throw aimed at a point on the floor).
 */
export function bounces(from, velocity, { floor, gravity: g, restitution: e, keep, firstSeconds = null }) {
  const segments = [], impacts = [];
  let at = 0, start = [from[0], from[1]], v = [velocity[0], velocity[1]];
  let seconds = firstSeconds ?? fallSeconds(start[1], v[1], floor, g);
  for (;;) {
    segments.push(Object.freeze({ at, seconds, from: Object.freeze(start), velocity: Object.freeze(v) }));
    const land = [start[0] + v[0] * seconds, floor], down = v[1] + g * seconds;
    at += seconds;
    impacts.push(Object.freeze({ at, speed: Math.hypot(v[0], down) }));
    const up = e * down, next = (2 * up) / g;
    // a bounce lower than MIN_BOUNCE, past the count, or past the longest plan: it rests where it landed
    if ((up * up) / (2 * g) < MIN_BOUNCE || segments.length >= MOST_BOUNCES + 1 || at + next > MOST_SECONDS) {
      return Object.freeze({ segments: Object.freeze(segments), impacts: Object.freeze(impacts), rest: Object.freeze(land), duration: at });
    }
    start = land; v = [v[0] * keep, -up]; seconds = next;
  }
}

/** Where the body is at `t`: on the flight that holds t, or at rest after the last. */
export function bounceAt(plan, t) {
  if (!(t > 0)) return [plan.segments[0].from[0], plan.segments[0].from[1]];
  if (t >= plan.landed) return [plan.rest[0], plan.rest[1]];
  let k = plan.segments.length - 1;
  while (k > 0 && plan.segments[k].at > t) k -= 1;
  const s = plan.segments[k];
  return flightAt(s.from, s.velocity, plan.gravity, t - s.at);
}
