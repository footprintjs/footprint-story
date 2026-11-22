// The geometry leaf (src/geom/, handed out by footprint-story/geometry) against closed forms and the cases that break careless
// maths: points in a line or on top of each other, opposite quaternions, a camera looking straight up or down (gimbal
// lock), angles across ±π. Geometry is pinned to a tolerance: sin, cos and sqrt differ in their last digits across engines.
import test from 'node:test';
import assert from 'node:assert/strict';
import { angleAt, dihedral, wrapAngle, shortestTurn, unwrapAngles, quatFromAxisAngle, quatMultiply, quatNormalize, quatRotate, quatAngle, quatLook, quatForward,
  quatFromAxes, slerp, squad, toSpherical, fromSpherical, greatCircle, lookAt, horizonRoll } from '../geometry.js';
import { quatLog, quatExp } from '../src/geom/quat.js';
import { unit } from '../src/geom/vec.js';

const PI = Math.PI, DEG = PI / 180;
const near = (a, b, within = 1e-12) => assert.ok(Math.abs(a - b) <= within, `${a} is not within ${within} of ${b}`);
const nearAll = (a, b, within = 1e-12) => { assert.equal(a.length, b.length); a.forEach((v, i) => near(v, b[i], within)); };
const sameTurn = (a, b, within = 1e-9) => near(quatAngle(a, b), 0, within);

test('angleAt: right angles, straight lines and folds back, in 2D and 3D', () => {
  near(angleAt([1, 0], [0, 0], [0, 1]), PI / 2);
  near(angleAt([2, 0, 0], [0, 0, 0], [0, 0, -5]), PI / 2);
  assert.equal(angleAt([-1, 0], [0, 0], [3, 0]), PI, 'a straight line is exactly π');
  assert.equal(angleAt([1, 0, 0], [0, 0, 0], [7, 0, 0]), 0, 'folded back onto itself is exactly 0');
  near(angleAt([1, 1], [0, 0], [1, 0]), PI / 4);
  near(angleAt([0, 0, 0], [1, 1, 1], [2, 2, 0]), Math.acos(-1 / 3), 1e-12);   // (−1,−1,−1)·(1,1,−1) = −1 over 3
});

test('angleAt: a sliver keeps its digits (acos would lose half), and huge or tiny scenes neither overflow nor underflow', () => {
  near(angleAt([1, 1e-10], [0, 0], [1, 0]), 1e-10, 1e-24);
  near(angleAt([1e200, 0, 0], [0, 0, 0], [0, 1e200, 0]), PI / 2);
  near(angleAt([1e-200, 0], [0, 0], [0, 1e-200]), PI / 2);
  // points near ±1e308, whose differences overflow unless scaled first, and subnormal points, whose 1/length is Infinity
  near(angleAt([1e308, 0], [-1e308, 0], [-1e308, 1e308]), PI / 2);
  near(angleAt([1.7e308, 1.7e308, 0], [0, 0, 0], [-1.7e308, 1.7e308, 0]), PI / 2);
  near(angleAt([5e-324, 0], [0, 0], [0, 5e-324]), PI / 2);
  near(angleAt([1e-320, 3e-321, 0], [0, 0, 0], [3e-321, 1e-320, 0]), Math.PI / 2 - 2 * Math.atan2(3, 10), 1e-3);   // subnormals carry few digits
  near(dihedral([1e308, 0, 0], [0, 0, 0], [0, 0, 1e308], [0, -1e308, 1e308]), -PI / 2);
  near(dihedral([5e-324, 0, 0], [0, 0, 0], [0, 0, 5e-324], [0, 5e-324, 5e-324]), PI / 2);
  assert.deepEqual(quatForward(lookAt([0, 0, 1e308], [0, 0, -1e308])).map((v) => Math.round(v * 1e12) / 1e12 + 0), [0, 0, -1]);
  assert.deepEqual(quatForward(quatLook([5e-324, 0, 0])).map((v) => Math.round(v * 1e12) / 1e12 + 0), [1, 0, 0]);
});

test('angleAt: a point on b gives no angle (null); bad points are refused in words', () => {
  assert.equal(angleAt([0, 0], [0, 0], [1, 0]), null);
  assert.equal(angleAt([1, 2, 3], [4, 5, 6], [4, 5, 6]), null);
  assert.throws(() => angleAt([0, 0], [0, 0, 0], [1, 0]), /angleAt's b is a list of 2 finite numbers/);
  assert.throws(() => angleAt([0, NaN], [0, 0], [1, 0]), /angleAt's a is a list of 2 or 3 finite numbers — not \[0,NaN\]/);
  assert.throws(() => angleAt('a', [0, 0], [1, 0]), /not "a"/);
  const loop = []; loop.push(loop);
  assert.throws(() => angleAt(loop, [0, 0], [1, 0]), /not \[\[object\]\]/, 'a value JSON cannot show is named by its type');
});

test('dihedral: the twist about b→c is the angle d turns round the axis, right-handed (IUPAC), across the whole circle', () => {
  for (let deg = -179; deg <= 180; deg += 7) {
    const phi = deg * DEG;
    near(dihedral([1, 0, 0], [0, 0, 0], [0, 0, 1], [Math.cos(phi), Math.sin(phi), 1]), phi, 1e-12);
  }
  near(Math.abs(dihedral([1, 0, 0], [0, 0, 0], [0, 0, 1], [-1, 0, 1])), PI, 1e-12);   // anti: ±π, the same twist
  near(dihedral([1, 0, 0], [0, 0, 0], [0, 0, 1], [1, 0, 1]), 0);   // eclipsed
  // butane's gauche: 60°, with bonds of different lengths (the twist does not care how long they are)
  near(dihedral([3, 0, 0], [0, 0, 0], [0, 0, 1.5], [0.25, Math.sqrt(3) / 4, 9]), 60 * DEG, 1e-12);
});

test('dihedral: a mirror flips its sign, reading it backwards keeps it, three in a line give null', () => {
  const p = [[1, 0.2, -0.3], [0, 0, 0], [0.1, 0.3, 1.2], [-0.8, 0.9, 1.7]], m = p.map(([x, y, z]) => [x, y, -z]);
  near(dihedral(...m), -dihedral(...p), 1e-12);
  near(dihedral(...[...p].reverse()), dihedral(...p), 1e-12);
  assert.equal(dihedral([0, 0, 0], [0, 0, 1], [0, 0, 2], [1, 0, 3]), null, 'a, b, c in a line: no first plane');
  assert.equal(dihedral([1, 0, 0], [0, 0, 0], [0, 0, 1], [0, 0, 5]), null, 'b, c, d in a line: no second plane');
  assert.equal(dihedral([0, 0, 0], [0, 0, 0], [0, 0, 1], [1, 0, 1]), null, 'a on b: no bond');
  assert.throws(() => dihedral([0, 0], [0, 0, 0], [0, 0, 1], [1, 0, 1]), /dihedral's a is a list of 3 finite numbers/);
});

test('wrapAngle, shortestTurn: (−π, π], half a turn the positive way, many turns away', () => {
  assert.equal(wrapAngle(PI), PI);
  assert.equal(wrapAngle(-PI), PI);
  near(wrapAngle(3 * PI), PI, 1e-12);
  near(wrapAngle(-3 * PI), PI, 1e-12);
  near(wrapAngle(2 * PI), 0, 1e-15);
  assert.equal(wrapAngle(0.5), 0.5);
  near(wrapAngle(1e6 * 2 * PI + 1), 1, 1e-8);
  near(shortestTurn(170 * DEG, -170 * DEG), 20 * DEG, 1e-12);
  near(shortestTurn(-170 * DEG, 170 * DEG), -20 * DEG, 1e-12);
  assert.equal(shortestTurn(0, PI), PI);
  assert.equal(shortestTurn(0, -PI), PI);
  assert.throws(() => wrapAngle(Infinity), /wrapAngle's angle is a finite number/);
  assert.throws(() => shortestTurn('0', 1), /shortestTurn's from is a finite number/);
});

test('unwrapAngles: a turn across ±π continues instead of jumping back, and the first angle is kept', () => {
  nearAll(unwrapAngles([3.1, -3.1, -2.9]), [3.1, 2 * PI - 3.1, 2 * PI - 2.9], 1e-12);
  nearAll(unwrapAngles([-3, 3]), [-3, 3 - 2 * PI], 1e-12);
  // a steady spin of 100° a step, as atan2 reports it, comes back steady
  const truth = Array.from({ length: 20 }, (_, i) => 0.3 + i * 100 * DEG);
  nearAll(unwrapAngles(truth.map(wrapAngle)), truth.map((v) => v - (wrapAngle(0.3) - 0.3)), 1e-9);
  assert.deepEqual(unwrapAngles([]), []);
  assert.throws(() => unwrapAngles('3'), /a list of at most 1e6 angles/);
  assert.throws(() => unwrapAngles([1, 'x']), /unwrapAngles' angles\[1\] is a finite number/);
});

test('quaternions: axis-angle turns as the right hand says, the product composes, length 1 again', () => {
  nearAll(quatRotate(quatFromAxisAngle([0, 0, 1], PI / 2), [1, 0, 0]), [0, 1, 0]);
  nearAll(quatRotate(quatFromAxisAngle([0, 2, 0], PI / 2), [0, 0, -1]), [-1, 0, 0]);   // the axis need not be unit length
  const yaw = quatFromAxisAngle([0, 1, 0], 0.7), pitch = quatFromAxisAngle([1, 0, 0], -0.4), v = [0.3, -1.2, 2];
  nearAll(quatRotate(quatMultiply(yaw, pitch), v), quatRotate(yaw, quatRotate(pitch, v)), 1e-12);   // b, then a
  assert.ok(quatAngle(quatMultiply(yaw, pitch), quatMultiply(pitch, yaw)) > 0.01, 'turns do not commute');
  nearAll(quatNormalize([2, 0, 0, 0]), [1, 0, 0, 0]);
  nearAll(quatRotate([3, 0, 0, 0], [1, 2, 3]), [1, 2, 3], 1e-15);   // a scaled identity still turns nothing
  assert.throws(() => quatNormalize([0, 0, 0, 0]), /has no length: it is no turn/);
  nearAll(quatNormalize([1e308, 1e308, 1e308, 1e308]), [0.5, 0.5, 0.5, 0.5]);   // its length overflows unless scaled first
  near(quatAngle([1e308, 1e308, 1e308, 1e308], [1e308, -1e308, -1e308, -1e308]), 2 * PI / 3, 1e-12);   // ±120° about (1,1,1)
  nearAll(quatNormalize([5e-324, 0, 0, 0]), [1, 0, 0, 0]);
  assert.throws(() => quatFromAxisAngle([0, 0, 0], 1), /a turn needs a line to turn about/);
  assert.throws(() => quatMultiply([1, 0, 0], [1, 0, 0, 0]), /quatMultiply's a is a list of 4 finite numbers/);
});

test('quatAngle: q and −q are one turn; a full turn is no turn; the angle never passes π', () => {
  const q = quatFromAxisAngle([1, 2, 3], 1.1);
  near(quatAngle(q, q.map((c) => -c)), 0, 1e-15);   // antipodal quaternions are the same turn
  near(quatAngle(q, [1, 0, 0, 0]), 1.1, 1e-12);
  near(quatAngle(quatFromAxisAngle([0, 1, 0], 2 * PI), [1, 0, 0, 0]), 0, 1e-12);
  near(quatAngle(quatFromAxisAngle([0, 1, 0], 1.5 * PI), [1, 0, 0, 0]), 0.5 * PI, 1e-12);
  near(quatAngle(quatFromAxisAngle([0, 0, 1], PI), [1, 0, 0, 0]), PI, 1e-12);
  near(quatAngle(quatFromAxisAngle([0, 0, 1], 1e-9), [1, 0, 0, 0]), 1e-9, 1e-22);   // a tiny turn keeps its digits
});

test('quatFromAxes: every branch of Shepperd\'s method gives back the turn, half turns about each axis too', () => {
  // 150° about each axis: that axis's sum is the largest and w is not 0, so a wrong sign in a branch shows
  const each = [[1, 0, 0], [0, 1, 0], [0, 0, 1]].flatMap((a) => [quatFromAxisAngle(a, PI), quatFromAxisAngle(a, 150 * DEG), quatFromAxisAngle(a, -150 * DEG)]);
  for (const q of [[1, 0, 0, 0], ...each, quatFromAxisAngle([1, -2, 0.5], 2.9), quatFromAxisAngle([0, 1, 1], 0.2)]) {
    sameTurn(quatFromAxes(quatRotate(q, [1, 0, 0]), quatRotate(q, [0, 1, 0]), quatRotate(q, [0, 0, 1])), q, 1e-12);
  }
});

test('quatFromAxes refuses three axes that are no turn: stretched, sheared or mirrored, in words', () => {
  assert.throws(() => quatFromAxes([2, 0, 0], [0, 1, 0], [0, 0, 1]), /three axes of length 1 at right angles — these are 1\.00 off/);
  assert.throws(() => quatFromAxes([1, 0, 0], [Math.SQRT1_2, Math.SQRT1_2, 0], [0, 0, 1]), /at right angles — these are 0\.707 off/);
  assert.throws(() => quatFromAxes([1, 0, 0], [0, 1, 0], [0, 0, -1]), /a right-handed frame \(back = right × up\): these three are a mirror/);
  sameTurn(quatFromAxes([1, 0, 0], [0, 1, 0], [0, 0, 1 + 1e-9]), [1, 0, 0, 0]);   // rounding is not a shear
});

test('quatLook and quatForward: a camera points where it is told, horizon level, even straight up or down (gimbal lock)', () => {
  sameTurn(quatLook([0, 0, -1]), [1, 0, 0, 0]);
  nearAll(quatForward(quatLook([3, -4, 0])), [0.6, -0.8, 0], 1e-12);
  near(horizonRoll(quatLook([3, -4, 2])), 0, 1e-12);
  for (const down of [[0, -1, 0], [0, 1, 0], [0, -5, 0]]) {
    const q = quatLook(down);
    nearAll(quatForward(q), unit(down), 1e-12);
    near(Math.hypot(...q), 1, 1e-12);
    assert.equal(horizonRoll(q), null, 'straight up or down there is no horizon to lean');
    assert.deepEqual(quatLook(down), q, 'the side it picks at the pole is the same every time');
  }
  // looking along x with x as up: the pole fallback takes +z's side
  nearAll(quatForward(quatLook([1, 0, 0], [1, 0, 0])), [1, 0, 0], 1e-12);
  // just off the pole the horizon is still exact
  const off = quatLook([Math.sin(1e-4), -Math.cos(1e-4), 0]);
  near(horizonRoll(off), 0, 1e-9);
  assert.throws(() => quatLook([0, 0, 0]), /a forward and an up with some length/);
});

test('slerp: exact ends, the shorter way round, opposite quaternions stay put, near-parallel turns stay finite', () => {
  const a = quatFromAxisAngle([0, 1, 0], 0.2), b = quatFromAxisAngle([0, 1, 0], 1.4);
  assert.deepEqual(slerp(a, b, 0), quatNormalize(a));
  assert.deepEqual(slerp(a, b, 1), quatNormalize(b));
  sameTurn(slerp(a, b, 0.5), quatFromAxisAngle([0, 1, 0], 0.8), 1e-12);
  // b written as −b: still the shorter way, and its end is −(−b), the same turn
  sameTurn(slerp(a, b.map((c) => -c), 0.25), quatFromAxisAngle([0, 1, 0], 0.5), 1e-12);
  // 350° one way is 10° the other: slerp goes 10°
  sameTurn(slerp([1, 0, 0, 0], quatFromAxisAngle([0, 0, 1], 350 * DEG), 0.5), quatFromAxisAngle([0, 0, 1], -5 * DEG), 1e-12);
  // q to −q: the same turn, so every point between is that turn
  for (const s of [0, 0.3, 0.5, 1]) sameTurn(slerp(a, a.map((c) => -c), s), a, 1e-12);
  // a hair apart: the line blend, finite and between them
  const c = quatFromAxisAngle([0, 1, 0], 0.2 + 1e-9), mid = slerp(a, c, 0.5);
  assert.ok(mid.every(Number.isFinite));
  near(quatAngle(a, mid), 5e-10, 1e-15);
  // a half turn apart (dot 0): even speed still
  near(quatAngle([1, 0, 0, 0], slerp([1, 0, 0, 0], [0, 1, 0, 0], 0.25)), PI / 4, 1e-12);
  assert.throws(() => slerp(a, b, NaN), /slerp's s is a finite number/);
});

test('squad: passes through each key, two keys are slerp, flipped signs in the keys change nothing', () => {
  const keys = [[1, 0, 0, 0], quatFromAxisAngle([0, 1, 0], 1), quatFromAxisAngle([1, 1, 0], 2), quatFromAxisAngle([0, 0, 1], -0.5)];
  keys.forEach((k, i) => sameTurn(squad(keys, i / 3), k, 1e-12));
  const flipped = keys.map((k, i) => (i % 2 ? k.map((c) => -c) : k));
  for (const s of [0.1, 0.4, 0.77]) sameTurn(squad(flipped, s), squad(keys, s), 1e-12);
  for (const s of [0, 0.2, 0.9, 1]) sameTurn(squad(keys.slice(0, 2), s), slerp(keys[0], keys[1], s), 1e-12);
  sameTurn(squad(keys, -1), keys[0]);
  sameTurn(squad(keys, 2), keys[3]);
  assert.throws(() => squad([keys[0]], 0.5), /squad takes a list of 2 to 4096 quaternions/);
  assert.throws(() => squad(keys, 'x'), /squad's s is a finite number/);
});

test('squad is smooth through a key (its turning speed matches either side: C¹), where slerps joined end to end are not', () => {
  const keys = [[1, 0, 0, 0], quatFromAxisAngle([0, 1, 0], 1), quatFromAxisAngle([1, 0, 0], 1.2), quatFromAxisAngle([0, 0, 1], 0.4)], h = 1e-5, at = 1 / 3;
  const rate = (f, s0, s1) => quatAngle(f(s0), f(s1)) / (s1 - s0);
  const before = rate((s) => squad(keys, s), at - h, at), after = rate((s) => squad(keys, s), at, at + h);
  near(before, after, 1e-3 * before);
  const chain = (s) => (s <= at ? slerp(keys[0], keys[1], s * 3) : slerp(keys[1], keys[2], (s - at) * 3));
  assert.ok(Math.abs(rate(chain, at - h, at) - rate(chain, at, at + h)) > 0.1, 'joined slerps change speed at the key');
});

test('quatLog and quatExp undo each other, the identity included', () => {
  const q = quatFromAxisAngle([0.2, -1, 0.4], 2.2);
  sameTurn(quatExp(quatLog(q)), q, 1e-12);
  assert.deepEqual(quatLog([1, 0, 0, 0]), [0, 0, 0, 0]);
  assert.deepEqual(quatExp([0, 0, 0, 0]), [1, 0, 0, 0]);
});

test('spherical places: the shot camera\'s convention, there and back, straight up has azimuth 0', () => {
  const { azimuth, elevation, distance } = toSpherical([1, 1, 0]);
  near(azimuth, PI / 2); near(elevation, PI / 4); near(distance, Math.SQRT2);
  nearAll(fromSpherical({ azimuth: -PI / 2, elevation: 0, distance: 2 }), [-2, 0, 0], 1e-12);   // left is the −x side
  assert.deepEqual(toSpherical([0, 3, 0]), { azimuth: 0, elevation: PI / 2, distance: 3 });
  assert.deepEqual(toSpherical([0, 0, 0]), { azimuth: 0, elevation: 0, distance: 0 });
  assert.equal(toSpherical([-0, 0, -1]).azimuth, PI, 'straight behind is +π, never −π');
  assert.throws(() => fromSpherical(null), /fromSpherical takes \{azimuth, elevation, distance\}/);
  assert.throws(() => fromSpherical({ azimuth: 0, elevation: 0 }), /fromSpherical's distance is a finite number/);
});

test('greatCircle: exact ends, even speed, a right angle halves to the middle, opposite directions go over the top', () => {
  nearAll(greatCircle([0, 0, 2], [3, 0, 0], 0), [0, 0, 1]);
  nearAll(greatCircle([0, 0, 2], [3, 0, 0], 1), [1, 0, 0]);
  nearAll(greatCircle([0, 0, 1], [1, 0, 0], 0.5), [Math.SQRT1_2, 0, Math.SQRT1_2]);
  near(angleAt(greatCircle([0, 0, 1], [1, 0, 0], 1 / 3), [0, 0, 0], [0, 0, 1]), PI / 6, 1e-12);
  nearAll(greatCircle([0, 0, 1], [0, 0, -1], 0.5), [0, 1, 0], 1e-12);   // front to back rises over the top
  nearAll(greatCircle([0, 1, 0], [0, -1, 0], 0.5), [0, 0, 1], 1e-12);   // straight up to straight down: through +z, decided
  nearAll(greatCircle([1, 0, 0], [1, 1e-9, 0], 0.5), [1, 5e-10, 0], 1e-15);
  assert.throws(() => greatCircle([0, 0, 0], [1, 0, 0], 0.5), /two directions with some length/);
});

test('lookAt and horizonRoll: aimed at the target, horizon level; a roll about the view is read back exactly', () => {
  nearAll(quatForward(lookAt([0, 2, 10], [0, 2, 0])), [0, 0, -1], 1e-12);
  assert.equal(lookAt([1, 1, 1], [1, 1, 1]), null, 'an eye on its target looks nowhere');
  assert.equal(horizonRoll(lookAt([0, 9, 0], [0, 0, 0])), null);
  for (const phi of [-170, -45, 0.3, 12, 90, 179].map((d) => d * DEG)) {
    const level = lookAt([4, 3, 5], [0, 0, 0]), rolled = quatMultiply(level, quatFromAxisAngle([0, 0, 1], phi));
    near(horizonRoll(rolled), phi, 1e-9);
  }
  near(Math.abs(horizonRoll(quatMultiply(quatLook([0, 0, -1]), quatFromAxisAngle([0, 0, 1], PI)))), PI, 1e-12);   // upside down
});
