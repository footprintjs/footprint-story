// Tumbling on the human door (0.31.0): the `free-spin` model — a ballistic flight whose spin is kept (no torque in
// flight), and the hand-over at the landing as data (LANDING_RULES): a round thing rolls on, keeping its turning about the
// contact point, a box slides on and lands on a face. Geometry to a tolerance.
import test from 'node:test';
import assert from 'node:assert/strict';
import { planMove, sampleMove, sampleTrack, checkMove, anticipate, followThrough, hold, overshoot, LANDING_RULES, TUMBLE_KEYS, TUMBLE_SHAPES, landRoll, spinAt, faceSpin, launch, GRAVITY, ROLL_SHAPES, CHOOSE_RULES } from '../human.js';
import { firstRule } from '../src/human/models/rules.js';

const who = 'shots[1] ("die")';
const near = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b)), `${a} ≉ ${b}`);
const end = (m) => sampleMove(m, m.plan.seconds);
const QUARTER = Math.PI / 2;

test('the hand-over rule is data: the then it names, else a round thing rolls on and a box slides on', () => {
  assert.deepEqual(LANDING_RULES.map((r) => [r.when, r.then, r.label]), [
    [{ then: { eq: 'roll' } }, 'roll', 'the intent says then: roll'],
    [{ then: { eq: 'slide' } }, 'slide', 'the intent says then: slide'],
    [{ round: { eq: true } }, 'roll', 'a round thing rolls on'],
    [{ round: { eq: false } }, 'slide', 'a box slides on'],
  ]);
  assert.ok(Object.isFrozen(LANDING_RULES) && LANDING_RULES.every((r) => Object.isFrozen(r) && Object.isFrozen(r.when)));
  // the same rule reader as the model choice (decide()'s shape): every pair of facts has a rule
  for (const then of [null, 'roll', 'slide']) for (const round of [true, false]) assert.ok(firstRule(LANDING_RULES, { then, round }));
  assert.equal(firstRule(CHOOSE_RULES, { named: true }).then, 'named');
  assert.deepEqual(TUMBLE_SHAPES, ['ball', 'disc', 'ring', 'box']);
  assert.deepEqual(TUMBLE_KEYS, ['spin', 'angle', 'shape', 'then']);
});

test('in flight: a ballistic arc to `to`, its spin kept — the angle grows evenly, no torque', () => {
  const move = planMove({ do: 'tumble', who, from: [100, 300], to: [500, 500], radius: 20, spin: 12, angle: 0.5, then: 'slide' });
  const T = move.plan.landAt, { velocity } = launch([100, 300], [500, 500], { gravity: GRAVITY });
  near(T, launch([100, 300], [500, 500], { gravity: GRAVITY }).seconds);
  for (const share of [0, 0.25, 0.5, 0.9]) {
    const t = share * T, s = sampleMove(move, t);
    near(s.x, 100 + velocity[0] * t); near(s.y, 300 + velocity[1] * t + 0.5 * GRAVITY * t * t);
    near(s.angle, 0.5 + 12 * t); assert.equal(s.spin, 12); assert.equal(s.air, 1); assert.equal(s.rolls, 0);
  }
  const landed = sampleMove(move, T);
  assert.deepEqual([landed.x, landed.y, landed.air], [500, 500, 0]); near(landed.angle, spinAt(0.5, 12, T));
  assert.equal(move.plan.basis.spinDefaulted, false); near(move.plan.basis.flightTurns, (12 * T) / (2 * Math.PI));
  assert.match(move.reason, /spinning at 12 rad\/s \(the spin the intent gave\)/);
});

test('a round thing rolls on: the turning about the contact kept, v′ = (v + k r ω) / (1 + k)', () => {
  // the usual spin is v / r: it lands already rolling and keeps its speed across
  const usual = planMove({ do: 'tumble', who, from: [100, 300], to: [500, 500], radius: 20 });
  const b = usual.plan.basis, v = b.landSpeed;
  assert.deepEqual([b.landing, b.landingRule, b.shape, b.spinDefaulted], ['roll', 'a round thing rolls on', 'ball', true]);
  near(b.spin, v / 20); near(b.groundSpeed, v);
  near(b.groundDistance, (v * v) / (2 * ((0.05 * GRAVITY) / 1.4)));
  assert.equal(b.endedBy, 'rest');
  assert.match(usual.reason, /the usual: a roll's spin at its speed across, v \/ r\), [\d.]+ turns in the air with no torque on it; it lands at [\d.]+ s and rolls on at \d+ px a second \(its turning about the contact kept: \(v \+ k r ω\) \/ \(1 \+ k\)\) \(a round thing rolls on\), then goes [\d.]+ px to rest, [\d.]+ s in all$/);
  const after = sampleMove(usual, usual.plan.landAt + 0.5);
  assert.deepEqual([after.air, after.rolls, after.y], [0, 1, 500]);
  near(after.angle - b.landAngle, (after.x - 500) / 20);
  assert.deepEqual(checkMove(usual).findings, []);
  // no spin: a ball rolls on at 5/7 of its speed
  const flat = planMove({ do: 'tumble', from: [100, 300], to: [500, 500], radius: 20, spin: 0 });
  near(flat.plan.basis.groundSpeed, (5 / 7) * flat.plan.basis.landSpeed);
  near(landRoll(7, 0, 1, 0.4), 5);
  // enough backspin sends it back the way it came
  const back = planMove({ do: 'tumble', from: [100, 300], to: [500, 500], radius: 20, spin: -60 });
  assert.ok(back.plan.basis.groundSpeed < 0 && end(back).x < 500);
  near(back.plan.basis.groundSpeed, landRoll(back.plan.basis.landSpeed, -60, 20, 0.4));
  // a ring keeps more of its spin's say
  const ring = planMove({ do: 'tumble', from: [100, 300], to: [500, 500], radius: 20, spin: 0, shape: 'ring' });
  near(ring.plan.basis.groundSpeed, ring.plan.basis.landSpeed / (1 + ROLL_SHAPES.ring));
});

test('a box slides on: its speed across kept, its spin stopped, landing on a face; then: roll is refused for it', () => {
  const box = planMove({ do: 'tumble', who, from: [100, 300], to: [500, 500], radius: 20, shape: 'box', boxes: [{ x: 700, y: 400, w: 50, h: 120 }] });
  const b = box.plan.basis;
  assert.deepEqual([b.landing, b.landingRule, b.inertia], ['slide', 'a box slides on', null]);
  near(b.groundSpeed, b.landSpeed);
  // the usual spin is the nearest to v / r that lands it on a face: a whole quarter turn
  near(b.landAngle / QUARTER, Math.round(b.landAngle / QUARTER), 1e-9);
  near(b.spin, faceSpin(0, b.landSpeed / 20, b.flightSeconds));
  assert.match(box.reason, /the usual: the spin nearest v \/ r that lands it on a face\).*slides on at \d+ px a second, its spin stopped by the floor \(a box slides on\), then goes [\d.]+ px until its boxes\[0\] stops it dead, [\d.]+ s in all/);
  assert.deepEqual([b.endedBy, b.box], ['box', 0]);
  near(end(box).x + 20, 700);
  const slid = sampleMove(box, box.plan.landAt + 0.1);
  assert.deepEqual([slid.air, slid.rolls, slid.spin], [0, 0, 0]); near(slid.angle, b.landAngle);
  assert.deepEqual(checkMove(box).findings, []);
  assert.equal(checkMove(box).measures['roll-slip'], null, 'a slide owes no turn');
  // a ball may be told to slide (ice), and a box never to roll
  assert.equal(planMove({ do: 'tumble', from: [0, 0], to: [100, 100], radius: 5, then: 'slide' }).plan.basis.landingRule, 'the intent says then: slide');
  assert.equal(planMove({ do: 'tumble', from: [0, 0], to: [100, 100], radius: 5, then: 'roll', shape: 'disc' }).plan.basis.landingRule, 'the intent says then: roll');
  assert.throws(() => planMove({ do: 'tumble', who, from: [0, 0], to: [100, 100], radius: 5, then: 'roll', shape: 'box' }), /shots\[1\] \("die"\): a box does not roll — then: 'slide', or a round shape \(shape: 'ball'\)/);
  // faceSpin: the nearest landing on a face, any number of faces
  near(faceSpin(0, 10.5, 1), 7 * QUARTER);   // 6.68 quarters: the nearest face is the 7th, not the 6th near(faceSpin(0.1, 0, 2, 3), -0.05);
});

test('a tumble that lands and stays: no speed across', () => {
  const drop = planMove({ do: 'tumble', from: [300, 100], to: [300, 500], radius: 10 });
  assert.equal(drop.plan.basis.groundSpeed, 0); assert.equal(drop.plan.seconds, drop.plan.landAt);
  assert.match(drop.reason, /then stays where it lands/);
  assert.deepEqual([end(drop).x, end(drop).y], [300, 500]);
});

test('refusals name the entry and the fix in its own keys', () => {
  const r = (intent, re) => assert.throws(() => planMove({ do: 'tumble', who, from: [0, 300], to: [300, 500], radius: 10, ...intent }), re);
  r({ radius: 0 }, /radius is a number from 1/);
  r({ then: 'bounce' }, /then is 'roll' or 'slide' — what it does once it lands; not "bounce"/);
  r({ shape: 'star' }, /shape is 'ball', 'disc', 'ring', 'box' — not "star"/);
  r({ floor: 400 }, /a tumble lands on the floor at to \(y 510\) — drop floor, or set to's y to 390/);
  r({ from: [0, 600] }, /a tumble starts at y 600, below the floor it lands on \(to's y 500\) — start it above the floor/);
  r({ boxes: [{ x: 290, y: 450, w: 30, h: 60 }] }, /lands inside its boxes\[0\] — move to out of it, or the box/);
  r({ spin: 'fast' }, /spin is a number/);
  r({ velocity: [1, 1] }, /takes do, name, who, model, from, to, apex, seconds, floor, boxes, radius, spin, angle, shape, then — not "velocity"/);
  r({ model: { name: 'free-spin', resistance: 0, kinetic: 0 } }, /after it lands it would still be rolling at 30 s — a slower throw or a box in its way, or a resistance that stops it in time \(model: \{name: 'free-spin', resistance: 0\.\d\d\}\)/);
  r({ shape: 'box', model: { name: 'free-spin', kinetic: 0, static: 0 } }, /still be sliding at 30 s — a slower throw or a box in its way, or a friction that stops it in time \(model: \{name: 'free-spin', kinetic: 0\.\d\d\}\)/);
  // following the hint plans: the value it names stops it in time
  for (const [extra, key] of [[{}, 'resistance'], [{ shape: 'box' }, 'kinetic']]) {
    const intent = { do: 'tumble', from: [0, 300], to: [300, 500], radius: 10, ...extra, model: { name: 'free-spin', resistance: 0, kinetic: 0, static: 0 } };
    let said = '';
    try { planMove(intent); } catch (e) { said = e.message; }
    const value = Number(said.match(new RegExp(`${key}: ([\\d.]+)`))[1]);
    const followed = planMove({ ...intent, model: { ...intent.model, [key]: value, ...(key === 'kinetic' ? { static: value } : {}) } });
    assert.ok(followed.plan.seconds <= 30 && followed.plan.basis.endedBy === 'rest', key);
  }
  r({ model: { name: 'free-spin', kinetic: 0.5, static: 0.1 } }, /static friction \(0\.1\) is under its kinetic/);
  assert.equal(planMove({ do: 'tumble', from: [0, 300], to: [300, 500], radius: 10, floor: 510 }).plan.world.floor, 510);
  assert.throws(() => planMove({ do: 'tumble', from: [0, 300], to: 'there', radius: 10 }), /to is a point/);
});

test('the same for the same intent; the critics read the flight and the floor apart', () => {
  const intent = { do: 'tumble', who, from: [0, 300], to: [300, 500], radius: 10, spin: 30 };
  assert.deepEqual(planMove(intent), planMove({ ...intent }));
  const m = planMove(intent);
  assert.deepEqual(m.checks, ['spin', 'spacing', 'contact', 'roll-slip']);
  const c = checkMove(m);
  assert.deepEqual(c.findings, []);
  near(c.bases.spin.spin, 30, 1e-9); assert.ok(c.measures.spin < 0.01 && c.bases.spin.flight < 1e-9);   // the landing changes the spin once: a step, never a flick
  near(c.measures.spacing, 1, 1e-6);   // the flight shows its whole gravity; the floor's samples are not read
  assert.ok(c.measures['roll-slip'] < 1e-9);
  const track = sampleTrack(m);
  assert.ok(track.samples.some((s) => s.air === 1) && track.samples.some((s) => s.air === 0));
});

test('a box given its own spin lands at a slant, and says so; with the usual spin it lands flat', () => {
  const flat = planMove({ do: 'tumble', from: [100, 300], to: [500, 500], radius: 20, shape: 'box' });
  assert.ok(flat.plan.basis.slant < 1e-9); assert.doesNotMatch(flat.reason, /slant/);
  const given = planMove({ do: 'tumble', from: [100, 300], to: [500, 500], radius: 20, shape: 'box', spin: 10 });
  const expect = ((x) => (Math.abs(x - Math.round(x / QUARTER) * QUARTER) * 180) / Math.PI)(given.plan.basis.landAngle);
  near(given.plan.basis.slant, expect); assert.ok(expect > 0.5);
  assert.match(given.reason, /its spin stopped by the floor, at a slant [\d.]+° off a face \(the spin given; leave spin out to land flat\)/);
  assert.equal(planMove({ do: 'tumble', from: [100, 300], to: [500, 500], radius: 20 }).plan.basis.slant, null);
});

test('wrappers on a tumble: held still it is not in flight, and once it rolls it turns as it is moved', () => {
  for (const shape of ['ball', 'box']) {
    const tumble = planMove({ do: 'tumble', who, from: [100, 300], to: [500, 500], radius: 20, shape });
    for (const [name, move] of [['followThrough', followThrough(tumble, { by: 25 })], ['anticipate', anticipate(tumble, { by: 15, share: 0.05 })], ['overshoot', overshoot(tumble, { by: 20 })], ['hold', hold(tumble, { at: 0.3, seconds: 0.2 })]]) {
      const c = checkMove(move);
      assert.deepEqual(c.findings, [], `${shape} · ${name}: ${JSON.stringify(c.findings.map((f) => f.message))}`);
    }
    // the wind-up holds it at its start: not in flight, not spinning
    const wound = sampleMove(anticipate(tumble, { share: 0.2 }), 0.3);
    assert.deepEqual([wound.air, wound.spin], [0, 0]);
  }
  // a ball's follow-through after it rolled to rest turns it with the push: distance / radius
  const ball = planMove({ do: 'tumble', from: [100, 300], to: [500, 500], radius: 20 }), ft = followThrough(ball, { by: 25 });
  const rest = sampleMove(ball, ball.plan.seconds), out = sampleMove(ft, ball.plan.seconds + (ft.plan.seconds - ball.plan.seconds) / 3);
  near(out.angle - rest.angle, (out.x - rest.x) / 20);
  assert.ok(Math.abs(out.x - rest.x) > 1);
  // the default anticipation pulls back through its landing, cut back at the floor: nothing goes in, nothing is found
  for (const move of [anticipate(ball), anticipate(ball, { share: 0.4, by: 200 }), overshoot(ball, { by: 200 }), followThrough(ball, { by: 200 })]) {
    const c = checkMove(move);
    assert.deepEqual(c.findings, [], JSON.stringify(c.findings.map((f) => f.message)));
    for (const sample of sampleTrack(move).samples) assert.ok(sample.y <= 500 + 1e-9, 'never below where it lands');
  }
});
