// Light physics (src/human/physics): the models, wrappers and critics by example — what each gives, what it refuses
// (naming the entry and the fix), and that every plan, sample and finding is plain frozen data.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PHYSICS_MODELS, PHYSICS_WRAPPERS, PHYSICS_CRITICS, anticipate, followThrough, hold, overshoot, sampleWrapped, basePlan, isWrapped,
  spacing, volume, contact, trackOf, seededRandom, makeWorld, pushOut, collide, depthIn, launch, fallSeconds, bounces, settleLeft, settleSeconds,
  GRAVITY, MIN_APEX, MOST_WRAPPERS, WRAPPER_NAMES, MOST_SAMPLES, simulate, verletStep, STEP,
} from '../src/human/physics/index.js';
import { settleTime } from '../src/motion/spring.js';

const model = (family, name) => PHYSICS_MODELS.find((m) => m.family === family && m.name === name);
const throwB = model('throw', 'ballistic'), throwBounce = model('throw', 'bounce'), fallB = model('fall', 'ballistic'), fallBounce = model('fall', 'bounce'), hang = model('hang', 'verlet');
const who = 'blocks[2] ("ball")';

/** Frozen all the way down, and survives a structured copy unchanged: plain data a record keeps. */
function plain(v) {
  assert.deepEqual(structuredClone(v), v);
  const walk = (x) => { if (x && typeof x === 'object') { assert.ok(Object.isFrozen(x), 'frozen'); Object.values(x).forEach(walk); } else assert.notEqual(typeof x, 'function'); };
  walk(v);
}

test('the models: one interface, each family · name once, their checks named critics', () => {
  assert.deepEqual(PHYSICS_MODELS.map((m) => `${m.family}·${m.name}`), ['throw·ballistic', 'throw·bounce', 'fall·ballistic', 'fall·bounce', 'hang·verlet']);
  const critics = PHYSICS_CRITICS.map((c) => c.name);
  for (const m of PHYSICS_MODELS) {
    assert.ok(Object.isFrozen(m) && Object.isFrozen(m.options) && Object.isFrozen(m.checks));
    for (const k of ['plan', 'sample', 'check']) assert.equal(typeof m[k], 'function');
    assert.ok(m.checks.every((c) => critics.includes(c)));
    assert.ok(!m.options.includes('do'));
  }
  assert.deepEqual(PHYSICS_WRAPPERS.map((w) => w.name), WRAPPER_NAMES);
});

test('a throw: from → to, the usual apex a 45° launch for level ends, both ends exact, plain frozen data', () => {
  const plan = throwB.plan({ do: 'throw', from: [100, 600], to: [700, 600] }, { who });
  plain(plan);
  assert.equal(plan.who, who);
  assert.equal(plan.family, 'throw'); assert.equal(plan.model, 'ballistic');
  // 45°: vx = −vy
  assert.ok(Math.abs(plan.velocity[0] + plan.velocity[1]) < 1e-9);
  assert.deepEqual(throwB.sample(plan, 0), { x: 100, y: 600, angle: -Math.PI / 4 });
  const end = throwB.sample(plan, plan.duration);
  assert.equal(end.x, 700); assert.equal(end.y, 600);
  assert.deepEqual(throwB.sample(plan, -5), throwB.sample(plan, 0));
  assert.deepEqual(throwB.sample(plan, 99), end);
  plain(throwB.sample(plan, 0.3));
  // the top of the flight: 600 px across → 150 px up
  const top = throwB.sample(plan, plan.duration / 2);
  assert.ok(Math.abs(top.y - 450) < 1e-9 && Math.abs(top.angle) < 1e-12);
  // a short throw still goes MIN_APEX up
  const short = throwB.plan({ from: [0, 0], to: [10, 0] });
  assert.ok(Math.abs(throwB.sample(short, short.duration / 2).y + MIN_APEX) < 1e-9);
  // seconds: lands there then
  const timed = throwB.plan({ from: [0, 500], to: [300, 200], seconds: 0.8, gravity: 1000 });
  assert.equal(timed.duration, 0.8);
  assert.deepEqual([timed.velocity[0], timed.velocity[1]], [375, (200 - 500 - 0.5 * 1000 * 0.64) / 0.8]);
});

test('a fall: down to the floor from rest or a start velocity; a body of radius lands its centre that far above', () => {
  const plan = fallB.plan({ do: 'fall', from: [50, 100], floor: 590, radius: 10 });
  plain(plan);
  assert.equal(plan.duration, Math.sqrt(2 * 480 / GRAVITY));
  assert.deepEqual(fallB.sample(plan, plan.duration), { x: 50, y: 580, angle: Math.PI / 2 });
  const up = fallB.plan({ from: [0, 500], floor: 500, velocity: [100, -490] });
  assert.ok(Math.abs(up.duration - 2 * 490 / GRAVITY) < 1e-12);
  assert.deepEqual([up.to[0], up.to[1]], [100 * up.duration, 500]);
});

test('a bounce: lower each time, at rest on the floor exactly; a squash keeps the area', () => {
  const plan = fallBounce.plan({ from: [0, 100], floor: 900, restitution: 0.6, squash: 0.3 }, { who });
  plain(plan);
  assert.ok(plan.segments.length > 3);
  assert.deepEqual([plan.rest[0], plan.rest[1]], [0, 900]);
  const end = fallBounce.sample(plan, plan.duration);
  assert.equal(end.y, 900); assert.equal(end.sx, 1); assert.equal(end.sy, 1);
  const hit = fallBounce.sample(plan, plan.impacts[0].at);
  assert.ok(Math.abs(hit.sy - 0.7) < 1e-12 && Math.abs(hit.sx * hit.sy - 1) < 1e-12);
  // no squash: no scale fields
  const bare = fallBounce.plan({ from: [0, 100], floor: 900 });
  assert.deepEqual(Object.keys(fallBounce.sample(bare, 0.2)), ['x', 'y']);
  // restitution 0: lands and stays
  const dead = fallBounce.plan({ from: [0, 100], floor: 900, restitution: 0 });
  assert.equal(dead.segments.length, 1);
  // a thrown bounce lands on `to`, then bounces along the floor at `to`'s y; keep slows it across
  const thrown = throwBounce.plan({ from: [0, 300], to: [200, 500], restitution: 0.5, keep: 0.5 });
  assert.equal(thrown.segments[1].from[1], 500);
  assert.equal(thrown.segments[1].from[0], 200);
  assert.equal(thrown.segments[1].velocity[0], thrown.segments[0].velocity[0] * 0.5);
  assert.equal(thrown.world.floor, 500);
});

test('a hang: pinned at from, swings from to and settles hanging below its pin; a moving pin trails the chain', () => {
  const plan = hang.plan({ do: 'hang', from: [400, 100], to: [600, 100], links: 10 }, { who: 'the lamp' });
  plain(plan);
  const end = hang.sample(plan, plan.duration);
  assert.ok(Math.abs(end.x - 400) < 2 && Math.abs(end.y - 300) < 1, `settled below the pin: ${end.x}, ${end.y}`);
  assert.equal(end.points.length, 11);
  assert.deepEqual(end.points[0], [400, 100]);
  const start = hang.sample(plan, 0);
  assert.ok(Math.abs(start.x - 600) < 1e-9 && Math.abs(start.y - 100) < 1e-9);
  plain(hang.sample(plan, plan.duration / 3));
  // straight down with a length, for a set time (rounded up to whole frames)
  const still = hang.plan({ from: [0, 0], length: 100, links: 4, seconds: 0.5 });
  assert.ok(still.duration >= 0.5 && still.duration < 0.5 + 1 / 60);
  // the pin moves along its path; the chain follows
  const trail = hang.plan({ from: [0, 0], length: 120, links: 6, path: [[0.5, 300, 0]], seconds: 1 });
  assert.deepEqual(hang.sample(trail, 0.5).points[0], [300, 0]);
  assert.ok(hang.sample(trail, 0.5).x < 300, 'the free end lags behind the pin');
  // jitter is seeded: the same text, the same chain
  const a = hang.plan({ from: [0, 0], length: 80, links: 4, jitter: 5, seconds: 0.2 }, { random: seededRandom('x') });
  const b = hang.plan({ from: [0, 0], length: 80, links: 4, jitter: 5, seconds: 0.2 }, { random: seededRandom('x') });
  assert.deepEqual(a, b);
});

test('refusals name the entry and the fix', () => {
  const cases = [
    [() => throwB.plan({ from: [0, 0], to: [1, 1], apex: 10, seconds: 1 }, { who }), /blocks\[2\] \("ball"\): its throw takes apex .* not both — drop one/],
    [() => throwB.plan({ from: [0, 0], to: [1, 1], apx: 10 }, { who }), /blocks\[2\].*takes do, from, to, apex.* — not "apx"/],
    [() => throwB.plan({ from: [0, 0], to: [0, 0], apex: 0 }, { who }), /no time in the air .* give an apex above 0, or seconds/],
    [() => throwB.plan({ do: 'fall', from: [0, 0], to: [1, 1] }, { who }), /take do: 'throw' — not "fall"/],
    [() => throwB.plan({ from: [0, NaN], to: [1, 1] }, { who }), /its from is a point \[x, y\]/],
    [() => throwB.plan({ from: [0, 0], to: [9e5, 0], gravity: 1 }, { who }), /at most 30 s: a lower apex, or seconds/],
    [() => fallB.plan({ from: [0, 0] }, { who }), /needs the floor it lands on: floor: <y in px>/],
    [() => fallB.plan({ from: [0, 600], floor: 500 }, { who }), /not above the floor .* move from above the floor/],
    [() => fallB.plan({ from: [0, 0], floor: 9e5, gravity: 1 }, { who }), /a nearer floor/],
    [() => fallBounce.plan({ from: [0, 0], floor: 500, restitution: 1.2 }, { who }), /restitution .* above 1 the energy would grow/],
    [() => throwBounce.plan({ from: [0, 600], to: [100, 500] }, { who }), /below the floor it lands on .* start it above the floor/],
    [() => throwBounce.plan({ from: [0, 0], to: [100, 500], floor: 600 }, { who }), /drop floor, or set to's y to 600/],
    [() => hang.plan({ from: [0, 0] }, { who }), /needs its length \(px\) or to/],
    [() => hang.plan({ from: [0, 0], to: [0, 0] }, { who }), /no length — to is the pin itself/],
    [() => hang.plan({ from: [0, 0], length: 20, links: 10 }, { who }), /a link is at least 4 px: at most 5 links/],
    [() => hang.plan({ from: [0, 0], length: 20, links: 1.5 }, { who }), /links is a whole number/],
    [() => hang.plan({ from: [0, 0], length: 20, links: 2, jitter: 2 }, { who }), /jitter needs the context's seeded random/],
    [() => hang.plan({ from: [0, 0], length: 20, links: 2, path: [[0, 1, 1]] }, { who }), /path\[0\]'s t is a number above 0/],
    [() => hang.plan({ from: [0, 0], length: 20, links: 2, path: [[1, 1]] }, { who }), /path\[0\] is a key \[t, x, y\]/],
    [() => hang.plan({ from: [0, 0], length: 20, links: 2, path: [[1, 1, 1], [0.5, 2, 2]] }, { who }), /path\[1\]'s t is a number above 1/],
    [() => hang.plan({ from: [50, 50], length: 20, links: 2, boxes: [{ x: 0, y: 0, w: 100, h: 100 }] }, { who }), /pin \(from\) is inside a box/],
    [() => hang.plan({ from: [0, 600], length: 20, links: 2, floor: 500 }, { who }), /pin \(from\) is below the floor/],
    [() => fallB.plan({ from: [0, 0], floor: 500, boxes: [{ x: 0, y: 450, w: 10, h: 100 }] }, { who }), /boxes\[0\] reaches below the floor .* stand it on the floor: y 400/],
    [() => fallB.plan({ from: [0, 0], floor: 500, boxes: [{ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 }] }, { who }), /boxes\[0\] and boxes\[1\] overlap — .* make them one box/],
    [() => fallB.plan({ from: [0, 0], floor: 500, boxes: [{ x: 0, y: 0, w: 0, h: 10 }] }, { who }), /boxes\[0\]\.w is a number above 0/],
    [() => fallB.plan({ from: [0, 0], floor: 500, boxes: [7] }, { who }), /boxes\[0\] is a box \{x, y, w, h\}/],
    [() => fallB.plan({ from: [0, 0], floor: 500, boxes: [, 1] }, { who }), /boxes\[0\] is .* a hole or a getter is never read/],
    [() => fallB.plan(null, { who }), /its fall is an object/],
    [() => throwB.plan({ from: [0, 0], to: [1, 1] }, 'me'), /a plan's context is \{who, random, frame\}/],
    [() => throwB.plan({ from: [0, 0], to: [1, 1] }, { who: '' }), /the context's who is the entry in its own words/],
    [() => throwB.plan({ from: [0, 0], to: [1, 1] }, { random: 3 }), /the context's random is a function/],
  ];
  for (const [fn, re] of cases) assert.throws(fn, (e) => e.message.startsWith('human: ') && re.test(e.message), String(re));
  // a getter is never run
  const sly = { from: [0, 0], get to() { throw new Error('ran'); } };
  assert.throws(() => throwB.plan(sly, { who }), /blocks\[2\] \("ball"\): its to is read as a stored value, and this one is a getter/);
  // check: the same reading, once
  assert.throws(() => throwB.check({ from: [0, 0], to: [1, 1], seconds: -1 }, { who }), /blocks\[2\].*seconds is a number above 0/);
  assert.equal(throwB.check({ from: [0, 0], to: [1, 1] }), undefined);
});

test('wrappers: the record nests, durations add as stated, both ends kept', () => {
  const plan = throwB.plan({ from: [0, 500], to: [600, 500] }, { who });
  const s = (p, t) => sampleWrapped(p, t, throwB.sample);
  const a = anticipate(plan, { share: 0.2 }), f = followThrough(plan), h = hold(plan, { at: 0.3, seconds: 0.5 }), o = overshoot(plan, { by: 10, feel: 'snappy' });
  for (const w of [a, f, h, o]) {
    plain(w);
    assert.equal(w.inner, plan);
    assert.deepEqual(s(w, 0), throwB.sample(plan, 0));
    assert.deepEqual(s(w, w.duration), throwB.sample(plan, plan.duration));
  }
  assert.equal(a.duration, plan.duration + 0.2 * plan.duration);
  assert.equal(f.duration, plan.duration + 0.25 * plan.duration);
  assert.equal(h.duration, plan.duration + 0.5);
  assert.equal(o.duration, plan.duration + settleTime('snappy'));
  assert.deepEqual(a, { wrapper: 'anticipate', duration: a.duration, inner: plan, share: 0.2, by: null });
  assert.deepEqual(o, { wrapper: 'overshoot', duration: o.duration, inner: plan, share: 0.2, by: 10, feel: 'snappy', tail: settleTime('snappy') });
  // anticipation pulls back first: opposite the launch (up and right) — down and to the left
  const back = s(a, a.inner.duration * 0.2);
  assert.ok(back.x < 0 && back.y > 500);
  // a hold stops at its time
  assert.deepEqual(s(h, 0.5), throwB.sample(plan, 0.3));
  assert.deepEqual(s(h, 0.9), throwB.sample(plan, 0.4));
  // an overshoot is past the end at the inner's end
  assert.ok(s(o, plan.duration).x > 600);
  // the default by is BY_SHARE of the straight distance: 48 px at the swing's peak
  const peak = Math.max(...Array.from({ length: 400 }, (_, i) => s(f, plan.duration + (f.duration - plan.duration) * (i / 400)).x));
  assert.ok(Math.abs(peak - 600 - 48 * Math.cos(Math.PI / 4)) < 0.5, `${peak}`);   // along the chord of the last 1%: a hair under 45°
  // nested: the outermost last, basePlan finds the model's
  const n = overshoot(hold(anticipate(plan), { at: 0, seconds: 0.1 }), { by: 3, feel: { k: 200, d: 20 } });
  assert.equal(basePlan(n), plan); assert.ok(isWrapped(n) && !isWrapped(plan));
  assert.deepEqual(n.feel, { k: 200, d: 20 });
  assert.deepEqual(s(n, n.duration), throwB.sample(plan, plan.duration));
  // a plan with nothing to show a direction: no offset at all
  const still = hang.plan({ from: [0, 0], length: 40, links: 2, seconds: 0.1 });
  const ws = anticipate(still, { by: 5 });
  assert.deepEqual(sampleWrapped(ws, 0.05, hang.sample), hang.sample(still, 0.05 - ws.share * still.duration));
  // any plan with a duration wraps, a hand-written one too
  const mine = { duration: 1, from: 0, to: 100 }, lin = (p, t) => Object.freeze({ x: p.from + (p.to - p.from) * Math.min(1, Math.max(0, t)), y: 0 });
  const wm = overshoot(mine, { by: 5 });
  assert.equal(sampleWrapped(wm, 1, lin).x, 105);
  assert.equal(sampleWrapped(wm, wm.duration, lin).x, 100);
});

test('wrapper refusals name the entry and the fix', () => {
  const plan = throwB.plan({ from: [0, 500], to: [600, 500] }, { who });
  const cases = [
    [() => anticipate(plan, { share: 0.9 }), /blocks\[2\].*anticipate's share is a number above 0 and up to 0.5/],
    [() => anticipate(plan, { lead: 1 }), /anticipate's options takes share, by — not "lead"/],
    [() => followThrough(plan, { by: -1 }), /followThrough's by is a number from 0/],
    [() => hold(plan, { at: 5, seconds: 1 }), /hold's at is a number from 0 to [0-9.]+ s \(a time within the move\)/],
    [() => hold(plan), /hold's options is an object \{at, seconds\}/],
    [() => overshoot(plan, { feel: 'bouncy' }), /overshoot's feel — no feel called "bouncy"/],
    [() => overshoot(plan, { feel: { k: -1, d: 2 } }), /overshoot's feel is a spring's name .* or \{k, d\} above 0/],
    [() => overshoot(plan, { feel: 3 }), /overshoot's feel is a spring's name/],
    [() => anticipate(null), /anticipate wraps a plan/],
    [() => anticipate({ duration: -1 }), /the plan: anticipate wraps a plan with a duration/],
    [() => sampleWrapped(plan, 0, null), /the model's own sample\(plan, t\)/],
    [() => sampleWrapped({ wrapper: 'spin', inner: plan, duration: 1 }, 0.5, throwB.sample), /wrapper is one of anticipate, follow-through, hold, overshoot — not "spin"/],
  ];
  for (const [fn, re] of cases) assert.throws(fn, re);
  let deep = plan;
  for (let i = 0; i < MOST_WRAPPERS; i += 1) deep = hold(deep, { at: 0, seconds: 0.1 });
  assert.throws(() => hold(deep, { at: 0, seconds: 0.1 }), /has 4 wrappers already — at most 4: drop one/);
  const loop = { wrapper: 'hold', duration: 1, at: 0, seconds: 0.1 }; loop.inner = loop;
  assert.throws(() => basePlan(loop), /at most 4 wrappers — this one holds more \(or holds itself\)/);
});

test('critics: measured on the track, a finding in words with the fix, null when fine', () => {
  const plan = throwB.plan({ from: [0, 500], to: [600, 500], boxes: [{ x: 250, y: 300, w: 100, h: 100 }] }, { who });
  const track = trackOf(plan, throwB.sample);
  plain(track);
  assert.equal(track.samples[0].t, 0); assert.equal(track.samples.at(-1).t, plan.duration);
  assert.equal(spacing.finding(spacing.measure(track), who), null);
  const depth = contact.measure(track);
  assert.ok(depth > 40, `${depth}`);
  const found = contact.finding(depth, who);
  plain(found);
  assert.equal(found.level, 'error');
  assert.match(found.message, /^blocks\[2\] \("ball"\): it goes [0-9.]+ px into the floor or a box/);
  assert.match(found.fix, /floor: <y>, boxes: \[\.\.\.\].*apex/);
  // a linear slide: even spacing → found
  const linear = { who, samples: Array.from({ length: 30 }, (_, i) => ({ t: i / 30, x: i * 10, y: 0 })) };
  const lv = spacing.measure(linear);
  assert.ok(lv < 1e-9);
  assert.match(spacing.finding(lv, who).message, /reads as linear, not falling/);
  assert.match(spacing.finding(lv, who).fix, /do: 'fall' or do: 'throw'/);
  assert.equal(spacing.measure({ samples: [{ t: 0, x: 0, y: 0 }, { t: 1, x: 0, y: 0 }] }), 1);
  // a squash that does not keep its area
  const rubber = { who, samples: [{ t: 0, x: 0, y: 0 }, { t: 0.1, x: 0, y: 0, sx: 1.3, sy: 0.7 }] };
  assert.ok(Math.abs(volume.measure(rubber) - 0.09) < 1e-12);
  assert.equal(volume.finding(0.09, who), null);
  assert.match(volume.finding(0.25, who).message, /changes its area by 25% — it reads as rubber/);
  assert.match(volume.finding(0.25, who).fix, /sy = 1 \/ sx/);
  // the bounce model's squash keeps its area
  const b = fallBounce.plan({ from: [0, 0], floor: 600, squash: 0.4 });
  assert.ok(volume.measure(trackOf(b, fallBounce.sample, { rate: 240 })) < 1e-12);
  // a chain's points are checked too
  const box = { who, samples: [{ t: 0, x: 0, y: 0, points: [[0, 0], [50, 50]] }], world: { floor: null, boxes: [{ x: 40, y: 40, w: 20, h: 20 }] } };
  assert.equal(contact.measure(box), 10);
  // refusals
  assert.throws(() => spacing.measure(null), /the spacing critic measures a track/);
  assert.throws(() => spacing.measure({ who, samples: [{ t: 1, x: 0, y: 0 }, { t: 1, x: 1, y: 0 }] }), /blocks\[2\].*samples\[1\] is \{t, x, y\}, finite, each t after the one before/);
  assert.throws(() => volume.measure({ who, samples: [{ t: 0, x: 0, y: 0, sx: 0 }] }), /sx and sy are scales above 0/);
  assert.throws(() => contact.measure({ who, samples: [], world: { floor: 'low', boxes: [] } }), /world is \{floor, boxes\}/);
  assert.throws(() => trackOf(plan, null), /trackOf samples a plan/);
  assert.throws(() => trackOf(plan, throwB.sample, { rate: 1000 }), /trackOf's rate is a number from 1 to 240/);
  assert.throws(() => trackOf({ duration: MOST_SAMPLES }, throwB.sample), /the plan: trackOf takes a plan with a duration/);
  assert.throws(() => spacing.measure({ samples: new Array(MOST_SAMPLES + 1) }), /at most 7200/);
});

test('the parts underneath: launch, a fall\'s time, bounces, collisions, settle, the fixed step', () => {
  assert.deepEqual(launch([0, 0], [100, 0], { seconds: 1, gravity: 10 }), { velocity: [100, -5], seconds: 1 });
  assert.equal(fallSeconds(0, 0, 490, 980), 1);
  assert.equal(fallSeconds(500, 0, 400, 980), null);
  assert.equal(fallSeconds(500, 10, 500, 980), null);
  const b = bounces([0, 0], [0, 0], { floor: 100, gravity: 1000, restitution: 1, keep: 1 });
  assert.equal(b.segments.length, 25, 'restitution 1 bounces forever: the count caps it');
  const w = makeWorld({ floor: 100, boxes: [{ x: 0, y: 0, w: 10, h: 10 }] });
  assert.deepEqual(pushOut(5, 200, w), [5, 100]);
  assert.deepEqual(pushOut(1, 5, w), [0, 5]);
  assert.deepEqual(pushOut(9, 5, w), [10, 5]);
  assert.deepEqual(pushOut(5, 1, w), [5, 0]);
  assert.deepEqual(pushOut(5, 9, w), [5, 10]);
  assert.equal(depthIn(5, 5, w), 5);
  assert.equal(depthIn(5, 95, w, 10), 5);
  const pts = [5, 5, 5, 5, 5, 300];
  collide(pts, w);
  assert.deepEqual(pts, [5, 5, 5, 0, 5, 100], 'the pin (index 0) is never pushed');
  const none = makeWorld({});
  assert.equal(collide(pts, none), pts);
  assert.throws(() => makeWorld({ roof: 1 }), /its world takes floor, boxes — not "roof"/);
  assert.equal(settleLeft(0), 1); assert.equal(settleLeft(settleSeconds()), 0); assert.equal(settleLeft(-1), 1);
  assert.ok(settleLeft(0.1) < 1 && settleLeft(0.1) > 0);
  assert.equal(settleSeconds('heavy'), settleTime('heavy'));
  const run = simulate({ points: [0, 0] }, (s) => ({ points: verletStep(s.points, s.points, [0, 0], STEP) }), { steps: 5 });
  assert.equal(run.steps, 8, 'rounded up to whole frames');
  assert.equal(run.frames.length, 3);
  assert.throws(() => seededRandom(3), /seededRandom takes the text to seed from/);
  const r1 = seededRandom('a'), r2 = seededRandom('a');
  assert.deepEqual([r1(), r1(), r1()], [r2(), r2(), r2()]);
});
