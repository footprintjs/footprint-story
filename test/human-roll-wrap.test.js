// A wrapped roll stays a roll (0.31.0): a wrapper reshapes where it goes and its turn follows (turnVector), so
// roll-slip and spin pass every wrapper over a roll — side on, on a slope, on a floor seen from above — while a slide's
// and a tumble's angle stay their own. And a fast spin is read as it turns: a planned move by its samples' own spin, a
// hand-drawn track the short way, its basis saying the fastest spin it can tell.
import test from 'node:test';
import assert from 'node:assert/strict';
import { planMove, sampleMove, sampleTrack, checkMove, anticipate, followThrough, hold, overshoot, ROLL_SLIP_MOST, SPIN_MOST } from '../human.js';

const near = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b)), `${a} ≉ ${b}`);
const WRAPS = {
  overshoot: (m) => overshoot(m, { by: 30 }),
  anticipate: (m) => anticipate(m, { share: 0.2 }),
  'follow-through': (m) => followThrough(m, { by: 25 }),
  hold: (m) => hold(m, { at: m.plan.seconds / 3, seconds: 0.4 }),
  all: (m) => hold(overshoot(followThrough(anticipate(m, { share: 0.2 })), { by: 20 }), { at: 0.5, seconds: 0.3 }),
};
const ROLLS = {
  level: { do: 'roll', who: 'ball', from: [100, 480], to: [660, 480], radius: 20 },
  left: { do: 'roll', who: 'ball', from: [700, 480], speed: -300, radius: 12, angle: 2 },
  slope: { do: 'roll', who: 'ball', from: [0, 0], to: [394, 69.5], radius: 10, slope: 10 },
  floor: { do: 'roll', who: 'ball', plane: 'floor', from: [0, 0], to: [300, 400], radius: 10 },
};

test('every wrapper over a roll keeps it rolling: the angle is the start turn plus turnVector · the way travelled', () => {
  for (const [rollName, intent] of Object.entries(ROLLS)) {
    const roll = planMove(intent), T = roll.plan.turnVector, [x0, y0] = roll.plan.from;
    for (const [wrapName, wrap] of Object.entries(WRAPS)) {
      const move = wrap(roll), label = `${rollName} · ${wrapName}`;
      for (const s of sampleTrack(move).samples) near(s.angle, roll.plan.angle + T[0] * (s.x - x0) + T[1] * (s.y - y0), 1e-9);
      const c = checkMove(move);
      assert.ok(c.measures['roll-slip'] <= ROLL_SLIP_MOST && c.measures['roll-slip'] < 1e-5, `${label}: roll-slip ${c.measures['roll-slip']}`);
      assert.ok(c.measures.spin <= SPIN_MOST, `${label}: spin ${c.measures.spin}`);
      assert.deepEqual(c.findings.filter((f) => f.critic === 'roll-slip' || f.critic === 'spin'), [], label);
      // its ends are the roll's own
      const a = sampleMove(move, move.plan.seconds), b = sampleMove(roll, roll.plan.seconds);
      assert.deepEqual([a.x, a.y, a.angle], [b.x, b.y, b.angle]);
    }
  }
});

test('a wrapped roll\'s spin is its angle\'s rate, and a hold stops it', () => {
  const roll = planMove(ROLLS.level), move = overshoot(anticipate(roll, { share: 0.2 }), { by: 30 });
  // in the wind-up, mid-roll, in the overshoot's rise and in its settle back
  for (const t of [0.3, 0.75, 2, 4.05, 4.5, 5.2]) {
    const h = 1e-5, rate = (sampleMove(move, t + h).angle - sampleMove(move, t - h).angle) / (2 * h);
    near(sampleMove(move, t).spin, rate, 1e-4);
  }
  const held = hold(roll, { at: 1, seconds: 0.5 });
  assert.equal(sampleMove(held, 1.2).spin, 0);
  near(sampleMove(held, 1.2).angle, sampleMove(roll, 1).angle);
  near(sampleMove(held, 2).spin, sampleMove(roll, 1.5).spin);
});

test('a slide\'s and a tumble\'s angle stay their own under a wrapper: they name no turnVector', () => {
  const slide = planMove({ do: 'slide', from: [0, 300], speed: 500, angle: 0.3 });
  assert.equal(slide.plan.turnVector, undefined);
  for (const s of sampleTrack(overshoot(slide, { by: 40 })).samples) { assert.equal(s.angle, 0.3); assert.equal(s.spin, 0); }
  const tumble = planMove({ do: 'tumble', from: [100, 300], to: [500, 500], radius: 20, shape: 'box' });
  const wrapped = overshoot(tumble, { by: 40 });
  for (const t of [0.2, 0.5, 1, tumble.plan.seconds]) assert.equal(sampleMove(wrapped, t).angle, sampleMove(tumble, t).angle);
});

test('a fast, small roll is read as it turns: by its own spin, past half a turn a sample', () => {
  // radius 1 px from 529 px a second: 529 rad/s, 4.4 rad between samples at 120 a second — past half a turn
  const tiny = planMove({ do: 'roll', who: 'bead', from: [0, 490], to: [2000, 490], radius: 1 });
  assert.ok(tiny.plan.basis.speed > Math.PI * 120);
  const c = checkMove(tiny);
  assert.deepEqual(c.findings, []);
  assert.equal(c.bases.spin.readBy, 'spin'); assert.equal(c.bases.spin.mostReadable, null);
  assert.ok(c.measures.spin < 1e-6 && c.measures['roll-slip'] < 1e-9);
  near(c.bases['roll-slip'].rate, 1, 1e-9);
  // wrapped, still read as it turns
  assert.deepEqual(checkMove(overshoot(tiny, { by: 30 })).findings.filter((f) => f.critic === 'spin' || f.critic === 'roll-slip'), []);
});

test('a hand-drawn track with no spin is read the short way, and its basis says the fastest spin it can tell — denser sampling tells faster', () => {
  const tiny = planMove({ do: 'roll', from: [0, 490], to: [2000, 490], radius: 1 });
  const hand = { family: 'roll', name: 'reel:hand', checks: ['spin', 'roll-slip'], plan: () => ({ ...tiny.plan }), sample: (p, t) => { const s = sampleMove(tiny, t); return { x: s.x, y: s.y, angle: s.angle }; } };
  const move = planMove({ do: 'roll', who: 'hand', model: 'reel:hand' }, { models: [hand] });
  const at120 = checkMove(move, { models: [hand] }), at1000 = checkMove(move, { models: [hand], rate: 1000 });
  assert.equal(at120.bases.spin.readBy, 'short');
  near(at120.bases.spin.mostReadable, Math.PI * 120, 1e-9);
  near(at1000.bases.spin.mostReadable, Math.PI * 1000, 1e-6);
  assert.ok(at120.bases.spin.mostReadable < tiny.plan.basis.speed && at1000.bases.spin.mostReadable > tiny.plan.basis.speed);
  assert.ok(at1000.measures.spin < 1e-6);
  // roll-slip reads the turn the drawn distance owes, so it tells the fast wheel true at any rate
  assert.ok(at120.measures['roll-slip'] < 1e-9 && at1000.measures['roll-slip'] < 1e-9);
});
