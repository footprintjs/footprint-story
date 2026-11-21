/**
 * Reading what a caller hands in, for every file of src/human: each value by its own stored field (a getter is
 * somebody's code and is never run), every number finite, and a refusal that names the entry (`who`) and the fix.
 * WHY its own copy and not the isometric one: a door loads only its own folder (test/doors.test.js), so a page that
 * moves a hand never loads the isometric maths.
 */

/** The furthest a place on the frame may be from 0, in px, and the longest a move may take, in seconds. */
export const FAR = 1e6;
export const MOST_SECONDS = 3600;

/** A refusal: an Error whose message starts `human:` and says what to give. */
export function refuse(fix) { throw new Error(`human: ${fix}`); }

/** A value's own stored field: undefined when it has none; a getter refused (never run). */
export function stored(o, key, what) {
  const d = Object.getOwnPropertyDescriptor(o, key);
  if (d && !('value' in d)) refuse(`${what} is read as a stored value, and this one is a getter (code, never run) — give the value itself`);
  return d ? d.value : undefined;
}

/** A value as a refusal shows it: a list by its first stored values, an object only named. */
export function shown(v) {
  if (Array.isArray(v)) return `[${Array.from({ length: Math.min(v.length, 6) }, (_, i) => { const d = Object.getOwnPropertyDescriptor(v, i); return d && 'value' in d ? shown(d.value) : 'nothing'; }).join(',')}${v.length > 6 ? ',…' : ''}]`;
  if (v !== null && typeof v === 'object') return 'an object';
  if (typeof v === 'string') return JSON.stringify(v.length > 60 ? `${v.slice(0, 60)}…` : v);
  return typeof v === 'function' ? 'a function' : String(v);
}

export const finite = (n) => typeof n === 'number' && Number.isFinite(n);
export const near = (n) => finite(n) && Math.abs(n) <= FAR;
export const isRecord = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** A number from `lo` to `hi` (either end open with `above`), or the default when left out. */
export function readNumber(o, key, what, { lo = -FAR, hi = FAR, above = false, usual } = {}) {
  const v = stored(o, key, `${what}'s ${key}`);
  if (v === undefined && usual !== undefined) return usual;
  const range = `${above ? 'above' : 'from'} ${lo}${hi === FAR ? '' : ` to ${hi}`}`;
  if (!(finite(v) && (above ? v > lo : v >= lo) && v <= hi)) refuse(`${what}'s ${key} is a number ${range} — not ${shown(v)}`);
  return v;
}

/** A point [x, y] on the frame, two finite numbers no further than FAR from 0; a new frozen pair. */
export function readPoint(p, what) {
  const xy = Array.isArray(p) && p.length === 2 ? [0, 1].map((i) => { const d = Object.getOwnPropertyDescriptor(p, i); return d && 'value' in d ? d.value : undefined; }) : null;
  if (!(xy && near(xy[0]) && near(xy[1]))) refuse(`${what} is a point [x, y] on the frame, two numbers no further than ${FAR} from 0 — not ${shown(p)}`);
  return Object.freeze(xy);
}

/** Points [[x, y], …], at least `least` and at most `most`, each read as readPoint reads one; a new frozen list. */
export function readPoints(v, what, { least = 2, most = 1024 } = {}) {
  if (!Array.isArray(v) || v.length < least || v.length > most) refuse(`${what} is ${least} to ${most} points [[x, y], …] — not ${Array.isArray(v) ? `${v.length} of them` : shown(v)}`);
  return Object.freeze(Array.from({ length: v.length }, (_, i) => readPoint(Object.hasOwn(v, i) ? stored(v, i, `${what}[${i}]`) : undefined, `${what}[${i}]`)));
}

/** The keys an object may hold, checked: a key it does not take is refused, naming the ones it does. */
export function onlyKeys(o, keys, what) {
  for (const k of Object.keys(o)) if (!keys.includes(k)) refuse(`${what} takes ${keys.join(', ')} — not ${shown(k)}`);
}
