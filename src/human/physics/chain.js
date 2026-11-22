/**
 * A rope or a chain: points joined by links of a set length, the first point pinned, moved by position Verlet and
 * held to their lengths by relaxation (Jakobsen 2001, "Advanced Character Physics").
 *
 *   runChain({ pin, path, points, rest, gravity, keep, world, steps, settle })   → { frames, steps }
 *
 * Each step: every free point moves on its own velocity and gravity (step.js · verletStep); then, once per link and
 * at least MIN_CHAIN_PASSES times, each link is set back to its length — both ends move half the error, or the free end all of it when the other end
 * is the pin; then every free point is pushed out of the floor and the boxes (collide.js · collide).
 * WHY sub-steps: a strong gravity pulls a point far in one step and the passes cannot set it back (16 passes, 64 links,
 * 3e4 px/s²: 12% long); a step is cut so gravity moves a point at most MOST_STEP_SAG of a link in each (substepsFor).
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

/** How far gravity moves a point in one sub-step (g·dt²), as a share of a link, at most: past it a step is cut into
 *  sub-steps. WHY: the stretch a step leaves grows with how far gravity pulls a point against its link in that step.
 *  Measured (20 random chains of up to 64 links, 1.2 s, each gravity): at 0.01 the worst link was 5.7% long at 3e4 px/s²;
 *  at 0.005, 3.2% at worst from 1960 to 1e5 px/s²; at 0.003, 2.6% for half again the time. */
export const MOST_STEP_SAG = 0.005;
/** The most sub-steps one step is cut into. */
export const MOST_SUBSTEPS = 16;

/** The sub-steps a step is cut into, so gravity moves a point at most MOST_STEP_SAG of a link in each. */
export const substepsFor = (gravity, rest) => Math.min(MOST_SUBSTEPS, Math.max(1, Math.ceil(Math.sqrt((gravity * PHYSICS_STEP * PHYSICS_STEP) / rest / MOST_STEP_SAG))));

/** The longest any link is past its length, as a share of it (a link shorter than its length — slack — is not stretch). */
export function stretchOf(p, rest) {
  let most = 0;
  for (let i = 0; i + 2 < p.length; i += 2) most = Math.max(most, (Math.hypot(p[i + 2] - p[i], p[i + 3] - p[i + 1]) - rest) / rest);
  return most;
}

/**
 * Run a chain from its layout `points` (flat, the pin first) for at most `steps` steps. `keep` is the share of velocity
 * kept each step; `settle` ends it once settled (above), on a kept frame. Gives {frames, steps, substeps, stretch}:
 * `stretch` the longest any link was past its length after any step, as a share of it.
 * The layout is relaxed until every link is within a thousandth of its length (at most LAYOUT_ROUNDS rounds), so a
 * jittered chain starts as a chain: the jitter bends it, it never stretches it.
 */
export const LAYOUT_ROUNDS = 64;
export function runChain({ pin, path, points, rest, gravity, keep, world, steps, settle }) {
  const still = path.length ? path[path.length - 1][0] : 0, swing = Math.PI * Math.sqrt((rest * (points.length / 2 - 1)) / gravity);
  const passes = Math.max(MIN_CHAIN_PASSES, points.length / 2 - 1), n = substepsFor(gravity, rest), dt = PHYSICS_STEP / n, keepSub = keep ** (1 / n);
  const layout = [...points];
  for (let round = 0; round < LAYOUT_ROUNDS && Math.abs(stretchOf(layout, rest)) + slackOf(layout, rest) > 1e-3; round += 1) relaxChain(layout, rest, pin, passes);
  const first = collide(relaxChain(layout, rest, pin, passes), world);
  let stretch = stretchOf(first, rest);
  const slow = (now, before) => now.every((v, i) => i % 2 || Math.hypot(v - before[i], now[i + 1] - before[i + 1]) / dt < CHAIN_REST_SPEED);
  const advance = (state, step) => {
    let now = state.points, before = state.before, calm = state.calm;
    for (let k = 1; k <= n; k += 1) {
      const at = pinAt(pin, path, (step - 1) * PHYSICS_STEP + k * dt);
      const next = collide(relaxChain(verletStep(now, before, [0, gravity], dt, keepSub), rest, at, passes), world);
      calm = slow(next, now) ? calm + dt : 0;
      before = now; now = next;
    }
    stretch = Math.max(stretch, stretchOf(now, rest));
    return { points: now, before, calm };
  };
  // settled: the pin has made its last move and every point has been slow for half a swing
  const stop = settle ? (state, step) => step * PHYSICS_STEP > still && state.calm >= swing : null;
  const run = simulate({ points: first, before: first, calm: 0 }, advance, { steps, stop });
  return { frames: run.frames, steps: run.steps, substeps: n, stretch };
}

/** The most any link is short of its length, as a share of it. */
function slackOf(p, rest) {
  let most = 0;
  for (let i = 0; i + 2 < p.length; i += 2) most = Math.max(most, (rest - Math.hypot(p[i + 2] - p[i], p[i + 3] - p[i + 1])) / rest);
  return most;
}
