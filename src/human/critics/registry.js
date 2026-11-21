/**
 * The critics: this package's and a tool's own. A critic is
 *   { name, measure(track) → number | null, limit, finding(value, who) → {level, message, fix} | null }
 * `measure` gives a number from a sampled track (null: it cannot say, as for a move of no length); `finding` gives
 * null when the number is within its limit, and otherwise a finding in words — `message` naming the entry (`who`) and
 * `fix` in the intent's own keys. A tool's own critic is named under its prefix, checked here once.
 */
import { refuse, shown, stored, isRecord, finite } from '../read.js';
import { OWN_NAME, MOST_OWN } from '../names.js';
import { BUILT_IN_CRITICS } from './builtIn.js';

export const FINDING_LEVELS = Object.freeze(['warn', 'note']);
/** The names of the critics this package ships. */
export const HUMAN_CRITICS = Object.freeze(BUILT_IN_CRITICS.map((c) => c.name));
const cache = new WeakMap(), NONE = Object.freeze([]);

/** A tool's own critic, checked: its name under a prefix, its two functions and a finite limit. */
function readCritic(c, i) {
  const what = `critics[${i}]`;
  if (!isRecord(c)) refuse(`${what} is a critic {name, measure, limit, finding} — not ${shown(c)}`);
  const name = stored(c, 'name', `${what}'s name`), measure = stored(c, 'measure', `${what}'s measure`), finding = stored(c, 'finding', `${what}'s finding`), limit = stored(c, 'limit', `${what}'s limit`);
  if (typeof name !== 'string' || !OWN_NAME.test(name)) refuse(`${what}'s name is the tool's prefix and a name, lower case ("reel:wobble"): a name with no prefix is this package's — not ${shown(name)}`);
  if (typeof measure !== 'function' || typeof finding !== 'function') refuse(`${what} (${name}) gives measure(track) and finding(value, who) — not ${shown(typeof measure === 'function' ? finding : measure)}`);
  if (!finite(limit)) refuse(`${what} (${name})'s limit is a finite number (the value past which it finds fault) — not ${shown(limit)}`);
  return Object.freeze({ name, measure, finding, limit });
}

/** Every critic there is with a tool's own (a list, or none): {all, byName}. Read once per list. */
export function criticsWith(list = undefined) {
  if (list === undefined || list === null) list = NONE;
  if (!Array.isArray(list) || list.length > MOST_OWN) refuse(`critics are a list of at most ${MOST_OWN} — not ${Array.isArray(list) ? list.length : shown(list)}`);
  if (cache.has(list)) return cache.get(list);
  const all = [...BUILT_IN_CRITICS];
  list.forEach((c, i) => {
    const read = readCritic(Object.hasOwn(list, i) ? stored(list, i, `critics[${i}]`) : undefined, i);
    if (all.some((x) => x.name === read.name)) refuse(`critics[${i}]: "${read.name}" is given twice`);
    all.push(read);
  });
  const out = Object.freeze({ all: Object.freeze(all), byName: new Map(all.map((c) => [c.name, c])) });
  cache.set(list, out);
  return out;
}

/** A critic's finding, checked: null, or {level, message, fix} in words. */
export function readFinding(f, critic) {
  if (f === null || f === undefined) return null;
  const what = `the critic "${critic}"'s finding`;
  if (!isRecord(f)) refuse(`${what} is null or {level, message, fix} — not ${shown(f)}`);
  const level = stored(f, 'level', `${what}'s level`), message = stored(f, 'message', `${what}'s message`), fix = stored(f, 'fix', `${what}'s fix`);
  if (!FINDING_LEVELS.includes(level)) refuse(`${what}'s level is ${FINDING_LEVELS.join(' or ')} — not ${shown(level)}`);
  for (const [k, v] of [['message', message], ['fix', fix]]) if (typeof v !== 'string' || !v.trim() || v.length > 400) refuse(`${what}'s ${k} is words, 1 to 400 letters — not ${shown(v)}`);
  return Object.freeze({ critic, level, message, fix });
}
