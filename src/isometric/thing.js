/**
 * A thing on the floor, read: where it stands and how big it is. The numbers may come from anyone, so each is checked
 * one index at a time, by its own stored value (a list with a hole in it is refused: a hole would read as nothing, or
 * as whatever a prototype holds; a getter is never run), and a refusal says what to give.
 */

/** The furthest any number may be from 0. */
export const FAR = 1e6;
/** A value's own stored field: undefined when it has none, and for a getter (somebody's code, which is never run). */
export const own = (o, key) => { const d = Object.getOwnPropertyDescriptor(o, key); return d && 'value' in d ? d.value : undefined; };
/** A value as a refusal shows it, read the same way: a list by its own stored values, an object only named. */
export function shown(v) {
  if (Array.isArray(v)) return `[${Array.from({ length: Math.min(v.length, 8) }, (_, i) => shown(own(v, i))).join(',')}${v.length > 8 ? ',…' : ''}]`;
  if (v !== null && typeof v === 'object') return 'an object';
  if (typeof v === 'string') return JSON.stringify(v.length > 60 ? `${v.slice(0, 60)}…` : v);
  return typeof v === 'function' ? 'a function' : String(v);
}
export const fin = (n) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= FAR;

export function refuse(fix) { throw new Error(`isometric: ${fix}`); }

/** A list of `count` (one of the lengths allowed) numbers, every index its own and finite; a new list. */
export function numbers(v, count, what, form) {
  const ok = Array.isArray(v) && count.includes(v.length), out = [];
  let far = false;
  // each index by its own stored value: a hole has none, and a getter is somebody's code, which is never run
  for (let i = 0; ok && i < v.length; i += 1) { const n = own(v, i); if (!fin(n)) { far = typeof n === 'number' && Number.isFinite(n); break; } out.push(n); }
  if (!ok || out.length !== v.length) refuse(`${what} is ${form}${far ? `, no number further than ${FAR} from 0` : ''} — not ${shown(v)}`);
  return out;
}

/** A thing's place and size, checked: [col, row, lift] and [wide, deep, high]. */
export function readThing(thing, what = 'a thing') {
  if (!thing || typeof thing !== 'object' || Array.isArray(thing)) refuse(`${what} is {at: [col, row, lift?], size: [wide, deep, high]} — not ${shown(thing)}`);
  const at = numbers(own(thing, 'at'), [2, 3], `${what}'s at`, '[col, row] on the floor, or [col, row, lift] above it');
  const size = numbers(own(thing, 'size'), [3], `${what}'s size`, '[wide, deep, high], in tiles');
  if (!(size[0] > 0 && size[1] > 0 && size[2] >= 0)) refuse(`${what}'s size is [wide, deep, high] with wide and deep above 0 and high 0 or more — not ${shown(size)}`);
  const place = [at[0], at[1], at[2] ?? 0];
  if (place.some((v, i) => !fin(v + size[i]))) refuse(`${what} reaches past ${FAR}: at ${shown(place)} with size ${shown(size)} — bring it nearer`);
  return { at: place, size };
}
