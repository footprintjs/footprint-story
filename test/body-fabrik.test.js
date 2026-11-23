// FABRIK (src/body/fabrik.js) by example: the cases with a closed-form answer, the measured reach on a fixed sweep of
// random chains, the limits, the degenerate rules and every refusal (docs/design/2026-11-bodies.md §3, §9 1B, §10).
import test from 'node:test';
import assert from 'node:assert/strict';
import { fabrik } from '../src/body/fabrik.js';
import { seeded } from '../src/seed/seeded.js';

const PI = Math.PI;
const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
/** Forward kinematics: the joints of a chain from its root, the parent's world angle and each part's relative angle. */
const place = (root, parentAngle, lengths, angles) => {
  const p = [root];
  let world = parentAngle;
  lengths.forEach((l, i) => { world += angles[i]; p.push([p[i][0] + l * Math.cos(world), p[i][1] + l * Math.sin(world)]); });
  return p;
};
const lengthsHeld = (points, lengths) => lengths.forEach((l, i) => assert.ok(Math.abs(dist(points[i], points[i + 1]) - l) <= 1e-9 * l, `part ${i}: ${dist(points[i], points[i + 1])} for ${l}`));

test('a two-part chain reaches a point inside its reach, the root held, the lengths kept', () => {
  const r = fabrik({ points: [[0, 0], [3, 0], [7, 0]], target: [0, 5] });
  assert.equal(r.reached, true);
  assert.ok(r.miss < 0.1 && r.miss === dist(r.points[2], [0, 5]));
  assert.deepEqual(r.points[0], [0, 0]);
  lengthsHeld(r.points, [3, 4]);
  assert.ok(r.passes >= 1 && r.passes <= 16);
  assert.deepEqual(r.bound, []);
});

test('the answer is frozen plain data, and the chain handed in is not touched', () => {
  const chain = { points: [[0, 0], [3, 0], [7, 0]], target: [2, 5], lengths: [3, 4] };
  const copy = structuredClone(chain);
  const r = fabrik(chain);
  assert.deepEqual(chain, copy);
  assert.ok(Object.isFrozen(r) && Object.isFrozen(r.points) && r.points.every(Object.isFrozen) && Object.isFrozen(r.angles) && Object.isFrozen(r.bound));
  assert.deepEqual(JSON.parse(JSON.stringify(r)), { ...r, points: r.points.map((p) => [...p]), angles: [...r.angles], bound: [...r.bound] });
});

test('an unreachable target lays the chain straight toward it, with no pass, and says how far it stayed', () => {
  const r = fabrik({ points: [[10, 10], [10, 20], [20, 20], [20, 30]], target: [110, 10] });
  assert.equal(r.passes, 0);
  assert.equal(r.reached, false);
  const u = [1, 0];
  [0, 10, 20, 30].forEach((s, i) => { assert.ok(Math.abs(r.points[i][0] - (10 + s * u[0])) < 1e-12); assert.ok(Math.abs(r.points[i][1] - 10) < 1e-12); });
  assert.ok(Math.abs(r.miss - 70) < 1e-12);
  assert.deepEqual(r.angles, [0, 0, 0]);
  // exactly at full reach is straight too (the epsilon rule: within 1e-9 of the chain's length counts as full reach)
  const full = fabrik({ points: [[0, 0], [0, 3], [4, 3]], target: [0, 7] });
  assert.equal(full.passes, 0);
  assert.ok(full.reached && full.miss < 1e-12);
});

test('measured, not a theorem: on a fixed sweep of random reachable chains, 16 passes reach under 0.1 px on 95% or more, and every other miss is reported', () => {
  // the chains: 2 to 16 parts of 5 to 100 px, every angle uniform round the turn, the target the end of another such pose
  // (so it is reachable). Measured on 50,000 of them: 96.3% reached, 98.6% under 1 px (a reach-range finding's floor).
  // A textbook FABRIK gives the same points to 1e-11 px: the misses are FABRIK's slow settling near full reach, near a
  // fold and from a tangled start, not a fault here (see src/body/README.md).
  const rnd = seeded('fabrik-sweep');
  let reached = 0, underPixel = 0;
  const N = 2000;
  for (let k = 0; k < N; k++) {
    const n = 2 + Math.floor(rnd() * 15), lengths = Array.from({ length: n }, () => 5 + rnd() * 95);
    const pose = () => lengths.map(() => (rnd() * 2 - 1) * PI), parentAngle = (rnd() * 2 - 1) * PI, root = [rnd() * 2000 - 1000, rnd() * 2000 - 1000];
    const points = place(root, parentAngle, lengths, pose()), target = place(root, parentAngle, lengths, pose()).at(-1);
    const r = fabrik({ points, lengths, target, parentAngle });
    assert.ok(Math.abs(r.miss - dist(r.points.at(-1), target)) < 1e-12);
    assert.equal(r.reached, r.miss < 0.1);
    assert.ok(r.reached || r.passes === 16, 'it stops early only on reaching');
    lengthsHeld(r.points, lengths);
    reached += r.reached;
    underPixel += r.miss < 1;
  }
  assert.ok(reached / N >= 0.95, `reached ${reached} of ${N}`);
  assert.ok(underPixel / N >= 0.98, `under a pixel ${underPixel} of ${N}`);
});

test('a window holds a part: fixed windows [0, 0] keep the chain straight along its parent, the miss exact, every window named', () => {
  const r = fabrik({ points: [[0, 0], [3, 0], [7, 0]], target: [0, 5], limits: [[0, 0], [0, 0]] });
  assert.deepEqual(r.points, [[0, 0], [3, 0], [7, 0]]);
  assert.equal(r.reached, false);
  assert.ok(Math.abs(r.miss - Math.hypot(7, 5)) < 1e-12);
  assert.equal(r.passes, 16);
  assert.deepEqual(r.bound, [0, 1]);
  assert.deepEqual(r.angles, [0, 0]);
  // the parent's angle turns the window's frame: a parent at a quarter turn holds the chain along +y (y down)
  const turned = fabrik({ points: [[0, 0], [3, 0], [7, 0]], target: [5, 0], limits: [[0, 0], [0, 0]], parentAngle: PI / 2 });
  assert.ok(dist(turned.points[2], [0, 7]) < 1e-12);
});

test('with a limit the miss is what the window leaves: the closest the end can come, reported, never hidden', () => {
  // the first part may turn at most 0.5 rad; from its joint the target is 4.43 away and the second part is 4 long
  const r = fabrik({ points: [[0, 0], [3, 0], [7, 0]], target: [0, 5], limits: [[-0.5, 0.5], null] });
  const joint = [3 * Math.cos(0.5), 3 * Math.sin(0.5)];
  assert.equal(r.reached, false);
  assert.ok(Math.abs(r.angles[0] - 0.5) < 1e-12);
  assert.ok(dist(r.points[1], joint) < 1e-12);
  assert.ok(Math.abs(r.miss - (dist(joint, [0, 5]) - 4)) < 1e-6, String(r.miss));
  assert.deepEqual(r.bound, [0]);
});

test('a window wider than half a turn reads its angle near its middle: a shoulder\'s [0.5, 4.4] holds 3.1, not −3.18', () => {
  // the start pose has the part at a relative angle of 3.1 (as written in the rig: upper arm 3.1 in [0.5, 4.4])
  const points = place([0, 0], -PI / 2, [100, 65], [0, 3.1]);
  const target = place([0, 0], -PI / 2, [100, 65], [0, 3.9]).at(-1);
  const r = fabrik({ points, lengths: [100, 65], target, parentAngle: -PI / 2, limits: [[0, 0], [0.5, 4.4]] });
  assert.ok(r.reached, `missed by ${r.miss}`);
  assert.ok(r.angles[1] >= 0.5 && r.angles[1] <= 4.4 && Math.abs(r.angles[1] - 3.9) < 0.01, String(r.angles[1]));
  // and an angle past the window stops at its nearer end round the circle
  const past = fabrik({ points, lengths: [100, 65], target: place([0, 0], -PI / 2, [100, 65], [0, 4.9]).at(-1), parentAngle: -PI / 2, limits: [[0, 0], [0.5, 4.4]] });
  assert.ok(Math.abs(past.angles[1] - 4.4) < 1e-12);
  assert.deepEqual(past.bound, [1]);
});

test('the same start pose gives the same answer, bit for bit, whatever was solved before', () => {
  const chain = { points: place([5, 5], 0.2, [40, 30, 20, 10], [0.3, -0.4, 0.5, 0.2]), target: [30, 60], limits: [null, [-1, 1], [-1, 1], null], parentAngle: 0.2 };
  const first = fabrik(chain);
  fabrik({ points: [[0, 0], [1, 1], [2, 0]], target: [1, 0] });
  assert.deepEqual(fabrik(chain), first);
  // a different start pose is a different solve (FABRIK keeps the start's shape where it can), so the start is part of the input
  const other = fabrik({ ...chain, points: place([5, 5], 0.2, [40, 30, 20, 10], [-0.3, 0.4, -0.5, -0.2]) });
  assert.notDeepEqual(other.points, first.points);
});

test('a pass limit stops early, and after every pass the root is held and every length kept', () => {
  const points = place([0, 0], 0, [50, 40, 30, 20, 10], [0.1, 0.2, 0.3, 0.2, 0.1]);
  let before = Infinity;
  for (let k = 1; k <= 16; k++) {
    const r = fabrik({ points, target: [20, 90], passes: k });
    assert.ok(r.passes <= k);
    assert.deepEqual(r.points[0], [0, 0]);
    lengthsHeld(r.points, [50, 40, 30, 20, 10]);
    assert.ok(r.miss <= before + 1e-9);
    before = r.miss;
  }
});

test('degenerate cases are rules with an epsilon: a target on the root, and a start part with no length, take the start pose\'s way', () => {
  // two equal parts and a target on the root: the chain folds back on itself, its first part kept where the start had it
  const r = fabrik({ points: [[0, 0], [0, -5], [5, -5]], target: [0, 0] });
  assert.ok(r.reached);
  lengthsHeld(r.points, [5, 5]);
  assert.ok(dist(r.points[1], [0, -5]) < 1e-9);
  // a start pose whose two first joints sit on one point: that part takes its parent's way (here the parent's angle)
  const flat = fabrik({ points: [[0, 0], [0, 0], [0, 10]], lengths: [10, 10], target: [100, 0], parentAngle: 0 });
  assert.equal(flat.passes, 0);
  assert.ok(dist(flat.points[2], [20, 0]) < 1e-12);
  // a target 1e-12 px off the root reads as on it: the same answer as exactly on it, not one that hangs on rounding
  const near = fabrik({ points: [[0, 0], [0, -5], [5, -5]], target: [1e-12, 0] });
  assert.ok(dist(near.points[1], r.points[1]) < 1e-6);
});

test('an unlimited part\'s angle is read nearest its start pose\'s, so it never jumps a whole turn between solves', () => {
  // the start has the first part at 3.0 rad; the solve turns it past π, to about 3.2: read as 3.2, not as −3.07
  const points = place([0, 0], 0, [10, 10], [3.0, 0.1]);
  const r = fabrik({ points, target: place([0, 0], 0, [10, 10], [-3.0, 0.1]).at(-1) });
  const world = Math.atan2(r.points[1][1], r.points[1][0]);
  assert.ok(world < 0 && r.angles[0] > PI && Math.abs(r.angles[0] - (world + 2 * PI)) < 1e-12, String(r.angles[0]));
});

test('the joints and the target in one line: FABRIK alone would never leave the line, so the start is bent 0.1 rad a joint first', () => {
  // two parts along +y and a target on that line inside reach: each pass keeps every joint on the line, for ever
  const r = fabrik({ points: [[0, 0], [0, 10], [0, 20]], target: [0, 15] });
  assert.ok(r.reached, `missed by ${r.miss}`);
  lengthsHeld(r.points, [10, 10]);
  assert.ok(r.points[1][0] < -1, 'the bend is clockwise on screen (y down): toward −x from a chain along +y');
  // the same rule for a chain folded back on its line, and for one whose joints all sit on the root
  const folded = fabrik({ points: [[0, 0], [10, 0], [4, 0]], target: [12, 0] });
  assert.ok(folded.reached, `missed by ${folded.miss}`);
  const heap = fabrik({ points: [[0, 0], [0, 0], [0, 0]], lengths: [10, 10], target: [0, 15], parentAngle: PI / 2 });
  assert.ok(heap.reached, `missed by ${heap.miss}`);
  lengthsHeld(heap.points, [10, 10]);
  // off the line by more than the epsilon (1e-9 of the chain's length) is an ordinary solve, not bent
  assert.notDeepEqual(fabrik({ points: [[0, 0], [0, 10], [1e-6, 20]], target: [0, 15], passes: 1 }).points, fabrik({ points: [[0, 0], [0, 10], [0, 20]], target: [0, 15], passes: 1 }).points);
});

test('refusals name the field and the fix (§10: chain length bounds, NaN, huge inputs, getters never run)', () => {
  const ok = { points: [[0, 0], [1, 0], [2, 0]], target: [1, 1] };
  // the label is the pattern, never the chain: showing the chain would run the getters the last cases plant
  const refused = (chain, pattern) => assert.throws(() => fabrik(chain), (e) => e instanceof Error && /^body: fabrik's /.test(e.message) && pattern.test(e.message), String(pattern));
  refused(null, /chain is an object/);
  refused([1, 2], /chain is an object .* not a list of 2/);
  refused('chain', /not "chain"/);
  refused({ ...ok, extra: 1 }, /takes points, target, lengths, limits, parentAngle, passes — not "extra"/);
  refused({ target: [1, 1] }, /points is the joints' points .* 3 to 17 of them .* not undefined/);
  refused({ ...ok, points: [[0, 0], [1, 0]] }, /a chain of 2 to 16 parts\) — not a list of 2/);
  refused({ ...ok, points: Array.from({ length: 18 }, (_, i) => [i, 0]) }, /not a list of 18/);
  refused({ ...ok, points: [[0, 0], [1, NaN], [2, 0]] }, /points\[1\] is a point \[x, y\].* not \[1,NaN\]/);
  refused({ ...ok, points: [[0, 0], [1, 0], [2e6, 0]] }, /points\[2\] .* no further than 1000000/);
  refused({ ...ok, points: [[0, 0], [1, 0], [2, 0, 0]] }, /points\[2\] .* not a list of 3/);
  refused({ ...ok, points: [[0, 0], 'p', [2, 0]] }, /points\[1\] .* not "p"/);
  refused({ ...ok, points: [[0, 0], [0, 0], [2, 0]] }, /lengths\[0\] .* above 0 .* not 0 \(measured between points 0 and 1; give `lengths`/);
  refused({ ...ok, lengths: [1] }, /lengths is 2 part lengths/);
  refused({ ...ok, lengths: [1, 0] }, /lengths\[1\] .* not 0$/);
  refused({ ...ok, lengths: [1, 10001] }, /at most 10000 — not 10001/);
  refused({ ...ok, lengths: [1, Infinity] }, /not Infinity/);
  refused({ ...ok, lengths: [1, '2'] }, /not "2"/);
  refused({ ...ok, target: [Infinity, 0] }, /target is a point .* not \[Infinity,0\]/);
  refused({ ...ok, target: [1e7, 0] }, /target .* not \[10000000,0\]/);
  refused({ ...ok, target: { x: 1, y: 1 } }, /target .* not an object/);
  refused({ ...ok, limits: [[0, 1]] }, /limits is 2 windows/);
  refused({ ...ok, limits: [[1, 0], null] }, /limits\[0\] is a window .* not \[1,0\]/);
  refused({ ...ok, limits: [[0, 7], null] }, /limits\[0\] .* not \[0,7\]/);
  refused({ ...ok, limits: [[-PI, PI], null] }, /less than a whole turn/);
  refused({ ...ok, limits: [null, [0, NaN]] }, /limits\[1\] .* not \[0,NaN\]/);
  refused({ ...ok, limits: [null, 0.5] }, /limits\[1\] .* not 0.5/);
  refused({ ...ok, limits: [null, () => 0] }, /not a function/);
  refused({ ...ok, parentAngle: NaN }, /parentAngle .* not NaN/);
  refused({ ...ok, parentAngle: 2e6 }, /parentAngle/);
  for (const passes of [0, 17, 1.5, '3']) refused({ ...ok, passes }, /passes is the most passes .* from 1 to 16/);
  refused({ ...ok, target: 'x'.repeat(100) }, /not "x{40}…"/);
  let ran = false;
  const sly = { points: ok.points, get target() { ran = true; return [1, 1]; } };
  refused(sly, /target is read as a stored value, and this one is a getter/);
  const slyPoint = [[0, 0], [1, 0], [2, 0]];
  Object.defineProperty(slyPoint, 1, { get() { ran = true; return [1, 0]; } });
  refused({ ...ok, points: slyPoint }, /points\[1\] is read as a stored value/);
  assert.equal(ran, false, 'a getter never runs');
  // a window of exactly [−2π, 2π] ends is allowed when narrower than a turn, and min = max is a fixed joint
  assert.doesNotThrow(() => fabrik({ ...ok, limits: [[-2 * PI, -2 * PI + 1], [2 * PI - 1, 2 * PI]] }));
});
