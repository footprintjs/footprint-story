// The named look `sketchy` (0.37.0): drawn by hand on paper — shading "paper", the line "human:sketchy" and the
// texture "human:hatch" 28 px apart, both footprint-story/human's, handed in. Pinned: the row, a look named and its
// row written out are the same style, the paint list and its counts, the seeds exact and the pen's speed out of the
// seed, the refusals (the human choices missing, a fully-overridden look, the duotone), the record and a built map,
// the tools' budgets on a 64-block world, and the README's still (with the other looks', isometric-looks.test.js).
// FC_RUNS=5000 npm test runs a deeper sweep.
import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { isometric, isoStyle, paintPiece, restyle, buildIsoMap, ISO_LOOKS, ISO_MAP_POLICIES, PAINT_ITEMS, MOST_PAINT_ITEMS } from '../isometric.js';
import { HUMAN_STYLE_CHOICES, sketchyLine, hatchTexture, strokeOutline } from '../human.js';
import { runMapFlow } from '../mapflow.js';
import { SUMMARISED, paintSummary } from '../src/mapflow/summary.js';
import { mapArb } from './isoMapSpecs.js';

const RUNS = Number(process.env.FC_RUNS) || 300;
const choices = HUMAN_STYLE_CHOICES;
const grid = isometric({ tile: 100, origin: [500, 100] });
const block = { name: 'server', kind: 'block', at: [1, 1], size: [2, 2, 1] }, can = { name: 'db', kind: 'cylinder', at: [1, 1], size: [2, 2, 1] };
const floor = { name: 'ground', kind: 'floor', at: [0, 0], size: [3, 2] };
const colours = { base: '#d9e4f3', ink: '#14181f' };
const ROW = Object.freeze({ shading: 'paper', line: 'human:sketchy', texture: { name: 'human:hatch', spacing: 28 } });
const sketched = isoStyle({ look: 'sketchy' }, { choices });
const strokes = (items, role) => items.filter((it) => it.item === 'stroke' && (!role || it.role === role));

test('the look is a row: paper faces, the hand-drawn line and the hatch 28 px apart; named or written out, the same style', () => {
  assert.deepEqual(ISO_LOOKS.sketchy, ROW);
  assert.ok(Object.isFrozen(ISO_LOOKS.sketchy) && Object.isFrozen(ISO_LOOKS.sketchy.texture));
  assert.deepEqual(sketched, { row: { shape: 'box', shading: 'paper', line: 'human:sketchy', palette: 'theme', texture: 'human:hatch', effects: [] }, options: { texture: { spacing: 28 } }, look: 'sketchy' });
  const written = isoStyle(ROW, { choices });
  assert.deepEqual([written.row, written.options, written.look], [sketched.row, sketched.options, undefined]);
  for (const piece of [block, can, floor, { name: 'ball', kind: 'ball', at: [1, 1], size: [1, 1, 1] }]) assert.deepStrictEqual(paintPiece(sketched, piece, grid, colours), paintPiece(written, piece, grid, colours), piece.kind);
  // only the two choices it names need be handed in, in any order
  assert.deepStrictEqual(paintPiece(isoStyle({ look: 'sketchy' }, { choices: [hatchTexture, sketchyLine] }), block, grid, colours), paintPiece(sketched, block, grid, colours));
});

test('the paint list: the faces paper with no line, the edges drawn by hand, the sides hatched after them; a floor is the page\'s', () => {
  for (const cs of [colours, undefined]) {
    const items = paintPiece(sketched, block, grid, cs).items, ink = cs ? cs.ink : null, paper = { mix: ['#ffffff', 1], colour: '#ffffff' };
    assert.deepEqual(items.slice(0, 3).map((it) => [it.item, it.role, it.fill, it.stroke]), ['left', 'right', 'top'].map((r) => ['polygon', r, paper, null]));
    assert.deepEqual([strokes(items, 'ink').length, strokes(items, 'hatch').length, items.length], [3, 15, 21], 'the silhouette and the inner Y; 15 hatch lines: the seeds are exact');
    assert.deepEqual(strokes(items, 'ink')[0].stroke, { colour: ink, alpha: 1, width: 2.5, join: 'round', cap: 'round' });
    assert.deepEqual(strokes(items, 'hatch')[0].stroke, { colour: ink, alpha: 1, width: 1, join: 'round', cap: 'round' });
    // a hand hatches once the outline is in: every hatch line starts after the last edge stroke ends
    const lastInk = Math.max(...strokes(items, 'ink').map((s) => s.points.at(-1)[3]));
    assert.ok(strokes(items, 'hatch').every((s) => s.points[0][3] > lastInk));
    assert.ok(items.every((it) => PAINT_ITEMS.includes(it.item)));
    const c = paintPiece(sketched, can, grid, cs).items;
    assert.deepEqual([c.slice(0, 2).map((it) => [it.item, it.role]), strokes(c, 'ink').length, strokes(c, 'hatch').length], [[['path', 'side'], ['ellipse', 'top']], 1, 6]);
    const f = paintPiece(sketched, floor, grid, cs).items;
    assert.deepEqual(f.map((it) => [it.role, it.fill, it.stroke]), [['ground', paper, null], ['grid', null, { colour: ink, alpha: 0.16, width: 1.5, join: 'miter', cap: 'butt' }]]);
  }
});

test('the seeds are exact: painted twice or after another, the same strokes; who never reaches them; the pen\'s speed is timing, out of the seed', () => {
  const first = paintPiece(sketched, block, grid, colours);
  paintPiece(sketched, can, grid, colours);
  assert.deepStrictEqual(paintPiece(sketched, block, grid, colours), first);
  assert.notDeepStrictEqual(strokes(paintPiece(sketched, { ...block, name: 'other' }, grid, colours).items, 'ink')[0].points, strokes(first.items, 'ink')[0].points);
  // a faster pen written beside the look: the same points and widths, drawn sooner (the speed is `unseeded`, 0.33.0)
  const fast = paintPiece(isoStyle({ look: 'sketchy', line: { name: 'human:sketchy', speed: 900 } }, { choices }), block, grid, colours);
  strokes(first.items).forEach((s, k) => {
    const f = strokes(fast.items)[k];
    assert.deepStrictEqual(f.points.map((p) => p.slice(0, 2)), s.points.map((p) => p.slice(0, 2)));
    f.points.forEach((p, j) => assert.ok(Math.abs(p[2] - s.points[j][2]) <= 1e-9));
  });
  assert.ok(strokes(fast.items, 'ink')[0].points.at(-1)[3] < strokes(first.items, 'ink')[0].points.at(-1)[3], 'drawn faster');
  // the tremor is what the drawing is: it reaches the seed
  assert.notDeepStrictEqual(paintPiece(isoStyle({ look: 'sketchy', line: { name: 'human:sketchy', tremor: 2 } }, { choices }), block, grid, colours).items[3].points, first.items[3].points);
  const spec = (who) => ({ blocks: [{ name: 'web', size: [2, 2, 1] }], floors: [{ label: 'P' }], area: [0, 0, 1600, 900], style: { look: 'sketchy' }, ...(who ? { who } : {}) });
  assert.deepStrictEqual(buildIsoMap(spec('the hand-off slide'), ISO_MAP_POLICIES.film, { choices }).paints, buildIsoMap(spec(null), ISO_MAP_POLICIES.film, { choices }).paints);
});

test('refused before anything is drawn, naming the fix: the human choices missing, a look the row overrides whole, a third ink', () => {
  // named without the human door's choices: the first column it reaches says what to hand in, and that it came from the look
  assert.throws(() => isoStyle({ look: 'sketchy' }), /^Error: isometric: the style's line has no choice "human:sketchy" — the line choices are "ink", "none", "contour"; "human:sketchy" is a tool's own choice \(its name has a prefix\), which is code no record holds: hand the choice itself in \{choices\} \(footprint-story\/human has the "human:" ones: hand in HUMAN_STYLE_CHOICES, every one of them\) \(from the look "sketchy": write line beside it to change it\)$/);
  assert.throws(() => isoStyle({ look: 'sketchy' }, { choices: [sketchyLine] }), /the style's texture has no choice "human:hatch" — the texture choices are "none"; .*hand in HUMAN_STYLE_CHOICES, every one of them\) \(from the look "sketchy": write texture beside it to change it\)$/);
  assert.throws(() => buildIsoMap({ blocks: [{ name: 'web', size: [2, 2, 1] }], area: [0, 0, 1600, 900], style: { look: 'sketchy' } }, ISO_MAP_POLICIES.deck), /hand in HUMAN_STYLE_CHOICES, every one of them\) \(from the look "sketchy"/);
  // a look every column of which the row writes itself draws nothing
  assert.throws(() => isoStyle({ look: 'sketchy', shading: 'tones', line: 'ink', texture: 'none' }, { choices }), /^Error: isometric: the style's look "sketchy" sets shading and line and texture, and the row writes each itself, so the look draws nothing — drop the look, or the shading and line and texture written beside it$/);
  assert.throws(() => isoStyle({ look: 'sketchy', ...ROW }, { choices }), /the look draws nothing/, 'even with the look\'s own entries');
  // two columns written beside it: the look still fills the third, and names itself
  assert.deepEqual(isoStyle({ look: 'sketchy', shading: 'tones', line: 'ink' }, { choices }).look, 'sketchy');
  // the hatch beside a duotone prints a third ink
  assert.throws(() => isoStyle({ look: 'sketchy', palette: 'duotone' }, { choices }), /^Error: isometric: the style's texture "human:hatch" \(from the look "sketchy": write texture beside it to change it\) cannot sit with palette "duotone" — the hatch is drawn after the palette/);
  // paper with no line shows nothing: the clash names the look's shading
  assert.throws(() => isoStyle({ look: 'sketchy', line: 'none' }, { choices }), /the style's shading "paper" \(from the look "sketchy": write shading beside it to change it\) cannot sit with line "none"/);
  // the choices' own checks run on what is written beside the look
  assert.throws(() => isoStyle({ look: 'sketchy', texture: { name: 'human:hatch', spacing: 2 } }, { choices }), /the style's texture "human:hatch" takes a spacing from 3 to 200 — not 2/);
});

test('a face too small for one hatch line at its spacing is left clear, never refused (0.37.0: it was "nothing to draw")', () => {
  // a flat cylinder: its side all under its top, so no hatch line has room (0.36.0 refused it at any spacing)
  const flat = { name: 'disc', kind: 'cylinder', at: [0, 0], size: [1, 1, 0] }, small = isometric({ tile: 96, origin: [500, 100] });
  for (const style of [isoStyle({ look: 'sketchy', texture: { name: 'human:hatch', spacing: 40 } }, { choices }), isoStyle({ texture: { name: 'human:hatch', spacing: 40 } }, { choices })]) {
    const items = paintPiece(style, flat, small, colours).items;
    assert.equal(strokes(items, 'hatch').length, 0);
    // the faces and edges as with no texture (the wobble apart: the texture's options are in the style's seed)
    assert.deepEqual(items.map((it) => [it.item, it.role, it.fill]), paintPiece(isoStyle({ ...style.row, texture: 'none' }, { choices }), flat, small, colours).items.map((it) => [it.item, it.role, it.fill]));
  }
  // where a line fits, the hatch is drawn as before: a sliver of a side a tenth of a tile high takes 2 lines 40 px apart
  assert.equal(strokes(paintPiece(isoStyle({ texture: { name: 'human:hatch', spacing: 40 } }, { choices }), { ...flat, size: [1, 1, 0.1] }, small, colours).items, 'hatch').length, 2);
});

test('the record keeps the look; a record made again is the same style; a built map names it and moves nothing but the paint', () => {
  assert.deepEqual(structuredClone(sketched), sketched);
  const again = restyle(structuredClone(sketched), { choices });
  assert.deepEqual(again, sketched);
  assert.deepStrictEqual(paintPiece(again, block, grid, colours), paintPiece(sketched, block, grid, colours));
  // a denser hatch written beside it is kept as written, the look still named for the line and the paper
  const dense = isoStyle({ look: 'sketchy', texture: { name: 'human:hatch', spacing: 16 } }, { choices });
  assert.deepEqual([dense.look, dense.options.texture], ['sketchy', { spacing: 16 }]);
  assert.deepEqual(restyle(structuredClone(dense), { choices }), dense);
  const spec = { blocks: [{ name: 'web', size: [2, 2, 1] }, { name: 'db', kind: 'cylinder', size: [2, 2, 1] }], wires: [{ from: { block: 'web' }, to: { block: 'db' } }], floors: [{ label: 'P' }], area: [0, 0, 1600, 900] };
  for (const policy of [ISO_MAP_POLICIES.film, ISO_MAP_POLICIES.deck]) {
    const map = buildIsoMap({ ...spec, style: { look: 'sketchy' } }, policy, { choices }), usual = buildIsoMap(spec, policy);
    assert.equal(map.style.look, 'sketchy');
    assert.deepStrictEqual(structuredClone(map), map);
    for (const key of ['at', 'routes', 'view', 'names', 'order', 'floorLabels', 'shapes', 'floorShapes']) assert.deepStrictEqual(map[key], usual[key], key);
    assert.ok(map.paints.every((items) => strokes(items, 'ink').length && strokes(items, 'hatch').length && items.length <= MOST_PAINT_ITEMS));
  }
});

test('the map flow draws the look as buildIsoMap does, for random maps and both policies, its record the summary only', async () => {
  await fc.assert(fc.asyncProperty(mapArb, fc.constantFrom(ISO_MAP_POLICIES.film, ISO_MAP_POLICIES.deck), async (spec, policy) => {
    const given = { ...spec, style: { look: 'sketchy' } };
    let built;
    try { built = buildIsoMap(given, policy, { choices }); } catch (e) { await assert.rejects(runMapFlow(given, policy, { choices }), { message: e.message }); return; }
    const { map, snapshot } = await runMapFlow(given, policy, { choices });
    assert.deepStrictEqual(map, built);
    assert.equal(snapshot.sharedState.style.look, 'sketchy');
    for (const key of SUMMARISED) assert.deepStrictEqual(snapshot.sharedState[key], paintSummary(map[key]), key);
  }), { numRuns: Math.ceil(RUNS / 5) });
});

/** The 64-block world of the record-size test (test/mapflow-record-size.test.js), fitted to 1920 × 1080. */
const blocks = Array.from({ length: 64 }, (_, i) => ({ name: `b${i}`, at: [(i % 8) * 3, Math.floor(i / 8) * 3], size: [2, 2, 1 + (i % 3)], kind: i % 5 ? 'block' : 'cylinder', label: `B${i}` }));
const WORLD = Object.freeze({ blocks, wires: blocks.slice(1).map((b, i) => ({ from: { block: blocks[i].name }, to: { block: b.name } })).filter((_, i) => i % 4 === 0), floors: [{ label: 'World' }], area: [0, 0, 1920, 1080] });

test('the tools\' budgets: a 64-block sketched world is 1,246 strokes, about 1.84 MB as StoryDeck writes them — under the 2000 strokes and 2 MB both tools note a map at', () => {
  const fixed = (v) => +v.toFixed(1);
  for (const policy of [ISO_MAP_POLICIES.film, ISO_MAP_POLICIES.deck]) {
    const map = buildIsoMap({ ...WORLD, style: { look: 'sketchy' } }, policy, { choices });
    const all = map.paints.flat();
    assert.deepEqual([all.length, strokes(all).length, strokes(all, 'ink').length, strokes(all, 'hatch').length], [1425, 1246, 166, 1080]);
    // as StoryDeck writes a stroke (isoPaint.js · strokeSvg): the ring round it, one decimal, from its piece's box
    let bytes = 0;
    map.paints.forEach((items, i) => {
      const { x, y } = map.shapes[i].box;
      for (const it of strokes(items)) bytes += `<path class="iso-${it.role}" stroke="none" style="fill:var(--sd-ink,#14181f);fill-rule:nonzero" d="${strokeOutline(it.points, { cap: it.stroke.cap }).map(([px, py], k) => `${k ? 'L' : 'M'}${fixed(px - x)} ${fixed(py - y)}`).join('')}Z"/>`.length;
    });
    assert.ok(bytes > 1_700_000 && bytes < 1_900_000, `${bytes} bytes`);
    assert.ok(strokes(all).length < 2000 && bytes < 2_000_000);
    // what 0.36.0's hand-drawn world drew (the hatch at its usual 8, the faces toned): past the strokes note
    assert.equal(strokes(buildIsoMap({ ...WORLD, style: { line: 'human:sketchy', texture: 'human:hatch' } }, policy, { choices }).paints.flat()).length, 3660);
  }
});
