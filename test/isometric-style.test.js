// Styles (0.23.0): the interface a choice has, a tool's own choices, the record, and every refusal naming the fix.
import test from 'node:test';
import assert from 'node:assert/strict';
import { isometric, isoStyle, paintPiece, ISO_STYLE_COLUMNS, ISO_STYLE_CHOICES, USUAL_STYLE, MOST_EFFECTS, MOST_OWN_CHOICES, PAINT_ITEMS, MOST_PAINT_ITEMS, mixColour } from '../isometric.js';

const grid = isometric({ tile: 100, origin: [500, 100] });
const block = { name: 'server', kind: 'block', at: [1, 1], size: [2, 2, 1] }, floor = { name: 'ground', kind: 'floor', at: [0, 0], size: [3, 2] };
const colours = { base: '#d9e4f3', ink: '#14181f' };

test('the columns, the usual style, and the choices this package ships', () => {
  assert.deepEqual(ISO_STYLE_COLUMNS, ['shape', 'shading', 'line', 'palette', 'texture', 'effects']);
  assert.deepEqual(USUAL_STYLE, { shape: 'box', shading: 'tones', line: 'ink', palette: 'theme', texture: 'none', effects: [] });
  assert.deepEqual(ISO_STYLE_CHOICES, { shape: ['box'], shading: ['tones'], line: ['ink', 'none'], palette: ['theme'], texture: ['none'], effects: [] });
  assert.deepEqual(PAINT_ITEMS, ['polygon', 'ellipse', 'path', 'lines', 'stroke']);
  assert.equal(MOST_EFFECTS, 8); assert.equal(MOST_OWN_CHOICES, 64); assert.equal(MOST_PAINT_ITEMS, 512);
  assert.equal(mixColour('#d9e4f3', '#ffffff', 0.2), '#e1e9f5');
  // read as readColour reads a colour: #rgb as #rrggbb, any case; anything else refused (it once gave '#5606NaN')
  for (const c of ['#abc', '#ABC', '#aabbcc', '#AaBbCc']) assert.equal(mixColour(c, '#000000', 0.5), '#555e66', c);
  assert.equal(mixColour('#000000', '#fff', 0.2), '#333333');
  for (const bad of ['#ab', 'red', '#abcd', '#abcdeg', '', null, 7]) {
    assert.throws(() => mixColour(bad, '#000000', 0.5), new RegExp(`^Error: isometric: the colour mixed is a colour, "#rgb" or "#rrggbb" — not `), String(bad));
    assert.throws(() => mixColour('#000000', bad, 0.5), /the colour it is mixed toward is a colour, "#rgb" or "#rrggbb" — not /, String(bad));
  }
  for (const v of [ISO_STYLE_COLUMNS, USUAL_STYLE, USUAL_STYLE.effects, ISO_STYLE_CHOICES]) assert.ok(Object.isFrozen(v));
});

test('a style is plain data, the record of it: its row and the options written — frozen, and it clones', () => {
  const style = isoStyle({ line: { name: 'ink', width: 5 } });
  assert.deepEqual(style, { row: { ...USUAL_STYLE, effects: [] }, options: { line: { width: 5 } } });
  assert.deepEqual(structuredClone(style), style);
  assert.ok(Object.isFrozen(style) && Object.isFrozen(style.row) && Object.isFrozen(style.options.line));
  assert.deepEqual(isoStyle(null), isoStyle());
  // a copy of a style is its record, not a style: only what isoStyle made paints (its choices are held apart)
  assert.throws(() => paintPiece(structuredClone(style), block, grid), /paintPiece takes a style isoStyle made/);
});

test('outlined: the ink line 5 px wide — the same faces and fills, only the strokes wider; line "none": no outline, a floor keeps its tiles', () => {
  const usual = paintPiece(isoStyle(), block, grid, colours).items, wide = paintPiece(isoStyle({ line: { name: 'ink', width: 5 } }), block, grid, colours).items;
  assert.deepEqual(wide.map(({ stroke, ...rest }) => rest), usual.map(({ stroke, ...rest }) => rest));
  assert.ok(wide.every((it) => it.stroke.width === 5) && usual.every((it) => it.stroke.width === 2.5));
  const bare = paintPiece(isoStyle({ line: 'none' }), block, grid, colours).items;
  assert.ok(bare.every((it) => it.stroke === null));
  const tiles = paintPiece(isoStyle({ line: 'none' }), floor, grid, colours).items;
  assert.deepEqual(tiles.map((it) => [it.role, it.stroke && it.stroke.width]), [['ground', null], ['grid', 1.5]]);
  assert.throws(() => isoStyle({ line: { name: 'ink', width: 50 } }), /the style's line "ink" takes a width from 0.5 to 20 px — not 50/);
  assert.throws(() => isoStyle({ line: { name: 'none', width: 5 } }), /the style's line "none" takes no options — not "width"/);
});

test('a style refuses what it cannot read, naming the column and the fix', () => {
  assert.throws(() => isoStyle('flat'), /isoStyle takes a row of choices \{shape, shading, line, palette, texture, effects\}, or none — not "flat"/);
  assert.throws(() => isoStyle({ outline: 'ink' }), /a style's columns are shape, shading, line, palette, texture, effects — not "outline"/);
  assert.throws(() => isoStyle({ line: 'thick' }), /the style's line has no choice "thick" — the line choices are "ink", "none"/);
  assert.throws(() => isoStyle({ effects: ['shadow'] }), /the style's effects has no choice "shadow" — the effects choices are none yet/);
  assert.throws(() => isoStyle({ effects: 'shadow' }), /the style's effects are a list of at most 8/);
  assert.throws(() => isoStyle({ line: { width: 5 } }), /the style's line names its choice: \{name: "ink", width: 5\}/);
  assert.throws(() => isoStyle({ line: { name: 'ink', width: [5] } }), /the style's line's width is a number, a word or true\/false/);
  assert.throws(() => isoStyle({ line: Object.defineProperty({}, 'name', { get: () => 'ink' }) }), /is read as a stored value, and this one is a getter/);
  assert.throws(() => isoStyle(undefined, 'mine'), /isoStyle's settings are \{choices\}, or none/);
});

// a tool's own choice: hatching over every face, the strokes placed by the seeded random numbers
const hatch = { column: 'texture', name: 'test:hatch', options: ['lines'],
  check: (o) => { if (o.lines !== undefined && !(Number.isInteger(o.lines) && o.lines >= 1 && o.lines <= 20)) throw new Error('test:hatch takes 1 to 20 lines'); },
  clashes: [{ column: 'line', name: 'none', fix: 'hatching needs an outline to stop at — use line "ink"' }],
  apply: (items, { options, random, piece }) => [...items, ...items.filter((it) => it.item === 'polygon').map((it) => ({ item: 'lines', role: 'hatch', of: piece.name,
    segments: Array.from({ length: options.lines ?? 3 }, () => { const [x, y] = it.points[0]; return [x, y, x + random() * 10, y + random() * 10]; }), fill: null, stroke: { colour: null, alpha: 0.5, width: 1, join: 'round', cap: 'round' } }))] };

test('a tool\'s own choice: named with its prefix, in the record, seeded by the style and the piece (the same every time), checked once', () => {
  const style = isoStyle({ texture: { name: 'test:hatch', lines: 4 } }, { choices: [hatch] });
  assert.deepEqual(style.row.texture, 'test:hatch');
  assert.deepEqual(style.options, { texture: { lines: 4 } });
  const a = paintPiece(style, block, grid, colours), again = paintPiece(style, block, grid, colours);
  assert.deepEqual(a, again, 'drawn twice, the same marks');
  assert.equal(a.items.filter((it) => it.role === 'hatch').length, 3);
  assert.ok(a.items.filter((it) => it.role === 'hatch').every((it) => it.segments.length === 4));
  const other = paintPiece(style, { ...block, name: 'db' }, grid, colours);
  assert.notDeepEqual(other.items.filter((it) => it.role === 'hatch').map((it) => it.segments), a.items.filter((it) => it.role === 'hatch').map((it) => it.segments), 'another piece, other marks');
  assert.throws(() => isoStyle({ texture: { name: 'test:hatch', lines: 99 } }, { choices: [hatch] }), /^Error: test:hatch takes 1 to 20 lines$/);
  // a pairing that cannot work is refused before anything is drawn, with the fix
  assert.throws(() => isoStyle({ texture: 'test:hatch', line: 'none' }, { choices: [hatch] }), /the style's texture "test:hatch" cannot sit with line "none" — hatching needs an outline to stop at — use line "ink"/);
  // a choice not handed in is no choice
  assert.throws(() => isoStyle({ texture: 'test:hatch' }), /the style's texture has no choice "test:hatch" — the texture choices are "none"/);
});

test('a tool\'s own choice is refused when it is not one: no prefix, twice, no apply, bad options or clashes', () => {
  const bad = (c, re) => assert.throws(() => isoStyle(undefined, { choices: [c] }), re);
  bad({ ...hatch, name: 'hatch' }, /choices\[0\]'s name is the tool's prefix and a name, lower case \("reel:chalk"\): a name with no prefix is this package's — not "hatch"/);
  bad({ ...hatch, column: 'outline' }, /choices\[0\]'s column is one of shape, shading, line, palette, texture, effects — not "outline"/);
  bad({ ...hatch, apply: 'draw' }, /choices\[0\] \(test:hatch\) gives its apply\(input, context\) — not "draw"/);
  bad({ ...hatch, options: ['Lines'] }, /'s options are the names it reads, at most 16, lower case/);
  bad({ ...hatch, clashes: [{ column: 'line', name: 'none' }] }, /'s clashes\[0\] is \{column, name, fix\}: a column, a choice's name and the fix in words/);
  bad({ ...hatch, check: 1 }, /'s check is a function \(options\) that refuses what it cannot take, or none/);
  assert.throws(() => isoStyle(undefined, { choices: [hatch, hatch] }), /choices\[1\]: texture "test:hatch" is given twice/);
  assert.throws(() => isoStyle(undefined, { choices: Array(65).fill(hatch) }), /isoStyle's choices are a list of at most 64/);
});

test('what a choice gives back is checked before the next column reads it: plain data, known items, bounded; what it throws is its own', () => {
  const texture = (apply) => isoStyle({ texture: 'test:t' }, { choices: [{ column: 'texture', name: 'test:t', apply }] });
  const paint = (apply) => paintPiece(texture(apply), block, grid, colours);
  const one = (more) => (items) => [...items, { item: 'polygon', role: 'mark', of: 'server', points: [[0, 0], [1, 0], [0, 1]], fill: null, stroke: null, ...more }];
  assert.equal(paint(one({})).items.length, 4);
  assert.throws(() => paint(() => 'a picture'), /the style's texture "test:t" gives back a paint list, a list of items — not "a picture"/);
  assert.throws(() => paint(one({ item: 'circle' })), /item 4 is a polygon, a ellipse, a path, a lines, a stroke — not "circle"/);
  assert.throws(() => paint(one({ draw: () => 1 })), /item 4 holds plain data only/);
  assert.throws(() => paint((items) => [...items, Object.defineProperty({ ...items[0] }, 'role', { get: () => 'top', enumerable: true })]), /item 4: role is read as a stored value, and this one is a getter/);
  assert.throws(() => paint(one({ fill: { mix: null, colour: 'red' } })), /item 4's fill colour is null or "#rrggbb" — not "red"/);
  assert.throws(() => paint(one({ stroke: { colour: null, alpha: 2, width: 1, join: 'round', cap: 'butt' } })), /item 4's stroke alpha is from 0 to 1 — not 2/);
  assert.throws(() => paint(one({ points: [[0, 0], [1, NaN], [0, 1]] })), /item 4's point is a point \[x, y\], two finite numbers/);
  assert.throws(() => paint(one({ colour: '#ffffff' })), /item 4 \(a polygon\) holds item, role, of, points, fill and stroke — not \["colour"\]/);
  assert.throws(() => paint(one({ role: 'Top' })), /item 4's role is a short lower-case name/);
  assert.throws(() => paint((items) => [...items, ...Array(600).fill(items[0])]), /gives back 603 items, and one piece holds at most 512/);
  assert.throws(() => paint(() => { throw new Error('mine'); }), /^Error: mine$/);
  // the list handed on shares nothing with what the choice holds: a later edit of its own object reaches nothing
  const kept = { item: 'polygon', role: 'mark', of: 'server', points: [[0, 0], [1, 0], [0, 1]], fill: null, stroke: null };
  const got = paint((items) => [...items, kept]);
  kept.points[0][0] = 99;
  assert.equal(got.items[3].points[0][0], 0);
  assert.ok(Object.isFrozen(got.items[3].points[0]));
});

test('paintPiece refuses what it cannot read, naming the fix', () => {
  const style = isoStyle();
  assert.throws(() => paintPiece({ row: USUAL_STYLE, options: {} }, block, grid), /paintPiece takes a style isoStyle made/);
  assert.throws(() => paintPiece(style, { ...block, name: '' }, grid), /a piece's name is 1 to 64 letters/);
  assert.throws(() => paintPiece(style, { ...block, kind: 'cone' }, grid), /a piece's kind is block, cylinder, floor — not "cone"/);
  assert.throws(() => paintPiece(style, { ...block, size: [2, 2] }, grid), /"server"'s size is \[wide, deep, high\]/);
  // a floor lies on the ground: a lift on its at is dropped, as StoryDeck reads it
  assert.deepEqual(paintPiece(style, { ...floor, at: [0, 0, 1] }, grid), paintPiece(style, floor, grid));
  assert.throws(() => paintPiece(style, { ...floor, at: [0] }, grid), /"ground"'s at is \[col, row\]/);
  assert.throws(() => paintPiece(style, block, grid, { base: 'blue' }), /the colours' base is a colour, "#rgb" or "#rrggbb" — not "blue"/);
  assert.throws(() => paintPiece(style, block, {}), /paintPiece draws on a map's grid \(isometric\(\.\.\.\)\)/);
  assert.throws(() => paintPiece(style, { ...block, kind: 'cylinder', size: [2, 1, 1] }, grid), /a cylinder is round/);
  // a short colour is read as its long form
  assert.deepEqual(paintPiece(style, block, grid, { base: '#FFF', ink: '#000' }), paintPiece(style, block, grid, { base: '#ffffff', ink: '#000000' }));
});

test('lists are read entry by entry, as a record reads them: never their own map, a species, a hole or a getter', () => {
  const texture = (apply) => paintPiece(isoStyle({ texture: 'test:t' }, { choices: [{ column: 'texture', name: 'test:t', apply }] }), block, grid, colours);
  // a list's own map is never asked: it is read by index (this one has none)
  let mapped = false;
  assert.deepEqual(texture(() => Object.assign([], { map: () => { mapped = true; return [{ item: 'blob', fn: () => 1, of: 7 }]; } })).items, []);
  assert.equal(mapped, false);
  assert.throws(() => texture((items) => { const a = [...items]; a.length = 5; return a; }), /'s paint list has a hole at 4 — give every entry/);
  let ran = false;
  assert.throws(() => texture((items) => Object.defineProperty([...items], 0, { get: () => { ran = true; return items[0]; } })), /'s paint list's entry 1 is read as a stored value, and this one is a getter/);
  assert.equal(ran, false, 'the getter never ran');
  class Odd extends Array { static get [Symbol.species]() { return Object; } }
  assert.throws(() => texture((items) => Odd.from(items)), /'s paint list is a plain list/);
  // the same reading for every list a caller hands isoStyle
  assert.throws(() => isoStyle(undefined, { choices: Object.defineProperty([], 0, { get: () => hatch, enumerable: true }) }), /isoStyle's choices's entry 1 is read as a stored value/);
  assert.throws(() => isoStyle({ effects: Object.defineProperty([], 0, { get: () => 'x', enumerable: true }) }), /the style's effects's entry 1 is read as a stored value/);
  assert.throws(() => isoStyle(undefined, { choices: [{ ...hatch, options: Odd.from(['lines']) }] }), /options is a plain list/);
});

test('a style written with its options in another order is the same style, seeded the same; a key "__proto__" is refused, not swallowed', () => {
  const grain = { column: 'texture', name: 'test:grain', options: ['a', 'b'], apply: (items, { random, piece }) => [...items, { item: 'lines', role: 'grain', of: piece.name, segments: [[random(), random(), random(), random()]], fill: null, stroke: null }] };
  const one = isoStyle({ texture: { name: 'test:grain', a: 1, b: 2 } }, { choices: [grain] }), two = isoStyle({ texture: { name: 'test:grain', b: 2, a: 1 } }, { choices: [grain] });
  assert.deepEqual(Object.keys(two.options.texture), ['a', 'b']);
  assert.deepEqual(paintPiece(one, block, grid), paintPiece(two, block, grid));
  assert.throws(() => isoStyle(JSON.parse('{"line": {"name": "ink", "__proto__": 9}}')), /the style's line "ink" takes width — not "__proto__"/);
});

test('a clash names a choice there is; the shape gives its box, centre and outline, each checked by name; an item is of its own piece', () => {
  assert.throws(() => isoStyle(undefined, { choices: [{ ...hatch, clashes: [{ column: 'line', name: 'nonexistent', fix: 'x' }] }] }), /texture "test:hatch" clashes with line "nonexistent", which is no choice — the line choices are "ink", "none"/);
  const shaped = (made) => paintPiece(isoStyle({ shape: 'test:s' }, { choices: [{ column: 'shape', name: 'test:s', apply: () => made }] }), block, grid);
  const good = { box: { x: 0, y: 0, w: 1, h: 1 }, centre: [0, 0], outline: [[0, 0], [1, 0], [0, 1]], items: [] };
  assert.deepEqual(shaped(good).centre, [0, 0]);
  assert.throws(() => shaped({ ...good, box: { x: NaN, y: 0, w: 1, h: 1 } }), /the style's shape "test:s"'s box x is a finite number — not NaN/);
  assert.throws(() => shaped({ ...good, box: { x: 0, y: 0, w: -1, h: 1 } }), /'s box w is a finite number, from 0 — not -1/);
  assert.throws(() => shaped({ ...good, centre: [0] }), /'s centre is a point \[x, y\], finite numbers/);
  assert.throws(() => shaped({ ...good, outline: [[0, 0]] }), /gives back its outline, 3 to 4096 points round what it draws/);
  assert.throws(() => shaped({ ...good, items: [{ item: 'polygon', role: 'top', of: 'other', points: [[0, 0], [1, 0], [0, 1]], fill: null, stroke: null }] }), /item 1's of names its piece, "server" — not "other"/);
  // an arc is at most half a turn, and never none
  const arc = (from, to) => shaped({ ...good, items: [{ item: 'path', role: 'side', of: 'server', segments: [['move', 0, 0], ['arc', 0, 0, 1, 1, from, to, true]], fill: null, stroke: null }] });
  assert.equal(arc(Math.PI, 0).items.length, 1);
  assert.throws(() => arc(0, 2 * Math.PI), /at most half a turn, never none/);
  assert.throws(() => arc(1, 1), /at most half a turn, never none/);
  // counted the way it turns: anticlockwise from 0 to 0.5 is the long way round on a canvas, refused
  assert.throws(() => arc(0, 0.5), /at most half a turn, never none/);
  assert.equal(shaped({ ...good, items: [{ item: 'path', role: 'side', of: 'server', segments: [['move', 0, 0], ['arc', 0, 0, 1, 1, 0, 0.5, false]], fill: null, stroke: null }] }).items.length, 1);
  // an arc's radii are both above 0: with one at 0, SVG draws a straight line or nothing and a canvas a flattened
  // ellipse — refused naming the item and the fix
  const flat = (rx, ry) => shaped({ ...good, items: [{ item: 'path', role: 'side', of: 'server', segments: [['move', 0, 0], ['arc', 0, 0, rx, ry, Math.PI, 0, true]], fill: null, stroke: null }] });
  for (const [rx, ry] of [[0, 1], [1, 0], [0, 0], [-0, 1]]) assert.throws(() => flat(rx, ry), /the style's shape "test:s"'s item 1's arc has a radius of 0 \(rx \d, ry \d\): SVG draws it as a straight line or nothing, a canvas as a flattened ellipse, so the two tools would differ — give rx and ry above 0, or write a \['line', x, y\] to its end/);
  assert.throws(() => flat(-1, 1), /\(rx and ry above 0, at most half a turn, never none\)/);
  assert.equal(flat(1e-9, 1e-9).items.length, 1, 'any radius above 0 is an arc');
  // the line to an arc's start is none when it has no length: the usual cylinder's side reaches its arc from where its
  // left edge ends, so a painter writes no line there (StoryDeck's isoPaint · pathData writes none when the pen is there)
  for (const tile of [120, [100, 40], 77]) {
    const side = paintPiece(isoStyle(), { name: 'db', kind: 'cylinder', at: [1, 2, 0.5], size: [2, 2, 1.5] }, isometric({ tile })).items.find((it) => it.role === 'side').segments;
    const k = side.findIndex((g) => g[0] === 'arc'), [, cx, cy, rx, ry, from] = side[k], [, px, py] = side[k - 1];
    assert.ok(Math.hypot(cx + rx * Math.cos(from) - px, cy + ry * Math.sin(from) - py) < 1e-9, `tile ${tile}: the pen is at the arc's start`);
  }
  // a getter on the box or on a point of the centre is refused, never run
  let ran = false;
  assert.throws(() => shaped({ ...good, centre: Object.defineProperty([0, 0], 1, { get: () => { ran = true; return 0; } }) }), /'s centre's entry 2 is read as a stored value, and this one is a getter/);
  assert.throws(() => shaped({ ...good, box: Object.defineProperty({ x: 0, y: 0, w: 1 }, 'h', { get: () => { ran = true; return 1; }, enumerable: true }) }), /'s box h is read as a stored value, and this one is a getter/);
  assert.equal(ran, false);
  // a far piece on a big grid is far off the frame, and drawn: frame numbers are any finite number
  const far = paintPiece(isoStyle(), { ...block, at: [3e4, 3e4] }, isometric({ tile: 200 }));
  assert.ok(far.items[0].points[0][1] > 1e6);
});
