// FABRIK (src/body/fabrik.js) by property, on any chain fast-check makes: lengths kept after every pass, every limited
// angle in its window, the miss told truthfully, the same answer twice, an unreachable target met by a straight chain,
// and (measured, no limits) the miss never growing from one pass to the next. docs/design/2026-11-bodies.md §3, §9 1B.
// FC_RUNS=20000 npm test runs a deep sweep.
import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { fabrik } from '../src/body/fabrik.js';
import { wrapAngle } from '../src/geom/angles.js';

const RUNS = Number(process.env.FC_RUNS) || 300;
const runs = (share = 1) => ({ numRuns: Math.max(20, Math.round(RUNS * share)) });
const PI = Math.PI;
const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const place = (root, parentAngle, lengths, angles) => {
  const p = [root];
  let world = parentAngle;
  lengths.forEach((l, i) => { world += angles[i]; p.push([p[i][0] + l * Math.cos(world), p[i][1] + l * Math.sin(world)]); });
  return p;
};

// fast-check's doubles lean on edge values (0, the ends): whole milliradians and tenths of a px spread them evenly too
const angle = fc.oneof(fc.double({ min: -PI, max: PI, noNaN: true }), fc.integer({ min: -3141, max: 3141 }).map((m) => m / 1000));
const length = fc.oneof(fc.double({ min: 1, max: 200, noNaN: true }), fc.integer({ min: 10, max: 2000 }).map((t) => t / 10));
const coord = fc.integer({ min: -100000, max: 100000 }).map((t) => t / 100);
/** A window [min, max] within [−2π, 2π], less than a turn wide; or none. */
const window = fc.oneof(
  fc.constant(null),
  fc.tuple(fc.double({ min: -2 * PI, max: 2 * PI - 0.01, noNaN: true }), fc.double({ min: 0, max: 2 * PI - 1e-6, noNaN: true }))
    .map(([lo, width]) => [lo, Math.min(2 * PI, lo + width)]).filter(([lo, hi]) => hi - lo < 2 * PI),
);
/** A chain: its root, parent angle, lengths, a start pose (relative angles) and a target pose of the same lengths. */
const chain = fc.integer({ min: 2, max: 16 }).chain((n) => fc.record({
  root: fc.tuple(coord, coord),
  parentAngle: angle,
  lengths: fc.array(length, { minLength: n, maxLength: n }),
  start: fc.array(angle, { minLength: n, maxLength: n }),
  goal: fc.array(angle, { minLength: n, maxLength: n }),
  limits: fc.array(window, { minLength: n, maxLength: n }),
  passes: fc.integer({ min: 1, max: 16 }),
  far: fc.double({ min: 1.001, max: 50, noNaN: true }),
}));
const lengthsHeld = (points, lengths) => lengths.every((l, i) => Math.abs(dist(points[i], points[i + 1]) - l) <= 1e-9 * l);
/** How far a relative angle lies outside its window, round the circle (0 inside). */
const outside = (relative, [lo, hi]) => {
  const mid = (lo + hi) / 2, read = mid + wrapAngle(relative - mid);
  return read >= lo && read <= hi ? 0 : Math.min(Math.abs(wrapAngle(read - lo)), Math.abs(wrapAngle(read - hi)));
};
const solve = (c, extra = {}) => fabrik({ points: place(c.root, c.parentAngle, c.lengths, c.start), lengths: c.lengths, target: place(c.root, c.parentAngle, c.lengths, c.goal).at(-1), parentAngle: c.parentAngle, ...extra });

test('property: after every pass the root is where it was given and every part has its length, with limits or without', () => {
  fc.assert(fc.property(chain, fc.boolean(), (c, limited) => {
    const r = solve(c, { passes: c.passes, ...(limited ? { limits: c.limits } : {}) });
    assert.ok(r.passes <= c.passes);
    assert.deepEqual(r.points[0], c.root);
    assert.ok(lengthsHeld(r.points, c.lengths), JSON.stringify(r.points));
  }), runs());
});

test('property: with limits, every part\'s angle (read back from the points) is in its window, and the miss is reported truthfully', () => {
  fc.assert(fc.property(chain, (c) => {
    const target = place(c.root, c.parentAngle, c.lengths, c.goal).at(-1);
    const r = fabrik({ points: place(c.root, c.parentAngle, c.lengths, c.start), lengths: c.lengths, target, parentAngle: c.parentAngle, limits: c.limits });
    let parent = c.parentAngle;
    c.lengths.forEach((_, i) => {
      const world = Math.atan2(r.points[i + 1][1] - r.points[i][1], r.points[i + 1][0] - r.points[i][0]), w = c.limits[i];
      if (w) {
        assert.ok(outside(world - parent, w) <= 1e-9, `part ${i}: ${world - parent} outside [${w}]`);
        assert.ok(r.angles[i] >= w[0] && r.angles[i] <= w[1], `part ${i}: the reported ${r.angles[i]} outside [${w}]`);
      }
      assert.ok(Math.abs(wrapAngle(r.angles[i] - (world - parent))) <= 1e-9, `part ${i}: the reported angle is not the points' one`);
      parent = world;
    });
    assert.equal(r.miss, dist(r.points.at(-1), target));
    assert.equal(r.reached, r.miss < 0.1);
    assert.ok(r.reached || r.passes === 16, 'it stops early only on reaching');
    assert.ok(r.bound.every((i, k) => Number.isInteger(i) && c.limits[i] && (k === 0 || i > r.bound[k - 1])), 'bound names limited parts, in order');
  }), runs());
});

test('property: the same start pose gives the same answer twice, bit for bit, and the input is not touched', () => {
  fc.assert(fc.property(chain, chain, fc.boolean(), (c, other, limited) => {
    const input = { points: place(c.root, c.parentAngle, c.lengths, c.start), lengths: c.lengths, target: place(c.root, c.parentAngle, c.lengths, c.goal).at(-1), parentAngle: c.parentAngle, ...(limited ? { limits: c.limits } : {}) };
    const copy = structuredClone(input), first = fabrik(input);
    solve(other, { limits: other.limits });
    assert.deepEqual(fabrik(input), first);
    assert.deepEqual(input, copy);
  }), runs(0.5));
});

test('property: a target past the chain\'s reach (no limits) lays the chain straight toward it, every joint on the ray', () => {
  fc.assert(fc.property(chain, angle, (c, way) => {
    const total = c.lengths.reduce((s, l) => s + l, 0), target = [c.root[0] + c.far * total * Math.cos(way), c.root[1] + c.far * total * Math.sin(way)];
    const r = fabrik({ points: place(c.root, c.parentAngle, c.lengths, c.start), lengths: c.lengths, target, parentAngle: c.parentAngle });
    assert.equal(r.passes, 0);
    const u = [(target[0] - c.root[0]) / dist(c.root, target), (target[1] - c.root[1]) / dist(c.root, target)];
    let along = 0;
    r.points.forEach((q, i) => {
      if (i) along += c.lengths[i - 1];
      assert.ok(dist(q, [c.root[0] + along * u[0], c.root[1] + along * u[1]]) <= 1e-9 * total, `joint ${i} off the ray`);
    });
    assert.ok(Math.abs(r.miss - (dist(c.root, target) - total)) <= 1e-9 * dist(c.root, target));
    r.angles.forEach((a, i) => assert.ok(Math.abs(wrapAngle(a - (i ? 0 : Math.atan2(u[1], u[0]) - c.parentAngle))) <= 1e-9));
  }), runs());
});

test('property (measured, no limits): a reachable target\'s miss never grows from one pass to the next', () => {
  fc.assert(fc.property(chain, (c) => {
    let before = Infinity;
    for (let k = 1; k <= c.passes; k++) {
      const r = solve(c, { passes: k });
      assert.ok(r.miss <= before + 1e-9 * c.lengths.reduce((s, l) => s + l, 0), `pass ${k}: ${r.miss} after ${before}`);
      before = r.miss;
      if (r.passes < k) break;
    }
  }), runs(0.2));
});
