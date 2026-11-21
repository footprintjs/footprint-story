// Light physics (src/human/physics): the critics and the parts underneath by example — what each measures or gives,
// what it refuses (naming the entry and the fix), and that every track and finding is plain frozen data.
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
  // it reaches 0 smoothly, not by a jump at the end
  assert.ok(Math.abs(settleLeft(settleSeconds() - 1e-6)) < 1e-6);
  assert.equal(settleSeconds('heavy'), settleTime('heavy'));
  const run = simulate({ points: [0, 0] }, (s) => ({ points: verletStep(s.points, s.points, [0, 0], STEP) }), { steps: 5 });
  assert.equal(run.steps, 8, 'rounded up to whole frames');
  assert.equal(run.frames.length, 3);
  assert.throws(() => seededRandom(3), /seededRandom takes the text to seed from/);
  const r1 = seededRandom('a'), r2 = seededRandom('a');
  assert.deepEqual([r1(), r1(), r1()], [r2(), r2(), r2()]);
});
