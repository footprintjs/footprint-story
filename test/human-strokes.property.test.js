// Hand-drawn strokes, by property: any line drawing is drawn with every line once in the fewest strokes its corners
// allow, piece by piece and outline first; any hatch is exactly inside its shape and evenly spaced; a fill drawn with
// its tremor never leaves its shape; a boil stays within its room and holds for its frames; the same input, the same plan.
// FC_RUNS=20000 npm test runs a deep sweep (the drawn fills run a tenth of it: each plans a whole sketch).
import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { planSketch, boilSketch, hatchLines, leastStrokes } from '../human.js';
import { walkLines } from '../src/human/strokes/order.js';
import { readShapes } from '../src/human/strokes/shapes.js';
import { graphOf } from '../src/human/strokes/graph.js';
import { penLifts } from '../src/human/strokes/penLifts.js';
import { strokeOrder } from '../src/human/strokes/strokeOrder.js';
import { toRing } from '../src/human/strokes/geometry.js';
import { within } from './strokeHelpers.js';

const RUNS = Number(process.env.FC_RUNS) || 300;
const runs = (share = 1) => ({ numRuns: Math.max(20, Math.round(RUNS * share)) });
const lattice = fc.tuple(fc.integer({ min: 0, max: 6 }), fc.integer({ min: 0, max: 6 })).map(([x, y]) => [x * 40, y * 40]);
const segment = fc.tuple(lattice, lattice).filter(([a, b]) => a[0] !== b[0] || a[1] !== b[1]).map(([a, b]) => ({ points: [a, b] }));
const ring = fc.tuple(lattice, fc.integer({ min: 1, max: 3 }), fc.integer({ min: 1, max: 3 })).map(([[x, y], w, h]) => ({ points: [[x, y], [x + w * 40, y], [x + w * 40, y + h * 40], [x, y + h * 40]], closed: true }));
const drawing = fc.array(fc.oneof(segment, ring), { minLength: 1, maxLength: 12 });
/** A simple polygon: star-shaped round a centre, its corners at sorted angles and any radii. */
const star = fc.tuple(fc.double({ min: 100, max: 900, noNaN: true }), fc.double({ min: 100, max: 700, noNaN: true }),
  fc.uniqueArray(fc.integer({ min: 0, max: 359 }), { minLength: 3, maxLength: 12 }), fc.array(fc.double({ min: 20, max: 250, noNaN: true }), { minLength: 12, maxLength: 12 }))
  .map(([cx, cy, angles, radii]) => angles.sort((a, b) => a - b).map((a, i) => [cx + radii[i] * Math.cos((a * Math.PI) / 180), cy + radii[i] * Math.sin((a * Math.PI) / 180)]));

test('any line drawing: every line drawn once, in exactly the fewest strokes its corners allow, from the top-left odd corner', () => {
  fc.assert(fc.property(drawing, (shapes) => {
    const read = readShapes(shapes, 't'), w = walkLines(read, null);
    const g = graphOf(read.map((s) => ({ points: s.points, edges: s.points.slice(1).map((_, i) => [i, i + 1]).concat(s.closed ? [[s.points.length - 1, 0]] : []), owner: s.index })));
    const drawn = w.strokes.flatMap((s) => s.corners.slice(1).map((c, i) => (c < s.corners[i] ? `${c},${s.corners[i]}` : `${s.corners[i]},${c}`)));
    assert.equal(drawn.length, g.edges.length, 'as many lines drawn as there are');
    assert.equal(new Set(drawn).size, drawn.length, 'none twice');
    assert.equal(w.strokes.length, leastStrokes(g), 'the fewest strokes');
    // the first stroke: from the corner that reaches furthest to the top left, an odd one when there is one
    const degree = g.corners.map(() => 0);
    for (const e of g.edges) { degree[e.a] += 1; degree[e.b] += 1; }
    const odd = g.corners.filter((_, i) => degree[i] % 2), live = g.corners.filter((_, i) => degree[i] > 0), pool = odd.length ? odd : live;
    const best = pool.reduce((b, p) => (p[0] + p[1] < b[0] + b[1] || (p[0] + p[1] === b[0] + b[1] && p[1] < b[1]) ? p : b));
    assert.deepEqual([...w.strokes[0].points[0]], best);
    assert.deepEqual(walkLines(read, null), w, 'the same drawing, the same walk');
  }), runs());
});

test('any drawing in pieces and layers: piece by piece, each its outline then detail then fills; the critics find nothing', () => {
  const shaped = fc.tuple(fc.oneof(segment, ring), fc.constantFrom('a', 'b', 'c'), fc.constantFrom('outline', 'detail'), fc.boolean())
    .map(([s, group, layer, filled]) => ({ ...s, group, layer, ...(filled && s.closed ? { fill: { kind: 'hatch', spacing: 20 } } : {}) }));
  fc.assert(fc.property(fc.array(shaped, { minLength: 1, maxLength: 8 }), (shapes) => {
    const plan = planSketch(shapes, { seed: 'layers', tremor: 0 });
    const runsOf = plan.order.map((o) => `${o.group}|${o.layer}`).filter((v, i, a) => v !== a[i - 1]);
    assert.equal(new Set(runsOf).size, runsOf.length, 'each piece\'s layer drawn in one run');
    const groups = runsOf.map((r) => r.split('|')[0]).filter((v, i, a) => v !== a[i - 1]);
    assert.equal(new Set(groups).size, groups.length, 'each piece drawn in one run');
    for (const g of new Set(groups)) {
      const layers = runsOf.filter((r) => r.startsWith(`${g}|`)).map((r) => r.split('|')[1]), rank = { outline: 0, detail: 1, fill: 2 };
      assert.deepEqual(layers, [...layers].sort((x, y) => rank[x] - rank[y]));
    }
    const track = { plan };
    assert.equal(penLifts.measure(track).value, 0); assert.equal(strokeOrder.measure(track).value, 0);
    for (let i = 1; i < plan.strokes.length; i += 1) assert.ok(plan.strokes[i].start > plan.strokes[i - 1].start);
  }), runs(0.3));
});

test('any hatch over any simple shape: every piece inside, its ends on an edge, the lines spacing apart, the margins above 0 and at most half a spacing', () => {
  fc.assert(fc.property(star, fc.double({ min: -180, max: 180, noNaN: true }), fc.double({ min: 3, max: 60, noNaN: true }), (poly, angle, spacing) => {
    const h = hatchLines(poly, { angle, spacing });
    for (let j = 1; j < h.offsets.length; j += 1) assert.ok(Math.abs(h.offsets[j] - h.offsets[j - 1] - spacing) < 1e-9);
    const left = h.offsets[0] - h.lo, right = h.hi - h.offsets.at(-1);
    assert.ok(left > 0 && left <= spacing / 2 + 1e-9 && Math.abs(left - right) < 1e-9, `${left}, ${right}`);
    for (const s of h.segments) {
      for (const f of [0.001, 0.25, 0.5, 0.75, 0.999]) assert.ok(within(s.a[0] + (s.b[0] - s.a[0]) * f, s.a[1] + (s.b[1] - s.a[1]) * f, poly, [], 1e-6));
      assert.ok(toRing(s.a[0], s.a[1], poly) < 1e-6 && toRing(s.b[0], s.b[1], poly) < 1e-6);
      const across = s.a[0] * h.normal[0] + s.a[1] * h.normal[1];
      assert.ok(Math.abs(across - h.offsets[s.line]) < 1e-6, 'each piece on its line');
    }
    // a line with no piece crosses the shape where it is under a pixel wide (a sliver's tip): no band of it goes without
    // a line — the chord measured again here, edge by edge, in the line's own frame
    const lined = new Set(h.segments.map((s) => s.line));
    h.offsets.forEach((c, j) => {
      if (lined.has(j)) return;
      const hits = [];
      poly.forEach((p, i) => {
        const q = poly[(i + 1) % poly.length], pa = p[0] * h.normal[0] + p[1] * h.normal[1] - c, qa = q[0] * h.normal[0] + q[1] * h.normal[1] - c;
        if (pa * qa < 0) { const f = pa / (pa - qa); hits.push((p[0] + (q[0] - p[0]) * f) * h.direction[0] + (p[1] + (q[1] - p[1]) * f) * h.direction[1]); }
      });
      hits.sort((a, b) => a - b);
      let chord = 0;
      for (let k = 1; k < hits.length; k += 2) chord += hits[k] - hits[k - 1];
      assert.ok(chord < 1, `line ${j} crosses ${chord} px of the shape and has no piece`);
    });
  }), runs());
});

test('any fill drawn by hand, tremor and all, stays inside its shape and out of its hole', () => {
  fc.assert(fc.property(star, fc.constantFrom('hatch', 'cross-hatch', 'scribble'), fc.double({ min: 0, max: 8, noNaN: true }), fc.integer({ min: 0, max: 1000 }), (poly, kind, tremor, seed) => {
    const c = poly.reduce((s, p) => [s[0] + p[0] / poly.length, s[1] + p[1] / poly.length], [0, 0]);
    const hole = [[c[0] - 5, c[1] - 5], [c[0] + 5, c[1] - 5], [c[0] + 5, c[1] + 5], [c[0] - 5, c[1] + 5]];
    const holes = hole.every((p) => within(p[0], p[1], poly, [], -1)) ? [hole] : [];
    let plan;
    try { plan = planSketch([{ points: poly, closed: true, edge: false, holes, fill: { kind, spacing: 9 } }], { seed: String(seed), tremor }); }
    catch (e) { if (/nothing to draw/.test(e.message)) return; throw e; }
    for (const s of plan.strokes) s.xs.forEach((x, i) => assert.ok(within(x, s.ys[i], poly, holes, 1e-9), `(${x}, ${s.ys[i]})`));
  }), runs(0.1));
});

test('any boil: within each stroke\'s room and amplitude of its smooth line, the same for every frame of one hold', () => {
  const plan = planSketch([{ points: [[0, 0], [300, 40], [260, 260], [20, 200]], closed: true, fill: { kind: 'scribble', spacing: 15 } }, { points: [[0, 0], [260, 260]], layer: 'detail' }], { seed: 'boil', tremor: 2 });
  fc.assert(fc.property(fc.integer({ min: 0, max: 1e7 }), fc.integer({ min: 1, max: 12 }), (frame, every) => {
    const b = boilSketch(plan, frame, { every });
    assert.equal(b.held, Math.floor(frame / every));
    assert.deepEqual(boilSketch(plan, b.held * every, { every }).strokes, b.strokes);
    b.strokes.forEach((s, k) => s.xs.forEach((x, i) => { const st = plan.strokes[k]; assert.ok(Math.hypot(x - st.sx[i], s.ys[i] - st.sy[i]) <= Math.min(st.amplitude, st.rs[i]) + 1e-9); }));
  }), runs(0.2));
});

test('any sketch: the same shapes and seed give the same plan, frozen plain data that clones whole; its times only rise', () => {
  fc.assert(fc.property(drawing, fc.string({ maxLength: 12 }), (shapes, seed) => {
    const a = planSketch(shapes, { seed }), b = planSketch(shapes, { seed });
    assert.deepEqual(a, b); assert.deepEqual(structuredClone(a), a); assert.ok(Object.isFrozen(a.strokes));
    for (const s of a.strokes) {
      for (let i = 1; i < s.ts.length; i += 1) assert.ok(s.ts[i] >= s.ts[i - 1]);
      assert.ok(Math.abs(s.ts.at(-1) - (s.start + s.seconds)) < 1e-9);
      assert.ok(s.ws.every((w) => w > 0 && w <= a.width + 1e-12));
    }
  }), runs(0.3));
});
