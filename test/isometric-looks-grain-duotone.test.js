// Two more named looks (0.35.0): `paper-grain` (the texture "human:grain": fine, faint, seeded marks in each face, laid
// with the hatch's clipper, one `lines` item a face) and `duotone` (the palette "duotone": every line the ink, every
// fill a tint of the accent on the paper). Pinned: each list, the marks inside their faces and out of the faces over
// them for any piece on any grid, the seeds exact, the geometry to 1e-6, the tools' budgets on a 64-block world, the
// grain's low contrast and a name's 4.5 : 1 on every duotone tint, the refusals with their fix, and the record.
// FC_RUNS=5000 npm test runs a deeper sweep.
import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { isometric, isoStyle, paintPiece, restyle, buildIsoMap, ISO_LOOKS, ISO_MAP_POLICIES, PAINT_ITEMS, MOST_PAINT_POINTS, DUOTONE, mixColour } from '../isometric.js';
import { grainTexture, hatchTexture, sketchyLine, GRAIN, MOST_GRAIN_MARKS, HUMAN_STYLE_CHOICES } from '../human.js';
import { segmentWithin } from '../src/human/strokes/geometry.js';
import { ringOf } from '../src/human/strokes/paint.js';
import { contrastRatio, luminance } from '../src/isometric/duotone.js';

const RUNS = Number(process.env.FC_RUNS) || 300;
const choices = HUMAN_STYLE_CHOICES;
const grid = isometric({ tile: 100, origin: [500, 100] });
const block = { name: 'server', kind: 'block', at: [1, 1], size: [2, 2, 1] }, can = { name: 'db', kind: 'cylinder', at: [1, 1], size: [2, 2, 1] };
const floor = { name: 'ground', kind: 'floor', at: [0, 0], size: [3, 2] };
const colours = { base: '#d9e4f3', ink: '#14181f' };
const SOLID = ['top', 'left', 'right', 'side'];
const close = (a, b, what) => assert.ok(Math.abs(a - b) <= 1e-6, `${what}: ${a} is not ${b} to 1e-6`);
const shapeOf = (items) => items.map(({ fill, stroke, ...rest }) => rest);
const grained = isoStyle({ look: 'paper-grain' }, { choices });

test('the two looks are rows: paper-grain is the texture "human:grain", duotone the palette "duotone"; the human door hands its choices in one list', () => {
  assert.deepEqual(ISO_LOOKS['paper-grain'], { texture: 'human:grain' });
  assert.deepEqual(ISO_LOOKS.duotone, { palette: 'duotone' });
  assert.deepEqual(HUMAN_STYLE_CHOICES, [sketchyLine, hatchTexture, grainTexture]);
  assert.ok(Object.isFrozen(HUMAN_STYLE_CHOICES));
  assert.deepEqual(GRAIN, { spacing: 16, sets: 3, mark: [1, 3], gap: [12, 36], width: 0.75, alpha: 0.22, least: { spacing: 4, width: 0.25, alpha: 0.02 }, most: { spacing: 200, width: 4, alpha: 1 } });
  assert.equal(MOST_GRAIN_MARKS, MOST_PAINT_POINTS, 'a face\'s grain fits one item');
  assert.deepEqual(DUOTONE, { ink: '#22304a', accent: '#e07b39', paper: '#ffffff', most: 0.6, neutral: '#d9d9d9', text: 4.5 });
  assert.deepEqual(grainTexture.unseeded, [], 'a grain is printed, not drawn: nothing of it is timing');
});

test('paper grain: the usual list, then one lines item a face (role grain), faint and thin in the ink; a floor has none', () => {
  for (const cs of [colours, undefined]) {
    const usual = paintPiece(isoStyle(), block, grid, cs).items, b = paintPiece(grained, block, grid, cs).items;
    assert.deepStrictEqual(b.slice(0, 3), usual, 'the faces are the usual ones, untouched');
    assert.deepEqual(b.slice(3).map((it) => [it.item, it.role, it.of, it.fill, it.stroke]), [0, 1, 2].map(() => ['lines', 'grain', 'server', null, { colour: cs ? '#14181f' : null, alpha: 0.22, width: 0.75, join: 'round', cap: 'round' }]));
    assert.deepEqual(b.slice(3).map((it) => it.segments.length), [45, 41, 71], 'the marks, counted: the seeds are exact');
    const c = paintPiece(grained, can, grid, cs).items;
    assert.deepEqual(c.map((it) => [it.item, it.role]), [['path', 'side'], ['ellipse', 'top'], ['lines', 'grain'], ['lines', 'grain']]);
    assert.deepStrictEqual(paintPiece(grained, floor, grid, cs), paintPiece(isoStyle(), floor, grid, cs), 'the ground the pieces stand on is the page\'s, not a piece');
  }
  // each mark a fleck: from a hair to GRAIN.mark[1] px long (a mark at a line's end is cut there)
  const marks = paintPiece(grained, block, grid, colours).items.slice(3).flatMap((it) => it.segments);
  assert.ok(marks.every(([x1, y1, x2, y2]) => { const l = Math.hypot(x2 - x1, y2 - y1); return l > 0 && l <= GRAIN.mark[1] + 1e-9; }));
  assert.ok(marks.filter(([x1, y1, x2, y2]) => Math.hypot(x2 - x1, y2 - y1) >= GRAIN.mark[0] - 1e-9).length / marks.length > 0.9, 'most marks are whole');
});

test('the grain\'s geometry is pinned to 1e-6: the first two marks of each face of a block on a known grid', () => {
  const want = [
    [[419.82162596282024, 154.40133196403315, 422.02012726389546, 155.39514414470074], [454.41542354917436, 170.03913822780643, 456.98059922840355, 171.1987021699899]],
    [[580.7262370204331, 158.3417454340873, 583.350143098823, 158.71418424083373], [597.0446269866135, 160.65798751953434, 599.4344070045252, 160.9971943324564]],
    [[572.5149360071314, 144.85922341036337, 571.6733360931709, 146.1440174872963], [564.254042949149, 128.27077100373475, 562.965730869056, 130.23751993311063]],
  ];
  paintPiece(grained, block, grid, colours).items.slice(3).forEach((it, f) => want[f].forEach((m, k) => m.forEach((v, i) => close(it.segments[k][i], v, `face ${f} mark ${k}.${i}`))));
});

test('the seeds are exact: the same piece, the same grain, painted twice or after another; a name of its own, a grain of its own; who never reaches it', () => {
  const first = paintPiece(grained, block, grid, colours);
  paintPiece(grained, can, grid, colours);
  assert.deepStrictEqual(paintPiece(grained, block, grid, colours), first);
  assert.deepStrictEqual(paintPiece(isoStyle({ texture: 'human:grain' }, { choices: [grainTexture] }), block, grid, colours), first, 'named or written out, and with only the one choice handed in');
  assert.notDeepEqual(paintPiece(grained, { ...block, name: 'other' }, grid, colours).items[3].segments, first.items[3].segments);
  const spec = (who) => ({ blocks: [{ name: 'web', size: [2, 2, 1] }], floors: [{ label: 'P' }], area: [0, 0, 1600, 900], style: { look: 'paper-grain' }, ...(who ? { who } : {}) });
  assert.deepStrictEqual(buildIsoMap(spec('the hand-off slide'), ISO_MAP_POLICIES.film, { choices }).paints, buildIsoMap(spec(null), ISO_MAP_POLICIES.film, { choices }).paints);
  // its options are the grain's: a wider spacing lays fewer marks, the stroke as written
  const sparse = paintPiece(isoStyle({ texture: { name: 'human:grain', spacing: 40, width: 1, alpha: 0.5 } }, { choices }), block, grid, colours).items.slice(3);
  assert.ok(sparse.reduce((n, it) => n + it.segments.length, 0) < 157 / 2);
  assert.deepEqual(sparse[0].stroke, { colour: '#14181f', alpha: 0.5, width: 1, join: 'round', cap: 'round' });
});

const half = fc.integer({ min: 0, max: 40 }).map((n) => n / 2);
const anyGrid = fc.record({ w: fc.integer({ min: 20, max: 200 }), ox: fc.integer({ min: -2000, max: 2000 }), oy: fc.integer({ min: -2000, max: 2000 }), rise: fc.option(fc.integer({ min: 10, max: 150 }), { nil: undefined }) })
  .map(({ w, ox, oy, rise }) => isometric({ tile: w, origin: [ox, oy], ...(rise === undefined ? {} : { rise }) }));
const anyPiece = fc.oneof(
  fc.record({ kind: fc.constant('block'), at: fc.tuple(half, half, half), size: fc.tuple(half.map((n) => n / 4 + 0.5), half.map((n) => n / 4 + 0.5), half.map((n) => n / 4)) }),
  fc.record({ kind: fc.constant('cylinder'), at: fc.tuple(half, half, half), wide: half.map((n) => n / 4 + 0.5), high: half.map((n) => n / 4) }).map(({ kind, at, wide, high }) => ({ kind, at, size: [wide, wide, high] })),
  fc.record({ kind: fc.constant('floor'), at: fc.tuple(fc.integer({ min: -5, max: 10 }), fc.integer({ min: -5, max: 10 })), size: fc.tuple(fc.integer({ min: 1, max: 6 }), fc.integer({ min: 1, max: 6 })) }));

test('for any piece on any grid: the faces are the usual ones, every mark lies in its face and out of each face painted over it, and the list is seeded', () => {
  const usual = isoStyle();
  fc.assert(fc.property(anyGrid, anyPiece, fc.boolean(), (g, p, coloured) => {
    const piece = { name: 'p', ...p }, cs = coloured ? colours : undefined, was = paintPiece(usual, piece, g, cs);
    let now;
    try { now = paintPiece(grained, piece, g, cs); } catch (e) { assert.match(e.message, /too big for its grain at 16 px .* — (give a wider spacing: texture: \{name: 'human:grain', spacing: \d+\}|no spacing up to 200 px fits it)/); return; }
    assert.deepStrictEqual([now.box, now.centre, now.outline], [was.box, was.centre, was.outline]);
    assert.deepStrictEqual(now.items.slice(0, was.items.length), was.items);
    const faces = was.items.filter((it) => SOLID.includes(it.role)).map((it) => ringOf(it));
    const grain = now.items.slice(was.items.length);
    assert.ok(grain.every((it) => it.item === 'lines' && it.role === 'grain' && it.segments.length > 0 && it.segments.length <= MOST_GRAIN_MARKS));
    assert.ok(grain.length <= faces.length);
    // which face a grain item is: the faces with room, in order — each mark within it, out of the later ones
    let f = 0;
    for (const it of grain) {
      while (!segmentWithin([it.segments[0][0], it.segments[0][1]], [it.segments[0][2], it.segments[0][3]], faces[f], faces.slice(f + 1), 1e-6)) f += 1;
      for (const [x1, y1, x2, y2] of it.segments) assert.ok(segmentWithin([x1, y1], [x2, y2], faces[f], faces.slice(f + 1), 1e-6), `a mark leaves face ${f}`);
      f += 1;
    }
    assert.deepStrictEqual(paintPiece(grained, piece, g, cs), now);
  }), { numRuns: RUNS });
});

test('duotone: every line the ink (its alpha kept), every fill a tint of the accent on the paper, as dark as the fill it replaces', () => {
  const style = isoStyle({ look: 'duotone' });
  const b = paintPiece(style, block, grid, colours).items;
  const tint = (c) => ({ mix: [c, 1], colour: c });
  assert.deepEqual(b.map((it) => [it.role, it.fill, it.stroke]), [['left', tint('#f5d3bd')], ['right', tint('#efbc9a')], ['top', tint('#f9e6d9')]].map(([r, f]) => [r, f, { colour: '#22304a', alpha: 1, width: 2.5, join: 'round', cap: 'butt' }]));
  assert.deepStrictEqual(shapeOf(b), shapeOf(paintPiece(isoStyle(), block, grid, colours).items), 'the duotone moves nothing');
  // the shading's order survives: the lit top lightest, the right face in shadow darkest
  const [left, right, top] = b.map((it) => luminance(it.fill.colour));
  assert.ok(top > left && left > right);
  // no colours given (both tools build so): still a duotone, every fill with its colour, over the neutral base
  assert.deepEqual(paintPiece(style, block, grid).items.map((it) => [it.fill.colour, it.stroke.colour]), [['#f3cbb1', '#22304a'], ['#eeb691', '#22304a'], ['#f7dece', '#22304a']]);
  // the floor: its ground a tint, its tile lines the ink at 16%
  const f = paintPiece(style, floor, grid, colours).items;
  assert.deepEqual(f[1].stroke, { colour: '#22304a', alpha: 0.16, width: 1.5, join: 'miter', cap: 'butt' });
  assert.equal(f[0].fill.colour, mixColour('#ffffff', '#e07b39', 1 - luminance('#d9e4f3')));
  // white is the paper: line art in duotone is the duotone's paper and its ink; a contour's wide stroke the ink too
  const art = paintPiece(isoStyle({ look: 'line-art', palette: 'duotone' }), block, grid, colours).items;
  assert.ok(art.filter((it) => it.role !== 'contour').every((it) => it.fill.colour === '#ffffff' && it.stroke.colour === '#22304a'));
  assert.ok(art.filter((it) => it.role === 'contour').every((it) => it.fill === null && it.stroke.colour === '#22304a'));
  // a hand-drawn line comes before the palette: its strokes print in the ink
  const sketched = paintPiece(isoStyle({ look: 'duotone', line: 'human:sketchy' }, { choices }), block, grid, colours).items;
  assert.ok(sketched.filter((it) => it.item === 'stroke').every((it) => it.stroke.colour === '#22304a'));
  // the inks as written: any case, #rgb too
  const own = paintPiece(isoStyle({ palette: { name: 'duotone', ink: '#000', accent: '#2A6F97', paper: '#FFFDF5' } }), block, grid, colours).items;
  assert.deepEqual(own.map((it) => [it.fill.colour, it.stroke.colour]), [['#b8cdd6', '#000000'], ['#93b5c5', '#000000'], ['#d6e2e3', '#000000']]);
});

test('a name reads on every duotone tint at 4.5 : 1 or more — in the duotone\'s ink and in the tools\' usual ink — and a pair of inks that cannot is refused', () => {
  const tints = Array.from({ length: 61 }, (_, k) => mixColour(DUOTONE.paper, DUOTONE.accent, k / 100));
  const worst = (ink) => Math.min(...tints.map((t) => contrastRatio(ink, t)));
  close(Math.round(worst(DUOTONE.ink) * 100) / 100, 7, 'the duotone ink at the deepest tint');
  close(Math.round(worst('#14181f') * 100) / 100, 9.43, 'the tools\' usual ink at the deepest tint');
  assert.ok(contrastRatio(DUOTONE.ink, DUOTONE.accent) < 4.5, 'the accent whole would not do: why the tint stops at 60%');
  // every fill any map's pieces can come to, for random colours: at least 4.5 : 1 under the ink
  const hex = fc.array(fc.integer({ min: 0, max: 255 }), { minLength: 3, maxLength: 3 }).map((c) => `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`);
  fc.assert(fc.property(anyGrid, anyPiece, fc.option(hex, { nil: null }), fc.constantFrom('tones', 'paper'), (g, p, base, shading) => {
    const items = paintPiece(isoStyle({ look: 'duotone', shading }), { name: 'p', ...p }, g, { base, ink: '#14181f' }).items;
    for (const it of items) if (it.fill) assert.ok(contrastRatio(DUOTONE.ink, it.fill.colour) >= DUOTONE.text, `${it.fill.colour} under the ink`);
  }), { numRuns: RUNS });
  assert.throws(() => isoStyle({ palette: { name: 'duotone', ink: '#888888' } }), /^Error: isometric: the style's palette "duotone": a name in its ink #888888 stands 1\.88 : 1 on its tint #ecb088, and a name on a face needs 4\.5 : 1 — give a darker ink, a lighter accent or a lighter paper$/);
  assert.throws(() => isoStyle({ palette: { name: 'duotone', accent: '#22304a' } }), /stands \d\.\d\d : 1 on its tint #[0-9a-f]{6}, and a name on a face needs 4\.5 : 1/);
  // light on dark is read as well: a pale ink on a dark paper
  assert.equal(isoStyle({ palette: { name: 'duotone', ink: '#ffffff', accent: '#000000', paper: '#101010' } }).row.palette, 'duotone');
});

test('bad combinations are refused before anything is drawn, naming the entry and the fix', () => {
  assert.throws(() => isoStyle({ look: 'duotone', texture: 'human:grain' }, { choices }), /^Error: isometric: the style's texture "human:grain" cannot sit with palette "duotone" \(from the look "duotone": write palette beside it to change it\) — the grain is laid after the palette, in the map's ink, so it would print a third ink beside the duotone's two — take the grain out \(texture "none"\), or keep the grain and the palette "theme"$/);
  assert.throws(() => isoStyle({ look: 'paper-grain', palette: 'duotone' }, { choices }), /the style's texture "human:grain" \(from the look "paper-grain": write texture beside it to change it\) cannot sit with palette "duotone" — /);
  assert.throws(() => isoStyle({ look: 'duotone', texture: 'human:hatch' }, { choices }), /the style's texture "human:hatch" cannot sit with palette "duotone" \(from the look "duotone": .*\) — the hatch is drawn after the palette, in the map's ink, so it would print a third ink/);
  // a duotone with a palette already written: the look draws nothing
  assert.throws(() => isoStyle({ look: 'duotone', palette: 'theme' }), /^Error: isometric: the style's look "duotone" sets palette, and the row writes it itself, so the look draws nothing — drop the look, or the palette written beside it$/);
  assert.throws(() => isoStyle({ look: 'duotone', palette: { name: 'duotone', accent: '#2a6f97' } }), /the look draws nothing — drop the look, or the palette written beside it/);
  assert.throws(() => isoStyle({ look: 'paper-grain', texture: 'human:hatch' }, { choices }), /the style's look "paper-grain" sets texture, and the row writes it itself/);
  // the grain without its choice: a tool's own, to hand in — and the words say it came from the look
  assert.throws(() => isoStyle({ look: 'paper-grain' }), /^Error: isometric: the style's texture has no choice "human:grain" — the texture choices are "none"; "human:grain" is a tool's own choice \(its name has a prefix\), which is code no record holds: hand the choice itself in \{choices\} \(footprint-story\/human has the "human:" ones\) \(from the look "paper-grain": write texture beside it to change it\)$/);
  for (const [key, bad, range] of [['spacing', 3, 'from 4 to 200 px'], ['spacing', 201, 'from 4 to 200 px'], ['width', 0.1, 'from 0.25 to 4 px'], ['alpha', 0, 'from 0.02 to 1 \\(of the ink\\)'], ['alpha', 'faint', 'from 0.02 to 1']]) {
    assert.throws(() => isoStyle({ texture: { name: 'human:grain', [key]: bad } }, { choices }), new RegExp(`^Error: human: the style's texture "human:grain" takes a ${key} ${range}.* — not ${typeof bad === 'string' ? `"${bad}"` : bad}$`));
  }
  assert.throws(() => isoStyle({ texture: { name: 'human:grain', angle: 3 } }, { choices }), /the style's texture "human:grain" takes spacing, width, alpha — not "angle"/);
  for (const bad of ['navy', '#12']) assert.throws(() => isoStyle({ palette: { name: 'duotone', ink: bad } }), /the style's palette "duotone"'s ink is a colour, "#rgb" or "#rrggbb"/);
  assert.throws(() => isoStyle({ palette: { name: 'duotone', tint: 0.5 } }), /the style's palette "duotone" takes ink, accent, paper — not "tint"/);
  // a face too big for its grain: refused on the piece, naming the spacing that fits
  const hall = { name: 'hall', kind: 'block', at: [0, 0], size: [4, 4, 1] };
  assert.throws(() => paintPiece(grained, hall, isometric({ tile: 600, origin: [0, 0] })), /^Error: human: the style's texture "human:grain" on "hall": its top face is too big for its grain at 16 px \(one face's grain holds at most 4096 marks\) — give a wider spacing: texture: \{name: 'human:grain', spacing: 51\}$/);
  assert.equal(paintPiece(isoStyle({ texture: { name: 'human:grain', spacing: 51 } }, { choices }), hall, isometric({ tile: 600, origin: [0, 0] })).items.length, 6, 'the spacing named fits');
  assert.throws(() => paintPiece(grained, hall, isometric({ tile: 2000, origin: [0, 0] })), /its left face is too big for its grain at 16 px .* — no spacing up to 200 px fits it: take the grain out \(texture "none"\), or draw the map at a smaller tile$/);
});

test('the record keeps the look; a record made again is the same style; a built map names its look', () => {
  for (const look of ['paper-grain', 'duotone']) {
    const style = isoStyle({ look }, { choices });
    assert.equal(style.look, look);
    assert.deepEqual(structuredClone(style), style);
    const again = restyle(structuredClone(style), { choices });
    assert.deepEqual(again, style);
    assert.deepStrictEqual(paintPiece(again, block, grid, colours), paintPiece(style, block, grid, colours));
    const spec = { blocks: [{ name: 'web', size: [2, 2, 1] }, { name: 'db', kind: 'cylinder', size: [2, 2, 1] }], wires: [{ from: { block: 'web' }, to: { block: 'db' } }], floors: [{ label: 'P' }], area: [0, 0, 1600, 900] };
    for (const policy of [ISO_MAP_POLICIES.film, ISO_MAP_POLICIES.deck]) {
      const map = buildIsoMap({ ...spec, style: { look } }, policy, { choices }), usual = buildIsoMap(spec, policy);
      assert.equal(map.style.look, look);
      assert.deepStrictEqual(structuredClone(map), map);
      for (const key of ['at', 'routes', 'view', 'names', 'order', 'floorLabels', 'shapes', 'floorShapes']) assert.deepStrictEqual(map[key], usual[key], key);
      // what the tools' painters need: only items they draw today, and no hand-drawn stroke
      assert.ok(map.paints.flat().every((it) => PAINT_ITEMS.includes(it.item) && it.item !== 'stroke'));
    }
  }
  assert.deepEqual(isoStyle({ look: 'duotone', palette: undefined }).options, {}, 'the duotone\'s inks are its own unless written');
});

/** The 64-block world of the record-size test (test/mapflow-record-size.test.js), at a film's tile. */
const blocks = Array.from({ length: 64 }, (_, i) => ({ name: `b${i}`, at: [(i % 8) * 3, Math.floor(i / 8) * 3], size: [2, 2, 1 + (i % 3)], kind: i % 5 ? 'block' : 'cylinder', label: `B${i}` }));
const WORLD = Object.freeze({ blocks, wires: blocks.slice(1).map((b, i) => ({ from: { block: blocks[i].name }, to: { block: b.name } })).filter((_, i) => i % 4 === 0), floors: [{ label: 'World' }], area: [0, 0, 1920, 1080] });

test('the tools\' budgets: a 64-block grain world is 179 lines items and no strokes, its 13,118 marks 0.33 MB of SVG path data — under 2000 strokes and 2 MB', () => {
  for (const policy of [ISO_MAP_POLICIES.film, ISO_MAP_POLICIES.deck]) {
    const map = buildIsoMap({ ...WORLD, style: { look: 'paper-grain' } }, policy, { choices });
    const items = map.paints.flat(), grain = items.filter((it) => it.role === 'grain'), marks = grain.reduce((n, it) => n + it.segments.length, 0);
    // as an SVG painter writes them (StoryDeck: one decimal, `M x yL x y` a mark)
    const svg = grain.reduce((n, it) => n + it.segments.map(([x1, y1, x2, y2]) => `M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}`).join('').length, 0);
    assert.deepEqual([items.length, grain.length, items.filter((it) => it.item === 'stroke').length, marks], [358, 179, 0, 13118]);
    assert.ok(items.length < 2000 && svg < 2_000_000 && svg > 300_000, `${svg} bytes`);
  }
});

test('the grain is low contrast: a mark, blended at its alpha, stands under 1.6 : 1 against the face it lies on, on today\'s tones', () => {
  for (const base of ['#d9e4f3', '#efe8da', '#e6dcf5', '#f3e3c7', '#dcefe0']) {
    for (const it of paintPiece(grained, block, grid, { base, ink: '#14181f' }).items.filter((x) => x.fill)) {
      const ratio = contrastRatio(it.fill.colour, mixColour(it.fill.colour, '#14181f', GRAIN.alpha));
      assert.ok(ratio > 1.3 && ratio < 1.6, `${base} ${it.role}: ${ratio}`);
    }
  }
});
