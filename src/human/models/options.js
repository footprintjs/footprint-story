/**
 * What every model of this package reads the same way: the keys an intent may hold, and its options as numbers.
 */
import { refuse, shown, stored, finite, onlyKeys, MOST_SECONDS } from '../read.js';

/** The keys every intent may hold, whatever its family: what to do, the piece's name, the entry's words, the model. */
export const INTENT_KEYS = Object.freeze(['do', 'name', 'who', 'model']);

/** The intent's keys checked against the family's own (and INTENT_KEYS). */
export const intentKeys = (intent, own, who) => onlyKeys(intent, [...INTENT_KEYS, ...own], `${who} (an intent)`);

/** An option's number, from `lo` to `hi`, or `usual` when the intent's model left it out. */
export function optionNumber(options, key, model, lo, hi, usual) {
  const v = stored(options, key, `model "${model}"'s ${key}`);
  if (v === undefined) return usual;
  if (!(finite(v) && v >= lo && v <= hi)) refuse(`model "${model}"'s ${key} is a number from ${lo} to ${hi} — not ${shown(v)}`);
  return v;
}

/** The intent's `seconds`: left out (undefined), or above 0 and at most MOST_SECONDS. */
export function readSeconds(intent, who) {
  const v = stored(intent, 'seconds', `${who}'s seconds`);
  if (v === undefined) return undefined;
  if (!(finite(v) && v > 0 && v <= MOST_SECONDS)) refuse(`${who}'s seconds is how long the move takes, above 0 and at most ${MOST_SECONDS} — not ${shown(v)}; leave it out and the law decides`);
  return v;
}

export const round = (n, places = 2) => Number(n.toFixed(places));
