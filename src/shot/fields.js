/**
 * Fields: reading numbers and names that may come from anyone, keeping every problem so one answer can name everything to
 * fix. Names reach text a model reads, so hidden characters never survive reading them. Own properties only; a key it does
 * not know is a problem, so a misspelt word is never silently ignored.
 */
const HIDDEN = /[\p{Cc}\p{Cf}\p{Cs}\p{Co}\p{Zl}\p{Zp}\p{Default_Ignorable_Code_Point}\p{Noncharacter_Code_Point}\p{Variation_Selector}\u2800]/gu;
const QUOTES = /[\p{Pi}\p{Pf}"\uFF02\u201A\u201E\u301D-\u301F]/gu, SEEN = /[\p{L}\p{N}\p{S}\p{P}]/u, UNIT = /^[\p{L}\p{M}]+$/u;
const MOST_NAME = 64, MOST_RAW = 1024, MOST_KEY = 40, MOST_PROBLEMS = 40, LEAST_LENGTH = 1e-30;

/** How far from the origin anything may stand: past this, squares lose the digits the maths needs. */
export const FAR = 1e9;
/** The most things a scene or a shot may hold. */
export const MOST_THINGS = 256;

/** A name as a model may read it: no hidden characters, one space at a time, no quote of any kind to close the quote around it. */
export const cleanName = (text) => text.replace(/\s+/gu, ' ').replace(HIDDEN, '').normalize('NFC').replace(QUOTES, "'").replace(/ +/g, ' ').trim();

/** The first `most` characters whole: an emoji is never cut in two. */
export const cutName = (text, most) => [...text].slice(0, most).join('');

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const join = (at, key) => (at ? `${at}.${key}` : key);

/** A reader with its own list of problems, each {at, message}: `at` is the place in the data, as it is written. */
export function fieldReader() {
  const problems = [];
  const say = (at, message) => { problems.push({ at, message }); return null; };
  const number = (v, at, { least = -FAR, most = FAR, above = false } = {}) => {
    if (typeof v !== 'number' || !Number.isFinite(v)) return say(at, `must be a finite number from ${least} to ${most}`);
    if (v > most || v < least || (above && v === least)) return say(at, `is ${v}: it must be ${above ? 'above' : 'at least'} ${least} and at most ${most}`);
    return v;
  };
  return {
    problems,
    say,
    number,
    /** A copy holding only its own `keys`, each read once; null when it is not an object. */
    object(value, at, keys) {
      if (!isObject(value)) return say(at || 'it', `must be an object with ${keys.join(', ')}`);
      const own = Object.create(null);
      for (const key of Object.keys(value)) {
        if (keys.includes(key)) own[key] = value[key];
        else say(join(at, cutName(cleanName(key.slice(0, MOST_RAW)), MOST_KEY)), `is not a field here (the fields are ${keys.join(', ')})`);
      }
      return own;
    },
    /** A name with hidden characters gone; null with a problem when nothing is left, or too much. */
    name(v, at, { most = MOST_NAME } = {}) {
      if (typeof v !== 'string') return say(at, 'must be a name, as text');
      if (v.length > MOST_RAW) return say(at, `is ${v.length} characters: a name is at most ${most}`);
      const clean = cleanName(v);
      if (!SEEN.test(clean)) return say(at, 'must have something in it that can be seen');
      return clean.length > most ? say(at, `is ${clean.length} characters: a name is at most ${most}`) : clean;
    },
    /** A length that may be 0: smaller than this and its square is lost, so it must be written in larger units. */
    length(v, at, range) {
      const n = number(v, at, range);
      return n !== null && n !== 0 && n < LEAST_LENGTH ? say(at, `is ${n}, too small to work with: use larger units`) : n;
    },
    /** A unit is letters only: it stands in a line a model reads, so it must not be able to write that line. */
    unit(v, at, most) {
      const clean = this.name(v, at, { most });
      return clean && !UNIT.test(clean) ? say(at, 'must be letters only, such as m or cm') : clean;
    },
    /** A list of `length` numbers; null with a problem when it is not one, or holds a bad number. */
    numbers(v, at, length, range, shape) {
      if (!Array.isArray(v) || v.length !== length) return say(at, `must be ${shape}`);
      const out = [];
      for (let i = 0; i < length; i++) out.push(number(v[i], `${at}[${i}]`, range));
      return out.includes(null) ? null : out;
    },
  };
}

/** A point in the scene. */
export const pointOf = (f, v, at) => f.numbers(v, at, 3, {}, 'three numbers [x, y, z]');

/** What reading finds, never stopping for what it was given: {value, problems}. `value` only when there are no problems. */
export function readAll(read) {
  const f = fieldReader();
  let value = null;
  try { value = read(f); } catch { f.say('it', 'could not be read: it must be plain data'); }
  const { problems } = f;
  const short = problems.length > MOST_PROBLEMS ? [...problems.slice(0, MOST_PROBLEMS), { at: '', message: `and ${problems.length - MOST_PROBLEMS} more: fix these first` }] : problems;
  return problems.length ? { value: null, problems: short } : { value, problems: [] };
}

/** The value, or a refusal listing every problem; `what` says what was being read. */
export function orRefuse({ value, problems }, what) {
  if (!problems.length) return value;
  const list = problems.map((p) => `${p.at ? `${p.at} ` : ''}${p.message}`);
  throw Object.assign(new TypeError(`this ${what} has ${list.length} problem${list.length === 1 ? '' : 's'}:\n- ${list.join('\n- ')}`), { problems });
}

/** What a reader hands out is never edited by whoever draws it. */
export function deepFreeze(value) {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const v of Object.values(value)) deepFreeze(v);
    Object.freeze(value);
  }
  return value;
}
