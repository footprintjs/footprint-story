// The map's steps (0.24.0): ISO_MAP_STEPS and buildIsoMap — what each step reads, writes and decides, the paint list it
// ends with, the refusals (each naming the piece's `who` and the fix), and that what comes out is frozen plain data
// and what went in is never edited. The map's numbers against StoryReel 0.38.0's build: isometric-map-differential.
import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { buildIsoMap, ISO_MAP_STEPS, ISO_MAP_POLICIES, ISO_MAP_LIMITS, isoStyle, isometric, paintPiece } from '../isometric.js';
import { restyle, shapePiece, paintShaped } from '../src/isometric/style.js';
import { readIsoMap, readIsoPolicy } from '../src/isometric/mapSpec.js';
import { pick } from '../src/isometric/mapSteps.js';
import { mapArb } from './isoMapSpecs.js';

const RUNS = Number(process.env.FC_RUNS) || 200;
const FILM = ISO_MAP_POLICIES.film, DECK = ISO_MAP_POLICIES.deck;
const TWO = Object.freeze({ blocks: [{ name: 'web', size: [2, 2, 1], label: 'Web', small: 'nginx' }, { name: 'db', kind: 'cylinder', size: [2, 2, 1], label: 'Database' }],
  wires: [{ from: { block: 'web' }, to: { block: 'db' } }], floors: [{ label: 'Production' }], area: [0, 0, 1600, 900] });
const deepFrozen = (v) => v === null || typeof v !== 'object' || (Object.isFrozen(v) && Object.values(v).every(deepFrozen));

test('the steps run in the design\'s order, each naming what it reads and writes; the two that choose have a branch per choice', () => {
  assert.deepEqual(ISO_MAP_STEPS.map((s) => s.name), ['place', 'route', 'fitFloors', 'grid', 'shape', 'names', 'order', 'floorLabels', 'style']);
  assert.ok(Object.isFrozen(ISO_MAP_STEPS) && ISO_MAP_STEPS.every((s) => Object.isFrozen(s) && typeof s.about === 'string' && s.reads.length && s.writes.length));
  const [place, , , grid] = ISO_MAP_STEPS;
  assert.deepEqual([place.decides.key, Object.keys(place.branches)], ['placed', ['hand', 'build']]);
  assert.deepEqual([grid.decides.key, Object.keys(grid.branches)], ['grid', ['written', 'fitted', 'usual']]);
  // every key a step reads is the input's or an earlier step's: the order cannot be shuffled without a step finding nothing
  const known = new Set(['who', 'blocks', 'floors', 'wires', 'obstacles', 'keep', 'written', 'usualGrid', 'area', 'style', 'policy']);
  for (const step of ISO_MAP_STEPS) {
    for (const k of step.reads) assert.ok(known.has(k), `${step.name} reads ${k} before anything writes it`);
    for (const k of step.writes) { assert.ok(!known.has(k), `${step.name} writes ${k} again`); known.add(k); }
  }
});

test('a step that decides writes its choice and its reason as data', () => {
  const built = buildIsoMap(TWO, FILM);
  assert.deepEqual([built.placed, built.placedWhy], ['build', 'no block has an at: the build places them from their wires, across the frame']);
  assert.deepEqual([built.grid, built.gridWhy], ['fitted', 'no grid is written: it is fitted so the picture fills the area']);
  const one = buildIsoMap({ ...TWO, blocks: [{ ...TWO.blocks[0], group: 'g' }, { ...TWO.blocks[1], group: 'g' }] }, FILM);
  assert.match(one.placedWhy, /group by group \(1 group\)$/);
  const hand = buildIsoMap({ ...TWO, blocks: TWO.blocks.map((b, i) => ({ ...b, at: [i * 3, 0] })), grid: { tile: 100, origin: [800, 100] }, area: null }, FILM);
  assert.deepEqual([hand.placed, hand.grid, hand.at, hand.view.tile], ['hand', 'written', [[0, 0, 0], [3, 0, 0]], [100, 50]]);
  assert.match(hand.placedWhy, /^every block has an at/); assert.match(hand.gridWhy, /^the map writes its grid in numbers/);
  // a step's own run does its choice and its branch, as the chart's decider and branch stages do
  const placed = ISO_MAP_STEPS[0].run(pick(readIsoMap(TWO, FILM), ISO_MAP_STEPS[0].reads));
  assert.deepEqual([placed.placed, placed.at], ['build', built.at]);
});

test('the built map is frozen plain data, the same after a structured copy; what went in is not edited', () => {
  fc.assert(fc.property(mapArb, (spec) => {
    const before = structuredClone(spec), map = buildIsoMap(spec, FILM);
    assert.deepStrictEqual(spec, before);
    assert.ok(deepFrozen(map));
    assert.deepStrictEqual(structuredClone(map), map);
    assert.ok(!JSON.stringify(map, (k, v) => { assert.notEqual(typeof v, 'function'); return v; }).includes('"function'));
  }), { numRuns: RUNS });
});

test('each step is pure: handed a frozen state it gives a new one, the same each time, never edits it, and keeps nothing it was not asked to write', () => {
  fc.assert(fc.property(mapArb, (spec) => {
    let state = readIsoMap(spec, FILM);
    for (const step of ISO_MAP_STEPS) {
      const handed = structuredClone(pick(state, step.reads)), frozen = structuredClone(handed);
      (function freeze(v) { if (v && typeof v === 'object') { Object.freeze(v); Object.values(v).forEach(freeze); } }(frozen));
      const out = step.run(frozen), again = step.run(structuredClone(handed));
      assert.deepStrictEqual(frozen, handed, `${step.name} edited what it was handed`);
      assert.deepStrictEqual(pick(out, step.writes), pick(again, step.writes), `${step.name} is not the same each time`);
      for (const k of step.writes) assert.ok(Object.hasOwn(out, k), `${step.name} did not write ${k}`);
      state = { ...state, ...pick(out, step.writes) };
    }
    assert.deepStrictEqual(state, structuredClone(buildIsoMap(spec, FILM)));
  }), { numRuns: Math.ceil(RUNS / 4) });
});

test('the shape is the style\'s shape column, and the paint list the rest of it: together, paintPiece\'s list', () => {
  const rows = fc.record({ line: fc.constantFrom('ink', 'none', { name: 'ink', width: 5 }) });
  const colours = fc.option(fc.record({ base: fc.option(fc.constantFrom('#d9e4f3', '#abc'), { nil: null }), ink: fc.option(fc.constantFrom('#14181f'), { nil: null }) }), { nil: null });
  fc.assert(fc.property(mapArb, rows, colours, colours, (spec, row, blockColours, floorColours) => {
    const map = buildIsoMap({ ...spec, style: row, blocks: spec.blocks.map((b) => ({ ...b, colours: blockColours })), floors: spec.floors.map((f) => ({ ...f, colours: floorColours })) }, FILM);
    const style = isoStyle(row), grid = isometric(map.view);
    map.blocks.forEach((b, i) => {
      const painted = paintPiece(style, { name: b.name, kind: b.kind, at: map.at[i], size: b.size }, grid, blockColours);
      assert.deepStrictEqual([map.shapes[i].box, map.shapes[i].centre, map.shapes[i].outline, map.paints[i]], [painted.box, painted.centre, painted.outline, painted.items]);
      assert.deepStrictEqual(map.shapes[i].faces, shapePiece(style, { name: b.name, kind: b.kind, at: map.at[i], size: b.size }, grid, blockColours).items);
    });
    map.floors.forEach((f, i) => {
      const painted = paintPiece(style, { name: f.name ?? `floors[${i}]`, kind: 'floor', ...map.floorTiles[i] }, grid, floorColours);
      assert.deepStrictEqual(map.floorPaints[i], painted.items);
    });
  }), { numRuns: Math.ceil(RUNS / 4) });
  // a style is made again from its record with the same choices and seeds; a floor with no name is named by its place
  const style = isoStyle({ line: { name: 'ink', width: 3 }, effects: [] });
  assert.deepEqual(restyle(style), style);
  assert.deepEqual(restyle({ row: { line: 'none' }, options: {} }).row.line, 'none');
  assert.equal(buildIsoMap({ ...TWO, floors: [{ label: 'Production' }] }, FILM).floorPaints[0][0].of, 'floors[0]');
  assert.throws(() => restyle(null), /a style's record is \{row, options\}/);
  assert.throws(() => restyle({ row: [], options: {} }), /a style's record is \{row, options\}/);
  assert.throws(() => shapePiece({ row: {} }, { name: 'a', at: [0, 0], size: [1, 1, 1] }, isometric()), /shapePiece takes a style isoStyle made/);
  assert.throws(() => shapePiece(style, { name: 'a', at: [0, 0], size: [1, 1, 1] }, {}), /shapePiece draws on a map's grid/);
  assert.throws(() => paintShaped(style, { name: 'a', at: [0, 0], size: [1, 1, 1] }, 'faces'), /items gives back a paint list/);
});

test('the deck\'s policy: the small line left as written, and only a group\'s floor held by a fitted picture', () => {
  const film = buildIsoMap(TWO, FILM), deck = buildIsoMap(TWO, DECK);
  assert.ok(film.smalls[0]); assert.deepEqual(deck.smalls, [null, null]);
  // the labelled floor (fitted round everything, wires too) is held by the film's picture, not by the deck's: the deck's tile is no smaller
  assert.ok(deck.view.tile[0] >= film.view.tile[0]);
  const big = { ...TWO, floors: [{ at: [-20, -20], size: [60, 60], label: 'Everything' }] };
  assert.ok(buildIsoMap(big, DECK).view.tile[0] > buildIsoMap(big, FILM).view.tile[0]);
  assert.deepEqual(readIsoPolicy({ ...FILM, small: null }).small, null);
});

test('refusals name the piece by its who, and the fix', () => {
  const refused = (spec, re, policy = FILM) => assert.throws(() => buildIsoMap(spec, policy), (e) => { assert.match(e.message, /^isometric: /); assert.match(e.message, re); return true; });
  const b = (extra = {}) => ({ name: 'web', size: [2, 2, 1], who: 'data-iso="block" ("web")', ...extra });
  refused(null, /a map is \{blocks, floors, wires, obstacles, keep, grid, usualGrid, area, style, who\}/);
  refused({ blocks: [], area: [0, 0, 10, 10] }, /the map draws blocks on a floor — give it blocks/);
  refused({ blocks: [b()], area: [0, 0, 10, 10], who: 'stage map', colour: 1 }, /^isometric: stage map takes blocks, floors, wires, obstacles, keep, grid, usualGrid, area, style, who — not "colour"/);
  refused({ blocks: [b({ lable: 'x' })], area: [0, 0, 10, 10] }, /blocks\[0\] takes name, kind, at, size, label/);
  refused({ blocks: [b({ size: [2, 2] })], area: [0, 0, 10, 10] }, /data-iso="block" \("web"\): a block's size is \[wide, deep, high\]/);
  refused({ blocks: [b({ kind: 'cone' })], area: [0, 0, 10, 10] }, /\("web"\): kind is block or cylinder — not "cone"/);
  refused({ blocks: [b({ kind: 'cylinder', size: [2, 1, 1] })], area: [0, 0, 10, 10] }, /a cylinder is round/);
  refused({ blocks: [b({ small: 'x' })], area: [0, 0, 10, 10] }, /small is the line under its label — give it a label too/);
  refused({ blocks: [b({ rule: 'fill' })], area: [0, 0, 10, 10] }, /rule says how its label breaks onto two lines — give it a label too/);
  refused({ blocks: [b({ label: 'x', rule: 'tidy' })], area: [0, 0, 10, 10] }, /rule is how its label breaks onto two lines, "even" or "fill" — not "tidy"/);
  refused({ blocks: [b({ label: '  ' })], area: [0, 0, 10, 10] }, /label is words/);
  refused({ blocks: [b({ label: 'x'.repeat(2001) })], area: [0, 0, 10, 10] }, /label is at most 2000 letters — this one has 2001/);
  refused({ blocks: [b()], floors: [{ at: [0, 0], size: [2, 2], label: 'x'.repeat(121) }], area: [0, 0, 10, 10] }, /floors\[0\]: label is at most 120 letters/);
  refused({ blocks: [b({ name: '' })], area: [0, 0, 10, 10] }, /blocks\[0\]'s name is 1 to 64 letters/);
  refused({ blocks: [b({ who: '' })], area: [0, 0, 10, 10] }, /'s who is the tool's words/);
  refused({ blocks: [b({ ports: [{ name: 'p', at: [5, 0, 0] }] })], area: [0, 0, 10, 10] }, /data-iso="block" \("web"\): "web"'s port "p" is at \[5,0,0\], outside/);
  refused({ blocks: [b({ colours: { base: 'red' } })], area: [0, 0, 10, 10] }, /colours' base is a colour/);
  refused({ blocks: [b({ colours: 'red' })], area: [0, 0, 10, 10] }, /colours is \{base, ink\}/);
  refused({ blocks: [b(), b()], area: [0, 0, 10, 10] }, /"web" is the name of data-iso="block" \("web"\) too — a camera frames a piece by its name/);
  refused({ blocks: [b(), { name: 'floors[0]', size: [1, 1, 1] }], floors: [{}], area: [0, 0, 10, 10] }, /"floors\[0\]" is the name of/);
  refused({ blocks: [b({ at: [0, 0] }), { name: 'db', size: [1, 1, 1] }], area: [0, 0, 10, 10] }, /"db" has no at and "web" has one: the blocks are placed from the wires only when none has an at/);
  refused({ blocks: [b()], floors: [{ group: 'x', who: 'floor 1' }], area: [0, 0, 10, 10] }, /floor 1: its group "x" has no block/);
  refused({ blocks: [b()], floors: [{ at: [0, 0] }], area: [0, 0, 10, 10] }, /floors\[0\]: a floor gives its at and its size/);
  refused({ blocks: [b()], floors: [{ at: [0, 0], size: [1.5, 2] }], area: [0, 0, 10, 10] }, /size is \[cols, rows\], whole numbers 1 to 256/);
  refused({ blocks: [b()], floors: [{ name: 7 }], area: [0, 0, 10, 10] }, /floors\[0\]'s name is 1 to 64 letters, or null/);
  refused({ blocks: [b(), { name: 'db', size: [1, 1, 1] }], wires: [{ from: { block: 'web' }, to: { block: 'dbx' }, who: 'wire 1' }], area: [0, 0, 10, 10] }, /wire 1: to names "dbx", which is no block here — the blocks are "web", "db"/);
  refused({ blocks: [b(), { name: 'db', size: [1, 1, 1] }], wires: [{ from: { block: 'web', port: 'p9' }, to: { block: 'db' } }], area: [0, 0, 10, 10] }, /from: "web" has no port "p9" — give it ports/);
  refused({ blocks: [b({ ports: [{ name: 'p1', at: [2, 1, 0] }] }), { name: 'db', size: [1, 1, 1] }], wires: [{ from: { block: 'web', port: 'p9' }, to: { block: 'db' } }], area: [0, 0, 10, 10] }, /its ports are "p1"/);
  refused({ blocks: [b({ ports: [{ name: 'p1', at: [2, 1, 0] }] }), { name: 'db', size: [1, 1, 1] }], wires: [{ from: { block: 'web', port: 'p1' }, to: { block: 'db' }, straight: true }], area: [0, 0, 10, 10] }, /a wire to a port runs along the floor, and a straight one does not/);
  refused({ blocks: [b()], wires: [{ from: { block: 'web' }, to: { block: 'web' } }], area: [0, 0, 10, 10] }, /it joins "web" to itself/);
  refused({ blocks: [b(), { name: 'db', size: [1, 1, 1] }], wires: [{ from: { block: 'web' }, to: { block: 'db' }, straight: 'yes' }], area: [0, 0, 10, 10] }, /straight is true .* or false/);
  refused({ blocks: [b()], wires: [{ from: 'web', to: { block: 'web' } }], area: [0, 0, 10, 10] }, /wires\[0\]: from is an object of block, port/);
  refused({ blocks: [b()] }, /the map gives an area to fit its picture into/);
  refused({ blocks: [b()], area: [10, 0, 0, 10] }, /area is \[x0, y0, x1, y1\] with x1 past x0/);
  refused({ blocks: [b()], grid: { tile: 10, origin: [0, 0], rise: -1 } }, /the map's grid: rise is a unit of height/);
  refused({ blocks: [b()], grid: { tile: 10 } }, /the map's grid gives its origin too/);
  refused({ blocks: [b()], grid: { tile: 10, origin: [0] } }, /the map's grid: origin is/);
  refused({ blocks: [b()], area: [0, 0, 10, 10], style: { line: 'chalk' } }, /the map's style: the style's line has no choice "chalk"/);
  refused({ blocks: Array.from({ length: 200 }, (_, i) => b({ name: `b${i}` })), floors: Array.from({ length: 57 }, () => ({})), area: [0, 0, 10, 10] }, /holds at most 256 blocks, floors and obstacles, and this one has 257 — split it into two maps/);
  refused({ blocks: [b()], wires: { length: 2000 }, area: [0, 0, 10, 10] }, /the map's wires is a list/);
  refused({ blocks: [b()], wires: new Array(ISO_MAP_LIMITS.wires + 1), area: [0, 0, 10, 10] }, /wires holds at most 1024, and this one has 1025/);
  refused({ blocks: [b()], wires: [, 1], area: [0, 0, 10, 10] }, /has a hole at 1/);   // eslint-disable-line no-sparse-arrays
  // a getter is never run
  const sly = b(); Object.defineProperty(sly, 'label', { get() { throw new Error('ran'); }, enumerable: true });
  refused({ blocks: [sly], area: [0, 0, 10, 10] }, /'s label is read as a stored value, and this one is a getter/);
  // what the build cannot do is said in the map's words with the fix
  refused({ blocks: [b({ at: [0, 0] }), b({ name: 'db', at: [400, 0] })], floors: [{ who: 'the ground' }], area: [0, 0, 1600, 900] }, /^isometric: the ground: fitted round its blocks the floor would be 404 by 4 tiles, and a floor is at most 256 a side — give it an at and a size/);
  refused({ blocks: [b({ at: [0, 0] })], floors: [{ at: [999998, 0], size: [5, 1], label: 'x', who: 'far floor' }], grid: { tile: 100, origin: [0, 0] } }, /^isometric: far floor: at\(col, row, height\?\) takes numbers/);
  refused({ blocks: [b({ at: [500000, 0] })], area: [0, 0, 1600, 900], who: 'stage map' }, /^isometric: stage map: its picture \(fitted into the area\): origin is/);
});

test('the policy is refused in words: each number, its range, the hold', () => {
  const bad = (policy, re) => assert.throws(() => buildIsoMap(TWO, policy), re);
  bad(null, /the map policy is an object of fit, name, small, clear, hold/);
  bad({ ...FILM, extra: 1 }, /the map policy takes fit, name, small, clear, hold, cover — not "extra"/);
  bad({ ...FILM, fit: { ...FILM.fit, most: 1 } }, /fit most is a tile's most px, 2 or more — not 1/);
  bad({ ...FILM, fit: { ...FILM.fit, least: 200 } }, /least and grouped no more than most/);
  bad({ ...FILM, fit: { ...FILM.fit, margin: 0.5 } }, /fit margin is the tiles a fitted floor shows/);
  bad({ ...FILM, fit: { ...FILM.fit, inset: -1 } }, /fit inset is the px/);
  bad({ ...FILM, fit: { ...FILM.fit, grouped: Infinity } }, /fit grouped is/);
  bad({ ...FILM, name: { size: 10, least: 20 } }, /name least is px above 0 and no more than its size \(10\)/);
  bad({ ...FILM, small: undefined }, /the map policy's small \(or null: the small line left as written\) is an object of size, least/);
  bad({ ...FILM, clear: 2 }, /clear is the share of a top's room a name is given/);
  bad({ ...FILM, hold: 'all' }, /hold is "groups" or "groups-and-labels"/);
});

test('the numbers the policies hold, and the limits', () => {
  assert.deepEqual(DECK, { fit: { most: 160, least: 96, grouped: 64, inset: 40, margin: 1 }, name: { size: 26, least: 16 }, small: null, clear: 0.9, hold: 'groups', cover: 'block' });
  assert.ok(Object.isFrozen(ISO_MAP_POLICIES) && Object.isFrozen(FILM.fit) && Object.isFrozen(ISO_MAP_LIMITS));
  assert.deepEqual(ISO_MAP_LIMITS, { pieces: 256, wires: 1024, keep: 512, name: 64, label: 2000, group: 100, who: 200 });
});

test('a name is counted in letters everywhere: 40 letters outside the BMP are 40, in the spec and in the style alike', async () => {
  const { buildIsoMap: build, ISO_MAP_POLICIES: P } = await import('../isometric.js');
  const long = '\u{1D49C}'.repeat(40);
  const map = build({ blocks: [{ name: long, size: [2, 2, 1] }], floors: [{ name: `f${long}`.slice(0, 1) + long.slice(2), at: [0, 0], size: [3, 3] }], area: [0, 0, 1600, 900] }, P.film);
  assert.equal(map.paints[0][0].of, long);
});

test('a who is counted in letters too: 200 letters outside the BMP are 200, and one more is refused', async () => {
  const { buildIsoMap: build, ISO_MAP_POLICIES: P, ISO_MAP_LIMITS: L } = await import('../isometric.js');
  for (const letter of ['\u{1D49C}', '\u{1F642}']) {
    const at = letter.repeat(L.who), over = letter.repeat(L.who + 1);
    assert.equal(at.length, 2 * L.who, 'twice as many UTF-16 units as letters: the old count refused it');
    // at the limit: taken, and it is the words a refusal names the piece by
    assert.throws(() => build({ blocks: [{ name: 'web', size: [2, 2, 1], colours: { base: 'red' }, who: at }], area: [0, 0, 1600, 900] }, P.film), (e) => e.message.includes(`${at}: colours' base is a colour`));
    assert.doesNotThrow(() => build({ blocks: [{ name: 'web', size: [2, 2, 1], who: at }], who: at, area: [0, 0, 1600, 900] }, P.film));
    // one over: refused, for a piece and for the map
    assert.throws(() => build({ blocks: [{ name: 'web', size: [2, 2, 1], who: over }], area: [0, 0, 1600, 900] }, P.film), /blocks\[0\] \("web"\)'s who is the tool's words for where it was written, 1 to 200 letters/);
    assert.throws(() => build({ blocks: [{ name: 'web', size: [2, 2, 1] }], who: over, area: [0, 0, 1600, 900] }, P.film), /the map's who is the tool's words .*1 to 200 letters/);
  }
});

test('restyle makes a style again from a built map\'s record, with a tool\'s own choices handed again', async () => {
  const { isoStyle: style, restyle: again, paintPiece: paint, isometric: iso } = await import('../isometric.js');
  const mark = { column: 'texture', name: 'test:mark', apply: (items, { piece }) => [...items, { item: 'lines', role: 'mark', of: piece.name, segments: [[0, 0, 1, 1]], fill: null, stroke: null }] };
  const made = style({ texture: 'test:mark' }, { choices: [mark] }), record = structuredClone(made);
  assert.throws(() => again(record), /the style's texture has no choice "test:mark"/);
  const piece = { name: 'a', kind: 'block', at: [0, 0], size: [1, 1, 1] }, grid = iso({ tile: 100 });
  assert.deepEqual(paint(again(record, { choices: [mark] }), piece, grid), paint(made, piece, grid));
});
