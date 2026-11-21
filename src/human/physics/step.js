/**
 * The fixed step: every simulation here moves in steps of STEP seconds, counted, never timed by a clock.
 *
 *   verletStep(now, before, [0, GRAVITY], STEP, keep)   → the next positions, flat [x0, y0, x1, y1, …]
 *   simulate(start, advance, { steps, every })           → frames: a frozen flat list of positions every `every` steps
 *
 * WHY a fixed step: the same input gives the same frames on any machine at any frame rate, so a deck and a film agree
 * and a plan can be kept in a record. A frame is read between two kept frames (models.js · verlet), never re-run.
 * WHY position Verlet (x' = 2x − x₋ + a·dt²): it is exact for a constant force (a parabola has no third derivative),
 * keeps no velocity to drift, and lets a constraint move a point directly (Jakobsen 2001).
 */

/** The step (s): 240 a second, four steps to each frame kept at 60 a second. */
export const STEP = 1 / 240;
export const EVERY = 4;
/** Gravity on the frame (px/s², y down): 9.8 m/s² at 200 px to the metre. */
export const GRAVITY = 1960;

/**
 * One position-Verlet step for every point, flat [x, y, …]. `keep` is the share of each point's velocity kept over the
 * step (1: none lost). A new list; the inputs are not touched.
 */
export function verletStep(now, before, accel, dt, keep = 1) {
  const next = new Array(now.length), dt2 = dt * dt;
  for (let i = 0; i < now.length; i += 2) {
    next[i] = now[i] + (now[i] - before[i]) * keep + accel[0] * dt2;
    next[i + 1] = now[i + 1] + (now[i + 1] - before[i + 1]) * keep + accel[1] * dt2;
  }
  return next;
}

/**
 * Run `advance(state, n) → state` for `steps` steps (n counts from 1; rounded up to a whole number of frames, so
 * kept frames are evenly spaced) and keep `state.points` every `every` steps, the start included. `stop(state, n)`
 * may end the run early, on a kept frame. Gives {frames, steps}: frames frozen.
 */
export function simulate(start, advance, { steps, every = EVERY, stop = null }) {
  const frames = [Object.freeze([...start.points])], total = Math.ceil(steps / every) * every;
  let state = start, n = 0;
  while (n < total) {
    n += 1;
    state = advance(state, n);
    if (n % every === 0) {
      frames.push(Object.freeze([...state.points]));
      if (stop && stop(state, n)) break;
    }
  }
  return { frames: Object.freeze(frames), steps: n };
}
