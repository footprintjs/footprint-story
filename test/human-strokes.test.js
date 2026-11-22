// Hand-drawn strokes (src/human/strokes/): the order a hand draws a drawing in, its pen (pace, width, hooks, tremor),
// fills clipped exactly to their shapes, and a boil bounded and held by frame. Hand-made drawings, numbers pinned:
// exactly where the rule fixes them, to a tolerance where sin, cos and sqrt round in the last digits.
import test from 'node:test';
import assert from 'node:assert/strict';
import { planSketch, sampleSketch, boilSketch, hatchLines, leastStrokes, withOvershoot, MOST_STROKE_POINTS, ORDER_RULE, CORNER, PEN_WIDTH, BOIL, SKETCH, LIFT, WIDTH_SHARE,
  HATCH, CROSS_TURN, MOST_BOIL_FRAME } from '../human.js';
import { walkLines } from '../src/human/strokes/order.js';
import { readShapes } from '../src/human/strokes/shapes.js';
import { graphOf, mergeCorners } from '../src/human/strokes/graph.js';
import { penStroke } from '../src/human/strokes/pen.js';
import { toRing } from '../src/human/strokes/geometry.js';
import { seeded } from '../src/seed/seeded.js';
import { square, within, comb } from './strokeHelpers.js';

const near = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;
const walk = (shapes, pen = null) => walkLines(readShapes(shapes, 't'), pen);
const corners = (stroke) => stroke.points.map((p) => [p[0], p[1]]);

test('order: a square is one stroke from its top-left corner, heading right first (a tie toward the bottom right goes to the order given)', () => {
  const w = walk([{ points: square(100, 100, 200), closed: true }]);
  assert.equal(w.strokes.length, 1); assert.equal(w.least, 1);
  assert.deepEqual(corners(w.strokes[0]), [[100, 100], [300, 100], [300, 300], [100, 300], [100, 100]]);
  assert.equal(w.strokes[0].rule, 'first');
  assert.match(ORDER_RULE, /top left/);
});

test('order: a line two shapes share is drawn once, and two squares side by side take one stroke (their two odd corners are its ends)', () => {
  const w = walk([{ points: square(0, 0, 100), closed: true }, { points: square(100, 0, 100), closed: true }]);
  assert.equal(w.edges, 7); assert.equal(w.least, 1); assert.equal(w.strokes.length, 1);
  assert.equal(w.strokes[0].points.length, 8, 'seven lines, each once');
  // a stroke that draws the most in one go starts at an odd corner: the shared line's top end, (100, 0)
  assert.deepEqual(corners(w.strokes[0])[0], [100, 0]);
});

test("order: the house of Nikolaus is one stroke — Fleury's rule keeps the walk from stranding a line", () => {
  // a square, its two diagonals and a roof: eight lines, odd only at the two bottom corners
  const house = [{ points: square(0, 100, 100), closed: true }, { points: [[0, 100], [100, 200]] }, { points: [[100, 100], [0, 200]] }, { points: [[0, 100], [50, 50], [100, 100]] }];
  const w = walk(house);
  assert.equal(w.least, 1); assert.equal(w.strokes.length, 1); assert.equal(w.strokes[0].points.length, 9);
  const ends = [corners(w.strokes[0])[0], corners(w.strokes[0]).at(-1)].map(String).sort();
  assert.deepEqual(ends, ['0,200', '100,200']);
});

test('order: after a stroke ends, the next starts at the nearest corner with lines left (an odd one first); ties to the least x + y, then y', () => {
  const w = walk([{ points: [[0, 0], [10, 0]] }, { points: [[100, 0], [110, 0]] }, { points: [[20, 0], [30, 0]] }]);
  assert.deepEqual(w.strokes.map((s) => [corners(s)[0], s.rule]), [[[0, 0], 'first'], [[20, 0], 'odd'], [[100, 0], 'odd']]);
  // (0, 10) and (10, 0) tie on x + y: the smaller y, (10, 0), starts
  assert.deepEqual(corners(walk([{ points: [[0, 10], [0, 50]] }, { points: [[10, 0], [50, 0]] }]).strokes[0])[0], [10, 0]);
  // from where the pen is: nearest first
  assert.deepEqual(corners(walk([{ points: [[0, 0], [10, 0]] }, { points: [[300, 300], [310, 300]] }], [305, 290]).strokes[0])[0], [300, 300]);
  assert.equal(walk([{ points: square(0, 0, 10), closed: true }], [50, 50]).strokes[0].rule, 'nearest');
});

test('order: piece by piece from the top left; in each its outline, then its detail, then its fills', () => {
  const plan = planSketch([
    { points: square(400, 0, 100), closed: true, group: 'b', fill: { kind: 'hatch', spacing: 20 } },
    { points: [[400, 50], [500, 50]], layer: 'detail', group: 'b' },
    { points: square(0, 200, 100), closed: true, group: 'a' },
    { points: [[0, 250], [100, 250]], layer: 'detail', group: 'a' },
  ], { seed: 'order' });
  // piece a reaches x + y = 200, piece b 400: a first though it was given second
  assert.deepEqual(plan.order.map((o) => `${o.group}:${o.layer}`).filter((v, i, a) => v !== a[i - 1]), ['a:outline', 'a:detail', 'b:outline', 'b:detail', 'b:fill']);
  assert.deepEqual(plan.least, { outline: 2, detail: 2 });
  assert.deepEqual(plan.order[0], { stroke: 0, layer: 'outline', group: 'a', rule: 'first', at: [0, 200] });
});

test('order: a stroke goes on along the straightest line left — through a crossing, not round its corner', () => {
  const plus = walk([{ points: [[0, 50], [50, 50]] }, { points: [[50, 50], [100, 50]] }, { points: [[50, 0], [50, 50]] }, { points: [[50, 50], [50, 100]] }]);
  // (50, 0) and (0, 50) tie on x + y: the smaller y starts; at the crossing it goes straight on, down
  assert.deepEqual(plus.strokes.map(corners), [[[50, 0], [50, 50], [50, 100]], [[0, 50], [50, 50], [100, 50]]]);
});

test('order: the graph keeps corners within MERGE as one, drops a line of no length, and counts the fewest strokes as Euler does', () => {
  const g = graphOf([{ points: [[0, 0], [10, 0], [10.3, 0.2], [20, 0]], edges: [[0, 1], [1, 2], [2, 3]], owner: 0 }]);
  assert.equal(g.corners.length, 3); assert.equal(g.edges.length, 2);
  assert.equal(leastStrokes(g), 1);
  // a plus: four odd ends, an even middle → two strokes; two parts, each a closed ring → two strokes
  assert.equal(walk([{ points: [[0, 50], [100, 50]] }, { points: [[50, 0], [50, 100]] }, { points: [[0, 50], [50, 50]] }]).least, 2);
  assert.equal(walk([{ points: square(0, 0, 10), closed: true }, { points: square(50, 50, 10), closed: true }]).strokes.length, 2);
});

test('the pen: a hook past a corner of 60° or more, 15% of the shorter line at most 3 px, and none at a shallow turn or a stroke end', () => {
  assert.deepEqual(withOvershoot([[0, 0], [100, 0], [100, 100]]), [[0, 0], [100, 0], [103, 0], [100, 0], [100, 100]]);
  assert.deepEqual(withOvershoot([[0, 0], [10, 0], [10, 10]]), [[0, 0], [10, 0], [11.5, 0], [10, 0], [10, 10]]);
  const shallow = [[0, 0], [100, 0], [200, 50]];   // a turn of 26.6°
  assert.deepEqual(withOvershoot(shallow), shallow);
  assert.deepEqual(withOvershoot([[0, 0], [100, 0], [100, 100]], 0), [[0, 0], [100, 0], [100, 100]]);
  assert.deepEqual(CORNER, { angle: 60, share: 0.15, most: 3 });
});

test('the pen: corners kept exactly, times from 0 to length / speed, slower round a corner, wider where slow, tapered at both ends', () => {
  const s = penStroke([[0, 0], [200, 0], [200, 200]], { random: seeded('pen'), speed: 400, width: 2.5, amplitude: 0 });
  assert.ok(s.sx.some((x, i) => x === 200 && s.sy[i] === 0), 'the corner is a point of the stroke');
  assert.ok(s.sx.some((x, i) => x === 203 && s.sy[i] === 0), 'and so is the hook past it');
  assert.ok(near(s.length, 406, 1e-9)); assert.ok(near(s.seconds, 406 / 400, 1e-12));
  assert.equal(s.ts[0], 0); assert.ok(near(s.ts.at(-1), s.seconds, 1e-12));
  for (let i = 1; i < s.ts.length; i += 1) assert.ok(s.ts[i] >= s.ts[i - 1]);
  const speedAt = (i) => Math.hypot(s.sx[i + 1] - s.sx[i], s.sy[i + 1] - s.sy[i]) / (s.ts[i + 1] - s.ts[i]);
  const corner = s.sx.findIndex((x, i) => x === 200 && s.sy[i] === 0), straight = s.sx.findIndex((x) => x >= 100);
  assert.ok(speedAt(corner - 1) < speedAt(straight) / 2, `${speedAt(corner - 1)} vs ${speedAt(straight)}`);
  assert.ok(s.ws[corner] > s.ws[straight], 'wider where it is slow');
  assert.ok(s.ws.every((w) => w <= 2.5 + 1e-12 && w >= 2.5 * PEN_WIDTH.tip * (1 - PEN_WIDTH.thin) - 1e-12));
  assert.ok(s.ws[0] < s.ws[10] && s.ws.at(-1) < s.ws.at(-11), 'tapered at both ends');
  assert.ok(s.ws[0] <= 2.5 * PEN_WIDTH.tip && s.ws[0] >= 2.5 * PEN_WIDTH.tip * (1 - PEN_WIDTH.thin), 'from near rest, at the tip width');
  assert.equal(s.hooks, 1);
});

test('the pen: its tremor never leaves the room it has, and the same random() gives the same stroke', () => {
  const hairpin = [[0, 0], [300, 0], [300, 4], [0, 4]];
  const a = penStroke(hairpin, { random: seeded('tremor'), speed: 400, width: 2.5, amplitude: 3 }), b = penStroke(hairpin, { random: seeded('tremor'), speed: 400, width: 2.5, amplitude: 3 });
  assert.deepEqual(a, b);
  a.xs.forEach((x, i) => { const off = Math.hypot(x - a.sx[i], a.ys[i] - a.sy[i]); assert.ok(off <= a.rs[i] + 1e-9 && a.rs[i] <= 3 + 1e-12, `${off} > ${a.rs[i]}`); });
  assert.ok(Math.max(...a.rs) <= 2 + 1e-9, 'legs 4 px apart leave at most 2 px either way');
  assert.notDeepEqual(penStroke(hairpin, { random: seeded('other'), speed: 400, width: 2.5, amplitude: 3 }).ys, a.ys, 'another seed, another wobble (across the line: in y)');
});

test('hatching: a 100 px square at 0° and 10 px is ten lines, 5 px in from each side, each edge to edge — exactly', () => {
  const h = hatchLines(square(0, 0, 100), { angle: 0, spacing: 10 });
  assert.equal(h.segments.length, 10);
  h.segments.forEach((s, j) => {
    assert.equal(s.line, j);
    assert.ok(near(s.a[1], 5 + 10 * j) && near(s.b[1], 5 + 10 * j));
    assert.ok(near(Math.min(s.a[0], s.b[0]), 0) && near(Math.max(s.a[0], s.b[0]), 100));
  });
  for (let j = 1; j < h.offsets.length; j += 1) assert.ok(near(h.offsets[j] - h.offsets[j - 1], 10));
  // a span a whole number of spacings: the margin is half a spacing, never 0 (no line grazes an edge)
  assert.ok(near(h.offsets[0] - h.lo, 5) && near(h.hi - h.offsets.at(-1), 5));
});

test('hatching: a U is cut where its arms part, a hole is kept out, and every piece is inside with its ends on an edge', () => {
  const u = [[0, 0], [30, 0], [30, 70], [70, 70], [70, 0], [100, 0], [100, 100], [0, 100]];
  const hole = square(40, 80, 20);
  for (const [ring, holes] of [[u, []], [square(0, 0, 100), [square(30, 30, 40)]], [u, [hole]]]) {
    for (const angle of [0, 30, -45, 90, 117]) {
      const h = hatchLines(ring, { angle, spacing: 7, holes });
      assert.ok(h.segments.length > 0);
      for (const s of h.segments) {
        for (let k = 0; k <= 20; k += 1) { const f = k / 20, x = s.a[0] + (s.b[0] - s.a[0]) * f, y = s.a[1] + (s.b[1] - s.a[1]) * f; assert.ok(within(x, y, ring, holes), `${angle}°: (${x}, ${y}) is outside`); }
        for (const end of [s.a, s.b]) assert.ok(Math.min(toRing(end[0], end[1], ring), ...holes.map((r) => toRing(end[0], end[1], r))) < 1e-6, `${angle}°: an end off every edge`);
      }
    }
  }
  const two = hatchLines(u, { angle: 0, spacing: 10 }).segments.filter((s) => s.a[1] < 70);
  assert.ok(two.length > 0 && two.every((s) => Math.abs(s.b[0] - s.a[0]) <= 30 + 1e-9), 'a line across the arms is two pieces');
});

test('fills by hand: hatch flicks all one way, cross-hatch a second set at +90°, scribble one stroke back and forth where the links stay inside', () => {
  const hatch = planSketch([{ points: square(0, 0, 100), closed: true, edge: false, fill: { kind: 'hatch', angle: 0, spacing: 10 } }], { seed: 'h' });
  assert.equal(hatch.strokes.length, 10); assert.equal(hatch.lifts.length, 9);
  assert.ok(hatch.strokes.every((s) => s.path[1][0] > s.path[0][0]), 'every line drawn the same way (one flick of the wrist)');
  const cross = planSketch([{ points: square(0, 0, 100), closed: true, edge: false, fill: { kind: 'cross-hatch', angle: 10, spacing: 10 } }], { seed: 'c' });
  assert.deepEqual(cross.sets.map((s) => s.angle), [10, 10 + CROSS_TURN]);
  const scribble = planSketch([{ points: square(0, 0, 100), closed: true, edge: false, fill: { kind: 'scribble', angle: 0, spacing: 10 } }], { seed: 's' });
  assert.equal(scribble.strokes.length, 1); assert.equal(scribble.strokes[0].path.length, 20);
  const u = [[0, 0], [30, 0], [30, 70], [70, 70], [70, 0], [100, 0], [100, 100], [0, 100]];
  const loose = planSketch([{ points: u, closed: true, edge: false, fill: { kind: 'scribble', angle: 0, spacing: 10 } }], { seed: 's' });
  assert.ok(loose.strokes.length > 1, 'a link across the U would leave it: a lift instead');
  for (const s of loose.strokes) for (let i = 1; i < s.path.length; i += 1) { const m = [(s.path[i][0] + s.path[i - 1][0]) / 2, (s.path[i][1] + s.path[i - 1][1]) / 2]; assert.ok(within(m[0], m[1], u)); }
  assert.deepEqual(HATCH, { angle: -45, spacing: 8, least: 3, most: 200 });
});

test('fills by hand: every drawn point of a fill — its tremor on — stays inside its shape and out of its holes', () => {
  const ring = [[0, 0], [160, 20], [200, 140], [60, 180], [10, 90]], holes = [square(80, 60, 40)];
  for (const kind of ['hatch', 'cross-hatch', 'scribble']) {
    const plan = planSketch([{ points: ring, closed: true, edge: false, holes, fill: { kind, spacing: 6 } }], { seed: kind, tremor: 4 });
    for (const s of plan.strokes) s.xs.forEach((x, i) => assert.ok(within(x, s.ys[i], ring, holes, 1e-9), `${kind}: (${x}, ${s.ys[i]}) is outside`));
  }
});

test('the plan: lifts between strokes (0.06 s and 1500 px a second through the air), widths by layer, and seconds that scale every time', () => {
  const shapes = [{ points: square(0, 0, 100), closed: true, fill: { kind: 'hatch', spacing: 25 } }, { points: [[0, 50], [100, 50]], layer: 'detail' }];
  const plan = planSketch(shapes, { seed: 'p' });
  plan.lifts.forEach((l) => {
    const a = plan.strokes[l.after], b = plan.strokes[l.after + 1];
    assert.ok(near(l.seconds, LIFT.seconds + l.distance / LIFT.speed, 1e-12));
    assert.ok(near(b.start, a.start + a.seconds + l.seconds, 1e-9));
  });
  assert.ok(near(plan.seconds, plan.strokes.at(-1).start + plan.strokes.at(-1).seconds, 1e-9));
  for (const s of plan.strokes) assert.ok(Math.max(...s.ws) <= SKETCH.width * WIDTH_SHARE[s.layer] + 1e-12);
  const timed = planSketch(shapes, { seed: 'p', seconds: 3 });
  assert.ok(near(timed.seconds, 3, 1e-9));
  assert.deepEqual(timed.strokes.map((s) => s.xs), plan.strokes.map((s) => s.xs), 'the same strokes, only slower');
  assert.ok(Object.isFrozen(plan) && Object.isFrozen(plan.strokes[0].xs));
  assert.deepEqual(structuredClone(plan), plan);
});

test('sampleSketch: drawing with the pen down, in the air between strokes (no width), resting on the last point at the end', () => {
  const plan = planSketch([{ points: [[0, 0], [100, 0]] }, { points: [[0, 50], [100, 50]] }], { seed: 'sample', tremor: 0 });
  const first = plan.strokes[0], lift = plan.lifts[0];
  assert.deepEqual(sampleSketch(plan, -1), { x: 0, y: 0, width: first.ws[0], down: 1, stroke: 0, progress: 0 });
  const mid = sampleSketch(plan, first.seconds / 2);
  assert.equal(mid.down, 1); assert.ok(near(mid.y, 0) && near(mid.x, 50, 1e-6) && near(mid.progress, 0.25, 1e-6));
  const air = sampleSketch(plan, first.seconds + lift.seconds / 2);
  assert.equal(air.down, 0); assert.equal(air.width, 0); assert.ok(near(air.progress, 0.5));
  // the second line starts at its end nearer the pen, (100, 50): half way there through the air at half time (minimum jerk)
  assert.ok(near(air.x, 100, 1e-9) && near(air.y, 25, 1e-9), `${air.x}, ${air.y}`);
  assert.deepEqual(sampleSketch(plan, plan.seconds + 1), { x: 0, y: 50, width: plan.strokes[1].ws.at(-1), down: 1, stroke: 1, progress: 1 });
  const ends = sampleSketch(plan, first.seconds);
  assert.deepEqual([ends.stroke, ends.down, ends.x, ends.y], [0, 1, 100, 0], 'at its own end the pen is still down on it');
});

test('boil: a fresh tremor each held frame (every 3), the same for the same frame, never past the room or the amplitude', () => {
  const plan = planSketch([{ points: square(0, 0, 150), closed: true, fill: { kind: 'hatch', spacing: 12 } }, { points: [[0, 75], [150, 75]], layer: 'detail' }], { seed: 'boil', tremor: 1.5 });
  const f = (n, o) => boilSketch(plan, n, o);
  assert.deepEqual(f(0).strokes, f(2).strokes); assert.deepEqual(f(5), f(5));
  assert.notDeepEqual(f(2).strokes, f(3).strokes);
  assert.equal(f(7).held, 2); assert.equal(f(7, { every: 1 }).held, 7);
  for (const frame of [0, 3, 6, 99]) {
    f(frame).strokes.forEach((s, k) => s.xs.forEach((x, i) => {
      const st = plan.strokes[k], off = Math.hypot(x - st.sx[i], s.ys[i] - st.sy[i]);
      assert.ok(off <= Math.min(st.amplitude, st.rs[i]) + 1e-9, `frame ${frame}: ${off}`);
    }));
  }
  const loud = f(3, { amplitude: 8 }), quiet = f(3, { amplitude: 0 });
  loud.strokes.forEach((s, k) => s.xs.forEach((x, i) => assert.ok(Math.hypot(x - plan.strokes[k].sx[i], s.ys[i] - plan.strokes[k].sy[i]) <= plan.strokes[k].rs[i] + 1e-9)));
  quiet.strokes.forEach((s, k) => assert.deepEqual([...s.xs], plan.strokes[k].sx));
  assert.deepEqual(BOIL, { every: 3, most: 8 });
  assert.throws(() => f(-1), /a boil's frame is a whole number from 0 to 10000000/);
  assert.throws(() => f(MOST_BOIL_FRAME + 1), /frame/);
  assert.throws(() => f(0, { every: 0 }), /every is how many frames/);
  assert.throws(() => f(0, { amplitude: 9 }), /amplitude is px across, from 0 to 8/);
});

test('planSketch refuses what it cannot draw, naming the place and the fix', () => {
  const r = (shapes, settings, re) => assert.throws(() => planSketch(shapes, settings), re);
  const ok = [{ points: square(0, 0, 10), closed: true }];
  r(ok, null, /planSketch's settings are/);
  r(ok, {}, /drawn with random\(\) .* or a seed text/);
  r(ok, { seed: 's', speed: 0 }, /the sketch's speed is a number above 0/);
  r(ok, { seed: 's', colour: 'red' }, /planSketch's settings are random, seed, who/);
  r(ok, { seed: 's', who: '' }, /planSketch's who is the words/);
  r(ok, { seed: 's', seconds: 0 }, /seconds is a number above 0/);
  r([], { seed: 's' }, /the sketch's shapes are a list of 1 to 1024 shapes/);
  r([{ points: [[0, 0]] }], { seed: 's', who: 'blocks[1]' }, /blocks\[1\]'s shapes\[0\]'s points is 2 to 1024 points/);
  r([{ points: square(0, 0, 10), colour: 'red' }], { seed: 's' }, /shapes\[0\] takes points, closed, layer, group, edge, fill, holes — not "colour"/);
  r([{ points: square(0, 0, 10), layer: 'shade' }], { seed: 's' }, /layer is 'outline' or 'detail'/);
  r([{ points: square(0, 0, 10), closed: 'yes' }], { seed: 's' }, /closed and edge are true or false/);
  r([{ points: square(0, 0, 10), group: 7 }], { seed: 's' }, /group is a piece's name/);
  r([{ points: square(0, 0, 10), fill: { kind: 'hatch' } }], { seed: 's' }, /only a closed shape of 3 points or more holds one — give it closed: true/);
  r([{ points: square(0, 0, 10), closed: true, edge: false }], { seed: 's' }, /edge: false and no fill: nothing of it would be drawn/);
  r([{ points: square(0, 0, 10), closed: true, fill: { kind: 'dots' } }], { seed: 's' }, /fill kind is 'hatch', 'cross-hatch', 'scribble'/);
  r([{ points: square(0, 0, 10), closed: true, fill: { kind: 'hatch', spacing: 1 } }], { seed: 's' }, /fill spacing is px between its lines, from 3 to 200/);
  r([{ points: square(0, 0, 10), closed: true, fill: { kind: 'hatch', angle: 400 } }], { seed: 's' }, /fill angle is degrees from -360 to 360/);
  r([{ points: square(0, 0, 10), closed: true, fill: { kind: 'hatch', ink: 1 } }], { seed: 's' }, /fill takes kind, angle and spacing — not "ink"/);
  r([{ points: square(0, 0, 10), closed: true, fill: 'hatch' }], { seed: 's' }, /fill is \{kind/);
  r([{ points: square(0, 0, 10), holes: [square(2, 2, 2)] }], { seed: 's' }, /has holes and no fill/);
  r([{ points: square(0, 0, 10), closed: true, fill: { kind: 'hatch' }, holes: 'x' }], { seed: 's' }, /holes are a list of at most 16 rings/);
  r([{ points: [[0, 0], [0.1, 0.1]] }], { seed: 's' }, /has nothing to draw/);
  r(['square'], { seed: 's' }, /shapes\[0\] is a shape \{points/);
  r(Array.from({ length: 9 }, () => ({ points: Array.from({ length: 1000 }, (_, i) => [i, 0]) })), { seed: 's' }, /hold 9000 points — at most 8192: draw it in parts/);
  r([{ points: square(0, 0, 4000), closed: true, edge: false, fill: { kind: 'hatch', spacing: 3 } }], { seed: 's' }, /lines — at most 1024: give a wider spacing/);
});

// ---- the second read's cases ------------------------------------------------------------------------------------------

/** Every point of every stroke's corners-to-corners line, 50 a line, inside the ring (or on an edge) and out of its holes. */
const allWithin = (plan, ring, holes = []) => plan.strokes.every((s) => s.path.every((q, i) => i === 0 || Array.from({ length: 51 }, (_, k) => k / 50).every((f) => {
  const a = s.path[i - 1]; return within(a[0] + (q[0] - a[0]) * f, a[1] + (q[1] - a[1]) * f, ring, holes);
})));

test('a scribble never links across the gaps of a comb: a link along the teeth\'s tips passes corners, not edges', () => {
  const plan = planSketch([{ points: comb, closed: true, edge: false, fill: { kind: 'scribble', angle: 44, spacing: 8 } }], { seed: 'comb', tremor: 0 });
  assert.ok(allWithin(plan, comb));
  for (let angle = -90; angle < 90; angle += 7) for (const spacing of [3, 5, 8, 13]) {
    assert.ok(allWithin(planSketch([{ points: comb, closed: true, edge: false, fill: { kind: 'scribble', angle, spacing } }], { seed: 'comb', tremor: 0 }), comb), `${angle}°, ${spacing} px`);
  }
  // a hatch line along a tooth's edge: kept where the comb is beside it, never run past the comb's end (151 was read once)
  const h = hatchLines(comb, { angle: -90, spacing: 3 });
  assert.ok(h.segments.every((x) => within(x.a[0], x.a[1], comb) && within(x.b[0], x.b[1], comb)));
  assert.ok(near(h.offsets[0] - h.lo, 1.5), 'a span of a whole number of spacings, rounded up a hair, keeps its half-spacing margin');
});

test('corners merge transitively (0, 0.4 and 0.8 px along are one), but a line sampled finer than that is folded, never lost', () => {
  assert.deepEqual(mergeCorners([[0, 0], [0.4, 0], [0.8, 0], [5, 0]]).ids, [0, 0, 0, 1]);
  assert.equal(walk([{ points: [[0, 0], [10, 0]] }, { points: [[10.4, 0], [10.4, 10]] }, { points: [[10.8, 10], [0, 0]] }]).least, 1, 'three lines whose ends chain are one triangle');
  const fine = Array.from({ length: 101 }, (_, i) => [i * 0.3, 0]);
  const w = walk([{ points: fine }]);
  assert.equal(w.strokes.length, 1); assert.ok(w.strokes[0].points.at(-1)[0] >= 29.5, 'the whole 30 px drawn');
});

test('a turn of exactly 60° gets its hook; a stroke past MOST_STROKE_POINTS is walked at a longer step; too many corners for one stroke are refused', () => {
  const r = (60 * Math.PI) / 180;
  assert.equal(withOvershoot([[0, 0], [100, 0], [100 + 100 * Math.cos(r), 100 * Math.sin(r)]]).length, 5);
  const long = planSketch([{ points: [[0, 0], [20000, 0]] }], { seed: 'long' });
  assert.ok(long.strokes[0].xs.length <= MOST_STROKE_POINTS && long.strokes[0].step > 2, `${long.strokes[0].xs.length}`);
  const zig = (x0) => Array.from({ length: 1000 }, (_, i) => [x0 + i * 2, (i % 2) * 2]);
  assert.throws(() => planSketch([{ points: zig(0) }, { points: [zig(0).at(-1), ...zig(1998).slice(1, 500)] }], { seed: 'z' }), /stroke 0 turns at 1499 corners — one stroke holds at most 1365: draw it in parts/);
});

test('boil: a sketch drawn with no tremor boils when asked to, and as loud as asked, within its rooms', () => {
  const still = planSketch([{ points: [[0, 0], [400, 0]] }, { points: [[0, 100], [400, 100], [400, 200]] }], { seed: 'still', tremor: 0 });
  const off = (b) => Math.max(...b.strokes.flatMap((s, k) => s.ys.map((y, i) => Math.hypot(s.xs[i] - still.strokes[k].sx[i], y - still.strokes[k].sy[i]))));
  assert.equal(off(boilSketch(still, 3)), 0, 'no amplitude asked: the tremor it was drawn with, none');
  const loud = boilSketch(still, 3, { amplitude: 4 });
  assert.ok(off(loud) > 2 && off(loud) <= 4 + 1e-9, `${off(loud)}`);
  loud.strokes.forEach((s, k) => s.xs.forEach((x, i) => assert.ok(Math.hypot(x - still.strokes[k].sx[i], s.ys[i] - still.strokes[k].sy[i]) <= still.strokes[k].rs[i] + 1e-9)));
  const quiet = planSketch([{ points: [[0, 0], [400, 0]] }], { seed: 'q', tremor: 0.5 });
  const louder = boilSketch(quiet, 0, { amplitude: 6 }).strokes[0];
  assert.ok(Math.max(...louder.ys.map(Math.abs)) > 0.5, 'louder than the tremor it was drawn with: never capped at it');
});

test('a hatch line that runs along an edge of the shape is kept where the shape is beside it, cut at the corner, never run past it', () => {
  // an L: the line at x = 5 runs inside below y = 50 and along the L's inner edge above it
  const L = [[0, 0], [20, 0], [20, 100], [5, 100], [5, 50], [0, 50]], Z = L.map(([x, y]) => [y, x]);
  for (const [ring, angle] of [[L, -90], [L, 90], [L, 270], [Z, 0], [Z, 180]]) {
    const h = hatchLines(ring, { angle, spacing: 10 });
    assert.equal(h.segments.length, 2, `${angle}°`);
    for (const x of h.segments) {
      assert.ok(within(x.a[0], x.a[1], ring, [], 1e-9) && within(x.b[0], x.b[1], ring, [], 1e-9), `${angle}°: ${x.a} → ${x.b}`);
      assert.ok(near(Math.hypot(x.b[0] - x.a[0], x.b[1] - x.a[1]), 100, 1e-9), `${angle}°: the line from end to end, along the edge too`);
    }
  }
});
