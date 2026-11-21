// Styles (0.23.0): the usual style's paint list is today's look, drawn — pinned against copies of the two tools'
// drawing code (test/control/storyreel-0.38.0-draw.mjs, test/control/storydeck-0.32.0-shapeOf.js). Two small painters
// written here (a canvas one and an SVG one, as StoryReel and StoryDeck will have) paint the list; what they draw is
// what the tools drew, call for call and byte for byte, for any piece on any grid.
// FC_RUNS=200000 npm test runs a deep sweep.
import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import * as reel0 from './control/storyreel-0.38.0-draw.mjs';
import * as deck0 from './control/storydeck-0.32.0-shapeOf.js';
import { isometric, isoStyle, paintPiece } from '../isometric.js';

const RUNS = Number(process.env.FC_RUNS) || 1000;

/** A canvas that keeps what is filled and stroked: the path at that moment and the style it was drawn in. */
function recorder() {
  const drawn = [];
  let path = [];
  const c = { fillStyle: '#000000', strokeStyle: '#000000', lineWidth: 1, lineJoin: 'miter', lineCap: 'butt', drawn,
    beginPath: () => { path = []; }, moveTo: (...a) => path.push(['M', ...a]), lineTo: (...a) => path.push(['L', ...a]),
    closePath: () => path.push(['Z']), ellipse: (...a) => path.push(['E', ...a]),
    fill() { drawn.push({ op: 'fill', path: [...path], style: c.fillStyle }); },
    stroke() { drawn.push({ op: 'stroke', path: [...path], style: c.strokeStyle, width: c.lineWidth, join: c.lineJoin, cap: c.lineCap }); } };
  return c;
}

/** StoryReel's painter as step 2 will write it: each item's path, filled when it has a colour, stroked when it has a stroke. */
function canvasPaint(c, items) {
  const rgba = (hex, alpha) => `rgba(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(',')},${alpha})`;
  for (const it of items) {
    c.beginPath();
    if (it.item === 'polygon') { it.points.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); }
    if (it.item === 'ellipse') c.ellipse(it.cx, it.cy, it.rx, it.ry, 0, 0, 2 * Math.PI);
    if (it.item === 'lines') for (const [x1, y1, x2, y2] of it.segments) { c.moveTo(x1, y1); c.lineTo(x2, y2); }
    if (it.item === 'path') for (const [op, ...a] of it.segments) { if (op === 'move') c.moveTo(...a); else if (op === 'line') c.lineTo(...a); else if (op === 'arc') c.ellipse(a[0], a[1], a[2], a[3], 0, a[4], a[5], a[6]); else c.closePath(); }
    if (it.fill?.colour) { c.fillStyle = it.fill.colour; c.fill(); }
    if (it.stroke) { c.strokeStyle = it.stroke.alpha === 1 ? it.stroke.colour : rgba(it.stroke.colour, it.stroke.alpha); c.lineWidth = it.stroke.width; c.lineJoin = it.stroke.join; c.lineCap = it.stroke.cap; c.stroke(); }
  }
}

/** StoryDeck's painter as step 3 will write it: an element per item, classed by its role, placed in its box (CSS colours it). */
function svgArt(items, { x, y }) {
  const fixed = (v) => +v.toFixed(1), cls = (role) => `iso-${role === 'grid' ? 'lines' : role}`;
  return items.map((it) => {
    if (it.item === 'polygon') return `<polygon class="${cls(it.role)}" points="${it.points.map(([px, py]) => `${fixed(px - x)},${fixed(py - y)}`).join(' ')}"/>`;
    if (it.item === 'ellipse') return `<ellipse class="${cls(it.role)}" cx="${fixed(it.cx - x)}" cy="${fixed(it.cy - y)}" rx="${fixed(it.rx)}" ry="${fixed(it.ry)}"/>`;
    if (it.item === 'lines') return `<path class="${cls(it.role)}" d="${it.segments.map(([x1, y1, x2, y2]) => `M${fixed(x1 - x)} ${fixed(y1 - y)}L${fixed(x2 - x)} ${fixed(y2 - y)}`).join('')}"/>`;
    const d = it.segments.map(([op, ...a]) => (op === 'move' ? `M${fixed(a[0] - x)} ${fixed(a[1] - y)}` : op === 'line' ? `L${fixed(a[0] - x)} ${fixed(a[1] - y)}`
      : op === 'arc' ? `A${fixed(a[2])} ${fixed(a[3])} 0 ${Math.abs(a[5] - a[4]) > Math.PI ? 1 : 0} ${a[6] ? 0 : 1} ${fixed(a[0] + a[2] * Math.cos(a[5]) - x)} ${fixed(a[1] + a[3] * Math.sin(a[5]) - y)}` : 'Z')).join('');
    return `<path class="${cls(it.role)}" d="${d}"/>`;
  }).join('');
}

const half = fc.oneof(fc.integer({ min: 0, max: 20 }).map((n) => n / 2), fc.integer({ min: 0, max: 20000 }).map((n) => n / 2));
const grid = fc.record({ w: fc.integer({ min: 20, max: 200 }), h: fc.option(fc.double({ min: 0.2, max: 0.95, noNaN: true }), { nil: undefined }), ox: fc.oneof(fc.integer({ min: -500, max: 1500 }), fc.integer({ min: -200000, max: 200000 })), oy: fc.oneof(fc.integer({ min: -500, max: 900 }), fc.integer({ min: -200000, max: 200000 })), rise: fc.option(fc.integer({ min: 10, max: 150 }), { nil: undefined }) })
  .map(({ w, h, ox, oy, rise }) => isometric({ tile: h === undefined ? w : [w, Math.max(5, Math.round(w * h))], origin: [ox, oy], ...(rise === undefined ? {} : { rise }) }));
const solidPiece = fc.oneof(
  fc.record({ kind: fc.constant('block'), at: fc.tuple(half, half, half), size: fc.tuple(half.map((n) => n + 0.5), half.map((n) => n + 0.5), half) }),
  fc.record({ kind: fc.constant('cylinder'), at: fc.tuple(half, half, half), wide: half.map((n) => n + 0.5), high: half }).map(({ kind, at, wide, high }) => ({ kind, at, size: [wide, wide, high] })));
const floorPiece = fc.record({ kind: fc.constant('floor'), at: fc.tuple(fc.integer({ min: -5, max: 10 }), fc.integer({ min: -5, max: 10 })), size: fc.tuple(fc.integer({ min: 1, max: 12 }), fc.integer({ min: 1, max: 12 })) });
const hex = fc.integer({ min: 0, max: 0xffffff }).map((n) => `#${n.toString(16).padStart(6, '0')}`);

/** The shape StoryReel's build gives a piece (build.mjs · shapeBlocks / shapeFloors): what its drawBlock and drawFloor read. */
function reelShape(g, p) {
  if (p.kind === 'floor') { const f = g.floor({ cols: p.size[0], rows: p.size[1], at: p.at }); return { outline: f.outline.map(({ x, y }) => [x, y]), lines: f.lines, box: f.box }; }
  if (p.kind === 'cylinder') { const c = g.cylinder(p); return { kind: 'cylinder', top: c.top, bottom: c.bottom, centre: [c.centre.x, c.centre.y], box: c.box }; }
  const k = g.block(p), xy = (list) => list.map(({ x, y }) => [x, y]);
  return { kind: 'block', top: xy(k.top), left: xy(k.left), right: xy(k.right), centre: [k.centre.x, k.centre.y], box: k.box };
}

test('the usual style, painted on a canvas, draws what StoryReel 0.38.0 drew for a block, a cylinder and a floor — call for call', () => {
  const style = isoStyle();
  fc.assert(fc.property(grid, fc.oneof(solidPiece, floorPiece), hex, hex, fc.boolean(), (g, p, base, ink, coloured) => {
    const look = { ink, tones: {} }, was = recorder(), now = recorder();
    if (p.kind === 'floor') reel0.drawFloor(was, { shape: reelShape(g, p), color: coloured ? base : undefined, place: null }, look);
    else reel0.drawBlock(was, { shape: reelShape(g, p), color: base, fitted: null }, look);
    canvasPaint(now, paintPiece(style, { name: 'p', ...p }, g, { base: p.kind === 'floor' && !coloured ? null : base, ink }).items);
    assert.deepEqual(now.drawn, was.drawn);
  }), { numRuns: RUNS });
});

test('the usual style, painted as SVG, writes what StoryDeck 0.32.0 wrote for a block, a cylinder and a floor — byte for byte, and its box', () => {
  const style = isoStyle();
  fc.assert(fc.property(grid, fc.oneof(solidPiece, floorPiece), (g, p) => {
    const was = deck0.shapeOf({ ...p, where: 'p' }, g), now = paintPiece(style, { name: 'p', ...p }, g);
    assert.equal(svgArt(now.items, now.box), was.art);
    assert.deepEqual({ ...now.box }, { ...was.box });
    // what the deck reads of the shape besides its art: where the name stands, and the outline round it
    if (p.kind !== 'floor') { assert.deepEqual(now.centre, [was.say.x, was.say.y]); assert.deepEqual(now.outline, was.outline.map(({ x, y }) => [x, y])); }
  }), { numRuns: RUNS });
});

test('the default written out in full, and no colours at all: the same items; with no colours each fill keeps its recipe and no colour', () => {
  fc.assert(fc.property(grid, fc.oneof(solidPiece, floorPiece), hex, (g, p, base) => {
    const piece = { name: 'p', ...p }, usual = paintPiece(isoStyle(), piece, g, { base, ink: '#000000' });
    assert.deepEqual(paintPiece(isoStyle({ shape: 'box', shading: 'tones', line: 'ink', palette: 'theme', texture: 'none', effects: [] }), piece, g, { base, ink: '#000000' }), usual);
    const bare = paintPiece(isoStyle(), piece, g);
    assert.deepEqual(bare.items.map((it) => it.fill?.mix ?? null), usual.items.map((it) => it.fill?.mix ?? null));
    assert.ok(bare.items.every((it) => (it.fill === null || it.fill.colour === null) && (it.stroke === null || it.stroke.colour === null)));
    assert.deepEqual(structuredClone(bare), bare, 'a paint list is plain data');
  }), { numRuns: RUNS });
});
