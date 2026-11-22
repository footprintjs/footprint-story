// A map flow's record keeps the paint lists as counts and a digest (src/mapflow/summary.js), never their points: the
// lists are derived from what the record already keeps (the spec, the policy, the choices' names). 0.33.0 kept them
// whole: a 64-block hatched world wrote 12,418,111 bytes of commit log, and the file sink refused the style stage's
// entry (over its 8 MB entry bound), so the record file held no style stage at all. Measured here (0.33.1): 90,778
// bytes of commit log for that world, 90,679 for the same world plain (0.33.0: 144,017). The bounds below are those
// numbers with room; the map the caller gets is still the whole of buildIsoMap's.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { FlowChartExecutor } from 'footprintjs';
import { fileSink } from 'footprintjs/sinks';
import { controlDepRecorder } from 'footprintjs/trace';
import { whyFromRecord, controlEdges } from '../record.js';
import { mapFlow, runMapFlow } from '../mapflow.js';
import { buildIsoMap, ISO_MAP_POLICIES, ISO_MAP_STEPS } from '../isometric.js';
import { sketchyLine, hatchTexture } from '../human.js';
import { SUMMARISED, paintSummary, paintDigest } from '../src/mapflow/summary.js';
import { fnv1a } from '../src/seed/seeded.js';

const FILM = ISO_MAP_POLICIES.film;
const CHOICES = Object.freeze([sketchyLine, hatchTexture]);
/** The most bytes a 64-block world's commit log (and its record file) may take, hatched or plain. */
const MOST_RECORD_BYTES = 300_000;
/** A plain world's record never grows past 0.33.0's (144,017 bytes, the paint lists whole). */
const MOST_PLAIN_BYTES = 144_017;
const blocks = Array.from({ length: 64 }, (_, i) => ({ name: `b${i}`, at: [(i % 8) * 3, Math.floor(i / 8) * 3], size: [2, 2, 1 + (i % 3)], kind: i % 5 ? 'block' : 'cylinder', label: `B${i}` }));
const wires = blocks.slice(1).map((b, i) => ({ from: { block: blocks[i].name }, to: { block: b.name } })).filter((_, i) => i % 4 === 0);
const WORLD = (style) => Object.freeze({ blocks, wires, floors: [{ label: 'World' }], area: [0, 0, 1920, 1080], style });
const HATCHED = WORLD({ line: 'human:sketchy', texture: 'human:hatch' });
const temp = (t) => { const dir = mkdtempSync(path.join(tmpdir(), 'story-mapflow-size-')); t.after(() => rmSync(dir, { recursive: true, force: true })); return dir; };

/** The world run with a file sink: {map, snapshot, bytes: the commit log's JSON, fileBytes, file, control}. */
async function recorded(t, spec) {
  const file = path.join(temp(t), 'map.record.jsonl'), sink = fileSink(file), control = controlDepRecorder();
  let run;
  try { run = await runMapFlow(spec, FILM, { choices: CHOICES, sink, recorders: [control] }); } finally { await sink.close(); }
  return { ...run, bytes: JSON.stringify(run.snapshot.commitLog).length, fileBytes: statSync(file).size, file, control };
}

test('a 64-block hatched world: its record stays under 300 KB, every entry written, log --why paints answers, and the map is still buildIsoMap\'s whole', async (t) => {
  const { map, snapshot, bytes, fileBytes, file, control } = await recorded(t, HATCHED);
  assert.ok(bytes < MOST_RECORD_BYTES, `the commit log is ${bytes} bytes`);
  assert.ok(fileBytes < MOST_RECORD_BYTES, `the record file is ${fileBytes} bytes`);
  assert.equal(snapshot.sink.failed, 0, `the sink wrote every entry: ${snapshot.sink.lastError}`);
  assert.deepStrictEqual(map, buildIsoMap(HATCHED, FILM, { choices: CHOICES }));
  // the record keeps the lists' counts and digest, and they are the map's
  for (const key of SUMMARISED) assert.deepStrictEqual(snapshot.sharedState[key], paintSummary(map[key]), key);
  const { paints } = snapshot.sharedState;
  assert.equal(paints.pieces, 64);
  assert.equal(paints.items, map.paints.flat().length);
  assert.equal(paints.byItem.stroke, map.paints.flat().filter((it) => it.item === 'stroke').length);
  assert.ok(paints.byItem.stroke > 1000 && paints.points > 100_000, `strokes ${paints.byItem.stroke}, points ${paints.points}: the summary counts what it leaves out`);
  assert.deepEqual(paints.perPiece, map.paints.map((l) => l.length));
  assert.match(paints.digest, /^fnv1a32:[0-9a-f]{8}$/);
  // log --why paints answers from the record file: the summary, written by the style stage, which read the style
  const why = (await whyFromRecord({ file, control: controlEdges(snapshot.commitLog, control), key: 'paints' })).split('\n');
  assert.equal(why[0], `paints = ${JSON.stringify(paintSummary(map.paints))}`);
  assert.match(why[1], /^style \(style#\d+\) \[wrote: paints, floorPaints\]$/);
  const style = snapshot.commitLog.find((c) => c.runtimeStageId.startsWith('style#'));
  assert.ok(style.trace.find((r) => r.path === 'paints').readKeys.includes('style'));
});

test('a plain world\'s record does not grow: smaller than 0.33.0\'s, which kept the paint lists whole', async (t) => {
  const plain = WORLD(null), { map, bytes, fileBytes } = await recorded(t, plain);
  assert.ok(bytes < MOST_PLAIN_BYTES && fileBytes < MOST_PLAIN_BYTES + 2_000, `the commit log is ${bytes} bytes, the file ${fileBytes}`);
  assert.deepStrictEqual(map, buildIsoMap(plain, FILM));
});

test('a summarised key is the style step\'s, and no step reads one: a summary never feeds a step', () => {
  assert.deepEqual(ISO_MAP_STEPS.filter((s) => s.writes.some((k) => SUMMARISED.includes(k))).map((s) => s.name), ['style']);
  assert.deepEqual(ISO_MAP_STEPS.at(-1).writes, SUMMARISED);
  for (const step of ISO_MAP_STEPS) {
    const reads = [...step.reads, ...(step.decides?.reads ?? []), ...Object.values(step.branches ?? {}).flatMap((b) => b.reads)];
    assert.ok(!reads.some((k) => SUMMARISED.includes(k)), `${step.name} reads a summarised key`);
  }
});

test('the chart run by hand keeps the summary only; runMapFlow\'s map holds the lists', async () => {
  const spec = { blocks: blocks.slice(0, 2), floors: [{ label: 'World' }], area: [0, 0, 1600, 900] };
  const executor = new FlowChartExecutor(mapFlow());
  await executor.run({ input: { mapSpec: spec, mapPolicy: FILM } });
  const built = buildIsoMap(spec, FILM), state = executor.getSnapshot().sharedState;
  assert.deepStrictEqual(state.paints, paintSummary(built.paints));
  assert.deepStrictEqual(state.floorPaints, paintSummary(built.floorPaints));
  assert.deepStrictEqual((await runMapFlow(spec, FILM)).map.paints, built.paints);
});

test('the digest is FNV-1a over canonical JSON: keys sorted, undefined members left out, fed in pieces', () => {
  assert.equal(fnv1a(''), 0x811c9dc5);
  assert.equal(fnv1a('b', fnv1a('a')), fnv1a('ab'));
  const text = JSON.stringify([{ a: 1, b: [2, 'x', null, true] }]);
  assert.equal(paintDigest([{ b: [2, 'x', null, true], a: 1, c: undefined }]), `fnv1a32:${fnv1a(text).toString(16).padStart(8, '0')}`);
  assert.equal(paintDigest([undefined]), paintDigest([null]));
  assert.notEqual(paintDigest([[1, 2]]), paintDigest([[2, 1]]));
  const floors = buildIsoMap(WORLD(null), FILM).floorPaints;
  assert.equal(paintDigest(structuredClone(floors)), paintSummary(floors).digest, 'a copy digests as its original');
  // what is not a list of lists is kept as it is
  assert.equal(paintSummary(null), null);
  assert.deepEqual(paintSummary([[{ item: 'stroke', points: [[0, 0, 1, 0]] }, { kind: 'x' }]]), { pieces: 1, items: 2, byItem: { stroke: 1, other: 1 }, points: 1, perPiece: [2], digest: paintDigest([[{ item: 'stroke', points: [[0, 0, 1, 0]] }, { kind: 'x' }]]) });
});
