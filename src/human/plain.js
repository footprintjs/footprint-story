/**
 * Plain data, checked and frozen: what a model's plan and a sample may hold. WHY: a plan lands on a record and goes
 * from a deck to a film, so it must clone — a function, a getter, a Date or a cycle in it is refused here, naming the
 * model, rather than lost on the way.
 */
import { refuse, shown } from './read.js';

/** The most values one plan may hold, and how deep it may nest. */
export const MOST_PLAN_VALUES = 200000;
const DEEPEST = 16;

/** A deep, frozen copy of `v`, or a refusal naming `who` and where in it the fault is. */
export function plainCopy(v, who) {
  let count = 0;
  const seen = new Set();
  const copy = (x, where, depth) => {
    count += 1;
    if (count > MOST_PLAN_VALUES) refuse(`${who} gives more than ${MOST_PLAN_VALUES} values — keep a plan to the numbers sample() needs`);
    if (x === null || typeof x === 'boolean') return x;
    if (typeof x === 'number') { if (!Number.isFinite(x)) refuse(`${who} gives ${x} at ${where}: a plan holds finite numbers`); return x; }
    if (typeof x === 'string') { if (x.length > 4096) refuse(`${who} gives a text of ${x.length} letters at ${where}: at most 4096`); return x; }
    if (typeof x !== 'object') refuse(`${who} gives ${shown(x)} at ${where}: a plan is plain data (numbers, words, true/false, null, lists, objects) — it must clone onto a record`);
    if (depth > DEEPEST) refuse(`${who} nests deeper than ${DEEPEST} at ${where}`);
    if (seen.has(x)) refuse(`${who} gives a value that holds itself at ${where}: a plan is a tree`);
    const proto = Object.getPrototypeOf(x);
    if (!Array.isArray(x) && proto !== Object.prototype && proto !== null) refuse(`${who} gives a live object at ${where} (not a plain object or list) — give its numbers`);
    seen.add(x);
    const out = Array.isArray(x) ? [] : {};
    const keys = Array.isArray(x) ? Array.from({ length: x.length }, (_, i) => i) : Object.keys(x);
    for (const k of keys) {
      const d = Object.getOwnPropertyDescriptor(x, k);
      if (!d) refuse(`${who} gives a list with a hole at ${where}[${k}]`);
      if (!('value' in d)) refuse(`${who} gives a getter at ${where}.${k} (code, never run) — give the value`);
      // made as an own key, so a "__proto__" from JSON stays a key, never a prototype
      Object.defineProperty(out, k, { value: copy(d.value, Array.isArray(x) ? `${where}[${k}]` : `${where}.${k}`, depth + 1), enumerable: true, writable: true, configurable: true });
    }
    seen.delete(x);
    return Object.freeze(out);
  };
  return copy(v, 'its top', 0);
}
