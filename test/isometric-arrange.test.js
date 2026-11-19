// Arrange and fit: places worked out from what is joined to what, and the grid on which they fill a box. Checked
// against what an arrangement must always hold (nothing nearer than the gap, a link runs on along the cols, the same
// input the same output), and the rows against an oracle written apart from the code: the closed form of the same
// least-squares answer.
import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { arrange, gridFor, isometric, MOST_LINKS, MOST_ISOMETRIC_THINGS } from '../isometric.js';
import { settle } from '../src/isometric/arrange.js';

const thing = (name, size = [2, 2, 1]) => ({ name, size });
const at = (arranged, name) => arranged.things.find((t) => t.name === name).at.slice(0, 2);
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

test('a request, arranged: the browser before what it asks, the two it asks side by side, the database after the server', () => {
  const things = [thing('you'), thing('dns'), thing('server'), thing('db', [1.8, 1.8, 1.4])];
  const a = arrange(things, [['you', 'dns'], ['you', 'server'], ['server', 'db']], { gap: 1, step: 1 });
  assert.deepEqual(a.things.map((t) => t.name), ['you', 'dns', 'server', 'db']);   // as given
  assert.deepEqual(at(a, 'you'), [0, 1.5]);      // in the middle of the two it leads to
  assert.deepEqual(at(a, 'dns'), [3, 0]);
  assert.deepEqual(at(a, 'server'), [3, 3]);
  assert.ok(near(at(a, 'db')[0], 6.1) && near(at(a, 'db')[1], 3.1));   // on the server's row, in the middle of its slot
  assert.deepEqual([a.cols, a.rows], [8, 5]);
  assert.ok(Object.isFrozen(a) && Object.isFrozen(a.things) && Object.isFrozen(a.things[0]) && Object.isFrozen(a.things[0].at));
  assert.deepEqual(a.things[3].size, [1.8, 1.8, 1.4]);
  assert.deepEqual(a.things[0].at[2], 0);        // on the floor: a grid draws it as it is
});

test('a chain runs along the cols on one row; a wider gap spreads it', () => {
  const chain = arrange([thing('a'), thing('b', [1, 1, 1]), thing('c', [3, 2, 1])], [['a', 'b'], ['b', 'c']], { gap: 1, step: 1 });
  assert.deepEqual([at(chain, 'a'), at(chain, 'b'), at(chain, 'c')], [[0, 0], [3, 0.5], [5, 0]]);   // each on the middle line
  const wide = arrange([thing('a'), thing('b')], [['a', 'b']], { step: 2.5 });   // between one step and the next
  assert.deepEqual(at(wide, 'b'), [4.5, 0]);
  assert.deepEqual(at(arrange([thing('a'), thing('b')], [['a', 'b']], { step: 0 }), 'b'), [2, 0]);
  const apart = arrange([thing('src'), thing('x'), thing('y')], [['src', 'x'], ['src', 'y']], { gap: 3.2, step: 1 });   // between two side by side: up to the half tile
  assert.deepEqual([at(apart, 'x'), at(apart, 'y')], [[3, 0], [3, 5.5]]);
});

test('what leads to one thing stands evenly either side of it, and so does what one thing leads to', () => {
  const fanIn = arrange([thing('a'), thing('b'), thing('c'), thing('sink')], [['a', 'sink'], ['b', 'sink'], ['c', 'sink']], { gap: 1, step: 1 });
  assert.deepEqual([at(fanIn, 'a'), at(fanIn, 'b'), at(fanIn, 'c'), at(fanIn, 'sink')], [[0, 0], [0, 3], [0, 6], [3, 3]]);
  const fanOut = arrange([thing('src'), thing('x'), thing('y')], [['src', 'x'], ['src', 'y']], { gap: 1, step: 1 });
  assert.deepEqual([at(fanOut, 'src'), at(fanOut, 'x'), at(fanOut, 'y')], [[0, 1.5], [3, 0], [3, 3]]);
});

test('a thing nothing leads to waits one step before the nearest thing it leads to, so its link is short', () => {
  const a = arrange([thing('a'), thing('b'), thing('c'), thing('late')], [['a', 'b'], ['b', 'c'], ['late', 'c']]);
  assert.equal(at(a, 'late')[0], at(a, 'b')[0]);   // beside b, not back at the start beside a
  assert.ok(at(a, 'late')[1] !== at(a, 'b')[1]);
});

test('the order within a step uncrosses the links', () => {
  // given as written, a's link to y and b's link to x would cross; arranged, they do not
  const a = arrange([thing('a'), thing('b'), thing('x'), thing('y')], [['a', 'y'], ['b', 'x']]);
  assert.ok((at(a, 'a')[1] - at(a, 'b')[1]) * (at(a, 'y')[1] - at(a, 'x')[1]) > 0);
});

test('a ring of links is placed too: the link that closes it is read the other way round', () => {
  const ring = arrange([thing('a'), thing('b'), thing('c')], [['a', 'b'], ['b', 'c'], ['c', 'a']], { gap: 1, step: 1 });
  assert.deepEqual([at(ring, 'a')[0], at(ring, 'b')[0], at(ring, 'c')[0]], [0, 3, 6]);
  const both = arrange([thing('a'), thing('b')], [['a', 'b'], ['b', 'a']], { gap: 1, step: 1 });   // one rule a pair: the first given
  assert.deepEqual([at(both, 'a'), at(both, 'b')], [[0, 0], [3, 0]]);
});

test('things joined to nothing stand in rows past the rest, nearer the viewer, as wide as the rest; with no links at all, near a square', () => {
  const mixed = arrange([thing('a'), thing('b'), thing('l1'), thing('l2'), thing('l3'), thing('l4')], [['a', 'b']], { gap: 1, step: 1 });
  assert.deepEqual([at(mixed, 'l1'), at(mixed, 'l2'), at(mixed, 'l3'), at(mixed, 'l4')], [[0, 3], [3, 3], [0, 6], [3, 6]]);   // two a row: as wide as a and b
  // further along the rows is nearer the viewer: a grid draws them lower on the frame, and after the rest
  const grid = isometric(), drawn = grid.backToFront(mixed.things).map((t) => t.name);
  assert.ok(grid.block(mixed.things[2]).centre.y > grid.block(mixed.things[0]).centre.y);
  assert.ok(drawn.indexOf('l1') > drawn.indexOf('a'));
  const none = arrange(['p', 'q', 'r', 's', 't'].map((n) => thing(n)), [], { gap: 1, step: 1 });
  assert.deepEqual(none.things.map((t) => t.at.slice(0, 2)), [[0, 0], [3, 0], [6, 0], [0, 3], [3, 3]]);   // three a row for five
  assert.deepEqual(arrange([thing('only')]).things[0].at, [0, 0, 0]);
  assert.deepEqual(arrange([]), { things: [], cols: 0, rows: 0 });
  const wide = arrange([thing('a'), thing('b'), thing('big', [9, 2, 1])], [['a', 'b']], { gap: 1, step: 1 });   // wider than the rest: a row to itself, never dropped
  assert.deepEqual(at(wide, 'big'), [0, 3]);
});

test('the gaps, left out, are what the tallest thing asks for: 1.22 tiles of floor hidden a tile of height, half a tile to see, and a tile more where the links run', () => {
  const heights = [0, 0.3, 0.82, 1, 1.6, 3];
  const stepAfter = (high, options) => arrange([thing('a', [2, 2, high]), thing('b', [2, 2, 0])], [['a', 'b']], options).things[1].at[0] - 2;
  const gapBeside = (high, options) => { const { things } = arrange([thing('s', [2, 2, high]), thing('x', [2, 2, 0]), thing('y', [2, 2, 0])], [['s', 'x'], ['s', 'y']], options); return things[2].at[1] - things[1].at[1] - 2; };
  assert.deepEqual(heights.map((high) => gapBeside(high)), [1, 1, 2, 2, 2.5, 4.5]);   // never under a tile; 1 high: 1.22 + 0.5, up to the half
  assert.deepEqual(heights.map((high) => stepAfter(high)), [2, 2, 3, 3, 3.5, 5.5]);   // a tile more, never under two
  assert.equal(stepAfter(3, { step: 1 }), 1);     // a gap given is the gap
  assert.equal(gapBeside(3, { gap: 0 }), 0);
  assert.equal(stepAfter(3, { gap: 0 }), 5.5);    // each on its own: the other keeps its usual value
  assert.equal(stepAfter(3, {}), 5.5);
  assert.equal(stepAfter(3, null), 5.5);
  // with that gap, in the usual view, a nearer thing never covers a face of the one behind it: the floor shows between their outlines
  const grid = isometric({ tile: 120 }), across = (p) => p.x * 0.5 + p.y;   // along the frame, across the lines the rows run in (down and to the right is more)
  const tall = arrange([thing('far', [2, 2, 1]), thing('near', [2, 2, 2.4])], [['far', 'near']]).things;
  const farFoot = grid.block(tall[0]).right[2], nearTop = grid.block(tall[1]).top[0];   // far's foot at its near edge; near's top at its far corner
  assert.ok(across(nearTop) - across(farFoot) > 60, `between two steps the floor shows for ${across(nearTop) - across(farFoot)} px: room for an arrow`);
  const beside = arrange([thing('s', [2, 2, 0]), thing('far', [2, 2, 1]), thing('near', [2, 2, 2.4])], [['s', 'far'], ['s', 'near']]).things;
  const alongRows = (p) => -p.x * 0.5 + p.y;     // across the lines the cols run in (down and to the left is more)
  assert.ok(alongRows(grid.block(beside[2]).top[0]) - alongRows(grid.block(beside[1]).left[3]) > 20, 'and between two side by side it shows too');
});

test('the order within a step has few crossing links, not always the fewest: the search is short', () => {
  // here one crossing is left (c to x over b to y); the order a, c, b beside x, z, y would have none
  const a = arrange(['a', 'b', 'c', 'x', 'y', 'z'].map((n) => thing(n)), [['a', 'x'], ['b', 'y'], ['c', 'z'], ['c', 'x']], { gap: 1, step: 1 });
  assert.deepEqual(['a', 'b', 'c', 'x', 'y', 'z'].map((n) => at(a, n)[1]), [0, 3, 6, 1, 4, 7]);
});

test('cols and rows are whole tiles, so a floor that size lies under the arrangement', () => {
  const odd = arrange([thing('a', [1.3, 1.3, 1]), thing('b')], [['a', 'b']], { gap: 1, step: 1 });
  assert.deepEqual([odd.cols, odd.rows], [5, 2]);
  assert.deepEqual(at(odd, 'a'), [0.1, 0.6]);     // in the middle of its slot, as a plain number
  const floor = isometric().floor({ cols: odd.cols, rows: odd.rows });
  for (const t of odd.things) for (const p of isometric().block(t).outline) assert.ok(p.x >= floor.box.x - 1e-9 && p.x <= floor.box.x + floor.box.w + 1e-9);
});

test('a thing a hair over a half tile has a slot that holds it: nothing stands on its edge', () => {
  const a = arrange([thing('a', [0.5000000004, 0.5, 0]), thing('b', [0.5, 0.5, 0])], [['a', 'b']], { gap: 0, step: 0 });
  assert.ok(a.things[1].at[0] >= a.things[0].at[0] + a.things[0].size[0]);
  assert.equal(a.things[1].at[0], 1);   // a's slot is a whole tile
});

test('a thing of almost no size still has a slot of its own', () => {
  const tiny = arrange([thing('a', [1e-10, 1e-10, 0]), thing('b', [1e-10, 1e-10, 0])], [['a', 'b']], { gap: 0 });
  assert.ok(tiny.things[1].at[0] - tiny.things[0].at[0] >= 0.5 - 1e-9);
  assert.ok(tiny.things.every((t) => t.at[0] >= 0 && t.at[1] >= 0));
});

test('a link to a name that is not a thing here, or from a thing to itself, is no rule', () => {
  const a = arrange([thing('a'), thing('b')], [['a', 'elsewhere'], ['a', 'a'], ['nowhere', 'b'], ['a', 'b'], ['a', 'b']], { gap: 1, step: 1 });
  assert.deepEqual([at(a, 'a'), at(a, 'b')], [[0, 0], [3, 0]]);
  assert.deepEqual(at(arrange([thing('__proto__'), thing('constructor')], [['__proto__', 'constructor']], { gap: 1, step: 1 }), 'constructor'), [3, 0]);   // any name is a name
});

test('settle: the rows are the least-squares answer, checked against its closed form', () => {
  // isotonic regression's closed form: y[i] = max over a ≤ i of min over b ≥ i of the mean of what a..b want
  const oracle = (depths, wanted, gap) => {
    const before = []; let sum = 0;
    for (const d of depths) { before.push(sum); sum += d + gap; }
    const t = wanted.map((w, i) => w - depths[i] / 2 - before[i]);
    const avg = (a, b) => t.slice(a, b + 1).reduce((x, y) => x + y, 0) / (b - a + 1);
    return t.map((_, i) => Math.max(...Array.from({ length: i + 1 }, (_, a) => Math.min(...Array.from({ length: t.length - i }, (_, k) => avg(a, i + k))))) + before[i]);
  };
  assert.deepEqual(settle([2, 2], [5, 5], 1), [2.5, 5.5]);   // two that want one middle: evenly either side of it
  assert.deepEqual(settle([2, 2], [0, 10], 1), [-1, 9]);     // far enough apart: each where it wants
  const cases = { pooled: 0, free: 0 };
  fc.assert(fc.property(fc.array(fc.record({ depth: fc.double({ min: 0.5, max: 6, noNaN: true }), want: fc.double({ min: -30, max: 30, noNaN: true }) }), { minLength: 1, maxLength: 9 }),
    fc.double({ min: 0, max: 3, noNaN: true }), (list, gap) => {
      const depths = list.map((l) => l.depth), wanted = list.map((l) => l.want), got = settle(depths, wanted, gap), want = oracle(depths, wanted, gap);
      got.forEach((value, i) => assert.ok(near(value, want[i], 1e-6), `start ${i}: ${value} is not ${want[i]}`));
      for (let i = 1; i < got.length; i += 1) assert.ok(got[i] - got[i - 1] >= depths[i - 1] + gap - 1e-9);   // in order, the gap kept
      cases[got.some((value, i) => !near(value + depths[i] / 2, wanted[i], 1e-6)) ? 'pooled' : 'free'] += 1;
    }), { numRuns: 400, seed: 20261119 });
  assert.ok(cases.pooled > 40 && cases.free > 40, `both kinds were tried: ${JSON.stringify(cases)}`);
});

const names = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
const side = fc.oneof({ weight: 9, arbitrary: fc.double({ min: 0.3, max: 5, noNaN: true }) }, { weight: 1, arbitrary: fc.constantFrom(1e-10, 0.01, 0.5, 64) });   // the ends of what a size may be, too
const picture = fc.record({
  sizes: fc.array(fc.tuple(side, side, fc.double({ min: 0, max: 3, noNaN: true })), { minLength: 1, maxLength: 10 }),
  pairs: fc.array(fc.tuple(fc.nat(9), fc.nat(9)), { maxLength: 14 }),
  gap: fc.constantFrom(0, 0.5, 1, 1.3, 2),
  step: fc.constantFrom(0, 1, 1.7, 3),
  back: fc.boolean(),   // the first link, given again the other way round: a ring often enough to be a case of its own
});
const read = ({ sizes, pairs, gap, step, back }) => {
  const links = pairs.filter(([u, v]) => u < sizes.length && v < sizes.length).map(([u, v]) => [names[u], names[v]]);
  return { things: sizes.map((size, i) => thing(names[i], size)), links: back && links.length ? [...links, [links[0][1], links[0][0]]] : links, gap, step };
};
const up = (n) => Math.ceil(n * 2) / 2;   // a gap as it is kept: up to the half tile

test('for any things and links: every thing is placed once, none nearer another than the gap, all from [0, 0], and the same again', () => {
  const seen = { joined: 0, loose: 0, rings: 0, plain: 0 };
  fc.assert(fc.property(picture, (given) => {
    const { things, links, gap, step } = read(given), a = arrange(things, links, { gap, step });
    assert.deepEqual(a.things.map((t) => t.name), things.map((t) => t.name));
    const slotGap = Math.min(up(gap), up(step));   // side by side they keep the gap, one step from the next the step: never nearer than the lesser
    for (let i = 0; i < a.things.length; i += 1) {
      const p = a.things[i];
      assert.ok(p.at[0] >= -1e-9 && p.at[1] >= -1e-9 && p.at[2] === 0);
      assert.ok(p.at[0] + p.size[0] <= a.cols + 1e-9 && p.at[1] + p.size[1] <= a.rows + 1e-9);
      for (let j = i + 1; j < a.things.length; j += 1) {
        const q = a.things[j];
        const apartCols = Math.max(q.at[0] - (p.at[0] + p.size[0]), p.at[0] - (q.at[0] + q.size[0])), apartRows = Math.max(q.at[1] - (p.at[1] + p.size[1]), p.at[1] - (q.at[1] + q.size[1]));
        assert.ok(Math.max(apartCols, apartRows) >= slotGap - 1e-9, `${p.name} and ${q.name} stand ${Math.max(apartCols, apartRows)} apart, the gap is ${slotGap}`);
      }
    }
    assert.deepEqual(arrange(things, links, { gap, step }), a);   // the same input, the same places
    const linked = new Set(links.filter(([u, v]) => u !== v).flat());
    seen.joined += linked.size > 0; seen.loose += linked.size < things.length; seen.plain += links.length === 0;
    seen.rings += links.some(([u, v]) => links.some(([x, y]) => x === v && y === u && u !== v));
  }), { numRuns: 600, seed: 20261119 });
  for (const [kind, n] of Object.entries(seen)) assert.ok(n > 30, `${kind} was tried ${n} times`);
});

test('for links with no ring: what a link leads to stands further along the cols, past the step', () => {
  let tried = 0;
  fc.assert(fc.property(picture, (given) => {
    const { things, gap, step } = read(given), forward = read({ ...given, back: false }).links.filter(([u, v]) => u < v);   // from an earlier name to a later one: no ring
    const a = arrange(things, forward, { gap, step }), slotGap = up(step);
    for (const [u, v] of forward) {
      const from = a.things.find((t) => t.name === u), to = a.things.find((t) => t.name === v);
      assert.ok(to.at[0] >= from.at[0] + from.size[0] + slotGap - 1e-9, `${u} to ${v}: ${JSON.stringify([from.at, to.at])}`);
      tried += 1;
    }
  }), { numRuns: 400, seed: 7 });
  assert.ok(tried > 300, `${tried} links were checked`);
});

test('every slot is on the half tile: a slot is the size rounded up to a half, and the thing stands in its middle', () => {
  fc.assert(fc.property(picture, (given) => {
    const { things, links, gap, step } = read(given);
    for (const p of arrange(things, links, { gap, step }).things) {   // any gap: it is rounded up to the half tile too
      const slot = [0, 1].map((axis) => p.at[axis] - (Math.max(0.5, Math.ceil(p.size[axis] * 2) / 2) - p.size[axis]) / 2);
      for (const start of slot) assert.ok(near(start * 2, Math.round(start * 2), 1e-6), `${p.name}'s slot starts at ${start}`);
    }
  }), { numRuns: 300, seed: 3 });
});

test('bounded: the most things and the most links are placed quickly, and one more of either is refused', () => {
  const many = Array.from({ length: MOST_ISOMETRIC_THINGS }, (_, i) => thing(`t${i}`, [1, 1, 1]));
  const links = Array.from({ length: MOST_LINKS }, (_, i) => [`t${i % 251}`, `t${(i * 7 + 3) % 256}`]);
  const started = performance.now(), a = arrange(many, links, { gap: 1, step: 1 });
  assert.equal(a.things.length, MOST_ISOMETRIC_THINGS);
  assert.ok(performance.now() - started < 3000, `it took ${Math.round(performance.now() - started)} ms`);
  const chain = arrange(many, many.slice(1).map((t, i) => [`t${i}`, t.name]), { gap: 1, step: 1 });   // the longest chain there can be
  assert.equal(chain.cols, 2 * MOST_ISOMETRIC_THINGS - 1);
  assert.throws(() => arrange([...many, thing('one more')]), /arrange places at most 256 things, not 257/);
  assert.throws(() => arrange(many, [...links, ['t0', 't1']]), /arrange reads at most 1024 links, not 1025/);
});

test('every value may come from anyone: each is read by its own stored value, and a refusal says what to give', () => {
  assert.throws(() => arrange('things'), /arrange takes a list of things, \[\{name, size: \[wide, deep, high\]\}\] — not "things"/);
  assert.throws(() => arrange([null]), /thing 1 is \{name, size: \[wide, deep, high\]\} — not null/);
  assert.throws(() => arrange([{ size: [1, 1, 1] }]), /thing 1 has a name, some text of at most 200 characters — not undefined/);
  assert.throws(() => arrange([thing('x'.repeat(201))]), /has a name, some text of at most 200 characters/);
  assert.throws(() => arrange([thing('a'), thing('a')]), /two things are named "a": a name tells one thing from another/);
  assert.throws(() => arrange([thing('a', [1, 1])]), /"a"'s size is \[wide, deep, high\], in tiles — not \[1,1\]/);
  assert.throws(() => arrange([thing('a', [0, 1, 1])]), /"a"'s size is \[wide, deep, high\] with wide and deep above 0, high 0 or more, none over 64/);
  assert.throws(() => arrange([thing('a', [65, 1, 1])]), /none over 64/);
  assert.throws(() => arrange([thing('a', [1, 1, NaN])]), /"a"'s size is \[wide, deep, high\], in tiles/);
  assert.throws(() => arrange([thing('a')], 'links'), /arrange takes a list of links, \[\[from, to\], …\] by name — not "links"/);
  assert.throws(() => arrange([thing('a')], [['a']]), /link 1 is \[from, to\], the names of two things — not \["a"\]/);
  assert.throws(() => arrange([thing('a')], [['a', 5]]), /link 1 is \[from, to\], the names of two things/);
  assert.throws(() => arrange([thing('a')], [], { gap: -1 }), /gap is the tiles left between two things side by side, from 0 to 64 — not -1/);
  assert.throws(() => arrange([thing('a')], [], { gap: '1' }), /gap is the tiles left between two things side by side/);
  assert.throws(() => arrange([thing('a')], [], { step: 65 }), /step is the tiles left between one step and the next, from 0 to 64 — not 65/);
  // a getter is somebody's code, and is never run: a thing whose name is one has no name; a hole in the list is no thing
  let ran = false;
  const sly = { size: [1, 1, 1] };
  Object.defineProperty(sly, 'name', { get() { ran = true; return 'sly'; }, enumerable: true });
  assert.throws(() => arrange([sly]), /thing 1 has a name/);
  assert.equal(ran, false);
  const holed = [thing('a')]; holed.length = 2;
  assert.throws(() => arrange(holed), /thing 2 is \{name, size: \[wide, deep, high\]\} — not undefined/);
  // an option too is read by its own stored value: a getter there is never run, and the usual value stands
  const options = {};
  Object.defineProperty(options, 'step', { get() { ran = true; return 0; }, enumerable: true });
  assert.equal(arrange([thing('a'), thing('b')], [['a', 'b']], options).things[1].at[0], 5);
  const bounds = {};
  Object.defineProperty(bounds, 'most', { get() { ran = true; return 30; }, enumerable: true });
  assert.deepEqual(gridFor([{ at: [0, 0], size: [1, 1, 1] }], [0, 0, 4000, 4000], bounds).tile, [160, 80]);
  assert.equal(ran, false);
});

test('gridFor: the grid on which the picture fills the box, a whole even tile, the picture in its middle', () => {
  const a = arrange([thing('you'), thing('dns'), thing('server'), thing('db', [1.8, 1.8, 1.4])], [['you', 'dns'], ['you', 'server'], ['server', 'db']], { gap: 1, step: 1 });
  const box = [0, 220, 1920, 1000], grid = gridFor(a.things, box);
  assert.deepEqual(grid.tile, [160, 80]);   // as big as the most a tile may be: this picture would fit a bigger one
  const small = gridFor(a.things, [100, 100, 700, 400]);
  assert.deepEqual(small.tile, [86, 43]);
  const boxes = a.things.map((t) => small.block(t).box), left = Math.min(...boxes.map((b) => b.x)), right = Math.max(...boxes.map((b) => b.x + b.w)), top = Math.min(...boxes.map((b) => b.y)), bottom = Math.max(...boxes.map((b) => b.y + b.h));
  assert.ok(left >= 100 && right <= 700 && top >= 100 && bottom <= 400);
  assert.ok(near((left + right) / 2, 400, 1e-6) && near((top + bottom) / 2, 250, 1e-6));   // in the middle of the box
  assert.deepEqual(gridFor(a.things, box, { most: 90 }).tile, [90, 45]);
  // the tile is always a whole even number: bounds that are not are read as the even numbers inside them
  assert.deepEqual(gridFor(a.things, box, { most: 161 }).tile, [160, 80]);
  assert.deepEqual(gridFor(a.things, [0, 0, 60, 60], { least: 24.5 }).tile, [26, 13]);
  assert.throws(() => gridFor(a.things, box, { least: 3, most: 3 }), /least 2 or more and most no less, with an even number between them — not \[3,3\]/);
  assert.deepEqual(gridFor(a.things, [0, 0, 60, 60]).tile, [24, 12]);   // too big for the box at the least tile: still a grid, and it runs past
  assert.deepEqual(gridFor(a.things, [0, 0, 60, 60], { least: 10 }).tile, [14, 7]);   // with a smaller least, it fits
  assert.deepEqual(gridFor(a.things, [0, 0, 30, 30], { least: 10 }).tile, [10, 5]);
});

test('gridFor, for any placed things and any box: every thing is inside the box, and a tile two pixels wider would not fit', () => {
  const placed = fc.array(fc.record({ at: fc.tuple(fc.double({ min: -20, max: 20, noNaN: true }), fc.double({ min: -20, max: 20, noNaN: true }), fc.double({ min: 0, max: 3, noNaN: true })),
    size: fc.tuple(fc.double({ min: 0.3, max: 5, noNaN: true }), fc.double({ min: 0.3, max: 5, noNaN: true }), fc.double({ min: 0, max: 4, noNaN: true })) }), { minLength: 1, maxLength: 8 });
  const seen = { fitted: 0, most: 0, least: 0 };
  const bounds = fc.tuple(fc.double({ min: 2, max: 60, noNaN: true }), fc.double({ min: 62, max: 300, noNaN: true }));   // whole or not, even or odd
  fc.assert(fc.property(placed, fc.tuple(fc.double({ min: -500, max: 500, noNaN: true }), fc.double({ min: -500, max: 500, noNaN: true }), fc.double({ min: 50, max: 2500, noNaN: true }), fc.double({ min: 50, max: 1500, noNaN: true })), bounds, (things, [x, y, w, h], [atLeast, atMost]) => {
    const into = [x, y, x + w, y + h], grid = gridFor(things, into, { least: atLeast, most: atMost }), [tile] = grid.tile;
    const least = 2 * Math.ceil(atLeast / 2), most = 2 * Math.floor(atMost / 2);
    assert.ok(Number.isInteger(tile) && tile % 2 === 0 && tile >= least && tile <= most, `a tile of ${tile} for ${atLeast} to ${atMost}`);
    const span = (g) => { const b = things.map((t) => g.block(t).box); return [Math.min(...b.map((v) => v.x)), Math.min(...b.map((v) => v.y)), Math.max(...b.map((v) => v.x + v.w)), Math.max(...b.map((v) => v.y + v.h))]; };
    const [l, t, r, b] = span(grid);
    assert.ok(near((l + r) / 2, x + w / 2, 1e-6) && near((t + b) / 2, y + h / 2, 1e-6));
    if (tile > least) assert.ok(l >= into[0] - 1e-6 && t >= into[1] - 1e-6 && r <= into[2] + 1e-6 && b <= into[3] + 1e-6);
    if (tile > least && tile < most) {
      const [l2, t2, r2, b2] = span(isometric({ tile: tile + 2 }));
      assert.ok(r2 - l2 > w + 1e-6 || b2 - t2 > h + 1e-6, 'the next tile up would have fitted too');
    }
    seen[tile === most ? 'most' : tile === least ? 'least' : 'fitted'] += 1;
  }), { numRuns: 500, seed: 11 });
  for (const [kind, n] of Object.entries(seen)) assert.ok(n > 20, `${kind} was tried ${n} times`);
});

test('gridFor refuses what is not a picture, a box or a tile, and says what to give', () => {
  const one = [{ at: [0, 0], size: [1, 1, 1] }];
  assert.throws(() => gridFor([], [0, 0, 10, 10]), /gridFor takes the things to fit, a list of at least one \{at, size\}/);
  assert.throws(() => gridFor('x', [0, 0, 10, 10]), /gridFor takes the things to fit/);
  assert.throws(() => gridFor(one, [0, 0, 10]), /the box to fill is \[x0, y0, x1, y1\] in pixels — not \[0,0,10\]/);
  assert.throws(() => gridFor(one, [10, 0, 10, 10]), /the box to fill is \[x0, y0, x1, y1\] with x1 past x0 and y1 past y0/);
  assert.throws(() => gridFor(one, [0, 0, 10, 10], { least: 1 }), /a tile is from least to most pixels wide, least 2 or more and most no less — not \[1,160\]/);
  assert.throws(() => gridFor(one, [0, 0, 10, 10], { least: 50, most: 40 }), /least 2 or more and most no less/);
  assert.throws(() => gridFor([{ at: [0, 0], size: [1, 1, 1] }, { at: [0, 0] }], [0, 0, 10, 10]), /thing 2's size is \[wide, deep, high\], in tiles/);   // which thing, by its place in the list
  assert.throws(() => gridFor(Array.from({ length: 257 }, () => one[0]), [0, 0, 10, 10]), /gridFor fits at most 256 things, not 257/);
});

// ——— across the frame

/** A thing's reach across the frame and down it, in the tiles of the cornerwise view: [[left, right], [top, bottom]]. */
const cornerwise = ({ at: [c, r], size: [w, d] }) => [[(c - r - d) / 2, (c + w - r) / 2], [(c + r) / 2, (c + w + r + d) / 2]];

test('across the frame: a chain runs left to right on one line, and what one thing leads to stands one below the other', () => {
  const grid = isometric({ tile: 120 }), middle = (t) => grid.at(t.at[0] + t.size[0] / 2, t.at[1] + t.size[1] / 2);
  const chain = arrange(['a', 'b', 'c'].map((n) => thing(n)), [['a', 'b'], ['b', 'c']], { across: true });
  assert.deepEqual(chain.things.map((t) => t.at.slice(0, 2)), [[0, 6], [3, 3], [6, 0]]);   // a tile along the cols and one back along the rows, each step
  const [a, b, c] = chain.things.map(middle);
  assert.ok(a.y === b.y && b.y === c.y && a.x < b.x && b.x < c.x);                          // on the frame: one level line, left to right
  assert.equal(b.x - a.x, 3 * 120);                                                        // two tiles of block and one of gap: room for an arrow
  const fan = arrange([thing('src'), thing('x'), thing('y')], [['src', 'x'], ['src', 'y']], { across: true }).things.map(middle);
  assert.ok(fan[1].x === fan[2].x && fan[1].x > fan[0].x);                                 // one step to the right of it, both
  assert.ok(fan[1].y < fan[0].y && fan[2].y > fan[0].y && Math.abs((fan[1].y + fan[2].y) / 2 - fan[0].y) <= 30);   // one above its line, one below, evenly (to the half tile)
  assert.deepEqual(arrange([thing('only')], [], { across: true }).things[0].at, [0, 0, 0]);
  assert.deepEqual(arrange([], [], { across: true }), { things: [], cols: 0, rows: 0 });
  assert.throws(() => arrange([thing('a')], [], { across: 'yes' }), /across says whether the steps run across the frame, true or false — not "yes"/);
});

test('across the frame, for any things and links: none overlaps another, none nearer than the gaps, a link runs on to the right, every middle on the half tile', () => {
  const seen = { joined: 0, loose: 0, links: 0 };
  fc.assert(fc.property(picture, (given) => {
    const { things, links, gap, step } = read(given), a = arrange(things, links, { gap, step, across: true });
    assert.deepEqual(a.things.map((t) => t.name), things.map((t) => t.name));
    assert.deepEqual(arrange(things, links, { gap, step, across: true }), a);   // the same input, the same places
    for (let i = 0; i < a.things.length; i += 1) {
      const p = a.things[i], [pu, pv] = cornerwise(p);
      assert.ok(p.at[0] >= -1e-9 && p.at[1] >= -1e-9 && p.at[0] + p.size[0] <= a.cols + 1e-9 && p.at[1] + p.size[1] <= a.rows + 1e-9);
      for (const axis of [0, 1]) { const mid = p.at[axis] + p.size[axis] / 2; assert.ok(near(mid * 2, Math.round(mid * 2), 1e-6), `${p.name}'s middle is at ${mid}`); }
      for (let j = i + 1; j < a.things.length; j += 1) {
        const q = a.things[j], [qu, qv] = cornerwise(q);
        const apartAcross = Math.max(qu[0] - pu[1], pu[0] - qu[1]), apartDown = Math.max(qv[0] - pv[1], pv[0] - qv[1]);
        // two steps keep the step between them across the frame; things of one step, and things joined to nothing, keep the gap
        assert.ok(apartAcross >= Math.min(up(step), up(gap)) - 1e-9 || apartDown >= up(gap) - 1e-9, `${p.name} and ${q.name}: ${apartAcross} across, ${apartDown} down`);
        const clear = Math.max(q.at[0] - (p.at[0] + p.size[0]), p.at[0] - (q.at[0] + q.size[0]), q.at[1] - (p.at[1] + p.size[1]), p.at[1] - (q.at[1] + q.size[1]));
        assert.ok(clear >= -1e-9, `${p.name} and ${q.name} stand on the same tiles`);
      }
    }
    const forward = read({ ...given, back: false }).links.filter(([u, v]) => u < v), b = arrange(things, forward, { gap, step, across: true });
    for (const [u, v] of forward) {
      const [fromAcross] = cornerwise(b.things.find((t) => t.name === u)), [toAcross] = cornerwise(b.things.find((t) => t.name === v));
      assert.ok(toAcross[0] >= fromAcross[1] + up(step) - 1e-9, `${u} to ${v}: ${JSON.stringify([fromAcross, toAcross])}`);
      seen.links += 1;
    }
    const linked = new Set(links.filter(([u, v]) => u !== v).flat());
    seen.joined += linked.size > 0; seen.loose += linked.size < things.length;
  }), { numRuns: 500, seed: 20261119 });
  for (const [kind, n] of Object.entries(seen)) assert.ok(n > 30, `${kind} was tried ${n} times`);
});

test('across the frame no step stands in front of the next, so a step is a tile whatever the heights; side by side keeps the gap the tallest asks for', () => {
  const grid = isometric({ tile: 120 });
  for (const high of [0, 1, 3]) {
    const [a, b] = arrange([thing('a', [2, 2, high]), thing('b', [2, 2, high])], [['a', 'b']], { across: true }).things;
    const left = grid.block(a).box, right = grid.block(b).box;
    assert.equal(right.x - (left.x + left.w), 120);   // a tile of clear frame between what the two draw: room for an arrow
  }
  const [, far, nearer] = arrange([thing('s', [2, 2, 0]), thing('far', [2, 2, 1]), thing('near', [2, 2, 2.4])], [['s', 'far'], ['s', 'near']], { across: true }).things;
  assert.ok(grid.block(nearer).top[0].y - grid.block(far).outline[3].y > 20, 'the floor shows between a thing and a taller one below it on the frame');
});

test('the READMEs say what arrange gives today', async () => {
  const { readFileSync } = await import('node:fs');
  const { things, cols, rows } = arrange(['you', 'dns', 'server', 'db'].map((name) => thing(name)), [['you', 'dns'], ['you', 'server'], ['server', 'db']]);
  const said = things.map((t) => `${t.name} [${t.at[0]}, ${t.at[1]}]`).join(' · ');
  assert.equal(said, 'you [0, 2] · dns [5, 0] · server [5, 4] · db [10, 4]');
  assert.deepEqual([cols, rows], [12, 6]);
  const folder = readFileSync(new URL('../src/isometric/README.md', import.meta.url), 'utf8'), main = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
  assert.ok(folder.includes(`// ${said}; the arrangement reaches 12 cols and 6 rows`));
  assert.ok(main.includes('you at [0, 2]: before the two it asks, in their middle · dns [5, 0] · server [5, 4] · db [10, 4]'));
});
