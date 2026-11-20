// The floor under a box of the frame, and whether a way passes through a box (isometric/under.js). The floor is checked
// square by square against a test written apart from the code (a square's diamond against the box, by its corners and
// sampled edges); the reasons a box gets none are answered, not thrown, so a tool says them in its words. Moved from
// StoryDeck 0.27.0 (deck/keepClear.test.js) with the code; `most`, crossesBox's cases and the refusals are new.
import test from 'node:test';
import assert from 'node:assert/strict';
import { crossesBox, floorUnder, isometric, routes, NO_UNDER, MOST_UNDER_SQUARES, UNDER_CELL } from '../isometric.js';

const floor = isometric({ tile: 120, origin: [960, 150] });

for (const lift of [0, 1]) test(`is every square of floor at height ${lift} whose drawn diamond meets the box, joined along a row — checked square by square`, () => {
  const box = { x: 700, y: 520, w: 80, h: 30 }, { stretches, why } = floorUnder(box, floor, { lift });
  assert.equal(why, null);
  // each stretch reaches a hair (0.01 tile) past its squares, so two side by side overlap: read back its squares
  const kept = new Set(stretches.flatMap(({ at: [c, r], size: [w] }) => Array.from({ length: Math.round((w - 0.02) / UNDER_CELL) }, (_, k) => `${+(c + 0.01 + k * UNDER_CELL).toFixed(6)},${+(r + 0.01).toFixed(6)}`)));
  // an independent test of each square near the box: its diamond's four corners and its middle, and the box's corners inside the diamond
  const diamond = (c, r) => [[c, r], [c + UNDER_CELL, r], [c + UNDER_CELL, r + UNDER_CELL], [c, r + UNDER_CELL]].map(([a, b]) => { const p = floor.at(a, b, lift); return [p.x, p.y]; });
  const inside = (pts, [px, py]) => { let s = 0; for (let i = 0; i < 4; i++) { const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % 4]; const c = (bx - ax) * (py - ay) - (by - ay) * (px - ax); if (Math.abs(c) <= 1e-9 || (s && Math.sign(c) !== s)) return false; s = Math.sign(c); } return true; };   // strictly inside: a touch at one point is no meeting
  const crosses = (pts) => pts.some(([px, py]) => px > box.x && px < box.x + box.w && py > box.y && py < box.y + box.h)
    || [[box.x, box.y], [box.x + box.w, box.y], [box.x, box.y + box.h], [box.x + box.w, box.y + box.h]].some((p) => inside(pts, p))
    // an edge of the diamond through the box: sampled
    || pts.some((a, i) => { const b = pts[(i + 1) % 4]; return Array.from({ length: 41 }, (_, k) => [a[0] + (b[0] - a[0]) * k / 40, a[1] + (b[1] - a[1]) * k / 40]).some(([px, py]) => px > box.x && px < box.x + box.w && py > box.y && py < box.y + box.h); });
  for (let c = -4; c < 16; c += UNDER_CELL) for (let r = -4; r < 16; r += UNDER_CELL) assert.equal(kept.has(`${c},${r}`), crosses(diamond(c, r)), `${c},${r}`);
  assert.ok(stretches.length > 0);
  assert.ok(stretches.every(({ at: [, , z], size: [w, d] }) => z === lift && w > 0 && Math.abs(d - UNDER_CELL - 0.02) < 1e-9));
});

test('is routes\' keep as it takes it: a route goes round the floor under words where it can', () => {
  const things = [{ name: 'a', at: [0, 4], size: [2, 2, 0.4] }, { name: 'b', at: [8, 4], size: [2, 2, 0.4] }];
  const [plain] = routes(things, [['a', 'b']]);
  // words over the middle of the straight way
  const mid = floor.at(5, 6.5), box = { x: mid.x - 30, y: mid.y - 12, w: 60, h: 24 };
  const keep = floorUnder(box, floor).stretches.map((s, i) => ({ ...s, name: `w${i}` }));
  const [kept] = routes(things, [['a', 'b']], { keep });
  assert.ok(plain.points && kept.points);
  assert.notDeepEqual(kept.points, plain.points);
  assert.deepEqual(kept.under, []);
  // and whether the way on the frame passes through the box: the plain one does, the kept one does not
  const onFrame = (r) => r.points.map(([c, rw]) => { const p = floor.at(c, rw); return [p.x, p.y]; });
  assert.equal(crossesBox(onFrame(plain), box), true);
  assert.equal(crossesBox(onFrame(kept), box), false);
});

test('answers a box it finds no floor for with the reason, so a tool says it in its own words', () => {
  // counted before any square is looked at: a box many frames wide on a tiny tile is answered at once
  const tiny = isometric({ tile: 4, origin: [960, 150] }), t0 = Date.now();
  const big = floorUnder({ x: 0, y: 0, w: 40000, h: 40000 }, tiny);
  assert.deepEqual([big.stretches, big.why], [null, NO_UNDER.big]);
  assert.ok(big.squares > MOST_UNDER_SQUARES && Number.isFinite(big.squares));
  assert.ok(Date.now() - t0 < 100);
  assert.deepEqual(floorUnder({ x: 2e6, y: 0, w: 10, h: 10 }, floor), { stretches: null, why: NO_UNDER.far, squares: null });
  // lowered to a high floor, a box near the edge of the reach is past it
  assert.equal(floorUnder({ x: 0, y: 999_990, w: 10, h: 5 }, floor, { lift: -1 }).why, null);
  assert.equal(floorUnder({ x: 0, y: 999_990, w: 10, h: 5 }, floor, { lift: 1 }).why, NO_UNDER.far);
  // most: counted as stretches are made, so many boxes sharing a budget stop at it, not after
  const all = floorUnder({ x: 700, y: 520, w: 80, h: 30 }, floor).stretches;
  assert.deepEqual(floorUnder({ x: 700, y: 520, w: 80, h: 30 }, floor, { most: all.length }).stretches, all);
  assert.deepEqual(floorUnder({ x: 700, y: 520, w: 80, h: 30 }, floor, { most: all.length - 1 }), { stretches: null, why: NO_UNDER.most, squares: floorUnder({ x: 700, y: 520, w: 80, h: 30 }, floor).squares });
  assert.ok(Object.isFrozen(NO_UNDER));
});

test('crossesBox: a way through the box, not along its edge, not touching a corner, not beside it', () => {
  const box = { x: 10, y: 10, w: 50, h: 50 };
  assert.equal(crossesBox([[0, 30], [100, 30]], box), true);       // straight through
  assert.equal(crossesBox([[0, 0], [30, 0], [30, 100]], box), true);   // its second stretch
  assert.equal(crossesBox([[0, 10], [100, 10]], box), false);      // along its top edge
  assert.equal(crossesBox([[60, 0], [60, 100]], box), false);      // along its right edge
  assert.equal(crossesBox([[0, 20], [20, 0]], box), false);        // across a corner, outside
  assert.equal(crossesBox([[0, 0], [10, 10], [0, 20]], box), false);   // touching a corner
  assert.equal(crossesBox([[20, 20], [30, 30]], box), true);       // inside it
  assert.equal(crossesBox([[20, 20]], box), false);                // one point is no way
  assert.equal(crossesBox([], box), false);
  assert.equal(crossesBox([[0, 30], [100, 30]], { x: 10, y: 10, w: 0, h: 50 }), false);   // a box with no width has no inside
});

test('every value is read by its own stored value, a grid by its numbers, and a refusal says what to give', () => {
  const refused = (f, words) => assert.throws(f, (e) => e.message.startsWith('isometric: ') && e.message.includes(words), words);
  refused(() => floorUnder({ x: 0, y: 0, w: 0, h: 10 }, floor), 'floorUnder: the box is a box of the frame');
  refused(() => floorUnder([0, 0, 10, 10], floor), 'floorUnder: the box is a box of the frame');
  refused(() => floorUnder({ x: 0, y: 0, w: 10, h: Infinity }, floor), 'w and h above 0');
  refused(() => floorUnder({ x: 0, y: 0, w: 10, h: 10 }, null), 'floorUnder takes a grid');
  refused(() => floorUnder({ x: 0, y: 0, w: 10, h: 10 }, { tile: [60, 120], origin: [0, 0] }), 'a tile is wider than it is tall');
  refused(() => floorUnder({ x: 0, y: 0, w: 10, h: 10 }, floor, { lift: 'up' }), "floorUnder's lift");
  refused(() => floorUnder({ x: 0, y: 0, w: 10, h: 10 }, floor, { most: 1.5 }), "floorUnder's most");
  refused(() => floorUnder({ x: 0, y: 0, w: 10, h: 10 }, floor, 3), "floorUnder's options");
  refused(() => crossesBox('a way', { x: 0, y: 0, w: 1, h: 1 }), 'crossesBox: the way');
  refused(() => crossesBox([[0, 0], [1, 'x']], { x: 0, y: 0, w: 1, h: 1 }), 'point 2 of crossesBox: the way');
  refused(() => crossesBox([[0, 0]], { x: 0, y: 0, w: 1 }), 'crossesBox: the box');
  // a grid is rebuilt from its own numbers: its code is never run, so a grid with its own at() is the grid of its numbers
  let ran = false;
  const odd = { tile: [120, 60], origin: [960, 150], rise: floor.rise, at() { ran = true; return { x: 0, y: 0 }; }, tileAt() { ran = true; return { col: 0, row: 0 }; } };
  assert.deepEqual(floorUnder({ x: 700, y: 520, w: 80, h: 30 }, odd), floorUnder({ x: 700, y: 520, w: 80, h: 30 }, floor));
  const box = { x: 700, y: 520, w: 80, h: 30 };
  Object.defineProperty(box, 'h', { get() { ran = true; return 30; } });
  refused(() => floorUnder(box, floor), 'floorUnder: the box');
  assert.equal(ran, false);
});
