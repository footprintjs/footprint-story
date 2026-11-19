/**
 * A thing on the floor, read: where it stands and how big it is. The numbers may come from anyone, so each is checked
 * one index at a time (a list with a hole in it is refused: a hole would read as nothing, or as whatever a prototype
 * holds), and a refusal says what to give.
 */

/** The furthest any number may be from 0. */
export const FAR = 1e6;
export const shown = (v) => (typeof v === 'number' || v === undefined ? String(v) : JSON.stringify(v));
export const fin = (n) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= FAR;

export function refuse(fix) { throw new Error(`isometric: ${fix}`); }

/** A list of `count` (one of the lengths allowed) numbers, every index its own and finite; a new list. */
export function numbers(v, count, what, form) {
  const ok = Array.isArray(v) && count.includes(v.length), out = [];
  for (let i = 0; ok && i < v.length; i += 1) { if (!Object.hasOwn(v, i) || !fin(v[i])) break; out.push(v[i]); }
  if (!ok || out.length !== v.length) refuse(`${what} is ${form} — not ${shown(v)}`);
  return out;
}

/** A thing's place and size, checked: [col, row, lift] and [wide, deep, high]. */
export function readThing(thing, what = 'a thing') {
  if (!thing || typeof thing !== 'object' || Array.isArray(thing)) refuse(`${what} is {at: [col, row, lift?], size: [wide, deep, high]} — not ${shown(thing)}`);
  const at = numbers(Object.hasOwn(thing, 'at') ? thing.at : undefined, [2, 3], `${what}'s at`, '[col, row] on the floor, or [col, row, lift] above it');
  const size = numbers(Object.hasOwn(thing, 'size') ? thing.size : undefined, [3], `${what}'s size`, '[wide, deep, high], in tiles');
  if (!(size[0] > 0 && size[1] > 0 && size[2] >= 0)) refuse(`${what}'s size is [wide, deep, high] with wide and deep above 0 and high 0 or more — not ${shown(size)}`);
  const place = [at[0], at[1], at[2] ?? 0];
  if (place.some((v, i) => !fin(v + size[i]))) refuse(`${what} reaches past ${FAR}: at ${shown(place)} with size ${shown(size)} — bring it nearer`);
  return { at: place, size };
}
