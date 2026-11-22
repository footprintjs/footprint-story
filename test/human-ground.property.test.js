// Rolling, sliding and tumbling as properties over generated intents (0.31.0): the closed forms (a roll's distance
// v²(1 + k) / (2 C g) and its turn distance / radius, a slide's v² / (2 μ g), a kept spin in flight, the hand-over
// speed), `to` reached exactly on any slope, never inside a box, the same plan for the same intent, and the critics:
// every model's own track passes roll-slip and spin, and a turn scaled off distance / radius is always caught.
// FC_RUNS=20000 npm test runs a deep sweep.
import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { planMove, sampleMove, sampleTrack, checkMove, anticipate, followThrough, hold, overshoot, depthIn, makeWorld, ROLL_SHAPES, GRAVITY, CONTACT_MOST, ROLL_SLIP_MOST, SPIN_MOST } from '../human.js';

const RUNS = Number(process.env.FC_RUNS) || 300;
// a track is sampled at 120 a second over up to 30 s: the critics' properties run a tenth as often
const HEAVY = Math.max(20, Math.round(RUNS / 10));
const close = (a, b, tol, scale = 1) => Math.abs(a - b) <= tol * Math.max(1, scale, Math.abs(a), Math.abs(b));
const coord = fc.double({ min: -1500, max: 1500, noNaN: true });
const shape = fc.constantFrom(...Object.keys(ROLL_SHAPES));
/** The refusals a generated intent may meet, each in words: anything else thrown is a fault, never skipped. */
const EXPECTED = /would still be moving after 30 s|after it lands it would still be (rolling|sliding)|neither slows down nor starts by itself|nothing moves it|starts inside its boxes|starts against a box|under one frame/;
const refused = (f) => { try { return f(); } catch (e) { if (EXPECTED.test(e.message)) return null; throw e; } };

test('a roll on a level floor stops after v²(1 + k) / (2 C g), in v(1 + k) / (C g), its turn distance / radius', () => {
  fc.assert(fc.property(coord, coord, fc.double({ min: -3000, max: 3000, noNaN: true }), fc.double({ min: 1, max: 200, noNaN: true }), shape, fc.double({ min: 0.02, max: 1, noNaN: true }),
    (x, y, speed, radius, sh, resistance) => {
      fc.pre(Math.abs(speed) >= 1);
      const k = ROLL_SHAPES[sh], a = (resistance * GRAVITY) / (1 + k), d = (speed * speed) / (2 * a);
      const move = refused(() => planMove({ do: 'roll', from: [x, y], speed, radius, shape: sh, model: { name: 'no-slip', resistance } }));
      if (Math.abs(speed) / a > 30) { assert.equal(move, null, 'a roll past 30 s is refused'); return; }
      assert.ok(close(move.plan.seconds, Math.abs(speed) / a, 1e-9));
      const last = sampleMove(move, move.plan.seconds);
      assert.ok(close(last.x - x, Math.sign(speed) * d, 1e-9, d)); assert.ok(last.y === y);
      assert.ok(close(last.angle, (last.x - x) / radius, 1e-9, d / radius), 'the turn is distance / radius');
      assert.equal(last.spin, 0);
    }), { numRuns: RUNS });
});

test('a slide on a level floor stops after v² / (2 μ g); its angle never changes', () => {
  fc.assert(fc.property(coord, fc.double({ min: 1, max: 3000, noNaN: true }), fc.double({ min: 0.05, max: 2, noNaN: true }), fc.double({ min: -10, max: 10, noNaN: true }), (x, speed, kinetic, angle) => {
    const move = refused(() => planMove({ do: 'slide', from: [x, 0], speed, angle, model: { name: 'coulomb', kinetic } }));
    if (speed / (kinetic * GRAVITY) > 30) { assert.equal(move, null); return; }
    const d = (speed * speed) / (2 * kinetic * GRAVITY), last = sampleMove(move, move.plan.seconds);
    assert.ok(close(last.x - x, d, 1e-9, d)); assert.equal(last.angle, angle);
    assert.equal(sampleMove(move, move.plan.seconds / 3).angle, angle);
  }), { numRuns: RUNS });
});

test('a roll or a slide to `to` on any slope ends on `to` exactly, at rest when the slope slows it, its path on the slope\'s line', () => {
  fc.assert(fc.property(fc.constantFrom('roll', 'slide'), coord, coord, fc.double({ min: -40, max: 40, noNaN: true }), fc.double({ min: 5, max: 1500, noNaN: true }), fc.boolean(), fc.double({ min: 0, max: 1, noNaN: true }),
    (kind, x, y, slope, distance, right, share) => {
      const phi = (slope * Math.PI) / 180, s = right ? 1 : -1, to = [x + s * distance * Math.cos(phi), y + s * distance * Math.sin(phi)];
      const intent = { do: kind, from: [x, y], to, slope, ...(kind === 'roll' ? { radius: 10 } : {}) };
      const move = refused(() => planMove(intent));
      if (move === null) return;   // a slope it neither slows on nor starts on by itself, or a roll past 30 s: refused, in words
      assert.deepEqual([sampleMove(move, move.plan.seconds).x, sampleMove(move, move.plan.seconds).y], to);
      const mid = sampleMove(move, share * move.plan.seconds), off = (mid.x - x) * Math.sin(phi) - (mid.y - y) * Math.cos(phi);
      assert.ok(Math.abs(off) < 1e-6 * Math.max(1, Math.abs(x), Math.abs(y), distance), 'on the slope\'s line');
      const b = move.plan.basis;
      if (b.speed > 0) assert.equal(b.endSpeed, 0, 'a speed picked by the law brings it to rest at to');
      if (kind === 'roll') assert.ok(close(sampleMove(move, move.plan.seconds).angle, s * b.distance / 10, 1e-9, b.distance / 10));
    }), { numRuns: RUNS });
});

test('a roll among boxes never goes into one; when it stops at one, it touches its side', () => {
  const box = fc.record({ x: fc.double({ min: -600, max: 600, noNaN: true }), w: fc.double({ min: 1, max: 200, noNaN: true }), h: fc.double({ min: 1, max: 300, noNaN: true }) });
  fc.assert(fc.property(fc.array(box, { maxLength: 3 }), fc.double({ min: -1200, max: 1200, noNaN: true }), fc.double({ min: 1, max: 40, noNaN: true }), (raw, speed, radius) => {
    // standing on the floor at y 500, kept apart (boxes may touch, not overlap)
    const boxes = [];
    for (const b of raw) if (boxes.every((o) => b.x + b.w <= o.x || o.x + o.w <= b.x)) boxes.push({ x: b.x, y: 500 - b.h, w: b.w, h: b.h });
    const move = refused(() => planMove({ do: 'roll', from: [0, 500 - radius], speed, radius, boxes }));
    if (move === null) return;   // starts inside or against a box: refused, in words
    const world = makeWorld({ floor: 500, boxes });
    for (const s of sampleTrack(move, { rate: 60 }).samples) assert.ok(depthIn(s.x, s.y, world, radius) <= CONTACT_MOST);
    if (move.plan.basis.endedBy === 'box') {
      const b = boxes[move.plan.basis.box], x = sampleMove(move, move.plan.seconds).x;
      assert.ok(Math.min(Math.abs(x + radius - b.x), Math.abs(x - radius - b.x - b.w)) < 1e-6);
    }
  }), { numRuns: RUNS });
});

test('a tumble keeps its spin in flight, hands over at the landing by the rule, and lands on `to` exactly', () => {
  fc.assert(fc.property(coord, fc.double({ min: 0, max: 800, noNaN: true }), fc.double({ min: -800, max: 800, noNaN: true }), fc.double({ min: 1, max: 40, noNaN: true }),
    fc.option(fc.double({ min: -80, max: 80, noNaN: true }), { nil: undefined }), fc.constantFrom('ball', 'disc', 'ring', 'box'), fc.double({ min: 0, max: 0.99, noNaN: true }),
    (x, drop, across, radius, spin, sh, share) => {
      const move = refused(() => planMove({ do: 'tumble', from: [x, 0], to: [x + across, drop], radius, shape: sh, ...(spin === undefined ? {} : { spin }) }));
      if (move === null) return;   // a throw over in under a frame, or one that never stops in 30 s
      const p = move.plan, b = p.basis, t = share * p.landAt;
      const s = sampleMove(move, t);
      assert.ok(close(s.angle, p.angle + b.spin * t, 1e-9, Math.abs(b.spin * p.landAt)), 'the spin is kept in flight');
      assert.equal(s.spin, b.spin);
      const landed = sampleMove(move, p.landAt);
      assert.ok(landed.x === x + across && landed.y === drop, 'lands on to exactly (−0 and 0 alike)');
      assert.equal(b.landing, sh === 'box' ? 'slide' : 'roll');
      const v = b.landSpeed * Math.sign(across), k = ROLL_SHAPES[sh];
      assert.ok(close(b.groundSpeed, sh === 'box' ? v : (v + k * radius * b.spin) / (1 + k), 1e-9, Math.abs(v) + Math.abs(radius * b.spin)));
      if (sh === 'box' && spin === undefined) assert.ok(close(b.landAngle / (Math.PI / 2), Math.round(b.landAngle / (Math.PI / 2)), 1e-9), 'a box lands on a face');
    }), { numRuns: RUNS });
});

test('the same intent, the same plan; every model\'s own track passes roll-slip and spin; a turn scaled off distance / radius is caught', () => {
  fc.assert(fc.property(fc.constantFrom('roll', 'slide', 'tumble'), fc.double({ min: 30, max: 900, noNaN: true }), fc.double({ min: 10, max: 40, noNaN: true }), fc.double({ min: -20, max: 20, noNaN: true }),
    fc.double({ min: 0.2, max: 3, noNaN: true }).filter((f) => Math.abs(f - 1) > 0.1), (kind, distance, radius, slope, factor) => {
      const intent = kind === 'tumble' ? { do: 'tumble', from: [0, 0], to: [distance, 300], radius }
        : { do: kind, from: [0, 0], to: [distance * Math.cos((slope * Math.PI) / 180), distance * Math.sin((slope * Math.PI) / 180)], slope, radius };
      const move = refused(() => planMove(intent));
      if (move === null) return;
      assert.deepEqual(planMove(structuredClone(intent)), move);
      const c = checkMove(move);
      assert.deepEqual(c.findings, [], JSON.stringify(c.findings));
      if (kind === 'roll') assert.ok(c.measures['roll-slip'] < 1e-6);
      assert.ok(c.measures.spin === null || c.measures.spin <= SPIN_MOST);
      // the same track, its angle scaled: a wheel turning at the wrong rate (radius 10 or more keeps every step's
      // turn under half a turn, which is all a drawn angle can show)
      const scaled = { family: 'roll', name: 'reel:scaled', checks: ['roll-slip'], plan: () => ({ ...move.plan }), sample: (p, t) => { const s = sampleMove(move, t); return { x: s.x, y: s.y, angle: s.angle * factor }; } };
      if (kind !== 'roll') return;
      const bad = checkMove(planMove({ do: 'roll', model: 'reel:scaled' }, { models: [scaled] }), { models: [scaled] });
      assert.ok(bad.measures['roll-slip'] > ROLL_SLIP_MOST, `factor ${factor}`);
      assert.ok(close(bad.bases['roll-slip'].rate, factor, 1e-6));
    }), { numRuns: HEAVY });
});

test('a wrapped roll stays a roll: every wrapper over any roll passes roll-slip and spin', () => {
  const wrapper = fc.constantFrom(
    (m, by) => overshoot(m, { by }), (m) => anticipate(m, { share: 0.25 }), (m, by) => followThrough(m, { by }),
    (m) => hold(m, { at: m.plan.seconds / 2, seconds: 0.3 }));
  fc.assert(fc.property(fc.double({ min: 30, max: 900, noNaN: true }), fc.double({ min: 1, max: 40, noNaN: true }), fc.double({ min: -20, max: 20, noNaN: true }),
    fc.boolean(), wrapper, fc.double({ min: 0, max: 80, noNaN: true }), (distance, radius, slope, floor, wrap, by) => {
      const phi = (slope * Math.PI) / 180;
      const intent = floor ? { do: 'roll', plane: 'floor', from: [0, 0], to: [distance * Math.cos(phi), distance * Math.sin(phi)], radius }
        : { do: 'roll', from: [0, 0], to: [distance * Math.cos(phi), distance * Math.sin(phi)], slope, radius };
      const roll = refused(() => planMove(intent));
      if (roll === null) return;
      const c = checkMove(wrap(roll, by));
      assert.ok(c.measures['roll-slip'] === null || c.measures['roll-slip'] <= ROLL_SLIP_MOST, `roll-slip ${c.measures['roll-slip']}`);
      assert.ok(c.measures.spin <= SPIN_MOST, `spin ${c.measures.spin}`);
    }), { numRuns: HEAVY });
});
