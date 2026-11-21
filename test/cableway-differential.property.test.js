// The differential properties of stopShort and cableWay, which moved here in 0.20.0 from StoryDeck 0.30.0
// (deck/cable.js · cableWay, deck/transforms.js · leadOf): a cable's points with the tip pulled back for its head, and
// its line rounded. The CONTROL is StoryDeck's code, copied and never edited but for an import and an export
// (test/control/storydeck-0.30.0-cableWay.js). For every cable StoryDeck could hand them, the door gives the way
// StoryDeck's copy gave — the same start, pieces, length and points along it — and a lead rounded from either end is
// the lead leadOf gave, and cableLead's lead and its length are leadOf's and piecesLength's (0.21.0).
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
import * as rides0 from './control/storydeck-0.29.0-rides.js';
import { CABLE, cableLead, cableWay, rounded, stopShort } from '../isometric.js';

const RUNS = Number(process.env.FC_RUNS) || 2000;
const SHORT = CABLE.head * CABLE.headShort;
/** A way as data: what a tool draws and rides. */
const seen = (way) => ({ start: way.start, pieces: way.pieces, length: way.length, at: [0, 0.25, 0.5, 0.75, 1].map((t) => way.at(t)) });
/** A number as a page or a canvas draws it: -0 and 0 are one place (StoryDeck's pull gave +0 where this gives -0, on a run under 1 px). */
const flat = (v) => (typeof v === 'number' ? v + 0 : Array.isArray(v) ? v.map(flat) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, flat(x)])) : v);
const outcome = (f) => { try { return flat({ way: seen(f()) }); } catch (e) { return { threw: true }; } };
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

/**
 * The lead by an oracle of its own: the way rounded only as far as the point after the floor point (the floor
 * point's corner is rounded by its two runs alone, so it is the same corner), all its pieces but the last — or the
 * whole way when the floor point is its last. Nothing for a port on its floor point.
 */
function leadOracle(points, radius, k, count, b) {
  const run = k ? [...points] : [...points].reverse(), from = (b ? stopShort(run, b) : run).reverse();
  const floor = from[count - 1], same = (p, q) => p[0] === q[0] && p[1] === q[1];
  if (from.slice(0, count - 1).every((p) => same(p, floor))) return { pieces: [], length: 0 };
  const next = from.findIndex((p, i) => i >= count && !same(p, floor));
  const pieces = next < 0 ? rounded(from, radius).pieces : rounded(from.slice(0, next + 1), radius).pieces.slice(0, -1);
  return { pieces, length: rides0.piecesLength(from[0], pieces) };
}

test('cableLead is StoryDeck\'s lead (0.30.0 leadOf, 0.29.0 piecesLength) wherever StoryDeck\'s lead ended at its floor point, and the oracle\'s everywhere', () => {
  // The one difference, named: StoryDeck counted the lead's pieces (2 for a port on the floor's level, 4 with a riser)
  // where cableLead finds the floor point by its place. Where a count ran past the floor point — a riser too short for
  // a run between its two corners (rounded leaves out a run of no length), or a floor point that is no corner —
  // StoryDeck's lead took in a piece of the floor run past it; there cableLead ends at the floor point.
  const same = (p, q) => p[0] === q[0] && p[1] === q[1];
  let agreed = 0;
  fc.assert(fc.property(cable, back, fc.constantFrom(0, 1), fc.constantFrom(2, 3), (c, b, k, count) => {
    fc.pre(c.points.length >= count);
    const radius = c.radius ?? 0, ends = [{ seen: true, count }, { seen: true, count }];
    let theirs;
    try { theirs = deck.leadOf({ points: c.points, radius, ends }, k, b); } catch { assert.throws(() => cableLead({ points: c.points, radius }, k, count, b)); return; }
    const mine = cableLead({ points: c.points, radius }, k, count, b);
    assert.deepEqual(flat(seen(mine.way)), flat(seen(theirs.way)), 'the way is StoryDeck\'s');
    const oracle = leadOracle(c.points, radius, k, count, b);
    assert.deepEqual(flat({ pieces: mine.pieces, length: mine.length }), flat(oracle), 'the lead is the oracle\'s');
    assert.deepEqual(mine.pieces, theirs.pieces.slice(0, mine.pieces.length), 'a lead StoryDeck\'s count began');
    const run = k ? c.points : [...c.points].reverse(), floor = run[run.length - count], last = theirs.pieces.at(-1);
    if (mine.pieces.length === theirs.pieces.length && (last.corner ? same(last.corner, floor) : same(last.to, floor))) {
      agreed += 1;
      assert.equal(flat(mine.length), flat(rides0.piecesLength(theirs.way.start, theirs.pieces)), 'and its length is piecesLength\'s');
    }
  }), { numRuns: RUNS });
  assert.ok(agreed > RUNS / 4, `most leads end at their floor point in StoryDeck's count too (${agreed} of ${RUNS})`);
});

test('a lead ends at its floor point by place, not where the path passes it again', () => {
  // the floor point's coordinates come up earlier on this way (as a corner's start): found by coordinates, the lead would stop there
  const lead = cableLead({ points: [[45, 7.5], [45, 30], [45, 45], [30, 45], [30, 30], [45, 37.5]], radius: 100 }, 0, 6);
  assert.equal(lead.pieces.at(-1).to.join(), '45,37.5', 'it runs to the floor point, the last');
  assert.ok(lead.length > 60, `the whole way: ${lead.length} px`);
});

test('the difference from StoryDeck, worked: a riser too short for a run between its corners', () => {
  // a port 6 px out of its side and 4.2 px above the floor, then 500 px along the floor: StoryDeck's four pieces ran
  // past the floor point's corner (the run between the two corners has no length, so rounded left it out) to the far corner
  const points = [[68, 513.3], [80, 519.3], [80, 523.5], [524, 745.5], [1285.3, 364.8]], ends = [{ seen: true, count: 3 }, null];
  const theirs = deck.leadOf({ points, radius: 21.5, ends }, 0, 0), mine = cableLead({ points, radius: 21.5 }, 0, 3);
  assert.ok(rides0.piecesLength(theirs.way.start, theirs.pieces) > 400, 'StoryDeck\'s lead ran on along the floor');
  assert.deepEqual(mine.pieces.at(-1).corner, [80, 523.5], 'here it ends at the floor point\'s corner');
  assert.ok(mine.length < 30, `out of the port, down its riser, through the corner: ${mine.length} px`);
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
