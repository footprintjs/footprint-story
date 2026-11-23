// footprint-story/body, by property: any reachable target is met within 1e-9 × (l1 + l2), every part keeps its length,
// the bend side never flips over a swept target, the mirror is its own inverse and commutes with the clamp and the
// solve, the clamp lands every angle in its window and leaves one already there bit for bit.
// FC_RUNS=5000 npm test runs a deep sweep.
import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { readRig, humanRig, restPose, placeParts, centreOf, windowAngle, clampPose, mirrorPose, twoBone, REACH_TOLERANCE } from '../body.js';

const RUNS = Number(process.env.FC_RUNS) || 300;
const runs = (share = 1) => ({ numRuns: Math.max(20, Math.round(RUNS * share)) });
const PI = Math.PI;
const length = fc.double({ min: 0.5, max: 500, noNaN: true });
const angle = fc.double({ min: -10, max: 10, noNaN: true });
const place = fc.tuple(fc.double({ min: -5000, max: 5000, noNaN: true }), fc.double({ min: -5000, max: 5000, noNaN: true }));
const share = fc.oneof(fc.constant(0), fc.constant(1), fc.double({ min: 0, max: 1, noNaN: true }), fc.double({ min: 0, max: 1e-8, noNaN: true }), fc.double({ min: 1 - 1e-8, max: 1, noNaN: true }));

/** A free arm hung off a link, so the chain's parent turns too: base (the root) → link → upper → lower. */
const freeArm = (link, l1, l2, bend, facing) => readRig({
  name: 'arm', facing,
  parts: [{ name: 'base', parent: null, length: 0, mass: 1 }, { name: 'link', parent: 'base', length: link, mass: 1 }, { name: 'upper', parent: 'link', length: l1, mass: 1 }, { name: 'lower', parent: 'upper', length: l2, mass: 1 }],
  chains: [{ name: 'reach', parts: ['upper', 'lower'], solver: 'two-bone', bend }],
});
const arms = fc.record({ link: length, l1: length, l2: length, bend: fc.constantFrom('front', 'back'), facing: fc.constantFrom(1, -1), root: place, turn: angle, start: fc.tuple(angle, angle, angle) });
const build = (a) => ({ rig: freeArm(a.link, a.l1, a.l2, a.bend, a.facing), pose: { root: a.root, turn: a.turn, angles: [0, ...a.start] } });
const side = (o, mid, t) => (t[0] - o[0]) * (mid[1] - o[1]) - (t[1] - o[1]) * (mid[0] - o[0]);
const sideOf = (a) => a.facing * (a.bend === 'back' ? 1 : -1);

test('two-bone: any reachable target is met within 1e-9 × (l1 + l2), and every part keeps its length', () => {
  fc.assert(fc.property(arms, share, angle, (a, u, heading) => {
    const { rig, pose } = build(a);
    const o = placeParts(rig, pose)[2].start, d = Math.abs(a.l1 - a.l2) + u * (a.l1 + a.l2 - Math.abs(a.l1 - a.l2));
    const target = [o[0] + d * Math.cos(heading), o[1] + d * Math.sin(heading)];
    const out = twoBone(rig, pose, 'reach', target);
    const scale = a.l1 + a.l2;
    // the target was rounded to a point first: its own distance may sit a rounding outside [|l1 − l2|, l1 + l2]
    const slack = 1e-12 * (Math.abs(o[0]) + Math.abs(o[1]) + scale);
    assert.ok(out.miss <= REACH_TOLERANCE * scale + slack, `missed by ${out.miss} (${out.miss / scale} of the reach)`);
    assert.deepEqual(out.clamped, []);
    const placed = placeParts(rig, out.pose);
    rig.parts.forEach((p, i) => {
      const l = Math.hypot(placed[i].end[0] - placed[i].start[0], placed[i].end[1] - placed[i].start[1]);
      assert.ok(Math.abs(l - p.length) <= 1e-12 * (Math.abs(placed[i].start[0]) + Math.abs(placed[i].start[1]) + p.length), `part ${p.name}: ${l} for ${p.length}`);
    });
    // every other angle is as handed in
    assert.equal(out.pose.angles[1], pose.angles[1] + 0);
    assert.equal(out.pose.turn, pose.turn + 0); // one zero: −0 is read as 0
  }), runs());
});

test('two-bone: past reach the chain points straight at the target; inside |l1 − l2| it folds towards it; both say so', () => {
  fc.assert(fc.property(arms, fc.double({ min: 1.001, max: 10, noNaN: true }), angle, (a, beyond, heading) => {
    const { rig, pose } = build(a);
    const o = placeParts(rig, pose)[2].start, full = a.l1 + a.l2;
    const far = twoBone(rig, pose, 'reach', [o[0] + full * beyond * Math.cos(heading), o[1] + full * beyond * Math.sin(heading)]);
    assert.equal(far.stretched, true);
    assert.ok(Math.abs(far.miss - full * (beyond - 1)) <= 1e-9 * full * beyond);
    const short = Math.abs(a.l1 - a.l2);
    if (short > 1e-6 * full) {
      const d = short / beyond, target = [o[0] + d * Math.cos(heading), o[1] + d * Math.sin(heading)];
      const close = twoBone(rig, pose, 'reach', target);
      assert.equal(close.folded, true);
      assert.ok(Math.abs(close.miss - (short - d)) <= 1e-9 * full + 1e-12 * (Math.abs(o[0]) + Math.abs(o[1])));
    }
  }), runs());
});

test('two-bone: the bend side never flips over a swept target', () => {
  fc.assert(fc.property(arms, fc.tuple(share, angle), fc.tuple(share, angle), (a, [u0, h0], [u1, h1]) => {
    const { rig, pose } = build(a);
    const o = placeParts(rig, pose)[2].start, lo = Math.abs(a.l1 - a.l2), full = a.l1 + a.l2;
    const s = sideOf(a);
    for (let k = 0; k <= 40; k += 1) {
      const f = k / 40, u = u0 + (u1 - u0) * f, h = h0 + (h1 - h0) * f, d = lo + u * (full - lo);
      const target = [o[0] + d * Math.cos(h), o[1] + d * Math.sin(h)];
      const placed = placeParts(rig, twoBone(rig, pose, 'reach', target).pose);
      const v = side(o, placed[2].end, target);
      assert.ok(s * v >= -1e-9 * full * full, `the middle joint crossed to the other side at step ${k}: ${v}`);
    }
  }), runs(0.2));
});

test('two-bone on the usual person: knees stay in front and elbows behind, whatever the target, limits and all', () => {
  const ana = humanRig({ name: 'ana', height: 350 }), ben = humanRig({ name: 'ben', height: 350, facing: -1 });
  fc.assert(fc.property(fc.constantFrom('arm-n', 'arm-f', 'leg-n', 'leg-f'), fc.boolean(), fc.tuple(fc.double({ min: -400, max: 400, noNaN: true }), fc.double({ min: -400, max: 400, noNaN: true })), (chain, flipped, [dx, dy]) => {
    const rig = flipped ? ben : ana, pose = restPose(rig, { root: [500, 500] });
    const [upper, lower] = rig.chains.find((c) => c.name === chain).parts.map((n) => rig.parts.findIndex((p) => p.name === n));
    const start = placeParts(rig, pose)[upper].start, target = [start[0] + dx, start[1] + dy];
    const out = twoBone(rig, pose, chain, target), placed = placeParts(rig, out.pose);
    const s = rig.facing * (chain.startsWith('arm') ? 1 : -1);
    assert.ok(s * side(placed[upper].start, placed[upper].end, placed[lower].end) >= -1e-9 * 350 * 350, `${chain} bent the wrong way`);
    for (const i of [upper, lower]) {
      const w = rig.facing === 1 ? rig.parts[i].limit : [-rig.parts[i].limit[1], -rig.parts[i].limit[0]];
      assert.ok(out.pose.angles[i] >= w[0] && out.pose.angles[i] <= w[1], `${rig.parts[i].name} outside its window`);
    }
    const end = placed[lower].end;
    assert.ok(Math.abs(Math.hypot(end[0] - target[0], end[1] - target[1]) - out.miss) <= 1e-9);
  }), runs());
});

test('two-bone is pure: the same start pose and target, the same answer, solved alone or after others', () => {
  fc.assert(fc.property(arms, place, place, (a, t1, t2) => {
    const { rig, pose } = build(a);
    const once = twoBone(rig, pose, 'reach', t1);
    twoBone(rig, once.pose, 'reach', t2);
    assert.deepEqual(twoBone(rig, pose, 'reach', t1), once);
  }), runs(0.5));
});

test('the mirror: twice gives the pose back; it mirrors the placement; it commutes with the clamp and the solve', () => {
  const ana = humanRig({ name: 'ana', height: 350 }), ben = humanRig({ name: 'ana', height: 350, facing: -1 });
  const anyPose = fc.record({ root: place, turn: angle, angles: fc.array(angle, { minLength: 17, maxLength: 17 }) }).map((p) => ({ ...p, angles: p.angles.map((x, i) => (i === 0 ? 0 : x)) }));
  fc.assert(fc.property(anyPose, fc.constantFrom('arm-n', 'arm-f', 'leg-n', 'leg-f'), place, (pose, chain, target) => {
    const twice = mirrorPose(ana, mirrorPose(ana, pose));
    assert.deepEqual(twice.angles, pose.angles.map((x) => x + 0)); // one zero: −0 is read as 0
    assert.deepEqual(twice.root, pose.root.map((x) => x + 0));
    assert.ok(Math.abs(twice.turn - pose.turn) <= 2 * Number.EPSILON * (PI + Math.abs(pose.turn)), 'the turn, within its rounding');
    const m = mirrorPose(ana, pose), x0 = pose.root[0];
    const pa = placeParts(ana, pose), pm = placeParts(ben, m);
    const tol = 1e-9 * (5000 + 350);
    pa.forEach((p, i) => { assert.ok(Math.abs(pm[i].end[0] - (2 * x0 - p.end[0])) <= tol && Math.abs(pm[i].end[1] - p.end[1]) <= tol); });
    const ca = clampPose(ana, pose), cm = clampPose(ben, m);
    ca.pose.angles.forEach((v, i) => assert.ok(Math.abs(cm.pose.angles[i] + v) <= 1e-12, `clamp of ${ana.parts[i].name}`));
    assert.deepEqual(cm.clamped.map((c) => c.part), ca.clamped.map((c) => c.part));
    const sa = twoBone(ana, ca.pose, chain, target), sm = twoBone(ben, cm.pose, chain, [2 * x0 - target[0], target[1]]);
    sa.pose.angles.forEach((v, i) => assert.ok(Math.abs(sm.pose.angles[i] + v) <= 1e-9, `solve of ${ana.parts[i].name}: ${sm.pose.angles[i]} for ${-v}`));
    assert.ok(Math.abs(sm.miss - sa.miss) <= 1e-6);
  }), runs(0.5));
});

test('the clamp lands every angle in its window, leaves one already there bit for bit, and is idempotent', () => {
  const ana = humanRig({ name: 'ana', height: 350 });
  fc.assert(fc.property(fc.array(fc.double({ min: -50, max: 50, noNaN: true }), { minLength: 17, maxLength: 17 }), (raw) => {
    const pose = { root: [0, 0], turn: 0, angles: raw.map((x, i) => (i === 0 ? 0 : x)) };
    const once = clampPose(ana, pose);
    ana.parts.forEach((p, i) => { if (p.limit) assert.ok(once.pose.angles[i] >= p.limit[0] && once.pose.angles[i] <= p.limit[1]); });
    assert.deepEqual(clampPose(ana, once.pose), { pose: once.pose, clamped: [], moved: [] });
    for (const c of once.clamped) assert.ok(c.by !== 0 && Math.abs(c.by) < PI, `${c.part} clamped by ${c.by}`);
  }), runs());
});

test('the window rule: a whole number of turns away, the reading nearest the middle', () => {
  fc.assert(fc.property(fc.double({ min: -1000, max: 1000, noNaN: true }), fc.double({ min: -2 * PI, max: 2 * PI, noNaN: true }), fc.double({ min: 0, max: 2 * PI - 1e-9, noNaN: true }), (a, lo, width) => {
    const hi = lo + width, r = windowAngle(a, [lo, hi]), turns = (r - a) / (2 * PI);
    assert.ok(Math.abs(turns - Math.round(turns)) <= 1e-9, 'a whole number of turns');
    assert.ok(Math.abs(r - (lo + hi) / 2) <= PI + 1e-9, 'within half a turn of the middle');
    if (a >= lo && a <= hi) assert.equal(r, a + 0);
    assert.ok(Math.abs(windowAngle(-a, [-hi, -lo]) + r) <= 1e-12, 'the mirrored window reads the mirrored angle');
  }), runs());
});

test('the centre of mass moves with the body and stays within its parts', () => {
  const ana = humanRig({ name: 'ana', height: 350 });
  fc.assert(fc.property(fc.array(angle, { minLength: 17, maxLength: 17 }), angle, place, (raw, turn, [dx, dy]) => {
    const angles = raw.map((x, i) => (i === 0 ? 0 : x));
    const c0 = centreOf(ana, placeParts(ana, { root: [0, 0], turn, angles })), c1 = centreOf(ana, placeParts(ana, { root: [dx, dy], turn, angles }));
    assert.ok(Math.abs(c1[0] - c0[0] - dx) <= 1e-9 && Math.abs(c1[1] - c0[1] - dy) <= 1e-9);
    const placed = placeParts(ana, { root: [0, 0], turn, angles }), xs = placed.flatMap((p) => [p.start[0], p.end[0]]), ys = placed.flatMap((p) => [p.start[1], p.end[1]]);
    assert.ok(c0[0] >= Math.min(...xs) - 1e-9 && c0[0] <= Math.max(...xs) + 1e-9 && c0[1] >= Math.min(...ys) - 1e-9 && c0[1] <= Math.max(...ys) + 1e-9);
  }), runs());
});
