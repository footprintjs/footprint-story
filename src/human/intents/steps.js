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
 * (`reads`) and gives back the keys it names (`writes`); it never edits what it was handed and never puts a function in
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
 */
import { refuse, shown, stored, isRecord } from '../read.js';
import { OWN_NAME } from '../names.js';
import { readIntents } from './read.js';
import { trackSummary } from './summary.js';
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

// ---- choose ----------------------------------------------------------------------------------------------------------

/** Each intent's model by the rule table, and the list's one choice: this package's models alone, or a tool's own too. */
function choose({ intents }, tools) {
  const known = modelsWith(tools.models, tools.critics);
  const choices = intents.map((intent) => {
    const family = familyOf(intent.do, intent.who), { named } = readModelEntry(intent.model, intent.who);
    const { model, by, rule } = chooseModel(known, family, named, intent.do);
    return Object.freeze({ who: intent.who, do: intent.do, family, model: model.name, by, rule, own: OWN_NAME.test(model.name) });
  });
  const own = choices.filter((c) => c.own), said = (c) => `${c.who}: ${c.do} → ${c.model} (${c.by})`;
  if (!choices.length) return { choices: Object.freeze([]), chose: 'ours', choseWhy: 'no intents: nothing to plan' };
  if (!own.length) return { choices: Object.freeze(choices), chose: 'ours', choseWhy: `this package's models plan every move — ${choices.map(said).join('; ')}` };
  return { choices: Object.freeze(choices), chose: 'own', choseWhy: `a tool's own model plans ${own.length} of ${choices.length} moves, from code this record does not hold — ${own.map(said).join('; ')}` };
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
  return { moves: Object.freeze(moves), durations: Object.freeze(durations) };
}

const sample = ({ moves }, tools) => ({ tracks: Object.freeze(moves.map((m) => trackSummary(sampleTrack(m, settingsOf(tools))))) });
const check = ({ moves }, tools) => ({ checks: Object.freeze(moves.map((m) => checkMove(m, settingsOf(tools)))) });

/** Every intent's findings in one list, in order, each naming its intent (by place and by its words) and its model. */
function findings({ choices, checks }) {
  return { findings: Object.freeze(checks.flatMap((c, i) => c.findings.map((f) => Object.freeze({ intent: i, who: choices[i].who, model: choices[i].model, critic: f.critic, level: f.level, message: f.message, fix: f.fix })))) };
}

// ---- the list --------------------------------------------------------------------------------------------------------

const part = (name, reads, writes, run) => Object.freeze({ name, reads: Object.freeze(reads), writes: Object.freeze(writes), run });
const step = (name, about, reads, writes, run) => Object.freeze({ ...part(name, reads, writes, run), about });
const planPart = part('plan', ['intents', 'choices', 'frame'], ['plans'], plan);

/** A step that chooses: its choice and reason (`decides`, written under `key` and `why`), then the branch it chose — each
 *  handed only what it reads, as the chart's decider and branch stages are. `run` does both, as the chart does. */
function choosing(name, about, decides, branches) {
  const all = Object.values(branches);
  const reads = [...new Set([...decides.reads, ...all.flatMap((b) => b.reads)])].filter((k) => !decides.writes.includes(k)), writes = [...new Set([...decides.writes, ...all.flatMap((b) => b.writes)])];
  const run = (state, tools) => {
    const chosen = pick(decides.run(pick(state, decides.reads), tools), decides.writes), branch = branches[chosen[decides.key]];
    return { ...chosen, ...pick(branch.run(pick({ ...state, ...chosen }, branch.reads), tools), branch.writes) };
  };
  return Object.freeze({ name, about, reads: Object.freeze(reads), writes: Object.freeze(writes), run, decides: Object.freeze({ ...decides }), branches: Object.freeze(branches) });
}

/** The steps, in the order they run. `read` takes the run's input ({intents, frame}), not the state. */
export const HUMAN_STEPS = Object.freeze([
  Object.freeze({ ...step('read', 'The intents, read and named, their wraps apart', [], HUMAN_INPUT, (given) => readIntents(given.intents, given.frame)), input: true }),
  choosing('choose', "Each intent's model, by the rule table: the one it names, else its family's usual",
    { key: 'chose', why: 'choseWhy', ...part('choose', ['intents'], ['choices', 'chose', 'choseWhy'], choose) }, { ours: planPart, own: planPart }),
  step('wrap', 'Each plan wrapped as its intent asks: anticipate, follow-through, hold, overshoot', ['plans', 'wraps'], ['moves', 'durations'], wrap),
  step('sample', 'Each move sampled, summed up in a bounded record', ['moves'], ['tracks'], sample),
  step('check', 'Each move measured by the critics its model names', ['moves'], ['checks'], check),
  step('findings', 'What still looks wrong, every intent in one list: who, the critic, the fix', ['choices', 'checks'], ['findings'], findings),
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
  for (const s of HUMAN_STEPS.slice(1)) state = Object.freeze({ ...state, ...pick(s.run(pick(state, s.reads), tools), s.writes) });
  return state;
}
