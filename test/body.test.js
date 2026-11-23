// footprint-story/body, by example: the usual person, poses and where they put each part, the window rule and the
// mirror, two-bone IK against the law of cosines and against an exact-rational oracle near full reach, and every
// refusal of docs/design/2026-11-bodies.md §10 that a rig, a pose or a target can meet.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readRig, humanRig, restPose, placeParts, centreOf, windowAngle, clampPose, mirrorPose, twoBone, MOST_PARTS, MOST_CHAIN, MOST_LENGTH, REACH_TOLERANCE } from '../body.js';
import { angleAt } from '../geometry.js';
import { BUILT_IN_NAME } from '../src/human/names.js';
import { NAME } from '../src/body/read.js';
import { angleOpposite, angleOutside, twoBoneAngles } from '../src/body/twoBone.js';

const PI = Math.PI;
const near = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol, `${what ?? ''} ${a} is not within ${tol} of ${b}`);
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
/** A bare arm: a root point, then two free parts (no limits), so a solve is never clamped. */
export const arm = (l1, l2, { bend = 'back', facing = 1, limits } = {}) => readRig({
  name: 'arm', facing,
  parts: [
    { name: 'base', parent: null, length: 0, mass: 1 },
    { name: 'upper', parent: 'base', length: l1, mass: 1, ...(limits ? { limit: limits[0], rest: (limits[0][0] + limits[0][1]) / 2 } : {}) },
    { name: 'lower', parent: 'upper', length: l2, mass: 1, ...(limits ? { limit: limits[1], rest: (limits[1][0] + limits[1][1]) / 2 } : {}) },
  ],
  chains: [{ name: 'reach', parts: ['upper', 'lower'], solver: 'two-bone', bend }],
});
const at = (rig, root = [0, 0], turn = 0, angles = rig.parts.map(() => 0)) => ({ root, turn, angles });

test('the usual person: Winter\'s shares of height, masses summing to 1, standing at rest', () => {
  const ana = humanRig({ name: 'ana', height: 350 });
  assert.equal(ana.parts.length, 17);
  assert.deepEqual(ana.chains.map((c) => c.name), ['arm-n', 'arm-f', 'leg-n', 'leg-f', 'spine']);
  assert.deepEqual(ana.feet, ['foot-n', 'foot-f']);
  const len = (n) => ana.parts.find((p) => p.name === n).length;
  near(len('upper-arm-n'), 0.186 * 350, 1e-12); near(len('forearm-n'), 0.146 * 350, 1e-12);
  near(len('thigh-n'), 0.245 * 350, 1e-12); near(len('shin-n'), 0.246 * 350, 1e-12);
  near(len('thigh-n') + len('shin-n') + ana.footHeight, 0.530 * 350, 1e-9, 'the hip height'); // about 186 px (§1)
  near(len('back-low') + len('back-high'), (0.818 - 0.530) * 350, 1e-9, 'hip to shoulder');
  near(ana.parts.reduce((s, p) => s + p.mass, 0), 1, 1e-12);
  const pose = restPose(ana, { root: [400, 500] }), placed = placeParts(ana, pose);
  const by = (n) => placed.find((p) => p.name === n);
  near(by('foot-n').angle, 0, 1e-15, 'a foot flat'); near(by('shin-n').angle, PI / 2, 1e-15, 'a leg straight down');
  near(by('upper-arm-n').angle, PI / 2, 1e-15, 'an arm hanging');
  near(by('head').end[1], 500 - (1 - 0.530) * 350, 1e-9, 'the head top at the height');
  near(by('shin-n').end[1] + ana.footHeight, 500 + 0.530 * 350, 1e-9, 'the floor');
  // the centre of mass of a person standing is about 0.55 of the height up (Winter); ours from the tables lands there
  const floor = 500 + 0.530 * 350, [, cy] = centreOf(ana, placed);
  assert.ok((floor - cy) / 350 > 0.54 && (floor - cy) / 350 < 0.58, `centre at ${(floor - cy) / 350} of the height`);
  // build scales widths only
  const broad = humanRig({ name: 'ana', height: 350, build: 2 });
  ana.parts.forEach((p, i) => { assert.equal(broad.parts[i].length, p.length); near(broad.parts[i].width, 2 * p.width, 1e-12); assert.equal(broad.parts[i].mass, p.mass); });
});

test('a rig is frozen plain data, read once: readRig of a read rig is the same object', () => {
  const ana = humanRig({ name: 'ana', height: 300 });
  assert.equal(readRig(ana), ana);
  for (const v of [ana, ana.parts, ana.parts[3], ana.parts[3].limit, ana.chains, ana.chains[0].parts, ana.feet]) assert.ok(Object.isFrozen(v));
  const copy = readRig(JSON.parse(JSON.stringify(ana)));
  assert.notEqual(copy, ana);
  assert.deepEqual(copy, ana);
});

test('the name rule is the human door\'s BUILT_IN_NAME, one rule (kept here because /body may not load src/human)', () => {
  assert.equal(NAME.source, BUILT_IN_NAME.source);
  assert.equal(NAME.flags, BUILT_IN_NAME.flags);
});

test('placeParts: each part starts at its parent\'s end; world angles are sums, never wrapped', () => {
  const r = readRig({ name: 'spin', parts: [{ name: 'a', parent: null, length: 10, mass: 1 }, { name: 'b', parent: 'a', length: 10, mass: 1 }, { name: 'c', parent: 'b', length: 10, mass: 1 }] });
  const placed = placeParts(r, { root: [5, 5], turn: 3, angles: [0, 3, 3] });
  assert.deepEqual(placed.map((p) => p.angle), [3, 6, 9]);
  assert.deepEqual(placed[1].start, placed[0].end);
  assert.deepEqual(placed[0].start, [5, 5]);
  near(dist(placed[2].start, placed[2].end), 10, 1e-12);
  assert.deepEqual(centreOf(readRig({ name: 'one', parts: [{ name: 'a', parent: null, length: 10, mass: 3 }] }), [{ start: [0, 0], end: [10, 4] }]), [5, 2]);
});

test('the window rule: the reading nearest the middle; one inside comes back unchanged, bit for bit', () => {
  near(windowAngle(-3, [0.5, 4.4]), -3 + 2 * PI, 1e-15);
  assert.equal(windowAngle(3.1, [0.5, 4.4]), 3.1);
  assert.equal(windowAngle(0.5, [0.5, 4.4]), 0.5);
  near(windowAngle(13, [-0.5, 0.5]), 13 - 4 * PI, 1e-14);
  assert.equal(windowAngle(-0, [-1, 1]), 0);
  assert.ok(Object.is(windowAngle(-0, [-1, 1]), 0), 'one zero');
  // a window wider than half a turn: a shoulder's
  near(windowAngle(-2.5, [-0.2, 4.0]), -2.5 + 2 * PI, 1e-15);
});

test('clampPose: angles read into their windows, then clamped; the clamp and each chain point it moved are reported', () => {
  const ana = humanRig({ name: 'ana', height: 350 });
  const rest = restPose(ana);
  const i = ana.parts.findIndex((p) => p.name === 'upper-arm-n'), k = ana.parts.findIndex((p) => p.name === 'forearm-n');
  const wound = { ...rest, angles: rest.angles.map((a, j) => (j === i ? a - 2 * PI : a)) };
  const same = clampPose(ana, wound);
  near(same.pose.angles[i], PI, 1e-15, 'read back into [0.5, 4.4]');
  assert.deepEqual(same.clamped, []); assert.deepEqual(same.moved, []);
  const over = { ...rest, angles: rest.angles.map((a, j) => (j === k ? 0.5 : a)) }; // an elbow bent backwards
  const out = clampPose(ana, over);
  assert.equal(out.pose.angles[k], 0);
  assert.deepEqual(out.clamped.map((c) => c.part), ['forearm-n']);
  near(out.clamped[0].by, -0.5, 1e-15);
  assert.deepEqual(out.moved.map((m) => m.chain), ['arm-n']);
  near(out.moved[0].by, 2 * ana.parts[k].length * Math.sin(0.25), 1e-9, 'the chord the wrist moved');
  assert.ok(Object.isFrozen(out) && Object.isFrozen(out.pose.angles) && Object.isFrozen(out.clamped[0]));
});

test('the facing mirror: facing −1 mirrors rest, windows and placement; mirroring twice gives the pose back', () => {
  const ana = humanRig({ name: 'ana', height: 350 }), ben = humanRig({ name: 'ana', height: 350, facing: -1 });
  const a = restPose(ana, { root: [400, 500] }), b = restPose(ben, { root: [400, 500] });
  assert.equal(b.turn, PI);
  assert.deepEqual(b.angles, a.angles.map((x) => -x + 0));
  assert.deepEqual(mirrorPose(ana, a), b);
  const pa = placeParts(ana, a), pb = placeParts(ben, b);
  pa.forEach((p, i) => { near(pb[i].end[0], 800 - p.end[0], 1e-9); near(pb[i].end[1], p.end[1], 1e-9); });
  near(pb.find((p) => p.name === 'foot-n').angle, PI, 1e-15, 'a foot facing −1 lies at π');
  const twice = mirrorPose(ana, mirrorPose(ana, { root: [1, 2], turn: 0.3, angles: a.angles.map((x, i) => x + 0.01 * i) }));
  assert.deepEqual(twice.angles, a.angles.map((x, i) => x + 0.01 * i));
  near(twice.turn, 0.3, 1e-15);
  const elbow = ben.parts.findIndex((p) => p.name === 'forearm-n');
  const bent = clampPose(ben, { ...b, angles: b.angles.map((x, i) => (i === elbow ? -0.5 : x)) }); // mirrored window [0, 2.6]
  assert.equal(bent.pose.angles[elbow], 0);
});

test('two-bone against the law of cosines in closed form, and angleAt of the placed points', () => {
  for (const [l1, l2, d] of [[3, 4, 5], [65, 51, 80], [100, 100, 1], [100, 10, 95], [10, 100, 100], [1, 1, 1.999]]) {
    const { root, bend } = twoBoneAngles(l1, l2, d);
    near(bend, PI - Math.acos((l1 * l1 + l2 * l2 - d * d) / (2 * l1 * l2)), 1e-9, `bend at ${l1}, ${l2}, ${d}`);
    near(root, Math.acos((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)), 1e-9, `root at ${l1}, ${l2}, ${d}`);
    const r = arm(l1, l2), target = [d * Math.cos(0.7), d * Math.sin(0.7)];
    const solved = twoBone(r, at(r), 'reach', target), placed = placeParts(r, solved.pose);
    assert.ok(solved.miss <= REACH_TOLERANCE * (l1 + l2));
    near(angleAt(placed[1].start, placed[1].end, placed[2].end), PI - bend, 1e-9, 'the elbow\'s inner angle as placed');
    near(angleAt(placed[2].end, placed[1].start, placed[1].end), root, 1e-9, 'the shoulder\'s angle as placed');
  }
  assert.equal(angleOpposite(3, 4, 5), PI / 2);
  assert.equal(angleOpposite(3, 4, 1), 0, 'flat, folded');
  assert.equal(angleOpposite(3, 4, 7), PI, 'flat, straight');
  assert.equal(angleOutside(3, 4, 7), 0);
  assert.equal(angleOutside(3, 4, 1), PI);
});

// An exact-rational oracle: a double is m·2^e exactly, so its square and the triangle's (1 ± cos)/2 are exact BigInt
// fractions; only the last step (a correctly rounded division, √ and asin of a small number) is floating point.
const exact = (x) => { let k = 0n, v = x; while (!Number.isInteger(v)) { v *= 2; k += 1n; } return [BigInt(v), 2n ** k]; };
const ratio = ([n, d]) => { // n / d to a double, correctly rounded enough (to 2^-60 relative) for an oracle
  if (n === 0n) return 0;
  const shift = BigInt(Math.max(0, 64 - (n.toString(2).length - d.toString(2).length)));
  return Number((n << shift) / d) / 2 ** Number(shift);
};
const sub = ([a, b], [c, d]) => [a * d - c * b, b * d];
const mul = ([a, b], [c, d]) => [a * c, b * d];
const add = ([a, b], [c, d]) => [a * d + c * b, b * d];
const div = ([a, b], [c, d]) => [a * d, b * c];

test('two-bone near full reach against an exact-rational oracle (acos would lose half the digits)', () => {
  for (const [l1, l2] of [[65.1, 51.1], [86, 86], [0.3, 1e4], [123.456, 7.89], [1e4, 1e4]]) {
    for (const share of [1e-3, 1e-5, 1e-7, 2e-9]) {
      const d = (l1 + l2) * (1 - share);
      if (d <= Math.abs(l1 - l2)) continue; // not a triangle: folded, tested below
      const [L1, L2, D] = [l1, l2, d].map(exact);
      // sin²(bend / 2) = ((l1 + l2)² − d²) / (4 l1 l2); sin²(root / 2) = (l2² − (d − l1)²) / (4 l1 d)
      const full = add(L1, L2);
      const bendShare = div(sub(mul(full, full), mul(D, D)), mul([4n, 1n], mul(L1, L2)));
      const rootShare = div(sub(mul(L2, L2), mul(sub(D, L1), sub(D, L1))), mul([4n, 1n], mul(L1, D)));
      const oracle = { bend: 2 * Math.asin(Math.sqrt(ratio(bendShare))), root: 2 * Math.asin(Math.sqrt(ratio(rootShare))) };
      const got = twoBoneAngles(l1, l2, d);
      near(got.bend, oracle.bend, 1e-13 * oracle.bend, `bend at ${l1}, ${l2}, ${share}`);
      near(got.root, oracle.root, 1e-13 * oracle.root + 1e-300, `root at ${l1}, ${l2}, ${share}`);
      const r = arm(l1, l2), solved = twoBone(r, at(r), 'reach', [d, 0]);
      near(Math.abs(solved.pose.angles[2]), oracle.bend, 1e-13 * oracle.bend, 'the solve\'s elbow');
      assert.ok(solved.miss <= REACH_TOLERANCE * (l1 + l2), `miss ${solved.miss}`);
    }
  }
  // the control: the acos form of the same bend, 1e-7 from full reach, is off by far more than the oracle allows
  const [l1, l2] = [65.1, 51.1], d = (l1 + l2) * (1 - 1e-7), acosBend = PI - Math.acos((l1 * l1 + l2 * l2 - d * d) / (2 * l1 * l2));
  const good = twoBoneAngles(l1, l2, d).bend;
  assert.ok(Math.abs(acosBend - good) > 1e-10 * good, 'acos loses its digits here; Kahan\'s form does not');
});

test('two-bone: past reach it points straight and says stretched; inside |l1 − l2| it folds and says folded; at the root it keeps the start\'s angle', () => {
  const r = arm(100, 60);
  const far = twoBone(r, at(r), 'reach', [0, 300]);
  assert.equal(far.stretched, true); assert.equal(far.folded, false);
  near(far.miss, 140, 1e-9); assert.equal(far.pose.angles[2], 0);
  near(far.pose.angles[1], PI / 2, 1e-15);
  const close = twoBone(r, at(r), 'reach', [10, 0]);
  assert.equal(close.folded, true); near(close.miss, 30, 1e-9);
  const placed = placeParts(r, close.pose);
  near(dist(placed[2].end, [40, 0]), 0, 1e-9, 'folded as far as it goes, towards the target');
  const start = at(r, [0, 0], 0, [0, 1.2, 0.4]);
  const atRoot = twoBone(r, start, 'reach', [1e-8, 0]);
  near(atRoot.pose.angles[1], 1.2, 1e-15, 'no direction: the first part keeps its angle from the start pose');
  assert.equal(atRoot.folded, true);
  const even = arm(80, 80), zero = twoBone(even, at(even, [0, 0], 0, [0, -0.4, 0]), 'reach', [0, 0]);
  assert.ok(zero.miss <= 1e-12, 'equal parts fold to the root exactly');
  assert.equal(zero.folded, false);
  near(zero.pose.angles[1], -0.4, 1e-15);
});

test('two-bone: a bend side fixed by the chain — knees front, elbows back — and mirrored when the body faces −1', () => {
  const ana = humanRig({ name: 'ana', height: 350 }), pose = restPose(ana, { root: [400, 500] });
  const leg = twoBone(ana, pose, 'leg-n', [430, 640]), placedLeg = placeParts(ana, leg.pose);
  const knee = placedLeg.find((p) => p.name === 'thigh-n').end;
  assert.ok(knee[0] > 430, 'the knee in front of the hip–ankle line (facing +x)');
  const reach = twoBone(ana, pose, 'arm-n', [470, 400]), elbow = placeParts(ana, reach.pose).find((p) => p.name === 'upper-arm-n').end;
  assert.ok(elbow[1] > 400, 'reaching forward, the elbow drops below the line');
  assert.equal(reach.clamped.length, 0); assert.ok(reach.miss < 1e-9);
  const ben = humanRig({ name: 'ana', height: 350, facing: -1 }), mirrored = twoBone(ben, restPose(ben, { root: [400, 500] }), 'leg-n', [370, 640]);
  const kneeM = placeParts(ben, mirrored.pose).find((p) => p.name === 'thigh-n').end;
  near(kneeM[0], 800 - knee[0], 1e-9); near(kneeM[1], knee[1], 1e-9);
});

test('two-bone: limits clamp, and the miss after the clamp is reported, not hidden', () => {
  const r = arm(100, 60, { limits: [[-0.5, 0.5], [-1, 0]] });
  const out = twoBone(r, { root: [0, 0], turn: 0, angles: [0, 0, -0.5] }, 'reach', [0, -150]);
  assert.ok(out.clamped.length > 0);
  assert.ok(out.miss > 1);
  const placed = placeParts(r, out.pose);
  near(dist(placed[2].end, [0, -150]), out.miss, 1e-9);
  for (const [i, [lo, hi]] of [[1, [-0.5, 0.5]], [2, [-1, 0]]]) assert.ok(out.pose.angles[i] >= lo && out.pose.angles[i] <= hi);
});

test('two-bone is pure: the same pose and target, the same frozen answer, whatever was solved before', () => {
  const ana = humanRig({ name: 'ana', height: 350 }), pose = restPose(ana, { root: [400, 500] });
  const first = twoBone(ana, pose, 'arm-n', [460, 430]);
  twoBone(ana, pose, 'arm-n', [300, 300]); twoBone(ana, first.pose, 'arm-n', [420, 470]);
  assert.deepEqual(twoBone(ana, pose, 'arm-n', [460, 430]), first);
  assert.ok(Object.isFrozen(first) && Object.isFrozen(first.pose) && Object.isFrozen(first.pose.angles));
});

// ---- every refusal ----------------------------------------------------------------------------------------------

const part = (name, parent, extra = {}) => ({ name, parent, length: parent === null ? 0 : 10, mass: 1, ...extra });
const rigWith = (over) => ({ name: 'r', parts: [part('a', null), part('b', 'a'), part('c', 'b')], chains: [{ name: 'k', parts: ['b', 'c'], solver: 'two-bone', bend: 'front' }], ...over });
const refused = (fn, pattern) => assert.throws(fn, (e) => e instanceof Error && e.message.startsWith('body: ') && pattern.test(e.message), `expected a refusal matching ${pattern}`);

test('readRig refuses what §10 refuses, in words naming the part and the fix', () => {
  const cases = [
    [null, /a rig is an object/],
    [[], /a rig is an object/],
    [rigWith({ extra: 1 }), /takes name, plane/],
    [rigWith({ name: '__proto__' }), /name in lower case/],
    [rigWith({ name: 'Ana' }), /name in lower case/],
    [rigWith({ plane: 'world' }), /later round/],
    [rigWith({ plane: 'top' }), /plane is one of "side"/],
    [rigWith({ facing: 0 }), /facing/],
    [rigWith({ parts: [] }), /parts is a list of 1 to 64/],
    [rigWith({ parts: Array.from({ length: MOST_PARTS + 1 }, (_, i) => part(`p${i}`, i ? `p${i - 1}` : null)) }), /1 to 64 — not 65/],
    [rigWith({ parts: [part('a', null), part('a', 'a')] }), /named twice/],
    [rigWith({ parts: [part('b', 'a'), part('a', null)] }), /a part listed before it.*list the parent first/],
    [rigWith({ parts: [part('a', null), part('b', null)] }), /exactly one is the root/],
    [rigWith({ parts: [part('a', 'a')] }), /listed before it/],
    [rigWith({ parts: [part('a', null), { name: 'b', parent: 'a', length: 0, mass: 1 }], chains: [] }), /length is a number above 0/],
    [rigWith({ parts: [{ name: 'a', parent: null, length: -1, mass: 1 }] }), /length is a number from 0/],
    [rigWith({ parts: [part('a', null), part('b', 'a', { length: MOST_LENGTH + 1 })], chains: [] }), /length is a number above 0 to 10000/],
    [rigWith({ parts: [part('a', null), part('b', 'a', { length: NaN })], chains: [] }), /length .* not NaN/],
    [rigWith({ parts: [part('a', null), part('b', 'a', { length: Infinity })], chains: [] }), /not Infinity/],
    [rigWith({ parts: [part('a', null), part('b', 'a', { width: -1 })], chains: [] }), /width is a number from 0/],
    [rigWith({ parts: [part('a', null), part('b', 'a', { layer: 'top' })], chains: [] }), /layer is one of "near", "mid", "far"/],
    [rigWith({ parts: [part('a', null), part('b', 'a', { limit: [1, 0] })], chains: [] }), /min ≤ max/],
    [rigWith({ parts: [part('a', null), part('b', 'a', { limit: [-3.2, 3.2] })], chains: [] }), /narrower than a whole turn/],
    [rigWith({ parts: [part('a', null), part('b', 'a', { limit: [0, 7] })], chains: [] }), /within ±2π/],
    [rigWith({ parts: [part('a', null), part('b', 'a', { limit: [0, NaN] })], chains: [] }), /within ±2π/],
    [rigWith({ parts: [part('a', null), part('b', 'a', { limit: [0] })], chains: [] }), /list of 2 to 2/],
    [rigWith({ parts: [part('a', null), part('b', 'a', { limit: [0, 1], rest: 2 })], chains: [] }), /rest is a number from 0 to 1/],
    [rigWith({ parts: [part('a', null), part('b', 'a', { rest: 7 })], chains: [] }), /rest is a number from/],
    [rigWith({ parts: [part('a', null, { limit: [0, 1] })], chains: [] }), /the root: it has no joint/],
    [rigWith({ parts: [part('a', null, { rest: 1 })], chains: [] }), /its rest is 0/],
    [rigWith({ parts: [part('a', null, { mass: 0 }), part('b', 'a', { mass: 0 })], chains: [] }), /sum to 0/],
    [rigWith({ parts: [part('a', null, { mass: -1 })], chains: [] }), /mass is a number from 0/],
    [rigWith({ parts: [part('a', null, { mass: 1e300 }), part('b', 'a', { mass: 1e300 })], chains: [] }), /mass is a number from 0 to 1000000/],
    [rigWith({ parts: [part('a', null, { colour: 'red' })], chains: [] }), /takes name, parent, length/],
    [rigWith({ root: 'b' }), /root is the part with parent null, "a"/],
    [rigWith({ chains: [{ name: 'k', parts: ['b'], solver: 'two-bone', bend: 'front' }] }), /exactly 2/],
    [rigWith({ chains: [{ name: 'k', parts: ['b', 'c', 'c'], solver: 'two-bone', bend: 'front' }] }), /exactly 2/],
    [rigWith({ chains: [{ name: 'k', parts: ['b', 'c'], solver: 'ccd' }] }), /solver is one of "two-bone", "fabrik"/],
    [rigWith({ chains: [{ name: 'k', parts: ['b', 'c'], solver: 'two-bone' }] }), /bend .* is one of "front", "back"/],
    [rigWith({ chains: [{ name: 'k', parts: ['b', 'c'], solver: 'fabrik', bend: 'front' }] }), /bend is for a two-bone chain only/],
    [rigWith({ chains: [{ name: 'k', parts: ['c', 'b'], solver: 'two-bone', bend: 'front' }] }), /the child of "c"/],
    [rigWith({ chains: [{ name: 'k', parts: ['a', 'b'], solver: 'two-bone', bend: 'front' }] }), /starts at the root/],
    [rigWith({ chains: [{ name: 'k', parts: ['b', 'zz'], solver: 'two-bone', bend: 'front' }] }), /parts\[1\] is a part of the rig/],
    [rigWith({ chains: [{ name: 'k', parts: ['b', 'c'], solver: 'two-bone', bend: 'front' }, { name: 'k', parts: ['b', 'c'], solver: 'two-bone', bend: 'back' }] }), /chain "k" is named twice/],
    [rigWith({ parts: Array.from({ length: MOST_CHAIN + 2 }, (_, i) => part(`p${i}`, i ? `p${i - 1}` : null)), chains: [{ name: 'k', parts: Array.from({ length: MOST_CHAIN + 1 }, (_, i) => `p${i + 1}`), solver: 'fabrik' }] }), /2 to 16 — not 17/],
    [rigWith({ feet: ['a'] }), /is the root/],
    [rigWith({ feet: ['c', 'c'] }), /names "c" twice/],
    [rigWith({ loose: ['nope'] }), /loose\[0\] is a part of the rig/],
    [rigWith({ footHeight: -1 }), /footHeight is a number from 0/],
    [rigWith({ parts: [part('a', null), , part('c', 'a')], chains: [] }), /hole in the list/], // eslint-disable-line no-sparse-arrays
  ];
  for (const [rig, pattern] of cases) refused(() => readRig(rig), pattern);
  // a FABRIK chain of 16 is taken, of 2 too
  readRig(rigWith({ parts: Array.from({ length: MOST_CHAIN + 1 }, (_, i) => part(`p${i}`, i ? `p${i - 1}` : null)), chains: [{ name: 'k', parts: Array.from({ length: MOST_CHAIN }, (_, i) => `p${i + 1}`), solver: 'fabrik' }] }));
});

test('a getter is never run: a rig, a part, a list slot, a pose or a target with one is refused', () => {
  let ran = 0;
  const trap = (o, key, value) => Object.defineProperty(o, key, { get() { ran += 1; return value; }, enumerable: true });
  refused(() => readRig(trap(rigWith({}), 'name', 'r')), /getter/);
  const parts = [part('a', null), part('b', 'a'), part('c', 'b')];
  trap(parts[1], 'length', 10);
  refused(() => readRig(rigWith({ parts })), /getter/);
  const list = [part('a', null)];
  trap(list, 0, part('a', null));
  refused(() => readRig(rigWith({ parts: list, chains: [] })), /getter/);
  const r = arm(10, 10);
  refused(() => placeParts(r, trap({ root: [0, 0], turn: 0 }, 'angles', [0, 0, 0])), /getter/);
  refused(() => twoBone(r, at(r), 'reach', trap([0, 0], 1, 5)), /point \[x, y\]/);
  refused(() => humanRig(trap({ name: 'ana' }, 'height', 300)), /getter/);
  assert.equal(ran, 0);
  refused(() => readRig(rigWith({ [Symbol('x')]: 1 })), /takes name/);
});

test('humanRig, poses, windows and targets refuse what they cannot hold', () => {
  refused(() => humanRig(), /humanRig's options is an object/);
  refused(() => humanRig({ name: 'ana' }), /height is a number from 1 to 10000/);
  refused(() => humanRig({ name: 'ana', height: 0.5 }), /height/);
  refused(() => humanRig({ name: 'ana', height: 350, build: 3 }), /build is a number from 0.5 to 2/);
  refused(() => humanRig({ name: 'ana', height: 350, facing: 2 }), /facing/);
  refused(() => humanRig({ name: 'ana', height: 350, size: 2 }), /takes name, height, build, facing/);
  const r = arm(10, 10);
  refused(() => placeParts(r, { root: [0, 0], turn: 0, angles: [0, 0] }), /3 to 3 — not 2/);
  refused(() => placeParts(r, { root: [0, 0], turn: 0, angles: [0.1, 0, 0] }), /root "base".*give 0 here/);
  refused(() => placeParts(r, { root: [0, 0], turn: NaN, angles: [0, 0, 0] }), /turn is an angle/);
  refused(() => placeParts(r, { root: [0, 0], turn: 0, angles: [0, 2e6, 0] }), /angles\[1\] \(part "upper"\)/);
  refused(() => placeParts(r, { root: [0, 2e6], turn: 0, angles: [0, 0, 0] }), /root is a point/);
  refused(() => placeParts(r, { root: [0, 0], turn: 0, angles: [0, 0, 0], extra: 1 }), /takes root, turn, angles/);
  refused(() => placeParts(r, null), /is an object/);
  refused(() => restPose(r, { at: [0, 0] }), /restPose's options takes root/);
  refused(() => restPose(r, { root: [Infinity, 0] }), /restPose's root is a point/);
  refused(() => centreOf(r, [{ start: [0, 0], end: [1, 1] }]), /3 to 3/);
  refused(() => centreOf(r, [null, null, null]), /placed part \{start, end\}/);
  refused(() => centreOf(r, placeParts(r, at(r)).map((p, i) => ({ ...p, name: i ? 'x' : p.name }))), /is part "upper"/);
  refused(() => centreOf(r, [{ start: [0, 0], end: [1, 1] }, { start: [0, 0], end: [NaN, 1] }, { start: [0, 0], end: [1, 1] }]), /end is a point/);
  refused(() => windowAngle(NaN, [0, 1]), /angle is a finite number/);
  refused(() => windowAngle(0, [1, 0]), /min ≤ max/);
  refused(() => windowAngle(0, [0, 7]), /narrower than 2π/);
  refused(() => windowAngle(0, 'wide'), /list of 2 to 2/);
  refused(() => clampPose(r, { root: [0, 0], turn: 0 }), /angles/);
  refused(() => mirrorPose(r, { root: [0, 0], turn: 0, angles: [1, 0, 0] }), /give 0 here/);
  refused(() => twoBone(r, at(r), 'leg', [0, 0]), /one of rig "arm"'s two-bone chains \("reach"\)/);
  refused(() => twoBone(r, at(r), { name: 'reach' }, [0, 0]), /not an object/);
  refused(() => twoBone(r, at(r), 'reach', [0, 1e7]), /no further than 1000000/);
  refused(() => twoBone(r, at(r), 'reach', [0]), /point \[x, y\]/);
  const ana = humanRig({ name: 'ana', height: 350 });
  refused(() => twoBone(ana, restPose(ana), 'spine', [0, 0]), /"spine" is a fabrik chain: use its own solver/);
});
