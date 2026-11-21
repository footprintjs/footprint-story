// The break rule as a named choice (0.22.0): `wrapWords` (footprint-story/layout) and `wordsToFit`
// (footprint-story/isometric) take `break: 'fill' | 'even'`. Three things are pinned here:
//   1. the usual rule of each is what it was — byte for byte against the CONTROLS: wordsToFit as 0.21.0 had it
//      (test/control/footprint-story-0.21.0-words.js) and StoryReel 0.33.0's balanced title lines for `'even'`;
//   2. wordsToFit's `'fill'` against an ORACLE written apart here (a plain walk, no prefix sums, no search);
//   3. the two doors take the same names (each door keeps its own list: a door may not import another's file).
// FC_RUNS=200000 npm test runs a deep sweep.
import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import * as wrap0 from './control/storyreel-0.33.0-wrap.mjs';
import * as words0 from './control/footprint-story-0.21.0-words.js';
import { wrapWords, BREAK_RULES } from '../layout.js';
import { wordsToFit } from '../isometric.js';

const RUNS = Number(process.env.FC_RUNS) || 2000;
/** What a call gives, or the words it refuses with. */
const outcome = (f) => { try { return { value: f() }; } catch (e) { return { error: e.message }; } };

// a face's measure that is not a sum of its words (a pair of letters kerns), as the shared differential has it
const measure = (text) => { let w = 0; for (let i = 0; i < text.length; i += 1) w += (text.charCodeAt(i) % 7) * 1.37 + 3.1 - (text[i] === text[i - 1] ? 0.45 : 0); return w; };
const ctx = { measureText: (text) => ({ width: measure(text) }) };
const wordOf = fc.stringMatching(/^[a-zA-Z0-9]{1,12}$/);
const text = fc.array(fc.oneof(wordOf, fc.constantFrom('', ' ', '\t', 'a', 'Supercalifragilistic', 'é', 'x\u{200B}y')), { maxLength: 14 }).map((w) => w.join(' '));
const width = fc.oneof(fc.double({ min: 0, max: 400, noNaN: true }), fc.integer({ min: 0, max: 400 }), fc.constantFrom(0, 50, 120, 1600));

// ── 1. the usual rules are what they were ────────────────────────────────────────────────────────────────────

test('wrapWords: no options, null and {break: \'fill\'} set the same lines; \'even\' sets StoryReel 0.33.0\'s balanced title lines', () => {
  fc.assert(fc.property(text, width, (t, w) => {
    const words = t.split(/\s+/).filter(Boolean), was = wrapWords(words, w, measure);
    assert.deepEqual(was, wrap0.wrap(ctx, words, w));
    assert.deepEqual(wrapWords(words, w, measure, null), was);
    assert.deepEqual(wrapWords(words, w, measure, {}), was);
    assert.deepEqual(wrapWords(words, w, measure, { break: 'fill' }), was);
    const even = wrapWords(words, w, measure, { break: 'even' });
    assert.deepEqual(even, wrap0.balancedLines(ctx, t, w));
    assert.equal(even.length, was.length);                    // as many lines as fill sets
    assert.equal(even.join(' '), was.join(' '));              // the same words, in order
  }), { numRuns: RUNS });
});

// names, rooms and options as the tools hand them: boxes and faces that narrow, counted and measured
const name = fc.tuple(fc.array(fc.oneof(fc.stringMatching(/^[a-zA-Z]{1,14}$/), fc.constantFrom('Load', 'Balancer', 'é', 'x\u{200B}y', 'Supercalifragilisticexpialidocious', '')), { maxLength: 9 }), fc.constantFrom(' ', '  ', '\t')).map(([w, gap]) => w.join(gap));
const room = fc.oneof(
  fc.tuple(fc.integer({ min: 1, max: 600 }), fc.integer({ min: 1, max: 200 })),
  fc.tuple(fc.double({ min: 0.5, max: 600, noNaN: true }), fc.double({ min: 0.5, max: 200, noNaN: true })),
  // a face that narrows: wide at its middle, narrower the taller the words stand
  fc.tuple(fc.integer({ min: 20, max: 500 }), fc.double({ min: 0, max: 4, noNaN: true })).map(([w, k]) => (high) => w - k * high));
const options = fc.oneof(
  fc.constant(undefined), fc.constant(null), fc.constant({}),
  fc.record({ size: fc.integer({ min: 16, max: 60 }), least: fc.integer({ min: 1, max: 16 }) }),
  fc.record({ letter: fc.double({ min: 0.3, max: 1, noNaN: true }), line: fc.double({ min: 0.8, max: 2, noNaN: true }) }),
  fc.constant({ measure: (w) => (w === ' ' ? 0.3 : w.length * 0.55 + (w.charCodeAt(0) % 3) * 0.1) }));

test('wordsToFit: the usual rule, and {break: \'even\'}, give every name what 0.21.0 gave it — the same lines, size and fits', () => {
  fc.assert(fc.property(name, room, options, (t, r, o) => {
    const was = outcome(() => words0.wordsToFit(t, r, o));
    assert.deepEqual(outcome(() => wordsToFit(t, r, o)), was);
    assert.deepEqual(outcome(() => wordsToFit(t, r, { ...(o ?? {}), break: 'even' })), was);
  }), { numRuns: RUNS });
});

// ── 2. fill, against an oracle ───────────────────────────────────────────────────────────────────────────────

/** wordsToFit's 'fill' written plainly: each size from the largest; one line if it fits; else the first line takes words while they fit. */
function fillOracle(t, r, o = {}) {
  const size = o.size ?? 26, least = o.least ?? 16, letter = o.letter ?? 0.6, line = o.line ?? 1.15;
  const words = t.split(/[ \t\n\r\f\v]+/).filter(Boolean);
  if (!words.length) return { lines: [], size, fits: true };
  const w = o.measure ? (s) => o.measure(s) : (s) => [...s.replace(/[\p{M}\p{Cf}]/gu, '')].length * letter;
  const space = o.measure ? o.measure(' ') : letter;
  const across = (list) => list.reduce((sum, s) => sum + w(s), 0) + space * (list.length - 1);
  const limit = (n, at) => {
    if (typeof r !== 'function') return n * line * at <= r[1] ? r[0] : -1;
    const v = r((n - 1) * line * at); return Number.isFinite(v) && v > 0 ? Math.min(v, 1e6) : 0;
  };
  let lines = [words.join(' ')];
  for (let at = size; ; at = Math.max(least, at - 1)) {
    if (across(words) * at <= limit(1, at)) return { lines: [words.join(' ')], size: at, fits: true };
    if (words.length > 1) {
      let k = 1;
      while (k < words.length - 1 && across(words.slice(0, k + 1)) * at <= limit(2, at)) k += 1;
      lines = [words.slice(0, k).join(' '), words.slice(k).join(' ')];
      if (Math.max(across(words.slice(0, k)), across(words.slice(k))) * at <= limit(2, at)) return { lines, size: at, fits: true };
    }
    if (at === least) return { lines, size: least, fits: false };
  }
}

const close = (a, b) => assert.ok(a.fits === b.fits && a.size === b.size && JSON.stringify(a.lines) === JSON.stringify(b.lines), `${JSON.stringify(a)} is not ${JSON.stringify(b)}`);

test('wordsToFit {break: \'fill\'}: the oracle\'s lines, size and fits, for every name, room and option', () => {
  // whole sizes, so a size counted down from `size` meets `least` exactly as the oracle's does
  const plain = fc.oneof(fc.constant({}), fc.record({ size: fc.integer({ min: 16, max: 60 }), least: fc.integer({ min: 1, max: 16 }) }), fc.constant({ measure: (w) => (w === ' ' ? 0.25 : w.length * 0.5) }));
  let apart = 0, runs = 0;
  fc.assert(fc.property(name, room, plain, (t, r, o) => {
    const fill = wordsToFit(t, r, { ...o, break: 'fill' });
    close(fill, fillOracle(t, r, o));
    runs += 1;
    if (JSON.stringify(fill) !== JSON.stringify(wordsToFit(t, r, o))) apart += 1;
  }), { numRuns: RUNS });
  // the generator reaches names where the two rules part, so the oracle is asked about fill's own breaks
  assert.ok(apart > runs / 20, `fill and even parted on ${apart} of ${runs} names`);
});

test('wordsToFit {break: \'fill\'}: a worked name — the first line as full as it goes, where even makes the two alike', () => {
  // 'aaaa bb cc dddd' is 15 letters: 234 px at 26, too wide for 200. Even breaks after 'bb' (7 and 7 letters);
  // fill takes 'aaaa bb cc' (10 letters, 156 px) and leaves 'dddd'.
  assert.deepEqual(wordsToFit('aaaa bb cc dddd', [200, 90]), { lines: ['aaaa bb', 'cc dddd'], size: 26, fits: true });
  assert.deepEqual(wordsToFit('aaaa bb cc dddd', [200, 90], { break: 'fill' }), { lines: ['aaaa bb cc', 'dddd'], size: 26, fits: true });
  // a first word too wide for the line still takes it, and the rest go beneath; the size falls to least and says so
  assert.deepEqual(wordsToFit('Supercalifragilistic is long', [100, 90], { break: 'fill' }), { lines: ['Supercalifragilistic', 'is long'], size: 16, fits: false });
  // one word: fill has nothing to break
  assert.deepEqual(wordsToFit('Queue', [50, 50], { break: 'fill' }), wordsToFit('Queue', [50, 50]));
  // the room is asked once for one line and once for two at each size, as it is under even
  const asked = [];
  wordsToFit('aaaa bb cc dddd', (high) => { asked.push(high); return 200; }, { break: 'fill' });
  assert.deepEqual(asked, [0, 1.15 * 26]);
});

test('wordsToFit {break: \'fill\'}: one line when even sets one; the whole name always; the second line never empty; what fits does fit', () => {
  fc.assert(fc.property(fc.array(fc.stringMatching(/^[a-z]{1,12}$/), { minLength: 1, maxLength: 8 }), fc.integer({ min: 20, max: 400 }), fc.integer({ min: 10, max: 200 }), (words, wide, high) => {
    const t = words.join(' '), fill = wordsToFit(t, [wide, high], { break: 'fill' }), even = wordsToFit(t, [wide, high]);
    assert.equal(fill.lines.join(' '), t);
    if (even.lines.length === 1 && even.fits) assert.deepEqual(fill, even);
    if (fill.lines.length === 2) assert.ok(fill.lines[1].length > 0 && fill.lines[0].length > 0);
    if (fill.fits) { for (const l of fill.lines) assert.ok(l.length * 0.6 * fill.size <= wide + 1e-9); assert.ok(fill.lines.length * 1.15 * fill.size <= high + 1e-9); }
    // fill is never smaller than even: both try the same sizes, and even's break is the best a size can have
    if (fill.fits) assert.ok(even.fits && even.size >= fill.size);
  }), { numRuns: RUNS });
});

// ── 3. the same names on both doors ──────────────────────────────────────────────────────────────────────────

test('the two doors take the same break names: each of BREAK_RULES on both, anything else refused by both', () => {
  assert.deepEqual([...BREAK_RULES].sort(), ['even', 'fill']);
  assert.ok(Object.isFrozen(BREAK_RULES));
  for (const rule of BREAK_RULES) {
    assert.ok(Array.isArray(wrapWords(['a', 'b'], 10, (s) => s.length, { break: rule })));
    assert.ok(wordsToFit('a b', [100, 100], { break: rule }).fits);
  }
  fc.assert(fc.property(fc.oneof(fc.string(), fc.constantFrom('Fill', 'EVEN', 'balanced', 'greedy', 0, 1, true, {}, [], 'fill ')), (bad) => {
    fc.pre(!BREAK_RULES.includes(bad));
    assert.throws(() => wrapWords(['a'], 10, (s) => s.length, { break: bad }), /wrapWords breaks by 'fill' or 'even' — not /);
    assert.throws(() => wordsToFit('a', [10, 10], { break: bad }), /wordsToFit breaks two lines by 'even' or 'fill' — not /);
  }), { numRuns: 500 });
});
