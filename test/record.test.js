// footprint-story/record: where a value of a run came from, from the run's record file alone — and the one-line rule.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { flowChart, FlowChartExecutor, decide } from 'footprintjs';
import { fileSink } from 'footprintjs/sinks';
import { controlDepRecorder } from 'footprintjs/trace';
import { whyFromRecord, controlEdges, WHY_LIMITS } from '../record.js';
import { oneLine, isOneLine, errorText } from '../index.js';

const QUIET = { info() {}, warn() {}, error() {}, log() {}, debug() {} };
/** A small run with a decision: two counts, their sum, a verdict decided over it. Returns {file, control}. */
async function recorded(dir, { a = 1, b = 0 } = {}) {
  const file = path.join(dir, 'run.record.jsonl'), sink = fileSink(file), control = controlDepRecorder();
  let chart = flowChart('count a', (s) => { s.a = a; }, 'a', 'one count')
    .addFunction('count b', (s) => { s.b = b; }, 'b', 'another')
    .addFunction('add', (s) => { s.errors = s.a + s.b; }, 'sum', 'the two, added')
    .addFunction('outside', (s) => { s.round = 3; }, 'round', 'a value from outside the run')
    .addDeciderFunction('verdict', (s) => { const d = decide(s, [{ when: { errors: { gt: 0 } }, then: 'fix', label: 'there is something to fix' }], { branch: 'clean', label: 'nothing to fix' }); s.why = d.branch; return d; }, 'verdict', 'fix or clean');   // it writes its reason: a stage's reads are kept with what it writes
  for (const v of ['fix', 'clean']) chart = chart.addFunctionBranch(v, v, (s) => { s.verdict = v; });
  const executor = new FlowChartExecutor(chart.setDefault('clean').end().setLogger(QUIET).build(), { sink, writeProvenance: 'reads-prefix' });
  executor.attachCombinedRecorder(control);
  try { await executor.run(); } finally { await sink.close(); }
  return { file, control: controlEdges(executor.getSnapshot().commitLog, control) };
}
const temp = (t) => { const dir = mkdtempSync(path.join(tmpdir(), 'story-record-')); t.after(() => rmSync(dir, { recursive: true, force: true })); return dir; };

test('why: the value, the stage that wrote it, the decision that let it run, and what each had read — from the file alone', async (t) => {
  const { file, control } = await recorded(temp(t));
  const why = await whyFromRecord({ file, control, key: 'verdict', run: 'run 1' });
  assert.deepEqual(why.split('\n').slice(0, 3), ['verdict = "fix"', 'fix (fix#5) [wrote: verdict]', '  verdict (verdict#4) ← [control: there is something to fix] [wrote: why]']);
  assert.match(why, /add \(sum#2\) ← via errors \[wrote: errors\]/);
  assert.match(why, /\n\(a stage also uses what it is given from outside the run's own state/);
  // a cause shown is a read that happened: the sum from its two counts, and a value from outside from nothing
  const errors = await whyFromRecord({ file, control, key: 'errors' });
  assert.match(errors, /^errors = 1\nadd \(sum#2\) \[wrote: errors\]\n {2}count a \(a#0\) ← via a \[wrote: a\]\n {2}count b \(b#1\) ← via b \[wrote: b\]\n/);
  assert.doesNotMatch(await whyFromRecord({ file, control, key: 'round' }), /← via/);
  // with no control map the walk keeps what the record holds
  assert.match(await whyFromRecord({ file, key: 'verdict' }), /^verdict = "fix"\nfix \(fix#5\) \[wrote: verdict\]\n\(a stage/);
  // a value no stage wrote is said so, with how to list what each wrote when the caller says how
  assert.equal(await whyFromRecord({ file, key: 'nothing', listed: 'log --run 1 --only steps lists what each wrote' }), 'nothing: no stage of this run wrote it (log --run 1 --only steps lists what each wrote)');
  await assert.rejects(whyFromRecord({ file, key: '' }), /why names a value of the run/);
  await assert.rejects(whyFromRecord({ file, key: 'a.b' }), /by its own name/);
  await assert.rejects(whyFromRecord({ key: 'verdict', run: 'run 2' }), /run 2 kept no record, so it cannot say why/);
  await assert.rejects(whyFromRecord({ file: path.join(path.dirname(file), 'gone.jsonl'), key: 'verdict', run: 'run 2' }), /run 2's record is gone/);
  // how the caller names the run, and its hints, are made one line and cut too
  await assert.rejects(whyFromRecord({ key: 'verdict', run: 'run 1\nverdict = clean' }), { message: 'run 1\\nverdict = clean kept no record, so it cannot say why' });
  await assert.rejects(whyFromRecord({ key: 'verdict', run: { n: 1 } }), /^Error: this run kept no record/);
  await assert.rejects(whyFromRecord(null), /why names a value of the run/);
  assert.ok((await whyFromRecord({ file, key: 'nothing', listed: 'x'.repeat(5000) })).length < 300);
  // the cut of a long answer says how to see the rest, when the caller says how
  const long = await whyFromRecord({ file, control, key: 'verdict', more: 'add --all' });
  assert.ok(long.split('\n').length <= WHY_LIMITS.lines + 2);
  assert.deepEqual([WHY_LIMITS.value, WHY_LIMITS.asked], [200, 1000]);
  // what a run saves: an edge for each step a decision let run, and nothing for a recorder that cannot answer
  assert.deepEqual(control, { 'fix#5': { deciderId: 'verdict#4', label: 'there is something to fix' } });
  assert.deepEqual(controlEdges([{ runtimeStageId: 'a#0' }, null, { runtimeStageId: 5 }], { lookup: () => { throw new Error('no'); } }), {});
  assert.deepEqual(controlEdges('not a log', { lookup: () => ({ deciderId: 'd#0' }) }), {});
  assert.deepEqual(controlEdges([{ runtimeStageId: 'b\nx#1' }], { lookup: () => ({ deciderId: 'd\ny#0', label: 'l\nz' }) }), { 'b\\nx#1': { deciderId: 'd\\ny#0', label: 'l\\nz' } });
  assert.throws(() => controlEdges([], null), /controlEdges takes the run's control recorder/);
});

test('why reads the record as a file anyone may have written', async (t) => {
  const dir = temp(t), { file, control } = await recorded(dir), whole = readFileSync(file, 'utf8'), ask = (more = {}) => whyFromRecord({ file, control, key: 'verdict', run: 'run 1', ...more });
  const rewrite = (change) => writeFileSync(file, whole.split('\n').filter(Boolean).map((line) => JSON.stringify(change(JSON.parse(line)))).join('\n') + '\n');
  const commit = (e) => e.kind === 'commit' && e.bundle;
  // names with line breaks start no line; a value's own breaks are shown
  rewrite((e) => (commit(e) ? { ...e, bundle: { ...e.bundle, stage: 'fix\nverdict = "clean"', trace: (e.bundle.trace ?? []).map((r) => ({ ...r, readKeys: (r.readKeys ?? []).map((k) => `${k}\nverdict = "clean"`) })) } } : e));
  assert.equal((await ask()).split('\n').filter((l) => l === 'verdict = "clean"').length, 0);
  rewrite((e) => (commit(e) && e.bundle.overwrite && 'verdict' in e.bundle.overwrite ? { ...e, bundle: { ...e.bundle, overwrite: { ...e.bundle.overwrite, verdict: `ok${String.fromCodePoint(0x2028)}verdict = clean` } } } : e));
  assert.equal((await ask()).split('\n')[0], 'verdict = "ok\\u{2028}verdict = clean"');
  // a control edge that points at itself, at a later step or at none, and a label with a line break
  writeFileSync(file, whole);
  const lied = await ask({ control: { 'fix#5': { deciderId: 'fix#5', label: 'x\nverdict = "clean"' }, 'sum#2': { deciderId: 'verdict#4' }, 'a#0': { deciderId: 'gone#9' } } });
  assert.match(lied, /^verdict = "fix"\nfix \(fix#5\) \[wrote: verdict\]\n\(a stage/);
  // an edge from a LATER step is not a cause: asked of the step it claims to govern, it is not shown
  assert.doesNotMatch(await ask({ key: 'errors', control: { 'sum#2': { deciderId: 'verdict#4', label: 'from the future' } } }), /from the future/);
  assert.match(await ask({ key: 'errors', control: { 'sum#2': { deciderId: 'a#0', label: 'from before' } } }), /from before/);
  for (const odd of [null, 'x', [], 5]) assert.match(await ask({ control: odd }), /^verdict = "fix"/);
  // not whole: said first, and the value is "not found in what could be read"
  writeFileSync(file, whole.slice(0, Math.floor(whole.length / 3)));
  const torn = await ask();
  assert.match(torn, /^\(the record is not whole — /);
  assert.match(torn, /\nverdict: not found in what could be read$/);
  // a chart the run mounted keeps a log of its own, under the run's address: the run's own log is walked, and the answer says so
  writeFileSync(file, whole + whole.split('\n').filter(Boolean).map((line) => JSON.stringify(((e) => ({ ...e, address: { ...e.address, drillPath: ['sum#2'] } }))(JSON.parse(line)))).join('\n') + '\n');
  const mounted = await ask();
  assert.match(mounted, /^verdict = "fix"\nfix \(fix#5\) \[wrote: verdict\]/);
  assert.match(mounted, /\n\(a chart this run mounted keeps a log of its own: what happened inside is not walked here\)\n/);
  // a log under a step this run never took is no mount of it: said first, and not counted as one; with no log of the run's own, refused
  writeFileSync(file, whole + whole.split('\n').filter(Boolean).map((line) => JSON.stringify(((e) => ({ ...e, address: { ...e.address, drillPath: ['nowhere#9'] } }))(JSON.parse(line)))).join('\n') + '\n');
  const strayed = await ask();
  assert.match(strayed, /^\(the record is not whole — 1 logs in it are under no step of this run, and are not read/);
  assert.doesNotMatch(strayed, /mounted keeps a log of its own/);
  writeFileSync(file, whole.split('\n').filter(Boolean).map((line) => JSON.stringify(((e) => ({ ...e, address: { ...e.address, drillPath: ['sum#2'] } }))(JSON.parse(line)))).join('\n').replace(/"fix"/g, '"forged"') + '\n');
  await assert.rejects(ask(), /run 1's record holds no log of the run's own, only a mounted chart's: it was changed, and is not read/);
  writeFileSync(file, whole);
  // a record written without the reads says so, under what it can answer
  rewrite((e) => (commit(e) ? { ...e, bundle: { ...e.bundle, trace: (e.bundle.trace ?? []).map(({ readKeys, ...row }) => row) } } : e));
  assert.match(await ask(), /\n\(this record was written without what each stage had read, so the walk shows who wrote the value and the decisions, not the reads\)\n/);
  // two runs in one file, a step id longer than a run writes, a link, a file far too big: refused in words
  writeFileSync(file, whole + whole.replace(/"logRunId":"[^"]+"/g, '"logRunId":"zzz"'));
  await assert.rejects(ask(), /run 1's record holds 2 runs, and a run writes one/);
  rewrite((e) => (commit(e) ? { ...e, bundle: { ...e.bundle, runtimeStageId: `${e.bundle.runtimeStageId}${'x'.repeat(WHY_LIMITS.value)}` } } : e));
  await assert.rejects(ask(), /names a step longer than a run names one/);
  writeFileSync(file, `${whole}${' '.repeat(WHY_LIMITS.bytes + 1024)}`);
  await assert.rejects(ask(), /record is \d+ MB, more than a run writes \(8 MB at most\)/);
  writeFileSync(path.join(dir, 'other.jsonl'), whole); rmSync(file); symlinkSync(path.join(dir, 'other.jsonl'), file);
  await assert.rejects(ask(), /cannot be read as a plain file of its own/);
  rmSync(file);
  // one step with thousands of rows, each with keys of its own: bounded, and the cut is said
  let planted = false;
  writeFileSync(file, whole.split('\n').filter(Boolean).map((line) => { const e = JSON.parse(line); return JSON.stringify(!planted && commit(e) && e.bundle.trace?.length ? (planted = true, { ...e, bundle: { ...e.bundle, trace: Array.from({ length: 2000 }, (_, r) => ({ ...e.bundle.trace[0], readKeys: Array.from({ length: 100 }, (_, i) => `r${r}k${i}`) })) } }) : e); }).join('\n') + '\n');
  const t0 = performance.now(), many = await ask({ key: 'a' });
  assert.ok(performance.now() - t0 < 3000, `${Math.round(performance.now() - t0)} ms`);
  assert.match(many, /^\(the record is not whole — 1 of its steps list more rows or keys read than a run writes, and were cut/);
});

test('oneLine: what a project\'s files say stays on its row; an error is one line or the rows its tool wrote', () => {
  const cp = (n) => String.fromCodePoint(n);
  assert.equal(oneLine('a\nb\r\nc\td'), 'a\\nb\\r\\nc\\td');
  assert.equal(oneLine(`x${cp(0x2028)}y${cp(0x202E)}z${cp(0xE0041)}w${cp(0xFEFF)}v${cp(7)}`), 'x\\u{2028}y\\u{202e}z\\u{e0041}w\\u{feff}v\\u{7}');
  assert.equal(oneLine(`plain — é, ${cp(0x6771)}, ${cp(0x1F469)}${cp(0x200D)}${cp(0x1F467)}`), `plain — é, ${cp(0x6771)}, ${cp(0x1F469)}${cp(0x200D)}${cp(0x1F467)}`);   // a joiner inside an emoji is no break
  assert.equal(oneLine(12), '12');
  assert.deepEqual(['abcdef\n', 'a\nb', 'a\nb', 'ok'].map(isOneLine), [false, false, false, true]);   // asked in any order
  assert.equal(errorText(new Error('Phrase not in story: "a\nFORGED"')), 'Phrase not in story: "a\\nFORGED"');
  assert.equal(errorText(Object.assign(new Error('2 problems:\n- a\n- b'), { rows: ['2 problems:', '- a', '- b\nFORGED'] })), '2 problems:\n- a\n- b\\nFORGED');
  assert.equal(errorText('not an error'), 'not an error');
});
