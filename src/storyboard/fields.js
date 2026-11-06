/**
 * Fields: reading plain data a person or a model wrote, keeping every problem instead of stopping at the first, so one
 * answer can name everything to fix. Reads own properties only. A key it does not know is a problem, naming the keys
 * there are, so a misspelt name is never silently ignored.
 */
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const join = (at, key) => (typeof key === 'number' ? `${at}[${key}]` : at ? `${at}.${key}` : key);

/** A reader with its own list of problems, each {at, message}: `at` is the place in the data, as it is written. */
export function fieldReader() {
  const problems = [];
  const say = (at, message) => { problems.push({ at, message }); return null; };
  return {
    problems,
    say,
    /** `value` as an object holding only `keys`, or null when it is not one. */
    object(value, at, keys) {
      if (!isObject(value)) return say(at, `must be an object with ${keys.join(', ')}`);
      for (const key of Object.keys(value)) if (!keys.includes(key)) say(join(at, key), `is not a field here (the fields are ${keys.join(', ')})`);
      return value;
    },
    /** A field's text, trimmed; null when it is missing and may be, or wrong. Never longer than `most`. */
    text(parent, key, at, { most, optional = false } = {}) {
      const place = join(at, key), v = parent && Object.hasOwn(parent, key) ? parent[key] : undefined;
      if (v === undefined) return optional ? null : say(place, 'is missing');
      if (typeof v !== 'string' || !v.trim()) return say(place, 'must be text with something in it');
      if (v.trim().length > most) return say(place, `is ${v.trim().length} characters, and ${most} is the most it may be: shorten it`);
      return v.trim();
    },
    /** A field's list, between `least` and `most` long; empty when it is wrong (the problem is kept). */
    list(parent, key, at, { least = 0, most, optional = false } = {}) {
      const place = join(at, key), v = parent && Object.hasOwn(parent, key) ? parent[key] : undefined;
      if (v === undefined) { if (!optional) say(place, 'is missing'); return []; }
      if (!Array.isArray(v)) { say(place, 'must be a list'); return []; }
      if (v.length < least) say(place, `has ${v.length}, and it needs at least ${least}`);
      if (v.length > most) { say(place, `has ${v.length}, and ${most} is the most it may have`); return v.slice(0, most); }
      return v;
    },
  };
}

/** A deep copy's freeze: what a reader hands out is never edited by whoever draws it. */
export function deepFreeze(value) {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const v of Object.values(value)) deepFreeze(v);
    Object.freeze(value);
  }
  return value;
}
