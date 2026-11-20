// Where a way doubles back on itself (isometric/hairpins.js): leaving its first port, coming into its last, or a tight
// U on the floor — and what is none (a foot's lane change, a U round a thing, a jog onto the floor's lines). Moved from
// StoryDeck 0.27.0 (deck/cable.test.js) with the code; the router's own ways and the refusals are new.
import test from 'node:test';
import assert from 'node:assert/strict';
import { hairpins, routes, HAIRPINS } from '../isometric.js';

// out of a port on the right side (+col), down the riser, then back the other way: the port faces away
const away = [[8, 7, 0.3], [8.25, 7, 0.3], [8.25, 7, 0], [8.5, 7, 0], [8.5, 5.5, 0], [2.5, 5.5, 0], [2.5, 6, 0]];

test('says where: leaving its first port, coming into its last, or a tight U-turn on the floor', () => {
  assert.deepEqual(hairpins(away, ['p1', null]), ['start']);
  // the same way read from its other end: the port is its last
  assert.deepEqual(hairpins([...away].reverse(), [null, 'p1']), ['end']);
  assert.deepEqual(hairpins(away, ['p1', 'rj45']), ['start']);
  // a tight U on the floor, between a foot's step and the next: east, a quarter tile across, west
  assert.deepEqual(hairpins([[0, -0.5, 0], [0, 0, 0], [4, 0, 0], [4, 0.25, 0], [0, 0.25, 0], [0, 4, 0], [0.5, 4, 0]], []), ['middle']);
  assert.deepEqual(hairpins([[0, -0.5], [0, 0], [4, 0], [4, 0.25], [0, 0.25], [0, 4], [0.5, 4]]), ['middle']);   // floor points alone, ports left out
});

test('is no hairpin: a foot\'s lane change, a U round a thing, a port that faces the way, a run back far from its port', () => {
  // out of a foot half a tile, along, and half a tile back in to the other foot: the usual way
  assert.deepEqual(hairpins([[7, 8, 0], [7, 8.5, 0], [12, 8.5, 0], [12, 8, 0]], [null, null]), []);
  assert.deepEqual(hairpins(away, [null, null]), []);   // asked at a port only
  // a U-turn round something two tiles wide: a way round, not a hairpin
  assert.deepEqual(hairpins([[0, -0.5, 0], [0, 0, 0], [4, 0, 0], [4, 2, 0], [0, 2, 0], [0, 4, 0], [0.5, 4, 0]], []), []);
  // the port faces the way it goes
  assert.deepEqual(hairpins([[2, 7, 0.3], [2.25, 7, 0.3], [2.25, 7, 0], [2.5, 7, 0], [6, 7, 0]], ['p', null]), []);
  // it runs a long way first, then turns back: far from its port
  assert.deepEqual(hairpins([[0, 0, 0.3], [0.25, 0, 0.3], [0.25, 0, 0], [0.5, 0, 0], [0.5, 3, 0], [-4, 3, 0]], ['p', null]), []);
  assert.deepEqual(hairpins([], []), []);
  assert.deepEqual(hairpins([[1, 1, 0]], ['p', 'q']), []);
});

test('reads no turn into a jog onto the floor\'s lines, and tells a port on the wrong side from a hook near a good one', () => {
  // a jog of a few px (0.07 of a tile) back before the port: no U-turn
  assert.deepEqual(hairpins([[2.64, 3, 0], [4.75, 3, 0], [4.75, 6.25, 0], [5, 6.25, 0], [5, 6.18, 0], [5.25, 6.18, 0], [5.25, 6.18, 0.3], [5.5, 6.18, 0.3]], [null, 'p']), []);
  // a reversal of 0.047 of a tile right out of a port: none
  assert.deepEqual(hairpins([[0, 0, 0.3], [0.25, 0, 0.3], [0.25, 0, 0], [0.203, 0, 0], [0.203, 3, 0], [5, 3, 0]], ['p', null]), []);
  // out of a port that faces the other end, a short hook back to reach a line of the floor: a hook, not a wrong side
  const hook = [[0, 0, 0.3], [0.25, 0, 0.3], [0.25, 0, 0], [0.25, 0.5, 0], [-0.05, 0.5, 0], [-0.05, 1, 0], [6, 1, 0], [6, 0.5, 0]];
  assert.deepEqual(hairpins(hook, ['p', null]), ['start-hook']);
  assert.deepEqual(hairpins([...hook].reverse(), [null, 'p']), ['end-hook']);
  // a port at a right angle to the way to the other end is on the wrong side too: two ports side by side, both facing +row
  assert.deepEqual(hairpins([[3.79, 3.5, 0.23], [3.79, 3.75, 0.23], [3.79, 3.75, 0], [3.79, 4, 0], [4.75, 4, 0], [4.75, 3.75, 0], [4.75, 3.75, 0.5], [4.75, 3.5, 0.5]], ['p', 'q']), ['start', 'end']);
  // a U whose arms are jogs is no U
  assert.deepEqual(hairpins([[0, -0.5, 0], [0, 0, 0], [0.3, 0, 0], [0.3, 0.25, 0], [0, 0.25, 0], [0, 4, 0], [0.5, 4, 0]], []), []);
});

test('is asked of the router\'s own way: out of a port that faces away from the other thing, it says start; the other way round, end', () => {
  const things = [{ name: 'sw', at: [6, 6], size: [2, 2, 0.4], ports: [{ name: 'p1', at: [2, 1, 0.3] }] }, { name: 'lap', at: [0, 6], size: [2, 1.4, 0.3], ports: [{ name: 'rj45', at: [2, 0.7, 0.15] }] }];
  const [there, back] = routes(things, [[{ thing: 'sw', port: 'p1' }, { thing: 'lap', port: 'rj45' }], [{ thing: 'lap', port: 'rj45' }, { thing: 'sw', port: 'p1' }]]);
  assert.equal(hairpins(there.path, there.ports)[0], 'start');
  assert.equal(hairpins(back.path, back.ports).at(-1), 'end');
  // whatever it says is one of HAIRPINS, in their order
  for (const r of [there, back]) { const said = hairpins(r.path, r.ports); assert.deepEqual(said, HAIRPINS.filter((w) => said.includes(w))); }
});

test('every value is read by its own stored value, and a refusal says what to give', () => {
  const refused = (f, words) => assert.throws(f, (e) => e.message.startsWith('isometric: ') && e.message.includes(words), words);
  refused(() => hairpins('a way'), 'hairpins takes a way');
  refused(() => hairpins([[0, 0], [1]]), 'point 2 of a way');
  refused(() => hairpins([[0, 0], [1, NaN]]), 'point 2 of a way');
  refused(() => hairpins([[0, 0], [2e6, 0]]), 'no further than 1000000');
  // eslint-disable-next-line no-sparse-arrays
  refused(() => hairpins([[0, 0], , [1, 1]]), 'point 2 of a way');
  refused(() => hairpins(away, ['p', null, 'q']), "a way's ports are [port, port]");
  refused(() => hairpins(away, [1, null]), "a way's ports are [port, port]");
  let ran = false;
  const point = [8, 7];
  Object.defineProperty(point, 1, { get() { ran = true; return 7; } });
  refused(() => hairpins([point, [9, 7]]), 'point 1 of a way');
  assert.equal(ran, false);
  assert.ok(Object.isFrozen(HAIRPINS));
});
