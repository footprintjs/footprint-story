// Moving pieces as properties (0.32.0). First the swept pass-through against two oracles written apart from the code: a
// fine-sampled one (what a check sampling 4000 times a stretch would see) and an exact one (the overlap is piecewise
// linear in the share, so its highest point is at an end or where two of its pieces cross: every crossing is tried).
// For any step however long, a block of side ≥ 0.1 tile entered deeper than THROUGH_MOST is never missed, and the depth
// said is the true one. Then the differential: every rule the door hands out gives what StoryReel 0.44.0's and StoryDeck
// 0.37.0's copies gave (test/control/), where they differ as the CHANGELOG names. FC_RUNS=5000 npm test runs
// a deeper sweep.
import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import * as deck from './control/storydeck-0.37.0-motionPlace.js';
import * as deckPlan from './control/storydeck-0.37.0-motionPlan.js';
import * as reel from './control/storyreel-0.44.0-motion-place.mjs';
import * as reelCover from './control/storyreel-0.44.0-motion-cover.mjs';
import * as reelSide from './control/storyreel-0.44.0-motion-side.mjs';
import {
  isometric, footOf, topOf, cornerOf, landingUnder, overTop, ridesOn, footTiles, sideFoot, worldPx, sweptThrough, checkMoments,
  offFrame, drawnOff, posed, nameBox, overlapsBox, THROUGH_MOST, NAME_WIDTH,
} from '../isometric.js';

const RUNS = Number(process.env.FC_RUNS) || 300;
const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
const tiles = fc.double({ min: -20, max: 20, noNaN: true });
const corner = fc.tuple(tiles, tiles, fc.double({ min: 0, max: 6, noNaN: true }));
const side = (least) => fc.double({ min: least, max: 4, noNaN: true });
const size = (least) => fc.tuple(side(least), side(least), side(least));

/** The overlap of two moving boxes at share u: the least along the three axes, as written in the task, apart from the code. */
const overlapAt = (s, a, z, o, u) => Math.min(...[0, 1, 2].map((k) => {
  const p = a[k] + (z[k] - a[k]) * u, q = o.from[k] + (o.to[k] - o.from[k]) * u;
  return Math.min(p + s[k], q + o.block.size[k]) - Math.max(p, q);
}));
/**
 * Every share where the overlap may peak: its ends, and where two of its linear pieces cross. Along an axis the overlap is
 * the lesser end less the greater start, which is the least of (an end − a start) over the two ends and two starts; so
 * the whole overlap is the least of twelve lines in the share, and its highest point is at an end or where two cross.
 */
function crossings(s, a, z, o) {
  const pieces = [];
  for (let k = 0; k < 3; k += 1) {
    const starts = [[a[k], z[k] - a[k]], [o.from[k], o.to[k] - o.from[k]]], ends = [[a[k] + s[k], z[k] - a[k]], [o.from[k] + o.block.size[k], o.to[k] - o.from[k]]];
    for (const [e0, de] of ends) for (const [b0, db] of starts) pieces.push([e0 - b0, de - db]);
  }
  const us = [0, 1];
  for (const [c0, dc] of pieces) for (const [d0, dd] of pieces) if (dc !== dd) { const u = (d0 - c0) / (dc - dd); if (u > 0 && u < 1) us.push(u); }
  return us;
}

test('the swept test never misses a block of side ≥ 0.1 tile entered past THROUGH_MOST, for any step, and says its true depth', () => {
  fc.assert(fc.property(size(0.1), corner, corner, size(0.1), corner, fc.option(corner, { nil: null }), (s, from, to, otherSize, at, goes) => {
    const other = { block: { name: 'other', size: otherSize }, from: at, to: goes ?? at };
    const hit = sweptThrough(s, from, to, [other]);
    const exact = Math.max(...crossings(s, from, to, other).map((u) => overlapAt(s, from, to, other, u)));
    let sampled = -Infinity;
    for (let k = 0; k <= 4000; k += 1) sampled = Math.max(sampled, overlapAt(s, from, to, other, k / 4000));
    assert.ok(sampled <= exact + 1e-9, 'the exact oracle is the highest');
    if (sampled > THROUGH_MOST + 1e-9) assert.ok(hit, `a pass ${sampled} deep, seen by sampling, is found`);
    if (exact > THROUGH_MOST + 1e-7) {
      assert.ok(hit, `a pass ${exact} deep is found`);
      assert.ok(near(hit.depth, exact, 1e-7), `its depth ${hit.depth} is the true ${exact}`);
      assert.ok(near(overlapAt(s, from, to, other, hit.share), hit.depth, 1e-9), 'at the share it names');
      assert.equal(hit.block, other.block);
    }
    if (exact < THROUGH_MOST - 1e-7) assert.equal(hit, null, 'no pass past THROUGH_MOST: none said');
  }), { numRuns: RUNS });
});

test('a thin block stands wholly between two samples of a fast move, and the sweep still finds it', () => {
  // the case the sweep exists for: a 30-tile reach in one thirtieth of a second, a wall a tenth of a tile thin anywhere on it
  fc.assert(fc.property(fc.double({ min: 0.5, max: 29.5, noNaN: true }), (x) => {
    const wall = { block: { name: 'wall', size: [0.1, 3, 1] }, from: [x, -1, 0], to: [x, -1, 0] };
    const hit = sweptThrough([1, 1, 1], [-1, 0, 0], [30, 0, 0], [wall]);
    assert.ok(hit && near(hit.depth, 0.1, 1e-9));
    assert.equal(sweptThrough([1, 1, 1], [-1, 0, 0], [-1, 0, 0], [wall]) ?? sweptThrough([1, 1, 1], [30, 0, 0], [30, 0, 0], [wall]), null, 'neither sample alone touches it');
  }), { numRuns: RUNS });
});

// ---- the differential: StoryReel 0.44.0 and StoryDeck 0.37.0, copied in test/control/ ----------------------------------

const block = (name) => size(0.2).map((sz) => ({ name, size: sz }));
const standingList = fc.array(fc.tuple(block('b'), corner).map(([b, at]) => ({ block: b, at })), { maxLength: 6 });

test('a foot, a top, a corner, a landing, over a top and the rider rule: what both tools said', () => {
  fc.assert(fc.property(corner, size(0.2), standingList, fc.tuple(tiles, tiles), (at, sz, others, foot) => {
    for (const ctl of [deck, reel]) {
      assert.deepEqual(footOf(at, sz), ctl.footOf(at, sz));
      assert.deepEqual(topOf(at, sz), ctl.topOf(at, sz));
      assert.deepEqual(cornerOf(at, sz), ctl.cornerOf(at, sz));
      const ours = landingUnder(at, sz, others), theirs = ctl.landingUnder(at, sz, others);
      assert.equal(ours.lift, theirs.lift); assert.equal(ours.block, theirs.block); assert.deepEqual(ours.at, theirs.at);
      assert.equal(overTop(foot, ours), ctl.overTop(foot, theirs));
    }
    // the rider rule: StoryDeck's ridesOn(rider, piece, at), StoryReel's same test written inline in placeMoves
    for (const o of others) {
      const base = { block: { name: 'piece', size: sz }, at };
      const reelRides = reel.landingUnder(o.at, o.block.size, [base]).block === base.block && Math.abs(o.at[2] - (at[2] + sz[2])) < 1e-6;
      assert.equal(ridesOn(o, base), deck.ridesOn(o, base.block, at));
      assert.equal(ridesOn(o, base), reelRides);
      const onTop = { block: o.block, at: [o.at[0], o.at[1], at[2] + sz[2]] };
      assert.equal(ridesOn(onTop, base), deck.ridesOn(onTop, base.block, at), 'a rider set at the base\'s height');
    }
  }), { numRuns: RUNS });
});

test('a foot worked back from the frame, and a side-on sample laid on the floor: what both tools said', () => {
  const grid = fc.record({ tile: fc.integer({ min: 40, max: 200 }), x: fc.integer({ min: 0, max: 1600 }), y: fc.integer({ min: 0, max: 900 }) }).map(({ tile, x, y }) => isometric({ tile, origin: [x, y] }));
  const frame = fc.tuple(fc.double({ min: -500, max: 2500, noNaN: true }), fc.double({ min: -500, max: 1500, noNaN: true }));
  fc.assert(fc.property(grid, frame, corner, corner, fc.double({ min: 0, max: 1, noNaN: true }), (g, point, from, to, share) => {
    const ours = footTiles(g)(point, { from, to }, share);
    for (const ctl of [deck, reel]) assert.deepEqual(ours, ctl.footTiles(g)(point, { from, to }, share));
    assert.equal(worldPx(g), reelSide.worldPx(g));
    assert.equal(worldPx(g), g.tile[0] / Math.SQRT2, 'StoryDeck wrote it inline in motionPlan.js · placeMoves');
  }), { numRuns: RUNS });
  const way = fc.record({ origin: fc.tuple(tiles, tiles), heading: fc.double({ min: 0, max: 2 * Math.PI, noNaN: true }).map((a) => [Math.cos(a), Math.sin(a)]), unit: fc.double({ min: 10, max: 200, noNaN: true }), offset: fc.double({ min: 0, max: 2, noNaN: true }), levels: fc.array(fc.double({ min: 0, max: 5, noNaN: true }), { maxLength: 2 }) });
  fc.assert(fc.property(way, fc.record({ x: fc.double({ min: -2000, max: 2000, noNaN: true }), y: fc.double({ min: -1000, max: 500, noNaN: true }) }), (w, sample) => {
    assert.deepEqual(sideFoot(w, sample), reelSide.sideFoot(w, sample));
    // StoryDeck plans only a slide, which has no offset: its sideFoot is ours with the offset 0
    assert.deepEqual(sideFoot({ ...w, offset: 0 }, sample), deckPlan.sideFoot(w, sample));
    assert.deepEqual(sideFoot({ ...w, offset: undefined }, sample), deckPlan.sideFoot(w, sample), 'an offset left out is 0');
  }), { numRuns: RUNS });
});

test('the swept pass-through and the moments a move is checked at: what both tools said', () => {
  const mover = fc.tuple(block('o'), corner, corner).map(([b, f, t]) => ({ block: b, from: f, to: t }));
  fc.assert(fc.property(size(0.2), corner, corner, fc.array(mover, { maxLength: 4 }), (sz, from, to, others) => {
    const ours = sweptThrough(sz, from, to, others);
    for (const ctl of [deck, reel]) assert.deepEqual(ours, ctl.sweptThrough(sz, from, to, others));
  }), { numRuns: RUNS });
  fc.assert(fc.property(fc.double({ min: 1e-3, max: 60, noNaN: true }), fc.double({ min: 0, max: 100, noNaN: true }), (seconds, start) => {
    assert.deepEqual(checkMoments(seconds), deckPlan.checkTimes({ seconds }));
    assert.deepEqual(checkMoments(seconds, start), reelSide.samplesOf({ seconds, start }));
  }), { numRuns: RUNS });
});

test('off the frame, a drawn block off it, and a posed point: what both tools said', () => {
  const px = fc.double({ min: -3000, max: 4000, noNaN: true }), point = fc.tuple(px, px), frame = fc.tuple(fc.integer({ min: 1, max: 4000 }), fc.integer({ min: 1, max: 4000 }));
  fc.assert(fc.property(point, frame, (p, f) => {
    assert.equal(offFrame(p, f), deck.offSlide(p, f));
    assert.equal(offFrame(p, [1600, 900]), reel.offFrame(p), 'StoryReel\'s frame was fixed at 1600 × 900');
  }), { numRuns: RUNS });
  fc.assert(fc.property(fc.array(point, { minLength: 1, maxLength: 8 }), fc.array(point, { maxLength: 4 }), (outline, rope) => {
    assert.deepEqual(drawnOff(outline, rope, [1600, 900]), reel.drawnOff(outline, rope));
  }), { numRuns: RUNS });
  const pose = fc.record({ dx: px, dy: px, pivot: point, sx: fc.double({ min: 0.2, max: 3, noNaN: true }), sy: fc.double({ min: 0.2, max: 3, noNaN: true }) });
  fc.assert(fc.property(point, pose, (p, ps) => { for (const ctl of [deck, reel]) assert.deepEqual(posed(p, ps), ctl.posed(p, ps)); }), { numRuns: RUNS });
});

test('a name\'s box and whether an outline covers it: what both tools said', () => {
  const word = fc.string({ minLength: 1, maxLength: 14, unit: fc.constantFrom('a', 'W', 'M', 'i', ' ', 'Ｗ', 'é', '1') });
  const name = fc.record({ lines: fc.array(word, { minLength: 1, maxLength: 2 }), size: fc.integer({ min: 8, max: 60 }) });
  const centre = fc.tuple(fc.double({ min: 0, max: 1600, noNaN: true }), fc.double({ min: 0, max: 900, noNaN: true }));
  fc.assert(fc.property(name, fc.option(word, { nil: null }), centre, fc.integer({ min: 8, max: 30 }), (n, small, c, smallSize) => {
    const ours = nameBox(n, small === null ? null : { text: small, size: smallSize }, c);
    // StoryDeck: the small line's words as written, at the size the deck draws it
    assert.deepEqual(ours, deck.nameBox(n, small, c, smallSize));
    // StoryReel: the block's fitted name and small line ({lines, size}, drawn joined on one line)
    const reelBlock = { fitted: n, smallFitted: small === null ? null : { lines: small.split(' '), size: smallSize }, shape: { centre: c } };
    const reelBox = reelCover.nameBox(reelBlock);
    ours.forEach((v, i) => assert.ok(near(v, reelBox[i], 1e-12)));
    assert.equal(NAME_WIDTH, reelCover.NAME_WIDTH); assert.equal(NAME_WIDTH, deck.NAME_WIDTH);
  }), { numRuns: RUNS });
  const px = fc.double({ min: 0, max: 400, noNaN: true }), convex = fc.tuple(px, px, fc.double({ min: 5, max: 150, noNaN: true }), fc.integer({ min: 3, max: 8 }), fc.double({ min: 0, max: 6.3, noNaN: true }), fc.boolean())
    .map(([cx, cy, r, n, turn, flip]) => { const pts = Array.from({ length: n }, (_, i) => [cx + r * Math.cos(turn + (2 * Math.PI * i) / n), cy + r * Math.sin(turn + (2 * Math.PI * i) / n)]); return flip ? pts.reverse() : pts; });
  const box = fc.tuple(px, px, fc.double({ min: 0, max: 200, noNaN: true }), fc.double({ min: 0, max: 200, noNaN: true })).map(([x, y, w, h]) => [x, y, x + w, y + h]);
  fc.assert(fc.property(convex, box, (pts, b) => {
    assert.equal(overlapsBox(pts, b), deck.overlapsBox(pts, b));
    assert.equal(overlapsBox(pts, b), reelCover.overlaps(pts, b));
  }), { numRuns: RUNS });
});
