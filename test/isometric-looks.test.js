// Named looks (0.34.0): `outlined` (a bold even contour, lighter inner lines) and `line-art` (paper faces, ink lines in a
// weight hierarchy), each a style row under a name (ISO_LOOKS), built from two new choices — line "contour" and shading
// "paper" — that give only paint items the tools already draw. Pinned: each look's paint list, its geometry to 1e-6,
// a look named and its row written out are the same style (row, seeds, strokes), the refusals with their fix, the
// record, the README's stills, and the faces never move, for any piece on any grid.
// FC_RUNS=5000 npm test runs a deeper sweep.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import fc from 'fast-check';
import { isometric, isoStyle, paintPiece, restyle, buildIsoMap, ISO_LOOKS, CONTOUR, ISO_MAP_POLICIES, PAINT_ITEMS } from '../isometric.js';
import { hatchTexture } from '../human.js';
import { lookStill, lookMap, LOOK_STILLS } from './isoLookStills.js';

const RUNS = Number(process.env.FC_RUNS) || 300;
const grid = isometric({ tile: 100, origin: [500, 100] });
const block = { name: 'server', kind: 'block', at: [1, 1], size: [2, 2, 1] }, can = { name: 'db', kind: 'cylinder', at: [1, 1], size: [2, 2, 1] };
const floor = { name: 'ground', kind: 'floor', at: [0, 0], size: [3, 2] };
const colours = { base: '#d9e4f3', ink: '#14181f' };
const close = (a, b, what) => assert.ok(Math.abs(a - b) <= 1e-6, `${what}: ${a} is not ${b} to 1e-6`);
/** The items with what a line or a shading sets taken out: the geometry, which no look moves. */
const shapeOf = (items) => items.map(({ fill, stroke, ...rest }) => rest);

test('the looks are rows of named choices: outlined is the contour line, line art is paper and a lighter contour', () => {
  assert.deepEqual(ISO_LOOKS, { outlined: { line: 'contour' }, 'line-art': { shading: 'paper', line: { name: 'contour', width: 3, inner: 1.25 } } });
  assert.ok(Object.isFrozen(ISO_LOOKS) && Object.isFrozen(ISO_LOOKS['line-art'].line));
  assert.deepEqual(CONTOUR, { width: 5, inner: 1.5, least: 1, most: 20, leastInner: 0.25 });
  // each look is a style isoStyle takes as it is: data, nothing it would refuse
  for (const [name, row] of Object.entries(ISO_LOOKS)) assert.deepEqual({ ...isoStyle({ look: name }), look: undefined }, { ...isoStyle(row), look: undefined }, name);
});

test('a look named and its row written out are the same style: the same row, options, paint list and seeds', () => {
  for (const [name, row] of Object.entries(ISO_LOOKS)) {
    const named = isoStyle({ look: name }), written = isoStyle(row);
    assert.equal(named.look, name);
    assert.equal(written.look, undefined, 'a row that names no look keeps the record it always had');
    assert.deepEqual(named.row, written.row);
    assert.deepEqual(named.options, written.options);
    for (const piece of [block, can, floor]) assert.deepStrictEqual(paintPiece(named, piece, grid, colours), paintPiece(written, piece, grid, colours), `${name}: ${piece.kind}`);
    // a seeded choice beside the look (hand-drawn hatching): the same strokes, point for point, drawn twice and after another piece
    const hatched = isoStyle({ look: name, texture: 'human:hatch' }, { choices: [hatchTexture] });
    const first = paintPiece(hatched, block, grid, colours);
    paintPiece(hatched, can, grid, colours);
    assert.deepStrictEqual(paintPiece(hatched, block, grid, colours), first);
    assert.deepStrictEqual(first, paintPiece(isoStyle({ ...row, texture: 'human:hatch' }, { choices: [hatchTexture] }), block, grid, colours));
    assert.ok(first.items.some((it) => it.item === 'stroke' && it.role === 'hatch'));
  }
  // a column written beside the look replaces the look's entry for it, whole
  const thick = isoStyle({ look: 'line-art', line: { name: 'contour', width: 6 } });
  assert.deepEqual([thick.row.shading, thick.row.line, thick.options.line], ['paper', 'contour', { width: 6 }]);
  assert.deepEqual(isoStyle({ look: 'outlined', line: 'ink' }).row.line, 'ink');
  assert.deepEqual(isoStyle({ look: null }), isoStyle(), 'look: null is none');
});

test('outlined: under the faces, each face again with no fill and the wide stroke; over them, the tones and the thin inner line', () => {
  const usual = paintPiece(isoStyle(), block, grid, colours).items, out = paintPiece(isoStyle({ look: 'outlined' }), block, grid, colours).items;
  assert.deepEqual(out.map((it) => [it.item, it.role]), [['polygon', 'contour'], ['polygon', 'contour'], ['polygon', 'contour'], ['polygon', 'left'], ['polygon', 'right'], ['polygon', 'top']]);
  const wide = { colour: '#14181f', alpha: 1, width: 8.5, join: 'round', cap: 'round' }, thin = { ...wide, width: 1.5 };
  // the contour as it shows is 5 px: the wide stroke's outer half (8.5 / 2) and the thin line's (1.5 / 2)
  close(wide.width / 2 + thin.width / 2, CONTOUR.width, 'the contour as it shows');
  assert.deepEqual(out.slice(0, 3).map((it) => [it.fill, it.stroke]), usual.map(() => [null, wide]));
  assert.deepEqual(shapeOf(out.slice(0, 3)).map((it) => it.points), shapeOf(usual).map((it) => it.points), 'each contour item is its face, point for point');
  assert.deepEqual(out.slice(3).map((it) => it.fill), usual.map((it) => it.fill), 'the faces keep their tones');
  assert.deepEqual(out.slice(3).map((it) => it.stroke), usual.map(() => thin));
  // a cylinder: its side and its top again under it
  const c = paintPiece(isoStyle({ look: 'outlined' }), can, grid, colours).items;
  assert.deepEqual(c.map((it) => [it.item, it.role, it.stroke.width]), [['path', 'contour', 8.5], ['ellipse', 'contour', 8.5], ['path', 'side', 1.5], ['ellipse', 'top', 1.5]]);
  // a floor is the ground the pieces stand on: its list is the usual one
  assert.deepStrictEqual(paintPiece(isoStyle({ look: 'outlined' }), floor, grid, colours), paintPiece(isoStyle(), floor, grid, colours));
});

test('line art: every face and the ground the paper\'s colour, given whatever the base; silhouette > folds > the tile lines', () => {
  const style = isoStyle({ look: 'line-art' });
  for (const cs of [colours, undefined]) {
    const b = paintPiece(style, block, grid, cs).items, ink = cs ? cs.ink : null;
    const paper = { mix: ['#ffffff', 1], colour: '#ffffff' };
    assert.deepEqual(b.map((it) => [it.role, it.fill, it.stroke]), [
      ...['contour', 'contour', 'contour'].map((r) => [r, null, { colour: ink, alpha: 1, width: 4.75, join: 'round', cap: 'round' }]),
      ...['left', 'right', 'top'].map((r) => [r, paper, { colour: ink, alpha: 1, width: 1.25, join: 'round', cap: 'round' }])]);
    const f = paintPiece(style, floor, grid, cs).items;
    assert.deepEqual(f.map((it) => [it.role, it.fill, it.stroke]), [['ground', paper, null], ['grid', null, { colour: ink, alpha: 0.16, width: 1.5, join: 'miter', cap: 'butt' }]]);
  }
  // the weights, as they show: the silhouette 3 px, the folds 1.25 px at full ink, the tile lines 1.5 px at 16% (0.24 of ink)
  close(4.75 / 2 + 1.25 / 2, 3, 'the silhouette as it shows');
  assert.ok(3 > 1.25 && 1.25 > 1.5 * 0.16);
  // the paper's colour as a page has it, any case, #rgb too
  const cream = paintPiece(isoStyle({ look: 'line-art', shading: { name: 'paper', colour: '#FAF6EE' } }), block, grid).items;
  assert.ok(cream.filter((it) => it.role !== 'contour').every((it) => it.fill.colour === '#faf6ee' && it.fill.mix[0] === '#faf6ee'));
  assert.equal(paintPiece(isoStyle({ shading: { name: 'paper', colour: '#fff' } }), block, grid).items[0].fill.colour, '#ffffff');
});

test('the geometry is pinned to 1e-6: a cylinder\'s contour and a block\'s top on a known grid', () => {
  const c = paintPiece(isoStyle({ look: 'outlined' }), can, grid).items;
  const rx = 100 / Math.SQRT2, ry = rx / 2, top = 200 - 25 * Math.sqrt(6);
  const [side, lid] = c;
  const want = [['move', 500 - rx, top], ['line', 500 - rx, 200], ['arc', 500, 200, rx, ry, Math.PI, 0, true], ['line', 500 + rx, top], ['close']];
  assert.equal(side.segments.length, want.length);
  side.segments.forEach((s, i) => { assert.equal(s[0], want[i][0]); s.forEach((v, k) => (typeof v === 'number' ? close(v, want[i][k], `side ${i}.${k}`) : assert.equal(v, want[i][k]))); });
  for (const [k, v] of Object.entries({ cx: 500, cy: top, rx, ry })) close(lid[k], v, `top ${k}`);
  const b = paintPiece(isoStyle({ look: 'line-art' }), block, grid).items;
  [[500, top - 50], [600, top], [500, top + 50], [400, top]].forEach(([x, y], i) => { close(b[2].points[i][0], x, `top ${i} x`); close(b[2].points[i][1], y, `top ${i} y`); });
  assert.deepEqual(b[2].points, b[5].points, 'the contour under the top is the top');
});

test('bad combinations are refused before anything is drawn, naming the entry and the fix', () => {
  assert.throws(() => isoStyle({ look: 'line-art', line: 'none' }), /^Error: isometric: the style's shading "paper" \(from the look "line-art": write shading beside it to change it\) cannot sit with line "none" — paper faces on a paper page show only by their lines: use line "contour" or "ink", or a shading that colours the faces \("tones"\)$/);
  assert.throws(() => isoStyle({ shading: 'paper', line: 'none' }), /the style's shading "paper" cannot sit with line "none" — paper faces/);
  assert.throws(() => isoStyle({ look: 'flat' }), /^Error: isometric: the style's look is one of "outlined", "line-art" \(a row of choices under a name\), or none — not "flat"$/);
  assert.throws(() => isoStyle({ look: ['outlined'] }), /the style's look is one of "outlined", "line-art"/);
  assert.throws(() => isoStyle({ look: 'outlined', outline: 'bold' }), /a style's columns are shape, shading, line, palette, texture, effects — not "outline" \(a row may also name a look: \{look: "outlined", "line-art"\}\)/);
  assert.throws(() => isoStyle({ look: Object.defineProperty({}, 'x', {}) }), /the style's look is one of/);
  assert.throws(() => isoStyle(Object.defineProperty({}, 'look', { get: () => 'outlined', enumerable: true })), /is read as a stored value, and this one is a getter/);
  assert.throws(() => isoStyle({ line: { name: 'contour', width: 0.5 } }), /the style's line "contour" takes a width from 1 to 20 px \(the contour as it shows\) — not 0.5/);
  assert.throws(() => isoStyle({ line: { name: 'contour', width: 21 } }), /takes a width from 1 to 20 px/);
  assert.throws(() => isoStyle({ line: { name: 'contour', width: 3, inner: 4 } }), /the style's line "contour" takes an inner from 0.25 px to its width, 3 px \(the inner lines are never bolder than the contour\) — not 4/);
  assert.throws(() => isoStyle({ line: { name: 'contour', inner: 0.1 } }), /takes an inner from 0.25 px to its width, 5 px/);
  assert.throws(() => isoStyle({ line: { name: 'contour', inner: 'thin' } }), /takes an inner from 0.25 px .* — not "thin"/);
  assert.throws(() => isoStyle({ line: { name: 'contour', dash: 2 } }), /the style's line "contour" takes width, inner — not "dash"/);
  assert.throws(() => isoStyle({ shading: { name: 'paper', colour: 'white' } }), /the style's shading "paper"'s colour is a colour, "#rgb" or "#rrggbb" — not "white"/);
  // a tool's own shading that leaves a face unfilled: the wide stroke under it would show whole — refused on the piece, with the fix
  const bare = { column: 'shading', name: 'test:bare', apply: (items) => items };
  const style = isoStyle({ look: 'outlined', shading: 'test:bare' }, { choices: [bare] });
  assert.throws(() => paintPiece(style, block, grid), /^Error: isometric: the style's line "contour" on "server": its contour is a wide stroke under the faces, which their fills trim to the outside, and the left face has no fill — use a shading that fills every face \("tones", "paper"\), or line "ink"$/);
  assert.equal(paintPiece(style, floor, grid).items.length, 2, 'a floor has no face the contour reads');
});

test('the record keeps the look beside the row; a record made again is the same style; a built map names its look', () => {
  const style = isoStyle({ look: 'line-art' });
  assert.deepEqual(style, { row: { shape: 'box', shading: 'paper', line: 'contour', palette: 'theme', texture: 'none', effects: [] }, options: { line: { inner: 1.25, width: 3 } }, look: 'line-art' });
  assert.deepEqual(structuredClone(style), style);
  const again = restyle(structuredClone(style));
  assert.deepEqual(again, style);
  assert.deepStrictEqual(paintPiece(again, block, grid, colours), paintPiece(style, block, grid, colours));
  assert.throws(() => restyle({ ...style, look: 'flat' }), /the style's look is one of/);
  for (const policy of [ISO_MAP_POLICIES.film, ISO_MAP_POLICIES.deck]) {
    const map = buildIsoMap({ blocks: [{ name: 'web', size: [2, 2, 1] }, { name: 'db', kind: 'cylinder', size: [2, 2, 1] }], wires: [{ from: { block: 'web' }, to: { block: 'db' } }], floors: [{ label: 'P' }], area: [0, 0, 1600, 900], style: { look: 'outlined' } }, policy);
    assert.equal(map.style.look, 'outlined');
    assert.deepStrictEqual(structuredClone(map), map);
    assert.deepEqual(map.paints.map((items) => items.filter((it) => it.role === 'contour').length), [3, 2]);
    const usual = buildIsoMap({ blocks: [{ name: 'web', size: [2, 2, 1] }, { name: 'db', kind: 'cylinder', size: [2, 2, 1] }], wires: [{ from: { block: 'web' }, to: { block: 'db' } }], floors: [{ label: 'P' }], area: [0, 0, 1600, 900] }, policy);
    for (const key of ['at', 'routes', 'view', 'names', 'order', 'floorLabels', 'shapes', 'floorShapes', 'floorPaints']) assert.deepStrictEqual(map[key], usual[key], key);
    assert.equal(usual.style.look, undefined, 'a map that names no look records as before');
  }
});

test('what the tools\' painters need: only items they draw today; a contour fills nothing and lies under the faces that cover it', () => {
  for (const look of Object.keys(ISO_LOOKS)) {
    for (const piece of [block, can, floor]) {
      const { items } = paintPiece(isoStyle({ look }), piece, grid);
      assert.ok(items.every((it) => PAINT_ITEMS.includes(it.item) && it.item !== 'stroke'), 'polygon, ellipse, path and lines only');
      const under = items.filter((it) => it.role === 'contour'), faces = items.filter((it) => ['top', 'left', 'right', 'side'].includes(it.role));
      assert.equal(under.length, faces.length);
      assert.ok(under.every((it) => it.fill === null), 'a contour fills nothing');
      assert.ok(items.findIndex((it) => it.role !== 'contour') >= under.length, 'every contour item comes before the faces');
      // with no colours given (both tools build so), a paper face still says its colour, so a painter colouring by role draws it white
      if (look === 'line-art') assert.ok(items.filter((it) => it.role !== 'contour' && it.role !== 'grid').every((it) => it.fill.colour === '#ffffff'));
    }
  }
});

const half = fc.integer({ min: 0, max: 40 }).map((n) => n / 2);
const anyGrid = fc.record({ w: fc.integer({ min: 20, max: 200 }), ox: fc.integer({ min: -2000, max: 2000 }), oy: fc.integer({ min: -2000, max: 2000 }), rise: fc.option(fc.integer({ min: 10, max: 150 }), { nil: undefined }) })
  .map(({ w, ox, oy, rise }) => isometric({ tile: w, origin: [ox, oy], ...(rise === undefined ? {} : { rise }) }));
const anyPiece = fc.oneof(
  fc.record({ kind: fc.constant('block'), at: fc.tuple(half, half, half), size: fc.tuple(half.map((n) => n + 0.5), half.map((n) => n + 0.5), half) }),
  fc.record({ kind: fc.constant('cylinder'), at: fc.tuple(half, half, half), wide: half.map((n) => n + 0.5), high: half }).map(({ kind, at, wide, high }) => ({ kind, at, size: [wide, wide, high] })),
  fc.record({ kind: fc.constant('floor'), at: fc.tuple(fc.integer({ min: -5, max: 10 }), fc.integer({ min: -5, max: 10 })), size: fc.tuple(fc.integer({ min: 1, max: 12 }), fc.integer({ min: 1, max: 12 })) }));

test('for any piece on any grid, a look moves nothing: the faces are the usual ones, and each contour item is one of them', () => {
  const usual = isoStyle(), styles = Object.keys(ISO_LOOKS).map((look) => isoStyle({ look }));
  fc.assert(fc.property(anyGrid, anyPiece, fc.boolean(), (g, p, coloured) => {
    const piece = { name: 'p', ...p }, cs = coloured ? colours : undefined, was = paintPiece(usual, piece, g, cs);
    for (const style of styles) {
      const now = paintPiece(style, piece, g, cs), under = now.items.filter((it) => it.role === 'contour');
      assert.deepStrictEqual([now.box, now.centre, now.outline], [was.box, was.centre, was.outline]);
      assert.deepStrictEqual(shapeOf(now.items.slice(under.length)), shapeOf(was.items));
      assert.deepStrictEqual(shapeOf(under).map(({ role, ...rest }) => rest), shapeOf(was.items.filter((it) => it.role !== 'ground' && it.role !== 'grid')).map(({ role, ...rest }) => rest));
    }
  }), { numRuns: RUNS });
});

test('the README\'s stills are what the looks paint today', () => {
  for (const { look, file, paper } of LOOK_STILLS) {
    const path = fileURLToPath(new URL(`../src/isometric/${file}`, import.meta.url)), picture = lookStill(look, paper);
    if (process.env.WRITE_EXAMPLE) writeFileSync(path, picture);
    assert.equal(readFileSync(path, 'utf8'), picture, 'run WRITE_EXAMPLE=1 node --test test/isometric-looks.test.js to draw them again');
    assert.equal(lookMap(look).style.look, look);
  }
});
