// Light physics (src/human/physics), as properties over generated intents: ballistic flight against the textbook
// closed form and against the fixed-step integrator, energy never growing across bounces, a chain keeping its link
// lengths and its pin and the same for the same seed, no point left inside a box or below the floor after any step,
// and every wrapper keeping its inner plan's start and end while adding exactly the time it states.
// FC_RUNS=20000 npm test runs a deep sweep (the chain properties run a twentieth of it: each is a whole simulation).
import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import {
  PHYSICS_MODELS, anticipate, followThrough, hold, overshoot, sampleWrapped, basePlan, flightAt, verletStep, makeWorld, pushOut,
  seededRandom, settleSeconds, STEP, LENGTH_TOLERANCE, contact, trackOf, CONTACT_LIMIT,
} from '../src/human/physics/index.js';

const RUNS = Number(process.env.FC_RUNS) || 1000;
const HEAVY = Math.max(20, Math.round(RUNS / 20));
const model = (family, name) => PHYSICS_MODELS.find((m) => m.family === family && m.name === name);
const throwB = model('throw', 'ballistic'), throwBounce = model('throw', 'bounce'), fallB = model('fall', 'ballistic'), fallBounce = model('fall', 'bounce'), hang = model('hang', 'verlet');

const coord = fc.double({ min: -2000, max: 2000, noNaN: true });
const pt = fc.tuple(coord, coord);
const gravity = fc.double({ min: 100, max: 10000, noNaN: true });
// near within `tol` of the size of the numbers that made them (a place near 0 reached from 974 px keeps 974's rounding)
const close = (a, b, tol, scale = 1) => Math.abs(a - b) <= tol * Math.max(1, scale, Math.abs(a), Math.abs(b));

test('a throw with an apex: the textbook closed form, its top at the apex, its ends exact', () => {
  fc.assert(fc.property(pt, pt, fc.double({ min: 0, max: 800, noNaN: true }), gravity, fc.double({ min: 0, max: 1, noNaN: true }), (from, to, apex, g, share) => {
    // the textbook: up to the apex √(2·rise/g), down from it √(2·drop/g); vₓ = Δx / T, v_y = −√(2g·rise)
    const top = Math.min(from[1], to[1]) - apex, up = Math.sqrt(2 * (from[1] - top) / g), T = up + Math.sqrt(2 * (to[1] - top) / g);
    if (!(T > 0)) { assert.throws(() => throwB.plan({ from, to, apex, gravity: g }), /no time in the air/); return; }
    const plan = throwB.plan({ from, to, apex, gravity: g });
    assert.ok(close(plan.duration, T, 1e-12));
    const t = share * T, s = throwB.sample(plan, t), size = Math.hypot(...from) + Math.hypot(...to) + apex;
    assert.ok(close(s.x, from[0] + ((to[0] - from[0]) / T) * t, 1e-9, size));
    assert.ok(close(s.y, from[1] - Math.sqrt(2 * g * (from[1] - top)) * t + 0.5 * g * t * t, 1e-9, size));
    assert.ok(close(throwB.sample(plan, up).y, top, 1e-9, size), 'the top of the flight is the apex');
    const a = throwB.sample(plan, 0), b = throwB.sample(plan, plan.duration);
    assert.deepEqual([a.x, a.y, b.x, b.y], [from[0], from[1], to[0], to[1]]);
  }), { numRuns: RUNS });
});

test('a throw with seconds lands on `to` at that time; the fixed-step integrator traces the same parabola', () => {
  fc.assert(fc.property(pt, pt, fc.double({ min: 0.05, max: 5, noNaN: true }), gravity, (from, to, seconds, g) => {
    const plan = throwB.plan({ from, to, seconds, gravity: g });
    assert.equal(plan.duration, seconds);
    const near = flightAt(from, plan.velocity, g, seconds), size = Math.hypot(...from) + Math.hypot(...to) + g * seconds * seconds;
    assert.ok(close(near[0], to[0], 1e-9, size) && close(near[1], to[1], 1e-9, size));
    // position Verlet started on the parabola is exact for a constant force: step n is the closed form at n·STEP
    let now = [from[0], from[1]], before = [from[0] - plan.velocity[0] * STEP, from[1] - plan.velocity[1] * STEP + 0.5 * g * STEP * STEP];
    const n = Math.min(240, Math.floor(seconds / STEP));
    for (let i = 0; i < n; i += 1) { const next = verletStep(now, before, [0, g], STEP); before = now; now = next; }
    const exact = flightAt(from, plan.velocity, g, n * STEP), span = Math.hypot(...from) + Math.hypot(...plan.velocity) * n * STEP + g * (n * STEP) ** 2;
    assert.ok(close(now[0], exact[0], 1e-9, span) && close(now[1], exact[1], 1e-9, span), `${now} vs ${exact}`);
  }), { numRuns: RUNS });
});

test('a fall lands on the floor when the closed form says; a bounce never gains energy, and rests on the floor exactly', () => {
  fc.assert(fc.property(pt, fc.double({ min: 1, max: 3000, noNaN: true }), pt, gravity, fc.double({ min: 0, max: 1, noNaN: true }), fc.double({ min: 0, max: 1, noNaN: true }), (from, drop, velocity, g, restitution, keep) => {
    const floor = from[1] + drop, v = [velocity[0] / 4, velocity[1] / 4];
    const fall = fallB.plan({ from, floor, velocity: v, gravity: g });
    const T = (-v[1] + Math.sqrt(v[1] * v[1] + 2 * g * drop)) / g;
    assert.ok(close(fall.duration, T, 1e-12));
    assert.equal(fallB.sample(fall, fall.duration).y, floor);
    const plan = fallBounce.plan({ from, floor, velocity: v, gravity: g, restitution, keep });
    let speed = Infinity, height = Infinity;
    plan.segments.forEach((s, k) => {
      const e = Math.hypot(s.velocity[0], s.velocity[1]);
      if (k > 0) {
        // after a landing: no faster than it came down, and no higher than the bounce before
        assert.ok(e <= plan.impacts[k - 1].speed * (1 + 1e-12), `bounce ${k}: ${e} after landing at ${plan.impacts[k - 1].speed}`);
        assert.ok(e <= speed * (1 + 1e-12));
        const h = (s.velocity[1] * s.velocity[1]) / (2 * g);
        assert.ok(h <= height * (1 + 1e-12)); height = h; speed = e;
        assert.equal(s.from[1], floor);
      }
    });
    const end = fallBounce.sample(plan, plan.duration);
    assert.deepEqual([end.x, end.y], [plan.rest[0], floor]);
    // never below the floor on the way (a float's width of slack at a landing)
    const deepest = contact.measure(trackOf(plan, fallBounce.sample, { rate: 120 }));
    assert.ok(deepest <= CONTACT_LIMIT, `${deepest}`);
  }), { numRuns: RUNS });
  assert.throws(() => fallBounce.plan({ from: [0, 0], floor: 100, restitution: 1.0001 }), /the energy would grow/);
});

const chainIntent = fc.record({
  from: fc.tuple(fc.double({ min: -500, max: 500, noNaN: true }), fc.double({ min: -500, max: 500, noNaN: true })),
  links: fc.integer({ min: 1, max: 24 }),
  extra: fc.double({ min: 0, max: 400, noNaN: true }),
  angle: fc.double({ min: 0, max: 2 * Math.PI, noNaN: true }),
  damping: fc.double({ min: 0, max: 0.99, noNaN: true }),
  seconds: fc.double({ min: 0.05, max: 1.2, noNaN: true }),
  g: fc.double({ min: 200, max: 4000, noNaN: true }),
}).map(({ from, links, extra, angle, damping, seconds, g }) => {
  const length = links * 4 + extra;
  return { from, to: [from[0] + Math.cos(angle) * length, from[1] + Math.sin(angle) * length], links, damping, seconds, gravity: g };
});

test('a chain keeps every link within LENGTH_TOLERANCE of its length, its pin exactly where it is, at every frame', () => {
  fc.assert(fc.property(chainIntent, (intent) => {
    const plan = hang.plan(intent);
    for (const f of plan.frames) {
      assert.deepEqual([f[0], f[1]], [intent.from[0], intent.from[1]]);
      for (let i = 0; i + 2 < f.length; i += 2) {
        const err = Math.abs(Math.hypot(f[i + 2] - f[i], f[i + 3] - f[i + 1]) - plan.rest) / plan.rest;
        assert.ok(err <= LENGTH_TOLERANCE, `link ${i / 2}: ${err}`);
      }
    }
  }), { numRuns: HEAVY });
});

test('a chain is the same for the same seed, and its jitter follows the seed', () => {
  fc.assert(fc.property(chainIntent, fc.string({ maxLength: 12 }), fc.double({ min: 0.5, max: 20, noNaN: true }), (intent, seed, jitter) => {
    const a = hang.plan({ ...intent, jitter, seconds: 0.1 }, { random: seededRandom(seed), who: 'the rope' });
    const b = hang.plan({ ...intent, jitter, seconds: 0.1 }, { random: seededRandom(seed), who: 'the rope' });
    assert.deepEqual(a, b);
    const c = hang.plan({ ...intent, jitter, seconds: 0.1 }, { random: seededRandom(`${seed}!`), who: 'the rope' });
    assert.notDeepEqual(a.frames[0], c.frames[0]);
  }), { numRuns: HEAVY });
});

/** Boxes that do not overlap, standing above a floor: cells of a grid, each box inside its own cell. */
const world = fc.record({
  floor: fc.integer({ min: 300, max: 900 }),
  cells: fc.array(fc.record({ col: fc.integer({ min: 0, max: 9 }), row: fc.integer({ min: 0, max: 5 }), w: fc.double({ min: 5, max: 100, noNaN: true }), h: fc.double({ min: 5, max: 50, noNaN: true }) }), { maxLength: 8 }),
}).map(({ floor, cells }) => {
  const seen = new Set();
  const boxes = cells.filter((c) => { const k = `${c.col},${c.row}`; if (seen.has(k)) return false; seen.add(k); return true; })
    .map((c) => ({ x: -500 + c.col * 100, y: floor - 50 * (c.row + 1), w: c.w, h: c.h }));
  return { floor, boxes };
});
const inside = (x, y, b) => x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h;

test('collisions: a pushed point is inside no box and not below the floor', () => {
  fc.assert(fc.property(world, fc.tuple(fc.double({ min: -600, max: 600, noNaN: true }), fc.double({ min: -100, max: 1200, noNaN: true })), (w, [x, y]) => {
    const made = makeWorld(w), [px, py] = pushOut(x, y, made);
    assert.ok(py <= made.floor);
    for (const b of made.boxes) assert.ok(!inside(px, py, b), `(${px}, ${py}) inside ${JSON.stringify(b)}`);
  }), { numRuns: RUNS });
});

test('a chain among boxes: after every step no free point is inside a box or below the floor', () => {
  fc.assert(fc.property(world, chainIntent, (w, intent) => {
    const from = [intent.from[0] / 2, Math.min(intent.from[1], w.floor - 320)];
    fc.pre(!w.boxes.some((b) => inside(from[0], from[1], b)));
    const plan = hang.plan({ ...intent, from, to: [from[0] + (intent.to[0] - intent.from[0]), from[1] + (intent.to[1] - intent.from[1])], ...w });
    for (const f of plan.frames) for (let i = 2; i < f.length; i += 2) {
      assert.ok(f[i + 1] <= w.floor);
      for (const b of w.boxes) assert.ok(!inside(f[i], f[i + 1], b));
    }
  }), { numRuns: HEAVY });
});

/** A plan from one of the models, small enough to sample often. */
const anyPlan = fc.oneof(
  fc.tuple(pt, pt, fc.double({ min: 0, max: 400, noNaN: true })).map(([from, to, apex]) => [throwB, { from, to, apex: apex + 1 }]),
  fc.tuple(pt, fc.double({ min: 10, max: 900, noNaN: true }), fc.double({ min: 0, max: 0.9, noNaN: true }), fc.double({ min: 0, max: 0.5, noNaN: true })).map(([from, drop, restitution, squash]) => [fallBounce, { from, floor: from[1] + drop, restitution, squash }]),
  fc.tuple(pt, fc.double({ min: 20, max: 300, noNaN: true })).map(([from, dx]) => [throwBounce, { from, to: [from[0] + dx, from[1] + dx] }]),
  fc.tuple(pt, fc.double({ min: 10, max: 900, noNaN: true })).map(([from, drop]) => [fallB, { from, floor: from[1] + drop }]),
  fc.tuple(pt, fc.integer({ min: 1, max: 4 })).map(([from, links]) => [hang, { from, to: [from[0] + 60, from[1]], links, seconds: 0.3 }]),
).map(([m, intent]) => ({ m, plan: m.plan(intent) }));

/** A wrapper and its options, and the time it says it adds to an inner plan of duration d. */
const aWrapper = fc.oneof(
  fc.record({ share: fc.double({ min: 0.01, max: 0.5, noNaN: true }), by: fc.option(fc.double({ min: 0, max: 50, noNaN: true }), { nil: undefined }) }).map((o) => ({ wrap: anticipate, o, adds: (d) => d + o.share * d })),
  fc.record({ share: fc.double({ min: 0.01, max: 1, noNaN: true }), by: fc.option(fc.double({ min: 0, max: 50, noNaN: true }), { nil: undefined }) }).map((o) => ({ wrap: followThrough, o, adds: (d) => d + o.share * d })),
  fc.record({ at: fc.double({ min: 0, max: 1, noNaN: true }), seconds: fc.double({ min: 0.01, max: 2, noNaN: true }) }).map((o) => ({ wrap: (p) => hold(p, { at: o.at * p.duration, seconds: o.seconds }), o, adds: (d) => d + o.seconds })),
  fc.record({ by: fc.double({ min: 0, max: 50, noNaN: true }), share: fc.double({ min: 0.01, max: 0.5, noNaN: true }), feel: fc.constantFrom('snappy', 'default', 'heavy', 'playful') }).map((o) => ({ wrap: overshoot, o, adds: (d) => d + settleSeconds(o.feel) })),
);

test('wrappers over any model\'s plan: the start and the end kept exactly, durations added as stated, plain frozen data', () => {
  fc.assert(fc.property(anyPlan, fc.array(aWrapper, { minLength: 1, maxLength: 3 }), fc.double({ min: 0, max: 1, noNaN: true }), ({ m, plan }, wrappers, u) => {
    let w = plan;
    for (const x of wrappers) {
      const before = w.duration;
      w = x.wrap(w, x.o);
      assert.equal(w.duration, x.adds(before));
      assert.equal(w.inner.duration, before);
    }
    assert.equal(basePlan(w), plan);
    const s = (t) => sampleWrapped(w, t, m.sample);
    assert.deepEqual(s(0), m.sample(plan, 0));
    assert.deepEqual(s(w.duration), m.sample(plan, plan.duration));
    assert.deepEqual(s(-1), s(0)); assert.deepEqual(s(w.duration + 1), s(w.duration));
    const mid = s(u * w.duration);
    assert.ok(Number.isFinite(mid.x) && Number.isFinite(mid.y) && Object.isFrozen(mid));
    assert.deepEqual(structuredClone(w), w);
  }), { numRuns: RUNS });
});
