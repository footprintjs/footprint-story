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

test('a wrapper respects its plan\'s world: a roll on the floor between boxes winds up, follows through and overshoots only to their sides', () => {
  const roll = planMove({ do: 'roll', who: 'ball', from: [100, 480], to: [660, 480], radius: 20, boxes: [{ x: 20, y: 400, w: 40, h: 100 }, { x: 700, y: 400, w: 40, h: 100 }] });
  for (const [name, move] of [['anticipate', anticipate(roll, { by: 100 })], ['follow-through', followThrough(roll, { by: 100 })], ['overshoot', overshoot(roll, { by: 100 })]]) {
    const xs = sampleTrack(move).samples.map((s) => s.x);
    assert.ok(Math.min(...xs) >= 80 - 1e-9 && Math.max(...xs) <= 680 + 1e-9, `${name}: ${Math.min(...xs)}…${Math.max(...xs)}`);
    const c = checkMove(move);
    assert.deepEqual(c.findings, [], name); assert.equal(c.measures.contact, 0);
  }
  // the wind-up is cut back along itself to the box's side: at its fullest it touches, never enters
  const wound = anticipate(roll, { by: 100, share: 0.2 });
  near(sampleMove(wound, 0.2 * roll.plan.seconds).x, 80, 1e-9);
  // with no world in the way the offset is whole
  const free = planMove({ do: 'roll', from: [100, 480], to: [660, 480], radius: 20 });
  near(sampleMove(anticipate(free, { by: 100, share: 0.2 }), 0.2 * free.plan.seconds).x, 0, 1e-9);
});

test('a follow-through\'s end sample is held like the rest of its tail; a last step a hair long is not read', () => {
  // found by the property: a radius-1 roll down 16.5°, arriving at 141 px a second, followed through by 0.29 px
  const phi = (16.461549113929117 * Math.PI) / 180;
  const roll = planMove({ do: 'roll', from: [0, 0], to: [30 * Math.cos(phi), 30 * Math.sin(phi)], slope: 16.461549113929117, radius: 1 });
  const move = followThrough(roll, { by: 0.2924279980798362 });
  assert.equal(sampleMove(move, move.plan.seconds).spin, 0);
  assert.ok(sampleMove(roll, roll.plan.seconds).spin > 100, 'the roll itself still moves at its end');
  assert.ok(checkMove(move).measures.spin <= SPIN_MOST);
  assert.equal(sampleMove(overshoot(roll, { by: 5 }), 1e9).spin, 0);
  assert.equal(sampleMove(anticipate(roll), 1e9).spin, sampleMove(roll, roll.plan.seconds).spin, 'an anticipation ends as its move does');
});

test('a follow-through and an overshoot leave the end at the speed the move arrives with: no jump at the hand-over, on any roll', () => {
  const speedAt = (move, t, h = 1e-7) => { const a = sampleMove(move, t - h), b = sampleMove(move, t + h); return [(b.x - a.x) / (2 * h), (b.angle - a.angle) / (2 * h)]; };
  const level = planMove({ do: 'roll', from: [0, 490], to: [30, 490], radius: 1 });   // to rest at to
  const downhill = planMove({ do: 'roll', from: [0, 0], to: [200 * Math.cos(0.2), 200 * Math.sin(0.2)], slope: (0.2 * 180) / Math.PI, radius: 5 });   // arrives moving
  for (const roll of [level, downhill]) {
    const d = roll.plan.seconds, arrive = speedAt(roll, d - 1e-6), same = (a, b) => assert.ok(Math.abs(a - b) <= 0.05 + 1e-3 * Math.abs(b), `${a} ≉ ${b}`);
    for (const move of [followThrough(roll, { by: 8 }), followThrough(roll, { by: 0.3 }), overshoot(roll, { by: 6 })]) {
      const before = speedAt(move, d - 1e-6), after = speedAt(move, d + 1e-6);
      same(after[0], before[0]); same(after[1], before[1]);
      if (move.wrappers[0] === 'follow-through') same(after[0], arrive[0]);
      assert.ok(checkMove(move).measures.spin <= SPIN_MOST, `${move.wrappers[0]} ${checkMove(move).measures.spin}`);
    }
  }
  // a move that arrives fast follows through further than asked, never stopping dead: all carry
  const fast = followThrough(downhill, { by: 0.3 }), d = downhill.plan.seconds;
  const furthest = Math.max(...sampleTrack(fast).samples.filter((s) => s.t > d).map((s) => Math.hypot(s.x - sampleMove(downhill, d).x, s.y - sampleMove(downhill, d).y)));
  assert.ok(furthest > 0.3);
});

test('the property\'s counterexamples, pinned: a short roll followed through, at rest or arriving, or wound up', () => {
  for (const [distance, slope, by] of [[30, 0, 8.212139378517993], [30, -6.188254797266435, 0.237935905405177], [30, 16.461549113929117, 0.2924279980798362], [30, 13.071056259582596, 12.488188017256634], [30, -6.752967200880146, 0.365066528319369]]) {
    const phi = (slope * Math.PI) / 180;
    const roll = planMove({ do: 'roll', from: [0, 0], to: [distance * Math.cos(phi), distance * Math.sin(phi)], slope, radius: 1 });
    const c = checkMove(followThrough(roll, { by }));
    assert.ok(c.measures.spin <= SPIN_MOST && c.measures['roll-slip'] <= 0.05, `${slope}°: spin ${c.measures.spin}`);
  }
});

test('a follow-through on a slide keeps its arrival speed at the hand-over and through its first frame: no brake, no jolt', () => {
  const slide = planMove({ do: 'slide', from: [0, 300], speed: 600, to: [300, 300] }), d = slide.plan.seconds;
  const arrive = (sampleMove(slide, d).x - sampleMove(slide, d - 1e-6).x) / 1e-6;
  assert.ok(arrive > 300);
  for (const by of [60, 24, 200]) {
    const move = followThrough(slide, { by });
    const leave = (sampleMove(move, d + 1e-6).x - sampleMove(move, d).x) / 1e-6, frame = (sampleMove(move, d + 1 / 120).x - sampleMove(move, d).x) * 120;
    assert.ok(Math.abs(leave - arrive) < 1e-3 * arrive, `by ${by}: leaves at ${leave}, arrived at ${arrive}`);
    assert.ok(frame > 0.97 * arrive, `by ${by}: its first frame keeps the speed (${frame} of ${arrive})`);
  }
});

test('a short roll wound up from the start reads as smooth: the counterexample of seed 1506228752', () => {
  const slope = -19.79580363280165, phi = (slope * Math.PI) / 180;
  const roll = planMove({ do: 'roll', from: [0, 0], to: [30 * Math.cos(phi), 30 * Math.sin(phi)], slope, radius: 1 });
  assert.ok(checkMove(anticipate(roll, { share: 0.25 })).measures.spin <= SPIN_MOST);
});
