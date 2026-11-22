// The `hand-sketch` model (do: 'sketch') and its critics — pen-lifts, stroke-order, hatch-gaps — catching hand-made bad
// orders and passing good ones; the paint list's `stroke` item; and the two style choices built on strokes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { planMove, sampleMove, checkMove, planIntents, intentKey, shapesOfPaint, strokeItems, strokeOutline, sketchyLine, hatchTexture, ROLE_FILLS,
  PEN_LIFTS_MOST, STROKE_ORDER_MOST, HATCH_GAP_MOST, SKETCH_KEYS, USUAL_MODELS, HUMAN_DOS } from '../human.js';
import { isometric, isoStyle, paintPiece, ISO_STYLE_CHOICES } from '../isometric.js';
import { square, within } from './strokeHelpers.js';

const box = [{ points: square(100, 100, 200), closed: true, fill: { kind: 'hatch', spacing: 10 } }, { points: [[100, 200], [300, 200]], layer: 'detail' }, { points: [[200, 100], [200, 300]], layer: 'detail' }];
const house = [{ points: square(0, 100, 100), closed: true }, { points: [[0, 100], [100, 200]] }, { points: [[100, 100], [0, 200]] }, { points: [[0, 100], [50, 50], [100, 100]] }];

/** A tool's sketch model that draws what it is handed, stroke by stroke, as the test says: the bad orders a critic must catch. */
const made = (name, strokesOf, sets = () => []) => ({ family: 'sketch', name, checks: ['pen-lifts', 'stroke-order', 'hatch-gaps'],
  plan: (intent) => {
    let t = 0;
    const strokes = strokesOf(intent).map((s) => { const out = { ...s, start: t, seconds: 0.5, xs: s.path.map((p) => p[0]), ys: s.path.map((p) => p[1]) }; t += 0.6; return out; });
    return { seconds: t, strokes, sets: sets(intent) };
  },
  sample: (plan, t) => ({ x: plan.strokes[0].xs[0] + t, y: plan.strokes[0].ys[0] }) });
const edgesOfSquare = (sq) => sq.map((p, i) => ({ layer: 'outline', group: '', path: [p, sq[(i + 1) % 4]] }));
const traced = made('test:traced', () => edgesOfSquare(square(0, 0, 100)));
const twice = made('test:twice', () => [{ layer: 'outline', path: [...square(0, 0, 100), [0, 0]] }, { layer: 'outline', path: [[0, 0], [100, 0]] }]);
const detailFirst = made('test:detail-first', () => [{ layer: 'detail', group: 'a', path: [[0, 50], [100, 50]] }, { layer: 'outline', group: 'a', path: [...square(0, 0, 100), [0, 0]] }, { layer: 'fill', group: 'b', path: [[0, 0], [1, 1]] }]);
const sparse = made('test:sparse', () => [{ layer: 'outline', path: [...square(0, 0, 100), [0, 0]] }, ...[5, 15, 25, 75, 85, 95].map((y) => ({ layer: 'fill', set: 0, path: [[0, y], [100, y]] }))],
  () => [{ angle: 0, spacing: 10, lo: 0, hi: 100 }]);
const models = [traced, twice, detailFirst, sparse];
const check = (name) => checkMove(planMove({ do: 'sketch', who: `blocks[3] ("${name}")`, shapes: box, model: `test:${name}` }, { models }), { models });

test('the registry: do: sketch is the family sketch, its usual model hand-sketch, which names the three stroke critics', () => {
  assert.equal(HUMAN_DOS.sketch, 'sketch'); assert.equal(USUAL_MODELS.sketch, 'hand-sketch');
  assert.deepEqual(SKETCH_KEYS, ['shapes', 'seconds', 'speed']);
  const move = planMove({ do: 'sketch', name: 'box', who: 'blocks[1] ("box")', shapes: box });
  assert.deepEqual(move.checks, ['pen-lifts', 'stroke-order', 'hatch-gaps']);
  assert.match(move.reason, /^do: 'sketch' → hand-sketch, the usual for do: 'sketch' — 3 shapes drawn in \d+ strokes \(3 of lines, the least the corners allow being 3; 1 set of fill lines\) over [\d.]+ s — outline, then detail, then fills, from the top left/);
  assert.equal(move.plan.basis.leastStrokes, 3); assert.equal(move.plan.basis.strokes, move.plan.strokes.length);
  assert.equal(move.plan.basis.speedDefaulted, true); assert.equal(move.plan.basis.secondsGiven, false);
});

test('this package\'s sketches pass their own critics: a box with a cross and a hatch, the house of Nikolaus, every fill kind', () => {
  for (const shapes of [box, house, [{ points: [[0, 0], [160, 20], [200, 140], [60, 180]], closed: true, fill: { kind: 'cross-hatch', spacing: 4 } }], [{ points: square(0, 0, 90), closed: true, edge: false, fill: { kind: 'scribble' } }]]) {
    const c = checkMove(planMove({ do: 'sketch', shapes }));
    assert.deepEqual(c.findings, []);
    assert.ok([0, null].includes(c.measures['pen-lifts']), 'none over the least, or no lines at all (a scribble alone)'); assert.equal(c.measures['stroke-order'], 0);
    assert.ok(c.measures['hatch-gaps'] === null || c.measures['hatch-gaps'] <= 1.2, `${c.measures['hatch-gaps']}`);
  }
  assert.deepEqual([PEN_LIFTS_MOST, STROKE_ORDER_MOST, HATCH_GAP_MOST], [0, 0, 1.5]);
});

test('pen-lifts: a square traced line by line, or a line drawn twice, takes more strokes than the order needs — said, with the fix', () => {
  const t = check('traced');
  assert.equal(t.measures['pen-lifts'], 3); assert.deepEqual(t.bases['pen-lifts'], { strokes: 4, least: 1, lifts: 3 });
  const f = t.findings.find((x) => x.critic === 'pen-lifts');
  assert.equal(f.message, 'blocks[3] ("traced"): its lines take 4 strokes where 1 would draw them, each line once (3 more lifts of the pen) — it reads as traced piece by piece, not drawn');
  assert.match(f.fix, /give shapes that meet the same corner points, and use model: 'hand-sketch'/);
  assert.equal(check('twice').measures['pen-lifts'], 1);
});

test('stroke-order: detail drawn before its piece\'s outline is finished is caught; another piece\'s fill is not', () => {
  const c = check('detail-first');
  assert.equal(c.measures['stroke-order'], 1);
  assert.deepEqual(c.bases['stroke-order'], { early: 1, stroke: 0, layer: 'detail', group: 'a' });
  const f = c.findings.find((x) => x.critic === 'stroke-order');
  assert.equal(f.message, 'blocks[3] ("detail-first"): 1 detail stroke starts before the outline of its piece "a" is finished (the first: stroke 0) — a hand blocks in the outline first');
  assert.match(f.fix, /layer: 'outline' or layer: 'detail' and give each piece its group/);
});

test('hatch-gaps: a hatch with its middle lines missing leaves a band wider than 1.5 spacings — said in px, with a closer spacing', () => {
  const c = check('sparse');
  assert.ok(Math.abs(c.measures['hatch-gaps'] - 5) < 1e-9);
  assert.deepEqual(c.bases['hatch-gaps'], { ratio: 5, gap: 50, spacing: 10, set: 0, edge: false });
  const f = c.findings.find((x) => x.critic === 'hatch-gaps');
  assert.equal(f.message, 'blocks[3] ("sparse"): its fill 0 leaves a band 50.0 px wide between two lines with no line through it, where its lines are 10 px apart — it reads as a missed line');
  assert.equal(f.fix, "hatch every line: use model: 'hand-sketch', or give the shape's fill a closer spacing (fill: {spacing: 8})");
  // an edge band counts twice: a hatch that stops 10 px short of a 10 px spacing's edge is a band of 2 spacings
  const short = made('test:short', () => [{ layer: 'fill', set: 0, path: [[0, 5], [100, 5]] }, { layer: 'fill', set: 0, path: [[0, 15], [100, 15]] }], () => [{ angle: 0, spacing: 10, lo: 0, hi: 25 }]);
  const s = checkMove(planMove({ do: 'sketch', shapes: box, model: 'test:short' }, { models: [short] }), { models: [short] });
  assert.deepEqual(s.bases['hatch-gaps'], { ratio: 2, gap: 10, spacing: 10, set: 0, edge: true });
  assert.match(s.findings[0].message, /a band 10.0 px wide at its edge/);
});

test('the critics say nothing when a plan has nothing to read: no strokes, no corners, no sets', () => {
  const bare = made('test:bare', () => [{ layer: 'fill', path: [[0, 0], [1, 0]] }]);
  const c = checkMove(planMove({ do: 'sketch', shapes: box, model: 'test:bare' }, { models: [bare] }), { models: [bare] });
  assert.deepEqual(c.measures, { 'pen-lifts': null, 'stroke-order': 0, 'hatch-gaps': null });
  const empty = { ...bare, name: 'test:empty', plan: () => ({ seconds: 1, strokes: [] }), sample: () => ({ x: 0, y: 0 }) };
  assert.deepEqual(checkMove(planMove({ do: 'sketch', shapes: box, model: 'test:empty' }, { models: [empty] }), { models: [empty] }).measures, { 'pen-lifts': null, 'stroke-order': null, 'hatch-gaps': null });
  const odd = { ...bare, name: 'test:odd', plan: () => ({ seconds: 1, strokes: [{ layer: 'outline', start: 0, seconds: 1, group: 3, path: 'x', set: 0, xs: [0], ys: [] }], sets: [null, { angle: 0, spacing: 0, lo: 0, hi: 1 }] }), sample: () => ({ x: 0, y: 0 }) };
  assert.deepEqual(checkMove(planMove({ do: 'sketch', shapes: box, model: 'test:odd' }, { models: [odd] }), { models: [odd] }).measures, { 'pen-lifts': null, 'stroke-order': 0, 'hatch-gaps': null });
});

test('the model: pure and seeded by the piece, not by who it is or how long it takes; its sample down or in the air', () => {
  const a = planMove({ do: 'sketch', name: 'box', who: 'here', shapes: box }), b = planMove({ do: 'sketch', name: 'box', who: 'there', shapes: box, seconds: 9 });
  assert.deepEqual(a.plan.strokes.map((s) => s.ys), b.plan.strokes.map((s) => s.ys));
  assert.notDeepEqual(planMove({ do: 'sketch', name: 'other', shapes: box }).plan.strokes[0].ys, a.plan.strokes[0].ys);
  assert.ok(Math.abs(b.plan.seconds - 9) < 1e-9); assert.equal(b.plan.basis.secondsGiven, true);
  const slow = planMove({ do: 'sketch', shapes: box, speed: 200 }), usual = planMove({ do: 'sketch', shapes: box });
  const drawing = (m) => m.plan.strokes.reduce((t, x) => t + x.seconds, 0);
  assert.ok(Math.abs(drawing(slow) - 2 * drawing(usual)) < 1e-6, 'half the speed, twice the time drawing (the lifts are the hand in the air)');
  const s = sampleMove(a, a.plan.strokes[0].seconds / 2);
  assert.equal(s.down, 1); assert.equal(s.stroke, 0);
  assert.equal(sampleMove(a, a.plan.strokes[1].start - a.plan.lifts[0].seconds / 2).down, 0);
  const named = planMove({ do: 'sketch', shapes: box, model: { name: 'hand-sketch', tremor: 0, width: 4, overshoot: 0 } });
  assert.ok(named.plan.strokes.every((x) => x.xs.every((v, i) => v === x.sx[i]) && x.hooks === 0));
  assert.match(named.reason, /named by the intent/);
  assert.throws(() => planMove({ do: 'sketch', shapes: box, colour: 'red' }), /takes do, name, who, model, shapes, seconds, speed — not "colour"/);
  assert.throws(() => planMove({ do: 'sketch', shapes: box, model: { name: 'hand-sketch', width: 40 } }), /model "hand-sketch"'s width is a number from 0.25 to 20/);
  assert.throws(() => planMove({ do: 'sketch', who: 'b', shapes: 'box' }), /b's shapes are a list of 1 to 1024 shapes/);
});

test('planIntents decides a sketch like any move: its model, its duration and basis under its own key, its findings', () => {
  const r = planIntents([{ do: 'sketch', name: 'box', shapes: box }, { do: 'sketch', shapes: house, model: 'test:traced' }], { models });
  assert.equal(r.choices[0].model, 'hand-sketch'); assert.equal(r.chose, 'own');
  const d = r[intentKey('duration', 0)];
  assert.equal(d.leastStrokes, 3); assert.equal(d.shapes, 3); assert.ok(d.seconds > 0);
  assert.deepEqual(r[intentKey('findings', 0)], []);
  assert.deepEqual(r[intentKey('findings', 1)].map((f) => f.critic), ['pen-lifts']);
  assert.equal(r.findings[0].who, 'intents[1]');
});

// ---- the paint list and the style choices ----------------------------------------------------------------------------

const grid = isometric({ origin: [400, 60] });
const style = isoStyle({ line: 'human:sketchy', texture: 'human:hatch' }, { choices: [sketchyLine, hatchTexture] });
const piece = (kind, name = 'server') => ({ name, kind, at: [1, 1], size: kind === 'floor' ? [2, 2] : [2, 2, 1] });
const plain = isoStyle();

test('shapesOfPaint: a box\'s silhouette is its outline and its three inner edges its detail; a cylinder\'s straight close under its top is hidden', () => {
  const block = shapesOfPaint(paintPiece(plain, piece('block'), grid).items);
  assert.equal(block.filter((s) => s.layer === 'outline').length, 6); assert.equal(block.filter((s) => s.layer === 'detail').length, 3);
  const cyl = paintPiece(plain, piece('cylinder'), grid).items, top = cyl[1];
  const shapes = shapesOfPaint(cyl);
  assert.ok(shapes.every((s) => s.layer === 'outline'));
  assert.ok(!shapes.some((s) => Math.abs(s.points[0][1] - top.cy) < 1e-9 && Math.abs(s.points[1][1] - top.cy) < 1e-9 && Math.abs(s.points[0][0] - s.points[1][0]) > top.rx), 'no diameter across the top');
  assert.deepEqual(shapesOfPaint(paintPiece(plain, piece('floor'), grid).items), []);
  assert.equal(shapesOfPaint([{ item: 'lines', role: 'grid', segments: [[0, 0, 10, 0]] }], { roles: ['grid'] }).length, 1);
  assert.deepEqual(shapesOfPaint([{ item: 'stroke', role: 'top', points: [[0, 0, 1, 0], [9, 0, 1, 1]] }]), [], 'a stroke is drawn already: it is no face');
});

test('the paint list: strokes are items of their own, checked as [x, y, width, t], and the ring round one is what a painter fills', () => {
  const p = paintPiece(style, piece('block'), grid, { base: '#88aacc', ink: '#111111' });
  const ink = p.items.filter((i) => i.role === 'ink'), hatch = p.items.filter((i) => i.role === 'hatch');
  assert.equal(ink.length, 3, 'the silhouette in one stroke, the inner Y in two');
  assert.ok(hatch.length > 10);
  assert.ok(p.items.slice(0, 3).every((i) => i.item === 'polygon' && i.stroke === null && i.fill.colour), 'the faces keep their fills and lose their ink line');
  for (const it of [...ink, ...hatch]) {
    assert.equal(it.fill, null); assert.equal(it.stroke.colour, '#111111'); assert.equal(it.stroke.cap, 'round');
    for (let i = 1; i < it.points.length; i += 1) assert.ok(it.points[i][3] >= it.points[i - 1][3]);
  }
  const lastInk = Math.max(...ink.flatMap((i) => i.points.map((q) => q[3])));
  assert.ok(Math.min(...hatch.flatMap((i) => i.points.map((q) => q[3]))) > lastInk, 'the hatch after the line');
  const ring = strokeOutline([[0, 0, 2, 0], [10, 0, 4, 1]]);
  assert.deepEqual(ring, [[0, -1], [10, -2], [10, 2], [0, 1]]);
  const items = strokeItems({ strokes: [{ xs: [0, 1], ys: [0, 0], ws: [1, 1], ts: [0, 1] }] }, { of: 'a', role: 'ink', width: 1, at: 2 });
  assert.deepEqual(items[0].points, [[0, 0, 1, 2], [1, 0, 1, 3]]);
});

test('the paint list refuses a stroke item that is not one: wrong points, a width past its stroke\'s, time going back, a fill', () => {
  const own = (items) => isoStyle({ texture: 'test:t' }, { choices: [{ column: 'texture', name: 'test:t', apply: () => items }] });
  const paint = (items) => paintPiece(own(items), piece('block'), grid);
  const stroke = { colour: null, alpha: 1, width: 2, join: 'round', cap: 'round' };
  const one = (extra) => [{ item: 'stroke', role: 'ink', of: 'server', points: [[0, 0, 1, 0], [1, 1, 1, 1]], fill: null, stroke, ...extra }];
  assert.equal(paint(one({})).items.length, 1);
  assert.throws(() => paint(one({ points: [[0, 0, 1, 0]] })), /is a stroke of at least 2 points — not 1/);
  assert.throws(() => paint(one({ points: [[0, 0, 1], [1, 1, 1]] })), /point is \[x, y, width, t\]/);
  assert.throws(() => paint(one({ points: [[0, 0, 3, 0], [1, 1, 1, 1]] })), /the width from 0 to the stroke's 2 px/);
  assert.throws(() => paint(one({ points: [[0, 0, 1, 2], [1, 1, 1, 1]] })), /t in seconds from 2 on/);
  assert.throws(() => paint(one({ points: [[0, 0, 1, -1], [1, 1, 1, 1]] })), /from 0 on/);
  assert.throws(() => paint(one({ fill: { mix: null, colour: '#000000' } })), /its fill is null and its stroke names/);
  assert.throws(() => paint(one({ stroke: null })), /its fill is null and its stroke names/);
  assert.throws(() => paint(one({ segments: [] })), /holds item, role, of, points, fill and stroke/);
});

test('the style choices: seeded by the piece, the same twice; a cylinder and a floor; hatches inside their faces, out of the faces over them', () => {
  const a = paintPiece(style, piece('block'), grid, { ink: '#111111' }), b = paintPiece(style, piece('block'), grid, { ink: '#111111' });
  assert.deepEqual(a, b);
  const inkOf = (p) => p.items.find((i) => i.role === 'ink').points;
  assert.notDeepEqual(inkOf(paintPiece(style, piece('block', 'db'), grid, { ink: '#111111' })), inkOf(a), 'another piece, another wobble');
  const cyl = paintPiece(style, piece('cylinder'), grid);
  const top = cyl.items[1], side = cyl.items[0];
  const topRing = Array.from({ length: 48 }, (_, k) => [top.cx + top.rx * Math.cos((2 * Math.PI * k) / 48), top.cy + top.ry * Math.sin((2 * Math.PI * k) / 48)]);
  const hatch = cyl.items.filter((i) => i.role === 'hatch');
  assert.ok(hatch.length > 5);
  assert.ok(hatch.every((it) => it.points.every((q) => !(((q[0] - top.cx) / top.rx) ** 2 + ((q[1] - top.cy) / top.ry) ** 2 < 1 - 1e-6) || within(q[0], q[1], [[-1e9, -1e9], [1e9, -1e9], [1e9, 1e9]], [topRing], 1e-6))), 'no hatch inside the top');
  assert.equal(side.stroke, null);
  const block = paintPiece(style, piece('block'), grid);
  const [left, right] = block.items;
  const inFace = (face) => block.items.filter((i) => i.role === 'hatch').filter((it) => within(it.points[1][0], it.points[1][1], face.points)).length;
  assert.ok(inFace(left) > 0 && inFace(right) > inFace(left), 'the right face cross-hatched: more lines');
  for (const it of block.items.filter((i) => i.role === 'hatch')) assert.ok(it.points.every((q) => within(q[0], q[1], left.points) || within(q[0], q[1], right.points)), 'every hatch point on a hatched face');
  const floor = paintPiece(style, piece('floor'), grid, { ink: '#111111' });
  assert.deepEqual(floor.items[1].stroke, paintPiece(plain, piece('floor'), grid, { ink: '#111111' }).items[1].stroke, 'a floor keeps its tile lines as ink keeps them');
  assert.equal(floor.items.length, 2);
  assert.deepEqual(ROLE_FILLS, { left: 'hatch', right: 'cross-hatch', side: 'hatch' });
  assert.ok(!ISO_STYLE_CHOICES.line.includes('human:sketchy'), 'handed in, never built in: the isometric door never loads src/human');
});

test('the style choices take their options, checked once when the style is made', () => {
  const s = isoStyle({ line: { name: 'human:sketchy', width: 5, tremor: 0, overshoot: 0, speed: 800 }, texture: { name: 'human:hatch', spacing: 20, angle: 30, width: 2, tremor: 0 } }, { choices: [sketchyLine, hatchTexture] });
  const p = paintPiece(s, piece('block'), grid);
  assert.ok(p.items.filter((i) => i.role === 'ink').every((i) => i.stroke.width === 5));
  assert.ok(p.items.filter((i) => i.role === 'hatch').every((i) => Math.abs(i.stroke.width - 0.8) < 1e-12));
  for (const [row, re] of [[{ line: { name: 'human:sketchy', width: 50 } }, /line "human:sketchy" takes a width from 0.5 to 20 — not 50/], [{ line: { name: 'human:sketchy', speed: 1 } }, /speed from 50 to 5000/],
    [{ texture: { name: 'human:hatch', spacing: 1 } }, /texture "human:hatch" takes a spacing from 3 to 200/], [{ texture: { name: 'human:hatch', angle: 999 } }, /angle from -360 to 360/]]) {
    assert.throws(() => isoStyle(row, { choices: [sketchyLine, hatchTexture] }), re);
  }
  // a flat block's faces have no area: nothing to hatch, the faces as they were
  const flat = paintPiece(isoStyle({ texture: 'human:hatch' }, { choices: [hatchTexture] }), { name: 'f', kind: 'block', at: [1, 1], size: [2, 2, 0] }, grid);
  assert.ok(flat.items.every((i) => i.item !== 'stroke'));
});
