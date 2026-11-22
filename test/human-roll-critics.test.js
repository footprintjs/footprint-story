// The roll-slip and spin critics (0.31.0), each measured on a drawn track — hand-made bad tracks from a tool's own
// model are caught, with the entry named and the fix in the intent's keys; good ones pass, wrapped angles included.
// And spacing reads only a tumble's flight (samples marked air: 0 are on the floor).
import test from 'node:test';
import assert from 'node:assert/strict';
import { planMove, checkMove, HUMAN_CRITICS, ROLL_SLIP_MOST, SPIN_MOST, SPIN_FLOOR, GRAVITY } from '../human.js';
import { wrapAngle } from '../geometry.js';

const who = 'scene[4] ("wheel")';
const near = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b)), `${a} ≉ ${b}`);

/** A tool's own roll, drawn by hand: across at 200 px a second for 2 s, its angle `rate` × distance / radius, bent by `bend`. */
const wheel = {
  family: 'roll', name: 'reel:wheel', options: ['rate', 'wrap', 'flick', 'radius', 'floor', 'still'], checks: ['roll-slip', 'spin'],
  plan: (intent, { options: o }) => ({ seconds: o.still ? 0.004 : 2, radius: o.radius ?? 10, rate: o.rate ?? 1, wrap: o.wrap ?? false, flick: o.flick ?? 0, floor: o.floor ?? false }),
  sample: (p, t) => {
    const d = 200 * t, raw = (p.rate * d) / p.radius + (p.flick && Math.abs(t - 1) < 1e-9 ? p.flick : 0), angle = p.wrap ? wrapAngle(raw) : raw;
    // on the floor seen from above, it heads down the floor (+y) and says so
    return p.floor ? { x: 0, y: d, angle, heading: Math.PI / 2 } : { x: d, y: 0, angle };
  },
};
const roll = (o = {}) => checkMove(planMove({ do: 'roll', who, model: { name: 'reel:wheel', ...o } }, { models: [wheel] }), { models: [wheel] });

test('the critics are the door\'s, with their limits', () => {
  assert.ok(HUMAN_CRITICS.includes('roll-slip') && HUMAN_CRITICS.includes('spin'));
  assert.deepEqual([ROLL_SLIP_MOST, SPIN_MOST, SPIN_FLOOR], [0.05, 0.1, 2 * Math.PI]);
});

test('roll-slip passes a wheel turning distance / radius — side on, on the floor, its angle wrapped into (−π, π] or not', () => {
  for (const o of [{}, { wrap: true }, { floor: true }, { floor: true, wrap: true }, { radius: 3 }]) {
    const c = roll(o);
    assert.deepEqual(c.findings, [], JSON.stringify(o));
    assert.ok(c.measures['roll-slip'] < 1e-9);
    near(c.bases['roll-slip'].rate, 1, 1e-9); near(c.bases['roll-slip'].travel, 400, 1e-9);
  }
});

test('roll-slip catches a wheel turning at the wrong rate, says how, and the fix in the intent\'s keys', () => {
  const fast = roll({ rate: 2 }).findings.find((f) => f.critic === 'roll-slip');
  assert.equal(fast.level, 'warn');
  assert.equal(fast.message, `${who}: its drawn turn is 2× distance / radius (radius 10 px, 100% astray) — it spins faster than it rolls, a wheel skidding`);
  assert.equal(fast.fix, "turn it by distance / radius: do: 'roll' (model: 'no-slip') with radius: 10 — or, if it is drawn smaller, radius: 5");
  assert.equal(fast.basis.radius, 10);
  const slow = roll({ rate: 0.5 }).findings[0];
  assert.match(slow.message, /0\.5× distance \/ radius .* it turns slower than it rolls, sliding as it goes/);
  assert.match(slow.fix, /if it is drawn larger, radius: 20$/);
  const none = roll({ rate: 0 }).findings[0];
  assert.match(none.message, /0× distance \/ radius .* it slides along without turning/);
  assert.equal(none.fix, "turn it by distance / radius: do: 'roll' (model: 'no-slip') with radius: 10");
  assert.match(roll({ rate: -1 }).findings[0].message, /-1× distance \/ radius .* it turns the wrong way for the way it goes/);
  // just inside the limit passes; just past it does not
  assert.deepEqual(roll({ rate: 1.04 }).findings, []);
  assert.equal(roll({ rate: 1.06 }).findings[0].critic, 'roll-slip');
  // the floor seen from above reads the travel along the heading
  assert.equal(roll({ rate: 2, floor: true }).findings[0].critic, 'roll-slip');
});

test('roll-slip cannot say when no radius is named, no angle is drawn, or it rolls under a pixel', () => {
  const bare = { ...wheel, name: 'reel:bare', plan: () => ({ seconds: 1 }), sample: (p, t) => ({ x: t * 100, y: 0, angle: 0 }) };
  assert.equal(checkMove(planMove({ do: 'roll', model: 'reel:bare' }, { models: [bare] }), { models: [bare] }).measures['roll-slip'], null);
  const flat = { ...wheel, name: 'reel:flat', plan: () => ({ seconds: 1, radius: 5 }), sample: (p, t) => ({ x: t * 100, y: 0 }) };
  const c = checkMove(planMove({ do: 'roll', model: 'reel:flat' }, { models: [flat] }), { models: [flat] });
  assert.deepEqual([c.measures['roll-slip'], c.measures.spin], [null, null]);
  assert.equal(roll({ still: true }).measures['roll-slip'], null);
});

test('spin catches a drawn angle that jumps between two samples, and passes a steady one', () => {
  const c = roll({ flick: 0.8 }), f = c.findings.find((x) => x.critic === 'spin');
  assert.equal(c.bases.spin.kind, 'jump'); near(c.bases.spin.at, 1 - 1 / 240, 1e-9);
  assert.match(f.message, /^scene\[4\] \("wheel"\): its drawn angle jumps at 1\.00 s \(one step turns \d+% off both neighbours\) — it flicks instead of turning$/);
  assert.match(f.fix, /let the model turn it: do: 'roll' \(radius: …\)/);
  // a step the same way for good (an angle set once by hand) flicks too
  const stepped = { ...wheel, name: 'reel:stepped', sample: (p, t) => ({ x: 200 * t, y: 0, angle: 20 * t + (t >= 1 ? 1 : 0) }) };
  assert.equal(checkMove(planMove({ do: 'roll', model: 'reel:stepped' }, { models: [stepped] }), { models: [stepped] }).bases.spin.kind, 'jump');
  // a real jump is still caught: a sudden 90° flip mid-roll, for good or for one sample — the samples' own spin says no such turn
  const flipped = (name, flip) => { const m = { ...wheel, name, checks: ['spin'], sample: (p, t) => ({ x: 200 * t, y: 0, angle: 20 * t + flip(t), spin: 20 }) }; return checkMove(planMove({ do: 'roll', who, model: name }, { models: [m] }), { models: [m] }); };
  for (const [name, flip] of [['reel:flip', (t) => (t >= 1 ? Math.PI / 2 : 0)], ['reel:blip', (t) => (Math.abs(t - 1) < 1e-9 ? Math.PI / 2 : 0)]]) {
    const c = flipped(name, flip);
    assert.equal(c.bases.spin.kind, 'jump'); assert.ok(c.measures.spin > 1, `${name}: ${c.measures.spin}`);
    assert.match(c.findings.find((f) => f.critic === 'spin').message, /its drawn angle jumps at (0\.99|1\.00) s/);
  }
  // a spin sped up hard and stopped dead, or started at once from rest, changes its rate — it never flicks
  const spun = (name, angle) => { const m = { ...wheel, name, checks: ['spin'], sample: (p, t) => ({ x: 100 * t, y: 0, angle: angle(t) }) }; return checkMove(planMove({ do: 'roll', model: name }, { models: [m] }), { models: [m] }); };
  assert.ok(spun('reel:stopped', (t) => 200 * Math.min(t, 0.05) ** 2).measures.spin <= SPIN_MOST, 'sped up, then stopped dead');
  assert.ok(spun('reel:started', (t) => (t < 1 ? 0 : 200 * (t - 1) ** 2)).measures.spin <= SPIN_MOST, 'started at once from rest');
  // a spin sped up in uneven strides (each step between its neighbours, 2, 4, 12, 14, 22, …) changes its rate unevenly — still no flick
  const strides = [0];
  for (let k = 0; k < 240; k += 1) strides.push(strides[k] + (2 * k + 6 * Math.floor(k / 2) + 2) / 120);
  assert.ok(spun('reel:strides', (t) => strides[Math.round(t * 120)]).measures.spin <= SPIN_MOST, 'uneven strides one way');
  // a wrapped angle never jumps: the turn between samples is read the short way
  assert.ok(roll({ wrap: true }).measures.spin < 1e-6);
  assert.equal(roll({ still: true }).measures.spin, null, 'under three steps: nothing to compare');
});

/** A tool's own tumble: up and down under gravity for 1 s, then on the floor 1 s; its spin `spin` + `gain` × t in the air. */
const flier = {
  family: 'tumble', name: 'reel:flier', options: ['gain', 'mark'], checks: ['spin', 'spacing'],
  plan: (intent, { options: o }) => ({ seconds: 2, gravity: GRAVITY, gain: o.gain ?? 0, mark: o.mark ?? true }),
  sample: (p, t) => {
    const u = Math.min(t, 1), y = -980 * u + 0.5 * GRAVITY * u * u, angle = 10 * u + 0.5 * p.gain * u * u;
    const s = { x: 300 * t, y, angle };
    if (p.mark) s.air = t < 1 ? 1 : 0;
    return s;
  },
};
const fly = (o = {}) => checkMove(planMove({ do: 'tumble', who, model: { name: 'reel:flier', ...o } }, { models: [flier] }), { models: [flier] });

test('spin catches a spin that changes in flight, where nothing can change it, and passes a kept one', () => {
  const kept = fly();
  assert.deepEqual(kept.findings, []);
  near(kept.bases.spin.spin, 10, 1e-6);
  const pushed = fly({ gain: 4 }), f = pushed.findings.find((x) => x.critic === 'spin');
  assert.equal(pushed.bases.spin.kind, 'flight');
  near(pushed.measures.spin, 4 * (1 - 1 / 120) / 12, 0.02);
  assert.match(f.message, /^scene\[4\] \("wheel"\): its spin changes by \d+% in the air \(about 1\d(\.\d)? rad\/s, most off at 0\.\d\d s\) — nothing touches it in flight, so its spin should hold$/);
  assert.equal(f.fix, "keep one spin in flight: do: 'tumble' (model: 'free-spin') with spin: <rad/s>");
  // unmarked, the same track is read for jumps only: a smooth change is no flick
  assert.deepEqual(fly({ gain: 4, mark: false }).findings.filter((x) => x.critic === 'spin'), []);
});

test('spacing reads a tumble\'s flight only: on the floor (air: 0) the floor holds it up', () => {
  near(fly().measures.spacing, 1, 1e-6);
  // unmarked, the second on the floor counts as half the track: a median of no fall at all
  assert.ok(fly({ mark: false }).measures.spacing < 0.5);
  assert.equal(fly({ mark: false }).findings.find((x) => x.critic === 'spacing').level, 'warn');
});
