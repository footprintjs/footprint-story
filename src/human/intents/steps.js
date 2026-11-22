/**
 * The intent decider: an author's intents in, every move decided — as named, pure steps in one list, run in order.
 * The same shape as the map's steps (src/isometric/mapSteps.js, docs/design/2026-11-map-flow.md): planIntents runs the
 * list here, synchronously; footprint-story/humanflow runs the same list as a footprintjs chart, so a run's record keeps
 * what each step read, wrote and decided (docs/design/2026-11-human-motion.md · "The decider").
 *
 *   planIntents(intents, {models, critics, frame})  → the last state: frozen plain data, by key (below)
 *   HUMAN_STEPS                                      → [{name, about, reads, writes, run, input?, decides?, branches?}, …]
 *
 * read → choose? (ours | own: plan) → wrap → sample → check → findings. Each step is handed only the keys it names
 * (`reads`) and gives back the keys it names (`writes`, and one key per intent for each prefix in `each`: keys.js); it never edits what it was handed and never puts a function in
 * the state. The tools — a tool's own `models` and `critics` — are code, so they are never state: each step is handed
 * them beside the state (`run(state, tools)`), and the record names the model each move used, never its code.
 *
 * `choose` decides by rules as data: the family by the intent's `do` (registry.js · HUMAN_DOS), then the first rule of
 * models/rules.js · CHOOSE_RULES that holds — the model the intent names, else its family's usual. It writes each
 * choice and its rule's words (`choices`), and one choice for the list (`chose`, with its reason `choseWhy`): `ours`
 * when this package's models plan every move, `own` when a tool's own model plans one — that move's plan comes from
 * code the record does not hold, and the record's control edge says so. The plan is the branch it chose.
 *
 * The state, by key (lists in the intents' order: intent i):
 *   intents (each with its who, no wrap), wraps [[{wrapper, …options}]], frame ([w, h] | null)          read
 *   choices [{who, do, family, model, by: 'named'|'usual', rule, own}], chose 'ours'|'own', choseWhy     choose
 *   plans [move]  (planMove's: model, reason, choice, plan with its basis, checks)                       plan
 *   moves [move]  (wrapped), durations [{seconds, model, basis, wrappers, who}]                          wrap
 *   tracks [{seconds, count, pushes, distance, peakSpeed, bounds, points}]  (summary.js, bounded)        sample
 *   checks [{measures, bases, findings}]  (checkMove's)                                                  check
 *   findings [{intent, who, model, critic, level, message, fix}]  (every intent's, in order)             findings
 * and per intent i (keys.js): model-<i> {model, family, by, rule, own} (choose), duration-<i> {seconds, …the basis}
 * (wrap), findings-<i> [{critic, level, fix}] (findings).
 */
import { refuse, shown, stored, isRecord } from '../read.js';
import { OWN_NAME } from '../names.js';
import { readIntents } from './read.js';
import { trackSummary } from './summary.js';
import { intentKey, keysOut } from './keys.js';
import { planMove, sampleTrack, readModelEntry } from '../models/move.js';
import { modelsWith, familyOf, chooseModel } from '../models/registry.js';
import { anticipate, followThrough, hold, overshoot } from '../models/wrap.js';
import { checkMove } from '../critics/check.js';

/** The keys the read step writes: the steps' first state. */
export const HUMAN_INPUT = Object.freeze(['intents', 'wraps', 'frame']);
const WRAPPERS = Object.freeze({ anticipate, 'follow-through': followThrough, hold, overshoot });
const SETTINGS = Object.freeze(['models', 'critics', 'frame']);
/** The tools as planMove, sampleTrack and checkMove take them. */
const settingsOf = ({ models, critics }) => ({ models, critics });
/** Each intent's value under its own key (keys.js): {`what-0`: values[0], …}. */
const perIntent = (what, values) => Object.fromEntries(values.map((v, i) => [intentKey(what, i), v]));

// ---- choose ----------------------------------------------------------------------------------------------------------

/** Each intent's model by the rule table, and the list's one choice: this package's models alone, or a tool's own too. */
function choose({ intents }, tools) {
  const known = modelsWith(tools.models, tools.critics);
  const choices = intents.map((intent) => {
    const family = familyOf(intent.do, intent.who), { named } = readModelEntry(intent.model, intent.who);
    const { model, by, rule } = chooseModel(known, family, named, intent.do, intent.who);
    return Object.freeze({ who: intent.who, do: intent.do, family, model: model.name, by, rule, own: OWN_NAME.test(model.name) });
  });
  const own = choices.filter((c) => c.own), said = (c) => `${c.who}: ${c.do} → ${c.model} (${c.by})`;
  // each intent's model under its own key, without its who (the key says which intent; a long who would crowd the rule out)
  const each = perIntent('model', choices.map((c) => Object.freeze({ model: c.model, family: c.family, by: c.by, rule: c.rule, own: c.own })));
  if (!choices.length) return { choices: Object.freeze([]), chose: 'ours', choseWhy: 'no intents: nothing to plan' };
  if (!own.length) return { choices: Object.freeze(choices), chose: 'ours', choseWhy: `this package's models plan every move — ${choices.map(said).join('; ')}`, ...each };
  return { choices: Object.freeze(choices), chose: 'own', choseWhy: `a tool's own model plans ${own.length} of ${choices.length} moves, from code this record does not hold — ${own.map(said).join('; ')}`, ...each };
}

// ---- plan (the branch choose chose) ----------------------------------------------------------------------------------

/** Each intent planned by planMove, which reads the same rule table — so its model is the one chosen, and checked so. */
function plan({ intents, choices, frame }, tools) {
  return { plans: Object.freeze(intents.map((intent, i) => {
    const move = planMove(intent, { ...settingsOf(tools), ...(frame ? { frame } : {}) });
    if (move.model !== choices[i]?.model) refuse(`${move.who}: the choice was ${shown(choices[i]?.model)} and the plan was made by "${move.model}" — the choice and the plan read apart`);
    return move;
  })) };
}

// ---- wrap, sample, check, findings -----------------------------------------------------------------------------------

/** Each plan wrapped as its intent asked, innermost first; and each move's duration with the basis it came from. */
function wrap({ plans, wraps }) {
  const moves = plans.map((move, i) => wraps[i].reduce((m, { wrapper, ...options }) => WRAPPERS[wrapper](m, options), move));
  // the duration beside the numbers it was chosen by (the model's own plan's basis: Fitts's distance, target and bits
  // for a reach), so a record's answer to "why so long" carries them
  const durations = moves.map((m, i) => Object.freeze({ seconds: m.plan.seconds, model: m.model, basis: plans[i].plan.basis ?? null, wrappers: Object.freeze([...(m.wrappers ?? [])]), who: m.who }));
  return { moves: Object.freeze(moves), durations: Object.freeze(durations), ...perIntent('duration', durations.map(oneDuration)) };
}

/**
 * One intent's duration as its own key holds it: flat and short, so a record shows it whole — the seconds, then the
 * basis's numbers as the model wrote them (its own `seconds` left out when it is the move's), and for a wrapped move the
 * wrappers and the model's own seconds (`planned`). The model and the who are elsewhere (`model-<i>`, `choices`).
 */
function oneDuration(d) {
  const { seconds: planned, ...basis } = d.basis ?? {};
  return Object.freeze({ seconds: d.seconds, ...basis, ...(d.wrappers.length ? { wrappers: d.wrappers.join(', '), planned: planned ?? null } : {}) });
}

const sample = ({ moves }, tools) => ({ tracks: Object.freeze(moves.map((m) => trackSummary(sampleTrack(m, settingsOf(tools))))) });
// WHY check samples the move again rather than reading `tracks`: the critics read every sample at 120 a second — `jerk`
// counts each speed peak, `pen-speed` fits the curvature at each point, `contact` the depth at each — and a summary of
// SUMMARY_POINTS samples would miss a peak or a pass through a box. Keeping the whole track in the state instead would
// put up to MOST_TRACK_SAMPLES samples a move on the run's record. Sampling is pure, so the second pass is the same track.
const check = ({ moves }, tools) => ({ checks: Object.freeze(moves.map((m) => checkMove(m, settingsOf(tools)))) });

/** Every intent's findings in one list, in order, each naming its intent (by place and by its words) and its model. */
function findings({ choices, checks }) {
  const all = checks.flatMap((c, i) => c.findings.map((f) => Object.freeze({ intent: i, who: choices[i].who, model: choices[i].model, critic: f.critic, level: f.level, message: f.message, fix: f.fix })));
  // each intent's own, under its own key: the critic, its level and the fix (the message, which names the who, is in the list)
  return { findings: Object.freeze(all), ...perIntent('findings', checks.map((c) => Object.freeze(c.findings.map((f) => Object.freeze({ critic: f.critic, level: f.level, fix: f.fix }))))) };
}

// ---- the list --------------------------------------------------------------------------------------------------------

const part = (name, reads, writes, run, each = []) => Object.freeze({ name, reads: Object.freeze(reads), writes: Object.freeze(writes), each: Object.freeze(each), run });
const step = (name, about, reads, writes, run, each = []) => Object.freeze({ ...part(name, reads, writes, run, each), about });
const planPart = part('plan', ['intents', 'choices', 'frame'], ['plans'], plan);

/** A step that chooses: its choice and reason (`decides`, written under `key` and `why`), then the branch it chose — each
 *  handed only what it reads, as the chart's decider and branch stages are. `run` does both, as the chart does. */
function choosing(name, about, decides, branches) {
  const all = Object.values(branches);
  const reads = [...new Set([...decides.reads, ...all.flatMap((b) => b.reads)])].filter((k) => !decides.writes.includes(k)), writes = [...new Set([...decides.writes, ...all.flatMap((b) => b.writes)])];
  const run = (state, tools) => {
    const made = decides.run(pick(state, decides.reads), tools), chosen = pick(made, keysOut(decides, made)), branch = branches[chosen[decides.key]], planned = branch.run(pick({ ...state, ...chosen }, branch.reads), tools);
    return { ...chosen, ...pick(planned, keysOut(branch, planned)) };
  };
  const each = [...new Set([...decides.each, ...all.flatMap((b) => b.each)])];
  return Object.freeze({ name, about, reads: Object.freeze(reads), writes: Object.freeze(writes), each: Object.freeze(each), run, decides: Object.freeze({ ...decides }), branches: Object.freeze(branches) });
}

/** The steps, in the order they run. `read` takes the run's input ({intents, frame}), not the state. */
export const HUMAN_STEPS = Object.freeze([
  Object.freeze({ ...step('read', 'The intents, read and named, their wraps apart', [], HUMAN_INPUT, (given) => readIntents(given.intents, given.frame)), input: true }),
  choosing('choose', "Each intent's model, by the rule table: the one it names, else its family's usual",
    { key: 'chose', why: 'choseWhy', ...part('choose', ['intents'], ['choices', 'chose', 'choseWhy'], choose, ['model']) }, { ours: planPart, own: planPart }),
  step('wrap', 'Each plan wrapped as its intent asks: anticipate, follow-through, hold, overshoot', ['plans', 'wraps'], ['moves', 'durations'], wrap, ['duration']),
  step('sample', 'Each move sampled, summed up in a bounded record', ['moves'], ['tracks'], sample),
  step('check', 'Each move measured by the critics its model names', ['moves'], ['checks'], check),
  step('findings', 'What still looks wrong, every intent in one list: who, the critic, the fix', ['choices', 'checks'], ['findings'], findings, ['findings']),
]);

/** Only the keys named that the state holds. */
export function pick(state, keys) {
  const out = {};
  for (const k of keys) if (Object.hasOwn(state, k)) out[k] = state[k];
  return out;
}

/** planIntents' settings, each by its own stored field: {models, critics, frame}. */
export function readSettings(settings, call = 'planIntents') {
  if (settings === undefined || settings === null) return { tools: Object.freeze({ models: undefined, critics: undefined }), frame: undefined };
  if (!isRecord(settings)) refuse(`${call}'s settings are {${SETTINGS.join(', ')}}, or none — not ${shown(settings)}`);
  for (const k of Object.keys(settings)) if (!SETTINGS.includes(k)) refuse(`${call}'s settings are ${SETTINGS.join(', ')} — not ${shown(k)}`);
  const get = (k) => stored(settings, k, `${call}'s ${k}`);
  return { tools: Object.freeze({ models: get('models'), critics: get('critics') }), frame: get('frame') };
}

/**
 * The intents decided: read, then each step run in order, handed only the keys it reads and keeping only the keys it
 * writes. `models` and `critics` a tool's own, as planMove takes them; `frame` [width, height]. Gives the last state,
 * frozen plain data (the keys above).
 */
export function planIntents(intents, settings = undefined) {
  const { tools, frame } = readSettings(settings);
  let state = HUMAN_STEPS[0].run({ intents, frame });
  for (const s of HUMAN_STEPS.slice(1)) { const out = s.run(pick(state, s.reads), tools); state = Object.freeze({ ...state, ...pick(out, keysOut(s, out)) }); }
  return state;
}
