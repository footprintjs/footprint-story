// A stroke as a painter fills it (src/human/strokes/outline.js): the ring's caps — a round cap's points on the end's
// circle to 1e-6, a butt end flat across the end point, a square one half the width past it — and the stroke as drawn
// by a time (strokeAt): before, at and between its points and after. By property: the whole stroke drawn by Infinity
// gives the same ring as the stroke; the part drawn by t is the points up to t and one on the line after them; a
// partial ring is the finished one's start, to the point before the cut.
// FC_RUNS=20000 npm test runs a deep sweep.
import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { strokeOutline, strokeAt, STROKE_CAPS, CAP_STEPS, MOST_STROKE_POINTS } from '../human.js';

const RUNS = Number(process.env.FC_RUNS) || 300;
const close = (a, b, what, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${what}: ${a} is not ${b} (to ${eps})`);
const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);

// a stroke along +x, from (0, 0) at 2 px wide to (10, 0) at 4 px: its sides at y = ∓1 and ∓2
const LINE = Object.freeze([[0, 0, 2, 0], [10, 0, 4, 1]]);

test('a round cap: a half circle round each end point, of the end\'s width, out past it the way the stroke runs', () => {
  const ring = strokeOutline(LINE, { cap: 'round' });
  assert.deepEqual(strokeOutline(LINE), ring, 'round when left out, as strokeItems writes the cap');
  assert.equal(ring.length, 4 + 2 * (CAP_STEPS - 1));
  // up the left side, round the far end, down the right, round the near end
  assert.deepEqual(ring[0], [0, -1]); assert.deepEqual(ring[1], [10, -2]);
  const far = ring.slice(2, 2 + CAP_STEPS - 1), near = ring.slice(-(CAP_STEPS - 1));
  assert.deepEqual(ring[2 + CAP_STEPS - 1], [10, 2]); assert.deepEqual(ring[3 + CAP_STEPS - 1], [0, 1]);
  far.forEach((p, k) => {
    close(dist(p, [10, 0]), 2, `far cap point ${k} on its circle`);
    assert.ok(p[0] > 10, 'past the end point, the way the stroke runs');
    close(Math.atan2(p[1], p[0] - 10), -Math.PI / 2 + (Math.PI * (k + 1)) / CAP_STEPS, `far cap point ${k}'s angle`);
  });
  close(far[(CAP_STEPS / 2) - 1][0], 12, 'the far cap\'s tip, half the width past the end');
  near.forEach((p, k) => {
    close(dist(p, [0, 0]), 1, `near cap point ${k} on its circle`);
    assert.ok(p[0] < 0, 'behind the start, the way it came from');
  });
  close(near[(CAP_STEPS / 2) - 1][0], -1, 'the near cap\'s tip');
});

test('a round cap on a slanted stroke keeps to its circle, and meets the sides exactly', () => {
  const pts = [[100, 50, 6, 0], [130, 90, 6, 0.5], [170, 95, 3, 1]], ring = strokeOutline(pts);
  const n = pts.length, far = ring.slice(n, n + CAP_STEPS - 1), near = ring.slice(-(CAP_STEPS - 1));
  for (const p of far) close(dist(p, [170, 95]), 1.5, 'far cap on its circle');
  for (const p of near) close(dist(p, [100, 50]), 3, 'near cap on its circle');
  // the sides' end points are on the circle too: the cap meets them with no step
  close(dist(ring[n - 1], [170, 95]), 1.5, 'left side\'s end'); close(dist(ring[n + CAP_STEPS - 1], [170, 95]), 1.5, 'right side\'s end');
  // and each cap point is past the end, along the end chord's way
  const [tx, ty] = [40 / Math.hypot(40, 5), 5 / Math.hypot(40, 5)];
  for (const p of far) assert.ok((p[0] - 170) * tx + (p[1] - 95) * ty > 0);
});

test('a butt end is flat across the end point; a square end is half the width past it, square', () => {
  assert.deepEqual(strokeOutline(LINE, { cap: 'butt' }), [[0, -1], [10, -2], [10, 2], [0, 1]]);
  assert.deepEqual(strokeOutline(LINE, { cap: 'square' }), [[0, -1], [10, -2], [12, -2], [12, 2], [10, 2], [0, 1], [-1, 1], [-1, -1]]);
  assert.deepEqual(STROKE_CAPS, ['round', 'butt', 'square']);
});

test('a stroke of one point is a dot: a circle, a square, or nothing — and an end of no width takes no cap', () => {
  const dot = strokeOutline([[5, 5, 4, 0]]);
  assert.equal(dot.length, 2 * CAP_STEPS);
  for (const p of dot) close(dist(p, [5, 5]), 2, 'a round dot');
  assert.deepEqual(strokeOutline([[5, 5, 4, 0]], { cap: 'square' }), [[5, 3], [7, 3], [7, 7], [5, 7], [3, 7], [3, 3]]);
  assert.deepEqual(strokeOutline([[5, 5, 4, 0]], { cap: 'butt' }), [[5, 3], [5, 7]]);
  assert.deepEqual(strokeOutline([[0, 0, 0, 0], [10, 0, 0, 1]]), [[0, 0], [10, 0], [10, 0], [0, 0]], 'no width, no cap');
  assert.deepEqual(strokeOutline([]), []);
  // an end whose chord has no length takes its heading from the first point that is not in its place
  const held = strokeOutline([[0, 0, 2, 0], [0, 0, 2, 0.1], [10, 0, 2, 1]], { cap: 'butt' });
  assert.deepEqual(held[0], [0, -1], 'the start, held a moment, still faces along the stroke');
  const lastHeld = strokeOutline([[0, 0, 2, 0], [10, 0, 2, 0.9], [10, 0, 2, 1]], { cap: 'square' });
  assert.deepEqual(lastHeld.slice(2, 6), [[10, -1], [11, -1], [11, 1], [10, 1]]);
});

test('strokeOutline refuses what it cannot ring, naming the fix', () => {
  assert.throws(() => strokeOutline(LINE, { cap: 'arrow' }), /strokeOutline's cap is "round", "butt", "square" \(the stroke item's stroke.cap\) — not "arrow"/);
  assert.throws(() => strokeOutline(LINE, { caps: 'round' }), /strokeOutline's options are \{cap\} — not "caps"/);
  assert.throws(() => strokeOutline(LINE, 'round'), /strokeOutline's options are \{cap\}, or none/);
  assert.throws(() => strokeOutline([[0, 0]]), /strokeOutline's point 1 is \[x, y, width\]/);
  assert.throws(() => strokeOutline([[0, 0, -1]]), /the width from 0/);
  assert.throws(() => strokeOutline('a'), /strokeOutline takes a stroke's points/);
  assert.throws(() => strokeOutline(Array.from({ length: MOST_STROKE_POINTS + 1 }, () => [0, 0, 1, 0])), /at most 4096/);
});

test('strokeAt: nothing before the first point, the first alone at its time, a point between, every point after', () => {
  const pts = [[0, 0, 1, 1], [10, 0, 3, 2], [10, 20, 1, 4]];
  assert.deepEqual(strokeAt(pts, 0.5), [], 'before the pen lands');
  assert.deepEqual(strokeAt(pts, -Infinity), []);
  assert.deepEqual(strokeAt(pts, 1), [[0, 0, 1, 1]], 'at the first point');
  assert.deepEqual(strokeAt(pts, 1.5), [[0, 0, 1, 1], [5, 0, 2, 1.5]], 'half way to the second: x, y and width between');
  assert.deepEqual(strokeAt(pts, 2), [[0, 0, 1, 1], [10, 0, 3, 2]], 'at a point: no point between');
  assert.deepEqual(strokeAt(pts, 3), [[0, 0, 1, 1], [10, 0, 3, 2], [10, 10, 2, 3]]);
  assert.deepEqual(strokeAt(pts, 4), pts, 'at the last point');
  assert.deepEqual(strokeAt(pts, 99), pts); assert.deepEqual(strokeAt(pts, Infinity), pts);
  assert.notEqual(strokeAt(pts, Infinity)[0], pts[0], 'new lists: the points handed in are never edited');
  // two points at one time (a held pen): both drawn once t reaches it
  assert.deepEqual(strokeAt([[0, 0, 1, 0], [0, 0, 1, 0], [4, 0, 1, 1]], 0), [[0, 0, 1, 0], [0, 0, 1, 0]]);
  // the partial ring, capped as the finished one is
  const part = strokeOutline(strokeAt(pts, 1.5));
  for (const p of part.slice(2, 2 + CAP_STEPS - 1)) close(dist(p, [5, 0]), 1, 'the cut end\'s round cap, of its width');
});

test('strokeAt refuses a time that is not one and points that are not a timed stroke', () => {
  assert.throws(() => strokeAt(LINE, NaN), /strokeAt's t is a time in seconds on the points' own clock/);
  assert.throws(() => strokeAt(LINE, '1'), /strokeAt's t is a time in seconds/);
  assert.throws(() => strokeAt([[0, 0, 1]], 1), /strokeAt's point 1 is \[x, y, width, t\]/);
  assert.throws(() => strokeAt([[0, 0, 1, 1], [1, 0, 1, 0.5]], 1), /strokeAt's point 2 is \[x, y, width, t\]: finite numbers, the width from 0, t in seconds rising along the stroke \(from 1\)/);
});

/** A drawn stroke: points walked from a start, each step's length, turn, width and time random; times rising. */
const strokeArb = fc.tuple(fc.double({ min: -500, max: 500, noNaN: true }), fc.double({ min: -500, max: 500, noNaN: true }),
  fc.array(fc.tuple(fc.double({ min: 0, max: 20, noNaN: true }), fc.double({ min: -Math.PI, max: Math.PI, noNaN: true }), fc.double({ min: 0, max: 8, noNaN: true }), fc.double({ min: 0, max: 0.2, noNaN: true })), { minLength: 1, maxLength: 60 }))
  .map(([x0, y0, steps]) => {
    let x = x0, y = y0, t = 0, a = 0;
    return steps.map(([len, turn, w, dt], i) => { if (i) { a += turn; x += len * Math.cos(a); y += len * Math.sin(a); t += dt; } return [x, y, w, t]; });
  });

test('any stroke: drawn by Infinity it gives the same ring as the stroke, for every cap', () => {
  fc.assert(fc.property(strokeArb, fc.constantFrom(...STROKE_CAPS), (pts, cap) => {
    assert.deepStrictEqual(strokeOutline(strokeAt(pts, Infinity), { cap }), strokeOutline(pts, { cap }));
    assert.deepStrictEqual(strokeAt(pts, pts.at(-1)[3]), pts.map((p) => [...p]), 'at its last time, the whole stroke');
  }), { numRuns: RUNS });
});

test('any stroke at any time: the points up to t, then one on the line to the next, at t; its ring\'s round caps on their circles', () => {
  fc.assert(fc.property(strokeArb, fc.double({ min: -0.5, max: 13, noNaN: true }), (pts, t) => {
    const drawn = strokeAt(pts, t), kept = pts.filter((p) => p[3] <= t);
    assert.deepStrictEqual(drawn.slice(0, kept.length), kept.map((p) => [...p]));
    assert.ok(drawn.length - kept.length <= 1);
    if (drawn.length > kept.length) {
      const end = drawn.at(-1), a = pts[kept.length - 1], b = pts[kept.length];
      assert.equal(end[3], t); assert.ok(a[3] < t && t < b[3]);
      // on the line from a to b, as far along as t is
      const s = (t - a[3]) / (b[3] - a[3]);
      for (const k of [0, 1, 2]) close(end[k], a[k] + s * (b[k] - a[k]), `the point between, coordinate ${k}`, 1e-9 * (1 + Math.abs(a[k]) + Math.abs(b[k])));
    }
    if (!drawn.length) return;
    const ring = strokeOutline(drawn), n = drawn.length, last = drawn.at(-1), first = drawn[0];
    if (last[2] / 2 > 0) for (const p of ring.slice(n, n + CAP_STEPS - 1)) close(dist(p, last), last[2] / 2, 'the cut end\'s cap on its circle', 1e-6 * (1 + Math.abs(last[0]) + Math.abs(last[1])));
    if (first[2] / 2 > 0) for (const p of ring.slice(-(CAP_STEPS - 1))) close(dist(p, first), first[2] / 2, 'the start\'s cap on its circle', 1e-6 * (1 + Math.abs(first[0]) + Math.abs(first[1])));
  }), { numRuns: RUNS });
});

test('any stroke: a partial ring\'s left side is the finished one\'s, up to the point before the cut', () => {
  fc.assert(fc.property(strokeArb.filter((p) => p.length >= 4), fc.double({ min: 0, max: 1, noNaN: true }), (pts, share) => {
    const t = pts.at(-1)[3] * share, drawn = strokeAt(pts, t), k = drawn.length;
    if (k < 3) return;
    const whole = strokeOutline(pts, { cap: 'butt' }), part = strokeOutline(drawn, { cap: 'butt' });
    // the left side's points between the first and the last two are moved by the same neighbours in both (an end takes its heading)
    assert.deepStrictEqual(part.slice(1, k - 2), whole.slice(1, k - 2));
  }), { numRuns: RUNS });
});
