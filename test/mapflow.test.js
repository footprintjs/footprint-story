// footprint-story/mapflow (0.24.0): the map's steps as a footprintjs chart. Its map equals buildIsoMap's for random maps
// (the two compositions of ISO_MAP_STEPS cannot drift), its record holds a stage per step and each decider's reason,
// and footprint-story/record answers from it why a block stands where it stands.
// FC_RUNS=20000 npm test runs a deep sweep.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import fc from 'fast-check';
import { FlowChartExecutor } from 'footprintjs';
import { fileSink } from 'footprintjs/sinks';
import { controlDepRecorder } from 'footprintjs/trace';
import { whyFromRecord, controlEdges } from '../record.js';
import { mapFlow, runMapFlow } from '../mapflow.js';
import { buildIsoMap, ISO_MAP_POLICIES, ISO_MAP_STEPS } from '../isometric.js';
import { mapArb } from './isoMapSpecs.js';
import { deckMapArb } from './deckMaps.js';
import { SUMMARISED, paintSummary } from '../src/mapflow/summary.js';

const RUNS = Math.ceil((Number(process.env.FC_RUNS) || 300) / 5);
const FILM = ISO_MAP_POLICIES.film, DECK = ISO_MAP_POLICIES.deck;
const SPEC = Object.freeze({ blocks: [{ name: 'web', size: [2, 2, 1], label: 'Web' }, { name: 'db', kind: 'cylinder', size: [2, 2, 1], label: 'Database' }],
  wires: [{ from: { block: 'web' }, to: { block: 'db' } }], floors: [{ label: 'Production' }], area: [0, 0, 1600, 900] });
const temp = (t) => { const dir = mkdtempSync(path.join(tmpdir(), 'story-mapflow-')); t.after(() => rmSync(dir, { recursive: true, force: true })); return dir; };

test('the map flow\'s map equals buildIsoMap\'s, for random maps, styles and both policies', async () => {
  const styled = fc.tuple(mapArb, fc.constantFrom(null, { line: 'none' }, { line: { name: 'ink', width: 4 } }), fc.constantFrom(FILM, ISO_MAP_POLICIES.deck), fc.option(fc.constantFrom({ base: '#d9e4f3', ink: '#14181f' }), { nil: null }));
  await fc.assert(fc.asyncProperty(styled, async ([spec, style, policy, colours]) => {
    const given = { ...spec, style, blocks: spec.blocks.map((b) => ({ ...b, colours })) }, before = structuredClone(given);
    const { map, snapshot } = await runMapFlow(given, policy);
    assert.deepStrictEqual(map, buildIsoMap(given, policy));
    // the record keeps the paint lists' counts and digest (0.33.1), and they are the built map's
    for (const key of SUMMARISED) assert.deepStrictEqual(snapshot.sharedState[key], paintSummary(map[key]), key);
    assert.deepStrictEqual(given, before, 'the spec is not edited');
    assert.ok(Object.isFrozen(map) && Object.isFrozen(map.shapes[0].faces[0]));
    // a stage per step: read, then each step — the two that choose as a decider and the branch it chose
    const branch = (key) => map[key];
    assert.deepEqual(snapshot.commitLog.map((c) => c.runtimeStageId.replace(/#\d+$/, '')), ['read', 'place', branch('placed'), 'route', 'fitFloors', 'grid', branch('grid'), 'shape', 'names', 'order', 'floorLabels', 'style']);
  }), { numRuns: RUNS });
});

test('the map flow\'s map equals buildIsoMap\'s for StoryDeck\'s maps too: obstacles, keep, icons, the usual grid (0.25.0)', async () => {
  let usual = 0;
  await fc.assert(fc.asyncProperty(deckMapArb, async (deckMap) => {
    if (!deckMap) return;
    let spec;
    try { spec = { ...deckMap.spec, keep: deckMap.spec.keep() }; buildIsoMap(spec, DECK); } catch { return; }   // the deck refuses it (deck-map-differential)
    const { map, snapshot } = await runMapFlow(spec, DECK);
    assert.deepStrictEqual(map, buildIsoMap(spec, DECK));
    for (const key of SUMMARISED) assert.equal(snapshot.sharedState[key].digest, paintSummary(map[key]).digest, key);
    if (map.grid === 'usual') {
      usual += 1;
      assert.deepEqual(snapshot.commitLog.map((c) => c.runtimeStageId.replace(/#\d+$/, '')).slice(5, 7), ['grid', 'usual']);
    }
  }), { numRuns: RUNS });
  assert.ok(usual > 0, 'some deck maps were drawn on the usual grid');
});

test('the grid\'s decision on the record says the usual grid honestly: the tool handed it in, nobody wrote it (0.25.0)', async () => {
  const control = controlDepRecorder();
  const spec = { ...SPEC, blocks: SPEC.blocks.map((b, i) => ({ ...b, at: [i * 3, 0] })), usualGrid: { tile: 120, origin: [960, 240] }, area: null };
  const { map, snapshot } = await runMapFlow(spec, DECK, { recorders: [control] });
  assert.deepEqual([map.grid, map.gridWhy], ['usual', 'no grid is written and the map placed its blocks: it is the usual grid the tool handed in']);
  assert.deepEqual(controlEdges(snapshot.commitLog, control)['usual#6'], { deciderId: 'grid#5', label: map.gridWhy });
});

test('the record keeps what each stage read when it wrote, and each decider\'s choice with its reason', async () => {
  const { map, snapshot } = await runMapFlow(SPEC, FILM);
  const rows = Object.fromEntries(snapshot.commitLog.map((c) => [c.runtimeStageId, Object.fromEntries(c.trace.map((r) => [r.path, r.readKeys]))]));
  assert.deepEqual(rows['place#1'], { placed: ['blocks'], placedWhy: ['blocks'] });
  assert.deepEqual(rows['build#2'], { at: ['who', 'blocks', 'wires'] });
  assert.deepEqual(rows['grid#5'], { grid: ['written', 'placed', 'usualGrid', 'blocks'], gridWhy: ['written', 'placed', 'usualGrid', 'blocks'] });
  // what each stage read is what its step says it reads (the decider and the branch apart), in the steps' own words
  for (const step of ISO_MAP_STEPS.filter((s) => !s.decides)) {
    const [id] = Object.keys(rows).filter((k) => k.startsWith(`${step.name}#`));
    for (const key of step.writes) assert.deepEqual(rows[id][key], [...step.reads], `${step.name} wrote ${key}`);
  }
  assert.equal(snapshot.sharedState.placedWhy, map.placedWhy);
  assert.equal(map.placedWhy, 'no block has an at: the build places them from their wires, across the frame');
});

test('why a block stands where it stands, from the record file alone (footprint-story/record)', async (t) => {
  const file = path.join(temp(t), 'map.record.jsonl'), sink = fileSink(file), control = controlDepRecorder();
  let run;
  try { run = await runMapFlow(SPEC, FILM, { sink, recorders: [control] }); } finally { await sink.close(); }
  const edges = controlEdges(run.snapshot.commitLog, control);
  assert.deepEqual(edges['build#2'], { deciderId: 'place#1', label: run.map.placedWhy });
  assert.deepEqual(edges['fitted#6'], { deciderId: 'grid#5', label: run.map.gridWhy });
  const why = (await whyFromRecord({ file, control: edges, key: 'at', run: 'the map' })).split('\n');
  assert.deepEqual(why.slice(0, 2), [`at = ${JSON.stringify(run.map.at)}`, 'place: build (build#2) [wrote: at]']);
  assert.ok(why.includes('  read (read#0) ← via who [wrote: who, blocks, floors, wires, obstacles, keep, written, usualGrid, area, style, policy]'), why.join('\n'));
  assert.ok(why.includes(`  place (place#1) ← [control: ${run.map.placedWhy}] [wrote: placed, placedWhy]`), why.join('\n'));
  // the grid walks back through what it was fitted round: the blocks' places, the routes, the floors
  const grid = await whyFromRecord({ file, control: edges, key: 'view', all: true });
  for (const line of ['grid: fitted (fitted#6) [wrote: view]', 'place: build (build#2) ← via at', 'route (route#3) ← via routes', 'fitFloors (fitFloors#4) ← via floorTiles', `grid (grid#5) ← [control: ${run.map.gridWhy}]`]) assert.match(grid, new RegExp(line.replace(/[()[\]]/g, '\\$&')));
});

test('a map placed by hand, on a written grid: the other branches', async () => {
  const spec = { ...SPEC, blocks: SPEC.blocks.map((b, i) => ({ ...b, at: [i * 3, 0] })), grid: { tile: 100, origin: [800, 100] }, area: null };
  const { map, snapshot } = await runMapFlow(spec, FILM);
  assert.deepEqual([map.placed, map.grid], ['hand', 'written']);
  assert.deepEqual(snapshot.commitLog.map((c) => c.runtimeStageId).slice(0, 7), ['read#0', 'place#1', 'hand#2', 'route#3', 'fitFloors#4', 'grid#5', 'written#6']);
  assert.deepStrictEqual(map, buildIsoMap(spec, FILM));
});

test('the chart runs on its own with the input {mapSpec, mapPolicy}; a refusal rejects the run with buildIsoMap\'s words', async () => {
  const executor = new FlowChartExecutor(mapFlow());
  await executor.run({ input: { mapSpec: SPEC, mapPolicy: FILM } });
  assert.deepEqual(executor.getSnapshot().sharedState.order, buildIsoMap(SPEC, FILM).order);
  const bad = { ...SPEC, blocks: [{ name: 'web', size: [2, 2], who: 'blocks[0] ("web")' }] };
  let words;
  try { buildIsoMap(bad, FILM); } catch (e) { words = e.message; }
  await assert.rejects(runMapFlow(bad, FILM), { message: words });
  await assert.rejects(runMapFlow(SPEC, { ...FILM, hold: 'all' }), /the map policy's hold is "groups" or "groups-and-labels"/);
  await assert.rejects(new FlowChartExecutor(mapFlow()).run(), /a map is \{blocks, floors, wires, obstacles, keep, grid, usualGrid, area, style, who\}/);
});

test('runMapFlow\'s options are checked', async () => {
  await assert.rejects(runMapFlow(SPEC, FILM, 'fast'), /runMapFlow's options are \{choices, sink, recorders\}, or none — not string/);
  await assert.rejects(runMapFlow(SPEC, FILM, { speed: 1 }), /runMapFlow's options are choices, sink, recorders — not "speed"/);
  await assert.rejects(runMapFlow(SPEC, FILM, { recorders: {} }), /runMapFlow's recorders are a list of combined recorders/);
  assert.equal((await runMapFlow(SPEC, FILM, null)).map.placed, 'build');
});

test('runMapFlow reads the spec itself first: a getter is refused in buildIsoMap\'s words and never runs (footprintjs would copy it)', async () => {
  let ran = 0;
  const spec = { blocks: [{ name: 'a', size: [1, 1, 1], get label() { ran += 1; return 'G'; } }], area: [0, 0, 1600, 900] };
  let words;
  try { buildIsoMap(spec, FILM); } catch (e) { words = e.message; }
  assert.match(words, /label is read as a stored value, and this one is a getter/);
  await assert.rejects(runMapFlow(spec, FILM), (e) => e.message === words);
  assert.equal(ran, 0);
});
