// The one seed rule (src/seed/seeded.js), shared by the isometric styles and the human door since 0.27.0. Before it
// each door kept its own copy. The outputs that depend on it are pinned against what 0.26.0 gave, as released
// (test/seed-0.26.0.fixture.json, captured from 0.26.0's src/human/seed.js and src/isometric/style.js): the numbers
// themselves, a style's own seeded choice painted on three pieces, a pen's tremor sampled along its line, and the
// tremor's knots. Byte for byte, so a deck or a film drawn on 0.26.0 draws the same marks on 0.27.0.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { seeded } from '../src/seed/seeded.js';
import { isometric, isoStyle, paintPiece } from '../isometric.js';
import { planMove, sampleMove, tremorKnots } from '../human.js';

const before = JSON.parse(readFileSync(new URL('./seed-0.26.0.fixture.json', import.meta.url), 'utf8'));

test('the shared seed rule gives 0.26.0\'s numbers, its styles\' marks and its tremor, byte for byte', () => {
  const r = seeded('footprint-story');
  assert.deepEqual(Array.from({ length: 8 }, () => r()), before.numbers);
  const grid = isometric({ tile: 64, origin: [480, 120] });
  const marks = { column: 'texture', name: 'test:marks', options: [], apply: (items, { random, piece }) => [...items, { item: 'lines', role: 'marks', of: piece.name, segments: Array.from({ length: 4 }, () => [random(), random(), random(), random()]), fill: null, stroke: { colour: null, alpha: 0.5, width: 1, join: 'round', cap: 'round' } }] };
  const style = isoStyle({ texture: 'test:marks', effects: [] }, { choices: [marks] });
  const paints = ['server', 'db', 'Ünïcode 🙂'].map((name) => paintPiece(style, { name, kind: 'block', at: [1, 2], size: [2, 1, 1] }, grid, { base: '#d9e4f3', ink: '#14181f' }).items.find((it) => it.role === 'marks').segments);
  assert.deepEqual(JSON.parse(JSON.stringify(paints)), before.paints);
  const move = planMove({ do: 'draw', name: 'pen', path: [[0, 0], [200, 80], [400, 0], [420, 200]] });
  const pen = Array.from({ length: 11 }, (_, i) => { const s = sampleMove(move, (i / 10) * move.plan.seconds); return [s.x, s.y]; });
  assert.deepEqual(pen, before.pen);
  assert.deepEqual(tremorKnots(seeded('tremor'), 300), before.knots);
});
