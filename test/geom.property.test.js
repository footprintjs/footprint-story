// The geometry leaf by property: each function against an independent form of its law on any input. Tolerances, not
// bits: sin, cos and sqrt differ in their last digits across engines.
// FC_RUNS=20000 npm test runs a deep sweep.
import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { angleAt, dihedral, wrapAngle, shortestTurn, unwrapAngles, quatFromAxisAngle, quatMultiply, quatRotate, quatAngle, quatLook, quatForward,
  quatFromAxes, slerp, squad, toSpherical, fromSpherical, greatCircle, lookAt, horizonRoll } from '../geometry.js';

const RUNS = Number(process.env.FC_RUNS) || 300;
const runs = (share = 1) => ({ numRuns: Math.max(20, Math.round(RUNS * share)) });
const PI = Math.PI;
const coord = fc.double({ min: -100, max: 100, noNaN: true });
const p3 = fc.tuple(coord, coord, coord);
const p2 = fc.tuple(coord, coord);
const axis = p3.filter((v) => Math.hypot(...v) > 1e-3);
// fast-check's doubles lean on edge values (0, ±2π, tiny ones); whole milliradians spread the turns evenly too
const angle = fc.oneof(fc.double({ min: -2 * PI, max: 2 * PI, noNaN: true }), fc.integer({ min: -6283, max: 6283 }).map((m) => m / 1000));
const quat = fc.tuple(axis, angle).map(([a, t]) => quatFromAxisAngle(a, t));
const unitS = fc.double({ min: 0, max: 1, noNaN: true });
const len = (v) => Math.hypot(...v);
const sub = (a, b) => a.map((v, i) => v - b[i]);
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);

test('property: angleAt agrees with the law of cosines away from its ends, and a triangle\'s angles add to π', () => {
  fc.assert(fc.property(fc.oneof(fc.tuple(p2, p2, p2), fc.tuple(p3, p3, p3)), ([a, b, c]) => {
    const u = sub(a, b), v = sub(c, b), w = sub(a, c);
    if (len(u) < 1e-3 || len(v) < 1e-3 || len(w) < 1e-3) return;
    const got = angleAt(a, b, c), cos = dot(u, v) / (len(u) * len(v));
    if (Math.abs(cos) < 0.999) assert.ok(Math.abs(got - Math.acos(cos)) < 1e-9);
    assert.ok(got >= 0 && got <= PI);
    const area = a.length === 2 ? Math.abs(u[0] * v[1] - u[1] * v[0]) : len([u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]);
    if (area > 1e-3) assert.ok(Math.abs(got + angleAt(b, c, a) + angleAt(c, a, b) - PI) < 1e-9);
  }), runs());
});

test('property: dihedral does not move when the four points are turned or slid, and flips sign in a mirror', () => {
  fc.assert(fc.property(p3, p3, p3, p3, quat, p3, (a, b, c, d, q, shift) => {
    const want = dihedral(a, b, c, d);
    if (want === null) return;
    // nearly flat or nearly straight four-point chains are ill-conditioned: rounding moves them a lot
    const well = [[a, b, c], [b, c, d]].every(([x, y, z]) => { const s = angleAt(x, y, z); return s !== null && s > 0.05 && s < PI - 0.05; });
    if (!well || len(sub(b, a)) < 1e-2 || len(sub(c, b)) < 1e-2 || len(sub(d, c)) < 1e-2) return;
    const moved = [a, b, c, d].map((p) => quatRotate(q, p).map((v, i) => v + shift[i]));
    const turned = dihedral(...moved);
    assert.ok(Math.abs(wrapAngle(turned - want)) < 1e-7);
    assert.ok(Math.abs(wrapAngle(dihedral(...[a, b, c, d].map(([x, y, z]) => [-x, y, z])) + want)) < 1e-7);
  }), runs());
});

test('property: wrapAngle lands in (−π, π] a whole number of turns away; shortestTurn reaches its target; unwrap undoes a wrap', () => {
  fc.assert(fc.property(fc.double({ min: -1e4, max: 1e4, noNaN: true }), fc.double({ min: -1e4, max: 1e4, noNaN: true }), (x, y) => {
    const w = wrapAngle(x), turns = (x - w) / (2 * PI);
    assert.ok(w > -PI && w <= PI);
    assert.ok(Math.abs(turns - Math.round(turns)) < 1e-9);
    const t = shortestTurn(x, y);
    assert.ok(Math.abs(t) <= PI && Math.abs(wrapAngle(x + t - y)) < 1e-9);
  }), runs());
  fc.assert(fc.property(fc.double({ min: -PI, max: PI, noNaN: true }), fc.array(fc.double({ min: -3, max: 3, noNaN: true }), { maxLength: 40 }), (start, steps) => {
    const truth = steps.reduce((out, s) => [...out, out[out.length - 1] + s], [start]);
    const back = unwrapAngles(truth.map(wrapAngle));
    back.forEach((v, i) => assert.ok(Math.abs(v - truth[i] - (back[0] - truth[0])) < 1e-9));
  }), runs(0.5));
});

test('property: a quaternion turns a vector as Rodrigues\' formula does, keeps its length, and the product composes', () => {
  fc.assert(fc.property(axis, angle, p3, quat, (a, t, v, q2) => {
    const k = a.map((c) => c / len(a)), c = Math.cos(t), s = Math.sin(t), kv = dot(k, v);
    const kx = [k[1] * v[2] - k[2] * v[1], k[2] * v[0] - k[0] * v[2], k[0] * v[1] - k[1] * v[0]];
    const rodrigues = v.map((x, i) => x * c + kx[i] * s + k[i] * kv * (1 - c)), got = quatRotate(quatFromAxisAngle(a, t), v);
    got.forEach((g, i) => assert.ok(Math.abs(g - rodrigues[i]) < 1e-9 * Math.max(1, len(v))));
    assert.ok(Math.abs(len(got) - len(v)) < 1e-9 * Math.max(1, len(v)));
    const q1 = quatFromAxisAngle(a, t), both = quatRotate(quatMultiply(q1, q2), v), step = quatRotate(q1, quatRotate(q2, v));
    both.forEach((g, i) => assert.ok(Math.abs(g - step[i]) < 1e-9 * Math.max(1, len(v))));
  }), runs());
});

test('property: quatAngle is the axis-angle turn\'s size, the same either way round, and a turn from its axes is the turn', () => {
  fc.assert(fc.property(quat, quat, (a, b) => {
    const d = quatAngle(a, b);
    assert.ok(d >= 0 && d <= PI + 1e-12);
    assert.ok(Math.abs(d - quatAngle(b, a)) < 1e-12);
    assert.ok(quatAngle(quatFromAxes(quatRotate(a, [1, 0, 0]), quatRotate(a, [0, 1, 0]), quatRotate(a, [0, 0, 1])), a) < 1e-7);
  }), runs());
  fc.assert(fc.property(axis, fc.double({ min: 0, max: PI, noNaN: true }), (a, t) => assert.ok(Math.abs(quatAngle(quatFromAxisAngle(a, t), [1, 0, 0, 0]) - t) < 1e-9)), runs());
});

test('property: slerp turns at one speed, the shorter way, from a to b exactly', () => {
  fc.assert(fc.property(quat, quat, unitS, unitS, (a, b, s, r) => {
    const whole = quatAngle(a, b), m = slerp(a, b, s);
    assert.ok(Math.abs(quatAngle(a, m) - s * whole) < 1e-7, 'the angle covered is the share of the way');
    assert.ok(Math.abs(quatAngle(m, b) - (1 - s) * whole) < 1e-7);
    assert.ok(Math.abs(quatAngle(slerp(a, b, s), slerp(a, b, r)) - Math.abs(s - r) * whole) < 1e-7, 'even steps, even turns');
    assert.ok(Math.abs(Math.hypot(...m) - 1) < 1e-12);
    assert.ok(quatAngle(slerp(a, b, 1), b) < 1e-7 && quatAngle(slerp(a, b, 0), a) < 1e-12);
  }), runs());
});

test('property: squad passes through every key and stays a unit turn between them', () => {
  fc.assert(fc.property(fc.array(quat, { minLength: 2, maxLength: 7 }), unitS, (keys, s) => {
    keys.forEach((k, i) => assert.ok(quatAngle(squad(keys, i / (keys.length - 1)), k) < 1e-7));
    assert.ok(Math.abs(Math.hypot(...squad(keys, s)) - 1) < 1e-12);
  }), runs(0.5));
});

test('property: spherical places go there and back, and match a camera\'s offset', () => {
  fc.assert(fc.property(p3, (v) => {
    const back = fromSpherical(toSpherical(v));
    back.forEach((c, i) => assert.ok(Math.abs(c - v[i]) < 1e-9 * Math.max(1, len(v))));
    const { azimuth, elevation } = toSpherical(v);
    assert.ok(azimuth > -PI && azimuth <= PI && elevation >= -PI / 2 && elevation <= PI / 2);
  }), runs());
});

test('property: greatCircle stays on the sphere, in the plane of its ends, at one angular speed', () => {
  fc.assert(fc.property(axis, axis, unitS, (a, b, s) => {
    const p = a.map((c) => c / len(a)), q = b.map((c) => c / len(b)), whole = Math.acos(Math.max(-1, Math.min(1, dot(p, q))));
    if (whole > PI - 1e-3) return;   // opposite: no one circle (tested by example)
    const m = greatCircle(a, b, s);
    assert.ok(Math.abs(len(m) - 1) < 1e-12);
    const n = [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]];
    if (len(n) > 1e-6) assert.ok(Math.abs(dot(n, m)) / len(n) < 1e-9, 'on the plane through both ends');
    assert.ok(Math.abs(angleAt(p, [0, 0, 0], m) - s * whole) < 1e-6);
  }), runs());
});

test('property: lookAt aims at its target with the horizon level, and horizonRoll reads back any roll about the view', () => {
  fc.assert(fc.property(p3, p3, fc.double({ min: -3.1, max: 3.1, noNaN: true }), (eye, target, phi) => {
    const f = sub(target, eye);
    if (len(f) < 1e-3 || Math.hypot(f[0], f[2]) < 0.02 * len(f)) return;   // looking within about a degree of straight up or down: no horizon to speak of
    const q = lookAt(eye, target), forward = quatForward(q);
    forward.forEach((c, i) => assert.ok(Math.abs(c - f[i] / len(f)) < 1e-9));
    assert.ok(Math.abs(horizonRoll(q)) < 1e-9);
    assert.ok(Math.abs(wrapAngle(horizonRoll(quatMultiply(q, quatFromAxisAngle([0, 0, 1], phi))) - phi)) < 1e-7);
    assert.ok(quatAngle(q, quatLook(f)) < 1e-12);
  }), runs());
});
