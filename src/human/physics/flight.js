/**
 * Ballistic flight in closed form (y down, px and seconds): a thing thrown moves steadily across and falls
 * faster and faster, x(t) = x₀ + vₓt, y(t) = y₀ + v_y t + ½gt².
 *
 *   launch([0, 500], [400, 500], { apex: 100 })      → { velocity: [vx, vy], seconds }: up 100 px above the higher end
 *   launch([0, 500], [400, 300], { seconds: 0.8 })   → the throw that lands there in 0.8 s
 *   flightAt([0, 500], [vx, vy], 1960, t)             → [x, y]
 *   fallSeconds(500, 0, 900, 1960)                    → the time to fall from y 500 to y 900, starting at v_y 0
 *
 * WHY closed form: any moment is drawn without drawing the ones before it, and a test can check it against the
 * textbook formula exactly. WHY the usual apex is a quarter of the distance across: for two ends at one height that
 * is a 45° launch, the angle that reaches furthest for a given speed — the throw a person makes without aiming high.
 */
import { refuse } from './read.js';

/** The usual apex: a quarter of the distance across (a 45° throw for level ends), at least MIN_APEX px. */
export const APEX_SHARE = 0.25;
export const MIN_APEX = 24;

/** Where a thing launched from `from` at `velocity` is after `t` seconds under gravity `g` (px/s², down). */
export function flightAt(from, velocity, g, t) {
  return [from[0] + velocity[0] * t, from[1] + velocity[1] * t + 0.5 * g * t * t];
}

/** The direction of travel at `t` (radians, y down): along the velocity. */
export const headingAt = (velocity, g, t) => Math.atan2(velocity[1] + g * t, velocity[0]);

/**
 * The launch from `from` that lands on `to`: with `apex` (px above the higher end, ≥ 0) or with `seconds` (> 0), not
 * both; neither gives the usual apex. Gives {velocity, seconds}.
 */
export function launch(from, to, { apex, seconds, gravity: g }, who = 'the entry') {
  if (apex !== undefined && seconds !== undefined) refuse(`${who}: its throw takes apex (how high) or seconds (how long), not both — drop one`);
  const dx = to[0] - from[0];
  if (seconds !== undefined) {
    // y₁ = y₀ + v_y T + ½gT²  ⇒  v_y = (y₁ − y₀ − ½gT²) / T
    return { velocity: [dx / seconds, (to[1] - from[1] - 0.5 * g * seconds * seconds) / seconds], seconds };
  }
  const high = Math.min(from[1], to[1]) - (apex ?? Math.max(MIN_APEX, APEX_SHARE * Math.abs(dx)));
  // up from the start to the apex (v_y = −√(2g·rise)), then down from it to the end (t = √(2·drop/g))
  const up = Math.sqrt(2 * (from[1] - high) / g), down = Math.sqrt(2 * (to[1] - high) / g), total = up + down;
  if (!(total > 0)) refuse(`${who}: its throw has no time in the air — apex 0 with both ends at one height would need an endless speed: give an apex above 0, or seconds`);
  return { velocity: [dx / total, -g * up], seconds: total };
}

/**
 * The time to fall from height y₀ to `floor` (y down) starting at vertical speed `vy`: the later root of
 * y₀ + v_y t + ½gt² = floor. Null when it never gets there (the floor is above it and it is not thrown up far enough).
 */
export function fallSeconds(y0, vy, floor, g) {
  const disc = vy * vy + 2 * g * (floor - y0);
  if (disc < 0) return null;
  const t = (-vy + Math.sqrt(disc)) / g;
  return t > 0 ? t : null;
}
