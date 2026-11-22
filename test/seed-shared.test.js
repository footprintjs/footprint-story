// The one seed rule (src/seed/seeded.js), shared by the isometric styles and the human door since 0.27.0. Before it
// each door kept its own copy. The outputs that depend on it are pinned against what 0.26.0 gave, as released
// (test/seed-0.26.0.fixture.json, captured from 0.26.0's src/human/seed.js and src/isometric/style.js): the numbers
// themselves, a style's own seeded choice painted on three pieces, a pen's tremor sampled along its line, and the
// tremor's knots. The numbers, marks and knots byte for byte; the pen's points to a millionth of a pixel (they pass
// through sqrt, sin and cos, which V8 does not promise to the last bit across versions).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { seeded } from '../src/seed/seeded.js';
import { isometric, isoStyle, paintPiece } from '../isometric.js';
import { planMove, sampleMove, tremorKnots } from '../human.js';

const before = JSON.parse(readFileSync(new URL('./seed-0.26.0.fixture.json', import.meta.url), 'utf8'));

test('the shared seed rule gives 0.26.0\'s numbers, its styles\' marks and its knots byte for byte, and its pen to a millionth of a pixel', () => {
  const r = seeded('footprint-story');
  assert.deepEqual(Array.from({ length: 8 }, () => r()), before.numbers);
  const grid = isometric({ tile: 64, origin: [480, 120] });
  const marks = { column: 'texture', name: 'test:marks', options: [], apply: (items, { random, piece }) => [...items, { item: 'lines', role: 'marks', of: piece.name, segments: Array.from({ length: 4 }, () => [random(), random(), random(), random()]), fill: null, stroke: { colour: null, alpha: 0.5, width: 1, join: 'round', cap: 'round' } }] };
  const style = isoStyle({ texture: 'test:marks', effects: [] }, { choices: [marks] });
  const paints = ['server', 'db', 'Ünïcode 🙂'].map((name) => paintPiece(style, { name, kind: 'block', at: [1, 2], size: [2, 1, 1] }, grid, { base: '#d9e4f3', ink: '#14181f' }).items.find((it) => it.role === 'marks').segments);
  assert.deepEqual(JSON.parse(JSON.stringify(paints)), before.paints);
  const move = planMove({ do: 'draw', name: 'pen', path: [[0, 0], [200, 80], [400, 0], [420, 200]] });
  const pen = Array.from({ length: 11 }, (_, i) => { const s = sampleMove(move, (i / 10) * move.plan.seconds); return [s.x, s.y]; });
  // the pen's points go through sqrt, sin and cos, which V8 does not promise to the last bit across versions (Node 22
  // and 24 part in the 15th digit): the seed's own numbers above and the knots below are exact; the pen is compared to
  // a millionth of a pixel, far below anything drawn, so a changed seed (which moves the tremor by pixels) still fails
  pen.forEach(([x, y], i) => {
    const [bx, by] = before.pen[i];
    assert.ok(Math.abs(x - bx) <= 1e-6 && Math.abs(y - by) <= 1e-6, `pen sample ${i}: [${x}, ${y}] is not 0.26.0's [${bx}, ${by}]`);
  });
  assert.deepEqual(tremorKnots(seeded('tremor'), 300), before.knots);
});
