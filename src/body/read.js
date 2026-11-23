/**
 * Reading what a caller hands in, for every file of src/body: each value by its own stored field (a getter is somebody's
 * code and is never run), every number finite, lists bounded before they are walked, and a refusal that names the
 * entry and the fix. WHY its own copy and not src/human/read.js: the body door must not load src/human
 * (test/doors.test.js), and src/human will import src/body, never the reverse; the human, isometric and differs folders
 * each keep their own small reader for the same reason.
 */

/** The furthest a place may be from 0, in px; and the furthest an angle may be from 0, in radians (a turn written past
 *  it has lost its digits: 1e6 rad keeps about 1e-10 rad of them). */
export const FAR = 1e6;
export const ANGLE_FAR = 1e6;

/**
 * A body's, a part's and a chain's name: lower case, a letter first, at most 32 characters. The same rule as
 * src/human/names.js · BUILT_IN_NAME (a test pins the two equal): `__proto__`, `constructor` and the like fail it, and
 * nothing is ever keyed by a name anyway (lookups are Maps).
 */
export const NAME = /^[a-z][a-z0-9-]{0,31}$/;

/** A refusal: an Error whose message starts `body:` and says what to give. */
export function refuse(fix) { throw new Error(`body: ${fix}`); }

/** A value's own stored field: undefined when it has none; a getter refused (never run). */
export function stored(o, key, what) {
  const d = Object.getOwnPropertyDescriptor(o, key);
  if (d && !('value' in d)) refuse(`${what} is read as a stored value, and this one is a getter (code, never run) — give the value itself`);
  return d ? d.value : undefined;
}

/** A value as a refusal shows it: a list by its length, an object only named, a long text cut. */
export function shown(v) {
  if (Array.isArray(v)) return `a list of ${v.length}`;
  if (v !== null && typeof v === 'object') return 'an object';
  if (typeof v === 'string') return JSON.stringify(v.length > 60 ? `${v.slice(0, 60)}…` : v);
  return typeof v === 'function' ? 'a function' : String(v);
}

export const finite = (n) => typeof n === 'number' && Number.isFinite(n);
export const isRecord = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** An object, with only the keys it takes (a key it does not take is refused, naming the ones it does). */
export function readRecord(o, keys, what) {
  if (!isRecord(o)) refuse(`${what} is an object {${keys.join(', ')}} — not ${shown(o)}`);
  for (const k of Reflect.ownKeys(o)) if (typeof k !== 'string' || !keys.includes(k)) refuse(`${what} takes ${keys.join(', ')} — not ${shown(typeof k === 'string' ? k : String(k))}`);
  return o;
}

/** A list of `least` to `most` values, each read by its own stored slot (a hole refused); a new array. */
export function readList(v, what, { least = 0, most }) {
  if (!Array.isArray(v) || v.length < least || v.length > most) refuse(`${what} is a list of ${least} to ${most} — not ${Array.isArray(v) ? `${v.length} of them` : shown(v)}`);
  return Array.from({ length: v.length }, (_, i) => {
    if (!Object.hasOwn(v, i)) refuse(`${what}[${i}] is missing (a hole in the list) — give a value`);
    return stored(v, i, `${what}[${i}]`);
  });
}

/** A number from `lo` to `hi` (the low end open with `above`), or the default when left out. */
export function readNumber(o, key, what, { lo, hi, above = false, usual } = {}) {
  const v = stored(o, key, `${what}'s ${key}`);
  if (v === undefined && usual !== undefined) return usual;
  if (!(finite(v) && (above ? v > lo : v >= lo) && v <= hi)) refuse(`${what}'s ${key} is a number ${above ? 'above' : 'from'} ${lo} to ${hi} — not ${shown(v)}`);
  return v + 0; // −0 is 0: the data holds one zero
}

/** A name by NAME's rule. */
export function readName(v, what) {
  if (typeof v !== 'string' || !NAME.test(v)) refuse(`${what} is a name in lower case, a letter first, at most 32 letters, digits and hyphens ("upper-arm-n") — not ${shown(v)}`);
  return v;
}

/** A point [x, y], two finite numbers no further than FAR from 0; a new frozen pair. */
export function readPoint(p, what) {
  const xy = Array.isArray(p) && p.length === 2 ? [0, 1].map((i) => { const d = Object.getOwnPropertyDescriptor(p, i); return d && 'value' in d ? d.value : undefined; }) : null;
  if (!(xy && xy.every((n) => finite(n) && Math.abs(n) <= FAR))) refuse(`${what} is a point [x, y], two numbers no further than ${FAR} from 0 — not ${shown(p)}`);
  return Object.freeze([xy[0] + 0, xy[1] + 0]);
}
