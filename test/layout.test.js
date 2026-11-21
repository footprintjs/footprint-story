// layout/ — framing a box and breaking words across a width. The differential test (shared-differential.property.test.js)
// holds them to the tools' own code; these pin the rule and the refusals.
import test from 'node:test';
import assert from 'node:assert/strict';
import { frameZoom, wrapWords, narrowestWidth, NARROWEST_STEPS } from '../layout.js';

test('frameZoom: contained, then the share, then held between least and most', () => {
  assert.equal(frameZoom([400, 200], [1600, 900]), 4);                                    // 1600/400 = 4 across, 900/200 = 4.5 up: the smaller
  assert.equal(frameZoom([400, 200], [1600, 900], { share: 0.7, least: 1, most: 2.5 }), 2.5);
  assert.equal(frameZoom([4000, 100], [1600, 900], { share: 0.5, least: 1 }), 1);
  assert.equal(frameZoom([4000, 100], [1600, 900], { share: 0.5 }), 0.2);
  assert.equal(frameZoom([0, 0], [1600, 900], { smallest: 1, most: 3 }), 3);               // a point counts as 1 px
  assert.equal(frameZoom([0, 10], [1600, 900]), 90);                                       // no smallest: a line's width of 0 contains nothing across
  assert.ok(Number.isNaN(frameZoom([10, 10], [100, 100], { share: NaN })));                // a NaN in is a NaN out
  assert.equal(frameZoom([10, 10], [100, 100], null), 10);
});

test('frameZoom refuses what is not a number, and reads its options by their own stored fields', () => {
  assert.throws(() => frameZoom([1], [2, 2]), /^Error: layout: the box is \[wide, high\], two numbers — not a list/);
  assert.throws(() => frameZoom([1, '2'], [2, 2]), /the box is/);
  assert.throws(() => frameZoom([1, 2], 'room'), /the room is \[wide, high\], two numbers — not "room"/);
  // eslint-disable-next-line no-sparse-arrays
  assert.throws(() => frameZoom([1, 2], [2, ,]), /the room is/);
  assert.throws(() => frameZoom([1, 2], [2, 2], [1]), /options as \{share, least, most, smallest\}, or none — not a list/);
  assert.throws(() => frameZoom([1, 2], [2, 2], 3), /not 3/);
  assert.throws(() => frameZoom([1, 2], [2, 2], { share: '0.7' }), /share is a number — not "0.7"/);
  assert.throws(() => frameZoom([1, 2], [2, 2], Object.defineProperty({}, 'most', { get: () => 2 })), /most is read as a stored value, and this one is a getter/);
  assert.equal(frameZoom([1, 1], [2, 2], Object.create({ share: 100 })), 2);                // an inherited option is not the caller's
  assert.throws(() => frameZoom([1, 1], [2, 2], { least: null }), /least is a number — not null/);
  assert.throws(() => frameZoom([1, 1], [2, 2], { smallest: {} }), /not an object/);
});

const measure = (text) => text.length * 10;

test('wrapWords: first fit, measured whole; a word too wide has a line to itself; an empty word joins as written', () => {
  assert.deepEqual(wrapWords(['Hello', 'there', 'world'], 110, measure), ['Hello there', 'world']);
  assert.deepEqual(wrapWords(['Supercalifragilistic', 'a'], 50, measure), ['Supercalifragilistic', 'a']);
  assert.deepEqual(wrapWords([], 50, measure), ['']);                                      // no words: one empty line, as documented
  assert.deepEqual(wrapWords(['a', '', 'b'], 30, measure), ['a ', 'b']);                   // 'a ' fits; 'a  b' does not
  assert.deepEqual(wrapWords(['', 'b'], 30, measure), ['b']);                              // a line still empty takes the next word
  assert.deepEqual(wrapWords(['a', 'b'], Infinity, measure), ['a b']);
});

test('wrapWords refuses what it cannot read; what measure throws is the caller\'s own', () => {
  assert.throws(() => wrapWords('a b', 10, measure), /^Error: layout: wrapWords takes the words as a list of texts — not "a b"/);
  assert.throws(() => wrapWords(['a'], '10', measure), /width as a number — not "10"/);
  assert.throws(() => wrapWords(['a'], 10, null), /measures a line with a function \(text\) => width — not null/);
  assert.throws(() => wrapWords(['a', 3], 10, measure), /word 2 is a text — not 3/);
  // eslint-disable-next-line no-sparse-arrays
  assert.throws(() => wrapWords(['a', , 'c'], 10, measure), /word 2 is a text — not missing/);
  assert.throws(() => wrapWords(Object.defineProperty(['a'], 0, { get: () => 'x' }), 10, measure), /word 1 is read as a stored value, and this one is a getter/);
  assert.throws(() => wrapWords(['a'], NaN, measure), /width as a number — not NaN/);
  for (const bad of [NaN, -1, Infinity, '3', undefined]) assert.throws(() => wrapWords(['a', 'b'], 10, () => bad), /measure gives a line's width, a finite number from 0 — not .* for "a b"/);
  assert.throws(() => wrapWords(['a', 'b'], 10, () => { throw new Error('mine'); }), /^Error: mine$/);
});

test('narrowestWidth: halves NARROWEST_STEPS times and gives the upper end', () => {
  assert.equal(NARROWEST_STEPS, 12);
  const words = ['one', 'two', 'three', 'four'], lines = wrapWords(words, 150, measure);
  assert.deepEqual(lines, ['one two three', 'four']);
  const w = narrowestWidth(150, lines.length, (at) => wrapWords(words, at, measure).length);
  assert.deepEqual(wrapWords(words, w, measure), ['one two', 'three four']);                // balanced: no word left alone
  let asked = 0;
  narrowestWidth(100, 1, () => { asked += 1; return 1; });
  assert.equal(asked, NARROWEST_STEPS);
  assert.equal(narrowestWidth(100, 1, () => 1), 100 / 4096);
  assert.throws(() => narrowestWidth('1', 1, () => 1), /^Error: layout: narrowestWidth takes the width and the line count as numbers/);
  assert.throws(() => narrowestWidth(NaN, 1, () => 1), /as numbers — not NaN and 1/);
  assert.throws(() => narrowestWidth(10, NaN, () => 1), /as numbers — not 10 and NaN/);
  assert.throws(() => narrowestWidth(Infinity, 1, () => 1), /as numbers/);
  assert.throws(() => narrowestWidth(1, 1, 1), /counts lines with a function \(width\) => lines — not 1/);
});
