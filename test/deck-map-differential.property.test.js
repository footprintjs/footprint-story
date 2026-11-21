// The map's steps (0.25.0) build StoryDeck's maps: pinned against a copy of StoryDeck 0.32.0's map code
// (test/control/storydeck-0.32.0-iso.js and its siblings) under the deck's policy, for random deck maps — blocks placed
// by hand and by the build, groups with and without blocks, cylinders, footprints (obstacles), floor kept clear (keep),
// labelled floors with and without icons, written, fitted and usual grids, ports. Compared exactly: the grid (each floor
// point it gives), every block's and footprint's place, outline and middle, the paint order (the deck's levels), every
// floor's tiles and label place (watched where the deck asks them: test/deckDoor.js), each route, each name's fit.
// What stays the deck's (its HTML, its names, the px it writes) is the deck's; the numbers are the same.
// FC_RUNS=20000 npm test runs a deep sweep.
import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { isoDrawn } from './control/storydeck-0.32.0-iso.js';
import { layRoutes, reachOf } from './control/storydeck-0.32.0-cable.js';
import { seen, watch } from './deckDoor.js';
import { buildIsoMap, isometric, ISO_MAP_POLICIES } from '../isometric.js';
import { deckMapArb, writeDeckMap } from './deckMaps.js';

const RUNS = Number(process.env.FC_RUNS) || 300;
const DECK = ISO_MAP_POLICIES.deck;

/** The deck's map, built as its compile builds it (transforms.js · transformed: the wires laid by `lay`, their paths for a floor's label). */
function deckBuilds({ html, options, links, layLinks }) {
  let routes = null;
  const lay = (solids, keep = []) => { routes = layRoutes(layLinks, solids, keep); return reachOf(routes); };
  const lines = () => (routes ?? []).filter((r) => r?.route.path).map((r) => r.route.path.map(([col, row, high]) => [col, row, high ?? r.lift]));
  watch();
  const drawn = isoDrawn(html, { ...options, links, lay, lines });
  return { drawn, routes, floors: [...seen.floors], labels: [...seen.labels] };
}

/** The <b> a block's name is written in, as the deck drew it: the first after the block's own tag. */
const nameTag = (html, name) => { const at = html.indexOf(`data-k="${name}"`); return at < 0 ? null : /<b(?: style="[^"]*")?>[^]*?<\/b>/.exec(html.slice(at))?.[0] ?? null; };
const POINTS = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1], [3.5, -2, 0.7], [-4, 7, 2]];

/** One deck map built both ways: the same numbers, or both refused. */
function same(map) {
  let deck = null, refused = null, spec = null;
  try { spec = { ...map.spec, keep: map.spec.keep() }; deck = deckBuilds(map); } catch (e) { refused = e; }
  if (refused) {
    // a refusal of the deck's own HTML words (keep-clear boxes worked out by the adapter) never reaches the steps
    if (spec) assert.throws(() => buildIsoMap(spec, DECK), /^Error: isometric: /, `the deck refused (${refused.message}); so must buildIsoMap`);
    return null;
  }
  const m = buildIsoMap(spec, DECK), { drawn } = deck, grid = isometric(m.view);
  // how the map was made, and the grid: each floor point the deck's grid gives, ours gives
  assert.deepEqual([drawn.made.placed, drawn.made.fitted, drawn.made.tile], [m.placed, m.grid === 'fitted', m.view.tile[0]]);
  for (const p of POINTS) { const q = grid.at(...p); assert.deepEqual(drawn.floor(...p), [q.x, q.y], `the grid at ${p}`); }
  // every block and footprint: where it stands, its outline and middle, its paint level (2 for the furthest, then 4, …)
  const ours = [...m.blocks.map((b, i) => ({ name: b.name, kind: b.kind, at: m.at[i], size: b.size, ports: b.ports, shape: m.shapes[i] })),
    ...m.obstacles.map((o, j) => ({ name: o.name, kind: 'footprint', at: o.at, size: o.size, ports: o.ports, shape: m.obstacleShapes[j] }))];
  assert.equal(drawn.solids.length, ours.length);
  drawn.solids.forEach((s, i) => {
    const o = ours[i], box = o.shape.box;
    assert.deepEqual({ name: s.name, kind: s.kind, at: s.at, size: s.size, ports: s.ports, outline: s.outline, middle: s.middle, level: s.level },
      { name: o.name, kind: o.kind, at: o.at, size: o.size, ports: o.ports, outline: o.shape.outline, middle: [box.x + box.w / 2, box.y + box.h / 2], level: 2 * (m.order.indexOf(o.name) + 1) }, o.name);
  });
  // every floor's tiles, in the order written, and every label's place
  assert.deepEqual(deck.floors, m.floorTiles.map(({ at, size }) => ({ cols: size[0], rows: size[1], at })));
  const labelled = m.floors.flatMap((f, i) => (f.label === null ? [] : [i]));
  assert.deepEqual(deck.labels.map((l) => [l.floor, l.text, Boolean(l.options?.icon), l.place]), labelled.map((i) => [m.floorTiles[i], m.floors[i].label, m.floors[i].icon, m.floorLabels[i]]));
  // each wire's route along the floor, or none
  assert.deepStrictEqual((deck.routes ?? m.routes.map(() => null)).map((r) => r?.route ?? null), m.routes);
  // each name's fit: as written when it fits on one line at its size, else broken and sized; one that does not fit is said
  m.blocks.forEach((b, i) => {
    const f = m.names[i];
    if (!f) return;
    const plain = f.lines.length === 1 && f.size === DECK.name.size;
    assert.equal(nameTag(drawn.html, b.name), plain ? `<b>${b.label}</b>` : `<b${f.size === DECK.name.size ? '' : ` style="font-size:${f.size}px"`}>${f.lines.join('<br>')}</b>`, b.name);
  });
  assert.deepEqual(drawn.tight.filter((t) => !t.on).map((t) => t.name).sort(), m.blocks.filter((_, i) => m.names[i] && !m.names[i].fits).map((b) => b.name).sort());
  return m;
}

test('buildIsoMap builds the map StoryDeck 0.32.0 drew, for random deck maps and the deck\'s policy', () => {
  fc.assert(fc.property(deckMapArb, (map) => { if (map) same(map); }), { numRuns: RUNS });
});

/** A deck map from its parts, every one left out written as nothing. */
const deckMap = (m) => writeDeckMap({ canvas: [1920, 1080], area: null, byHand: true, grouped: false, order: [], grid: 'none', blocks: [], floors: [], feet: [], keep: [], wires: [], ...m });
const block = (extra = {}) => ({ kind: 'block', sized: true, wide: 2, deep: 2, high: 1, at: [0, 0, null], label: 'Web server', rule: null, group: null, ports: 0, ...extra });

test('each case the property covers is met: the usual grid, a footprint and kept floor, a cylinder covering a label by its block, an icon, a group named only by a floor', () => {
  // placed by hand, no grid written: the deck's usual grid, tile 120 at the slide's middle, 240 px down
  const usual = same(deckMap({ blocks: [block(), block({ kind: 'cylinder', at: [4, 0, null], label: 'Database' })], floors: [{ given: 'none', at: [0, 0], size: [1, 1], label: 'Production account', icon: true, group: null }],
    feet: [{ at: [0, 4], size: [2, 1, 0.3], ports: 1 }], keep: [{ x: 900, y: 420, w: 200, h: 40 }], wires: [{ a: 0, b: 1, straight: false, portA: false, portB: false }, { a: 2, b: 0, straight: false, portA: true, portB: false }] }));
  assert.deepEqual([usual.placed, usual.grid, usual.view.tile, usual.view.origin], ['hand', 'usual', [120, 60], [960, 240]]);
  assert.equal(usual.gridWhy, 'no grid is written and the map placed its blocks: it is the usual grid the tool handed in');
  assert.ok(usual.routes[1].ports[0] === 'p1' && usual.routes.every((r) => Array.isArray(r.under)));
  // words kept clear across the only way between two blocks: the wire runs under them, and its route names them
  const under = same(deckMap({ blocks: [block({ label: null }), block({ label: null, at: [6, 0, null] })], keep: [{ x: 960, y: 200, w: 240, h: 400 }], wires: [{ a: 0, b: 1, straight: false, portA: false, portB: false }] }));
  assert.deepEqual(under.routes[0].under, ['k0']);
  assert.ok(usual.obstacleShapes.length === 1 && usual.order.includes('fp0') && usual.floorLabels[0]);
  // the map asks for the fitted grid; the build places the blocks (fitted, not the usual grid); a written grid
  assert.equal(same(deckMap({ grid: 'fit', blocks: [block(), block({ at: [4, 1, null] })] })).gridWhy, 'the map asks for its grid fitted: it is fitted so the picture fills the area');
  const built = same(deckMap({ byHand: false, grouped: true, blocks: [block({ group: 'front' }), block({ group: 'back' })], floors: [{ given: 'none', at: [0, 0], size: [1, 1], label: 'Back', icon: false, group: 'back' }], wires: [{ a: 0, b: 1, straight: true, portA: false, portB: false }] }));
  assert.deepEqual([built.placed, built.grid, built.routes], ['build', 'fitted', [null]]);
  assert.match(built.gridWhy, /the build placed the blocks: it is fitted so the picture fills the area, not drawn on the usual grid/);
  assert.equal(same(deckMap({ grid: { tile: 100, tall: 40, x: 800, y: 100, rise: 50 }, blocks: [block()] })).grid, 'written');
  // a group named only by a sized floor: a map of groups, fitted down to the grouped tile (the deck's rule)
  const far = { grid: 'fit', blocks: [block(), block({ at: [80, 0, null] })] };
  assert.equal(same(deckMap(far)).view.tile[0], 96);
  assert.equal(same(deckMap({ ...far, floors: [{ given: 'size', at: [0, 0], size: [9, 4], label: null, icon: false, group: 'spare' }] })).view.tile[0], 64);
  // a 30-word name: the deck draws it broken and at its least size, and says it does not fit (tight); so do the steps
  const long = same(deckMap({ blocks: [block({ label: Array.from({ length: 30 }, (_, i) => `word${i}`).join(' ') })] }));
  assert.equal(long.names[0].fits, false);
  // floors alone on the usual grid: the grid's reason says the map has no blocks
  assert.match(same(deckMap({ floors: [{ given: 'size', at: [0, 0], size: [4, 4], label: null, icon: false, group: null }] })).gridWhy, /the map has no blocks: it is the usual grid/);
  // a footprint on a labelled floor's front edge: the label moves along clear of it, as the deck moves it
  const edge = { blocks: [block({ at: [30, 0, null] })], floors: [{ given: 'both', at: [0, 0], size: [6, 3], label: 'Production account', icon: false, group: null }] };
  assert.notDeepEqual(same(deckMap({ ...edge, feet: [{ at: [-1, 2], size: [2, 1, 0.3], ports: 0 }] })).floorLabels[0], same(deckMap(edge)).floorLabels[0]);
  // floors alone, on the usual grid; a cylinder beside a labelled floor, its box (not its round edge) what the label keeps clear of
  assert.equal(same(deckMap({ floors: [{ given: 'size', at: [0, 0], size: [6, 3], label: 'Empty', icon: false, group: null }] })).placed, 'hand');
  const round = same(deckMap({ blocks: [block({ kind: 'cylinder', wide: 2, at: [0, 0.5, null] })], floors: [{ given: 'both', at: [0, 0], size: [6, 3], label: 'Production account', icon: false, group: null }] }));
  const drawnCover = buildIsoMap({ blocks: round.blocks, floors: round.floors, usualGrid: round.usualGrid }, { ...DECK, cover: 'drawn' });
  assert.notDeepEqual(round.floorLabels[0], drawnCover.floorLabels[0], 'a round edge covers less of the label than the cylinder\'s box');
  // what both refuse: a fitted grid with nothing on the floor, a floor fitted round a group with no block
  assert.equal(same(deckMap({ grid: 'fit', floors: [{ given: 'size', at: [0, 0], size: [3, 3], label: null, icon: false, group: null }] })), null);
  assert.equal(same(deckMap({ blocks: [block()], floors: [{ given: 'none', at: [0, 0], size: [1, 1], label: null, icon: false, group: 'spare' }] })), null);
});
