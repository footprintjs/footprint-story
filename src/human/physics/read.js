/**
 * The readers every physics part shares: numbers and points checked one stored value at a time, refusals that name
 * the entry (`who`) and the fix, plain frozen output, and seeded numbers.
 *
 * WHY stored values only: an intent may come from anyone (a recipe, a deck attribute, a model). A getter is somebody's
 * code, so it is never run; a hole in a list is refused, never read as whatever a prototype holds.
 */

/** The furthest a place may be from 0 (px), and the longest any plan may run (s). */
export const FAR = 1e6;
export const MOST_SECONDS = 30;

/** A value's own stored field: undefined when it has none; a getter is refused (code, never run). */
export function stored(o, key, what) {
  const d = Object.getOwnPropertyDescriptor(o, key);
  if (d && !('value' in d)) refuse(`${what} is read as a stored value, and this one is a getter (code, never run) — give the value itself`);
  return d ? d.value : undefined;
}

/** A value as a refusal shows it: a short list by its stored values, an object only named. */
export function shown(v) {
  if (Array.isArray(v)) return `[${Array.from({ length: Math.min(v.length, 6) }, (_, i) => { const d = Object.getOwnPropertyDescriptor(v, i); return d && 'value' in d ? shown(d.value) : 'a hole'; }).join(',')}${v.length > 6 ? ',…' : ''}]`;
  if (v !== null && typeof v === 'object') return 'an object';
  if (typeof v === 'string') return JSON.stringify(v.length > 60 ? `${v.slice(0, 60)}…` : v);
  return typeof v === 'function' ? 'a function' : String(v);
}

export function refuse(text) { throw new Error(`human: ${text}`); }

export const finite = (n) => typeof n === 'number' && Number.isFinite(n);
const near = (n) => finite(n) && Math.abs(n) <= FAR;

/** An intent (or options) as a plain object whose keys are all ones the reader knows; gives a reader of its keys. */
export function readKeys(o, known, who, what) {
  if (!o || typeof o !== 'object' || Array.isArray(o)) refuse(`${who}: ${what} is an object {${known.join(', ')}} — not ${shown(o)}`);
  for (const k of Object.keys(o)) if (!known.includes(k)) refuse(`${who}: ${what} takes ${known.join(', ')} — not ${shown(k)}`);
  return (key) => stored(o, key, `${who}: its ${key}`);
}

/** A number within [lo, hi] (each end open or closed), or the default when left out. */
export function num(v, { who, key, lo = -FAR, hi = FAR, open = '', fallback, unit = '' }) {
  if (v === undefined && fallback !== undefined) return fallback;
  const loOpen = open.includes('lo'), hiOpen = open.includes('hi');
  const above = loOpen ? v > lo : v >= lo, below = hiOpen ? v < hi : v <= hi;
  // "above 0 and up to 0.5", "from 0 and below 1", "from 0 to 1"
  const range = `${loOpen ? 'above' : 'from'} ${lo} ${loOpen || hiOpen ? 'and ' : ''}${hiOpen ? 'below' : loOpen ? 'up to' : 'to'} ${hi}`;
  if (!(near(v) && above && below)) refuse(`${who}: its ${key} is a number ${range}${unit} — not ${shown(v)}`);
  return v;
}

/** A point [x, y] on the frame (px), each index its own stored finite number; a new frozen pair. */
export function point(v, who, key) {
  const ok = Array.isArray(v) && v.length === 2;
  const xy = ok ? [0, 1].map((i) => { const d = Object.getOwnPropertyDescriptor(v, i); return d && 'value' in d ? d.value : undefined; }) : [];
  if (!(ok && near(xy[0]) && near(xy[1]))) refuse(`${who}: its ${key} is a point [x, y] in px, within ${FAR} of 0 — not ${shown(v)}`);
  return Object.freeze(xy);
}

/** A list of at most `most`, each index its own stored value (a hole refused); a new array. */
export function list(v, most, who, key, form) {
  if (!Array.isArray(v) || v.length > most) refuse(`${who}: its ${key} is a list of at most ${most} ${form} — not ${shown(v)}`);
  return Array.from({ length: v.length }, (_, i) => {
    const d = Object.getOwnPropertyDescriptor(v, i);
    if (!d || !('value' in d)) refuse(`${who}: its ${key}[${i}] is ${form} — a hole or a getter is never read`);
    return d.value;
  });
}

/** Who an entry is, in its own words ('blocks[2] ("ball")'), and its seeded numbers, from the context. */
export function readContext(context) {
  if (context === undefined || context === null) return { who: 'the entry', random: null };
  if (typeof context !== 'object' || Array.isArray(context)) refuse(`a plan's context is {who, random, frame}, or none — not ${shown(context)}`);
  const who = stored(context, 'who', "the context's who") ?? 'the entry', random = stored(context, 'random', "the context's random") ?? null;
  if (typeof who !== 'string' || !who.trim() || who.length > 200) refuse(`the context's who is the entry in its own words, 1 to 200 letters — not ${shown(who)}`);
  if (random !== null && typeof random !== 'function') refuse(`${who}: the context's random is a function giving numbers from 0 to 1 (seededRandom(text)) — not ${shown(random)}`);
  return { who, random };
}

/** Frozen all the way down: a plan or a sample is plain data a record keeps, and nobody edits it after. */
export function frozen(v) {
  if (v && typeof v === 'object' && !Object.isFrozen(v)) { for (const k of Object.keys(v)) frozen(v[k]); Object.freeze(v); }
  return v;
}

/**
 * Numbers from 0 to 1, the same for the same text: FNV-1a of the text, then mulberry32 — the rule the isometric
 * styles seed with (src/isometric/style.js · seeded), so a chain's wobble is the same in a deck and a film.
 */
export function seededRandom(text) {
  if (typeof text !== 'string') refuse(`seededRandom takes the text to seed from (the piece's name and the entry) — not ${shown(text)}`);
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return () => { h = (h + 0x6d2b79f5) >>> 0; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
