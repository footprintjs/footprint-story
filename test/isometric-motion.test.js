// Moving pieces on an isometric floor (0.32.0, src/isometric/standing.js, footing.js, sweep.js, onFrame.js, cover.js):
// a foot and a top, the top a block lands on, the rider rule, a foot worked back from a sample, the swept pass-through,
// a point off the frame, a name's box and which resting block hides it. Each rule once, as StoryReel 0.44.0 and
// StoryDeck 0.37.0 each held it; the two places their copies differed are pinned here with the case that decides them.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isometric, footOf, topOf, cornerOf, landingUnder, overTop, ridesOn, SAME_PLACE, footTiles, sideFoot, worldPx, LEVEL_SNAP,
  sweptThrough, checkMoments, deepestPass, passFinding, THROUGH_MOST, CHECKS_PER_SECOND, MOST_CHECKS, offFrame, drawnOff, posed,
  nameBox, overlapsBox, orderAt, hiddenNames, coverFinding, NAME_WIDTH,
} from '../isometric.js';
import { planMove, sampleMove } from '../human.js';

const close = (a, b, tol = 1e-6) => a.forEach((v, i) => assert.ok(Math.abs(v - b[i]) <= tol, `${a} against ${b}`));
const server = { name: 'server', size: [2, 2, 1.4] }, box = { name: 'box', size: [1, 1, 1] };

test('a foot, a top and a corner, each from the other; a corner of two numbers stands on the floor', () => {
  assert.deepEqual(footOf([1, 2, 3], [2, 2, 1]), [2, 3, 3]);
  assert.deepEqual(footOf([1, 2], [2, 2, 1]), [2, 3, 0]);
  assert.deepEqual(topOf([1, 2], [2, 2, 1.5]), [2, 3, 1.5]);
  assert.deepEqual(cornerOf([2, 3, 3], [2, 2, 1]), [1, 2, 3]);
  assert.deepEqual(cornerOf(footOf([0.25, 7, 2], server.size), server.size), [0.25, 7, 2]);
  assert.throws(() => footOf([1], [1, 1, 1]), /isometric: footOf's at is \[col, row\] or \[col, row, lift\], in tiles — not \[1\]/);
  assert.throws(() => topOf([0, 0], [0, 1, 1]), /topOf's size is \[wide, deep, high\] with wide and deep above 0/);
  assert.throws(() => cornerOf([0, 0, NaN], [1, 1, 1]), /cornerOf's foot/);
});

test('lands on the highest top under it that is not above it, else the floor; edge to edge is not on it; of two alike the first', () => {
  const low = { name: 'low', size: [4, 4, 0.5] }, under = [{ block: server, at: [0, 0, 0] }, { block: low, at: [0, 0] }];
  assert.deepEqual(landingUnder([0.5, 0.5, 3], box.size, under), { lift: 1.4, block: server, at: [0, 0, 0] });
  assert.equal(landingUnder([0.5, 0.5, 1], box.size, under).block, low, 'the server\'s top is above its foot');
  assert.equal(landingUnder([0.5, 0.5, 1.4 + SAME_PLACE / 2], box.size, under).block, server, 'a top within SAME_PLACE above the foot holds it');
  assert.deepEqual(landingUnder([5, 5, 3], box.size, under), { lift: 0, block: null, at: null });
  assert.equal(landingUnder([2, 0, 3], box.size, [{ block: server, at: [0, 0, 0] }]).block, null, 'beside the server, edge to edge: the floor');
  assert.equal(landingUnder([2 - 2 * SAME_PLACE, 0, 3], box.size, [{ block: server, at: [0, 0, 0] }]).block, server, 'two millionths over its edge: on it');
  const twin = { name: 'twin', size: [2, 2, 1.4] };
  assert.equal(landingUnder([0.5, 0.5, 3], box.size, [{ block: server, at: [0, 0] }, { block: twin, at: [1, 0] }]).block, server);
  assert.equal(landingUnder([0.5, 0.5, 3], box.size, [{ block: { name: 'flat', size: [4, 4, 0] }, at: [0, 0] }]).block, null, 'a flat thing on the floor is the floor\'s height');
  assert.throws(() => landingUnder([0, 0], box.size, 'others'), /landingUnder's others is a list of \{block, at\}/);
  assert.throws(() => landingUnder([0, 0], box.size, [null]), /landingUnder's others\[0\] is \{block: \{size\}, at/);
  assert.throws(() => landingUnder([0, 0], box.size, [{ block: 3, at: [0, 0] }]), /others\[0\]'s block is an object with a size/);
  assert.throws(() => landingUnder([0, 0], box.size, [{ block: { size: [1, 1] }, at: [0, 0] }]), /others\[0\]'s block's size/);
  assert.throws(() => landingUnder([0, 0], box.size, [{ block: { get size() { return [1, 1, 1]; } }, at: [0, 0] }]), /block's size/, 'a getter is code, never run');
});

test('a foot is over its top when its middle is, edges included; the floor holds everywhere', () => {
  const on = { block: server, at: [0, 0, 0] };
  assert.equal(overTop([1, 1], on), true);
  assert.equal(overTop([2, 2], on), true, 'on the edge');
  assert.equal(overTop([2 + SAME_PLACE / 2, 1], on), true);
  assert.equal(overTop([2.5, 1], on), false, 'its middle past the edge would tip it off');
  assert.equal(overTop([9, 9], { block: null, at: null }), true);
  assert.throws(() => overTop([0, 0], null), /overTop's under is what landingUnder gives/);
});

test('the rider rule: a block rests on another when it overlaps its top and stands at its height', () => {
  const base = { block: server, at: [0, 0, 0] };
  assert.equal(ridesOn({ block: box, at: [0.5, 0.5, 1.4] }, base), true);
  assert.equal(ridesOn({ block: box, at: [0.5, 0.5, 1.4 + SAME_PLACE / 2] }, base), true, 'within SAME_PLACE of the top');
  assert.equal(ridesOn({ block: box, at: [0.5, 0.5, 2] }, base), false, 'in the air above it');
  assert.equal(ridesOn({ block: box, at: [0.5, 0.5, 1] }, base), false, 'lower than its top: inside it, not on it');
  assert.equal(ridesOn({ block: box, at: [2, 0.5, 1.4] }, base), false, 'beside it at its height, edge to edge');
  assert.equal(ridesOn({ block: box, at: [1.8, 0.5, 1.4] }, base), true, 'its middle past the edge still rests there until it tips: the tool refuses moving the base');
  assert.equal(ridesOn({ block: box, at: [0.5, 0.5, 2.4] }, { block: server, at: [0, 0, 1] }), true, 'a base standing on another block');
  assert.throws(() => ridesOn({ block: box }, base), /ridesOn's rider's at/);
});

test('says how far off the frame a point lies, in whole px at least; a drawn block\'s outline is said before its rope', () => {
  assert.equal(offFrame([10, 10], [100, 50]), null);
  assert.equal(offFrame([100, 50], [100, 50]), null, 'the edge is on it');
  assert.equal(offFrame([-0.2, 60], [100, 50]), '1 px to the left and 10 px below');
  assert.equal(offFrame([130, -4], [100, 50]), '30 px to the right and 4 px above');
  assert.equal(offFrame([1834, 0], [1600, 900]), '234 px to the right');
  assert.throws(() => offFrame([0, 0], [0, 10]), /offFrame's frame is \[width, height\] in pixels, both above 0/);
  assert.throws(() => offFrame([0, NaN], [10, 10]), /offFrame's point/);
  const frame = [100, 100], inside = [[10, 10], [20, 10], [20, 20]];
  assert.equal(drawnOff(inside, [], frame), null);
  assert.equal(drawnOff(inside, null, frame), null);
  assert.deepEqual(drawnOff(inside, [[50, -7]], frame), { part: 'rope', off: '7 px above' });
  assert.deepEqual(drawnOff([[10, 10], [130, 10]], [[50, -7]], frame), { part: 'block', off: '30 px to the right' });
});

test('a point of a block where its pose puts it: scaled about the pivot, then moved', () => {
  assert.deepEqual(posed([10, 20], { dx: 1, dy: 2, pivot: [0, 0], sx: 2, sy: 0.5 }), [21, 12]);
  assert.deepEqual(posed([10, 20], { dx: 1, dy: 2, pivot: [5, 5] }), [11, 22], 'no squash: sx and sy are 1');
  assert.throws(() => posed([0, 0], null), /posed's pose is \{dx, dy, pivot/);
  assert.throws(() => posed([0, 0], { dx: 'a', dy: 0, pivot: [0, 0] }), /posed's pose has dx, dy/);
});

test('a foot worked back from where it is drawn projects to exactly that point, on the move\'s way', () => {
  const grid = isometric({ tile: 100, origin: [800, 150] }), at = footTiles(grid), px = (t) => { const p = grid.at(t[0], t[1], t[2]); return [p.x, p.y]; };
  const move = { from: [1, 5, 0], to: [6, 2, 0] };
  for (const share of [0, 0.3, 0.5, 1]) for (const lift of [0, 0.7, 3]) {
    const truth = [1 + share * 5, 5 - share * 3, lift], back = at(px(truth), move, 0.123);
    close(back, truth);
  }
  // both ends on one line of places (one col − row): the share of the move's time says where along it
  const straight = { from: [1, 1], to: [4, 4] };
  close(at(px([2.5, 2.5, 1]), straight, 0.5), [2.5, 2.5, 1]);
  close(at(px([1, 1, 0]), { from: [1, 1, 0], to: [1, 1, 3] }, 0.25), [1, 1, 0]);   // a fall straight down: one line of places, its time says where
  close(at([px([3, 3.8, 0])[0], px([3, 3.8, 0])[1] + 40], move, 0), [3, 3.8, 0]);   // drawn under the floor (a wind-up's dip): on the floor
  assert.throws(() => at([0, 0], straight, 2), /footTiles' share is how far through its time the move is, 0 to 1/);
  assert.throws(() => at([0, 0], null, 0), /footTiles' move is \{from, to\}/);
  assert.throws(() => footTiles(null), /footTiles takes a grid, \{tile, origin, rise\}/);
  close(footTiles({ tile: [100, 50], origin: [800, 150] })(px([2, 3, 1]), { from: [2, 3], to: [2, 3] }, 0), [2, 3, 1]);   // a grid as plain numbers, rebuilt
  close([worldPx(grid)], [100 / Math.SQRT2]);
});

test('a side-on sample lies back on the floor along its way: its tie point\'s offset taken off, a level within a billionth snapped, the floor the least', () => {
  const unit = 84.8528137423857, way = { origin: [1, 2], heading: [0.6, 0.8], unit, levels: [0, 1.5] };
  close(sideFoot(way, { x: 2 * unit, y: -0.5 * unit }), [2.2, 3.6, 0.5]);
  assert.deepEqual(sideFoot(way, { x: 0, y: -1.5 * unit * (1 + LEVEL_SNAP / 10) }), [1, 2, 1.5], 'a hair over a level is that level exactly');
  assert.equal(sideFoot(way, { x: 0, y: 30 })[2], 0, 'under the floor is the floor');
  assert.ok(!Object.is(sideFoot({ ...way, levels: [] }, { x: 0, y: 0 })[2], -0), 'never −0');
  // a ball rolled side on: its tie point is its middle, a radius over its foot (StoryReel's offset; StoryDeck's slide has none)
  const ball = { ...way, offset: 0.5 }, rolled = planMove({ do: 'roll', from: [0, -unit * 0.5], to: [unit * 3, -unit * 0.5], radius: unit * 0.5, shape: 'ball', plane: 'side' });
  const end = sampleMove(rolled, rolled.plan.seconds);
  close(sideFoot(ball, end), [1 + 3 * 0.6, 2 + 3 * 0.8, 0]);
  close([sideFoot(way, end)[2]], [0.5], 1e-9);   // without the offset the ball would ride a radius up in the air
  assert.throws(() => sideFoot({ ...way, unit: 0 }, { x: 0, y: 0 }), /sideFoot's unit is the world's px in a tile/);
  assert.throws(() => sideFoot({ ...way, offset: 'r' }, { x: 0, y: 0 }), /sideFoot's offset/);
  assert.throws(() => sideFoot(way, { x: 0 }), /sideFoot's sample is \{x, y\}/);
  assert.throws(() => sideFoot(null, { x: 0, y: 0 }), /sideFoot's side is/);
});

test('sweeps a straight stretch, so a thin block between two samples is found, at its deepest', () => {
  const wall = { block: { name: 'wall', size: [0.1, 3, 1] }, from: [5, 0, 0], to: [5, 0, 0] };
  const hit = sweptThrough([1, 1, 1], [0, 1, 0], [10, 1, 0], [wall]);
  assert.equal(hit.block.name, 'wall');
  close([hit.depth], [0.1]);
  assert.ok(hit.share > 0.39 && hit.share < 0.51);
  assert.equal(sweptThrough([1, 1, 1], [0, 5, 0], [10, 5, 0], [wall]), null, 'apart all along');
  assert.equal(sweptThrough([1, 1, 1], [0, 1, 1], [10, 1, 1], [wall]), null, 'resting on its height: touching is no pass');
  assert.equal(sweptThrough([1, 1, 1], [0, 0, 1], [0, 0, 1], [{ block: box, from: [0, 0, 0], to: [0, 0, 0] }]), null, 'resting on a top');
  // both moving: two blocks crossing head on meet in the middle of the stretch, wholly
  const oncoming = { block: { name: 'cart', size: [1, 1, 1] }, from: [10, 0, 0], to: [0, 0, 0] };
  const met = sweptThrough([1, 1, 1], [0, 0, 0], [10, 0, 0], [oncoming]);
  close([met.depth, met.share], [1, 0.5]);
  // of several, the deepest; past THROUGH_MOST only
  const thin = { block: { name: 'thin', size: [THROUGH_MOST, 3, 1] }, from: [3, 0, 0], to: [3, 0, 0] };
  assert.equal(sweptThrough([1, 1, 1], [0, 1, 0], [10, 1, 0], [thin]), null, 'no deeper than THROUGH_MOST: no pass');
  assert.equal(sweptThrough([1, 1, 1], [0, 1, 0], [10, 1, 0], [thin, wall]).block.name, 'wall');
  // deepest at an end of the stretch
  close([sweptThrough([1, 1, 1], [0, 0, 0], [0.5, 0, 0], [{ block: box, from: [1, 0, 0], to: [1, 0, 0] }]).share], [1]);
  assert.equal(THROUGH_MOST, 0.05);
  assert.throws(() => sweptThrough([1, 1, 1], [0, 0], [1, 0], {}), /sweptThrough's others is a list of \{block, from, to\}/);
  assert.throws(() => sweptThrough([1, 1, 1], [0, 0], [1, 0], [{ block: box, from: [0, 0] }]), /others\[0\]'s to/);
  assert.throws(() => sweptThrough([1, 1, 1], [0, 0], [1, 0], [{ block: null }]), /others\[0\]'s block is an object/);
  assert.throws(() => sweptThrough([1, 1, 1], [0, 0], [1, 0], [7]), /others\[0\] is \{block: \{size\}, from, to\}/);
});

test('a move is checked at its ends and 30 times a second between, 2 to 900 steps, from its start', () => {
  assert.deepEqual(checkMoments(0.01), [0, 0.005, 0.01]);
  assert.equal(checkMoments(1).length, CHECKS_PER_SECOND + 1);
  assert.equal(checkMoments(45).length, MOST_CHECKS + 1);
  const late = checkMoments(1, 2.5);
  assert.equal(late[0], 2.5); assert.equal(late.at(-1), 3.5);
  assert.throws(() => checkMoments(0), /checkMoments' seconds is how long the move takes, above 0/);
  assert.throws(() => checkMoments(1, 'now'), /checkMoments' start/);
});

test('the deepest pass over a move\'s stretches, when it is, and the finding in words free of any tool', () => {
  const wall = { block: { name: 'wall', size: [0.2, 3, 1] }, from: [5, 0, 0], to: [5, 0, 0] };
  const stretches = [
    { t0: 0, t1: 0.5, size: [1, 1, 1], from: [0, 1, 0], to: [3, 1, 0], others: [wall] },
    { t0: 0.5, t1: 1, size: [1, 1, 1], from: [3, 1, 0], to: [10, 1, 0], others: [wall] },
  ];
  const hit = deepestPass(stretches);
  assert.equal(hit.block, wall.block);
  close([hit.depth], [0.2]);
  assert.ok(hit.t > 0.5 && hit.t < 1);
  assert.equal(deepestPass([]), null);
  assert.equal(deepestPass([{ ...stretches[0], others: [] }]), null);
  assert.throws(() => deepestPass({}), /deepestPass takes a list of stretches/);
  assert.throws(() => deepestPass([null]), /deepestPass's stretches\[0\] is/);
  assert.throws(() => deepestPass([{ ...stretches[0], t1: -1 }]), /t1 not before t0/);
  const said = passFinding({ block: { name: 'wall' }, depth: 0.2004, t: 0.71428 }, { do: 'settle', tie: 'foot' });
  assert.deepEqual(said, { critic: 'contact', level: 'warn', message: 'at 0.714 s it goes 0.2 tiles into "wall" — it passes through a block', fix: 'move it round "wall": a place clear of it, or throw it over' });
  assert.equal(passFinding(hit, { do: 'hang', tie: 'top' }).fix, 'move "wall" out of its swing, or move its pin so it swings clear');
  assert.equal(passFinding(hit, { do: 'tumble' }).fix, 'tumble it to a place clear of "wall", or move "wall" out of its way');
  assert.match(passFinding({ block: {}, depth: 1, t: 0 }, {}).message, /into "a block"/);
  assert.match(passFinding({ block: null, depth: 1, t: 0 }, {}).message, /into "a block"/);
  for (const words of [said.message, said.fix]) assert.doesNotMatch(words, /reel|deck|data-|do: /);
  assert.throws(() => passFinding(null, {}), /passFinding's hit/);
  assert.throws(() => passFinding(hit, null), /passFinding's move/);
});

test('a name\'s box holds the widest letters of any font, font-free: 1.2 of the size a letter — "MW", "WWW", a full-width "Ｗ"', () => {
  const size = 26;
  for (const word of ['MW', 'WWW', 'Ｗ']) {
    const [x0, y0, x1, y1] = nameBox({ lines: [word], size }, null, [100, 100]);
    close([x1 - x0, y1 - y0], [[...word].length * size * 1.2, size * 1.15]);
    assert.ok(x1 - x0 >= [...word].length * size * 1.03, `"${word}": wider than DejaVu Sans Bold draws its widest letter (1.03 em)`);
  }
  close([nameBox({ lines: ['Ｗ'], size: 10 }, null, [0, 0])[2]], [6], 1e-12);   // one code point, one full-width letter
  assert.equal(NAME_WIDTH, 1.2);
  const [x0, y0, x1, y1] = nameBox({ lines: ['Server'], size: 26 }, { text: 'an API', size: 18 }, [100, 100]);
  close([x1 - x0, y1 - y0, (x0 + x1) / 2, (y0 + y1) / 2], [6 * 26 * 1.2, 26 * 1.15 + 18 * 1.15 + 2, 100, 100]);
  close([nameBox({ lines: ['A'], size: 26 }, { text: 'a much longer small line', size: 18 }, [0, 0])[2]], [(24 * 18 * 1.2) / 2]);
  close([nameBox({ lines: ['Load', 'Balancer'], size: 20 }, null, [0, 0])[3] * 2], [2 * 20 * 1.15]);
  assert.deepEqual(nameBox({ lines: ['A'], size: 10 }, { text: '', size: 18 }, [0, 0]), nameBox({ lines: ['A'], size: 10 }, null, [0, 0]), 'an empty small line takes no room');
  assert.equal(nameBox({ lines: [] }, null, [0, 0]), null);
  assert.equal(nameBox({}, null, [0, 0]), null);
  assert.throws(() => nameBox(null, null, [0, 0]), /nameBox's name is \{lines, size\}/);
  assert.throws(() => nameBox({ lines: [3] }, null, [0, 0]), /nameBox's name's lines is a list of words/);
  assert.throws(() => nameBox({ lines: ['A'], size: 0 }, null, [0, 0]), /nameBox's name's size/);
  assert.throws(() => nameBox({ lines: ['A'], size: 10 }, { text: 'x' }, [0, 0]), /nameBox's small is null, or \{text, size\}/);
});

test('whether a convex outline and a box overlap: bounds, then the outline\'s sides, either way round', () => {
  const square = [[0, 0], [10, 0], [10, 10], [0, 10]], diamond = [[5, 0], [10, 5], [5, 10], [0, 5]];
  assert.equal(overlapsBox(square, [5, 5, 20, 20]), true);
  assert.equal(overlapsBox(square, [10, 0, 20, 5]), false, 'a shared edge is no overlap');
  assert.equal(overlapsBox(square, [11, 0, 20, 5]), false);
  assert.equal(overlapsBox(diamond, [0, 0, 2, 2]), false, 'inside its bounds, beyond one of its sides');
  assert.equal(overlapsBox([...diamond].reverse(), [0, 0, 2, 2]), false, 'the other way round');
  assert.equal(overlapsBox(diamond, [4, 4, 6, 6]), true);
  assert.equal(overlapsBox([], [0, 0, 1, 1]), false);
  assert.throws(() => overlapsBox(square, [5, 5, 1, 1]), /overlapsBox's box is \[x0, y0, x1, y1\] with x0 ≤ x1/);
  assert.throws(() => overlapsBox('square', [0, 0, 1, 1]), /overlapsBox's points/);
});

test('the paint order at a moment is grid.backToFront of every piece, by index', () => {
  const grid = isometric({ tile: 100, origin: [800, 150] }), things = [{ at: [4, 3], size: [1, 1, 1] }, { at: [2, 1], size: [2, 2, 1.5] }, { at: [0, 6], size: [1, 1, 1] }];
  assert.deepEqual(orderAt(grid, things), grid.backToFront(things.map((_, i) => i), (i) => things[i]));
  assert.deepEqual(orderAt(grid, things).map((i) => things[i]), grid.backToFront(things));
  assert.throws(() => orderAt(grid, null), /orderAt's things is a list of \{at, size\}/);
  assert.throws(() => orderAt({}, things), /orderAt: a grid's tile/);
});

test('a resting block hides a name when its outline meets the name\'s box and it is painted after the named block', () => {
  const grid = isometric({ tile: 100, origin: [800, 150] }), outline = (t) => grid.block(t).outline.map((p) => [p.x, p.y]);
  const server1 = { at: [2, 2], size: [2, 2, 1] }, ball = { at: [2.5, 2.5, 1], size: [1, 1, 0.6] }, far = { at: [9, 0], size: [1, 1, 1] };
  const things = [server1, ball, far], c = grid.block(server1).centre, box1 = nameBox({ lines: ['Server'], size: 24 }, null, [c.x, c.y]);
  assert.deepEqual(hiddenNames(grid, things, [{ piece: 0, box: box1 }], [{ piece: 1, outline: outline(ball) }]), [1], 'a ball come to rest on its top');
  assert.deepEqual(hiddenNames(grid, things, [{ piece: 0, box: box1 }], [{ piece: 2, outline: outline(far) }]), [null], 'far away');
  assert.deepEqual(hiddenNames(grid, things, [{ piece: 0, box: box1 }], [{ piece: 0, outline: outline(server1) }]), [null], 'a block never hides its own name');
  // behind it: a block wholly at smaller rows is painted first, so the name is drawn over it
  const behind = { at: [2, 0], size: [2, 1, 3] };
  assert.deepEqual(hiddenNames(grid, [server1, behind], [{ piece: 0, box: box1 }], [{ piece: 1, outline: outline(behind) }]), [null]);
  assert.deepEqual(hiddenNames(grid, things, [], []), []);
  assert.throws(() => hiddenNames(grid, things, [{ piece: 3, box: box1 }], []), /names\[0\]\.piece is the index of a thing in things, 0 to 2/);
  assert.throws(() => hiddenNames(grid, things, [{ piece: 0, box: box1 }], [{ piece: 1 }]), /covers\[0\]\.outline/);
  assert.throws(() => hiddenNames(grid, null, [], []), /hiddenNames' things/);
  assert.throws(() => hiddenNames(grid, things, null, []), /hiddenNames' names/);
  assert.throws(() => hiddenNames(grid, things, [], null), /hiddenNames' covers/);
  const said = coverFinding('server', 'Server');
  assert.deepEqual(said, { critic: 'covers', level: 'warn', message: 'it comes to rest over "server"\'s name ("Server"), which is hidden from then', fix: 'land it clear of the name (a place beside "server", or a corner of its top), or accept it when it is meant' });
  assert.throws(() => coverFinding('server'), /coverFinding takes the block's name and its words/);
});

// THE DIFFERENCE. StoryReel 0.44.0 (motion-cover.mjs · coversOf) asked grid.backToFront of the TWO blocks alone whether
// the resting one is in front of the named one; StoryDeck 0.37.0 (motionPlan.js · coversOf, isoSpec.js · orderAt) asked
// the order of EVERY piece. Both tools PAINT by the order of every piece (StoryReel's index.mjs · movedAt, StoryDeck's
// motionDraw.js), so only the deck's question matches the picture: two blocks that do not meet on the frame get no rule
// between them, and are ordered only through the pieces between. Here a block wholly at smaller rows than the named one
// is painted before it (through a third), so the name is drawn over it — StoryReel's two-block order said it hid it.
test('which block hides a name is read from the paint order of every piece, as both tools paint — not of the two alone', () => {
  const grid = isometric({ tile: 100, origin: [800, 150] }), outline = (t) => grid.block(t).outline.map((p) => [p.x, p.y]);
  const named = { at: [5, 5, 0], size: [1, 2, 1] }, resting = { at: [5, 3, 0], size: [3, 1, 2] }, third = { at: [2, 3, 0], size: [2, 1, 2] };
  const c = grid.block(named).centre, label = nameBox({ lines: ['Payments'], size: 24 }, null, [c.x, c.y]);
  assert.equal(overlapsBox(outline(resting), label), true, 'the resting block\'s outline meets the name\'s box');
  assert.deepEqual(grid.backToFront([named, resting]), [named, resting], 'the two alone: no rule between them, so the order given — the resting one after');
  assert.deepEqual(orderAt(grid, [named, resting, third]), [1, 2, 0], 'every piece: the resting one first, the named one last');
  assert.deepEqual(hiddenNames(grid, [named, resting, third], [{ piece: 0, box: label }], [{ piece: 1, outline: outline(resting) }]), [null], 'so the name is drawn over it: not hidden');
  assert.deepEqual(hiddenNames(grid, [named, resting], [{ piece: 0, box: label }], [{ piece: 1, outline: outline(resting) }]), [1], 'without the third, painted after it: hidden');
});
