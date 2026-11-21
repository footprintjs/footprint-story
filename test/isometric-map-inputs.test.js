// The map's inputs added in 0.25.0 (docs/design/2026-11-map-flow.md · build order step 3): obstacles, keep, a floor's
// icon, the grid word 'fit', usualGrid, the policy's cover, a map with no block, a group named only by a floor — what
// each does, its words in the record, and its refusals (each naming the piece and the fix). The numbers against
// StoryDeck 0.32.0's isoDrawn: deck-map-differential.property.test.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildIsoMap, ISO_MAP_POLICIES, ISO_MAP_LIMITS, isometric } from '../isometric.js';
import { ISO_MAP_COVERS } from '../src/isometric/mapSpec.js';

const FILM = ISO_MAP_POLICIES.film, DECK = ISO_MAP_POLICIES.deck;
const USUAL = Object.freeze({ tile: 120, origin: [960, 240] });
const web = (extra = {}) => ({ name: 'web', at: [0, 0], size: [2, 2, 1], ...extra });
const db = (extra = {}) => ({ name: 'db', at: [5, 0], size: [2, 2, 1], ...extra });
const refused = (spec, re, policy = DECK) => assert.throws(() => buildIsoMap(spec, policy), (e) => { assert.match(e.message, /^isometric: /); assert.match(e.message, re); return true; });

test('the grid: written, asked fitted, fitted where the build placed the blocks, or the usual grid a tool hands in — each said in words', () => {
  const hand = { blocks: [web(), db()], usualGrid: USUAL, area: [0, 0, 1920, 1080] };
  const usual = buildIsoMap(hand, DECK);
  const g = isometric(USUAL);
  assert.deepEqual([usual.grid, usual.view], ['usual', { tile: [120, 60], origin: [960, 240], rise: g.rise }]);
  assert.equal(usual.gridWhy, 'no grid is written and the map placed its blocks: it is the usual grid the tool handed in');
  const asked = buildIsoMap({ ...hand, grid: 'fit' }, DECK);
  assert.deepEqual([asked.grid, asked.gridWhy], ['fitted', 'the map asks for its grid fitted: it is fitted so the picture fills the area']);
  const built = buildIsoMap({ ...hand, blocks: [web({ at: null }), db({ at: null })] }, DECK);
  assert.deepEqual([built.placed, built.grid, built.gridWhy], ['build', 'fitted', 'no grid is written and the build placed the blocks: it is fitted so the picture fills the area, not drawn on the usual grid']);
  const written = buildIsoMap({ ...hand, grid: { tile: 100, origin: [10, 20] } }, DECK);
  assert.deepEqual([written.grid, written.view.tile], ['written', [100, 50]]);
  // with no usual grid handed in, a map that places its own blocks is fitted, as 0.24.0 fitted it
  const film = buildIsoMap({ blocks: [web(), db()], area: [0, 0, 1920, 1080] }, FILM);
  assert.deepEqual([film.grid, film.gridWhy], ['fitted', 'no grid is written: it is fitted so the picture fills the area']);
  // the usual grid needs no area; a fitted one does
  assert.equal(buildIsoMap({ blocks: [web()], usualGrid: { tile: [100, 40], origin: [0, 0], rise: 30 } }, DECK).view.rise, 30);
  refused({ blocks: [web()], grid: 'fit', usualGrid: USUAL }, /the map gives an area to fit its picture into/);
});

test('a map with no block: floors alone on a written or usual grid; a fitted picture or a fitted floor needs something on the floor', () => {
  const alone = buildIsoMap({ floors: [{ at: [0, 0], size: [4, 3], label: 'Empty' }], usualGrid: USUAL }, DECK);
  assert.deepEqual([alone.placed, alone.placedWhy, alone.grid, alone.order], ['hand', 'the map has no blocks: nothing is placed', 'usual', []]);
  // its grid's reason says so too: it placed no blocks (the words land in the record)
  assert.equal(alone.gridWhy, 'no grid is written and the map has no blocks: it is the usual grid the tool handed in');
  assert.equal(buildIsoMap({ obstacles: [{ name: 'lap', at: [0, 0], size: [2, 1, 0] }], usualGrid: USUAL }, DECK).gridWhy, alone.gridWhy);
  refused({ floors: [{ at: [0, 0], size: [4, 3] }], area: [0, 0, 10, 10] }, /the map: a fitted grid is fitted to what stands on the floor, and this map has nothing — add a block, or write the grid in numbers/);
  refused({ floors: [{ who: 'the ground' }], usualGrid: USUAL }, /the ground: a floor with no size is fitted round what stands on it, and this map has nothing — give it an at and a size/);
  refused({ blocks: [], area: [0, 0, 10, 10] }, /the map draws blocks on a floor — give it blocks/);
  // a floor fitted round an obstacle alone
  const round = buildIsoMap({ obstacles: [{ name: 'lap', at: [2, 3], size: [2, 1, 0.3] }], floors: [{}], usualGrid: USUAL }, DECK);
  assert.deepEqual(round.floorTiles, [{ at: [1, 2], size: [4, 3] }]);
});

test('obstacles stand with the blocks: laid round and ended at, fitted round, kept clear of by a label, painted in order', () => {
  const lap = { name: 'lap', at: [2, 4], size: [2, 1, 0.3], ports: [{ name: 'rj45', at: [2, 0.5, 0] }] };
  const spec = { blocks: [web(), db()], obstacles: [lap], wires: [{ from: { block: 'lap', port: 'rj45' }, to: { block: 'db' } }, { from: { block: 'web' }, to: { block: 'db' } }], floors: [{ label: 'Production account' }], usualGrid: USUAL };
  const m = buildIsoMap(spec, DECK);
  assert.deepEqual([m.routes[0].from, m.routes[0].to, m.routes[0].ports[0]], ['lap', 'db', 'rj45']);
  assert.ok(m.order.includes('lap') && m.order.length === 3);
  // the floor fitted round it too: its row reaches 4 + 1, and the floor shows a tile past it
  assert.ok(m.floorTiles[0].at[1] + m.floorTiles[0].size[1] >= 6);
  const block = isometric(m.view).block({ at: lap.at, size: lap.size });
  assert.deepEqual(m.obstacleShapes[0], { box: { ...block.box }, centre: [block.centre.x, block.centre.y], outline: block.outline.map(({ x, y }) => [x, y]) });
  // a wire that would pass under it goes round: the same map without it lays the web–db wire its own way
  const crossing = { ...spec, obstacles: [{ name: 'card', at: [2.5, 2], size: [2, 1, 0.5] }], wires: [spec.wires[1]] };
  assert.notDeepEqual(buildIsoMap(crossing, DECK).routes[0].points, buildIsoMap({ ...crossing, obstacles: [] }, DECK).routes[0].points);
  // and a fitted picture holds it (a film may hand obstacles too)
  const fitted = buildIsoMap({ blocks: [web()], obstacles: [{ name: 'far', at: [40, 0], size: [1, 1, 0] }], area: [0, 0, 1600, 900] }, FILM);
  assert.ok(fitted.view.tile[0] < buildIsoMap({ blocks: [web()], area: [0, 0, 1600, 900] }, FILM).view.tile[0]);
});

test('keep: floor a wire keeps off where it can, each words named once in a route\'s under', () => {
  const spec = { blocks: [web(), db()], wires: [{ from: { block: 'web' }, to: { block: 'db' } }], usualGrid: USUAL };
  const free = buildIsoMap(spec, DECK);
  assert.equal(free.routes[0].under, undefined, 'no keep: routes as before');
  // the whole floor kept clear, in two stretches under one note: the wire has no way round, and says the note once
  const kept = buildIsoMap({ ...spec, keep: [{ at: [-4, -4], size: [16, 6], name: 'note' }, { at: [-4, 2], size: [16, 6], name: 'note' }] }, DECK);
  assert.deepEqual(kept.routes[0].under, ['note']);
  const none = buildIsoMap({ ...spec, keep: [{ at: [30, 30], size: [1, 1], name: 'far' }] }, DECK);
  assert.deepEqual([none.routes[0].under, none.routes[0].points], [[], free.routes[0].points]);
});

test('a floor\'s icon gives its label less room; the policy\'s cover says what a cylinder covers of it', () => {
  const floor = { at: [0, 0], size: [4, 3], label: 'Production account' };
  const plain = buildIsoMap({ blocks: [web({ at: [30, 0] })], floors: [floor], usualGrid: USUAL }, DECK), icon = buildIsoMap({ blocks: [web({ at: [30, 0] })], floors: [{ ...floor, icon: true }], usualGrid: USUAL }, DECK);
  assert.deepEqual([plain.floorLabels[0].lines, icon.floorLabels[0].lines], [['Production account'], ['Production', 'account']]);
  const round = { blocks: [{ name: 'db', kind: 'cylinder', at: [0, 0.5], size: [2, 2, 1] }], floors: [{ at: [0, 0], size: [6, 3], label: 'Production account' }], usualGrid: USUAL };
  const byBlock = buildIsoMap(round, DECK).floorLabels[0], byEdge = buildIsoMap(round, { ...DECK, cover: 'drawn' }).floorLabels[0];
  assert.deepEqual([byBlock.covered, byEdge.covered], [true, false]);
  assert.deepEqual(ISO_MAP_COVERS, ['drawn', 'block']);
  assert.equal(buildIsoMap(round, FILM).policy.cover, 'drawn');
});

test('a block\'s name as long as a page holds (2000 letters) is built and said not to fit, as a deck draws it', () => {
  const long = Array.from({ length: 30 }, (_, i) => `word${i}`).join(' ');
  const m = buildIsoMap({ blocks: [web({ label: long })], usualGrid: USUAL }, DECK);
  assert.deepEqual([m.names[0].fits, m.names[0].size, m.names[0].lines.length], [false, DECK.name.least, 2]);
  const most = buildIsoMap({ blocks: [web({ label: 'x '.repeat(1000).trim() + 'x' })], usualGrid: USUAL }, DECK);
  assert.equal(most.names[0].fits, false);
  assert.equal(ISO_MAP_LIMITS.label, 2000);
});

test('a group named only by a sized floor: allowed, and a map of groups (fitted down to the grouped tile)', () => {
  const far = { blocks: [web(), db({ at: [80, 0] })], area: [0, 0, 1920, 1080] };
  const area = buildIsoMap({ ...far, floors: [{ at: [0, 0], size: [9, 4], label: 'Spare', group: 'spare' }] }, DECK);
  assert.deepEqual([buildIsoMap(far, DECK).view.tile[0], area.view.tile[0]], [96, 64]);
  refused({ ...far, floors: [{ group: 'spare', who: 'floor 1' }] }, /floor 1: its group "spare" has no block — give blocks the group "spare", or take the group off the floor, or give the floor an at and a size of its own/);
});

test('the new inputs are refused in words, with the fix', () => {
  const two = { blocks: [web(), db()], usualGrid: USUAL };
  refused({ ...two, obstacles: [{ name: 'lap', at: [0, 4], size: [1, 1, 0], colour: 1 }] }, /obstacles\[0\] takes name, at, size, ports, who — not "colour"/);
  refused({ ...two, obstacles: [{ name: '', at: [0, 4], size: [1, 1, 0] }] }, /obstacles\[0\]'s name is 1 to 64 letters/);
  refused({ ...two, obstacles: [{ name: 'lap', at: [0, 4], size: [1, 1] }] }, /obstacles\[0\] \("lap"\): an obstacle's size is \[wide, deep, high\]/);
  refused({ ...two, obstacles: [{ name: 'lap', at: [0, 4], size: [1, 1, 0], ports: [{ name: 'p', at: [5, 0, 0] }] }] }, /"lap"'s port "p" is at \[5,0,0\], outside/);
  refused({ ...two, obstacles: [{ name: 'web', at: [0, 4], size: [1, 1, 0] }] }, /"web" is the name of blocks\[0\] \("web"\) too/);
  refused({ ...two, obstacles: [{ name: 'lap', at: [0, 4], size: [1, 1, 0] }], wires: [{ from: { block: 'lap', port: 'x' }, to: { block: 'web' } }] }, /from: "lap" has no port "x" — give it ports/);
  refused({ ...two, obstacles: [{ name: 'lap', at: [0, 4], size: [1, 1, 0] }], wires: [{ from: { block: 'pc' }, to: { block: 'web' } }] }, /names "pc", which is no block here — the blocks are "web", "db", the obstacles "lap"/);
  refused({ floors: [{ at: [0, 0], size: [2, 2] }], wires: [{ from: { block: 'pc' }, to: { block: 'web' } }], usualGrid: USUAL }, /the blocks are none/);
  refused({ blocks: [web({ at: null })], obstacles: [{ name: 'lap', at: [0, 4], size: [1, 1, 0], who: '"lap" (data-footprint)' }], area: [0, 0, 10, 10] }, /"lap" \(data-footprint\): an obstacle stands where the map puts it, and no block has an at: the build places the blocks only when nothing on the floor is placed by hand — give every block an at/);
  refused({ blocks: [web({ at: null })], keep: [{ at: [0, 0], size: [1, 1], name: 'n' }], area: [0, 0, 10, 10] }, /the map: keep names floor in tiles, and no block has an at/);
  refused({ ...two, keep: [{ at: [0, 0], size: [1, 1] }] }, /keep\[0\]: name is the words it keeps the floor clear under \(a route's under names them\), 1 to 64 letters — not undefined/);
  refused({ ...two, keep: [{ at: [0, 0], size: [1, 1], name: null }] }, /keep\[0\]: name is the words .* — not null/);
  refused({ ...two, keep: [{ at: [0, 0], size: [1, 1], name: 'x'.repeat(65) }] }, /keep\[0\]: name is the words .*1 to 64 letters/);
  refused({ ...two, keep: [{ at: [0, 0], size: [0, 1], name: 'n' }] }, /keep\[0\]: size is \[wide, deep\] in tiles, each above 0/);
  refused({ ...two, keep: [{ at: [0, 0], size: [1, 1], name: 'n', who: 'x' }] }, /keep\[0\] takes at, size, name — not "who"/);
  refused({ ...two, keep: [{ at: 'a', size: [1, 1], name: 'n' }] }, /keep\[0\]: a stretch kept clear's at is/);
  refused({ ...two, keep: new Array(ISO_MAP_LIMITS.keep + 1) }, /keep holds at most 512, and this one has 513/);
  refused({ ...two, floors: [{ at: [0, 0], size: [2, 2], label: 'A', icon: 'acc' }] }, /floors\[0\]: icon is true .* or false — not "acc"/);
  refused({ ...two, floors: [{ at: [0, 0], size: [2, 2], icon: true }] }, /floors\[0\]: icon goes before its label — give it a label too/);
  refused({ ...two, grid: 'fitted' }, /the map's grid is \{tile, origin, rise\?\} in numbers, the word "fit" .* — not "fitted"/);
  refused({ ...two, usualGrid: { tile: 120 } }, /the map's usualGrid gives its origin too/);
  refused({ ...two, usualGrid: { tile: [10, 20], origin: [0, 0] } }, /the map's usualGrid: a tile is wider than it is tall/);
  refused(two, /the map policy's cover is "drawn" or "block" .* — not "round"/, { ...DECK, cover: 'round' });
  refused({ blocks: Array.from({ length: 200 }, (_, i) => web({ name: `b${i}` })), obstacles: Array.from({ length: 57 }, (_, i) => ({ name: `o${i}`, at: [0, 0], size: [1, 1, 0] })), usualGrid: USUAL }, /holds at most 256 blocks, floors and obstacles, and this one has 257/);
});
