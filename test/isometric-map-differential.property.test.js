// The map's steps (0.24.0): buildIsoMap builds the map StoryReel 0.38.0 built — pinned against a copy of its build
// (test/control/storyreel-0.38.0-build.mjs) with the film's policy, for random maps: every block's at and shape (box,
// centre, outline, faces), its fitted name and small line, every floor's at, size, shape and label, every route, the
// grid and the paint order. StoryReel mutates the map it is handed and keeps closures on it; what is compared is the data.
// FC_RUNS=20000 npm test runs a deep sweep.
import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import * as reel0 from './control/storyreel-0.38.0-build.mjs';
import { buildIsoMap, ISO_MAP_POLICIES, readPorts } from '../isometric.js';
import { mapArb } from './isoMapSpecs.js';

const RUNS = Number(process.env.FC_RUNS) || 300;
const FILM = ISO_MAP_POLICIES.film;

/** The map as StoryReel 0.38.0's read.mjs gives it, from a spec: what the control's buildMap is handed. */
function readAsReel(given) {
  const spec = { wires: [], floors: [], area: null, grid: null, ...given, blocks: given.blocks.map((b) => ({ kind: 'block', at: null, label: null, small: null, rule: null, group: null, ports: [], who: b.name, ...b })) };
  const blocks = spec.blocks.map((b) => ({ name: b.name, kind: b.kind, at: b.at ? [b.at[0], b.at[1], b.at[2] ?? 0] : null, size: [...b.size], label: b.label, small: b.small, rule: b.rule, color: null, tone: null,
    group: b.group, ports: readPorts(b.ports, b.size, b.kind === 'cylinder', `"${b.name}"`).map(({ name, at, face, seen }) => ({ name, at: [...at], face, seen })), appear: null, path: 'x', who: b.who }));
  const block = (name) => blocks.find((b) => b.name === name);
  const wires = spec.wires.map((w) => ({ name: w.name, arrow: { from: { block: block(w.from.block), port: w.from.port ?? null }, to: { block: block(w.to.block), port: w.to.port ?? null }, straight: w.straight ?? false, bend: 0 }, who: w.who }));
  const floors = spec.floors.map((f) => ({ name: f.name ?? null, at: f.at ? [...f.at] : null, size: f.size ? [...f.size] : null, label: f.label ?? null, color: null, group: f.group ?? null, appear: null, path: 'x', who: f.who }));
  return { blocks, floors, wires, grid: spec.grid, area: spec.area ?? [0, 0, 1600, 900], strict: false, placed: blocks.some((b) => b.at === null) ? 'build' : 'hand' };
}

const pts = (list) => list.map(({ x, y }) => [x, y]);

/** What the control built, said as buildIsoMap says it. */
function reelSays(map) {
  return {
    placed: map.placed,
    at: map.blocks.map((b) => b.at),
    routes: map.wires.map((w) => w.route ?? null),
    floorTiles: map.floors.map((f) => ({ at: f.at, size: f.size })),
    view: { tile: [...map.grid.tile], origin: [...map.grid.origin], rise: map.grid.rise },
    shapes: map.blocks.map((b) => {
      const s = b.shape, faces = s.kind === 'cylinder'
        ? { top: [s.top.cx, s.top.cy, s.top.rx, s.top.ry], bottom: [s.bottom.cx, s.bottom.cy, s.bottom.rx, s.bottom.ry] }
        : { top: s.top, left: s.left, right: s.right };
      return { box: s.box, centre: s.centre, outline: s.outline, faces };
    }),
    names: map.blocks.map((b) => b.fitted),
    smalls: map.blocks.map((b) => b.smallFitted ?? null),
    order: map.order.map((b) => b.name),
    floorShapes: map.floors.map((f) => ({ outline: f.shape.outline, lines: f.shape.lines, box: f.shape.box })),
    floorLabels: map.floors.map((f) => f.place),
  };
}

/** What buildIsoMap built, in the control's words: the faces read back off the style's shape items. */
function oursSays(m) {
  const face = (items, role) => items.find((it) => it.role === role);
  return {
    placed: m.placed, at: m.at, routes: m.routes, floorTiles: m.floorTiles, view: m.view,
    shapes: m.blocks.map((b, i) => {
      const s = m.shapes[i], arc = b.kind === 'cylinder' ? face(s.faces, 'side').segments.find((g) => g[0] === 'arc') : null, top = face(s.faces, 'top');
      const faces = b.kind === 'cylinder' ? { top: [top.cx, top.cy, top.rx, top.ry], bottom: arc.slice(1, 5) } : { top: top.points, left: face(s.faces, 'left').points, right: face(s.faces, 'right').points };
      return { box: s.box, centre: s.centre, outline: s.outline, faces };
    }),
    names: m.names, smalls: m.smalls, order: m.order,
    floorShapes: m.floorShapes.map((s) => ({ outline: s.outline, lines: face(s.faces, 'grid').segments, box: s.box })),
    floorLabels: m.floorLabels,
  };
}

/** Both builds of one spec: equal data, or both refused. */
function same(spec) {
  let theirs = null, refused = null;
  try { theirs = reelSays(reel0.buildMap(readAsReel(spec), 'the map')); } catch (e) { refused = e; }
  if (refused) { assert.throws(() => buildIsoMap(spec, FILM), /isometric: /, `the control refused (${refused.message}); so must buildIsoMap`); return null; }
  const m = buildIsoMap(spec, FILM);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(oursSays(m))), JSON.parse(JSON.stringify(theirs)));
  // and exactly, not only as JSON: the same numbers to the last bit
  const ours = oursSays(m);
  for (const key of Object.keys(theirs)) assert.deepEqual(ours[key], theirs[key], key);
  return m;
}

test('the film policy is StoryReel 0.38.0\'s ISO_FIT, and a deck\'s differs only where a deck does', () => {
  const { most, least, grouped, inset, margin, name, small, clear } = reel0.ISO_FIT;
  assert.deepEqual(FILM, { fit: { most, least, grouped, inset, margin }, name: { ...name }, small: { ...small }, clear, hold: 'groups-and-labels' });
  assert.deepEqual({ ...ISO_MAP_POLICIES.deck, small: FILM.small, hold: FILM.hold }, FILM);
});

test('buildIsoMap builds the map StoryReel 0.38.0 built, for random maps and the film policy', () => {
  fc.assert(fc.property(mapArb, (spec) => { same(spec); }), { numRuns: RUNS });
});

test('each case the property covers is met: placed by build (with and without groups) and by hand, written and fitted grids, ports, straight wires, labelled floors, cylinders', () => {
  const two = [{ name: 'web', size: [2, 2, 1], label: 'Web', small: 'nginx', ports: [{ name: 'p1', at: [2, 1, 0] }] }, { name: 'db', kind: 'cylinder', size: [2, 2, 1.2], label: 'Database server', rule: 'fill' }, { name: 'q', size: [1, 3, 0.5] }];
  const wires = [{ from: { block: 'web', port: 'p1' }, to: { block: 'db' } }, { from: { block: 'db' }, to: { block: 'q' }, straight: true }, { from: { block: 'q' }, to: { block: 'web' } }];
  const floors = [{ label: 'Production account' }, { at: [0, 0], size: [9, 9], label: 'VPC' }];
  const built = same({ blocks: two, wires, floors, area: [0, 0, 1600, 900] });
  assert.equal(built.placed, 'build'); assert.equal(built.grid, 'fitted'); assert.equal(built.routes[1], null); assert.equal(built.routes[0].ports[0], 'p1');
  assert.ok(built.floorLabels.every(Boolean)); assert.ok(built.smalls[0]);
  const grouped = same({ blocks: two.map((b, i) => ({ ...b, group: i ? 'back' : 'front' })), wires, floors: [{ group: 'back', label: 'Back' }, ...floors], area: [0, 0, 1600, 900] });
  assert.match(grouped.placedWhy, /group by group \(2 groups\)/);
  const byHand = same({ blocks: two.map((b, i) => ({ ...b, at: [i * 4, i, 0] })), wires, floors, grid: { tile: 120, origin: [800, 200] } });
  assert.equal(byHand.placed, 'hand'); assert.equal(byHand.grid, 'written'); assert.deepEqual(byHand.view.tile, [120, 60]);
  same({ blocks: two.map((b, i) => ({ ...b, at: [i * 4, i, 0] })), wires, floors, grid: { tile: [120, 50], origin: [800, 200], rise: 40 } });
});

test('a map the control cannot build, buildIsoMap refuses too: a floor fitted past 256 tiles, wires between blocks at two heights', () => {
  same({ blocks: [{ name: 'a', at: [0, 0], size: [1, 1, 1] }, { name: 'b', at: [300, 0], size: [1, 1, 1] }], floors: [{ label: 'All' }], area: [0, 0, 1600, 900] });
  assert.throws(() => buildIsoMap({ blocks: [{ name: 'a', at: [0, 0], size: [1, 1, 1] }, { name: 'b', at: [300, 0], size: [1, 1, 1] }], floors: [{ who: 'the ground' }], area: [0, 0, 1600, 900] }, FILM), /^Error: isometric: the ground: fitted round its blocks the floor would be 303 by 3 tiles/);
  const lifted = same({ blocks: [{ name: 'a', at: [0, 0, 0], size: [1, 1, 1] }, { name: 'b', at: [3, 0, 1], size: [1, 1, 1] }], wires: [{ from: { block: 'a' }, to: { block: 'b' } }], area: [0, 0, 1600, 900] });
  assert.equal(lifted.routes[0].points, null);
});
