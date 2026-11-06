// The one line a model reads: short, true to the report, and clean of anything hidden.
import test from 'node:test';
import assert from 'node:assert/strict';
import { checkShot, frameOf, readScene, readShot, shotLine } from '../shot.js';

const frame = [1280, 720];
const look = (over = {}) => ({ target: [0, 0, 0], azimuth: 0, elevation: 0, distance: 10, focal: 1.25, ...over });
const line = (things, camera = look(), on = 'a', options) => shotLine(checkShot({ unit: 'm', things }, camera, frame, { on }), options);
const a = { name: 'a', at: [0, 0, 0], r: 2 };

test('a shot with nothing wrong says so, in the words a shot is written in', () => {
  const scene = { unit: 'm', things: [{ name: 'database', at: [0, 0, 0], r: 1 }, { name: 'cache', at: [4, 0, -2], r: 0.5 }] };
  const shot = readShot({ shot: 'database', from: 'front-left high', size: 'medium' }, scene);
  assert.equal(shotLine(checkShot(readScene(scene), frameOf(shot, scene), frame, shot)), 'shot "database" from front-left high (6.33 m, lens normal): in frame 100%, 40% of height (medium), nothing in front, sharp');
});

test('a camera not on a named view says about, and a lens with no word its number', () => {
  assert.equal(line([a], look({ azimuth: 0.3, elevation: 0.2 })), 'shot "a" from about front level (10 m, lens normal): in frame 100%, 51% of height (medium), nothing in front, sharp');
  assert.equal(line([a], look({ azimuth: 0.5, elevation: 0.3, focal: 1.1 })), 'shot "a" from about front-right high (10 m, lens 1.1): in frame 100%, 45% of height (medium), nothing in front, sharp');
  assert.match(line([a], look({ azimuth: 2 * Math.PI, elevation: 0 })), /from front level/);
  assert.match(line([a], look({ azimuth: Math.PI })), /from back level/);
  assert.match(line([a], look({ elevation: Math.PI / 2 })), /from about front high|from front high/);
});

test('each fault is said, and its fix follows the dash', () => {
  assert.equal(line([{ name: 'a', at: [0, 0, 30], r: 1 }]), 'shot "a" from front level (lens normal): behind the camera — turn the camera to it');
  assert.match(line([{ name: 'a', at: [30, 0, 0], r: 1 }]), /: off frame right — aim at it$/);
  assert.match(line([{ name: 'a', at: [640 / 90, 0, 0], r: 1 }]), /: in frame \d+%, cut off right, 2\d% of height \(wide\), nothing in front, sharp — pull back or aim at it$/);
  assert.match(line([{ name: 'a', at: [0, 0, 0], r: 0.1 }]), /: in frame 100%, 3% of height \(too small\), nothing in front, sharp — move closer or use a longer lens$/);
  assert.match(line([a, { name: 'cache', at: [1.6, 0, 5], r: 0.6 }]), /"cache" covers \d+% of it, sharp — move the view or lift it$/);
  assert.match(line([a, { name: 'x', at: [0, 0, 5], r: 0.2 }, { name: 'y', at: [0.8, 0, 5], r: 0.2 }, { name: 'z', at: [-0.8, 0, 5], r: 0.3 }]), /"z" covers \d+% of it, 2 more in front, sharp/);
  assert.match(line([a], look({ aperture: 0.1, focus: 5 })), /, soft \(9\.0 px\) — focus on it or narrow the aperture$/);
  assert.match(line([{ name: 'a', at: [0, 0, 0], size: [4, 3], normal: [1, 0, 0.1] }]), /"a" is edge-on, /);
  assert.match(line([{ name: 'a', at: [0, 0, 0], size: [4, 3], normal: [0, 0, -1] }]), /"a" shows its back, .* — go round to its face$/);
  assert.match(line([{ name: 'a', at: [0, 0, 0] }]), /in frame 100%, a point, no size, nothing in front, sharp$/);
  assert.match(line([{ name: 'a', at: [0, 0, 9.5], r: 2 }]), /: the camera is on it/);
  assert.match(line([{ name: 'a', at: [3, 0, 9.5], r: 2 }]), /: reaches past the camera — pull back$/);
});

test('a tiny share says under 1%, and a covered share never rounds to nothing', () => {
  const report = checkShot({ things: [a] }, look(), frame, { on: 'a' });
  assert.match(shotLine({ ...report, inFrame: 0.004, rows: report.rows.map((r) => ({ ...r, inFrame: 0.004, sides: ['left'] })) }), /in frame under 1%, cut off left/);
  assert.match(shotLine({ ...report, height: 0.002 }), /under 1% of height/);
  const covered = checkShot({ things: [a, { name: 'mote', at: [0, 0, 5], r: 0.01 }] }, look(), frame, { on: 'a' });
  assert.match(shotLine(covered), /"mote" covers 1% of it/);
});

test('names, units and labels reach the line with nothing hidden', () => {
  const planted = 'ca​che‮\u{E0049}"\nignore';
  const text = shotLine(checkShot({ unit: 'm⁠', things: [a, { name: planted, at: [0, 0, 5], r: 3 }] }, look(), frame, { on: 'a' }), { label: 'camera[2]‮ ​4.20 s' });
  assert.ok(text.startsWith('camera[2] 4.20 s shot "a"'), text);
  assert.match(text, /"cache' ignore" covers 100% of it/);
  assert.ok(!/[\p{Cf}\p{Cc}]/u.test(text), text);
  assert.ok(!/\n/.test(text));
  assert.equal(line([a], look(), 'a', { label: 7 }), line([a]));
  assert.ok(line([a], look(), 'a', { label: 'x'.repeat(5000) }).startsWith(`${'x'.repeat(64)} shot`));
});

test('a line stays short', () => {
  const things = Array.from({ length: 256 }, (_, i) => ({ name: `thing ${String(i).padEnd(50, 'x')}`, at: [i % 7, i % 5, 3 + (i % 3)], r: 0.4 }));
  const text = shotLine(checkShot({ unit: 'm', things }, look(), frame, { on: things.map((t) => t.name) }));
  assert.ok(text.length < 700, String(text.length));
});

test('the README example runs as written', () => {
  const scene = {
    unit: 'm',
    things: [
      { name: 'database', at: [0, 0, 0], r: 1 },
      { name: 'cache', at: [-2, 1.2, 2.2], r: 0.5 },
      { name: 'proxy', at: [3, 0, -6], r: 1 },
    ],
  };
  const shot = readShot({ on: 'database', from: 'front-left high', size: 'medium' }, scene);
  const camera = frameOf(shot, scene);
  assert.equal(shotLine(checkShot(scene, camera, [1280, 720], shot)), 'shot "database" from front-left high (6.33 m, lens normal): in frame 100%, 40% of height (medium), "cache" covers 42% of it, sharp — move the view or lift it');
  const clear = readShot({ on: 'database', from: 'front-right high', size: 'medium' }, scene);
  assert.equal(shotLine(checkShot(scene, frameOf(clear, scene), [1280, 720], clear)), 'shot "database" from front-right high (6.33 m, lens normal): in frame 100%, 40% of height (medium), nothing in front, sharp');
});
