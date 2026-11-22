// footprint-story/humanflow: the intent decider's steps as a footprintjs chart. Its result equals planIntents' for
// random intent lists (the two compositions of HUMAN_STEPS cannot drift), its record holds a stage per step and the
// decider's reason, and footprint-story/record answers from it why a move took its model and its duration.
// FC_RUNS=20000 npm test runs a deep sweep.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import fc from 'fast-check';
import { FlowChartExecutor } from 'footprintjs';
import { fileSink, readRecordFile } from 'footprintjs/sinks';
import { controlDepRecorder } from 'footprintjs/trace';
import { whyFromRecord, controlEdges, WHY_LIMITS } from '../record.js';
import { humanFlow, runHumanFlow } from '../humanflow.js';
import { planIntents, HUMAN_STEPS, MOST_INTENTS } from '../human.js';

const RUNS = Math.ceil((Number(process.env.FC_RUNS) || 300) / 5);
const HAND = Object.freeze({ do: 'reach', name: 'hand', from: [200, 600], to: [500, 200] });
const temp = (t) => { const dir = mkdtempSync(path.join(tmpdir(), 'story-humanflow-')); t.after(() => rmSync(dir, { recursive: true, force: true })); return dir; };
/** A tool's own pen model, as a tool hands one in. */
const chalk = Object.freeze({ family: 'pen', name: 'reel:chalk', options: [], checks: ['arc'],
  plan: (intent) => ({ seconds: 0.4, from: intent.path[0], to: intent.path[intent.path.length - 1] }),
  sample: (plan, t) => { const u = Math.min(1, Math.max(0, t / plan.seconds)); return { x: plan.from[0] + (plan.to[0] - plan.from[0]) * u, y: plan.from[1] + (plan.to[1] - plan.from[1]) * u }; } });

// ---- random intents: every family, named and usual models, wraps, and some an author gets wrong ----------------------
const xy = fc.tuple(fc.integer({ min: 0, max: 1200 }), fc.integer({ min: 0, max: 800 }));
const named = fc.option(fc.constantFrom('hand', 'ball', 'pen', 'rope'), { nil: undefined });
const wrapArb = fc.option(fc.array(fc.oneof(
  fc.record({ wrapper: fc.constant('anticipate'), share: fc.double({ min: 0.05, max: 0.5, noNaN: true }) }),
  fc.record({ wrapper: fc.constant('follow-through') }),
  fc.record({ wrapper: fc.constant('overshoot'), by: fc.integer({ min: 0, max: 30 }) }),
  fc.record({ wrapper: fc.constant('hold'), at: fc.constant(0), seconds: fc.double({ min: 0.05, max: 0.5, noNaN: true }) }),
  fc.record({ wrapper: fc.constant('squash') })), { maxLength: 2 }), { nil: undefined });
const intentArb = fc.tuple(fc.oneof(
  fc.record({ do: fc.constant('reach'), from: xy, to: xy, target: fc.option(fc.integer({ min: 4, max: 120 }), { nil: undefined }), model: fc.option(fc.constantFrom('min-jerk', { name: 'min-jerk', bend: 0 }, 'spring'), { nil: undefined }) }, { requiredKeys: ['do', 'from', 'to'] }),
  fc.record({ do: fc.constant('throw'), from: xy, to: xy }),
  fc.record({ do: fc.constant('fall'), from: xy, floor: fc.constant(900) }),
  fc.record({ do: fc.constant('settle'), from: xy, to: xy }),
  fc.record({ do: fc.constant('draw'), path: fc.array(xy, { minLength: 2, maxLength: 4 }) }),
  fc.record({ do: fc.constant('write'), points: fc.array(xy, { minLength: 2, maxLength: 3 }) }),
  fc.record({ do: fc.constant('wave'), from: xy })), named, wrapArb).map(([intent, name, wrap]) => ({ ...intent, ...(name ? { name } : {}), ...(wrap ? { wrap } : {}) }));

/** planIntents' result, or its refusal's words. */
const planned = (intents, settings) => { try { return { result: planIntents(intents, settings) }; } catch (e) { return { words: e.message }; } };

test('the chart\'s result equals planIntents\' for random intent lists — or both refuse in the same words', async () => {
  let ok = 0;
  await fc.assert(fc.asyncProperty(fc.array(intentArb, { maxLength: 4 }), fc.boolean(), async (intents, frame) => {
    const settings = frame ? { frame: [1920, 1080] } : undefined, before = structuredClone(intents), sync = planned(intents, settings);
    if (sync.words) { await assert.rejects(runHumanFlow(intents, settings), (e) => e.message === sync.words); return; }
    const { result, snapshot } = await runHumanFlow(intents, settings);
    assert.deepStrictEqual(result, sync.result);
    assert.equal(JSON.stringify(intents), JSON.stringify(before), 'the intents are not edited');   // as text: fast-check makes some records with no prototype, which a copy gives one
    assert.ok(Object.isFrozen(result) && Object.isFrozen(result.choices));
    // a stage per step: read, the decider and the branch it chose, then each step
    assert.deepEqual(snapshot.commitLog.map((c) => c.runtimeStageId.replace(/#\d+$/, '')), ['read', 'choose', result.chose, 'wrap', 'sample', 'check', 'findings']);
    ok += 1;
  }), { numRuns: RUNS });
  assert.ok(ok > RUNS / 4, `most lists plan (${ok} of ${RUNS})`);
});

test('the record keeps what each stage read when it wrote, and the decider\'s choice with its reason', async () => {
  const { result, snapshot } = await runHumanFlow([HAND, { do: 'throw', who: 'ball', from: [0, 500], to: [600, 500] }]);
  const rows = Object.fromEntries(snapshot.commitLog.map((c) => [c.runtimeStageId, Object.fromEntries(c.trace.map((r) => [r.path, r.readKeys]))]));
  assert.deepEqual(rows['choose#1'], { choices: ['intents'], chose: ['intents'], choseWhy: ['intents'], 'model-0': ['intents'], 'model-1': ['intents'] });
  assert.deepEqual(rows['ours#2'], { plans: ['intents', 'choices', 'frame'] });
  for (const step of HUMAN_STEPS.slice(1).filter((s) => !s.decides)) {
    const [id] = Object.keys(rows).filter((k) => k.startsWith(`${step.name}#`));
    for (const key of step.writes) assert.deepEqual(rows[id][key], [...step.reads], `${step.name} wrote ${key}`);
    for (const what of step.each) for (const i of [0, 1]) assert.deepEqual(rows[id][`${what}-${i}`], [...step.reads], `${step.name} wrote ${what}-${i}`);
  }
  assert.equal(snapshot.sharedState.choseWhy, result.choseWhy);
});

test('why an intent\'s duration is what it is, and why its model was chosen — from the record file alone (footprint-story/record)', async (t) => {
  const file = path.join(temp(t), 'human.record.jsonl'), sink = fileSink(file), control = controlDepRecorder();
  let run;
  try { run = await runHumanFlow([HAND], { sink, recorders: [control] }); } finally { await sink.close(); }
  const edges = controlEdges(run.snapshot.commitLog, control);
  assert.deepEqual(edges, { 'ours#2': { deciderId: 'choose#1', label: run.result.choseWhy } });
  const duration = (await whyFromRecord({ file, control: edges, key: 'durations', all: true })).split('\n');
  // the value carries Fitts's numbers; the walk goes through the plan and the decision to the intents
  assert.match(duration[0], /^durations = \[\{"seconds":0\.85\d*,"model":"min-jerk","basis":\{"distance":500,"target":40,"targetDefaulted":true,"bits":3\.754\d*,/);
  assert.deepEqual(duration.slice(1, 4), ['wrap (wrap#3) [wrote: moves, durations, duration-0]', '  plan: ours (ours#2) ← via plans [wrote: plans]', '    read (read#0) ← via intents [wrote: intents, wraps, frame]']);
  assert.ok(duration.includes(`    choose (choose#1) ← via choices ← [control: ${run.result.choseWhy}] [wrote: choices, chose, choseWhy, model-0]`), duration.join('\n'));
  const chosen = (await whyFromRecord({ file, control: edges, key: 'choices' })).split('\n');
  assert.deepEqual(chosen.slice(0, 3), [`choices = ${JSON.stringify(run.result.choices)}`, 'choose (choose#1) [wrote: choices, chose, choseWhy, model-0]', '  read (read#0) ← via intents [wrote: intents, wraps, frame]']);
  assert.match(chosen[0], /"model":"min-jerk","by":"usual","rule":"the intent names none: its family's usual"/);
  // the findings walk back through the checks and the moves to the plan
  const found = await whyFromRecord({ file, control: edges, key: 'findings', all: true });
  for (const line of ['findings (findings#6) [wrote: findings, findings-0]', 'check (check#5) ← via checks', 'wrap (wrap#3) ← via moves']) assert.ok(found.includes(line), found);
});

test('one intent of fifty, asked by its own key: its duration and full basis, through the plan and the choice — never a cut list', async (t) => {
  const file = path.join(temp(t), 'fifty.record.jsonl'), sink = fileSink(file), control = controlDepRecorder();
  const long = (i) => `scene 3, beat ${i}: the presenter's left hand reaches across the table for the blue mug beside the laptop, slowly ${'and with care '.repeat(6)}`.trim();
  const intents = Array.from({ length: 50 }, (_, i) => ({ do: 'reach', who: long(i), from: [100 + i, 600], to: [500 + 3 * i, 200], target: 20 + i }));
  let run;
  try { run = await runHumanFlow(intents, { sink, recorders: [control] }); } finally { await sink.close(); }
  const edges = controlEdges(run.snapshot.commitLog, control), i = 37, basis = run.result.plans[i].plan.basis;
  const answer = (await whyFromRecord({ file, control: edges, key: `duration-${i}` })).split('\n');
  // the value whole, not cut: the seconds and every number of the basis, Fitts's distance, target and bits among them
  assert.equal(answer[0], `duration-${i} = ${JSON.stringify(run.result[`duration-${i}`])}`);
  assert.ok(!answer[0].endsWith('…'));
  const { seconds, ...rest } = basis;
  assert.deepEqual(JSON.parse(answer[0].slice(`duration-${i} = `.length)), { seconds, ...rest });
  assert.deepEqual([rest.distance, rest.target, rest.bits], [Math.hypot(400 + 2 * i, 400), 20 + i, Math.log2(Math.hypot(400 + 2 * i, 400) / (20 + i) + 1)]);
  assert.match(answer[1], /^wrap \(wrap#3\) \[wrote: moves, durations, duration-0, /);
  assert.equal(answer[2], '  plan: ours (ours#2) ← via plans [wrote: plans]');
  assert.ok(answer.some((l) => l.startsWith('    choose (choose#1) ← via choices ← [control: ')), answer.join('\n'));
  assert.ok(!answer.some((l) => /not whole/.test(l)), 'fifty intents\' keys stay within what the reader keeps of a step');
  // why its model: its own key, the rule's words whole
  assert.match(await whyFromRecord({ file, control: edges, key: `model-${i}` }), new RegExp(`^model-${i} = \\{"model":"min-jerk","family":"reach","by":"usual","rule":"the intent names none: its family's usual","own":false\\}\nchoose \\(choose#1\\)`));
  assert.match(await whyFromRecord({ file, control: edges, key: `findings-${i}`, all: true }), new RegExp(`^findings-${i} = \\[\\]\nfindings \\(findings#6\\)`));
});

test('one entry\'s duration comes back whole even when its basis is long: a hanging chain and a pen line (WHY_LIMITS.asked)', async (t) => {
  const file = path.join(temp(t), 'long.record.jsonl'), sink = fileSink(file), control = controlDepRecorder();
  const intents = [{ do: 'hang', who: 'the lamp\'s cord', from: [400, 100], length: 180 }, { do: 'draw', who: 'the underline', path: [[100, 300], [260, 340], [420, 300], [600, 330]] }];
  let run;
  try { run = await runHumanFlow(intents, { sink, recorders: [control] }); } finally { await sink.close(); }
  const edges = controlEdges(run.snapshot.commitLog, control);
  for (const [i, model] of [[0, 'verlet'], [1, 'power-law']]) {
    const value = JSON.stringify(run.result[`duration-${i}`]);
    assert.equal(run.result[`model-${i}`].model, model);
    assert.ok(value.length < WHY_LIMITS.asked && (model !== 'verlet' || value.length > WHY_LIMITS.value), `${model}'s duration is ${value.length} characters`);
    const [first, second] = (await whyFromRecord({ file, control: edges, key: `duration-${i}` })).split('\n');
    assert.equal(first, `duration-${i} = ${value}`);
    assert.match(second, /^wrap \(wrap#3\)/);
  }
});

test('the most intents a list holds keep a whole record: every step\'s keys read stay within the reader\'s bound', async (t) => {
  const file = path.join(temp(t), 'most.record.jsonl'), sink = fileSink(file);
  const intents = Array.from({ length: MOST_INTENTS }, (_, i) => ({ do: 'reach', who: `intents ${i}`, from: [0, 0], to: [100 + i, 0] }));
  let run;
  try { run = await runHumanFlow(intents, { sink }); } finally { await sink.close(); }
  for (const c of run.snapshot.commitLog) {
    assert.ok(c.trace.length <= WHY_LIMITS.rows, `${c.runtimeStageId}: ${c.trace.length} rows`);
    assert.ok(c.trace.reduce((n, r) => n + (r.readKeys?.length ?? 0), 0) <= WHY_LIMITS.reads, `${c.runtimeStageId}: keys read`);
  }
  assert.doesNotMatch(await whyFromRecord({ file, key: `duration-${MOST_INTENTS - 1}` }), /not whole/);
});

test('a tool\'s own model: the decider goes to "own", and the record\'s control edge says its code is outside the record', async (t) => {
  const file = path.join(temp(t), 'own.record.jsonl'), sink = fileSink(file), control = controlDepRecorder();
  const intents = [{ do: 'draw', who: 'chalk line', path: [[0, 0], [100, 50]], model: 'reel:chalk' }];
  let run;
  try { run = await runHumanFlow(intents, { models: [chalk], sink, recorders: [control] }); } finally { await sink.close(); }
  assert.deepStrictEqual(run.result, planIntents(intents, { models: [chalk] }));
  assert.equal(run.result.chose, 'own');
  const edges = controlEdges(run.snapshot.commitLog, control);
  assert.deepEqual(edges['own#2'], { deciderId: 'choose#1', label: "a tool's own model plans 1 of 1 moves, from code this record does not hold — chalk line: draw → reel:chalk (named)" });
  assert.match(await whyFromRecord({ file, control: edges, key: 'plans' }), /plan: own \(own#2\) \[wrote: plans\]/);
  // asked about the one intent, the answer says its model is a tool's own, whose code the record does not hold
  assert.match(await whyFromRecord({ file, control: edges, key: 'model-0' }), /^model-0 = \{"model":"reel:chalk","family":"pen","by":"named","rule":"the intent names its model","own":true\}\n/);
  // the findings name who and the fix
  assert.deepEqual(run.result.findings.map((f) => [f.who, f.critic, f.fix]), [['chalk line', 'arc', "bow it: model: {name: 'min-jerk', bend: 0.06}"]]);
});

test('the same intents give the same result and the same record entries, apart from the run\'s ids and clock', async (t) => {
  const dir = temp(t), intents = [HAND, { do: 'draw', name: 'pen', path: [[0, 0], [200, 80], [400, 0]], wrap: [{ wrapper: 'anticipate' }] }];
  const entries = async (name) => {
    const file = path.join(dir, name), sink = fileSink(file);
    let run;
    try { run = await runHumanFlow(intents, { sink }); } finally { await sink.close(); }
    const { entries: all } = await readRecordFile(file);
    // the run's id (a clock and a counter) and each entry's wall-clock time are the only things two runs may differ by
    return { result: run.result, entries: JSON.parse(JSON.stringify(all, (k, v) => (k === 'logRunId' || k === 'runId' || k === 'at' ? undefined : v))) };
  };
  const a = await entries('a.jsonl'), b = await entries('b.jsonl');
  assert.deepStrictEqual(a.result, b.result);
  assert.deepStrictEqual(a.entries, b.entries);
  assert.equal(a.entries.filter((e) => e.kind === 'commit').length, 7);
});

test('the chart runs on its own with the input {humanIntents, humanFrame}; a refusal rejects the run with planIntents\' words', async () => {
  const executor = new FlowChartExecutor(humanFlow());
  await executor.run({ input: { humanIntents: [HAND], humanFrame: [1920, 1080] } });
  assert.deepStrictEqual(executor.getSnapshot().sharedState.plans, planIntents([HAND], { frame: [1920, 1080] }).plans);
  for (const bad of [[{ ...HAND, do: 'wave' }], [{ ...HAND, wrap: [{ wrapper: 'squash' }] }], [{ ...HAND, model: 'ballistic' }], 'reach']) {
    const { words } = planned(bad);
    await assert.rejects(runHumanFlow(bad), (e) => e.message === words);
  }
  await assert.rejects(new FlowChartExecutor(humanFlow()).run(), /planIntents takes a list of intents/);
  await assert.rejects(runHumanFlow([HAND], { models: 'chalk' }), /models are a list of at most 64/);
  assert.throws(() => humanFlow({ frame: [1, 1] }), /humanFlow takes models and critics; the frame is the run's input/);
  assert.throws(() => humanFlow('x'), /humanFlow's settings are \{models, critics, frame\}, or none/);
});

test('runHumanFlow\'s options are checked, each read by its own stored field', async () => {
  await assert.rejects(runHumanFlow([HAND], 'fast'), /runHumanFlow's options are \{models, critics, frame, sink, recorders\}, or none — not string/);
  await assert.rejects(runHumanFlow([HAND], [1]), /or none — not a list/);
  await assert.rejects(runHumanFlow([HAND], { speed: 1 }), /runHumanFlow's options are models, critics, frame, sink, recorders — not "speed"/);
  await assert.rejects(runHumanFlow([HAND], { recorders: {} }), /runHumanFlow's recorders are a list of combined recorders/);
  let ran = 0;
  await assert.rejects(runHumanFlow([HAND], { get sink() { ran += 1; return undefined; } }), /runHumanFlow's sink is read as a stored value, and this one is a getter/);
  assert.equal((await runHumanFlow([HAND], null)).result.chose, 'ours');
  assert.equal(ran, 0);
});

test('runHumanFlow reads the intents itself first: a getter is refused in planIntents\' words and never runs (footprintjs would copy it)', async () => {
  let ran = 0;
  const intents = [{ ...HAND, get name() { ran += 1; return 'hand'; } }];
  const { words } = planned(intents);
  assert.match(words, /intents\[0\] gives a getter at its top\.name \(code, never run\)/);
  await assert.rejects(runHumanFlow(intents), (e) => e.message === words);
  const list = [HAND];
  Object.defineProperty(list, 0, { get() { ran += 1; return HAND; } });
  await assert.rejects(runHumanFlow(list), /intents\[0\] is read as a stored value, and this one is a getter/);
  // the frame too: footprintjs would copy it
  const frame = [1920, 0];
  Object.defineProperty(frame, 1, { get() { ran += 1; return 1080; } });
  await assert.rejects(runHumanFlow([HAND], { frame }), /planIntents' frame \(its width and height\) is a point/);
  assert.equal(ran, 0);
});
