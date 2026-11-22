/**
 * The models: this package's and a tool's own, one interface (docs/design/2026-11-human-motion.md · "A model"):
 *
 *   { family, name, options: [names], check(options)?, plan(intent, context) → plan, sample(plan, t) → {x, y, …}, checks: [critic names] }
 *
 * `family` is the kind of move it serves; `name` is lower case, a tool's own under its prefix (`reel:chalk-pen`);
 * `options` the names an intent may write under `model: {name, …}`, and `check` refuses a value it cannot take, once,
 * when the move is planned; `plan` gives plain data with `seconds`; `sample` is pure; `checks` names the critics that
 * measure what it made. WHY strategies by name, never a function handed in per call: the record names the one used.
 */
import { refuse, shown, stored, isRecord } from '../read.js';
import { BUILT_IN_NAME, OWN_NAME, MOST_OWN } from '../names.js';
import { BUILT_IN_MODELS, USUAL_MODELS } from './builtIn.js';
import { criticsWith, holdsStill } from '../critics/registry.js';

/** The families of move there are (this round fills reach, pen and letter), and the word an intent's `do` says for each. */
export const HUMAN_FAMILIES = Object.freeze(['reach', 'pen', 'letter', 'settle', 'fall', 'throw', 'hang']);
export const HUMAN_DOS = Object.freeze({ reach: 'reach', draw: 'pen', write: 'letter', settle: 'settle', fall: 'fall', throw: 'throw', hang: 'hang' });
/** The names of this package's models, by family; and the one each family uses when an intent names none. */
export const HUMAN_MODELS = Object.freeze(Object.fromEntries(HUMAN_FAMILIES.map((f) => [f, Object.freeze(BUILT_IN_MODELS.filter((m) => m.family === f).map((m) => m.name))])));
export { USUAL_MODELS };
const cache = new WeakMap(), NONE = Object.freeze([]);

/** A list of names, at most `most`, each matching `pattern`; frozen. */
function names(v, what, pattern, most = 16) {
  if (!Array.isArray(v) || v.length > most || !v.every((x, i) => Object.hasOwn(v, i) && typeof x === 'string' && pattern.test(x))) refuse(`${what} is a list of at most ${most} names — not ${shown(v)}`);
  return Object.freeze([...v]);
}

/** A model checked against the interface; `own` says whether its name must carry a prefix. */
export function readModel(m, what, own = true) {
  if (!isRecord(m)) refuse(`${what} is a model {family, name, options, plan, sample, checks} — not ${shown(m)}`);
  const get = (k) => stored(m, k, `${what}'s ${k}`);
  const family = get('family'), name = get('name'), plan = get('plan'), sample = get('sample'), check = get('check') ?? null;
  if (!HUMAN_FAMILIES.includes(family)) refuse(`${what}'s family is one of ${HUMAN_FAMILIES.join(', ')} — not ${shown(family)}`);
  if (typeof name !== 'string' || !(own ? OWN_NAME : BUILT_IN_NAME).test(name)) refuse(own ? `${what}'s name is the tool's prefix and a name, lower case ("reel:chalk-pen"): a name with no prefix is this package's — not ${shown(name)}` : `${what}'s name is lower case — not ${shown(name)}`);
  if (typeof plan !== 'function' || typeof sample !== 'function') refuse(`${what} (${name}) gives plan(intent, context) and sample(plan, t) — not ${shown(typeof plan === 'function' ? sample : plan)}`);
  if (check !== null && typeof check !== 'function') refuse(`${what} (${name})'s check is a function (options) that refuses what it cannot take, or none — not ${shown(check)}`);
  const options = names(get('options') ?? [], `${what} (${name})'s options`, BUILT_IN_NAME), checks = names(get('checks') ?? [], `${what} (${name})'s checks`, /^[a-z][a-z0-9:-]{0,48}$/);
  return Object.freeze({ family, name, options, check, plan, sample, checks });
}

/** Every model there is with a tool's own (a list, or none), and the critics they may name: {all, byName, critics}. */
export function modelsWith(list = undefined, criticList = undefined) {
  if (list === undefined || list === null) list = NONE;
  if (!Array.isArray(list) || list.length > MOST_OWN) refuse(`models are a list of at most ${MOST_OWN} — not ${Array.isArray(list) ? list.length : shown(list)}`);
  const critics = criticsWith(criticList);
  const kept = cache.get(list);
  if (kept && kept.critics === critics && holdsStill(list, kept.items)) return kept.out;
  const all = BUILT_IN_MODELS.map((m) => readModel(m, `the model "${m.name}"`, false));
  list.forEach((m, i) => {
    const read = readModel(Object.hasOwn(list, i) ? stored(list, i, `models[${i}]`) : undefined, `models[${i}]`);
    if (all.some((x) => x.name === read.name)) refuse(`models[${i}]: "${read.name}" is given twice`);
    all.push(read);
  });
  // a check names a critic there is: a misspelt one would never measure anything
  for (const m of all) for (const c of m.checks) if (!critics.byName.has(c)) refuse(`the model "${m.name}" names the check ${shown(c)}, which is no critic — the critics are ${[...critics.byName.keys()].map((k) => `"${k}"`).join(', ')}`);
  const out = Object.freeze({ all: Object.freeze(all), byName: new Map(all.map((m) => [m.name, m])), critics });
  // read again when the list changes, or comes with other critics
  cache.set(list, { items: [...list], critics, out });
  return out;
}

/** The model an intent names, or its family's usual one; refused, naming the ones there are, when there is none. */
export function chooseModel(models, family, named, doWord) {
  if (named !== undefined) {
    const m = models.byName.get(named);
    if (!m) refuse(`there is no model ${shown(named)} — the models are ${[...models.byName.keys()].map((k) => `"${k}"`).join(', ')} (a tool's own goes in planMove's models)`);
    if (m.family !== family) refuse(`the model "${named}" is for a ${m.family}, and this intent is do: '${doWord}' (a ${family}) — name a ${family} model: ${models.all.filter((x) => x.family === family).map((x) => `"${x.name}"`).join(', ') || 'none yet'}`);
    return { model: m, how: 'named by the intent', by: 'named' };
  }
  const usual = USUAL_MODELS[family];
  if (!usual) refuse(`no model for do: '${doWord}' yet — name one of a tool's own with model: 'prefix:name' and hand it in planMove's models`);
  return { model: models.byName.get(usual), how: `the usual for do: '${doWord}'`, by: 'usual' };
}
