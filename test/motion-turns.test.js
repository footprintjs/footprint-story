// Turns: an order written once. The written form reads to turns and writes back; starts never go back; a turn's own
// time moves every turn after it; text from anyone is bounded and refused with what to write.
import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { readTurns, turnTimes, writeTurns, stagger, MOST_TURNS, MOST_TOGETHER, MOST_TURN_NAME, MOST_TURNS_TEXT, MOST_TURN_SECONDS } from '../motion.js';

const turn = (names, takes = null) => ({ names, takes });

test('the written form: names in order, (together), name:seconds', () => {
  assert.deepEqual(readTurns('camera laptop (dns server) w1:1.2 db'), [turn(['camera']), turn(['laptop']), turn(['dns', 'server']), turn(['w1'], 1.2), turn(['db'])]);
  assert.deepEqual(readTurns('  a\n\t(b   c):.5  '), [turn(['a']), turn(['b', 'c'], 0.5)]);
  assert.deepEqual(readTurns('a:0 b:2. gw+ *'), [turn(['a'], 0), turn(['b'], 2), turn(['gw+']), turn(['*'])]);
  assert.deepEqual(readTurns(''), []);
  assert.deepEqual(readTurns('   '), []);
});

test('names alone read as before: every name its own turn, so a route written before turns keeps its meaning', () => {
  assert.deepEqual(readTurns('agent link-mcp mcp link-gw gw').map((t) => t.names), [['agent'], ['link-mcp'], ['mcp'], ['link-gw'], ['gw']]);
});

test('a list: written text and turns as data, in the order given', () => {
  assert.deepEqual(readTurns(['a (b c)', { names: ['d'], takes: 1 }, { names: ['e', 'f'] }, 'g:2']), [turn(['a']), turn(['b', 'c']), turn(['d'], 1), turn(['e', 'f']), turn(['g'], 2)]);
  assert.deepEqual(readTurns([]), []);
});

test('what it gives is frozen, and never the caller\'s own list', () => {
  const names = ['d'], turns = readTurns([{ names }]);
  assert.ok(Object.isFrozen(turns) && Object.isFrozen(turns[0]) && Object.isFrozen(turns[0].names));
  assert.notEqual(turns[0].names, names);
});

test('isName: a thing really called like the written form is itself', () => {
  const own = new Set(['w1:2', '(x', 'a)', 'k:v']), isName = (s) => own.has(s);
  assert.deepEqual(readTurns('w1:2 (x a) k:v:3 a)', { isName }).map((t) => [t.names, t.takes]), [[['w1:2'], null], [['(x'], null], [['a)'], null], [['k:v'], 3], [['a)'], null]]);
  assert.deepEqual(readTurns('w1:2'), [turn(['w1'], 2)]);
  assert.deepEqual(readTurns('(w1:2 b) (k:v c)', { isName }), [turn(['w1:2', 'b']), turn(['k:v', 'c'])]);
});

test('every refusal says what to write', () => {
  const refused = (order, message, options) => assert.throws(() => readTurns(order, options), (e) => { assert.match(e.message, message); return true; });
  refused('a (b', /"\(" opens names that come together and "\)" closes them/);
  refused('a ()', /"\(\)" names nothing/);
  refused('a (  )', /"\(\)" names nothing/);
  refused('a (b (c))', /a "\(" inside a "\("/);
  refused('a b)', /"\)" with no "\(" before it/);
  refused('a b):2', /"\)" with no "\(" before it/);
  refused('(a b)x', /after "\)" comes a space or ":seconds" — not "x"/);
  refused('x:-1', /"x" takes seconds, a number from 0 to 60 — not "-1"/);
  refused('x:1e3', /takes seconds/);
  refused('x:1.2.3', /takes seconds/);
  refused('x:', /takes seconds/);
  refused('x:61', /from 0 to 60/);
  refused('(a b):99', /"\(a b\)" takes seconds/);
  refused('(a:2 b)', /a time follows the "\)" and is the whole turn's — write "\(a b\):2", not "a:2" inside it/);
  refused(':2', /":seconds" follows a name/);
  refused('a​b', /a character nobody can see/);
  refused('a'.repeat(MOST_TURN_NAME + 1), /at most 128 characters/);
  refused('a '.repeat(MOST_TURNS_TEXT), /at most 8192 characters/);
  refused(Array.from({ length: MOST_TURNS + 1 }, (_, i) => `n${i}`).join(' '), /an order has at most 256 turns/);
  refused(['a '.repeat(200), { names: ['b'] }, 'c '.repeat(60)], /an order has at most 256 turns/);
  const together = `(${Array.from({ length: 60 }, (_, i) => `${'n'.repeat(98)}${String(i).padStart(2, '0')}`).join(' ')})`;   // one turn, about 6000 characters
  refused([together, together], /an order is at most 8192 characters, not 12\d+ or more/);                      // the bound is on all the parts together
  refused(Array.from({ length: MOST_TURNS + 1 }, () => 'a'), /at most 256 turns, not 257/);
  refused(`(${Array.from({ length: MOST_TOGETHER + 1 }, (_, i) => `n${i}`).join(' ')})`, /at most 64 names come together/);
  refused(7, /an order is names in the order they come/);
  refused(null, /an order is/);
  refused([7], /an order is text, or a list of text and \{names, takes\?\}/);
  refused([['a']], /an order is text, or a list/);
  refused([{ names: [] }], /a turn's names are a list of one name or more/);
  refused([{ names: 'a' }], /a turn's names are a list/);
  refused([{ names: [''] }], /a name is text/);
  refused([{ names: [3] }], /a name is text/);
  refused([{ names: Object.assign([], { 1: 'a', length: 2 }) }], /a name is text, not undefined/);                 // a hole is not a name
  refused(Object.assign([], { 1: 'a', length: 2 }), /an order is text, or a list of text and \{names, takes\?\} — not undefined/);
  refused([{ names: Array.from({ length: MOST_TOGETHER + 1 }, (_, i) => `n${i}`) }], /at most 64 names come together/);
  refused([{ names: ['a b'] }], /a name has no space in it/);
  refused([{ names: ['a'], takes: -1 }], /a turn takes seconds/);
  refused([{ names: ['a'], takes: '1' }], /a turn takes seconds/);
  refused([Object.create({ names: ['a'] })], /a turn's names are a list/);   // own fields only
  refused('a', /isName is a function/, { isName: 'a' });
  refused('a b)', /^route: /, { where: 'route' });
});

test('turnTimes: a turn starts when the one before is over', () => {
  const timed = turnTimes(readTurns('camera laptop (dns server) w1:1.2 db'), { step: 0.35 });
  assert.deepEqual(timed.turns.map((t) => [t.names.join('+'), t.at, t.takes]), [['camera', 0, 0.35], ['laptop', 0.35, 0.35], ['dns+server', 0.7, 0.35], ['w1', 1.05, 1.2], ['db', 2.25, 0.35]]);
  assert.equal(timed.last, 2.25);
  assert.equal(timed.end, 2.6);
  assert.ok(Object.isFrozen(timed) && Object.isFrozen(timed.turns) && Object.isFrozen(timed.turns[0]));
  assert.deepEqual(turnTimes([]), { turns: [], last: 0, end: 0 });
  assert.equal(turnTimes(readTurns('a b')).turns[1].at, 0.35);   // the usual step
});

test('turnTimes: takes(turn, index) gives a turn its time when it does not say; its own time wins', () => {
  const timed = turnTimes(readTurns('camera a camera:2 b'), { step: 0.5, takes: (t, i) => (t.names[0] === 'camera' ? 1 + i : undefined) });
  assert.deepEqual(timed.turns.map((t) => [t.at, t.takes]), [[0, 1], [1, 0.5], [1.5, 2], [3.5, 0.5]]);
  assert.throws(() => turnTimes(readTurns('a'), { takes: () => -1 }), /a turn takes seconds, a number from 0 to 60 — not -1/);
  assert.throws(() => turnTimes(readTurns('a'), { takes: () => 'soon' }), /a turn takes seconds/);
  assert.throws(() => turnTimes(readTurns('a'), { takes: 1 }), /takes is a function/);
  assert.throws(() => turnTimes('a b'), /turnTimes takes the turns readTurns gave/);
  assert.throws(() => turnTimes([null]), /turnTimes takes the turns readTurns gave — not a turn: null/);
  assert.throws(() => turnTimes([{ takes: 1 }]), /not a turn/);
  assert.throws(() => turnTimes([{ names: ['a'], takes: Infinity }]), /a turn takes seconds, a number from 0 to 60 — not Infinity/);
  assert.throws(() => turnTimes(Array.from({ length: MOST_TURNS + 1 }, () => ({ names: ['a'] }))), /an order has at most 256 turns, not 257/);
  assert.throws(() => turnTimes([], { step: -1 }), /step is the seconds a turn takes when it does not say/);
  assert.throws(() => turnTimes([], { step: MOST_TURN_SECONDS + 1 }), /from 0 to 60/);
  assert.throws(() => turnTimes('x', { where: 'path' }), /^Error: path: /);
});

test('writeTurns: the written form of turns', () => {
  assert.equal(writeTurns(readTurns(' a  (b c)  d:1.2 (e f):0 ')), 'a (b c) d:1.2 (e f):0');
  assert.equal(writeTurns([{ names: ['a'] }]), 'a');
  assert.throws(() => writeTurns('a'), /writeTurns takes the turns readTurns gave/);
  assert.throws(() => writeTurns([null]), /writeTurns takes the turns readTurns gave — not a turn: null/);
  assert.throws(() => writeTurns([{ names: 'a' }]), /not a turn/);
  assert.throws(() => writeTurns([{ names: ['a'], takes: 99 }]), /a turn takes seconds, a number from 0 to 60 — not 99/);
});

test('seconds are kept to the millisecond, so what is written always reads back', () => {
  assert.deepEqual(readTurns([{ names: ['a'], takes: 1e-7 }, { names: ['b'], takes: 1.23456 }, 'c:0.0004 d:1.0006']).map((t) => t.takes), [0, 1.235, 0, 1.001]);
  assert.equal(writeTurns([{ names: ['a'], takes: 1e-7 }, { names: ['b'], takes: 1.23456 }]), 'a:0 b:1.235');
  assert.deepEqual(readTurns(writeTurns([{ names: ['a'], takes: 1e-7 }])), [turn(['a'], 0)]);
  assert.equal(turnTimes([{ names: ['a'], takes: 0.3004 }, { names: ['b'] }]).turns[1].at, 0.3);
});

test('a name the written form cannot spell is refused by writeTurns, never written as something else', () => {
  const own = (text) => ['w1:2', '(a', 'a)'].includes(text);
  const read = readTurns('w1:2 (a a)', { isName: own });
  assert.deepEqual(read.map((t) => t.names), [['w1:2'], ['(a'], ['a)']]);
  assert.throws(() => writeTurns(read), /the name "w1:2" cannot be written: it would read back as a group or a time — keep these turns as data/);
  assert.throws(() => writeTurns([{ names: ['(a', 'b'] }]), /the name "\(a" cannot be written/);
  assert.throws(() => writeTurns([{ names: ['a b'] }]), /a name has no space in it/);
  assert.equal(writeTurns([{ names: ['k:v', 'a:b:c'] }]), '(k:v a:b:c)');   // a colon with no time after it is only a name
  assert.deepEqual(readTurns('(k:v a:b:c)'), [turn(['k:v', 'a:b:c'])]);
});

test('the bound holds while it reads: a huge order is refused in about the time a full one takes', () => {
  const huge = Array.from({ length: MOST_TURNS }, () => 'a '.repeat(4000)), start = process.hrtime.bigint();
  assert.throws(() => readTurns(huge), /an order has at most 256 turns/);
  assert.ok(Number(process.hrtime.bigint() - start) / 1e6 < 50, 'it stopped at the 257th turn, not after a million');
});

const name = fc.stringMatching(/^[a-z0-9_+*.-]{1,12}$/);
const takes = fc.option(fc.integer({ min: 0, max: 60000 }).map((ms) => ms / 1000), { nil: null });
const turns = fc.array(fc.record({ names: fc.array(name, { minLength: 1, maxLength: 4 }), takes }), { maxLength: 24 }).map((list) => list.map((t) => ({ names: [...t.names], takes: t.takes })));

test('property: what is written reads back to the same turns', () => {
  fc.assert(fc.property(turns, (list) => {
    assert.deepEqual(readTurns(writeTurns(list)), list);
    assert.deepEqual(readTurns(list), list);
  }), { numRuns: 300 });
});

test('property: starts never go back, each turn starts when the one before is over, and the end is the last one over', () => {
  fc.assert(fc.property(turns, fc.integer({ min: 0, max: 5000 }).map((ms) => ms / 1000), (list, step) => {
    const timed = turnTimes(readTurns(list), { step });
    let clock = 0;
    timed.turns.forEach((t, i) => {
      assert.ok(Math.abs(t.at - clock) < 1e-6, `turn ${i} starts at ${t.at}, the one before was over at ${clock}`);
      assert.equal(t.takes, list[i].takes ?? step);
      clock += t.takes;
    });
    assert.ok(Math.abs(timed.end - clock) < 1e-6);
    assert.equal(timed.last, timed.turns.length ? timed.turns[timed.turns.length - 1].at : 0);
  }), { numRuns: 300 });
});

test('property: turns that all take the step start where stagger puts them, to the millisecond', () => {
  fc.assert(fc.property(fc.array(name, { maxLength: 40 }), fc.double({ min: 0, max: 5, noNaN: true }), (names, step) => {
    const timed = turnTimes(readTurns(names.map((n) => ({ names: [n] }))), { step });
    assert.deepEqual(timed.turns.map((t) => t.at), stagger(names, step).map((s) => Math.round(s.delay * 1000) / 1000));
  }), { numRuns: 300 });
});

test('the README example runs as written', () => {
  const turns = readTurns('camera laptop (dns server) w1:1.2 db'), timed = turnTimes(turns, { step: 0.35 });
  assert.deepEqual(timed.turns.map((t) => t.at), [0, 0.35, 0.7, 1.05, 2.25]);
  assert.deepEqual(timed.turns[0], { names: ['camera'], at: 0, takes: 0.35 });
  assert.deepEqual(timed.turns[4], { names: ['db'], at: 2.25, takes: 0.35 });
  assert.deepEqual([timed.last, timed.end], [2.25, 2.6]);
  assert.equal(writeTurns(turns), 'camera laptop (dns server) w1:1.2 db');
});
