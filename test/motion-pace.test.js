import test from 'node:test';
import assert from 'node:assert/strict';
import { PACES, readPace } from '../src/motion/pace.js';

test('the paces: a lesson may pause, a promo may not park', () => {
  assert.deepEqual(readPace(), { hold: 3, most: .5, still: .85, spare: 0 }, 'lesson by default: StoryReel\'s slideshow numbers');
  assert.deepEqual(readPace('promo'), { hold: .6, most: 0, still: .4, spare: 1 });
  assert.ok(PACES.promo.hold < PACES.lesson.hold && PACES.promo.still < PACES.lesson.still);
});

test('a pace of your own is checked; anything else refuses, naming the fix', () => {
  assert.deepEqual(readPace({ hold: 1.5, most: .2, still: .6 }), { hold: 1.5, most: .2, still: .6, spare: 0 });
  assert.throws(() => readPace('trailer'), /no pace called "trailer"; the paces are lesson, promo/);
  assert.throws(() => readPace({ hold: 0, most: .2, still: .6 }), /hold is the seconds a still stretch may last, above 0/);
  assert.throws(() => readPace({ hold: 1, most: 1, still: .6 }), /most is a share of the running time, 0 or more and below 1/);
  assert.throws(() => readPace({ hold: 1, most: .1, still: .6, cuts: 3 }), /a pace has no key cuts/);
});
