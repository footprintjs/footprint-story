/**
 * An author's intents, read once — by planIntents and by the chart's read stage alike, so both refuse in the same words.
 *
 *   copyIntents(intents)        → [plain copy]: a list of at most MOST_INTENTS intents, each copied by its own stored
 *                                 fields (a getter is code, never run: src/human/plain.js) — the run's input
 *   readIntents(intents, frame) → {intents, wraps, frame}: the first state of the steps (steps.js)
 *   readGiven(intents, frame)   → {copies, state}: both, the intents read once (runHumanFlow)
 *
 * Each intent comes out named — its own `who`, else `intents[i]` with its piece's name ("intents[2] (\"hand\")") — so
 * every refusal and finding says where it was written; its `wrap` is taken apart (`wraps[i]`, each a wrapper's name and
 * its options), since a model refuses a key it does not read. WHY `intents[i]` and not planMove's "the move": a list
 * has many moves, and the author finds an entry by its place.
 */
import { refuse, shown, stored, isRecord, readPoint } from '../read.js';
import { plainCopy } from '../plain.js';
import { whoOf } from '../models/move.js';
import { WRAPPER_NAMES, MOST_WRAPPERS } from '../models/wrap.js';

/**
 * The most intents one list may hold. WHY 64: each is planned, sampled and checked, and each gets keys of its own
 * (keys.js) — a step that writes one per intent writes that many rows, each with the keys it had read, and the record
 * reader keeps at most 200 keys read a step (footprint-story/record · WHY_LIMITS.reads): the wrap and findings steps
 * read two keys a row, so 64 intents (132 keys read: 66 rows of two) leave a margin and a record of the most stays whole.
 */
export const MOST_INTENTS = 64;

/** The intents as plain frozen copies, each read by its own stored fields; a list longer than MOST_INTENTS refused. */
export function copyIntents(intents) {
  if (!Array.isArray(intents)) refuse(`planIntents takes a list of intents [{do, …}] ([{do: 'reach', from: [x, y], to: [x, y]}]) — not ${shown(intents)}`);
  if (intents.length > MOST_INTENTS) refuse(`planIntents takes at most ${MOST_INTENTS} intents — not ${intents.length}: plan them in parts`);
  return Object.freeze(Array.from({ length: intents.length }, (_, i) => {
    const v = Object.hasOwn(intents, i) ? stored(intents, i, `intents[${i}]`) : undefined;
    if (!isRecord(v)) refuse(`intents[${i}] is an intent {do, …} — not ${shown(v)}`);
    return plainCopy(v, `intents[${i}]`);
  }));
}

/** An intent's `wrap`: none, or a list of at most MOST_WRAPPERS {wrapper, …its options}, innermost first. */
function readWrap(wrap, who) {
  if (wrap === undefined) return Object.freeze([]);
  if (!Array.isArray(wrap) || wrap.length > MOST_WRAPPERS) refuse(`${who}'s wrap is a list of at most ${MOST_WRAPPERS} wrappers [{wrapper: 'anticipate', share: 0.2}] — not ${shown(wrap)}`);
  for (const [i, w] of wrap.entries()) {
    if (!isRecord(w) || !WRAPPER_NAMES.includes(w.wrapper)) refuse(`${who}'s wrap[${i}] is {wrapper, …its options}, the wrapper ${WRAPPER_NAMES.map((n) => `'${n}'`).join(', ')} — not ${shown(isRecord(w) ? w.wrapper : w)}`);
  }
  return wrap;
}

/**
 * The intents read once: {copies, state} — the plain copies (what a chart's run is handed as its input, a getter never
 * run) and the first state of the steps made from them. runHumanFlow uses both; planIntents only the state.
 */
export function readGiven(intents, frame = undefined) {
  const copies = copyIntents(intents);
  const read = copies.map((copy, i) => {
    const { who } = whoOf(copy, (name) => (name !== undefined ? `intents[${i}] ("${name}")` : `intents[${i}]`));
    const { wrap, ...intent } = copy;
    return { intent: Object.freeze({ ...intent, who }), wrap: readWrap(wrap, who) };
  });
  return { copies, state: Object.freeze({
    intents: Object.freeze(read.map((r) => r.intent)),
    wraps: Object.freeze(read.map((r) => r.wrap)),
    frame: frame === undefined || frame === null ? null : readPoint(frame, "planIntents' frame (its width and height)"),
  }) };
}

/** The first state of the steps: each intent named and its wrap apart, and the frame ([width, height] or null). Frozen plain data. */
export const readIntents = (intents, frame = undefined) => readGiven(intents, frame).state;
