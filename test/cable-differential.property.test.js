// The differential properties of the cable pieces that moved here in 0.19.0 from StoryDeck 0.29.0 and StoryReel 0.34.0
// (each tool had its own copy): where a cable's label stands and how big its plate is, a way walked, how far a ray runs
// in an outline or a box, a round thing's outline, a straight wire's lanes and ends, its bend and its curve, an arrow's
// head, and — in /motion — a value on stops and how much of a packet a block's ramps show. The CONTROLS are that code,
// copied and never edited but for an import (test/control/README.md). For every input a tool gave them, the door gives
// what the tool's copy gave — the same numbers. FC_RUNS=200000 npm test runs a deep sweep.
//
// Where the two tools' copies differed, named — the door is StoryDeck's rule in both:
// 1. StoryReel's labelAt asked a hiding outline only when one of its points stood within 200 px of the label
//    (StoryDeck asks every outline whose box reaches the label).
// 2. It charged its looks another way, far more for the same search: every point of every other cable at every place
//    tried, where StoryDeck charges the near ones and a look an entry. A busy map (over a hundred labelled cables) ran
//    out of looks there, and every later label fell to its cable's middle; here they are placed by the rule.
// 3. StoryReel's labelAt also asked a hiding outline whose box only TOUCHES the plate's edge (StoryDeck asks only one
//    whose box reaches into the plate), and its inside test counts a point on an outline's left or top edge as inside:
//    a plate that exactly fills the gap between two blocks (at tile 68, "https" is one tile wide) was hidden there, and
//    moved off its cable's middle to a place really under the block. Found by fast-check seed 580667364 (0.32.1).
// Elsewhere StoryReel's answer is the same: its before/after run over its example and 1,500 generated worlds and 24
// films at a film's tile sizes changed no frame. The last three tests show where they part.
import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import * as cable0 from './control/storydeck-0.29.0-cable.js';
import * as boxes0 from './control/storydeck-0.29.0-boxes.js';
import * as rides0 from './control/storydeck-0.29.0-rides.js';
import * as iso0 from './control/storydeck-0.29.0-iso.js';
import * as transforms0 from './control/storydeck-0.29.0-transforms.js';
import * as cables1 from './control/storyreel-0.34.0-cables.mjs';
import * as ride1 from './control/storyreel-0.34.0-ride.mjs';
import * as build1 from './control/storyreel-0.34.0-build.mjs';
import * as draw1 from './control/storyreel-0.34.0-draw.mjs';
import { CABLE, LABEL_PLACES, arrowHead, bentWire, curveWay, exitBox, exitOutline, headingOf, held, isometric, labelHalf, labelPlace, lanesOf, rounded, roundOutline, straightRun, walkWay } from '../isometric.js';
import { onStops, seenAt, seenTerms } from '../motion.js';

const RUNS = Number(process.env.FC_RUNS) || 2000;
/** A number as a canvas or a page draws it: -0 and 0 are one place. */
const flat = (v) => (typeof v === 'number' ? v + 0 : Array.isArray(v) ? v.map(flat) : v);
const px = fc.double({ min: -2000, max: 4000, noNaN: true });
const point = fc.tuple(px, px);
const unit = fc.double({ min: 0, max: 2 * Math.PI, noNaN: true }).map((a) => [Math.cos(a), Math.sin(a)]);
/** A convex outline round a middle: a block's hexagon, a box, or a round thing's 26 points. */
const outline = fc.tuple(point, fc.double({ min: 4, max: 400, noNaN: true }), fc.double({ min: 4, max: 300, noNaN: true }), fc.constantFrom(4, 6, 26)).map(([[cx, cy], rx, ry, n]) => Array.from({ length: n }, (_, i) => [cx + rx * Math.cos((2 * Math.PI * i) / n), cy + ry * Math.sin((2 * Math.PI * i) / n)]));

test('the numbers: CABLE and LABEL_PLACES are both tools\' numbers', () => {
  const r = cables1.ISO_CABLE;
  assert.deepEqual([CABLE.clear, CABLE.gap, CABLE.lane, CABLE.least, CABLE.corner, CABLE.head, CABLE.sample, CABLE.walkMost, CABLE.edge, CABLE.tip, CABLE.looks], [r.clear, r.gap, r.lane, r.least, r.corner, r.head, r.sample, r.walkMost, r.edge, r.tip, r.looks]);
  assert.deepEqual(CABLE.label, r.label);
  assert.equal(CABLE.looks, cable0.LABEL_LOOKS);
  assert.equal(CABLE.walkMost, cable0.WALK_MOST);
  assert.deepEqual(LABEL_PLACES, cable0.LABEL_PLACES);
  assert.deepEqual(LABEL_PLACES, cables1.LABEL_PLACES);
});

test('labelHalf: StoryDeck\'s labelBox (letters as a page shows them) and StoryReel\'s labelHalf (letters as code points)', () => {
  const shown = (label) => label.replace(/&(?:#\d+|#x[\da-f]+|[a-z][a-z\d]*);/gi, '.').length;   // the deck's count (transforms.js · shown): its own words
  fc.assert(fc.property(fc.string({ unit: fc.constantFrom('a', 'B', ' ', '&amp;', '&#233;', '日', '😀', 'é'), minLength: 1, maxLength: 80 }), (label) => {
    assert.deepEqual(labelHalf(shown(label)), transforms0.labelBox(label));
    assert.deepEqual(labelHalf([...label].length), cables1.labelHalf(label));
  }), { numRuns: RUNS });
});

test('exitOutline and exitBox: the tools\' exitOutline, StoryDeck\'s exit', () => {
  fc.assert(fc.property(outline, point, unit, (o, p, u) => {
    assert.equal(exitOutline(o, p, u), boxes0.exitOutline(o, p, u));
    assert.equal(exitOutline(o, p, u), cables1.exitOutline(o, p, u));
  }), { numRuns: RUNS });
  const box = fc.record({ x: px, y: px, w: fc.double({ min: 0, max: 900, noNaN: true }), h: fc.double({ min: 0, max: 900, noNaN: true }) });
  fc.assert(fc.property(box, point, fc.oneof(unit, fc.constantFrom([1, 0], [0, -1], [0, 0])), (b, p, u) => assert.equal(exitBox(b, p, u), boxes0.exit(b, p, u))), { numRuns: RUNS });
});

test('roundOutline: StoryDeck\'s ({x, y}) and StoryReel\'s ([x, y]), point for point', () => {
  const ellipse = fc.record({ cx: px, cy: px, rx: fc.double({ min: 0, max: 400, noNaN: true }), ry: fc.double({ min: 0, max: 200, noNaN: true }) });
  fc.assert(fc.property(ellipse, ellipse, fc.option(fc.integer({ min: 1, max: 40 }), { nil: undefined }), (t, b, steps) => {
    const got = roundOutline(t, b, steps);
    assert.deepEqual(got, iso0.roundOutline(t, b, steps));
    assert.deepEqual(got.map(({ x, y }) => [x, y]), build1.roundOutline(t, b, steps));
  }), { numRuns: RUNS });
});

test('curveWay: StoryReel\'s curveWay, and its length StoryDeck\'s curveLength — wires far past a slide too', () => {
  const far = fc.oneof(px, fc.constantFrom(3e9, -1.7e308, 1.7e308, 0));
  fc.assert(fc.property(fc.tuple(far, far), point, fc.tuple(far, far), fc.constantFrom(64, 12, undefined), (a, c, e, runs) => {
    assert.equal(curveWay(a, c, e, runs).length, rides0.curveLength(a, c, e, runs), 'the length a deck measures');
  }), { numRuns: RUNS });
  fc.assert(fc.property(point, point, point, fc.array(fc.double({ min: -0.5, max: 1.5, noNaN: true }), { maxLength: 8 }), (a, c, e, shares) => {
    const got = curveWay(a, c, e), was = cables1.curveWay(a, c, e);
    assert.deepEqual(flat([got.start, got.pieces, got.length]), flat([was.start, was.pieces, was.length]));
    for (const s of [0, 1, 0.5, ...shares]) assert.deepEqual(flat(got.at(s)), flat(was.at(s)), `at ${s}`);
  }), { numRuns: RUNS });
  // a lead's length (deck/rides.js · piecesLength) walks each corner in 12 runs: curveWay's length, piece by piece
  fc.assert(fc.property(fc.array(point, { minLength: 3, maxLength: 7 }), fc.double({ min: 0, max: 60, noNaN: true }), (pts, r) => {
    let way; try { way = rounded(pts, r); } catch { return; }
    let length = 0, at = way.start;
    for (const piece of way.pieces) { length += piece.corner ? curveWay(at, piece.corner, piece.to, 12).length : Math.hypot(piece.to[0] - at[0], piece.to[1] - at[1]); at = piece.to; }
    assert.equal(length, rides0.piecesLength(way.start, way.pieces));
  }), { numRuns: RUNS });
});

test('arrowHead: StoryDeck\'s headAt (to a tenth of a px, as it writes it) and StoryReel\'s drawHead (on a canvas)', () => {
  const f = (v) => +v.toFixed(1);
  fc.assert(fc.property(point, point, (tip, before) => {
    const u = headingOf(before, tip), [t, l, r] = arrowHead(tip, u);
    assert.equal(`<path class="head" d="M${f(t[0])} ${f(t[1])}L${f(l[0])} ${f(l[1])}L${f(r[0])} ${f(r[1])}Z"/>`, transforms0.headAt(tip, u));
    const drawn = [], c = { beginPath() {}, closePath() {}, fill() {}, moveTo: (x, y) => drawn.push([x, y]), lineTo: (x, y) => drawn.push([x, y]) };
    draw1.drawHead(c, tip, before, '#000');
    assert.deepEqual(drawn, [t, l, r]);
  }), { numRuns: RUNS });
});

test('walkWay: StoryDeck\'s cableWalk and StoryReel\'s walk, whole and in part', () => {
  fc.assert(fc.property(fc.array(point, { minLength: 2, maxLength: 6 }), fc.double({ min: 0, max: 40, noNaN: true }), fc.double({ min: 0, max: 1, noNaN: true }), fc.double({ min: 0, max: 1, noNaN: true }), (pts, r, x, y) => {
    let way; try { way = rounded(pts, r); } catch { return; }
    assert.deepEqual(walkWay(way), cable0.cableWalk(way));
    assert.deepEqual(walkWay(way), cables1.walk(way));
    const [from, to] = x < y ? [x, y] : [y, x];
    assert.deepEqual(walkWay(way, from, to), cables1.walk(way, from, to));
  }), { numRuns: RUNS });
});

test('held and labelPlace: StoryDeck\'s, for any cable, plates, outlines, other cables, looks and tip', () => {
  const way = fc.array(point, { minLength: 2, maxLength: 5 }).chain((pts) => fc.constant(pts)).map((pts) => { try { return rounded(pts.map(([x, y]) => [x / 4 + 400, y / 4 + 300]), 30); } catch { return rounded([[0, 0], [300, 0]]); } });
  const half = fc.tuple(fc.double({ min: 4, max: 200, noNaN: true }), fc.double({ min: 4, max: 40, noNaN: true }));
  const near = outline.map((o) => o.map(([x, y]) => [x / 4 + 400, y / 4 + 300]));
  const looks = fc.oneof(fc.constant(CABLE.looks), fc.integer({ min: 0, max: 50_000 }), fc.integer({ min: 0, max: 500 }));
  fc.assert(fc.property(way, half, fc.array(near, { maxLength: 6 }), fc.array(way, { maxLength: 4 }), fc.boolean(), looks, fc.option(point, { nil: undefined }), (w, h, outlines, others, own, left, tip) => {
    for (const o of outlines) assert.deepEqual(held(o), cable0.held(o));
    const hides = outlines.map((o) => cable0.held(o)), runs = [...others, ...(own ? [w] : [])].map((line) => ({ ...cable0.held(cable0.cableWalk(line)), of: line }));
    const mine = { left }, theirs = { left };
    assert.deepEqual(labelPlace(w, h, hides, runs, mine, tip), cable0.labelPlace(w, h, hides, runs, theirs, tip));
    assert.equal(mine.left, theirs.left, 'the same looks spent');
  }), { numRuns: RUNS });
  // the defaults, left out
  const w = rounded([[0, 0], [300, 0]]);
  assert.deepEqual(labelPlace(w, [30, 13], [cable0.held([[100, -50], [200, -50], [200, 50], [100, 50]])]), cable0.labelPlace(w, [30, 13], [cable0.held([[100, -50], [200, -50], [200, 50], [100, 50]])]));
});

// StoryDeck's straight wires (deck/transforms.js · wiresBetween): pieces drawn as outlines or placed as boxes, wires
// between them by name with a bend, in lanes. The tool's composition of the doors, written as a deck now writes it.
function deckBetween(html, found, shapes) {
  const names = new Set(html.names), read = found.map(({ m }) => transforms0.wireEndsOf(m[1], names)).map((e, i) => e && [found[i].m[1], e.from.name, e.to.name, e.bend]);
  const lanes = lanesOf(read.map((m) => (m && m[1] !== m[2] ? [m[1], m[2]] : null)));
  const endOf = (name, where) => {
    const shape = html.alone.includes(name) ? shapes.get(name) : undefined;
    if (shape) return { middle: shape.middle, outline: shape.outline };
    const box = html.boxes[name];
    if (!box) throw new Error(`${where}: no piece "${name}" with a box`);
    return { middle: [box.x + box.w / 2, box.y + box.h / 2], box };
  };
  return read.map((m, i) => {
    if (!m) return null;
    const spec = m[0];
    if (m[1] === m[2]) throw new Error(`data-arrow="${spec}": a wire joins two pieces, not "${m[1]}" to itself`);
    const [a, b] = [m[1], m[2]].sort(), run = straightRun(endOf(a, `data-arrow="${spec}"`), endOf(b, `data-arrow="${spec}"`), lanes[i]);
    if (run.why === 'middle') throw new Error(`data-arrow="${spec}": "${a}" and "${b}" share a middle — place them apart, or give the wire numbers`);
    if (run.why === 'close') throw new Error(`data-arrow="${spec}": "${a}" and "${b}" are too close for a wire between them (they touch or overlap) — move them apart, or give the wire numbers`);
    const [from, to] = lanes[i].flip ? [run.end, run.start] : [run.start, run.end];
    return [...from, ...to, Number(m[3] ?? 0)].map((v) => +v.toFixed(1)).join(' ');
  });
}

test('lanesOf and straightRun: StoryDeck\'s straight wires between pieces — outlines and boxes, lanes both ways, refusals', () => {
  // pieces spread along a row (now and then pressed together, to meet the refusals), each an outline or a box
  const piece = fc.record({ dx: fc.double({ min: -150, max: 150, noNaN: true }), dy: fc.double({ min: -400, max: 400, noNaN: true }), rx: fc.double({ min: 4, max: 250, noNaN: true }), ry: fc.double({ min: 4, max: 250, noNaN: true }), n: fc.constantFrom(4, 6, 26), box: fc.boolean() });
  const names = ['a', 'b', 'c', 'zz', 'a.b'];
  let drawn = 0;
  fc.assert(fc.property(fc.array(piece, { minLength: 2, maxLength: 5 }), fc.array(fc.tuple(fc.nat(4), fc.nat(3), fc.constantFrom('', ' 0', ' 24', ' -40')), { maxLength: 8 }), fc.boolean(), (pieces, wires, together) => {
    const shapes = new Map(), boxes = {};
    pieces.forEach((p, i) => {
      const cx = (together ? 200 : 700) * i + p.dx, cy = p.dy, o = Array.from({ length: p.n }, (_, k) => [cx + p.rx * Math.cos((2 * Math.PI * k) / p.n), cy + p.ry * Math.sin((2 * Math.PI * k) / p.n)]);
      const xs = o.map((q) => q[0]), ys = o.map((q) => q[1]);
      const box = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
      boxes[names[i]] = box;
      if (!p.box) shapes.set(names[i], { outline: o, middle: [box.x + box.w / 2, box.y + box.h / 2] });
    });
    const html = { names: names.slice(0, pieces.length), boxes, alone: names.slice(0, pieces.length) };
    const found = wires.map(([x, y, bend]) => ({ m: [null, `${names[x % pieces.length]} to ${names[(x + 1 + (y % (pieces.length - 1))) % pieces.length]}${bend}`] }));
    const run = (f) => { try { return { value: f() }; } catch (e) { return { error: e.message }; } };
    const got = run(() => deckBetween(html, found, shapes));
    assert.deepEqual(got, run(() => transforms0.wiresBetween(html, found, { shapes, floor: null, solids: [], routes: null }).between));
    drawn += got.value ? got.value.filter(Boolean).length : 0;
  }), { numRuns: RUNS });
  assert.ok(drawn > RUNS / 2, `straight wires were drawn and compared (${drawn})`);
});

// StoryReel's straight wires and labels (kits/isometric/cables.mjs · layCables, on a map of wires with no way along the
// floor): the tool's composition of the doors, written as the film now writes it.
function reelCables(map) {
  const wires = map.wires, lanes = lanesOf(wires.map((w) => [w.arrow.from.block.name, w.arrow.to.block.name]));
  const middle = (b) => [b.shape.box.x + b.shape.box.w / 2, b.shape.box.y + b.shape.box.h / 2];
  wires.forEach((w, i) => {
    const [A, B] = lanes[i].flip ? [w.arrow.to.block, w.arrow.from.block] : [w.arrow.from.block, w.arrow.to.block];
    const run = straightRun({ middle: middle(A), outline: A.shape.outline }, { middle: middle(B), outline: B.shape.outline }, lanes[i]);
    if (run.why) throw new Error(`${w.who}: ${run.why}`);
    const [a, e] = lanes[i].flip ? [run.end, run.start] : [run.start, run.end];
    const bent = bentWire(a, e, w.arrow.bend, w.head ? CABLE.head * CABLE.headShort : 0), way = curveWay(a, bent.corner, bent.tip);
    w.cable = { points: [a, bent.corner, e], way, length: way.length };
  });
  const runs = wires.map((w) => ({ ...held(walkWay(w.cable.way)), of: w.cable.way })), hides = map.blocks.map((b) => held(b.shape.outline)), looks = { left: CABLE.looks };
  for (const w of wires) {
    if (!w.label) continue;
    w.labelHalf = labelHalf([...w.label].length);
    w.labelAt = labelPlace(w.cable.way, w.labelHalf, hides, runs, looks, w.cable.points.at(-1));
    const [lx, ly] = w.labelAt, [hx, hy] = w.labelHalf;
    hides.push(held([[lx - hx, ly - hy], [lx + hx, ly - hy], [lx + hx, ly + hy], [lx - hx, ly + hy]]));
  }
  return wires.map((w) => ({ points: w.cable.points, length: w.cable.length, mid: w.cable.way.at(0.37), middle: w.cable.way.at(0.5), labelAt: w.labelAt ?? null, labelHalf: w.labelHalf ?? null }));
}

/** A map of blocks on a grid at a film's tile sizes, with straight wires (some labelled), as read.mjs gives it. */
const reelMap = fc.record({
  tile: fc.integer({ min: 64, max: 160 }),
  blocks: fc.array(fc.record({ at: fc.tuple(fc.integer({ min: 0, max: 12 }), fc.integer({ min: 0, max: 8 })), size: fc.tuple(fc.integer({ min: 1, max: 3 }), fc.integer({ min: 1, max: 3 }), fc.constantFrom(0.4, 1, 1.6)), round: fc.boolean() }), { minLength: 2, maxLength: 5 }),
  wires: fc.array(fc.record({ from: fc.nat(4), to: fc.nat(4), bend: fc.constantFrom(0, 30, -40), head: fc.boolean(), label: fc.option(fc.constantFrom('https', 'SQL', 'InvokeAgentRuntime', 'a much longer label here'), { nil: null }) }), { minLength: 1, maxLength: 6 }),
}).map(({ tile, blocks, wires }) => {
  const grid = isometric({ tile, origin: [800, 120] });
  const made = blocks.map((b, i) => {
    const thing = { at: b.at, size: b.round ? [b.size[0], b.size[0], b.size[2]] : b.size };
    if (b.round) { const c = grid.cylinder(thing); return { name: `b${i}`, shape: { box: c.box, outline: build1.roundOutline(c.top, c.bottom) } }; }
    const k = grid.block(thing);
    return { name: `b${i}`, shape: { box: k.box, outline: k.outline.map(({ x, y }) => [x, y]) } };
  });
  const lines = wires.map((w, k) => ({ who: `wires[${k}]`, arrow: { from: { block: made[w.from % made.length] }, to: { block: made[w.to % made.length] }, bend: w.bend }, head: w.head, label: w.label, route: null }))
    .filter((w) => w.arrow.from.block !== w.arrow.to.block);
  return { grid, blocks: made, wires: lines };
});

// The film's labels by StoryDeck 0.29.0's rule (the control, cable0), on the cables StoryReel 0.34.0 laid, composed as the
// film now composes them (kits/isometric/cables.mjs · layCables): every block's outline hides, each placed plate hides the
// labels after it, every cable's walk is a run, one budget of looks for the map, the tip the cable's last point.
// WHY StoryDeck's rule and not 0.34.0's own labels: the door is StoryDeck's rule in both tools (the header), and the
// film now asks the door — 0.34.0's labelAt parts from it in the three named ways (the last three tests pin each), so
// holding the labels to 0.34.0 failed whenever a generated map met one (seed 580667364: a plate touching two blocks).
function deckLabels(map) {
  const hides = map.blocks.map((b) => cable0.held(b.shape.outline)), runs = map.wires.map((w) => ({ ...cable0.held(cable0.cableWalk(w.cable.way)), of: w.cable.way })), looks = { left: cable0.LABEL_LOOKS };
  for (const w of map.wires) {
    if (!w.label) continue;
    w.labelHalf = cables1.labelHalf(w.label);
    w.labelAt = cable0.labelPlace(w.cable.way, w.labelHalf, hides, runs, looks, w.cable.points.at(-1));
    const [lx, ly] = w.labelAt, [hx, hy] = w.labelHalf;
    hides.push(cable0.held([[lx - hx, ly - hy], [lx + hx, ly - hy], [lx + hx, ly + hy], [lx - hx, ly + hy]]));
  }
}

test('lanesOf, straightRun, bentWire, curveWay, labelPlace: StoryReel\'s straight wires and their labels, at a film\'s tile sizes', () => {
  let compared = 0;
  fc.assert(fc.property(reelMap, (map) => {
    const copy = () => ({ ...map, wires: map.wires.map((w) => ({ ...w })) });
    let was;
    try { const m = copy(); cables1.layCables(m); deckLabels(m); was = m.wires.map((w) => ({ points: w.cable.points, length: w.cable.length, mid: w.cable.way.at(0.37), labelAt: w.labelAt ?? null, labelHalf: w.labelHalf ?? null })); } catch (e) { was = { error: /too close|share a middle/.test(e.message) }; }
    let got;
    try { got = reelCables(copy()); } catch (e) { got = { error: /close|middle/.test(e.message) }; }
    assert.deepEqual(flat(Array.isArray(got) ? got.map(({ middle, ...rest }) => rest) : got), flat(was));
    compared += Array.isArray(got) ? got.length : 0;
  }), { numRuns: RUNS });
  assert.ok(compared > RUNS / 4, `wires were laid and compared (${compared})`);
});

test('onStops and seenAt: StoryReel\'s, for any stops and ramps; seenTerms carry StoryDeck\'s CSS rule (seenOf)', () => {
  const stops = fc.array(fc.tuple(fc.double({ min: 0, max: 1, noNaN: true }), fc.double({ min: -1, max: 2, noNaN: true })), { minLength: 1, maxLength: 12 }).map((s) => s.sort((a, b) => a[0] - b[0]));
  fc.assert(fc.property(stops, fc.double({ min: -0.5, max: 1.5, noNaN: true }), (s, u) => assert.equal(onStops(s, u), ride1.onStops(s, u))), { numRuns: RUNS });
  const share = fc.double({ min: 0, max: 1, noNaN: true }), ramp = fc.tuple(share, share, share, share).map((r) => r.sort((a, b) => a - b));
  const ramps = fc.array(fc.oneof(ramp, ramp.map(([, , c, d]) => [0, 0, c, d]), ramp.map(([a, b]) => [a, b, 1, 1]), fc.constant([0, 0, 1, 1])), { maxLength: 4 });
  fc.assert(fc.property(ramps, fc.double({ min: -0.2, max: 1.2, noNaN: true }), (r, p) => assert.equal(seenAt(r, p), ride1.seenAt(r, p))), { numRuns: RUNS });
  // the deck words each term as CSS on --sd-t, exactly as its seenOf did (deck/rides.js): the terms are what it needs
  const short = rides0.short, STEP = 10000;
  const seenOf = (r, pad = '', leads = [null, null]) => {
    const t = 'var(--sd-t)', less = pad ? ` - ${pad}` : '';
    const each = seenTerms(r).map((terms) => {
      const css = terms.map(({ from, to, falling }) => (falling ? `(${short(to, 5)} - ${t}${less}) * ${short(1 / (to - from), 2)}` : `(${t} - ${short(from, 5)}${less}) * ${short(1 / (to - from), 2)}`));
      return css.length ? `clamp(0, ${css.length > 1 ? `max(${css.join(', ')})` : css[0]}, 1)` : '0';
    });
    if (leads[0] !== null) each.push(`clamp(0, (${t} - ${short(leads[0], 5)}) * ${STEP}, 1)`);
    if (leads[1] !== null) each.push(`clamp(0, (${short(leads[1], 5)} - ${t}) * ${STEP}, 1)`);
    return each.length > 1 ? `min(${each.join(', ')})` : each[0] ?? '';
  };
  fc.assert(fc.property(ramps, fc.constantFrom('', '0.01 / var(--sd-keep)'), fc.tuple(fc.option(share, { nil: null }), fc.option(share, { nil: null })), (r, pad, leads) => assert.equal(seenOf(r, pad, leads), rides0.seenOf(r, pad, leads))), { numRuns: RUNS });
});

test('the one difference, named: a hiding outline with no point within 200 px of the label is asked here (StoryDeck\'s rule), passed over by StoryReel 0.34.0\'s copy', () => {
  // a block 400 px wide and 600 tall standing over the middle of a 600 px cable: its corners are all more than 200 px
  // (and the plate's half) from the label at the middle, though its face covers it
  const block = [[100, -300], [500, -300], [500, 300], [100, 300]];
  const map = { grid: { at: (c, r) => ({ x: c * 120, y: r * 120 }) }, blocks: [{ name: 'tall', shape: { box: { x: 100, y: -300, w: 400, h: 600 }, outline: block } }],
    wires: [{ who: 'w', label: 'https', head: false, arrow: { from: { block: { at: [0, 0, 0] } } }, route: { points: [[0, 0], [5, 0]], path: [[0, 0, 0], [5, 0, 0]], ports: [null, null], feet: ['right', 'left'], unseen: [] } }] };
  cables1.layCables(map);   // StoryReel's labelAt is private: asked through layCables, a wire whose cable runs 6 to 594 px
  const way = rounded([[6, 0], [594, 0]], CABLE.corner * 120), args = [way, labelHalf(5), [held(block)], [], { left: CABLE.looks }, [594, 0]];
  const here = labelPlace(...args);
  assert.deepEqual(here, cable0.labelPlace(way, labelHalf(5), [cable0.held(block)], [], { left: CABLE.looks }, [594, 0]), 'StoryDeck\'s answer');
  assert.deepEqual(flat(map.wires[0].labelAt), [300, 0], 'StoryReel 0.34.0 left the label at the middle, under the block');
  assert.ok(Math.abs(here[0] - 300) > 100, `here it moves to where the least of it is hidden, at the block's edge (${here})`);
});

test('the second difference, named: a busy map no longer runs out of looks — StoryReel 0.34.0\'s copy charged far more, and dropped every later label to its cable\'s middle', () => {
  // 48 blocks on an 8 × 6 lattice, 160 labelled wires between them (drawn straight here: the kit test has no router step)
  const grid = isometric({ tile: 64, origin: [800, 60] });
  const blocks = Array.from({ length: 48 }, (_, k) => { const b = grid.block({ at: [(k % 8) * 4, Math.floor(k / 8) * 4], size: [1.5, 1.5, 1] }); return { name: `n${k}`, shape: { box: b.box, outline: b.outline.map(({ x, y }) => [x, y]) } }; });
  const wiresOf = () => Array.from({ length: 160 }, (_, k) => { const a = k % 48; let b = (7 * k + 5) % 48; if (b === a) b = (k + 1) % 48; return { who: `wires[${k}]`, label: 'API gateway', head: true, route: null, arrow: { from: { block: blocks[a] }, to: { block: blocks[b] }, bend: 0 } }; });
  const was = { grid, blocks, wires: wiresOf() };
  cables1.layCables(was);
  const got = reelCables({ grid, blocks, wires: wiresOf() });
  const atMiddle = (list) => list.filter(([at, mid]) => JSON.stringify(at) === JSON.stringify(mid)).length;
  const late = (k) => k >= 120;
  assert.equal(atMiddle(was.wires.filter((_, k) => late(k)).map((w) => [w.labelAt, w.cable.way.at(0.5)])), 40, '0.34.0: every label from wire 120 on fell to its cable\'s middle (its looks were spent)');
  assert.ok(atMiddle(got.filter((_, k) => late(k)).map((w) => [w.labelAt, w.middle])) < 10, 'here they are placed by the rule');
  assert.deepEqual(flat(got.slice(0, 30).map((w) => w.labelAt)), flat(was.wires.slice(0, 30).map((w) => w.labelAt)), 'the first labels, before 0.34.0 ran short, stand where they stood');
});

test('the third difference, named: a plate that only touches a block\'s edge is not hidden here (StoryDeck\'s rule), hidden by StoryReel 0.34.0\'s copy (fast-check seed 580667364)', () => {
  // tile 68: "https" is a plate 68 px wide, and the cable's middle stands exactly between two blocks, the plate's left
  // edge on one's right side (x 800) and its right edge on the other's left side (x 868)
  const grid = isometric({ tile: 68, origin: [800, 120] });
  const blockOf = (name, at, size) => { const k = grid.block({ at, size }); return { name, shape: { box: k.box, outline: k.outline.map(({ x, y }) => [x, y]) } }; };
  const b0 = blockOf('b0', [6, 2], [1, 2, 1.6]), b2 = blockOf('b2', [2, 4], [2, 1, 0.4]);
  const mapOf = () => ({ grid, blocks: [b0, b2], wires: [{ who: 'wires[0]', label: 'https', head: false, route: null, arrow: { from: { block: b0 }, to: { block: b2 }, bend: 0 } }] });
  assert.deepEqual([b0.shape.box.x, b2.shape.box.x + b2.shape.box.w], [868, 800]);
  const [got] = reelCables(mapOf());
  assert.deepEqual(flat(got.labelAt), flat(got.middle), 'here the label stands at its cable\'s middle');
  assert.deepEqual(flat(got.labelAt), [834, 243.679337186343]);
  assert.deepEqual([got.labelAt[0] - got.labelHalf[0], got.labelAt[0] + got.labelHalf[0]], [800, 868], 'its plate fills the gap, under neither block');
  const deck = mapOf(); cables1.layCables(deck); deckLabels(deck);
  assert.deepEqual(flat(deck.wires[0].labelAt), flat(got.labelAt), 'StoryDeck\'s answer');
  const was = mapOf(); cables1.layCables(was);
  assert.deepEqual(flat(was.wires[0].labelAt), [839.6016837970961, 243.9763979255641], 'StoryReel 0.34.0 counted the plate\'s right edge, on b0\'s left side, as hidden and moved on');
  assert.ok(was.wires[0].labelAt[0] + was.wires[0].labelHalf[0] > 868, 'to a place where its plate really is under b0');
});
