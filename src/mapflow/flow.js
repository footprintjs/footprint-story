// flow — the map's steps as a footprintjs chart, and a run of it.
//
//   const chart = mapFlow({ choices })                              → read → place? (hand | build) → route → fitFloors → grid? (written | fitted | usual) → shape → names → order → floorLabels → style
//   const { map, snapshot } = await runMapFlow(spec, ISO_MAP_POLICIES.film, { choices, sink, recorders: [controlDepRecorder()] })
//
// WHY a chart of the same functions: a run's record is its debug log. Each stage runs one step of
// footprint-story/isometric · ISO_MAP_STEPS — the very function buildIsoMap runs — handed the keys it names (each read
// through the scope, so the record keeps what the stage read when it wrote) and writing back the keys it names. A step
// that chooses is a decider: it writes its choice and its reason (`placed`/`placedWhy`, `grid`/`gridWhy`) and goes to
// the branch it chose, so `whyFromRecord` walks through the decision to what it read (src/record/README.md · What the
// run must keep). The map a run makes equals buildIsoMap's for the same spec and policy (a property test).
//
// The chart reads the spec and the policy from the run's input ({mapSpec, mapPolicy}: `readIsoMap` checks them, as
// buildIsoMap does; the input's keys are read-only in a run, so they are named apart from the state's): a refusal rejects the run with the same words buildIsoMap throws.
//
// A tool's own style choices (`choices`: footprint-story/human's sketchyLine and hatchTexture, a tool's `reel:chalk`) are
// code, so never the run's input or state: the chart is built with them (`mapFlow({choices})`), its stages hand them to
// each step as buildIsoMap does, and the record keeps the names the map's style chose (`style.row`) — the humanflow way.
import { flowChart, FlowChartExecutor, decide } from 'footprintjs';
import { ISO_MAP_STEPS, ISO_MAP_INPUT, pick, deepFreeze } from '../isometric/mapSteps.js';
import { readIsoMap, readIsoMapSettings } from '../isometric/mapSpec.js';

/** The chart's logger: a refusal is rethrown to the caller, so footprintjs does not print it a second time. */
const QUIET = Object.freeze({ info() {}, log() {}, debug() {}, error() {}, warn: (...args) => console.warn(...args) });
/** Every key a built map holds: the input, then what each step writes. */
const MAP_KEYS = Object.freeze([...ISO_MAP_INPUT, ...ISO_MAP_STEPS.flatMap((s) => s.writes)]);
const RUN_KEYS = ['choices', 'sink', 'recorders'];

/** The keys a part reads, each through the scope (`$getValue`: a tracked read, so the record keeps it). */
const take = (s, keys) => Object.fromEntries(keys.map((k) => [k, s.$getValue(k)]));
/** The keys a part writes, from the state it gave back. */
const put = (s, state, keys) => { for (const k of keys) s.$setValue(k, state[k]); };
const stageOf = (part, tools) => (s) => { put(s, part.run(take(s, part.reads), tools), part.writes); };

/**
 * The chart: a stage that reads the input, then one stage per step (a decider and its branches for a step that chooses).
 * `settings.choices`: the tool's own style choices, as buildIsoMap takes them (read now, by own stored fields).
 */
export function mapFlow(settings = undefined) {
  const tools = readIsoMapSettings(settings, 'mapFlow');
  let chart = flowChart('read', (s) => {
    const { mapSpec, mapPolicy } = s.$getArgs() ?? {};
    put(s, readIsoMap(mapSpec, mapPolicy, tools), ISO_MAP_INPUT);
  }, 'read', 'The map and the policy, checked');
  for (const step of ISO_MAP_STEPS) {
    if (!step.decides) { chart = chart.addFunction(step.name, stageOf(step, tools), step.name, step.about); continue; }
    const { decides } = step;
    let list = chart.addDeciderFunction(step.name, (s) => {
      const chosen = decides.run(take(s, decides.reads), tools);
      put(s, chosen, decides.writes);   // the choice and its reason: a stage's reads are kept with what it writes
      // the choice handed to footprintjs as a decision whose label is the reason, so the run's control edge carries the
      // words (whyFromRecord shows them: "[control: no block has an at: …]"); the rule reads back the choice just written
      const choice = chosen[decides.key], label = chosen[decides.why];
      return decide(s, [{ when: { [decides.key]: { eq: choice } }, then: choice, label }], { branch: choice, label });
    }, step.name, step.about);
    for (const [choice, branch] of Object.entries(step.branches)) list = list.addFunctionBranch(choice, `${step.name}: ${choice}`, stageOf(branch, tools));
    chart = list.end();
  }
  return chart.setLogger(QUIET).build();
}

/**
 * A copy of plain data read by own stored values only — lists by index, objects by own keys — so no getter runs.
 * Called once readIsoMap has accepted the spec (which refuses a getter in what it reads, in its own words); a getter
 * anywhere else is refused here. Bounded by the spec's own limits (readIsoMap checked the sizes).
 */
function ownCopy(v, depth = 0) {
  if (v === null || v === undefined || typeof v !== 'object') return v;
  if (depth > 8) throw new TypeError('isometric: a map spec is plain data at most 8 deep');
  const list = Array.isArray(v), out = list ? [] : {};
  for (const key of list ? Array.from({ length: v.length }, (_, i) => String(i)) : Object.keys(v)) {
    const d = Object.getOwnPropertyDescriptor(v, key);
    if (d && !('value' in d)) throw new TypeError(`isometric: a map spec's ${key} is read as a stored value, and this one is a getter (code, never run) — give the value itself`);
    out[list ? Number(key) : key] = ownCopy(d?.value, depth + 1);
  }
  return out;
}

/**
 * The map flow run: `spec` and `policy` as buildIsoMap takes them; `options.choices` the tool's own style choices, as
 * buildIsoMap's settings take them; `options.sink` a record sink (footprintjs/sinks ·
 * fileSink — the caller closes it), `options.recorders` combined recorders to attach (footprintjs/trace ·
 * controlDepRecorder). Run with `writeProvenance: 'reads-prefix'`, so the record keeps the keys each stage had read when
 * it wrote. Gives {map, snapshot}: the map (frozen plain data, equal to buildIsoMap's) and the run's snapshot.
 */
export async function runMapFlow(spec, policy, options = undefined) {
  if (options !== undefined && options !== null && (typeof options !== 'object' || Array.isArray(options))) throw new TypeError(`runMapFlow's options are {${RUN_KEYS.join(', ')}}, or none — not ${typeof options}`);
  for (const k of Object.keys(options ?? {})) if (!RUN_KEYS.includes(k)) throw new TypeError(`runMapFlow's options are ${RUN_KEYS.join(', ')} — not ${JSON.stringify(k)}`);
  const own = (k) => { const d = options ? Object.getOwnPropertyDescriptor(options, k) : undefined; if (d && !('value' in d)) throw new TypeError(`runMapFlow's ${k} is read as a stored value, and this one is a getter (code, never run) — give the value itself`); return d?.value; };
  const sink = own('sink'), recorders = own('recorders') ?? [], tools = readIsoMapSettings(own('choices') === undefined ? undefined : { choices: own('choices') }, 'runMapFlow');
  if (!Array.isArray(recorders)) throw new TypeError('runMapFlow\'s recorders are a list of combined recorders (controlDepRecorder(), …)');
  // read here first, by own stored fields, as buildIsoMap reads it: footprintjs copies a run's input before any stage
  // sees it, and that copy would run a getter — so the run is handed the plain copy (and a refusal has buildIsoMap's words)
  readIsoMap(spec, policy, tools);
  const executor = new FlowChartExecutor(mapFlow(tools), { writeProvenance: 'reads-prefix', ...(sink ? { sink } : {}) });
  for (const r of recorders) executor.attachCombinedRecorder(r);
  await executor.run({ input: { mapSpec: ownCopy(spec), mapPolicy: ownCopy(policy) } });
  const snapshot = executor.getSnapshot();
  return { map: deepFreeze(structuredClone(pick(snapshot.sharedState, MAP_KEYS))), snapshot };
}
