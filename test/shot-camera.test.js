// The camera and its projection: the same numbers a thin-lens tracer uses, a point and back, a box that holds its ball.
import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { HEIGHTS, LENSES, ROUNDS, SIZES, apertureFor, boxOf, checkShot, distanceFor, frameOf, project, readCamera, unproject } from '../shot.js';

const frame = [1280, 720];
const coord = fc.double({ min: -50, max: 50, noNaN: true });
const camera = fc.record({
  target: fc.tuple(coord, coord, coord), azimuth: fc.double({ min: -7, max: 7, noNaN: true }), elevation: fc.double({ min: -1.5, max: 1.5, noNaN: true }),
  distance: fc.double({ min: 0.5, max: 80, noNaN: true }), focal: fc.double({ min: 0.3, max: 4, noNaN: true }), shift: fc.tuple(fc.double({ min: -0.5, max: 0.5, noNaN: true }), fc.double({ min: -0.5, max: 0.5, noNaN: true })),
});
const close = (a, b, within = 1e-6) => Math.abs(a - b) <= within;

test('straight on, the axes are the ones named: +x right, +y up on the frame, depth away', () => {
  const front = { target: [0, 0, 0], azimuth: 0, elevation: 0, distance: 10, focal: 1 };
  assert.deepEqual({ ...project([0, 0, 0], front, frame) }, { x: 640, y: 360, depth: 10 });
  const right = project([1, 0, 0], front, frame), up = project([0, 1, 0], front, frame);
  assert.ok(close(right.x, 640 + 72) && close(up.y, 360 - 72));
  assert.ok(close(project([0, 0, 0], { ...front, shift: [0.1, 0.07] }, frame).x, 640 + 128) && close(project([0, 0, 0], { ...front, shift: [0.1, 0.07] }, frame).y, 360 - 50.4));
  const fromLeft = { ...front, azimuth: -Math.PI / 2 };
  assert.ok(project([1, 0, 0], fromLeft, frame).depth > 10, 'standing on the -x side, +x is farther');
});

test('property: a point lands where the tracer the shape came from says it does', () => {
  // The law, written out in that tracer's own form as a control: world axes from azimuth and elevation, k = focal × height.
  const control = ({ target, azimuth, elevation, distance, focal, shift }, p) => {
    const ce = Math.cos(elevation), back = [ce * Math.sin(azimuth), Math.sin(elevation), ce * Math.cos(azimuth)], f = back.map((v) => -v);
    const n = Math.hypot(f[2], f[0]), r = [-f[2] / n, 0, f[0] / n], u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
    const d = [0, 1, 2].map((i) => p[i] - target[i] - back[i] * distance), dt = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], z = dt(d, f), near = focal * 720 / z;
    return { x: 640 + 1280 * shift[0] + dt(d, r) * near, y: 360 - 720 * shift[1] - dt(d, u) * near, z };
  };
  fc.assert(fc.property(camera, fc.tuple(coord, coord, coord), (c, p) => {
    const got = project(p, c, frame), want = control(c, p);
    assert.ok(close(got.depth, want.z, 1e-9));
    if (got.x === null) { assert.ok(want.z <= 1e-9); return; }
    assert.ok(close(got.x, want.x, 1e-3 * Math.max(1, Math.abs(want.x))) && close(got.y, want.y, 1e-3 * Math.max(1, Math.abs(want.y))));
  }));
});

test('property: unprojecting a landing gives the point back', () => {
  fc.assert(fc.property(camera, fc.tuple(coord, coord, coord), (c, p) => {
    const { x, y, depth } = project(p, c, frame);
    if (x === null || depth < 0.01) return;
    const back = unproject(x, y, depth, c, frame);
    p.forEach((v, i) => assert.ok(close(back[i], v, 1e-5), `${back} vs ${p}`));
  }));
});

test('at or behind the camera a point lands nowhere: never a mirrored place, never Infinity', () => {
  const c = { target: [0, 0, 0], azimuth: 0, elevation: 0, distance: 5, focal: 1 };
  assert.deepEqual({ ...project([0, 0, 5], c, frame) }, { x: null, y: null, depth: 0 });
  assert.equal(project([1, 1, 9], c, frame).x, null);
  assert.equal(project([1, 1, 5 - 1e-12], c, frame).x, null);
  assert.throws(() => unproject(1, 1, 0, c, frame), /depth/);
});

test('straight up and straight down have a side, and match the view just off them', () => {
  for (const elevation of [Math.PI / 2, -Math.PI / 2]) {
    const c = { target: [0, 0, 0], azimuth: 0.7, elevation, distance: 5, focal: 1 }, p = project([1, 2, 3], c, frame);
    assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
    const near = project([1, 2, 3], { ...c, elevation: elevation * (1 - 1e-7) }, frame);
    assert.ok(close(p.x, near.x, 1e-2) && close(p.y, near.y, 1e-2));
  }
});

test('property: a ball stays inside its box, and its edge reaches each side', () => {
  fc.assert(fc.property(camera, fc.tuple(coord, coord, coord), fc.double({ min: 0.01, max: 5, noNaN: true }), (c, at, r) => {
    const box = boxOf({ name: 'b', at, r }, c, frame);
    if (box.state !== 'seen') return;
    let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
    for (let i = 0; i < 40; i++) for (let j = 0; j <= 20; j++) {
      const a = i / 40 * 2 * Math.PI, b = j / 20 * Math.PI, q = project([at[0] + r * Math.sin(b) * Math.cos(a), at[1] + r * Math.cos(b), at[2] + r * Math.sin(b) * Math.sin(a)], c, frame);
      if (q.x === null) return;
      x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y);
    }
    const slack = 1e-6 * Math.max(1, x1 - x0, y1 - y0);
    assert.ok(x0 >= box.x0 - slack && x1 <= box.x1 + slack && y0 >= box.y0 - slack && y1 <= box.y1 + slack, 'a surface point outside its box');
  }), { numRuns: 60 });
});

test('how near counts as on the camera scales with the scene: a very small scene is still a scene', () => {
  const small = { target: [0, 0, 0], azimuth: 0, elevation: 0, distance: 5e-10, focal: 1 };
  assert.equal(boxOf({ name: 'x', at: [0, 0, 0], r: 1e-10 }, small, frame).state, 'seen');
  assert.ok(project([0, 0, 0], small, frame).x === 640);
  const big = { target: [1e6, 0, 0], azimuth: 0, elevation: 0, distance: 5, focal: 1 };
  assert.equal(boxOf({ name: 'x', at: [1e6, 0, 5] }, big, frame).state, 'inside');
});

test('a box says why it is not a box: behind, inside, reaching past', () => {
  const c = { target: [0, 0, 0], azimuth: 0, elevation: 0, distance: 5, focal: 1 };
  assert.equal(boxOf({ name: 'x', at: [0, 0, 9], r: 1 }, c, frame).state, 'behind');
  assert.equal(boxOf({ name: 'x', at: [0, 0, 4.5], r: 1 }, c, frame).state, 'inside');
  assert.equal(boxOf({ name: 'x', at: [2, 0, 4.5], r: 1 }, c, frame).state, 'crosses');
  assert.equal(boxOf({ name: 'x', at: [0, 0, 5] }, c, frame).state, 'inside');
  assert.equal(boxOf({ name: 'x', at: [0, 0, 5], size: [1, 1] }, c, frame).state, 'inside');
  assert.equal(boxOf({ name: 'x', at: [0, 0, 9], size: [1, 1] }, c, frame).state, 'behind');
  assert.equal(boxOf({ name: 'x', at: [4, 0, 5], size: [1, 1], normal: [1, 0, 0] }, c, frame).state, 'crosses');
  const card = boxOf({ name: 'x', at: [0, 0, 0], size: [2, 1] }, c, frame);
  assert.ok(close(card.x1 - card.x0, 2 * 720 / 5) && close(card.y1 - card.y0, 720 / 5) && card.state === 'seen');
  const floor = boxOf({ name: 'x', at: [0, 0, 0], size: [2, 1], normal: [0, 1, 0] }, { ...c, elevation: Math.PI / 2 }, frame);
  assert.ok(close(floor.x1 - floor.x0, 2 * 720 / 5) && close(floor.y1 - floor.y0, 720 / 5), 'a card lying flat has a side and an up');
});

test('property: a lone ball at the target is in frame 100% from every named view, at the size its word names', () => {
  const heights = Object.keys(HEIGHTS), rounds = Object.keys(ROUNDS), sizes = Object.keys(SIZES), lenses = Object.keys(LENSES);
  fc.assert(fc.property(fc.constantFrom(...rounds), fc.constantFrom(...heights), fc.constantFrom(...sizes), fc.constantFrom(...lenses), fc.tuple(coord, coord, coord), fc.double({ min: 0.001, max: 100, noNaN: true }), (round, height, size, lens, at, r) => {
    const scene = { things: [{ name: 'a', at, r }] }, shot = { on: 'a', from: `${round} ${height}`, size, lens };
    const report = checkShot(scene, frameOf(shot, scene), frame, shot);
    assert.equal(report.inFrame, 1);
    assert.equal(report.size, size);
    assert.ok(close(report.height, SIZES[size], 1e-3), `${report.height}`);
    assert.equal(report.from, `${round} ${height}`);
    assert.ok(report.exactView);
    assert.equal(report.lens, lens);
    assert.ok(report.ok, JSON.stringify(report.faults));
  }));
});

test('a shot on a card sizes it by its height; several by what holds them all', () => {
  const scene = { unit: 'm', things: [{ name: 'card', at: [0, 0, 0], size: [1.6, 0.9] }, { name: 'a', at: [-3, 0, 0], r: 1 }, { name: 'b', at: [3, 0, 0], r: 1 }, { name: 'dot', at: [0, 5, 0] }] };
  const card = checkShot(scene, frameOf({ on: 'card', from: 'front' }, scene), frame, { on: 'card' });
  assert.ok(close(card.height, 0.4, 1e-9));
  const pair = frameOf({ on: ['a', 'b'], from: 'front', size: 'wide' }, scene);
  assert.deepEqual([...pair.target], [0, 0, 0]);
  assert.ok(close(pair.distance, distanceFor(4, 0.2, 1.25)));
  assert.throws(() => frameOf({ on: 'dot', from: 'front' }, scene), /"dot" has no size to frame: give it an r or a size/);
  assert.throws(() => frameOf({ on: 'nope', from: 'front' }, scene), /is not in the scene/);
  assert.throws(() => frameOf({ on: 'a', from: 'front' }, { things: 3 }), /scene.things/);
  const huge = { things: [{ name: 'x', at: [1e9, 1e9, 1e9], r: 1e9 }, { name: 'y', at: [-1e9, -1e9, -1e9], r: 1e9 }] };
  assert.throws(() => frameOf({ on: ['x', 'y'], from: 'front' }, huge), /most a shot can frame/);
  assert.throws(() => frameOf({ on: 'x', from: 'front', size: 'wide', lens: 'long' }, { things: [{ name: 'x', at: [0, 0, 0], r: 1e9 }] }), /would need the camera/);
});

test('focus: on the subject by default, another thing moves the plane, all is a pinhole', () => {
  const scene = { things: [{ name: 'a', at: [0, 0, 0], r: 1 }, { name: 'near', at: [0, 0, 2], r: 0.1 }, { name: 'gone', at: [0, 0, 500], r: 0.1 }] };
  const plain = frameOf({ on: 'a', from: 'front' }, scene);
  assert.equal(plain.focus, undefined);
  assert.equal(plain.aperture, apertureFor(plain.distance));
  assert.equal(frameOf({ on: 'a', from: 'front', focus: 'all' }, scene).aperture, 0);
  assert.ok(close(frameOf({ on: 'a', from: 'front', focus: 'near' }, scene).focus, plain.distance - 2));
  assert.throws(() => frameOf({ on: 'a', from: 'front', focus: 'gone' }, scene), /"gone" is behind the camera from front level/);
});

test('refusals name the fix and read a camera whole', () => {
  const whole = readCamera({ target: [1, 2, 3], azimuth: 0, elevation: 0, distance: 4, focal: 1 });
  assert.deepEqual({ ...whole, target: [...whole.target], shift: [...whole.shift] }, { target: [1, 2, 3], azimuth: 0, elevation: 0, distance: 4, focal: 1, aperture: 0, shift: [0, 0], focus: 4 });
  assert.deepEqual({ ...readCamera(whole), target: [1, 2, 3], shift: [0, 0] }, { ...whole, target: [1, 2, 3], shift: [0, 0] });
  const bad = { target: [0, 0], azimuth: NaN, elevation: Infinity, distance: -1, focal: 0, aperture: -1, focus: 0, shift: [0], zoom: 2 };
  assert.throws(() => readCamera(bad), (e) => {
    assert.deepEqual(e.problems.map((p) => p.at).sort(), ['camera.aperture', 'camera.azimuth', 'camera.distance', 'camera.elevation', 'camera.focal', 'camera.focus', 'camera.shift', 'camera.target', 'camera.zoom'].sort());
    return true;
  });
  assert.throws(() => project([NaN, 0, 0], { target: [0, 0, 0], azimuth: 0, elevation: 0, distance: 5, focal: 1 }, [0, Infinity]), (e) => e.problems.length === 3);
  assert.throws(() => project([0, 0, 0], {}, frame), /camera.target/);
  assert.throws(() => boxOf({}, 3, 'x'), (e) => e.problems.length >= 3);
  assert.throws(() => unproject('a', 1, 1, { target: [0, 0, 0], azimuth: 0, elevation: 0, distance: 5, focal: 1 }, frame), /^TypeError: this projection|x must be/);
  for (const args of [[0, 1, 1], [1, NaN, 1], [1, 1, -1], [2e9, 1, 1]]) assert.throws(() => distanceFor(...args), /three finite numbers/);
  for (const d of [-1, NaN, Infinity, '1']) assert.throws(() => apertureFor(d), /finite distance/);
});
