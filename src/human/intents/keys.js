/**
 * The intent decider's per-intent keys: each value a step decides for one intent is also written under a key of its
 * own, `<what>-<i>` (`model-3`, `duration-3`, `findings-3`; i = the intent's place in the list), beside the list keys.
 * WHY: an author or a model asks about ONE entry, and a record's answer shows a value cut at a couple of hundred
 * characters (footprint-story/record · WHY_LIMITS) — a list of fifty moves cut that short answers nothing. Asked for
 * `duration-3`, the record shows that one duration and its basis whole, walked back through the plan and the choice.
 * The name has no `.` or `[`: the record reader takes a key by its own name, never a part of one. A step names the
 * prefixes it writes (`each`); how many follows from the list (at most MOST_INTENTS, read.js).
 */

/** The prefixes: what is decided per intent, and the step that decides it. */
export const PER_INTENT = Object.freeze({ model: 'choose', duration: 'wrap', findings: 'findings' });

/** The key one intent's value is written under: `duration-3`. */
export function intentKey(what, i) {
  if (!Object.hasOwn(PER_INTENT, what) || !Number.isInteger(i) || i < 0) throw new TypeError(`intentKey takes ${Object.keys(PER_INTENT).join(', ')} and an intent's place (0, 1, …) — not ${JSON.stringify(what)}, ${JSON.stringify(i)}`);
  return `${what}-${i}`;
}

/** The keys a part wrote: its list keys, and the per-intent keys of its prefixes found in what it gave back, in order. */
export function keysOut(part, out) {
  const own = (part.each ?? []).flatMap((what) => Object.keys(out).filter((k) => new RegExp(`^${what}-(0|[1-9][0-9]*)$`).test(k)));
  return [...part.writes, ...own];
}

/** The per-intent keys a state holds, for every prefix: what a run's result carries beside the list keys. */
export const perIntentKeys = (state) => keysOut({ writes: [], each: Object.keys(PER_INTENT) }, state);
