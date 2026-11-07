/**
 * A model's or a conversation's words, cut short for a brief. A storyboard may be a megabyte and a message far more, and what
 * goes back to a model stays small. Anything cut says so. Reads plain data only: what is not plain data comes out as null.
 */
import { MOST } from './words.js';

const MOST_ENTRIES = 20;   // the longest list a shape may hold
const MOST_KEYS = 24;
const MOST_DEPTH = 4;      // as deep as a shape goes: a list, an entry, a part of it, its text
const CUT = (n) => `… (${n} more characters)`;

/** A text no longer than `most`, saying how much it lost. No valid text is cut at the default, as `notes` is the longest there is. */
export function clipText(text, most = MOST.notes) {
  if (text.length <= most) return text;
  const end = /[\uD800-\uDBFF]/.test(text[most - 1]) ? most - 1 : most;   // never half of a pair
  return text.slice(0, end) + CUT(text.length - end);
}

/** A copy of plain data with its texts, lists, keys and depth held to what a brief can carry. Never shares anything with `value`. */
export function clipped(value, depth = MOST_DEPTH) {
  if (typeof value === 'string') return clipText(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (value === null || typeof value !== 'object') return null;
  if (depth === 0) return '…';
  if (Array.isArray(value)) {
    const kept = value.slice(0, MOST_ENTRIES).map((v) => clipped(v, depth - 1));
    return value.length > MOST_ENTRIES ? [...kept, `… and ${value.length - MOST_ENTRIES} more`] : kept;
  }
  const keys = Object.keys(value), kept = keys.slice(0, MOST_KEYS).map((key) => [clipText(key, MOST.name), clipped(value[key], depth - 1)]);
  return Object.fromEntries(keys.length > MOST_KEYS ? [...kept, ['…', `and ${keys.length - MOST_KEYS} more`]] : kept);   // fromEntries makes own fields: a __proto__ stays a word
}
