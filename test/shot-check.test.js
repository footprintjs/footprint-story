// The camera check must be useful, not flattering: each way a shot goes wrong is seen, and what is fine is left alone.
import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { checkShot, frameOf, shotLine } from '../shot.js';

const frame = [1280, 720];
const look = (over = {}) => ({ target: [0, 0, 0], azimuth: 0, elevation: 0, distance: 10, focal: 1.25, ...over });
const ball = (name, x, y, z, r = 1) => ({ name, at: [x, y, z], r });
const kinds = (report) => report.faults.map((q) => q.kind);
const check = (things, camera = look(), on = 'a') => checkShot({ things }, camera, frame, { on });

test('a subject fine on every count has no fault', () => {
  const r = check([ball('a', 0, 0, 0)]);
  assert.ok(r.ok);
  assert.equal(r.inFrame, 1);
  assert.ok(r.height > 0.2 && r.height < 0.3);
  assert.equal(r.size, 'wide');
  assert.deepEqual([...r.blockers], []);
});

test('behind the camera is said, with no numbers to flatter it', () => {
  const r = check([ball('a', 0, 0, 20)]);
  assert.deepEqual(kinds(r), ['behind']);
  assert.equal(r.inFrame, 0);
  assert.equal(r.depth, null);
  assert.equal(r.size, null);
});

test('off frame is said, and the side', () => {
  for (const [at, side] of [[[20, 0, 0], 'right'], [[-20, 0, 0], 'left'], [[0, 20, 0], 'top'], [[0, -20, 0], 'bottom']]) {
    const r = check([ball('a', ...at)]);
    assert.deepEqual(kinds(r), ['off-frame']);
    assert.deepEqual([...r.rows[0].sides], [side]);
  }
});

test('at the frame edge about half is in frame, and the cut is named', () => {
  // The frame's right edge is at x = 640 / (1.25 × 720 / 10) = 7.11 at this depth.
  const r = check([ball('a', 640 / 90, 0, 0)]);
  assert.deepEqual(kinds(r), ['cut-off']);
  assert.ok(Math.abs(r.inFrame - 0.5) < 0.04, String(r.inFrame));
  assert.deepEqual([...r.rows[0].sides], ['right']);
});

test('past a corner the count is of the ball, not its box: the box can reach the frame when the ball does not', () => {
  const x = 640 / 90, y = 360 / 90;
  const r = check([ball('a', x + 1, y + 0.85, 0)]);
  assert.deepEqual(kinds(r), ['off-frame']);
  assert.deepEqual([...r.rows[0].sides], ['right', 'top']);
  const box = check([ball('a', x - 0.75, y - 0.75, 0)]);
  assert.ok(box.inFrame > 0.7 && box.inFrame < 0.8, 'less than the box, which is 77% in');
});

test('a sliver in a corner is a sliver, not nothing', () => {
  // So near and so far to the side that its image is thousands of pixels wide, and the frame holds only its edge.
  const r = check([ball('a', 2, 0, 8.8)]);
  assert.deepEqual(kinds(r), ['cut-off']);
  assert.ok(r.inFrame > 0 && r.inFrame < 0.02, String(r.inFrame));
});

test('too small is said, and a size between words is the nearest word', () => {
  const r = check([ball('a', 0, 0, 0, 0.1)]);
  assert.deepEqual(kinds(r), ['too-small']);
  assert.equal(check([ball('a', 0, 0, 0, 0.5)], look({ distance: 3.4 })).size, 'medium');
  const group = check([ball('a', -5, 0, 0, 0.1), ball('b', 0, 3, 0, 0.1)], look(), ['a', 'b']);
  assert.deepEqual(kinds(group), [], 'small things can fill a frame together');
  assert.equal(check([ball('a', -1, 0, 0, 0.1), ball('b', 0, 0, 0, 0.1)], look(), ['a', 'b']).faults[0].on, null);
});

test('a nearer thing blocks, by how much it covers', () => {
  const whole = check([ball('a', 0, 0, 0), ball('b', 0, 0, 5, 1)]);
  assert.deepEqual(kinds(whole), ['blocked']);
  assert.equal(whole.blockers[0].share, 1);
  const half = check([{ name: 'a', at: [0, 0, 0], size: [2, 2] }, { name: 'b', at: [0.5, 0, 5], size: [1, 3] }]);
  assert.ok(Math.abs(half.blockers[0].share - 0.5) < 0.1, String(half.blockers[0].share));
});

test('a farther thing never blocks, whatever its size', () => {
  for (const r of [check([ball('a', 0, 0, 0), ball('b', 0, 0, -9, 4)]), check([ball('a', 0, 0, 0), { name: 'b', at: [0, 0, -2], size: [20, 20] }])]) assert.deepEqual(kinds(r), []);
});

test('a thing beside the subject blocks nothing, though their boxes touch', () => {
  const r = check([ball('a', 0, 0, 0), ball('b', 1.5, 1.5, 5, 0.3)]);
  assert.deepEqual(kinds(r), [], 'the corner of a box is not a ball');
});

test('a big thing holding the subject blocks it from outside; a small thing inside the subject does not', () => {
  assert.equal(check([ball('a', 0, 0, 0, 0.5), ball('shell', 0, 0, 0, 2)]).blockers[0].share, 1);
  assert.deepEqual([...check([ball('a', 0, 0, 0, 0.5), ball('shell', 0, 0, 0, 20)]).blockers], [], 'the camera is inside it too, and meets the subject first');
  assert.deepEqual(kinds(check([ball('a', 0, 0, 0), ball('core', 0, 0, 0, 0.1)])), []);
  assert.deepEqual(kinds(check([ball('a', 0, 0, 0), ball('twin', 0, 0, 0)])), [], 'two in one place: neither is nearer');
});

test('a thing behind the camera, a point or a thing that reaches past blocks only what it really covers', () => {
  assert.deepEqual(kinds(check([ball('a', 0, 0, 0), ball('b', 0, 0, 30, 5)])), []);
  assert.deepEqual(kinds(check([ball('a', 0, 0, 0), { name: 'p', at: [0, 0, 5] }])), []);
  const past = check([ball('a', 0, 0, 0), ball('b', 0, 2, 10, 3)]);
  assert.equal(past.rows[0].blockers.length, 1, 'it stands on both sides of the camera and hangs over the frame');
});

test('camera exactly on the subject: in it, on a point, on a card', () => {
  for (const thing of [ball('a', 0, 0, 10), { name: 'a', at: [0, 0, 10] }, { name: 'a', at: [0, 0, 10], size: [1, 1] }]) {
    const r = check([thing]);
    assert.deepEqual(kinds(r), ['inside']);
    assert.match(shotLine(r), /the camera is on it — pull back/);
  }
  assert.deepEqual(kinds(check([ball('a', 0, 0, 0)], look({ distance: 0 }))), ['inside']);
  assert.deepEqual(kinds(check([ball('a', 3, 0, 9.5, 2)])), ['crosses']);
});

test('a point has a place and no size, and can still be hidden', () => {
  const r = check([{ name: 'a', at: [0, 0, 0] }]);
  assert.ok(r.ok);
  assert.equal(r.size, null);
  assert.equal(r.inFrame, 1);
  assert.equal(check([{ name: 'a', at: [20, 0, 0] }]).inFrame, 0);
  assert.deepEqual(kinds(check([{ name: 'a', at: [0, 0, 0] }, ball('b', 0, 0, 5)])), ['blocked']);
  assert.deepEqual(kinds(check([{ name: 'a', at: [0, 0, 0] }, ball('b', 0, 0, -5)])), []);
});

test('a card edge-on or showing its back is said, unless its back is fine', () => {
  const card = (over) => ({ name: 'a', at: [0, 0, 0], size: [4, 3], ...over });
  assert.deepEqual(kinds(check([card()])), []);
  assert.ok(kinds(check([card({ normal: [1, 0, 0.1] })])).includes('edge-on'));
  assert.deepEqual(kinds(check([card({ normal: [0, 0, -1] })])), ['back']);
  assert.deepEqual(kinds(check([card({ normal: [0, 0, -1], back: true })])), []);
});

test('soft: off the focus plane by more than half a pixel', () => {
  const things = [ball('a', 0, 0, 0)];
  assert.deepEqual(kinds(check(things, look({ aperture: 0.05 }))), []);
  const r = check(things, look({ aperture: 0.05, focus: 5 }));
  assert.deepEqual(kinds(r), ['soft']);
  assert.ok(Math.abs(r.blur - 0.05 * 900 * (1 / 5 - 1 / 10)) < 1e-3);
  assert.deepEqual(kinds(check(things, look({ aperture: 0, focus: 5 }))), []);
  assert.throws(() => check(things, look({ distance: 0, aperture: 5 })), /camera.distance is 0, which leaves a lens with no plane to focus on/);
  assert.deepEqual(kinds(check([ball('a', 0, 0, -5)], look({ distance: 0, aperture: 5, focus: 2 }))), ['soft']);
  assert.throws(() => check(things, look({ distance: 5e-324 })), /too small to work with: use larger units/);
});

test('a group: the worst is named, one hides another, one lost does not lose the rest', () => {
  const things = [ball('a', 0, 0, 0), ball('b', 0, 0, -5), ball('c', 40, 0, 0), ball('d', 0, 0, 30)];
  const r = check(things, look(), ['a', 'b', 'c', 'd']);
  assert.deepEqual(kinds(r).sort(), ['behind', 'blocked', 'off-frame']);
  assert.equal(r.blockers[0].of, 'b');
  assert.equal(r.inFrame, 0);
  assert.equal(shotLine(r), 'shot "a", "b", "c" and 1 more from front level (11.7, lens normal): "d" behind the camera, off frame right ("c"), 25% of height (wide), "a" covers 100% of "b", sharp — move the view or lift it; aim at it; turn the camera to it');
});

test('cut off by a few pixels at any edge is cut off, never 100% and fine', () => {
  const px = 1 / 90;   // a pixel, at this depth
  for (const [at, side] of [[[-640 - 3 + 200, 0], 'left'], [[640 + 3 - 200, 0], 'right'], [[0, 360 + 3 - 100], 'top'], [[0, -360 - 3 + 100], 'bottom']]) {
    const r = check([{ name: 'a', at: [at[0] * px, at[1] * px, 0], size: [400 * px, 200 * px] }]);
    assert.deepEqual(kinds(r), ['cut-off'], side);
    assert.ok(r.inFrame > 0.97 && r.inFrame < 1, String(r.inFrame));
    assert.deepEqual([...r.rows[0].sides], [side]);
    assert.match(shotLine(r), new RegExp(`in frame 9\\d%, cut off ${side}`));
  }
  const slide = check([{ name: 'a', at: [0, 0, 0], size: [1360 / 90, 765 / 90] }]);
  assert.deepEqual(kinds(slide), ['cut-off']);
  assert.ok(Math.abs(slide.inFrame - 1280 * 720 / (1360 * 765)) < 1e-3);
  const hair = check([{ name: 'a', at: [(640 + 1e-6 - 200) * px, 0, 0], size: [400 * px, 200 * px] }]);
  assert.deepEqual(kinds(hair), ['cut-off'], 'past by any amount is past');
  assert.ok(hair.inFrame < 1);
  const tinyIn = check([{ name: 'a', at: [(640 + 200 - 1e-3) * px, 0, 0], size: [400 * px, 200 * px] }]);
  assert.ok(tinyIn.inFrame > 0, 'a sliver in frame never rounds to none');
});

test('a card seen exactly edge-on has no area, and keeps its place', () => {
  const r = check([{ name: 'a', at: [0, 0, 0], size: [4, 3], normal: [1, 0, 0], back: true }]);
  assert.equal(r.inFrame, 1);
  assert.ok(kinds(r).includes('edge-on'));
  const past = check([{ name: 'a', at: [-7, 0, 0], size: [2, 2], normal: [0, 1, 0], back: true }], look({ elevation: 0 }));
  assert.equal(past.rows[0].state, 'seen');
  assert.deepEqual([...check([{ name: 'a', at: [0, 0, 0], size: [4, 3], normal: [1, 0, 0], back: true }, ball('b', 0, 0, 5)]).blockers], [], 'it fills nothing, so nothing covers it');
});

test('a thing that never reaches the frame covers nothing there', () => {
  const r = check([ball('a', 0, 0, 0), { name: 'wing', at: [12, 0, 9.5], size: [2, 2], normal: [1, 0, 0] }, ball('crossing', 9, 0, 10, 2)]);
  assert.deepEqual([...r.blockers], []);
});

test('what it refuses, it refuses all at once', () => {
  assert.throws(() => checkShot({ things: [{ name: 'a' }] }, {}, [0], {}), (e) => {
    const at = e.problems.map((p) => p.at);
    for (const place of ['scene.things[0].at', 'camera.target', 'frame', 'on']) assert.ok(at.includes(place), place);
    return true;
  });
  assert.throws(() => check([ball('a', 0, 0, 0)], look(), 'nope'), /"nope" is not in the scene/);
  assert.throws(() => checkShot({ things: [] }, look(), frame, null), /pass a read shot or \{on\}/);
});

test('same input, same bytes; a read shot serves as its own subject', () => {
  const scene = { unit: 'm', things: [ball('a', 0, 0, 0), ball('b', 0.4, 0.2, 3, 0.4), { name: 'c', at: [1, 1, 1], size: [1, 1] }] };
  const shot = { on: 'a', from: 'front-left high', size: 'close' }, camera = frameOf(shot, scene);
  const once = JSON.stringify(checkShot(scene, camera, frame, shot));
  assert.equal(JSON.stringify(checkShot(scene, camera, frame, shot)), once);
  assert.ok(Object.isFrozen(checkShot(scene, camera, frame, shot).rows[0]));
});

test('property: nothing a scene can say makes a report that is not finite', () => {
  const coord = fc.double({ min: -30, max: 30, noNaN: true });
  const thing = fc.oneof(fc.record({ at: fc.tuple(coord, coord, coord), r: fc.oneof(fc.constant(0), fc.double({ min: 1e-6, max: 20, noNaN: true })) }), fc.record({ at: fc.tuple(coord, coord, coord), size: fc.tuple(fc.double({ min: 0.01, max: 20, noNaN: true }), fc.double({ min: 0.01, max: 20, noNaN: true })) }));
  fc.assert(fc.property(fc.array(thing, { minLength: 1, maxLength: 6 }), fc.double({ min: -7, max: 7, noNaN: true }), fc.double({ min: -1.57, max: 1.57, noNaN: true }), fc.double({ min: 0.001, max: 40, noNaN: true }), (list, azimuth, elevation, distance) => {
    const things = list.map((t, i) => ({ name: `t${i}`, ...t })), r = check(things, look({ azimuth, elevation, distance, aperture: 0.03 }), 't0');
    const seen = JSON.stringify(r, (k, v) => { if (typeof v === 'number') assert.ok(Number.isFinite(v), k); return v; });
    assert.ok(r.inFrame >= 0 && r.inFrame <= 1 && seen.length > 0);
    for (const b of r.blockers) assert.ok(b.share > 0 && b.share <= 1);
    assert.equal(typeof shotLine(r), 'string');
  }), { numRuns: 80 });
});
