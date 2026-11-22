// flow — the intent decider's steps as a footprintjs chart, and a run of it.
//
//   const chart = humanFlow({ models, critics })            → read → choose? (ours | own: plan) → wrap → sample → check → findings
//   const { result, snapshot } = await runHumanFlow(intents, { sink, recorders: [controlDepRecorder()] })
//
// WHY a chart of the same functions: a run's record is its debug log. Each stage runs one step of
// footprint-story/human · HUMAN_STEPS — the very function planIntents runs — handed the keys it names (each read through
// the scope, so the record keeps what the stage read when it wrote) and writing back the keys it names. `choose` is a
// decider: it writes each intent's choice and the list's reason (`choices`, `chose`, `choseWhy`) and goes to the branch
// it chose, so `whyFromRecord` walks through the decision to what it read (src/record/README.md · What the run must
// keep). The result a run gives equals planIntents' for the same intents (a property test).
//
// A tool's own models and critics are code, so they are never the run's state: the chart is built with them
// (`humanFlow({models, critics})`), its stages hand them to each step, and the record names the model each move used.
// The intents and the frame come in as the run's input ({humanIntents, humanFrame}: the input's keys are read-only in a
// run, so they are named apart from the state's): a refusal rejects the run with planIntents' words.
import { flowChart, FlowChartExecutor, decide } from 'footprintjs';
import { HUMAN_STEPS, pick, readSettings } from '../human/intents/steps.js';
import { keysOut, perIntentKeys } from '../human/intents/keys.js';
import { readGiven } from '../human/intents/read.js';

/** The chart's logger: a refusal is rethrown to the caller, so footprintjs does not print it a second time. */
const QUIET = Object.freeze({ info() {}, log() {}, debug() {}, error() {}, warn: (...args) => console.warn(...args) });
/** Every list key the result holds: what each step writes (the per-intent keys are found in the state: keys.js). */
const RESULT_KEYS = Object.freeze([...new Set(HUMAN_STEPS.flatMap((s) => s.writes))]);
const RUN_KEYS = Object.freeze(['models', 'critics', 'frame', 'sink', 'recorders']);

/** The keys a part reads, each through the scope (`$getValue`: a tracked read, so the record keeps it). */
const take = (s, keys) => Object.fromEntries(keys.map((k) => [k, s.$getValue(k)]));
/** The keys a part writes — its list keys and its per-intent keys (keys.js) — from the state it gave back. */
const put = (s, state, part) => { for (const k of keysOut(part, state)) s.$setValue(k, state[k]); };
const stageOf = (part, tools) => (s) => { put(s, part.run(take(s, part.reads), tools), part); };

/** A value frozen all the way down (plain data, no cycles). */
function deepFreeze(v) {
  if (v && typeof v === 'object') { Object.freeze(v); for (const k of Object.keys(v)) deepFreeze(v[k]); }
  return v;
}

/**
 * The chart: a stage that reads the input, then one stage per step (`choose` a decider, its branches the plan).
 * `settings.models` and `settings.critics`: a tool's own, as planIntents takes them (read now, by own stored fields).
 */
export function humanFlow(settings = undefined) {
  const { tools, frame } = readSettings(settings, 'humanFlow');
  if (frame !== undefined) throw new TypeError('humanFlow takes models and critics; the frame is the run\'s input ({humanIntents, humanFrame})');
  const [read, ...steps] = HUMAN_STEPS;
  let chart = flowChart(read.name, (s) => {
    const { humanIntents, humanFrame } = s.$getArgs() ?? {};
    put(s, read.run({ intents: humanIntents, frame: humanFrame }), read);
  }, read.name, read.about);
  for (const step of steps) {
    if (!step.decides) { chart = chart.addFunction(step.name, stageOf(step, tools), step.name, step.about); continue; }
    const { decides } = step;
    let list = chart.addDeciderFunction(step.name, (s) => {
      const chosen = decides.run(take(s, decides.reads), tools);
      put(s, chosen, decides);   // the choice and its reason: a stage's reads are kept with what it writes
      // handed to footprintjs as a decision whose label is the reason, so the run's control edge carries the words; the
      // rule reads back the choice just written
      const choice = chosen[decides.key], label = chosen[decides.why];
      return decide(s, [{ when: { [decides.key]: { eq: choice } }, then: choice, label }], { branch: choice, label });
    }, step.name, step.about);
    for (const [choice, branch] of Object.entries(step.branches)) list = list.addFunctionBranch(choice, `${branch.name}: ${choice}`, stageOf(branch, tools));
    chart = list.end();
  }
  return chart.setLogger(QUIET).build();
}

/**
 * The intent decider run: `intents` as planIntents takes them; `options.models`, `.critics` and `.frame` as planIntents'
 * settings; `options.sink` a record sink (footprintjs/sinks · fileSink — the caller closes it), `options.recorders`
 * combined recorders to attach (footprintjs/trace · controlDepRecorder). Run with `writeProvenance: 'reads-prefix'`, so
 * the record keeps the keys each stage had read when it wrote. Gives {result, snapshot}: the result (frozen plain data,
 * equal to planIntents') and the run's snapshot.
 */
export async function runHumanFlow(intents, options = undefined) {
  if (options !== undefined && options !== null && (typeof options !== 'object' || Array.isArray(options))) throw new TypeError(`runHumanFlow's options are {${RUN_KEYS.join(', ')}}, or none — not ${Array.isArray(options) ? 'a list' : typeof options}`);
  for (const k of Object.keys(options ?? {})) if (!RUN_KEYS.includes(k)) throw new TypeError(`runHumanFlow's options are ${RUN_KEYS.join(', ')} — not ${JSON.stringify(k)}`);
  const own = (k) => { const d = options ? Object.getOwnPropertyDescriptor(options, k) : undefined; if (d && !('value' in d)) throw new TypeError(`runHumanFlow's ${k} is read as a stored value, and this one is a getter (code, never run) — give the value itself`); return d?.value; };
  const sink = own('sink'), recorders = own('recorders') ?? [], frame = own('frame');
  if (!Array.isArray(recorders)) throw new TypeError('runHumanFlow\'s recorders are a list of combined recorders (controlDepRecorder(), …)');
  // read here first, by own stored fields, as planIntents reads them: footprintjs copies a run's input before any stage
  // sees it, and that copy would run a getter — so the run is handed the plain copy (and a refusal has planIntents' words)
  const settings = { models: own('models'), critics: own('critics') };
  const given = readGiven(intents, frame);
  const executor = new FlowChartExecutor(humanFlow(settings), { writeProvenance: 'reads-prefix', ...(sink ? { sink } : {}) });
  for (const r of recorders) executor.attachCombinedRecorder(r);
  await executor.run({ input: { humanIntents: given.copies, humanFrame: given.state.frame } });
  const snapshot = executor.getSnapshot();
  return { result: deepFreeze(structuredClone(pick(snapshot.sharedState, [...RESULT_KEYS, ...perIntentKeys(snapshot.sharedState)]))), snapshot };
}
