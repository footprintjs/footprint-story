// The differential properties of stopShort and cableWay, which moved here in 0.20.0 from StoryDeck 0.30.0
// (deck/cable.js · cableWay, deck/transforms.js · leadOf): a cable's points with the tip pulled back for its head, and
// its line rounded. The CONTROL is StoryDeck's code, copied and never edited but for an import and an export
// (test/control/storydeck-0.30.0-cableWay.js). For every cable StoryDeck could hand them, the door gives the way
// StoryDeck's copy gave — the same start, pieces, length and points along it — and a lead rounded from either end is
// the lead leadOf gave.
//
// What it refuses that StoryDeck's copy took, left out of the generator: a `back` below 0 (StoryDeck pulled none; it
// only ever passes 0 or the head's 14.4 px) and a `back` that is not a number.
// FC_RUNS=200000 npm test runs a deep sweep.
//
// The one difference, named: StoryReel 0.35.0 (kits/isometric/cables.mjs · cableOf) pulled the tip back at most half
// its last run, where StoryDeck pulls it back to 1 px short of that run's start. The last test shows where they part:
// a last run under twice the pull (28.8 px for a head); StoryReel 0.36.0 takes StoryDeck's rule from here.
import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import * as deck from './control/storydeck-0.30.0-cableWay.js';
import { CABLE, cableWay, rounded, stopShort } from '../isometric.js';

const RUNS = Number(process.env.FC_RUNS) || 2000;
const SHORT = CABLE.head * CABLE.headShort;
/** A way as data: what a tool draws and rides. */
const seen = (way) => ({ start: way.start, pieces: way.pieces, length: way.length, at: [0, 0.25, 0.5, 0.75, 1].map((t) => way.at(t)) });
const outcome = (f) => { try { return { way: seen(f()) }; } catch (e) { return { threw: true }; } };
const px = fc.double({ min: -2000, max: 4000, noNaN: true });
const point = fc.tuple(px, px);
/** A cable as a map lays one: a route's points on the frame, with its last run sometimes very short (where the pull is capped). */
const cable = fc.record({
  points: fc.tuple(fc.array(point, { minLength: 1, maxLength: 12 }), fc.double({ min: 0, max: 60, noNaN: true }), fc.double({ min: 0, max: 2 * Math.PI, noNaN: true }))
    .map(([list, last, angle]) => [...list, [list.at(-1)[0] + last * Math.cos(angle), list.at(-1)[1] + last * Math.sin(angle)]]),
  radius: fc.oneof(fc.constant(undefined), fc.double({ min: 0, max: 80, noNaN: true })),
}, { requiredKeys: ['points'] });
const back = fc.oneof(fc.constant(0), fc.constant(SHORT), fc.double({ min: 0, max: 200, noNaN: true }));

test('cableWay gives StoryDeck 0.30.0\'s way for every cable and pull it could be handed', () => {
  fc.assert(fc.property(cable, back, (c, b) => {
    assert.deepEqual(outcome(() => cableWay(c, b)), outcome(() => deck.cableWay(c, b)));
  }), { numRuns: RUNS });
});

test('a lead rounded from either end on stopShort\'s points is StoryDeck 0.30.0\'s leadOf', () => {
  fc.assert(fc.property(cable, back, fc.constantFrom(0, 1), fc.constantFrom(2, 3), (c, b, k, count) => {
    const ends = [{ seen: true, count }, { seen: true, count }], radius = c.radius ?? 0;
    const toEnd = k ? [...c.points] : [...c.points].reverse();   // StoryDeck's leadOf as it is written from 0.30.1
    const mine = () => { const way = rounded((b ? stopShort(toEnd, b) : toEnd).reverse(), radius); return way; };
    const theirs = () => deck.leadOf({ points: c.points, radius, ends }, k, b).way;
    assert.deepEqual(outcome(mine), outcome(theirs));
  }), { numRuns: RUNS });
});

test('where StoryReel 0.35.0 parted from it: a last run shorter than twice the pull', () => {
  const points = [[0, 0], [200, 0], [200, 20]];   // a head on a last run of 20 px
  const tip = cableWay({ points, radius: 30 }, SHORT).at(1);
  assert.equal(tip[0], 200);
  assert.ok(Math.abs(tip[1] - (20 - SHORT)) < 1e-9, `StoryDeck's rule: the whole pull, 14.4 px, since the run is longer than that and 1 px (${tip})`);
  // StoryReel 0.35.0's cableOf pulled back at most half the run: its line ran on to [200, 10], 4.4 px nearer the tip, under the head
  assert.ok(tip[1] < 10);
  assert.deepEqual(cableWay({ points: [[0, 0], [200, 0], [200, 10]], radius: 30 }, SHORT).at(1), [200, 1], 'a run shorter than the pull keeps 1 px of line');
  assert.deepEqual(cableWay({ points, radius: 30 }, SHORT * 2).at(1), cableWay({ points, radius: 30 }, 19).at(1), 'never past 1 px short of the run\'s start');
});
