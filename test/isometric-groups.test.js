// Placing by group (isometric/groups.js): each group arranged on the links inside it, then the groups as things on the
// links between them — the flow left to right across the frame, group by group, a clear tile between two groups'
// floors. Moved from StoryDeck 0.27.0 (deck/groups.test.js) with the code: there the deck handed its arrange in and a
// spy watched the calls; here the result is checked against the two arrangements worked by hand from `arrange`.
import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { arrange, arrangeByGroup, GROUP_MARGIN } from '../isometric.js';

const RUNS = Number(process.env.FC_RUNS) || 300;

test('arranges each group on the links inside it, then the groups as things on the links between them', () => {
  const solid = [{ name: 'a', size: [2, 2, 1], group: 'x' }, { name: 'b', size: [2, 2, 1], group: 'x' }, { name: 'c', size: [2, 2, 1], group: 'y' }, { name: 'd', size: [2, 2, 1], group: null }];
  const links = [['a', 'b'], ['b', 'c'], ['c', 'd'], ['a', 'a']];
  const at = arrangeByGroup(solid, links);
  // by hand: the groups' own arrangements, then the groups as things as big as them and their floor, a tile more
  const pad = GROUP_MARGIN + 0.5, x = arrange([solid[0], solid[1]], [['a', 'b'], ['a', 'a']], { across: true }), y = arrange([solid[2]], [], { across: true }), none = arrange([solid[3]], [], { across: true });
  const groups = arrange([['g:x', x], ['g:y', y], ['\u0001', none]].map(([name, p]) => ({ name, size: [p.cols + 2 * pad, p.rows + 2 * pad, 1] })), [['g:x', 'g:y'], ['g:y', '\u0001']], { across: true });
  const want = [[0, x, 0], [0, x, 1], [1, y, 0], [2, none, 0]].map(([g, p, i]) => [groups.things[g].at[0] + pad + p.things[i].at[0], groups.things[g].at[1] + pad + p.things[i].at[1], 0]);
  assert.deepEqual(at, want);
  // a thing in no group may leave its group out
  assert.deepEqual(arrangeByGroup(solid.map(({ group, ...t }) => (group === null ? t : { ...t, group })), links), at);
});

test('every thing placed once; groups stand apart, a clear tile between their floors; a group\'s things stay together', () => {
  const names = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const thing = fc.tuple(fc.constantFrom(null, 'x', 'y', 'z'), fc.tuple(fc.integer({ min: 1, max: 3 }), fc.integer({ min: 1, max: 3 }), fc.constantFrom(0, 0.5, 1, 2)));
  fc.assert(fc.property(fc.array(thing, { minLength: 1, maxLength: 8 }), fc.array(fc.tuple(fc.constantFrom(...names), fc.constantFrom(...names)), { maxLength: 10 }), (ts, links) => {
    const solid = ts.map(([group, size], i) => ({ name: names[i], size, group }));
    const at = arrangeByGroup(solid, links);
    assert.equal(at.length, solid.length);
    // each group's box, with its floor's margin all round, fitted to whole tiles as a floor is
    const boxOf = (group) => {
      const on = solid.map((p, i) => [p, at[i]]).filter(([p]) => p.group === group);
      const c0 = Math.floor(Math.min(...on.map(([, a]) => a[0])) + 1e-9) - GROUP_MARGIN, r0 = Math.floor(Math.min(...on.map(([, a]) => a[1])) + 1e-9) - GROUP_MARGIN;
      const c1 = Math.ceil(Math.max(...on.map(([p, a]) => a[0] + p.size[0])) - 1e-9) + GROUP_MARGIN, r1 = Math.ceil(Math.max(...on.map(([p, a]) => a[1] + p.size[1])) - 1e-9) + GROUP_MARGIN;
      return { c0, c1, r0, r1 };
    };
    const groups = [...new Set(solid.map((p) => p.group))].map(boxOf);
    for (let i = 0; i < groups.length; i++) for (let j = i + 1; j < groups.length; j++) {
      const [a, b] = [groups[i], groups[j]];
      assert.ok(a.c1 < b.c0 || b.c1 < a.c0 || a.r1 < b.r0 || b.r1 < a.r0, `two groups' floors meet: ${JSON.stringify([a, b])}`);
    }
    // no two things overlap
    for (let i = 0; i < solid.length; i++) for (let j = i + 1; j < solid.length; j++) {
      const [p, q, a, b] = [solid[i], solid[j], at[i], at[j]];
      assert.ok(!(a[0] < b[0] + q.size[0] && b[0] < a[0] + p.size[0] && a[1] < b[1] + q.size[1] && b[1] < a[1] + p.size[1]), `${p.name} and ${q.name} overlap`);
    }
  }), { numRuns: RUNS });
});

test('every value is read by its own stored value, and a refusal says what to give; arrange\'s own come out as they are', () => {
  const refused = (f, words) => assert.throws(f, (e) => e.message.startsWith('isometric: ') && e.message.includes(words), words);
  refused(() => arrangeByGroup('things'), 'arrangeByGroup takes a list of things');
  refused(() => arrangeByGroup([{ name: '', size: [1, 1, 1] }]), 'thing 1 has a name');
  refused(() => arrangeByGroup([{ name: 'a', size: [1, 1, 1], group: 'x' }, { name: 'a', size: [1, 1, 1], group: 'y' }]), 'two things are named "a"');
  refused(() => arrangeByGroup([{ name: 'a', size: [1, 1, 1], group: 3 }]), "\"a\"'s group is a name");
  refused(() => arrangeByGroup([{ name: 'a', size: [1, 1, 1], group: 'g'.repeat(101) }]), '1 to 100 characters');
  refused(() => arrangeByGroup([{ name: 'a', size: [1, 1] }]), "\"a\"'s size");
  refused(() => arrangeByGroup([{ name: 'a', size: [1, 1, 1] }], [['a']]), 'link 1 is [from, to]');
  refused(() => arrangeByGroup([{ name: 'a', size: [1, 1, 1] }], 'a to b'), 'a list of links');
  refused(() => arrangeByGroup(Array.from({ length: 257 }, (_, i) => ({ name: `t${i}`, size: [1, 1, 1] }))), 'at most 256 things');
  refused(() => arrangeByGroup([{ name: 'a', size: [65, 1, 1] }]), 'none over 64');   // arrange's, as it is
  let ran = false;
  const sneaky = { name: 'a', size: [1, 1, 1] };
  Object.defineProperty(sneaky, 'group', { get() { ran = true; return 'x'; } });
  assert.deepEqual(arrangeByGroup([sneaky]), arrangeByGroup([{ name: 'a', size: [1, 1, 1] }]));
  assert.equal(ran, false);
});
