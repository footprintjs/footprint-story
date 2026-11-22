/**
 * A rope or a chain: points joined by links of a set length, the first point pinned, moved by position Verlet and
 * held to their lengths by relaxation (Jakobsen 2001, "Advanced Character Physics").
 *
 *   runChain({ pin, path, points, rest, gravity, keep, world, steps, settle })   → { frames, steps }
 *
 * Each step: every free point moves on its own velocity and gravity (step.js · verletStep); then, once per link and
 * at least MIN_CHAIN_PASSES times, each link is set back to its length — both ends move half the error, or the free end all of it when the other end
 * is the pin; then every free point is pushed out of the floor and the boxes (collide.js · collide).
 * WHY a pass per link: one pass carries a correction one link along the chain, so a long chain needs as many passes as
 * it has links (measured: 16 passes let a 64-link chain stretch 13%; a pass per link keeps every link within
 * CHAIN_LENGTH_TOLERANCE of its length at every frame, with no floor or box in the way).
 * WHY collisions last: after a step no point is inside anything (the tests check every step); a link pressed against
 * a box may be a little long for that step and is set back on the next.
 * WHY it stops when settled: a hanging thing's time is how long it swings, not a number somebody guessed — it ends
 * once every point has stayed slower than CHAIN_REST_SPEED for half a swing (half the period of a pendulum its length,
 * π√(L/g)), after the pin's last move. Half a swing, because at the top of each swing every point is still for a
 * moment: only a chain slow for a whole half swing has stopped swinging.
 */
import { collide } from './collide.js';
import { simulate, PHYSICS_STEP, verletStep } from './step.js';

/** The fewest relaxation passes per step; the speed (px/s) under which a chain counts as settled; how far a link may
 * stray from its length (a share of it) with nothing in the way; the shortest link (px: a shorter one cannot be seen). */
export const MIN_CHAIN_PASSES = 16;
export const CHAIN_REST_SPEED = 4;
export const CHAIN_LENGTH_TOLERANCE = 0.05;
export const MIN_CHAIN_LINK = 4;

/** Where the pin is at `t`: its start, then along its path of [t, x, y] keys, straight between them. */
export function pinAt(pin, path, t) {
  if (!path.length || t <= 0) return pin;
  let x0 = pin[0], y0 = pin[1], t0 = 0;
  for (const [tk, xk, yk] of path) {
    if (t <= tk) { const u = (t - t0) / (tk - t0); return [x0 + (xk - x0) * u, y0 + (yk - y0) * u]; }
    x0 = xk; y0 = yk; t0 = tk;
  }
  return [x0, y0];
}

/** Set every link back to `rest`, `passes` times, pin to tip; the first point is the pin and never moves. In place. */
export function relaxChain(p, rest, pin, passes = MIN_CHAIN_PASSES) {
  for (let pass = 0; pass < passes; pass += 1) {
    p[0] = pin[0]; p[1] = pin[1];
    for (let i = 0; i + 2 < p.length; i += 2) {
      const dx = p[i + 2] - p[i], dy = p[i + 3] - p[i + 1], d = Math.hypot(dx, dy);
      if (d === 0) continue;
      const err = (d - rest) / d, share = i === 0 ? 1 : 0.5;
      if (i !== 0) { p[i] += dx * err * share; p[i + 1] += dy * err * share; }
      p[i + 2] -= dx * err * share; p[i + 3] -= dy * err * share;
    }
  }
  return p;
}

/**
 * Run a chain from its first frame `points` (flat, the pin first) for at most `steps` steps. `keep` is the share of
 * velocity kept each step; `settle` ends it once settled (above), on a kept frame.
 */
export function runChain({ pin, path, points, rest, gravity, keep, world, steps, settle }) {
  const still = path.length ? path[path.length - 1][0] : 0, swing = Math.PI * Math.sqrt((rest * (points.length / 2 - 1)) / gravity);
  const passes = Math.max(MIN_CHAIN_PASSES, points.length / 2 - 1), first = collide(relaxChain([...points], rest, pin, passes), world);
  const slow = (now, before) => now.every((v, i) => i % 2 || Math.hypot(v - before[i], now[i + 1] - before[i + 1]) / PHYSICS_STEP < CHAIN_REST_SPEED);
  const advance = (state, n) => {
    const at = pinAt(pin, path, n * PHYSICS_STEP);
    const next = collide(relaxChain(verletStep(state.points, state.before, [0, gravity], PHYSICS_STEP, keep), rest, at, passes), world);
    return { points: next, before: state.points, calm: slow(next, state.points) ? state.calm + PHYSICS_STEP : 0 };
  };
  // settled: the pin has made its last move and every point has been slow for half a swing
  const stop = settle ? (state, n) => n * PHYSICS_STEP > still && state.calm >= swing : null;
  return simulate({ points: first, before: first, calm: 0 }, advance, { steps, stop });
}
