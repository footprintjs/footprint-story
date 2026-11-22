// The paths of footprint-story/human: a length table and its share ↔ distance mapping, a centripetal Catmull-Rom line
// that passes through its points, curvature (exact on a circle), and resampling by distance.
import test from 'node:test';
import assert from 'node:assert/strict';
import { arcTable, pointAt, shareToDistance, distanceToShare, catmullRom, curvatures, resample, MOST_RESAMPLED } from '../human.js';
import { curvaturesOver } from '../src/human/paths/curvature.js';

const close = (a, b, eps, what) => assert.ok(Math.abs(a - b) <= eps, `${what}: ${a} is not within ${eps} of ${b}`);

test('a length table: how far along each point is, a point that far along, and share ↔ distance both ways', () => {
  const t = arcTable([[0, 0], [3, 4], [3, 4], [3, 10]]);
  assert.deepEqual(t.along, [0, 5, 5, 11]); assert.equal(t.length, 11);
  assert.ok(Object.isFrozen(t) && Object.isFrozen(t.along) && Object.isFrozen(t.points[0]));
  assert.deepEqual(pointAt(t, 0), [0, 0]); assert.deepEqual(pointAt(t, -2), [0, 0]); assert.deepEqual(pointAt(t, 99), [3, 10]);
  assert.deepEqual(pointAt(t, 2.5), [1.5, 2]); assert.deepEqual(pointAt(t, 8), [3, 7]);
  assert.equal(shareToDistance(t, 0), 0); assert.equal(shareToDistance(t, 1), 11); assert.equal(shareToDistance(t, 1 / 6), 2.5);
  assert.equal(distanceToShare(t, 0), 0); assert.equal(distanceToShare(t, 11), 1); assert.equal(distanceToShare(t, 2.5), 1 / 6);
  assert.equal(distanceToShare(t, 5), 1 / 3, 'where points sit together, the first');
  const one = arcTable([[1, 1]]);
  assert.equal(one.length, 0); assert.equal(shareToDistance(one, 0.5), 0); assert.equal(distanceToShare(one, 3), 0); assert.deepEqual(pointAt(one, 1), [1, 1]);
  assert.throws(() => pointAt({ points: [[0, 0]], along: [0], length: 0 }, 1), /human: pointAt reads a table arcTable\(points\) made/);
  assert.throws(() => pointAt(t, NaN), /pointAt's distance is a number/);
  assert.throws(() => arcTable([[0, 0], [1, Infinity]]), /arcTable's points\[1\] is a point \[x, y\]/);
  assert.throws(() => arcTable('no'), /arcTable's points is 1 to 16384 points/);
});

test('a centripetal Catmull-Rom line passes through every point it is given, and two points give the straight line', () => {
  const pts = [[0, 0], [100, 0], [100, 100], [0, 100], [50, 40]];
  const c = catmullRom(pts, { spacing: 5 });
  for (const p of pts) assert.ok(c.some((q) => q[0] === p[0] && q[1] === p[1]), `passes ${p}`);
  assert.deepEqual(c[0], [0, 0]); assert.deepEqual(c[c.length - 1], [50, 40]);
  for (let i = 1; i < c.length; i += 1) assert.ok(Math.hypot(c[i][0] - c[i - 1][0], c[i][1] - c[i - 1][1]) <= 12, 'pieces about the spacing');
  const line = catmullRom([[0, 0], [30, 40]], { spacing: 10 });
  for (const [x, y] of line) close(y, (4 / 3) * x, 1e-9, 'on the straight line');
  assert.equal(line.length, 6);
  const twice = catmullRom([[0, 0], [0, 0], [10, 0]], { spacing: 5 });
  assert.equal(twice.length, 3, 'points on one another taken once'); close(twice[1][0], 5, 1e-9, 'the middle');
  assert.throws(() => catmullRom([[1, 1], [1, 1]]), /at least two points that are not on one another/);
  assert.throws(() => catmullRom(pts, { spacing: 0 }), /spacing is from 0.25 to 10000 px/);
  assert.throws(() => catmullRom(pts, { alpha: 2 }), /alpha is from 0 to 1/);
  assert.throws(() => catmullRom(Array.from({ length: 4000 }, (_, i) => [i * 200, (i % 2) * 200]), { spacing: 0.25 }), /a curve of more than 16384 points/);
});

test('the centripetal kind never loops where the uniform kind does: a short stretch between two long ones', () => {
  // the case in Yuksel, Schaefer & Keyser 2011: a short stretch between long ones makes the uniform spline loop
  const pts = [[0, 0], [50, 100], [52, 100], [100, 0]];
  const loops = (c) => { for (let i = 1; i < c.length; i += 1) for (let j = i + 2; j < c.length; j += 1) if (crosses(c[i - 1], c[i], c[j - 1], c[j])) return true; return false; };
  assert.equal(loops(catmullRom(pts, { spacing: 0.5 })), false, 'centripetal');
  assert.equal(loops(catmullRom(pts, { spacing: 0.5, alpha: 0 })), true, 'uniform');
});

/** Whether segment ab properly crosses segment cd (a turn within rounding of none counts as none: collinear pieces never cross). */
export function crosses(a, b, c, d) {
  const o = (p, q, r) => { const v = (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]); return Math.abs(v) <= 1e-9 * Math.hypot(q[0] - p[0], q[1] - p[1]) * Math.hypot(r[0] - p[0], r[1] - p[1]) ? 0 : Math.sign(v); };
  return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
}

test('curvature: 1 over the radius on a circle, 0 on a straight line, the ends taking their neighbours\'', () => {
  const r = 80, circle = Array.from({ length: 50 }, (_, i) => [r * Math.cos(i / 10), r * Math.sin(i / 10)]);
  for (const k of curvatures(circle)) close(k, 1 / r, 1e-12, 'a circle');
  assert.deepEqual(curvatures([[0, 0], [1, 1], [2, 2]]), [0, 0, 0]);
  assert.deepEqual(curvatures([[0, 0], [5, 5]]), [0, 0]);
  assert.deepEqual(curvatures([[0, 0], [0, 0], [1, 0]]), [0, 0, 0], 'a point on its neighbour bends nothing');
  // a turn past a right angle: at least the tightest circle its shorter side allows — a hairpin is the sharpest bend, never straight
  assert.deepEqual(curvatures([[0, 0], [10, 0], [0, 0]]), [0.2, 0.2, 0.2], 'a full reversal: 2 / the side');
  assert.deepEqual(curvatures([[0, 0], [10, 0], [5, 0]]), [0.4, 0.4, 0.4], 'back along the line: 2 / the shorter side');
  close(curvatures([[0, 0], [10, 0], [10, 10]])[1], Math.SQRT2 / 10, 1e-12, 'a right angle, as the circle gives it');
  close(curvatures([[0, 0], [10, 0], [10.000001, 10]])[1], Math.SQRT2 / 10, 1e-6, 'and just past one: no jump');
  assert.ok(curvatures([[0, 0], [10, 0], [0, 1]])[1] > curvatures([[0, 0], [10, 0], [2, 8]])[1], 'the nearer a reversal, the sharper');
  const bent = curvatures([[0, 0], [1, 0], [1, 1], [1, 2]]);
  assert.equal(bent[0], bent[1]); assert.equal(bent[3], bent[2]);
});

test('resample: every spacing px along (the last stretch shorter), or count points evenly; the ends kept', () => {
  const pts = [[0, 0], [10, 0], [10, 10]];
  assert.deepEqual(resample(pts, { spacing: 4 }), [[0, 0], [4, 0], [8, 0], [10, 2], [10, 6], [10, 10]]);
  assert.deepEqual(resample(pts, { count: 3 }), [[0, 0], [10, 0], [10, 10]]);
  assert.deepEqual(resample(pts, { spacing: 5 }), [[0, 0], [5, 0], [10, 0], [10, 5], [10, 10]]);
  assert.deepEqual(resample([[3, 3]], { spacing: 1 }), [[3, 3], [3, 3]]);
  assert.throws(() => resample(pts, { count: 1 }), new RegExp(`count is a whole number from 2 to ${MOST_RESAMPLED}`));
  assert.throws(() => resample(pts, {}), /every spacing px \(above 0\) or count points/);
  assert.throws(() => resample(pts, { spacing: 1e-6 }), /give a larger spacing/);
});

test('curvature over a width: no bend read tighter than a circle as wide as the half-width, and a fold spread over that width', () => {
  const line = Array.from({ length: 101 }, (_, i) => [i * 2, 0]), fold = [...line, ...line.slice(0, -1).reverse()];
  const k = curvaturesOver(fold, 6), cap = 2 / (6 * 2);
  assert.ok(Math.max(...k) <= cap / 13 + 1e-12, 'the fold, held at the greatest bend, spread over the 13 points either side of it');
  for (let i = 94; i <= 106; i += 1) assert.ok(k[i] > 0, `the fold reads at ${i}`);
  assert.equal(k[20], 0, 'the straight legs are straight'); assert.equal(k[180], 0);
  const r = 100, circle = Array.from({ length: 300 }, (_, i) => [r * Math.cos(i / 50), r * Math.sin(i / 50)]);
  close(curvaturesOver(circle, 3)[150], 1 / r, 2e-4, 'a wide circle keeps its curvature');
  assert.deepEqual(curvaturesOver([[4, 4]], 2), [0]);
});
