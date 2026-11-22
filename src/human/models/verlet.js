/**
 * `verlet` (family `hang`): a rope or a chain pinned at `from`, swinging under gravity until it settles
 * (physics/chain.js: position Verlet and relaxation, Jakobsen 2001), its frames kept at 60 a second.
 *
 *   intent  { do: 'hang', from: [x, y] (the pin), to?: [x, y] (where its free end starts), length?: px,
 *             path?: [[t, x, y], …] (the pin's moves after from), seconds?, floor?, boxes? }
 *   options gravity; links (1 to 64, 8; each at least MIN_CHAIN_LINK px); damping (0 to 0.99, 0.7: the share of speed lost
 *           each second); jitter (0 to 100 px, 0: each free point nudged off the straight line by the seeded random)
 *   sample  { x, y, angle, points }: the free end, the heading of its last link, every point (the pin first)
 *   basis   { length, links, linkLength, damping, jitter, gravity, seconds, secondsGiven, settled, swing, passes }
 *
 * WHY its time is how long it swings: with no seconds it runs until every point has stayed slower than CHAIN_REST_SPEED for
 * half a swing (π√(L/g)) after the pin's last move, at most MOST_CHAIN_SECONDS — never a number somebody guessed.
 */
import { readPoint, readNumber, refuse, shown, stored } from '../read.js';
import { MIN_CHAIN_PASSES, MIN_CHAIN_LINK, runChain } from '../physics/chain.js';
import { readWorld } from '../physics/collide.js';
import { STEPS_PER_FRAME, PHYSICS_STEP } from '../physics/step.js';
import { readGravity } from './ballistic.js';
import { intentKeys, optionNumber, readSeconds, round } from './options.js';

/** The most links of a chain, its longest swing (s), and the most keys a pin's path holds. */
export const MOST_CHAIN_LINKS = 64;
export const MOST_CHAIN_SECONDS = 10;
export const MOST_PATH_KEYS = 64;

function readHang(options) {
  const links = optionNumber(options, 'links', 'verlet', 1, MOST_CHAIN_LINKS, 8);
  if (!Number.isInteger(links)) refuse(`model "verlet"'s links is a whole number from 1 to ${MOST_CHAIN_LINKS} — not ${links}`);
  return { links, damping: optionNumber(options, 'damping', 'verlet', 0, 0.99, 0.7), jitter: optionNumber(options, 'jitter', 'verlet', 0, 100, 0) };
}

/** The pin's path: [t, x, y] keys, each t above the one before (the first above 0), at most MOST_CHAIN_SECONDS. */
function readPath(intent, who) {
  const raw = stored(intent, 'path', `${who}'s path`) ?? [];
  if (!Array.isArray(raw) || raw.length > MOST_PATH_KEYS) refuse(`${who}'s path is a list of at most ${MOST_PATH_KEYS} keys [t, x, y] — not ${shown(raw)}`);
  let last = 0;
  return Array.from({ length: raw.length }, (_, i) => {
    const key = `${who}'s path[${i}]`, k = Object.hasOwn(raw, i) ? stored(raw, i, key) : undefined;
    const v = Array.isArray(k) && k.length === 3 ? [0, 1, 2].map((j) => (Object.hasOwn(k, j) ? stored(k, j, `${key}[${j}]`) : undefined)) : null;
    if (!v) refuse(`${key} is a key [t, x, y]: when (s) and where the pin is — not ${shown(k)}`);
    const t = readNumber({ t: v[0] }, 't', key, { lo: last, hi: MOST_CHAIN_SECONDS, above: true });
    last = t;
    return [t, ...readPoint([v[1], v[2]], `${key}'s place`)];
  });
}

function plan(intent, { who, options, random }) {
  intentKeys(intent, ['from', 'to', 'length', 'path', 'seconds', 'floor', 'boxes'], who);
  const gravity = readGravity(options, 'verlet'), { links, damping, jitter } = readHang(options);
  const from = readPoint(stored(intent, 'from', `${who}'s from`), `${who}'s from`);
  const rawTo = stored(intent, 'to', `${who}'s to`), to = rawTo === undefined ? null : readPoint(rawTo, `${who}'s to`);
  const span = to ? Math.hypot(to[0] - from[0], to[1] - from[1]) : 0;
  if (!to && stored(intent, 'length', `${who}'s length`) === undefined) refuse(`${who}: a hang needs its length (px) or to (where its free end starts)`);
  const length = readNumber(intent, 'length', who, { lo: 0, usual: span });
  if (!(length > 0)) refuse(`${who}'s hang has no length — to is the pin itself: give length, or a to away from from`);
  // a length measured from two points may come out a hair under a whole number of links: a billionth is slack
  const most = Math.max(1, Math.floor((length * (1 + 1e-9)) / MIN_CHAIN_LINK));
  if (links > most) refuse(`${who}: its ${links} links would each be ${(length / links).toFixed(2)} px — a link is at least ${MIN_CHAIN_LINK} px: model: {name: 'verlet', links: ${most}}, or a longer length`);
  const given = readSeconds(intent, who);
  if (given !== undefined && given > MOST_CHAIN_SECONDS) refuse(`${who}'s seconds is at most ${MOST_CHAIN_SECONDS} for a hang — not ${given}`);
  const path = readPath(intent, who), world = readWorld(intent, who);
  for (const b of world.boxes) if (from[0] > b.x && from[0] < b.x + b.w && from[1] > b.y && from[1] < b.y + b.h) refuse(`${who}'s pin (from) is inside a box — move from out of boxes`);
  if (world.floor !== null && from[1] > world.floor) refuse(`${who}'s pin (from) is below the floor — move from above y ${world.floor}`);
  // laid straight from the pin toward `to` (or straight down), each free point nudged by the seeded jitter
  const dir = to && span > 0 ? [(to[0] - from[0]) / span, (to[1] - from[1]) / span] : [0, 1], rest = length / links;
  const points = [from[0], from[1]];
  for (let i = 1; i <= links; i += 1) points.push(from[0] + dir[0] * rest * i + (jitter ? (random() * 2 - 1) * jitter : 0), from[1] + dir[1] * rest * i + (jitter ? (random() * 2 - 1) * jitter : 0));
  const steps = Math.ceil((given ?? MOST_CHAIN_SECONDS) / PHYSICS_STEP - 1e-9), cap = Math.ceil(steps / STEPS_PER_FRAME) * STEPS_PER_FRAME;
  const run = runChain({ pin: from, path, points, rest, gravity, keep: (1 - damping) ** PHYSICS_STEP, world, steps, settle: given === undefined });
  const seconds = run.steps * PHYSICS_STEP, settled = given === undefined && run.steps < cap, swing = Math.PI * Math.sqrt(length / gravity);
  return {
    seconds, frameSeconds: PHYSICS_STEP * STEPS_PER_FRAME, links, rest, frames: run.frames, world, radius: 0, pushes: 1,
    basis: { length, links, linkLength: rest, damping, jitter, gravity, seconds, secondsGiven: given !== undefined, settled, swing, passes: Math.max(MIN_CHAIN_PASSES, links) },
    why: `a chain of ${links} link${links === 1 ? '' : 's'}, ${round(length, 1)} px, pinned at its top${path.length ? ` and moved along ${path.length} key${path.length === 1 ? '' : 's'}` : ''}: ${given !== undefined ? `${round(seconds)} s (the seconds the intent gave)` : settled ? `swings for ${round(seconds)} s, until still for half a swing (${round(swing)} s)` : `still swinging at ${MOST_CHAIN_SECONDS} s, the most a chain runs`}`,
  };
}

/** A chain at t: every point (between the two kept frames), the free end as {x, y}, `angle` along the last link. */
function sample(p, t) {
  const u = t > 0 ? Math.min(t, p.seconds) : 0, last = p.frames.length - 1, f = u >= p.seconds ? last : u / p.frameSeconds;
  const i = Math.min(Math.floor(f), last), j = Math.min(i + 1, last), w = f - i, a = p.frames[i], b = p.frames[j];
  const points = [];
  for (let k = 0; k < a.length; k += 2) points.push(w === 0 ? [a[k], a[k + 1]] : [a[k] + (b[k] - a[k]) * w, a[k + 1] + (b[k + 1] - a[k + 1]) * w]);
  const end = points[points.length - 1], prev = points[points.length - 2];
  return { x: end[0], y: end[1], angle: Math.atan2(end[1] - prev[1], end[0] - prev[0]), points };
}

export const verletModel = Object.freeze({
  family: 'hang',
  name: 'verlet',
  options: Object.freeze(['gravity', 'links', 'damping', 'jitter']),
  check(options) { readGravity(options, 'verlet'); readHang(options); },
  plan,
  sample,
  checks: Object.freeze(['contact']),
});
