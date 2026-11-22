// The wrappers (anticipate, followThrough, hold, overshoot) over any model's move, read by sampleMove; the spacing,
// volume and contact critics through checkMove; and the physics parts underneath, by example.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  planMove, sampleMove, sampleTrack, checkMove, anticipate, followThrough, hold, overshoot, basePlan, isWrapped, MOST_WRAPPERS, BY_SHARE,
  makeWorld, readWorld, pushOut, collide, depthIn, launch, fallSeconds, bounces, settleLeft, settleSeconds, simulate, verletStep, PHYSICS_STEP,
} from '../human.js';
import { spacing } from '../src/human/critics/spacing.js';
import { volume } from '../src/human/critics/volume.js';
import { contact } from '../src/human/critics/contact.js';
import { sampleWrapped } from '../src/human/models/wrap.js';
import { settleTime } from '../src/motion/spring.js';

const who = 'blocks[2] ("ball")';
const plainFrozen = (v) => { assert.deepEqual(structuredClone(v), v); const walk = (x) => { if (x && typeof x === 'object') { assert.ok(Object.isFrozen(x)); Object.values(x).forEach(walk); } }; walk(v); };

test('wrappers: a move in, a move out — the record nests, the reason says it, seconds add as stated, both ends kept', () => {
  const move = planMove({ do: 'throw', who, from: [0, 500], to: [600, 500] });
  const s = (m, t) => sampleMove(m, t), d = move.plan.seconds;
  const a = anticipate(move, { share: 0.2 }), f = followThrough(move), h = hold(move, { at: 0.3, seconds: 0.5 }), o = overshoot(move, { by: 10, feel: 'snappy' });
  for (const w of [a, f, h, o]) {
    plainFrozen(w);
    assert.equal(w.plan.inner, w.plan.inner); assert.deepEqual(w.plan.inner, move.plan);
    assert.deepEqual(s(w, 0), s(move, 0));
    assert.deepEqual(s(w, w.plan.seconds), s(move, d));
    assert.ok(w.reason.startsWith(`${move.reason}; then ${w.plan.wrapper}: `));
    assert.equal(w.wrappers.length, 1);
  }
  assert.equal(a.plan.seconds, d + 0.2 * d);
  assert.equal(f.plan.seconds, d + 0.25 * d);
  assert.equal(h.plan.seconds, d + 0.5);
  assert.equal(o.plan.seconds, d + settleTime('snappy'));
  assert.deepEqual([a.plan.wrapper, a.plan.share, a.plan.by, a.plan.pushes], ['anticipate', 0.2, null, 2]);
  assert.deepEqual(o.plan.basis, { share: 0.2, by: 10, added: settleTime('snappy'), seconds: o.plan.seconds, innerSeconds: d });
  assert.match(a.reason, /then anticipate: a pull back of 8% of its distance over 0\.16 s, released into the move$/);
  assert.match(o.reason, /then overshoot: arrives 10 px past the end and settles back over [0-9.]+ s$/);
  assert.match(h.reason, /then hold: still for 0\.5 s at 0\.3 s$/);
  assert.match(f.reason, /then follow-through: carries on 8% of its distance past the end and swings back over 0\.2 s$/);
  // anticipation pulls back first: opposite the launch (up and right) — down and to the left
  const back = s(a, d * 0.2);
  assert.ok(back.x < 0 && back.y > 500);
  assert.deepEqual(s(h, 0.5), s(move, 0.3));
  assert.deepEqual(s(h, 0.9), s(move, 0.4));
  assert.ok(s(o, d).x > 600);
  // the usual by is BY_SHARE of the straight distance: 48 px at the swing's peak, along the end's heading
  const peak = Math.max(...Array.from({ length: 400 }, (_, i) => s(f, d + (f.plan.seconds - d) * (i / 400)).x));
  assert.ok(Math.abs(peak - 600 - BY_SHARE * 600 * Math.cos(Math.PI / 4)) < 0.5, `${peak}`);
  // nested: the outermost last, basePlan finds the model's; a hold at 0 adds no push
  const n = overshoot(hold(anticipate(move), { at: 0, seconds: 0.1 }), { by: 3, feel: { k: 200, d: 20 } });
  assert.deepEqual(n.wrappers, ['anticipate', 'hold', 'overshoot']);
  assert.deepEqual(basePlan(n.plan), move.plan); assert.ok(isWrapped(n.plan) && !isWrapped(move.plan));
  assert.deepEqual(n.plan.feel, { k: 200, d: 20 }); assert.equal(n.plan.pushes, 3);
  assert.deepEqual(s(n, n.plan.seconds), s(move, d));
  // the critics read a wrapped move too
  assert.deepEqual(checkMove(n).findings, []);
});

test('wrappers over any model: a reach overshoots and the jerk critic counts its pushes; a still chain is not pushed some noisy way', () => {
  const reach = planMove({ do: 'reach', from: [0, 0], to: [300, 0] }), over = overshoot(reach, { by: 10 });
  assert.equal(sampleMove(over, over.plan.seconds).x, sampleMove(reach, reach.plan.seconds).x);
  assert.ok(Math.max(...sampleTrack(over).samples.map((p) => p.x)) > 305);
  assert.deepEqual(checkMove(over).findings, []);
  // a chain hanging still: its travel is under MIN_TRAVEL, so no direction and no offset
  const still = planMove({ do: 'hang', from: [0, 0], length: 40, seconds: 0.1, model: { name: 'verlet', links: 2 } });
  const ws = anticipate(still, { by: 5 });
  assert.deepEqual(sampleMove(ws, 0.05), sampleMove(still, 0.05 - ws.plan.share * still.plan.seconds));
  // a chain swinging: every point moves with it
  const swing = planMove({ do: 'hang', from: [0, 0], to: [80, 0], seconds: 0.5, model: { name: 'verlet', links: 2 } }), fw = followThrough(swing, { by: 20 });
  const mid = sampleMove(fw, swing.plan.seconds + 0.05), base = sampleMove(swing, swing.plan.seconds);
  assert.ok(mid.points.every((p, i) => Math.abs((p[0] - base.points[i][0]) - (mid.x - base.x)) < 1e-9));
  // a hand-written plan with seconds wraps too, sampled by its own sampler
  const lin = (p, t) => ({ x: p.from + (p.to - p.from) * Math.min(1, Math.max(0, t)), y: 0 });
  const mine = { seconds: 1, from: 0, to: 100 }, wm = { wrapper: 'overshoot', seconds: 1 + settleTime('default'), inner: mine, share: 0.2, by: 5, feel: 'default' };
  assert.equal(sampleWrapped(wm, 1, lin).x, 105);
  assert.equal(sampleWrapped(wm, wm.seconds, lin).x, 100);
});

test('wrapper refusals name the entry and the fix', () => {
  const move = planMove({ do: 'throw', who, from: [0, 500], to: [600, 500] });
  const cases = [
    [() => anticipate(move, { share: 0.9 }), /blocks\[2\] \("ball"\): anticipate's share is a number above 0 to 0.5/],
    [() => anticipate(move, { lead: 1 }), /anticipate's options takes share, by — not "lead"/],
    [() => anticipate(move, 3), /anticipate's options are \{share, by\}/],
    [() => followThrough(move, { by: -1 }), /followThrough's by is a number from 0/],
    [() => hold(move, { at: 5, seconds: 1 }), /hold's at is a number from 0 to [0-9.]+/],
    [() => hold(move), /hold's at is a number/],
    [() => overshoot(move, { feel: 'bouncy' }), /overshoot's feel is a spring's name \(snappy, default, heavy, playful\) or \{k, d\} above 0 — not "bouncy"/],
    [() => overshoot(move, { feel: { k: -1, d: 2 } }), /overshoot's feel is a spring's name/],
    [() => anticipate(null), /anticipate wraps a move planMove made/],
    [() => anticipate({ model: 'x', who: 'me', plan: { seconds: -1 } }), /me: anticipate wraps a plan with its seconds/],
    [() => sampleMove({ ...move, plan: { wrapper: 'spin', inner: move.plan, seconds: 1 } }, 0.5), /wrapper is one of anticipate, follow-through, hold, overshoot — not "spin"/],
  ];
  for (const [fn, re] of cases) assert.throws(fn, re);
  let deep = move;
  for (let i = 0; i < MOST_WRAPPERS; i += 1) deep = hold(deep, { at: 0, seconds: 0.1 });
  assert.throws(() => hold(deep, { at: 0, seconds: 0.1 }), /has 4 wrappers already — at most 4: drop one/);
  const loop = { wrapper: 'hold', seconds: 1, at: 0, held: 0.1 }; loop.inner = loop;
  assert.throws(() => basePlan(loop), /at most 4 wrappers — this one holds more \(or holds itself\)/);
});

test('critics through checkMove: measured on the track with their basis, a finding in words with the fix, null when fine', () => {
  const blocked = planMove({ do: 'throw', who, from: [0, 500], to: [600, 500], boxes: [{ x: 250, y: 300, w: 100, h: 100 }] });
  const checked = checkMove(blocked);
  assert.ok(checked.measures.contact > 40 && checked.measures.spacing > 0.05);
  assert.deepEqual(Object.keys(checked.bases.spacing), ['mean', 'least', 'most', 'steps']);
  assert.equal(checked.findings.length, 1);
  const [found] = checked.findings;
  assert.deepEqual([found.critic, found.level, found.basis.into], ['contact', 'warn', 'a box']);
  assert.match(found.message, /^blocks\[2\] \("ball"\): at 0\.3[0-9] s it goes [0-9.]+ px into a box — it passes through something solid$/);
  assert.match(found.fix, /apex: a larger number.*model: 'bounce' with the floor/);
  // through the floor
  const under = checkMove(planMove({ do: 'throw', who, from: [0, 300], to: [600, 600], floor: 520 }));
  assert.equal(under.findings[0].basis.into, 'the floor');
  // no world: nothing to pass through
  assert.equal(checkMove(planMove({ do: 'throw', from: [0, 0], to: [100, 0] })).measures.contact, null);
  // a linear slide: even spacing → found
  const linear = { who, samples: Array.from({ length: 30 }, (_, i) => ({ t: i / 30, x: i * 10, y: 0 })) };
  const lv = spacing.measure(linear);
  assert.ok(lv.value < 1e-9);
  assert.match(spacing.finding(lv.value, who).message, /reads as slid along a line, not falling/);
  assert.match(spacing.finding(lv.value, who).fix, /do: 'fall' or do: 'throw'/);
  assert.equal(spacing.measure({ samples: [{ t: 0, x: 0, y: 0 }, { t: 1, x: 0, y: 0 }] }), null);
  // a squash that does not keep its area
  const rubber = { who, samples: [{ t: 0, x: 0, y: 0 }, { t: 0.1, x: 0, y: 0, sx: 1.3, sy: 0.7 }] };
  assert.ok(Math.abs(volume.measure(rubber).value - 0.09) < 1e-12);
  assert.equal(volume.finding(0.09, who, { at: 0.1 }), null);
  assert.match(volume.finding(0.25, who, { at: 0.1 }).message, /changes its area by 25% \(at 0\.10 s\) — it reads as rubber/);
  assert.match(volume.finding(0.25, who, { at: 0.1 }).fix, /sy = 1 \/ sx/);
  assert.equal(volume.measure({ samples: [{ t: 0, x: 0, y: 0 }] }), null);
  // the bounce model's squash keeps its area
  const b = planMove({ do: 'fall', from: [0, 0], floor: 600, model: { name: 'bounce', squash: 0.4 } });
  assert.ok(checkMove(b, { rate: 240 }).measures.volume < 1e-12);
  // a chain's points are checked too
  const box = { who, samples: [{ t: 0, x: 0, y: 0, points: [[0, 0], [50, 50]] }], plan: { world: { floor: null, boxes: [{ x: 40, y: 40, w: 20, h: 20 }] } } };
  assert.deepEqual(contact.measure(box), { value: 10, basis: { at: 0, into: 'a box' } });
});

test('the parts underneath: launch, a fall\'s time, bounces, a world, collisions, settle, the fixed step', () => {
  assert.deepEqual(launch([0, 0], [100, 0], { seconds: 1, gravity: 10 }), { velocity: [100, -5], seconds: 1 });
  assert.equal(fallSeconds(0, 0, 490, 980), 1);
  assert.equal(fallSeconds(500, 0, 400, 980), null);
  assert.equal(fallSeconds(500, 10, 500, 980), null);
  const b = bounces([0, 0], [0, 0], { floor: 100, gravity: 1000, restitution: 1, keep: 1 });
  assert.equal(b.segments.length, 25, 'restitution 1 bounces forever: the count caps it');
  const w = makeWorld({ floor: 100, boxes: [{ x: 0, y: 0, w: 10, h: 10 }] });
  assert.deepEqual(readWorld({ floor: 100, boxes: [{ x: 0, y: 0, w: 10, h: 10 }], from: [0, 0] }, 'me'), w);
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
  assert.equal(collide(pts, makeWorld({})), pts);
  assert.throws(() => makeWorld({ roof: 1 }), /the world takes floor, boxes — not "roof"/);
  assert.throws(() => makeWorld(null), /the world is \{floor, boxes\}/);
  assert.equal(settleLeft(0), 1); assert.equal(settleLeft(settleSeconds()), 0); assert.equal(settleLeft(-1), 1);
  assert.ok(settleLeft(0.1) < 1 && settleLeft(0.1) > 0);
  // it reaches 0 smoothly, not by a jump at the end
  assert.ok(Math.abs(settleLeft(settleSeconds() - 1e-6)) < 1e-6);
  assert.equal(settleSeconds('heavy'), settleTime('heavy'));
  const run = simulate({ points: [0, 0] }, (s) => ({ points: verletStep(s.points, s.points, [0, 0], PHYSICS_STEP) }), { steps: 5 });
  assert.equal(run.steps, 8, 'rounded up to whole frames');
  assert.equal(run.frames.length, 3);
});
