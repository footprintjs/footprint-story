// footprint-story/human, by property: the laws' closed forms hold for any input, the paths keep their promises on any
// points, and the models are pure — the same entry, the same plain frozen move; another piece, another tremor.
// FC_RUNS=20000 npm test runs a deep sweep.
import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { minJerk, minJerkSpeed, fittsSeconds, arcTable, shareToDistance, distanceToShare, pointAt, catmullRom, resample, curvatures,
  strokeBetween, strokeOffset, sigmaLognormalAt, strokeEnd, planMove, sampleMove, sampleTrack, checkMove, powerLawFit } from '../human.js';
import { crosses } from './human-paths.test.js';

const RUNS = Number(process.env.FC_RUNS) || 300;
const runs = (share = 1) => ({ numRuns: Math.max(20, Math.round(RUNS * share)) });
const unit = fc.double({ min: 0, max: 1, noNaN: true });
const pt = fc.tuple(fc.integer({ min: 0, max: 1600 }), fc.integer({ min: 0, max: 900 }));
const fine = fc.tuple(fc.double({ min: -2000, max: 2000, noNaN: true }), fc.double({ min: -2000, max: 2000, noNaN: true }));
const distinctPath = (most) => fc.uniqueArray(pt, { minLength: 2, maxLength: most, selector: ([x, y]) => `${x},${y}` });
const lengthOf = (ps) => ps.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - ps[i][0], p[1] - ps[i][1]), 0);

test('minimum jerk: symmetric, rising, within 0..1, its speed never past the middle\'s', () => {
  fc.assert(fc.property(unit, unit, (u, v) => {
    assert.ok(Math.abs(minJerk(1 - u) - (1 - minJerk(u))) < 1e-12);
    if (u < v) assert.ok(minJerk(u) <= minJerk(v));
    assert.ok(minJerk(u) >= 0 && minJerk(u) <= 1);
    assert.ok(minJerkSpeed(u) <= minJerkSpeed(0.5));
  }), runs());
});

test("Fitts's law: further takes longer, a bigger target less", () => {
  fc.assert(fc.property(fc.double({ min: 0, max: 5000, noNaN: true }), fc.double({ min: 0, max: 5000, noNaN: true }), fc.double({ min: 1, max: 500, noNaN: true }), (d1, d2, w) => {
    if (d1 < d2) assert.ok(fittsSeconds(d1, w) <= fittsSeconds(d2, w));
    assert.ok(fittsSeconds(d1, w) >= fittsSeconds(d1, w * 2));
  }), runs());
});

test('a length table only rises, and share ↔ distance turn back into each other', () => {
  fc.assert(fc.property(fc.array(fine, { minLength: 1, maxLength: 40 }), unit, (points, u) => {
    const t = arcTable(points);
    for (let i = 1; i < t.along.length; i += 1) assert.ok(t.along[i] >= t.along[i - 1]);
    const d = shareToDistance(t, u);
    assert.ok(d >= 0 && d <= t.length + 1e-9);
    assert.ok(Math.abs(shareToDistance(t, distanceToShare(t, d)) - d) < 1e-6 * (1 + t.length));
    const p = pointAt(t, d);
    assert.ok(Number.isFinite(p[0]) && Number.isFinite(p[1]));
  }), runs());
});

test('a centripetal Catmull-Rom line passes through every point, and no stretch of it loops or crosses itself', () => {
  // found by the 20000-run sweep: two points give a straight line whose pieces rounding set a hair either side
  assert.equal(new Set(catmullRom([[5, 393], [1051, 230]], { spacing: 3 }).map((p) => p.join())).size, 354);
  fc.assert(fc.property(distinctPath(8), (points) => {
    const c = catmullRom(points, { spacing: 3 });
    let at = 0;
    const starts = points.map((p) => { while (!(c[at][0] === p[0] && c[at][1] === p[1])) at += 1; return at; });
    assert.equal(starts[starts.length - 1], c.length - 1, 'ends on the last point');
    for (let s = 1; s < starts.length; s += 1) {
      const piece = c.slice(starts[s - 1], starts[s] + 1);
      for (let i = 1; i < piece.length; i += 1) for (let j = i + 2; j < piece.length; j += 1) assert.ok(!crosses(piece[i - 1], piece[i], piece[j - 1], piece[j]), `stretch ${s} crosses itself`);
    }
  }), runs(0.3));
});

test('resample: the ends kept, the steps even', () => {
  fc.assert(fc.property(distinctPath(10), fc.integer({ min: 2, max: 200 }), (points, count) => {
    const r = resample(points, { count }), L = lengthOf(points), step = L / (count - 1);
    assert.deepEqual(r[0], points[0]); assert.deepEqual(r[count - 1], points[points.length - 1]);
    assert.ok(curvatures(r).every((k) => k >= 0));
    // each step no longer than the even step along the line (a chord cuts a corner)
    for (let i = 1; i < r.length; i += 1) assert.ok(Math.hypot(r[i][0] - r[i - 1][0], r[i][1] - r[i - 1][1]) <= step + 1e-6);
  }), runs());
});

test('sigma-lognormal: at the end, the pen is where the strokes\' full distances take it, exactly', () => {
  fc.assert(fc.property(fc.array(fc.tuple(pt, fc.double({ min: -3, max: 3, noNaN: true }), fc.double({ min: 0, max: 0.5, noNaN: true })), { minLength: 1, maxLength: 6 }), (parts) => {
    const strokes = parts.map(([q, bend, start], i) => strokeBetween([0, 0], q, { bend, start: start + i * 0.1 }));
    const end = Math.max(...strokes.map(strokeEnd)), at = sigmaLognormalAt(strokes, end, [5, 5], end);
    const sum = strokes.reduce((s, st) => { const [dx, dy] = strokeOffset(st, 1); return [s[0] + dx, s[1] + dy]; }, [5, 5]);
    assert.ok(Math.abs(at.x - sum[0]) < 1e-6 && Math.abs(at.y - sum[1]) < 1e-6);
    parts.forEach(([q], i) => { const [dx, dy] = strokeOffset(strokes[i], 1); assert.ok(Math.abs(dx - q[0]) < 1e-6 && Math.abs(dy - q[1]) < 1e-6); });
  }), runs());
});

const intent = fc.oneof(
  fc.record({ do: fc.constant('reach'), from: pt, to: pt, target: fc.integer({ min: 4, max: 200 }) }),
  fc.record({ do: fc.constant('draw'), path: distinctPath(8) }),
  fc.record({ do: fc.constant('write'), points: distinctPath(6) }));

test('a move is pure: the same entry the same frozen plain move, its ends on its points, and a record of it samples the same', () => {
  fc.assert(fc.property(intent, fc.string({ minLength: 1, maxLength: 12 }), unit, (raw, name, u) => {
    const a = planMove({ ...raw, name }), b = planMove({ name, ...raw });
    assert.deepEqual(a, b);
    assert.deepEqual(JSON.parse(JSON.stringify(a)), structuredClone(a));
    const t = u * a.plan.seconds;
    assert.deepEqual(sampleMove(structuredClone(a), t), sampleMove(a, t));
    const first = raw.from ?? (raw.path ?? raw.points)[0], last = raw.to ?? (raw.path ?? raw.points).at(-1), end = sampleMove(a, a.plan.seconds), start = sampleMove(a, 0);
    assert.ok(Math.hypot(start.x - first[0], start.y - first[1]) < 1e-6, 'starts on its first point');
    assert.ok(Math.hypot(end.x - last[0], end.y - last[1]) < 1e-6, 'ends on its last point');
  }), runs(0.3));
});

test('where an entry is listed (who) and how long it takes never change its wobble', () => {
  fc.assert(fc.property(distinctPath(6).filter((p) => lengthOf(p) > 100), fc.string({ minLength: 1, maxLength: 20 }), fc.string({ minLength: 1, maxLength: 20 }), fc.double({ min: 0.1, max: 30, noNaN: true }), (path, w1, w2, seconds) => {
    if (!w1.trim() || !w2.trim()) return;
    const a = planMove({ do: 'draw', name: 'p', who: w1, path }), b = planMove({ do: 'draw', name: 'p', who: w2, path, seconds });
    assert.deepEqual([a.plan.xs, a.plan.ys], [b.plan.xs, b.plan.ys]);
  }), runs(0.2));
});

test('a reach bowed anywhere within its limit passes its own jerk critic', () => {
  fc.assert(fc.property(pt, pt, fc.double({ min: -0.3, max: 0.3, noNaN: true }), (from, to, bend) => {
    assert.equal(checkMove(planMove({ do: 'reach', from, to, model: { name: 'min-jerk', bend } })).measures.jerk, 0);
  }), runs(0.3));
});

test('another piece, another tremor; the same piece, the same', () => {
  fc.assert(fc.property(distinctPath(6).filter((p) => lengthOf(p) > 100), fc.string({ minLength: 1, maxLength: 8 }), fc.string({ minLength: 1, maxLength: 8 }), (path, n1, n2) => {
    const a = planMove({ do: 'draw', name: n1, path }), b = planMove({ do: 'draw', name: n2, path });
    if (n1 === n2) assert.deepEqual(a.plan.xs, b.plan.xs);
    else assert.notDeepEqual([a.plan.xs, a.plan.ys], [b.plan.xs, b.plan.ys]);
  }), runs(0.3));
});

test("this package's reach passes its own critics anywhere; a pen traced on an ellipse gives back the exponent 1/3", () => {
  fc.assert(fc.property(pt, pt, fc.integer({ min: 4, max: 200 }), (from, to, target) => {
    const c = checkMove(planMove({ do: 'reach', from, to, target }));
    assert.deepEqual(c.findings, []);
  }), runs(0.3));
  fc.assert(fc.property(fc.integer({ min: 80, max: 400 }), fc.integer({ min: 60, max: 400 }), (a, b) => {
    const path = Array.from({ length: 60 }, (_, i) => [600 + a * Math.cos((i / 59) * 2 * Math.PI * 0.95), 400 + b * Math.sin((i / 59) * 2 * Math.PI * 0.95)]);
    const m = planMove({ do: 'draw', path, model: { name: 'power-law', tremor: 0, ramp: 0, floor: 0.0001 } });
    const tr = sampleTrack(m, { rate: 1000 }).samples, out = [];
    let along = 0, next = 0;
    for (let i = 1; i < tr.length; i += 1) {
      const ds = Math.hypot(tr[i].x - tr[i - 1].x, tr[i].y - tr[i - 1].y);
      while (ds > 0 && along + ds >= next) { const f = (next - along) / ds; out.push([tr[i - 1].x + (tr[i].x - tr[i - 1].x) * f, tr[i - 1].y + (tr[i].y - tr[i - 1].y) * f, tr[i - 1].t + (tr[i].t - tr[i - 1].t) * f]); next += 8; }
      along += ds;
    }
    const k = curvatures(out.map((p) => [p[0], p[1]])), lo = Math.floor(out.length * 0.1), hi = Math.floor(out.length * 0.9);
    const speeds = out.map((p, i) => (i === 0 || i === out.length - 1 ? NaN : 16 / (out[i + 1][2] - out[i - 1][2])));
    const fit = powerLawFit(speeds.slice(lo, hi), k.slice(lo, hi));
    // a circle has one curvature, and no exponent to find
    if (Math.abs(a - b) > 40) assert.ok(Math.abs(fit.exponent - 1 / 3) < 0.04, `exponent ${fit.exponent} for ${a} × ${b}`);
  }), runs(0.05));
});

test("this package's pen passes its own pen-speed critic on any line", () => {
  fc.assert(fc.property(fc.array(pt, { minLength: 2, maxLength: 12 }).filter((p) => lengthOf(p) > 200), fc.string({ minLength: 1, maxLength: 8 }), (path, name) => {
    assert.deepEqual(checkMove(planMove({ do: 'draw', name, path })).findings, []);
  }), runs(0.05));
});

test('anything that is not an intent is refused in words that start "human:", naming the entry', () => {
  fc.assert(fc.property(fc.anything(), fc.anything(), (from, to) => {
    try { planMove({ do: 'reach', who: 'entry 9', from, to }); } catch (e) { assert.match(e.message, /^human: entry 9/); }
  }), runs());
});
