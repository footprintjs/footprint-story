/**
 * A move planned from an intent, and sampled. The author writes what happens (`{do: 'reach', from, to}`); this picks
 * the model (the one the intent names, else its family's usual), plans it once, and says why in plain words (the
 * reason lands on a record). Each frame then samples the plan: the same t, the same answer, in a deck and in a film.
 *
 *   planMove(intent, {models, critics, frame})  → {model, family, do, who, options, choice, reason, plan, checks}: frozen plain data
 *   sampleMove(move, t, {models})               → {x, y, …}: frozen; t in seconds from the move's start; a wrapped
 *                                                 move (models/wrap.js) samples its wrappers over its model's own sample
 *   sampleTrack(move, {rate, models})           → {who, family, model, seconds, pushes, samples: [{t, x, y, …}], plan}: what
 *                                                 the critics read — each sample whole (a squash's sx and sy, a chain's
 *                                                 points), and the plan (the contact critic reads the world it names)
 *
 * A model's random() is seeded from the model's name, its options, the piece's `name` and the intent's shape — every key
 * but `who` (the words for where it was written: moving an entry in its list must not change its wobble) and the
 * timing keys `seconds` and `speed` (a slower draw keeps its wobble's shape) — by the rule the isometric styles keep
 * (src/seed/seeded.js). The same entry draws the same tremor wherever it is listed; another piece another one.
 * WHY data beside the words: `choice` says how the model was picked and each plan's `basis` its numbers, so a
 * decider (round 2) records data, and the `reason` is only their sentence.
 * What a tool's own model throws comes out as it is; what it gives back is checked (src/human/plain.js) before use.
 */
import { refuse, shown, stored, isRecord, finite, readPoint, MOST_SECONDS } from '../read.js';
import { plainCopy } from '../plain.js';
import { seeded } from '../../seed/seeded.js';
import { HUMAN_DOS, modelsWith, chooseModel } from './registry.js';
import { isWrapped, sampleWrapped } from './wrap.js';

export const MOST_TRACK_SAMPLES = 100000;
/** The most numbers or points one list in a sample may hold (a hanging chain's links, say). */
export const MOST_SAMPLE_LIST = 1024;
/** The intent's keys left out of the seed: where it was written, and how long it takes. */
export const UNSEEDED_KEYS = Object.freeze(['who', 'seconds', 'speed']);

/** The intent's text with its keys in order at every depth: the same intent, the same seed, however its keys were written. */
const canonical = (v) => (Array.isArray(v) ? `[${v.map(canonical).join(',')}]` : isRecord(v) ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}` : JSON.stringify(v));

/** The intent's `model`: none, a name, or {name, …options}. Gives {named, options}. */
function readModelEntry(entry, who) {
  if (entry === undefined) return { named: undefined, options: Object.freeze({}) };
  if (typeof entry === 'string') return { named: entry, options: Object.freeze({}) };
  if (!isRecord(entry) || typeof entry.name !== 'string') refuse(`${who}'s model is a model's name, or {name, …its options} ({name: 'min-jerk', bend: 0.1}) — not ${shown(entry)}`);
  const options = {};
  for (const k of Object.keys(entry).filter((x) => x !== 'name').sort()) {
    const v = entry[k];
    if (!(finite(v) || typeof v === 'boolean' || (typeof v === 'string' && v.length <= 64))) refuse(`${who}'s model option ${k} is a number, a word or true/false — not ${shown(v)}`);
    options[k] = v;
  }
  return { named: entry.name, options: Object.freeze(options) };
}

/** A move planned from an intent: the model chosen and why, its options checked once, its plan as frozen plain data. */
export function planMove(intent, settings = undefined) {
  if (!isRecord(intent)) refuse(`planMove takes an intent {do, …} ({do: 'reach', from: [x, y], to: [x, y]}) — not ${shown(intent)}`);
  if (settings !== undefined && settings !== null && !isRecord(settings)) refuse(`planMove's settings are {models, critics, frame}, or none — not ${shown(settings)}`);
  const set = (k) => (settings ? stored(settings, k, `planMove's ${k}`) : undefined);
  const rawWho = stored(intent, 'who', "an intent's who"), rawName = stored(intent, 'name', "an intent's name");
  if (rawName !== undefined && (typeof rawName !== 'string' || !rawName || [...rawName].length > 64)) refuse(`an intent's name is its piece's name, 1 to 64 letters — not ${shown(rawName)}`);
  if (rawWho !== undefined && (typeof rawWho !== 'string' || !rawWho.trim() || rawWho.length > 200)) refuse(`an intent's who is the words for where it was written ('blocks[2] ("hand")'), 1 to 200 letters — not ${shown(rawWho)}`);
  const who = rawWho ?? (rawName !== undefined ? `"${rawName}"` : 'the move');
  const copy = plainCopy(intent, `${who} (an intent)`);
  const doWord = copy.do;
  if (typeof doWord !== 'string' || !Object.hasOwn(HUMAN_DOS, doWord)) refuse(`${who}'s do is ${Object.keys(HUMAN_DOS).map((d) => `'${d}'`).join(', ')} — not ${shown(doWord)}`);
  const frame = set('frame') === undefined ? null : readPoint(set('frame'), "planMove's frame (its width and height)");
  const models = modelsWith(set('models'), set('critics')), family = HUMAN_DOS[doWord];
  const { named, options } = readModelEntry(copy.model, who);
  const { model, how, by } = chooseModel(models, family, named, doWord);
  for (const k of Object.keys(options)) if (!model.options.includes(k)) refuse(`${who}'s model "${model.name}" takes ${model.options.length ? model.options.join(', ') : 'no options'} — not ${shown(k)}`);
  if (model.check) model.check(options);
  const shape = Object.fromEntries(Object.keys(copy).filter((k) => !UNSEEDED_KEYS.includes(k) && k !== 'model' && k !== 'name').map((k) => [k, copy[k]]));
  const random = seeded(canonical(['human', model.name, options, rawName ?? null, shape]));
  const context = Object.freeze({ who, name: rawName ?? null, options, random, frame });
  const plan = plainCopy(model.plan(copy, context), `${who}: the model "${model.name}"'s plan`);
  if (!isRecord(plan) || !(finite(plan.seconds) && plan.seconds >= 0 && plan.seconds <= MOST_SECONDS)) refuse(`${who}: the model "${model.name}"'s plan is {seconds, …}: how long the move takes, from 0 to ${MOST_SECONDS} s — not ${shown(isRecord(plan) ? plan.seconds : plan)}`);
  if (plan.pushes !== undefined && !(Number.isInteger(plan.pushes) && plan.pushes >= 0 && plan.pushes <= 100000)) refuse(`${who}: the model "${model.name}"'s plan's pushes is how many pushes the move is made of, a whole number from 0 — not ${shown(plan.pushes)}`);
  if (plan.basis !== undefined && !(isRecord(plan.basis) && Object.values(plan.basis).every((v) => v === null || typeof v !== 'object'))) refuse(`${who}: the model "${model.name}"'s plan's basis is a flat record of the numbers it chose by ({distance: 500, bits: 3.75, …}) — not ${shown(plan.basis)}`);
  const why = typeof plan.why === 'string' && plan.why.trim() ? ` — ${plan.why}` : '';
  return Object.freeze({ model: model.name, family, do: doWord, who, options, choice: Object.freeze({ by }), reason: `do: '${doWord}' → ${model.name}, ${how}${why}`, plan, checks: model.checks });
}

/** The move's model, found by its name (a tool's own handed in again: a record keeps no code). */
function modelOf(move, settings, call) {
  if (!isRecord(move) || typeof move.model !== 'string' || !isRecord(move.plan)) refuse(`${call} takes a move planMove made — not ${shown(move)}`);
  const models = modelsWith(isRecord(settings) ? stored(settings, 'models', `${call}'s models`) : undefined, isRecord(settings) ? stored(settings, 'critics', `${call}'s critics`) : undefined);
  const model = models.byName.get(move.model);
  if (!model) refuse(`${call}: the move was planned by "${move.model}", which is not here — a tool's own model is handed in again in models`);
  return model;
}

/** A list in a sample: at most MOST_SAMPLE_LIST finite numbers, or as many points [x, y]; each by its own stored value. Frozen. */
function sampleList(v, what) {
  if (v.length > MOST_SAMPLE_LIST) refuse(`${what} is at most ${MOST_SAMPLE_LIST} long — not ${v.length}`);
  const items = Array.from({ length: v.length }, (_, i) => (Object.hasOwn(v, i) ? stored(v, i, `${what}[${i}]`) : undefined));
  if (items.every(finite)) return Object.freeze(items);
  return Object.freeze(items.map((p, i) => {
    const xy = Array.isArray(p) && p.length === 2 ? [0, 1].map((j) => (Object.hasOwn(p, j) ? stored(p, j, `${what}[${i}][${j}]`) : undefined)) : null;
    if (!(xy && finite(xy[0]) && finite(xy[1]))) refuse(`${what} is a list of numbers, or of points [x, y] — its [${i}] is ${shown(p)}`);
    return Object.freeze(xy);
  }));
}

/** Where the move is at t (seconds from its start): the model's sample, checked — x and y, and any other numbers it gives. */
export function sampleMove(move, t, settings = undefined) {
  const model = modelOf(move, settings, 'sampleMove');
  if (!finite(t)) refuse(`sampleMove's t is seconds from the move's start, a finite number — not ${shown(t)}`);
  const s = isWrapped(move.plan) ? sampleWrapped(move.plan, t, model.sample) : model.sample(move.plan, t), who = `${move.who ?? 'the move'}: the model "${model.name}"'s sample`;
  if (!isRecord(s)) refuse(`${who} is {x, y, …} — not ${shown(s)}`);
  const out = {};
  for (const k of Object.keys(s)) {
    const v = stored(s, k, `${who}'s ${k}`);
    out[k] = Array.isArray(v) ? sampleList(v, `${who}'s ${k}`) : v;
    if (!Array.isArray(v) && !finite(v)) refuse(`${who}'s ${k} is a finite number, or a list of at most ${MOST_SAMPLE_LIST} numbers or points [x, y] — not ${shown(v)}`);
  }
  if (!(finite(out.x) && finite(out.y))) refuse(`${who} gives x and y — not ${shown(Object.keys(out))}`);
  return Object.freeze(out);
}

/** The move sampled at `rate` a second (120 unless given) from 0 to its seconds, both ends in: what a critic measures. */
export function sampleTrack(move, settings = undefined) {
  modelOf(move, settings, 'sampleTrack');
  const rate = isRecord(settings) && stored(settings, 'rate', "sampleTrack's rate") !== undefined ? settings.rate : 120;
  if (!(finite(rate) && rate >= 1 && rate <= 1000)) refuse(`sampleTrack's rate is samples a second, from 1 to 1000 — not ${shown(rate)}`);
  const seconds = move.plan.seconds, count = Math.ceil(seconds * rate - 1e-9) + 1;
  if (count > MOST_TRACK_SAMPLES) refuse(`a track of ${round1(seconds)} s at ${rate} a second is ${count} samples — at most ${MOST_TRACK_SAMPLES}: give a lower rate`);
  const samples = Array.from({ length: Math.max(count, 2) }, (_, i) => {
    const t = i >= count - 1 ? seconds : i / rate, p = sampleMove(move, t, settings);
    return Object.freeze({ ...p, t });
  });
  return Object.freeze({ who: move.who ?? 'the move', family: move.family, model: move.model, seconds, pushes: move.plan.pushes ?? 1, samples: Object.freeze(samples), plan: move.plan });
}
const round1 = (n) => Math.round(n * 10) / 10;
