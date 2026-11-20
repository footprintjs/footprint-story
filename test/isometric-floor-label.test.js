// Where a floor's label lies (isometric/floorLabel.js): flat along the floor's near-left edge, sized from the tile,
// broken and shrunk to fit, moved half a tile at a time clear of what stands over the edge, and honest when it does
// not fit or has no clear place. Moved from StoryDeck 0.27.0 (deck/floorLabel.test.js) with the code; the refusals are
// new.
import test from 'node:test';
import assert from 'node:assert/strict';
import { floorLabelPlace, isometric, MOST_COVER_POINTS, MOST_FLOOR_LABEL, MOST_LABEL_LOOKS, MOST_OUTLINE_POINTS } from '../isometric.js';

const floor = isometric({ tile: 120, origin: [960, 150] });
const outline = (c, r, size) => floor.block({ at: [c, r], size }).outline.map(({ x, y }) => [x, y]);
const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} is not ${b}`);

test('lies flat along the floor\'s near-left edge, a little in from its far end, sized from the tile', () => {
  const place = floorLabelPlace({ at: [0, 0], size: [8, 5] }, floor, 'Production account');
  const start = floor.at(0.3, 4.85);
  assert.deepEqual([place.x, place.y], [start.x, start.y]);
  // a line runs along the cols, a line's height toward the far rows: both unit steps of the floor
  const col = [60, 30].map((v) => v / Math.hypot(60, 30));
  assert.deepEqual(place.matrix.map((v) => +v.toFixed(6)), [col[0], col[1], -col[0], col[1]].map((v) => +v.toFixed(6)));
  assert.deepEqual([place.size, place.lines, place.fits, place.covered], [20, ['Production account'], true, false]);
  // a bigger tile, bigger words, up to the most; a smaller one, smaller, down to the least
  assert.equal(floorLabelPlace({ at: [0, 0], size: [8, 5] }, isometric({ tile: 300, origin: [0, 0] }), 'x').size, 28);
  assert.equal(floorLabelPlace({ at: [0, 0], size: [8, 5] }, isometric({ tile: 40, origin: [0, 0] }), 'x').size, 14);
});

test('breaks and shrinks a label too long for the edge, and says when it still does not fit', () => {
  const place = floorLabelPlace({ at: [0, 0], size: [2, 2] }, floor, 'Production account with a long name');
  assert.deepEqual([place.size, place.fits, place.lines.length], [14, false, 2]);
  // two lines deeper than the floor do not fit either, and are said once: as not fitting, never also covered
  const deep = floorLabelPlace({ at: [0, 0], size: [6, 1] }, isometric({ tile: 60, origin: [0, 0] }), 'Shared services network');
  assert.deepEqual([deep.lines.length, deep.fits, deep.covered], [2, false, false]);
  const walled = floorLabelPlace({ at: [0, 0], size: [2, 2] }, floor, 'A name far too long for so small a floor', [outline(0, 0.5, [2, 2, 1])]);
  assert.deepEqual([walled.fits, walled.covered], [false, false]);
});

test('moves along the edge, half a tile at a time, clear of what stands over it — and says when there is no clear place', () => {
  const free = floorLabelPlace({ at: [0, 0], size: [8, 5] }, floor, 'Home');
  // a tall block standing in front of the edge's far end covers it there: the words move on
  const moved = floorLabelPlace({ at: [0, 0], size: [8, 5] }, floor, 'Home', [outline(0, 5, [2, 1, 1.2])]);
  assert.equal(moved.covered, false);
  assert.ok(moved.x > free.x);
  close((floor.tileAt(moved.x, moved.y).col - 0.3) % 0.5, 0);
  // a block that stands well behind the edge covers nothing
  assert.deepEqual(floorLabelPlace({ at: [0, 0], size: [8, 5] }, floor, 'Home', [outline(1, 0, [2, 2, 1])]), free);
  // the whole edge taken: the first place, said covered
  const wall = floorLabelPlace({ at: [0, 0], size: [8, 5] }, floor, 'Home', [outline(0, 4.5, [8, 1, 1])]);
  assert.deepEqual([wall.covered, wall.x, wall.y], [true, free.x, free.y]);
  // the first clear place, exactly: half a tile on, and on again while it is still covered
  const step = floorLabelPlace({ at: [0, 0], size: [8, 5] }, floor, 'Home', [outline(0, 5, [0.6, 1, 1])]);
  close(floor.tileAt(step.x, step.y).col, 0.8);
  // a stretch of a laid route is an outline of two points, kept clear of as a block is
  const route = [floor.at(-1, 4.6), floor.at(2, 4.6)].map(({ x, y }) => [x, y]);
  assert.ok(floorLabelPlace({ at: [0, 0], size: [8, 5] }, floor, 'Home', [route]).x > free.x);
});

test('counts an icon and capitals in the room the words take, and keeps a quarter tile clear past them', () => {
  assert.deepEqual(floorLabelPlace({ at: [0, 0], size: [3, 3] }, floor, 'Accounts team').lines, ['Accounts team']);
  assert.deepEqual(floorLabelPlace({ at: [0, 0], size: [3, 3] }, floor, 'Accounts team', [], { icon: true }).lines, ['Accounts', 'team']);
  assert.deepEqual(floorLabelPlace({ at: [0, 0], size: [3, 3] }, floor, 'ACCOUNTS TEAM').lines, ['ACCOUNTS', 'TEAM']);
  const free = floorLabelPlace({ at: [0, 0], size: [8, 5] }, floor, 'Home');
  // a block standing just past where the words are counted to end, inside the quarter tile: they move on
  const end = 0.3 + 4 * 0.6 * 20 / Math.hypot(60, 30);
  assert.ok(floorLabelPlace({ at: [0, 0], size: [8, 5] }, floor, 'Home', [outline(end + 0.1, 4, [1, 1, 0])]).x > free.x);
});

test('its work is bounded: outlines are asked by their boxes first, and the whole search spends at most MOST_LABEL_LOOKS', () => {
  // a thousand things standing well behind the edge cost a box each, and change nothing
  const free = floorLabelPlace({ at: [0, 0], size: [8, 5] }, floor, 'Home');
  const behind = Array.from({ length: 1000 }, (_, i) => outline(1 + (i % 5), (i % 3) * 0.2, [1, 1, 0.5]));
  assert.deepEqual(floorLabelPlace({ at: [0, 0], size: [8, 5] }, floor, 'Home', behind), free);
  // the whole edge of the biggest floor covered by the most outlines: refused in words, quickly, never left to run
  const far = Array.from({ length: 100_000 }, () => [[-5e5, -5e5], [-5e5 + 1, -5e5]]), wall = [...far, outline(0, 255.5, [256, 1, 1])];
  const t0 = Date.now();
  assert.throws(() => floorLabelPlace({ at: [0, 0], size: [256, 256] }, floor, 'Home', wall), (e) => e.message.includes(`more than ${MOST_LABEL_LOOKS} looks`));
  assert.ok(Date.now() - t0 < 3000);
});

test('every value is read by its own stored value, a grid by its numbers, and a refusal says what to give', () => {
  const refused = (f, words) => assert.throws(f, (e) => e.message.startsWith('isometric: ') && e.message.includes(words), words);
  const f = { at: [0, 0], size: [8, 5] };
  refused(() => floorLabelPlace(null, floor, 'Home'), "a floor's label lies on a floor");
  refused(() => floorLabelPlace({ at: [0, 0], size: [0, 5] }, floor, 'Home'), 'each above 0');
  refused(() => floorLabelPlace({ at: [0], size: [8, 5] }, floor, 'Home'), "a labelled floor's at");
  refused(() => floorLabelPlace(f, floor, ''), `a name of 1 to ${MOST_FLOOR_LABEL} letters — not 0 letters`);
  refused(() => floorLabelPlace(f, floor, 'x'.repeat(MOST_FLOOR_LABEL + 1)), `not ${MOST_FLOOR_LABEL + 1} letters`);
  assert.doesNotThrow(() => floorLabelPlace(f, floor, '\u{1F600}'.repeat(MOST_FLOOR_LABEL)));   // letters, not code units
  refused(() => floorLabelPlace(f, floor, 7), 'not 7');
  refused(() => floorLabelPlace(f, floor, 'Home', 'covers'), 'what covers a floor');
  refused(() => floorLabelPlace(f, floor, 'Home', [[[0, 0], [1]]]), 'point 2 of outline 1 over the floor');
  refused(() => floorLabelPlace(f, floor, 'Home', [], { icon: 1 }), 'icon says whether');
  refused(() => floorLabelPlace(f, { tile: 'big' }, 'Home'), "floorLabelPlace: a grid's tile");
  const many = Array.from({ length: MOST_COVER_POINTS / 2 + 1 }, () => [[0, 0], [1, 1]]);
  refused(() => floorLabelPlace(f, floor, 'Home', many), `at most ${MOST_COVER_POINTS} points`);
  refused(() => floorLabelPlace(f, floor, 'Home', [Array.from({ length: MOST_OUTLINE_POINTS + 1 }, (_, i) => [i, i])]), `outline 1 over the floor is at most ${MOST_OUTLINE_POINTS} points`);
  refused(() => floorLabelPlace({ at: [0, 0], size: [257, 5] }, floor, 'Home'), 'at most 256');
  const icon = {};
  Object.defineProperty(icon, 'icon', { get() { ran = true; return true; } });
  refused(() => floorLabelPlace(f, floor, 'Home', [], icon), "a floor label's icon is read as a stored value");
  let ran = false;
  const sneaky = { at: [0, 0] };
  Object.defineProperty(sneaky, 'size', { get() { ran = true; return [8, 5]; } });
  refused(() => floorLabelPlace(sneaky, floor, 'Home'), "a labelled floor's size");
  assert.equal(ran, false);
});
