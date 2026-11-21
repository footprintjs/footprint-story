// differs/ — the rules a deck and a film share for a part that differs from the real thing. The differential test
// (shared-differential.property.test.js) holds them to the tools' own code; these pin the words and the refusals.
import test from 'node:test';
import assert from 'node:assert/strict';
import { timeWords, analogyWords, differsFactors, foldDiffers, timeProblem, differsStatements, differsLines, differsProblem, differsEnglish, DIFFERS_ANALOGY } from '../index.js';

test('the default words: time faster and slower, an analogy\'s label, the factors a label may write', () => {
  assert.equal(timeWords(30), 'Time shown 30 times faster');
  assert.equal(timeWords(0.04), 'Time shown 25 times slower');
  assert.equal(timeWords(2.555), 'Time shown 2.56 times faster');
  assert.equal(analogyWords('cars stand in for packets'), `${DIFFERS_ANALOGY}cars stand in for packets`);
  assert.deepEqual(differsFactors(30), [30, 30]);
  assert.deepEqual(differsFactors(0.04), [0.04, 25, 25]);
  assert.equal(foldDiffers('  two\n\tlines\u0007 here '), 'two lines here');
});

test('timeProblem: no factor, real time, past the range — else null', () => {
  for (const t of [0, -1, NaN, Infinity, '30', null, undefined]) assert.equal(timeProblem(t), 'not-a-factor');
  for (const t of [1, 1.004, 0.996]) assert.equal(timeProblem(t), 'real-time');
  for (const t of [2e9, 1e-10]) assert.equal(timeProblem(t), 'past-range');
  for (const t of [30, 0.04, 1.01, 0.99, 1e9]) assert.equal(timeProblem(t), null);
});

test('differsLines, differsStatements: in the order time, scale, analogy', () => {
  const d = { time: 30, scale: 'Dots drawn far larger', analogy: 'cars for packets' };
  assert.deepEqual(differsLines(d), ['Time shown 30 times faster', 'Dots drawn far larger', 'An analogy: cars for packets']);
  // a time a label cannot say is refused, never printed as "NaN times"
  for (const time of [NaN, 0, -2, Infinity]) assert.throws(() => differsLines({ time }), /differs: a declaration's time is a factor above 0/);
  assert.equal(differsStatements(d), 3);
  assert.deepEqual(differsLines({ scale: 'x' }), ['x']);
  assert.equal(differsStatements({}), 0);
});

test('differsProblem: said twice, unsaid, unstated, contradicts — in that order — or null', () => {
  assert.deepEqual(differsProblem({ time: 30 }, [], ['Thirty times!', 'thirty  times']), { problem: 'said-twice' });
  assert.deepEqual(differsProblem({ time: 30 }, [], null), { problem: 'unsaid' });
  assert.deepEqual(differsProblem({ time: 30, scale: 'x' }, ['a'], null), { problem: 'unstated', named: ['time', 'scale'], statements: 2, says: 1 });
  assert.deepEqual(differsProblem({ time: 30, scale: 'x', analogy: 'y' }, ['a', 'a'], ['b']), { problem: 'unstated', named: ['time', 'scale', 'an analogy'], statements: 3, says: 2 });
  assert.deepEqual(differsProblem({ time: 30 }, ['Shown 3 times faster'], null), { problem: 'contradicts', figure: '3' });
  assert.deepEqual(differsProblem({ time: 30, scale: 'x' }, ['30 times faster', 'drawn 5 times larger'], null), null);   // only the first line says the time
  assert.deepEqual(differsProblem({ time: 30, scale: 'x' }, ['Shown 3 faster'], ['the scale']), null);                   // one line beside a phrase cannot be told
  assert.deepEqual(differsProblem({ time: 1000 }, ['1,000 times faster', '1.000 fois plus vite'], null), null);          // a thousand, either way it is written
  assert.deepEqual(differsProblem({ time: 0.04 }, ['25 times slower'], null), null);
  assert.deepEqual(differsProblem({ time: 30 }, ['H2O, 30 times faster'], null), null);                                  // a digit inside a word is no figure
  assert.equal(differsProblem({ scale: 'x' }, ['x'], ['a']), null);
});

test('differsEnglish: the English default words a declaration in another language still shows', () => {
  const d = { time: 30, analogy: 'a' };
  assert.equal(differsEnglish(d, ['Time shown 30 times faster'], 'fr'), 'Time shown 30 times faster');
  assert.equal(differsEnglish(d, ['An analogy: a'], 'de'), 'An analogy: a');
  assert.equal(differsEnglish(d, ['Temps montré 30 fois plus vite'], 'fr'), null);
  for (const lang of [null, undefined, '', 'en', 'en-GB', 'EN']) assert.equal(differsEnglish(d, ['Time shown 30 times faster'], lang), null);
});

test('inputs are read by their own stored fields: a getter and an inherited field are refused by name, as is a hole', () => {
  let ran = false;
  const d = Object.defineProperty({}, 'time', { get() { ran = true; return 30; }, enumerable: true });
  assert.throws(() => differsLines(d), /^Error: differs: the declaration's time is read as a stored value, and this one is a getter \(code, never run\)/);
  assert.equal(ran, false);
  assert.throws(() => differsLines(Object.create({ scale: 'x' })), /the declaration's scale is the object's own field, and this one is inherited/);
  assert.deepEqual(differsLines(Object.create(null)), []);
  assert.throws(() => differsLines(null), /^Error: differs: a declaration is \{time\?, scale\?, analogy\?\} — not null/);
  assert.throws(() => differsLines([1]), /not a list/);
  assert.throws(() => differsStatements('x'), /not string/);
  assert.throws(() => differsProblem({}, 'x', null), /lines is a list of texts — not string/);
  assert.throws(() => differsProblem({}, null, null), /not null/);
  // eslint-disable-next-line no-sparse-arrays
  assert.throws(() => differsProblem({}, ['a', , 'b'], null), /lines\[1\] is a text — not missing/);
  assert.throws(() => differsProblem({}, ['a'], [3]), /phrases\[0\] is a text — not 3/);
  assert.throws(() => differsEnglish({}, Object.defineProperty(['a'], 0, { get: () => 'x' }), 'fr'), /lines\[0\] is read as a stored value, and this one is a getter/);
});

test('a time that is not a number, and a scale or analogy that is not words, are refused in differs\' words', () => {
  assert.throws(() => differsLines({ time: '30' }), /^Error: differs: the declaration's time is a number \(30; 0.04 is 25 times slower\) — not "30"/);
  assert.throws(() => timeWords('30'), /^Error: differs: a time factor is a number/);
  assert.throws(() => differsFactors(null), /a time factor is a number .* — not null/);
  assert.throws(() => differsProblem({ scale: 3 }, ['x'], null), /the declaration's scale is words — not 3/);
  assert.throws(() => differsEnglish({ analogy: ['a'] }, [], 'fr'), /the declaration's analogy is words — not a list/);
  assert.throws(() => analogyWords({}), /^Error: differs: an analogy is words — not an object/);
  assert.throws(() => foldDiffers(3), /^Error: differs: foldDiffers folds words — not 3/);
  assert.equal(timeWords(NaN), 'Time shown NaN times slower');   // a number is printed as the tools always printed it: timeProblem is what refuses it
});
