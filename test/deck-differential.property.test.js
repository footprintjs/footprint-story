// The differential properties of the helpers that moved here from StoryDeck 0.27.0: the ride of a packet
// (motion/ride.js), where a way doubles back (isometric/hairpins.js), the floor under a box and whether a way passes
// through one (isometric/under.js), where a floor's label lies (isometric/floorLabel.js) and placing by group
// (isometric/groups.js). The CONTROLS are that code, copied and never edited but for an import (test/control/README.md).
// For every input StoryDeck gave them the door gives what the control gave — the same numbers, the same words. The one
// change on purpose: floorUnder answers a box it has no floor for with a reason (NO_UNDER) where the control threw the
// deck's sentence, so the deck words it; the property maps one to the other. FC_RUNS=200000 npm test runs a deep sweep.
import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import * as ride0 from './control/storydeck-0.27.0-ride.js';
import * as hairpins0 from './control/storydeck-0.27.0-hairpins.js';
import * as keep0 from './control/storydeck-0.27.0-keepClear.js';
import * as label0 from './control/storydeck-0.27.0-floorLabel.js';
import * as groups0 from './control/storydeck-0.27.0-groups.js';
import { rideSeconds, speedAt, rideProfile, withHold, showStops, hiddenRamps } from '../motion.js';
import { arrange, arrangeByGroup, crossesBox, floorLabelPlace, floorUnder, hairpins, isometric, routes, NO_UNDER, GROUP_MARGIN, UNDER_CELL } from '../isometric.js';

const RUNS = Number(process.env.FC_RUNS) || 2000;
/** What a call gives, or the words it refuses with: the two must agree on both. */
const outcome = (f) => { try { return { value: f() }; } catch (e) { return { error: e.message }; } };
const same = (a, b) => assert.deepEqual(outcome(a), outcome(b));

const end = fc.oneof(fc.constant(0), fc.double({ min: 0, max: 0.5, noNaN: true }), fc.constantFrom(0.5, 0.15, 0.2, 1e-9));
const ease = fc.tuple(end, end);
// lengths past any frame too (a wire through the air may be written 3,000,000,000 px long), and speeds past any run
const length = fc.oneof(fc.constant(0), fc.double({ min: 0, max: 6000, noNaN: true }), fc.integer({ min: 1, max: 4096 }), fc.constantFrom(1e7, 2999999985.6, 1e300), fc.double({ min: 1e9, max: 1e15, noNaN: true }));
const speed = fc.oneof(fc.double({ min: 0.01, max: 5000, noNaN: true }), fc.integer({ min: 1, max: 2000 }), fc.constantFrom(2e9, 1e300, 1e-300));
const share = fc.oneof(fc.double({ min: 1e-6, max: 1.5, noNaN: true }), fc.constant(1));

test('ride: rideSeconds, speedAt, rideProfile, withHold, showStops give what StoryDeck 0.27.0 gave, number for number', () => {
  // where StoryDeck's answer could be counted it is the same; where it could not (Infinity), the door refuses in words
  fc.assert(fc.property(length, speed, ease, (l, s, e) => { const was = ride0.rideSeconds(l, s, e); if (Number.isFinite(was)) assert.equal(rideSeconds(l, s, e), was); else assert.throws(() => rideSeconds(l, s, e), /takes longer than can be counted/); }), { numRuns: RUNS });
  fc.assert(fc.property(fc.double({ min: -1, max: 2, noNaN: true }), ease, (p, e) => assert.equal(speedAt(p, e), ride0.speedAt(p, e))), { numRuns: RUNS });
  fc.assert(fc.property(ease, length, (e, l) => assert.deepEqual(rideProfile(e, l), ride0.rideProfile(e, l))), { numRuns: RUNS });
  fc.assert(fc.property(ease, length, share, (e, l, sh) => { const stops = ride0.rideProfile(e, l); assert.deepEqual(withHold(stops, sh), ride0.withHold(stops, sh)); }), { numRuns: RUNS });
  fc.assert(fc.property(share, fc.option(fc.boolean(), { nil: undefined }), (sh, e) => assert.deepEqual(showStops(sh, e === undefined ? undefined : { end: e }), ride0.showStops(sh, e === undefined ? undefined : { end: e }))), { numRuns: RUNS });
  // the defaults, left out
  assert.deepEqual([rideProfile(), showStops(), rideSeconds(300, 300), speedAt(0.5)], [ride0.rideProfile(), ride0.showStops(), ride0.rideSeconds(300, 300), ride0.speedAt(0.5)]);
});

test('ride: hiddenRamps gives what StoryDeck 0.27.0 gave, for any stretches, speeds and options', () => {
  const stretch = (l) => fc.tuple(fc.double({ min: -100, max: l + 100, noNaN: true }), fc.double({ min: -100, max: l + 100, noNaN: true })).map(([a, b]) => (a < b ? [a, b] : [b, a]));
  const options = fc.option(fc.record({ frames: fc.integer({ min: 1, max: 6 }), fps: fc.constantFrom(24, 30, 60), least: fc.double({ min: 0, max: 5, noNaN: true }), radius: fc.double({ min: 0, max: 12, noNaN: true }) }, { requiredKeys: [] }), { nil: undefined });
  fc.assert(fc.property(fc.oneof(fc.constant(0), fc.double({ min: 0, max: 3000, noNaN: true }), fc.constantFrom(2999999985.6, 1e300)).chain((l) => fc.tuple(fc.constant(l), fc.array(stretch(l), { maxLength: 6 }))), fc.oneof(fc.constant(0), speed, fc.constant(1e300)), ease, options, ([l, unseen], s, e, o) => {
    assert.deepEqual(hiddenRamps(unseen, l, s, e, o), ride0.hiddenRamps(unseen, l, s, e, o));
  }), { numRuns: RUNS });
});

// a way as a router lays one: square turns on a fine lattice, now and then a riser, a jog, a step back
const step = fc.tuple(fc.constantFrom([1, 0], [-1, 0], [0, 1], [0, -1]), fc.oneof(fc.constantFrom(0.05, 0.25, 0.5, 1, 2, 3), fc.double({ min: 0.01, max: 6, noNaN: true })), fc.constantFrom(0, 0, 0, 0.3));
const path = fc.tuple(fc.tuple(fc.integer({ min: -20, max: 20 }), fc.integer({ min: -20, max: 20 })), fc.array(step, { maxLength: 12 })).map(([[c, r], steps]) => {
  const out = [[c / 4, r / 4, 0]];
  for (const [[dc, dr], len, h] of steps) { const [pc, pr] = out.at(-1); out.push([pc + dc * len, pr + dr * len, h]); }
  return out;
});
const ports = fc.oneof(fc.constant([]), fc.tuple(fc.constantFrom(null, 'p1', ''), fc.constantFrom(null, 'rj45')));

test('hairpins: says where a way doubles back as StoryDeck 0.27.0 said it — random ways, and the router\'s own', () => {
  fc.assert(fc.property(path, ports, (p, ends) => assert.deepEqual(hairpins(p, ends), hairpins0.hairpins(p, ends))), { numRuns: RUNS });
  // the router's ways between ports on random places
  const placed = fc.tuple(fc.integer({ min: 0, max: 8 }), fc.integer({ min: 0, max: 8 }), fc.constantFrom('right', 'left', 'back-left', 'back-right'), fc.constantFrom('right', 'left', 'back-left', 'back-right'));
  fc.assert(fc.property(placed, ([c, r, fa, fb]) => {
    const port = (face) => ({ right: [2, 1, 0.3], left: [1, 2, 0.3], 'back-left': [0, 1, 0.3], 'back-right': [1, 0, 0.3] })[face];
    const things = [{ name: 'a', at: [0, 0], size: [2, 2, 1], ports: [{ name: 'p', at: port(fa) }] }, { name: 'b', at: [c + 3, r], size: [2, 2, 1], ports: [{ name: 'q', at: port(fb) }] }];
    const [route] = routes(things, [[{ thing: 'a', port: 'p' }, { thing: 'b', port: 'q' }]]);
    if (route.points) assert.deepEqual(hairpins(route.path, route.ports), hairpins0.hairpins(route.path, route.ports));
  }), { numRuns: Math.min(RUNS, 300) });
});

const grid = fc.tuple(fc.oneof(fc.integer({ min: 12, max: 100 }).map((n) => n * 2), fc.tuple(fc.integer({ min: 40, max: 200 }), fc.integer({ min: 20, max: 39 }))), fc.integer({ min: -500, max: 2500 }), fc.integer({ min: -500, max: 1500 })).map(([tile, ox, oy]) => isometric({ tile, origin: [ox, oy] }));

test('floorUnder: the floor under a box is what StoryDeck 0.27.0 found; a box it found none for is the same reason, given', () => {
  const box = fc.record({ x: fc.double({ min: -3000, max: 5000, noNaN: true }), y: fc.double({ min: -3000, max: 4000, noNaN: true }), w: fc.double({ min: 0.5, max: 500, noNaN: true }), h: fc.double({ min: 0.5, max: 300, noNaN: true }) });
  // what a page's style can parse to as well: NaN (left:1.2.3px) and Infinity (a number of 400 digits) — far, as before
  const far = fc.record({ x: fc.constantFrom(2e6, -2e6, 0, NaN, Infinity, 1e400), y: fc.constantFrom(0, 999_990, -2e6, NaN, -Infinity), w: fc.constantFrom(10, 40_000, Infinity, 1e300), h: fc.constantFrom(10, 40_000, Infinity) });
  const most = fc.oneof(fc.constant(Infinity), fc.integer({ min: 0, max: 30 }));
  fc.assert(fc.property(fc.oneof({ weight: 9, arbitrary: box }, { weight: 1, arbitrary: far }), grid, fc.constantFrom(0, 0.5, 1, 2.3, -1), most, (b, g, lift, m) => {
    const budget = { left: m, most: m };
    const was = outcome(() => keep0.floorUnder(b, g, lift, '"nm"', budget)), now = floorUnder(b, g, { lift, most: m });
    if ('value' in was) { assert.equal(now.why, null); assert.deepEqual(now.stretches, was.value); return; }
    assert.equal(now.stretches, null);
    if (now.why === NO_UNDER.far) assert.equal(was.error, `"nm": its box stands further than 1000000 px from the slide — give it a place on the slide`);
    else if (now.why === NO_UNDER.big) assert.equal(was.error, `"nm": its box covers more floor than a picture needs (${Number.isFinite(now.squares) ? Math.round(now.squares) : 'no end of'} squares) — give it a box the size of its words`);
    else { assert.equal(now.why, NO_UNDER.most); assert.equal(was.error, `data-keep-clear: the floor kept clear on this map is more than ${m} stretches, the most a map keeps — keep clear under smaller pieces, or fewer`); }
  }), { numRuns: Math.min(RUNS, 1500) });
  assert.equal(UNDER_CELL, keep0.CLEAR_CELL);
});

test('crossesBox: whether a way passes through a box, as StoryDeck 0.27.0 asked it — on the box\'s own edges too', () => {
  const v = fc.oneof({ weight: 12, arbitrary: fc.oneof(fc.integer({ min: -20, max: 120 }), fc.double({ min: -20, max: 120, noNaN: true }), fc.constantFrom(0, 100, 10, 60)) }, { weight: 1, arbitrary: fc.constantFrom(NaN, Infinity, -Infinity, 1e308) });
  fc.assert(fc.property(fc.array(fc.tuple(v, v), { maxLength: 6 }), fc.record({ x: fc.constantFrom(0, 10, 33.3, NaN), y: fc.constantFrom(0, 10, -Infinity), w: fc.constantFrom(50, 90, 0.5, Infinity), h: fc.constantFrom(50, 0.5) }), (pts, b) => {
    // a box or a point no number places is crossed by nothing now (0.27.0's arithmetic fell through to true); elsewhere the same answer
    // (a stretch with an end no number places crosses nothing; the others are asked as 0.27.0 asked them)
    const boxed = [b.x, b.y, b.w, b.h].every(Number.isFinite);
    const expected = boxed && pts.slice(1).some((q, k) => [...pts[k], ...q].every(Number.isFinite) && keep0.crossesBox([pts[k], q], b));
    assert.equal(crossesBox(pts, b), expected);
  }), { numRuns: RUNS });
});

test('floorLabelPlace: a floor\'s label lies where StoryDeck 0.27.0 laid it, round blocks and routes over its edge', () => {
  const word = fc.constantFrom('Home', 'Production account', 'ACCOUNTS TEAM', 'Accounts team', 'x', 'Shared services network', 'Dev 👨‍💻', 'a long name for a small floor here', 'Ünïcode Wörds');
  const text = fc.array(word, { minLength: 1, maxLength: 3 }).map((w) => w.join(' '));
  const floor = fc.record({ at: fc.tuple(fc.integer({ min: -4, max: 4 }), fc.integer({ min: -4, max: 4 })), size: fc.tuple(fc.integer({ min: 1, max: 12 }), fc.integer({ min: 1, max: 6 })) });
  const cover = fc.tuple(fc.double({ min: -6, max: 14, noNaN: true }), fc.double({ min: -6, max: 12, noNaN: true }), fc.constantFrom([1, 1, 0], [2, 1, 1.2], [0.6, 1, 1], [8, 1, 1], [1, 2, 0.4]), fc.boolean());
  fc.assert(fc.property(floor, grid, text, fc.array(cover, { maxLength: 5 }), fc.boolean(), (f, g, t, cs, icon) => {
    const covers = cs.map(([c, r, size, cable]) => (cable ? [g.at(c, r), g.at(c + size[0], r)].map(({ x, y }) => [x, y]) : g.block({ at: [c, r], size }).outline.map(({ x, y }) => [x, y])));
    assert.deepEqual(floorLabelPlace(f, g, t, covers, { icon }), label0.floorLabelPlace(f, g, t, covers, { icon }));
  }), { numRuns: Math.min(RUNS, 1500) });
});

test('arrangeByGroup: each group arranged, then the groups — where StoryDeck 0.27.0 placed them, and the same refusals', () => {
  const names = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const thing = fc.tuple(fc.constantFrom(null, 'x', 'y', 'z'), fc.tuple(fc.integer({ min: 1, max: 4 }), fc.integer({ min: 1, max: 4 }), fc.constantFrom(0, 0.4, 1, 2.5)));
  fc.assert(fc.property(fc.array(thing, { minLength: 1, maxLength: 8 }), fc.array(fc.tuple(fc.constantFrom(...names, 'nope'), fc.constantFrom(...names)), { maxLength: 12 }), (ts, links) => {
    const solid = ts.map(([group, size], i) => ({ name: names[i], size, group }));
    same(() => arrangeByGroup(solid, links), () => groups0.arrangeByGroup(solid, links, arrange));
  }), { numRuns: Math.min(RUNS, 1500) });
  assert.equal(GROUP_MARGIN, groups0.GROUP_MARGIN);
});
