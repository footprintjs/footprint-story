/**
 * The physics models, one interface (docs/design/2026-11-human-motion.md · "A model"):
 *
 *   { family, name, options, check(options), plan(intent, context) → plan, sample(plan, t) → { x, y, … }, checks }
 *
 *   throw · ballistic   from → to through the air, with an apex or a time; ends on `to`
 *   throw · bounce      the same throw, landing on the floor at `to`, then bouncing to rest
 *   fall  · ballistic   from rest (or a start velocity) down to the floor; ends where it lands
 *   fall  · bounce      the same fall, then bouncing to rest; `squash` flattens it at each landing (its area kept)
 *   hang  · verlet      a rope or chain pinned at `from`, swinging under gravity until it settles; the pin may move
 *
 * A plan is plain frozen data: `{model, family, who, duration, …the numbers sample() needs, world: {floor, boxes},
 * radius}`. `world` and `radius` are what the contact critic checks the track against (critics.js · contact).
 * `sample` is pure: the same plan and t give the same answer; t is clamped to [0, duration] and both ends are exact.
 * WHY the intent's keys are checked by name: a misspelt key ("apx") would be silently ignored; it is refused instead,
 * naming the keys the model takes.
 */
import { bounceAt, bounces } from './bounce.js';
import { MIN_LINK, runChain } from './chain.js';
import { readWorld } from './collide.js';
import { fallSeconds, flightAt, headingAt, launch } from './flight.js';
import { finite, frozen, list, MOST_SECONDS, num, point, readContext, readKeys, refuse, shown } from './read.js';
import { EVERY, GRAVITY, STEP } from './step.js';

/** A landing squashes the body for SQUASH_SECONDS either side of it. The most links of a chain, and its longest swing. */
export const SQUASH_SECONDS = 0.06;
export const MOST_LINKS = 64;
export const MOST_CHAIN_SECONDS = 10;
const MOST_PATH = 64;

const clampT = (plan, t) => (t > 0 ? Math.min(t, plan.duration) : 0);

/** The keys every model shares, read: gravity, the world, the body's radius. */
function common(get, who) {
  return { gravity: num(get('gravity'), { who, key: 'gravity', lo: 0, open: 'lo', fallback: GRAVITY, unit: ' px/s²' }), world: readWorld(get, who), radius: num(get('radius'), { who, key: 'radius', lo: 0, fallback: 0, unit: ' px' }) };
}

function readDo(get, family, who) {
  const d = get('do');
  if (d !== undefined && d !== family) refuse(`${who}: the ${family} models take do: '${family}' — not ${shown(d)}`);
}

/* ------------------------------------------------------------------------------------------------- ballistic */

const THROW_KEYS = ['do', 'from', 'to', 'apex', 'seconds', 'gravity', 'floor', 'boxes', 'radius'];

function readThrow(intent, who) {
  const get = readKeys(intent, THROW_KEYS, who, 'its throw');
  readDo(get, 'throw', who);
  const c = common(get, who);
  const from = point(get('from'), who, 'from'), to = point(get('to'), who, 'to');
  const apex = get('apex') === undefined ? undefined : num(get('apex'), { who, key: 'apex', lo: 0, unit: ' px above the higher end' });
  const seconds = get('seconds') === undefined ? undefined : num(get('seconds'), { who, key: 'seconds', lo: 0, hi: MOST_SECONDS, open: 'lo' });
  const { velocity, seconds: total } = launch(from, to, { apex, seconds, gravity: c.gravity }, who);
  if (!(finite(velocity[0]) && finite(velocity[1]) && total <= MOST_SECONDS)) refuse(`${who}: its throw would take ${total.toFixed(2)} s — at most ${MOST_SECONDS} s: a lower apex, or seconds`);
  return { ...c, from, to, velocity, duration: total };
}

function planThrow(intent, context) {
  const { who } = readContext(context), r = readThrow(intent, who);
  return frozen({ model: 'ballistic', family: 'throw', who, duration: r.duration, from: r.from, to: r.to, velocity: r.velocity, gravity: r.gravity, world: r.world, radius: r.radius });
}

/** Ballistic at t: on its flight, `to` exactly at the end; `angle` is the direction of travel. */
function sampleBallistic(plan, t) {
  const u = clampT(plan, t), angle = headingAt(plan.velocity, plan.gravity, u);
  const [x, y] = u >= plan.duration ? plan.to : u <= 0 ? plan.from : flightAt(plan.from, plan.velocity, plan.gravity, u);
  return Object.freeze({ x, y, angle });
}

const FALL_KEYS = ['do', 'from', 'floor', 'velocity', 'gravity', 'boxes', 'radius'];

function readFall(intent, who, keys) {
  const get = readKeys(intent, keys, who, 'its fall');
  readDo(get, 'fall', who);
  if (get('floor') === undefined || get('floor') === null) refuse(`${who}: its fall needs the floor it lands on: floor: <y in px>`);
  const c = common(get, who), from = point(get('from'), who, 'from');
  const velocity = get('velocity') === undefined ? Object.freeze([0, 0]) : point(get('velocity'), who, 'velocity');
  const land = c.world.floor - c.radius;   // the centre of a body of `radius` rests that far above the floor
  const seconds = fallSeconds(from[1], velocity[1], land, c.gravity);
  if (seconds === null || from[1] > land) refuse(`${who}: its fall starts at y ${from[1]}, which is not above the floor it lands on (y ${land}) — move from above the floor, or the floor below it`);
  if (seconds > MOST_SECONDS) refuse(`${who}: its fall would take ${seconds.toFixed(2)} s — at most ${MOST_SECONDS} s: a nearer floor`);
  return { ...c, get, from, velocity, land, seconds };
}

function planFall(intent, context) {
  const { who } = readContext(context), r = readFall(intent, who, FALL_KEYS);
  const to = Object.freeze([r.from[0] + r.velocity[0] * r.seconds, r.land]);
  return frozen({ model: 'ballistic', family: 'fall', who, duration: r.seconds, from: r.from, to, velocity: r.velocity, gravity: r.gravity, world: r.world, radius: r.radius });
}

/* ------------------------------------------------------------------------------------------------- bounce */

function readBounce(get, who) {
  return {
    restitution: num(get('restitution'), { who, key: 'restitution', lo: 0, hi: 1, fallback: 0.5, unit: ' (the share of speed a landing gives back: above 1 the energy would grow)' }),
    keep: num(get('keep'), { who, key: 'keep', lo: 0, hi: 1, fallback: 1, unit: ' (the share of speed across a landing keeps)' }),
    squash: num(get('squash'), { who, key: 'squash', lo: 0, hi: 0.5, fallback: 0, unit: ' (how flat a landing presses it)' }),
  };
}

function bouncePlan(family, who, r, b, from, velocity, firstSeconds) {
  const made = bounces(from, velocity, { floor: r.land, gravity: r.gravity, restitution: b.restitution, keep: b.keep, firstSeconds });
  // with a squash, the plan runs on until the last landing's squash has sprung back, so its end is the body at rest
  return frozen({ model: 'bounce', family, who, duration: made.duration + (b.squash ? SQUASH_SECONDS : 0), landed: made.duration, gravity: r.gravity, segments: made.segments, impacts: made.impacts, rest: made.rest, squash: b.squash, world: r.world, radius: r.radius });
}

function planBounceFall(intent, context) {
  const { who } = readContext(context), r = readFall(intent, who, [...FALL_KEYS, 'restitution', 'keep', 'squash']);
  return bouncePlan('fall', who, r, readBounce(r.get, who), r.from, r.velocity, r.seconds);
}

function planBounceThrow(intent, context) {
  const { who } = readContext(context);
  const get = readKeys(intent, [...THROW_KEYS, 'restitution', 'keep', 'squash'], who, 'its throw');
  const b = readBounce(get, who);
  const bare = Object.fromEntries(THROW_KEYS.filter((k) => get(k) !== undefined && k !== 'floor').map((k) => [k, get(k)]));
  const r = readThrow(bare, who);
  if (r.from[1] > r.to[1]) refuse(`${who}: a bouncing throw starts at y ${r.from[1]}, below the floor it lands on (to's y ${r.to[1]}) — start it above the floor`);
  // the floor is where it lands: `to` is the body's centre, the floor `radius` below it
  const floor = r.to[1] + r.radius;
  if (get('floor') !== undefined && get('floor') !== floor) refuse(`${who}: a bouncing throw lands on the floor at to (y ${floor}) — drop floor, or set to's y to ${get('floor') - r.radius}`);
  const world = readWorld((k) => (k === 'floor' ? floor : get(k)), who);
  return bouncePlan('throw', who, { ...r, world, land: r.to[1] }, b, r.from, r.velocity, r.duration);
}

/** A bounce at t: its place, and when it squashes, {sx, sy} with sx · sy = 1 (the area kept), scaled about its foot. */
function sampleBounce(plan, t) {
  const u = clampT(plan, t), [x, y] = bounceAt(plan, u);
  if (!plan.squash) return Object.freeze({ x, y });
  if (u >= plan.duration) return Object.freeze({ x, y, sx: 1, sy: 1 });
  const first = plan.impacts[0].speed;
  let press = 0;
  for (const hit of plan.impacts) {
    const away = Math.abs(u - hit.at);
    if (away < SQUASH_SECONDS && first > 0) press = Math.max(press, plan.squash * (hit.speed / first) * (1 - away / SQUASH_SECONDS));
  }
  const sy = 1 - press;
  return Object.freeze({ x, y, sx: 1 / sy, sy });
}

/* ------------------------------------------------------------------------------------------------- verlet */

const HANG_KEYS = ['do', 'from', 'to', 'length', 'links', 'path', 'seconds', 'gravity', 'damping', 'jitter', 'floor', 'boxes'];

function planHang(intent, context) {
  const { who, random } = readContext(context);
  const get = readKeys(intent, HANG_KEYS, who, 'its hang');
  readDo(get, 'hang', who);
  const c = common((k) => (k === 'radius' ? undefined : get(k)), who);
  const from = point(get('from'), who, 'from');
  const to = get('to') === undefined ? null : point(get('to'), who, 'to');
  const span = to ? Math.hypot(to[0] - from[0], to[1] - from[1]) : 0;
  if (!to && get('length') === undefined) refuse(`${who}: a hang needs its length (px) or to (where its free end starts)`);
  const length = num(get('length'), { who, key: 'length', lo: 0, open: 'lo', fallback: span, unit: ' px' });
  if (!(length > 0)) refuse(`${who}: its hang has no length — to is the pin itself: give length, or a to away from from`);
  const links = num(get('links'), { who, key: 'links', lo: 1, hi: MOST_LINKS, fallback: 8 });
  if (!Number.isInteger(links)) refuse(`${who}: its links is a whole number from 1 to ${MOST_LINKS} — not ${links}`);
  // a length measured from two points may come out a hair under a whole number of links: a billionth is slack
  const most = Math.max(1, Math.floor((length * (1 + 1e-9)) / MIN_LINK));
  if (links > most) refuse(`${who}: its ${links} links would each be ${(length / links).toFixed(2)} px — a link is at least ${MIN_LINK} px: at most ${most} link${most === 1 ? '' : 's'}, or a longer length`);
  const damping = num(get('damping'), { who, key: 'damping', lo: 0, hi: 1, open: 'hi', fallback: 0.7, unit: ' (the share of speed lost each second)' });
  const jitter = num(get('jitter'), { who, key: 'jitter', lo: 0, hi: 100, fallback: 0, unit: ' px' });
  if (jitter > 0 && !random) refuse(`${who}: a hang with jitter needs the context's seeded random (seededRandom(text)) — give it, or jitter: 0`);
  const seconds = get('seconds') === undefined ? undefined : num(get('seconds'), { who, key: 'seconds', lo: 0, hi: MOST_CHAIN_SECONDS, open: 'lo' });
  let last = 0;
  const path = list(get('path') ?? [], MOST_PATH, who, 'path', '[t, x, y] keys').map((raw, i) => {
    const k = list(raw, 3, who, `path[${i}]`, 'numbers [t, x, y]');
    if (k.length !== 3) refuse(`${who}: its path[${i}] is a key [t, x, y]: when (s) and where the pin is — not ${shown(raw)}`);
    const t = num(k[0], { who, key: `path[${i}]'s t`, lo: last, hi: MOST_CHAIN_SECONDS, open: 'lo', unit: ' s (after the key before it)' });
    last = t;
    return Object.freeze([t, ...point([k[1], k[2]], who, `path[${i}]'s place`)]);
  });
  for (const b of c.world.boxes) if (from[0] > b.x && from[0] < b.x + b.w && from[1] > b.y && from[1] < b.y + b.h) refuse(`${who}: its pin (from) is inside a box — move from out of boxes`);
  if (c.world.floor !== null && from[1] > c.world.floor) refuse(`${who}: its pin (from) is below the floor — move from above y ${c.world.floor}`);
  // laid straight from the pin toward `to` (or straight down), each free point nudged by the seeded jitter
  const dir = to && span > 0 ? [(to[0] - from[0]) / span, (to[1] - from[1]) / span] : [0, 1], rest = length / links;
  const points = [from[0], from[1]];
  for (let i = 1; i <= links; i += 1) points.push(from[0] + dir[0] * rest * i + (jitter ? (random() * 2 - 1) * jitter : 0), from[1] + dir[1] * rest * i + (jitter ? (random() * 2 - 1) * jitter : 0));
  const steps = Math.ceil((seconds ?? MOST_CHAIN_SECONDS) / STEP - 1e-9);
  const run = runChain({ pin: from, path, points, rest, gravity: c.gravity, keep: (1 - damping) ** STEP, world: c.world, steps, settle: seconds === undefined });
  return frozen({ model: 'verlet', family: 'hang', who, duration: run.steps * STEP, frameSeconds: STEP * EVERY, links, rest, frames: run.frames, world: c.world, radius: 0 });
}

/** A chain at t: every point (between the two kept frames), the free end as {x, y}, `angle` along the last link. */
function sampleVerlet(plan, t) {
  const u = clampT(plan, t), last = plan.frames.length - 1, f = u >= plan.duration ? last : u / plan.frameSeconds;
  const i = Math.min(Math.floor(f), last), j = Math.min(i + 1, last), w = f - i;
  const a = plan.frames[i], b = plan.frames[j];
  const points = [];
  for (let k = 0; k < a.length; k += 2) points.push(Object.freeze(w === 0 ? [a[k], a[k + 1]] : [a[k] + (b[k] - a[k]) * w, a[k + 1] + (b[k + 1] - a[k + 1]) * w]));
  const end = points[points.length - 1], prev = points[points.length - 2];
  return Object.freeze({ x: end[0], y: end[1], angle: Math.atan2(end[1] - prev[1], end[0] - prev[0]), points: Object.freeze(points) });
}

/* ------------------------------------------------------------------------------------------------- the list */

const model = (family, name, keys, plan, sample, checks) => Object.freeze({
  family, name, options: Object.freeze(keys.filter((k) => k !== 'do')), plan, sample, checks: Object.freeze(checks),
  // an intent checked once, before any frame, as the styles check a choice's options: the reading plan() does, nothing kept
  check: (intent, context) => { plan(intent, context); },
});

/** Every physics model this package ships: what a registry takes (each `family · name` once). */
export const PHYSICS_MODELS = Object.freeze([
  model('throw', 'ballistic', THROW_KEYS, planThrow, sampleBallistic, ['spacing', 'contact']),
  model('throw', 'bounce', [...THROW_KEYS, 'restitution', 'keep', 'squash'], planBounceThrow, sampleBounce, ['spacing', 'contact', 'volume']),
  model('fall', 'ballistic', FALL_KEYS, planFall, sampleBallistic, ['spacing', 'contact']),
  model('fall', 'bounce', [...FALL_KEYS, 'restitution', 'keep', 'squash'], planBounceFall, sampleBounce, ['spacing', 'contact', 'volume']),
  model('hang', 'verlet', HANG_KEYS, planHang, sampleVerlet, ['contact']),
]);
