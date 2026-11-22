// A ball (0.37.0): the shape column paints StoryReel 0.44.0's round kind (`kind: 'ball'`), so a world with a ball and a
// style is no longer one only StoryReel can draw. Pinned: the contract against StoryReel's own code (a copy,
// test/control/storyreel-0.44.0-turn.mjs) for any ball on any grid — the same outline, middle, seams, box and fill,
// the edge drawn with the disc (the one difference, named); the ball in today's look and every named look, its
// geometry to 1e-6, the seeds exact; the refusals; and the README's still.
// FC_RUNS=5000 npm test runs a deeper sweep.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import fc from 'fast-check';
import * as reel from './control/storyreel-0.44.0-turn.mjs';
import { shapePiece, paintShaped } from '../src/isometric/style.js';
import { isometric, isoStyle, paintPiece, mixColour, ISO_LOOKS, SEAM, PAINT_ITEMS, MOST_PAINT_ITEMS } from '../isometric.js';
import { HUMAN_STYLE_CHOICES, sketchyLine, hatchTexture } from '../human.js';
import { segmentWithin } from '../src/human/strokes/geometry.js';
import { ballStill, BALL_STYLES } from './isoLookStills.js';

const RUNS = Number(process.env.FC_RUNS) || 300;
const choices = HUMAN_STYLE_CHOICES;
const grid = isometric({ tile: 100, origin: [500, 100] });
const ball = { name: 'ball', kind: 'ball', at: [1, 1], size: [1, 1, 1] };
const colours = { base: '#d9e4f3', ink: '#14181f' };
const close = (a, b, what) => assert.ok(Math.abs(a - b) <= 1e-6, `${what}: ${a} is not ${b} to 1e-6`);
const styleOf = (look) => isoStyle(look ? { look } : null, { choices });

/** StoryReel 0.44.0's ball, as built (unturned): its picture and its paint list (its items carry no role, no `of`, no colour). */
function reelBall(g, b) {
  const picture = reel.ballPicture(g, reel.centreOf(b), b.size[0] / 2, reel.UNTURNED);
  return { picture, items: reel.ballPaint(picture, (p) => p, reel.ISO_LOOK) };
}

const half = fc.integer({ min: 0, max: 40 }).map((n) => n / 2);
const anyGrid = fc.record({ w: fc.integer({ min: 20, max: 200 }), h: fc.option(fc.double({ min: 0.2, max: 0.95, noNaN: true }), { nil: undefined }), ox: fc.integer({ min: -2000, max: 2000 }), oy: fc.integer({ min: -2000, max: 2000 }), rise: fc.option(fc.integer({ min: 10, max: 150 }), { nil: undefined }) })
  .map(({ w, h, ox, oy, rise }) => isometric({ tile: h === undefined ? w : [w, Math.max(5, Math.round(w * h))], origin: [ox, oy], ...(rise === undefined ? {} : { rise }) }));
const anyBall = fc.record({ at: fc.oneof(fc.tuple(half, half), fc.tuple(half, half, half)), d: fc.integer({ min: 1, max: 24 }).map((n) => n / 4) }).map(({ at, d }) => ({ name: 'b', kind: 'ball', at, size: [d, d, d] }));

test('the contract is StoryReel\'s, for any ball on any grid: the same outline, middle, box, seams and fill; the edge drawn with the disc', () => {
  fc.assert(fc.property(anyGrid, anyBall, fc.boolean(), (g, b, coloured) => {
    const cs = coloured ? colours : undefined, ink = coloured ? colours.ink : null, mine = paintPiece(isoStyle(), b, g, cs), { picture, items } = reelBall(g, b);
    // where it stands: StoryReel's outline (72 points), its middle (where the name stands) and build.mjs's box round it
    assert.deepStrictEqual(mine.outline, picture.outline);
    assert.deepStrictEqual(mine.centre, picture.centre);
    const xs = picture.outline.map((p) => p[0]), ys = picture.outline.map((p) => p[1]);
    assert.deepStrictEqual(mine.box, { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) });
    // what it paints: the disc filled as a top (its fill StoryReel's), the two seams point for point (their stroke
    // StoryReel's marks), and the disc's edge StoryReel's last item's stroke
    const [disc, ...seams] = mine.items;
    assert.deepEqual([disc.item, disc.role, disc.of, seams.map((s) => [s.item, s.role])], ['polygon', 'top', 'b', [['path', 'seam'], ['path', 'seam']]]);
    assert.deepStrictEqual(disc.points, items[0].points);
    assert.deepStrictEqual(disc.fill, { mix: items[0].fill.mix, colour: coloured ? mixColour(colours.base, '#ffffff', 0.2) : null });
    assert.deepStrictEqual(disc.stroke, { ...items[3].stroke, colour: ink });
    assert.deepStrictEqual(items[3].points, items[0].points, 'StoryReel\'s edge is the disc again');
    seams.forEach((s, k) => {
      assert.deepStrictEqual(s.segments, items[1 + k].segments);
      assert.deepStrictEqual([s.fill, s.stroke], [null, { ...items[1 + k].stroke, colour: ink }]);
    });
    // the shape and the paint apart are the whole, as for every piece
    assert.deepStrictEqual(paintShaped(isoStyle(), b, shapePiece(isoStyle(), b, g, cs).items, cs), mine.items);
  }), { numRuns: RUNS });
});

test('the one difference, named: StoryReel draws the edge after the seams, the list with the disc — ink over ink, inside the edge\'s band', () => {
  const { items } = reelBall(grid, ball), mine = paintPiece(isoStyle(), ball, grid).items;
  assert.deepEqual(items.map((it) => [it.item, it.fill === null, it.stroke === null]), [['polygon', false, true], ['path', true, false], ['path', true, false], ['polygon', true, false]]);
  assert.deepEqual(mine.map((it) => [it.item, it.fill === null, it.stroke === null]), [['polygon', false, false], ['path', true, false], ['path', true, false]]);
  // each seam ends on the outline, so its round cap (half its 2 px) lies inside the edge's outer half (1.25 px): where
  // the two orders differ, a seam lies on the edge's ink, and ink at 0.5 over ink is the ink
  const [cx, cy] = paintPiece(isoStyle(), ball, grid).centre, radius = Math.hypot(mine[0].points[0][0] - cx, mine[0].points[0][1] - cy);
  for (const seam of mine.slice(1)) for (const end of [seam.segments[0], seam.segments.at(-1)]) {
    const off = Math.abs(Math.hypot(end[1] - cx, end[2] - cy) - radius);
    assert.ok(off < 1e-9, `a seam ends on the outline (${off})`);
  }
  assert.ok(SEAM.share * 2.5 / 2 < 2.5 / 2, 'a seam\'s half width is inside the edge\'s outer half');
});

test('a turned ball, as StoryReel draws one: the list\'s seams swapped for its turned marks are its marks, the rest is unchanged by a turn', () => {
  const turn = reel.turning(reel.turnAxis([1, 0]), 0.7), turned = reel.ballPicture(grid, reel.centreOf(ball), 0.5, turn);
  const list = paintPiece(isoStyle(), ball, grid, colours).items;
  const swapped = list.map((it) => (it.role === 'seam' ? { ...it, segments: [['move', ...turned.marks[list.indexOf(it) - 1][0]], ...turned.marks[list.indexOf(it) - 1].slice(1).map((p) => ['line', ...p])] } : it));
  const theirs = reel.ballPaint(turned, (p) => p, reel.ISO_LOOK);
  assert.deepStrictEqual(swapped.slice(1).map((it) => it.segments), theirs.slice(1, 3).map((it) => it.segments));
  assert.deepStrictEqual(swapped[0].points, theirs[0].points, 'the outline is the same however it turns');
});

test('the ball in today\'s look and every named look: the disc as a cylinder\'s top, the seams as each line draws its folds', () => {
  const ink = '#14181f', seam = (width) => ({ colour: ink, alpha: 0.5, width, join: 'round', cap: 'round' });
  const lit = { mix: ['#ffffff', 0.2], colour: '#e1e9f5' }, paper = { mix: ['#ffffff', 1], colour: '#ffffff' };
  const lists = Object.fromEntries(BALL_STYLES.map((look) => [look ?? 'usual', paintPiece(styleOf(look), ball, grid, colours).items]));
  const row = (it) => [it.item, it.role, it.fill, it.stroke && { ...it.stroke }];
  const edge = (width, cap = 'butt') => ({ colour: ink, alpha: 1, width, join: 'round', cap });
  assert.deepEqual(lists.usual.map(row), [['polygon', 'top', lit, edge(2.5)], ['path', 'seam', null, seam(2)], ['path', 'seam', null, seam(2)]]);
  assert.deepEqual(lists.outlined.map(row), [['polygon', 'contour', null, edge(8.5, 'round')], ['polygon', 'top', lit, edge(1.5, 'round')], ['path', 'seam', null, seam(1.2)], ['path', 'seam', null, seam(1.2)]]);
  assert.deepEqual(lists['line-art'].map(row), [['polygon', 'contour', null, edge(4.75, 'round')], ['polygon', 'top', paper, edge(1.25, 'round')], ['path', 'seam', null, seam(1)], ['path', 'seam', null, seam(1)]]);
  assert.deepEqual(lists['paper-grain'].slice(0, 3), lists.usual, 'paper grain: today\'s ball');
  assert.deepEqual(lists['paper-grain'].slice(3).map((it) => [it.item, it.role, it.segments.length]), [['lines', 'grain', 23]]);
  const tint = { mix: ['#f9e6d9', 1], colour: '#f9e6d9' };
  assert.deepEqual(lists.duotone.map(row), [['polygon', 'top', tint, { ...edge(2.5), colour: '#22304a' }], ...[0, 1].map(() => ['path', 'seam', null, { ...seam(2), colour: '#22304a' }])]);
  // sketched: the disc paper with no line, its silhouette in one stroke and each seam in one, by hand; a top is never hatched
  assert.deepEqual(lists.sketchy.map((it) => [it.item, it.role, it.points.length]), [['polygon', 'top', 72], ['stroke', 'ink', 145], ['stroke', 'ink', 61], ['stroke', 'ink', 67]]);
  assert.deepEqual([lists.sketchy[0].fill, lists.sketchy[0].stroke], [paper, null]);
  // line none keeps the seams (marks, not an outline), at the usual line's share
  assert.deepEqual(paintPiece(isoStyle({ line: 'none' }), ball, grid, colours).items.map((it) => it.stroke && it.stroke.width), [null, 2, 2]);
  assert.deepEqual(paintPiece(isoStyle({ line: { name: 'ink', width: 5 } }), ball, grid, colours).items.map((it) => it.stroke.width), [5, 4, 4]);
  assert.deepEqual(SEAM, { alpha: 0.5, share: 4 / 5 });
  for (const items of Object.values(lists)) assert.ok(items.every((it) => PAINT_ITEMS.includes(it.item)) && items.length <= MOST_PAINT_ITEMS);
});

test('the ball\'s geometry is pinned to 1e-6 on a known grid: its middle, radius, first outline point and each seam\'s ends', () => {
  const p = paintPiece(isoStyle(), ball, grid), up = Math.sqrt((100 * 100 - 50 * 50) / 2);   // the rise: 61.24 px
  close(p.centre[0], 500, 'middle x'); close(p.centre[1], 100 + 150 * 0.5 * 0.5 * 2 - 0.5 * up, 'middle y');
  // on the usual grid the outline is a circle, radius 0.5 tiles as the camera sees it: 0.5 · 100 / √2
  const radius = 50 / Math.SQRT2;
  for (const [x, y] of p.outline) close(Math.hypot(x - p.centre[0], y - p.centre[1]), radius, 'on the circle');
  close(p.outline[0][0], 500 + radius, 'outline starts across the view: x'); close(p.outline[0][1], p.centre[1], 'y');
  close(p.box.w, 2 * radius, 'box w'); close(p.box.h, 2 * radius, 'box h');
  // the level seam runs from one side to the other through the front; the upright one from the lower left over the top
  const [level, upright] = p.items.slice(1).map((s) => [s.segments[0].slice(1), s.segments.at(-1).slice(1)]);
  [[level[0], [500 + radius, p.centre[1]]], [level[1], [500 - radius, p.centre[1]]]].forEach(([got, want], k) => { close(got[0], want[0], `level ${k} x`); close(got[1], want[1], `level ${k} y`); });
  assert.ok(upright[0][0] < 500 && upright[1][0] > 500, 'the upright seam crosses from left to right');
});

test('for any ball on any grid, in every look: the outline, middle and box are today\'s, every item a painter draws, the seeds exact, the grain inside the disc', () => {
  const styles = BALL_STYLES.map((look) => styleOf(look)), usual = isoStyle();
  fc.assert(fc.property(anyGrid, anyBall, fc.boolean(), (g, b, coloured) => {
    const cs = coloured ? colours : undefined, was = paintPiece(usual, b, g, cs);
    styles.forEach((style, k) => {
      const now = paintPiece(style, b, g, cs);
      assert.deepStrictEqual([now.box, now.centre, now.outline], [was.box, was.centre, was.outline]);
      assert.ok(now.items.length <= MOST_PAINT_ITEMS && now.items.every((it) => PAINT_ITEMS.includes(it.item) && it.of === 'b'));
      assert.ok(now.items.some((it) => it.role === 'top' && it.item === 'polygon' && it.fill !== null), 'the disc is filled');
      if (BALL_STYLES[k] === 'paper-grain') {
        for (const it of now.items.filter((x) => x.role === 'grain' || x.role === 'grain-thinned')) for (const [x1, y1, x2, y2] of it.segments) assert.ok(segmentWithin([x1, y1], [x2, y2], was.outline, [], 1e-6));
      }
      if (BALL_STYLES[k] === 'sketchy') assert.ok(now.items.filter((it) => it.item === 'stroke').length >= 2 && !now.items.some((it) => it.role === 'seam' || it.role === 'hatch'));
    });
    assert.deepStrictEqual(paintPiece(styles.at(-1), b, g, cs), paintPiece(styles.at(-1), b, g, cs));
  }), { numRuns: RUNS });
});

test('the seeds are exact for a ball: painted twice or after another, the same strokes; a name of its own, a wobble of its own', () => {
  const style = styleOf('sketchy'), first = paintPiece(style, ball, grid, colours);
  paintPiece(style, { ...ball, name: 'other', at: [3, 1] }, grid, colours);
  assert.deepStrictEqual(paintPiece(style, ball, grid, colours), first);
  assert.deepStrictEqual(paintPiece(isoStyle({ look: 'sketchy' }, { choices: [hatchTexture, sketchyLine] }), ball, grid, colours), first, 'the choices handed in any order');
  assert.notDeepStrictEqual(paintPiece(style, { ...ball, name: 'other' }, grid, colours).items[1].points, first.items[1].points);
});

test('a ball is refused what it cannot be, naming the fix', () => {
  assert.throws(() => paintPiece(isoStyle(), { ...ball, size: [1, 1, 2] }, grid), /^Error: isometric: "ball" is a ball, round every way: its size is \[wide, wide, wide\], one number three times \(1 1 1\) — not \[1,1,2\]$/);
  assert.throws(() => paintPiece(isoStyle(), { ...ball, size: [1, 1] }, grid), /"ball"'s size is \[wide, deep, high\]/);
  assert.throws(() => paintPiece(isoStyle(), { ...ball, size: [0, 0, 0] }, grid), /a ball's size is \[wide, deep, high\] with wide and deep above 0/);
  assert.throws(() => paintPiece(isoStyle(), { ...ball, at: [1] }, grid), /"ball"'s at is \[col, row\] or \[col, row, lift\]/);
  // a grid of a tool's own with no at: a ball is put on the frame point by point
  const { at, ...noAt } = grid;
  void at;
  assert.throws(() => paintPiece(isoStyle(), ball, noAt), /^Error: isometric: paintPiece draws a ball on a map's grid, which puts a point on the frame \(isometric\(\.\.\.\) · at\) — not /);
  assert.equal(paintPiece(isoStyle(), { ...ball, kind: 'block' }, noAt).items.length, 3, 'a block never asks for it');
  // a tool's own line that knows no seam leaves it unstroked: drawn as nothing, never refused
  const plain = { column: 'line', name: 'test:plain', apply: (items) => items.map((it) => (it.role === 'top' ? { ...it, stroke: { colour: null, alpha: 1, width: 1, join: 'round', cap: 'butt' } } : it)) };
  assert.deepEqual(paintPiece(isoStyle({ line: 'test:plain' }, { choices: [plain] }), ball, grid).items.map((it) => it.stroke === null), [false, true, true]);
});

test('the README\'s still of a ball in every look is what paintPiece paints today', () => {
  assert.deepEqual(BALL_STYLES, [null, ...Object.keys(ISO_LOOKS)]);
  const path = fileURLToPath(new URL('../src/isometric/ball-looks.svg', import.meta.url)), picture = ballStill();
  if (process.env.WRITE_EXAMPLE) writeFileSync(path, picture);
  assert.equal(readFileSync(path, 'utf8'), picture, 'run WRITE_EXAMPLE=1 node --test test/isometric-ball.test.js to draw it again');
});
