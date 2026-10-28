import test from 'node:test';
import assert from 'node:assert/strict';
import { MOVES, MOVE_NAMES, MOVE_KINDS, MOVE_USES, MOVE_FEEL_NAMES, REST, WORD_GAP, EXIT_SHARE, readMove, moveAt, stagger, movesBy } from '../src/motion/moves.js';
import { spring } from '../src/motion/spring.js';
import { overshoots, EASES } from '../src/motion/ease.js';

const PROPS = Object.keys(REST);
const atRest = (v) => PROPS.every((p) => Math.abs(v[p] - REST[p]) < 1e-9);
const same = (a, b, tol = 1e-9) => PROPS.every((p) => Math.abs(a[p] - b[p]) <= tol) && a.mask === b.mask;
const times = (n) => Array.from({ length: n + 1 }, (_, i) => i / n);

test('the vocabulary: at least 20 moves, each data, every feel and every use covered', () => {
  assert.ok(MOVE_NAMES.length >= 20, `${MOVE_NAMES.length} moves`);
  for (const name of ['fade-slide', 'soft-rise', 'mask-wipe', 'iris-open', 'overshoot', 'bounce-landing', 'spring-follow', 'pop', 'shake',
    'text-reveal-word', 'text-reveal-letter', 'count-up', 'line-draw', 'blur-in', 'scale-in', 'drop-in', 'marquee', 'pulse', 'wiggle']) assert.ok(MOVE_NAMES.includes(name), name);
  assert.ok(Object.isFrozen(MOVES) && Object.isFrozen(MOVES.pop) && Object.isFrozen(MOVES.pop.props.scale) && Object.isFrozen(MOVES.pop.uses));
  for (const m of Object.values(MOVES)) {
    assert.ok(MOVE_KINDS.includes(m.kind) && MOVE_FEEL_NAMES.includes(m.feel) && m.uses.every((u) => MOVE_USES.includes(u)), m.name);
    assert.equal(JSON.parse(JSON.stringify(m)).name, m.name, `${m.name} is plain data`);
    assert.equal(readMove(m.name), m);
  }
  for (const feel of MOVE_FEEL_NAMES) assert.ok(movesBy({ feel }).length >= 2, `${feel} has moves`);
  for (const use of MOVE_USES) assert.ok(movesBy({ use }).length >= 3, `${use} has moves`);
  for (const kind of MOVE_KINDS) assert.ok(movesBy({ kind }).length >= 3, `${kind} has moves`);
});

test('the timing rules practitioners use are numbers in the data', () => {
  const exits = movesBy({ kind: 'exit' });
  assert.ok(exits.length >= 6);
  for (const exit of exits) {
    const entrance = MOVES[exit.pairs];
    assert.equal(entrance?.kind, 'entrance', `${exit.name} closes an entrance`);
    assert.ok(Math.abs(exit.seconds / entrance.seconds - EXIT_SHARE) < .02, `${exit.name} takes about half of ${entrance.name}'s seconds (${exit.seconds} of ${entrance.seconds})`);
  }
  assert.equal(WORD_GAP, .09); assert.equal(MOVES['text-reveal-word'].gap, .09, 'about 0.09 s between words');
  assert.equal(MOVES.overshoot.ease, 'outBack', 'overshoot moves ride outBack');
  for (const m of Object.values(MOVES)) if (m.ease && overshoots(m.ease)) assert.equal(m.ease, 'outBack', `${m.name}: an eased overshoot is outBack`);
});

test('the laws: an entrance ends at rest, an exit starts at rest, feedback starts and ends there, an ambient move loops from rest', () => {
  for (const m of Object.values(MOVES)) {
    const start = moveAt(m.name, 5, { start: 5 }), end = moveAt(m.name, 5 + m.seconds, { start: 5 }), long = moveAt(m.name, 50, { start: 5 });
    if (m.kind === 'entrance') assert.ok(atRest(end) && atRest(long), `${m.name} ends at rest`);
    if (m.kind === 'exit') assert.ok(atRest(start), `${m.name} starts at rest`);
    if (m.kind === 'feedback') assert.ok(atRest(start) && atRest(end) && atRest(long), `${m.name} starts and ends at rest`);
    if (m.kind === 'ambient') {
      assert.ok(atRest(start) && atRest(end), `${m.name} starts each loop at rest`);
      for (const k of [.13, .5, .77]) assert.ok(same(moveAt(m.name, 5 + k * m.seconds, { start: 5 }), moveAt(m.name, 5 + (k + 3) * m.seconds, { start: 5 }), 1e-6), `${m.name} repeats`);
    }
    if (m.kind !== 'ambient') assert.ok(same(moveAt(m.name, 2, { start: 5 }), start), `${m.name} waits at its start before it begins`);
  }
});

test('reduced motion jumps: the start until the move starts, then the end; an ambient move stays at rest', () => {
  for (const m of Object.values(MOVES)) for (const t of [0, 4.99, 5, 5.01, 5 + m.seconds / 2, 9, 40]) {
    const v = moveAt(m.name, t, { start: 5, reduced: true });
    if (m.kind === 'ambient') { assert.ok(atRest(v), `${m.name} at ${t}`); continue; }
    assert.ok(same(v, t < 5 ? moveAt(m.name, 5, { start: 5 }) : moveAt(m.name, 5 + m.seconds, { start: 5 })), `${m.name} reduced at ${t}`);
  }
  assert.equal(moveAt('fade-slide', 5.1, { start: 5, reduced: true }).opacity, 1, 'no in-between');
  assert.throws(() => moveAt('pop', 1, { reduced: 'yes' }), /moveAt: reduced is true \(reduced motion: jump to the end\) or false, not "yes"/);
});

test('a move goes only forward on a curve that does not overshoot, and an overshoot move overshoots', () => {
  const forward = Object.values(MOVES).filter((m) => m.ease && !overshoots(m.ease) && m.ease !== 'bounce' && !m.loop);
  assert.ok(forward.length > 10);
  for (const m of forward) for (const [prop, spec] of Object.entries(m.props)) {
    if (!Array.isArray(spec) && spec.from === undefined) continue;   // a swing goes both ways by design
    const values = times(240).map((k) => moveAt(m.name, k * m.seconds)[prop]), up = (Array.isArray(spec) ? spec[1] - spec[0] : spec.to - spec.from) > 0;
    for (let i = 1; i < values.length; i++) assert.ok(up ? values[i] >= values[i - 1] - 1e-12 : values[i] <= values[i - 1] + 1e-12, `${m.name}.${prop} goes back at ${i}/240`);
  }
  const peak = Math.max(...times(240).map((k) => moveAt('overshoot', k * .5).scale));
  assert.ok(peak > 1.02, `overshoot passes its rest (${peak})`);
  const fall = times(400).map((k) => moveAt('bounce-landing', k * .9).y);
  assert.ok(fall.every((y) => y <= 1e-9), 'a landing never goes through the floor');
  assert.ok(fall.some((y, i) => i > 0 && i < fall.length - 1 && y < fall[i - 1] && y < fall[i + 1]), 'and bounces off it');
});

test('a spring move plays its spring in real time at its own seconds, and seconds stretch any move', () => {
  for (const [name, prop, feel] of [['pop', 'scale', 'playful'], ['spring-follow', 'x', 'default'], ['drop-in', 'y', 'heavy']]) {
    const [from, to] = MOVES[name].props[prop];
    for (const k of times(60)) {
      const t = k * MOVES[name].seconds, want = from + (to - from) * spring(t, feel);
      assert.ok(Math.abs(moveAt(name, t)[prop] - want) < .006 * Math.abs(to - from), `${name}.${prop} at ${t}: ${moveAt(name, t)[prop]} against the ${feel} spring's ${want}`);
    }
  }
  for (const name of ['fade-slide', 'pop', 'shake', 'marquee']) for (const k of times(20)) {
    assert.ok(same(moveAt(name, 3 + k * 2, { start: 3, seconds: 2 }), moveAt(name, 3 + k * MOVES[name].seconds, { start: 3 })), `${name} stretched to 2 s at ${k}`);
  }
  assert.throws(() => moveAt('pop', 1, { seconds: 0 }), /moveAt: seconds is how long "pop" takes, above 0 \(its own is 0.78\), not 0/);
  assert.throws(() => moveAt('pop', NaN), /moveAt: t and start are seconds, not t NaN, start 0/);
  assert.throws(() => moveAt('pop', 1, { delay: 1 }), /moveAt: no option delay \(moveAt takes start, seconds, feel, reduced\)/);
});

test('a feel drives a move on another curve: a move feel, a spring feel, or {k, d}', () => {
  const ys = (feel) => times(200).map((k) => moveAt('fade-slide', k * .4, feel === undefined ? {} : { feel }).y);
  assert.ok(ys().every((y) => y >= 0), 'fade-slide on its own ease never passes its place');
  assert.ok(ys('bouncy').some((y) => y < -.5), 'bouncy: the playful spring overshoots it');
  assert.ok(ys({ k: 300, d: 8 }).some((y) => y < -1), 'a spring of your own');
  assert.equal(ys('smooth').at(-1), 0); assert.equal(ys('heavy').at(-1), 0, 'every feel ends where the move does');
  assert.notDeepEqual(ys('snappy'), ys()); assert.equal(ys('snappy').at(-1), 0, 'a spring feel by its motion.mjs name drives it too');
  assert.throws(() => moveAt('pop', 0, { feel: 'wobbly' }), /moveAt: feel is a move feel \(smooth, crisp, soft, heavy, bouncy\), a spring's \(snappy, default, heavy, playful\) or \{k, d\}, not "wobbly"/);
  assert.throws(() => moveAt('pop', 0, { feel: { k: -1, d: 2 } }), /a feel is a name .* or \{k, d\}/);
});

test('stagger: each item\'s delay, by seconds or by a text reveal\'s own gap', () => {
  const words = 'one sheep one pebble'.split(' ');
  assert.deepEqual(stagger(words, 'text-reveal-word').map((w) => w.delay), [0, .09, .18, .27].map((d, i) => i * WORD_GAP));
  assert.deepEqual(stagger(['a', 'b'], .5), [{ item: 'a', index: 0, delay: 0 }, { item: 'b', index: 1, delay: .5 }]);
  assert.deepEqual(stagger([], .1), []);
  assert.equal(stagger([...'abc'], 'text-reveal-letter')[2].delay, 2 * MOVES['text-reveal-letter'].gap);
  // A word's own move is the reveal started at its delay: the second word is still on its way when the first is in place.
  const at = .45, [first, second] = stagger(words, 'text-reveal-word').map(w => moveAt('text-reveal-word', at, {start: w.delay}));
  assert.ok(atRest(first) && second.opacity < 1);
  assert.throws(() => stagger(words, 'pop'), /stagger: "pop" does not split text, so it has no gap; give seconds \(0.09 between words\) or a move that splits: text-reveal-word, text-reveal-letter/);
  assert.throws(() => stagger(words, -1), /stagger: gap is seconds between items, 0 or more/);
  assert.throws(() => stagger('one two', .1), /stagger: items is a list/);
});

test('movesBy: the moves matching every filter, in the table\'s order; an unknown filter refuses', () => {
  assert.deepEqual(movesBy().map((m) => m.name), MOVE_NAMES);
  const bouncyLogos = movesBy({ feel: 'bouncy', use: 'logo' });
  assert.ok(bouncyLogos.length && bouncyLogos.every((m) => m.feel === 'bouncy' && m.uses.includes('logo')));
  assert.deepEqual(movesBy({ kind: 'ambient' }).map((m) => m.name), ['marquee', 'pulse', 'float']);
  assert.deepEqual(movesBy({ feel: 'heavy', kind: 'entrance' }).map((m) => m.name), ['drop-in', 'slam']);
  assert.throws(() => movesBy({ mood: 'happy' }), /movesBy: no filter mood \(the filters are feel, use, kind\)/);
  assert.throws(() => movesBy({ use: 'video' }), /movesBy: use is ui, text, logo, character, 3d, not "video"/);
  assert.throws(() => movesBy({ feel: 'snappy' }), /movesBy: feel is smooth, crisp, soft, heavy, bouncy, not "snappy"/);
});

test('a name that is not a move refuses, listing the moves by kind', () => {
  assert.throws(() => moveAt('fadeslide', 0), /moveAt: no move called "fadeslide"; the moves are entrance: fade-slide, soft-rise, .*; exit: fade-slide-out, .*; feedback: shake, .*; ambient: marquee, pulse, float \(or \{name, kind, feel, uses, seconds, ease, props\} of your own\)/);
  assert.throws(() => readMove('constructor'), /no move called "constructor"/);
  assert.throws(() => readMove(42), /move: a move is a name \(fade-slide, soft-rise, mask-wipe, iris-open, …\) or \{name, kind, feel, uses, seconds, ease \| spring, props\}/);
});

test('a move of your own is data, checked against the vocabulary and the laws', () => {
  const nudge = { name: 'nudge-in', kind: 'entrance', feel: 'crisp', uses: ['ui'], seconds: .3, ease: 'cubic-bezier(0.16, 1, 0.3, 1)', props: { x: [30, 0], opacity: [0, 1] } };
  const m = readMove(nudge);
  assert.ok(Object.isFrozen(m) && m !== nudge && !Object.isFrozen(nudge) && readMove(m) === m, 'a frozen copy, given back as it is');
  assert.deepEqual(readMove(nudge), m, 'yours is checked each time it is given: the same move while it is the same');
  assert.ok(atRest(moveAt(nudge, 1)) && moveAt(nudge, .1).x > 0);
  const bad = (change, re) => assert.throws(() => readMove({ ...nudge, ...change }), re);
  bad({ kind: 'arrival' }, /move "nudge-in": kind is entrance, exit, feedback, ambient, not "arrival"/);
  bad({ feel: 'snappy' }, /feel is how it feels — smooth, crisp, soft, heavy, bouncy — not "snappy"/);
  bad({ uses: ['video'] }, /uses lists what it is for, from ui, text, logo, character, 3d/);
  bad({ spring: 'playful' }, /give it one curve: ease \(a name from the ease table\) or spring/);
  bad({ ease: 'wobble' }, /move "nudge-in": ease: "wobble" is not an ease/);
  bad({ ease: undefined, spring: 'playful' }, /move "nudge-in": its spring \(playful\) is still moving at 0.3 s: it comes within 1% of rest for good only at 0.593 s; give it seconds of at least 0.6$/);
  bad({ props: { x: [30, 10] } }, /move "nudge-in": an entrance ends at rest, and its x is not at rest there \(x rests at 0\)/);
  bad({ props: { spin: [1, 0] } }, /props.spin is not a property; a move animates opacity, x, y, scale, rotate, blur, clip, progress/);
  bad({ props: { clip: [0, 1] } }, /a move that animates clip names its mask \(left, right, top, bottom, iris\)/);
  bad({ props: { x: { rest: 0, wave: 4, cycles: 1.5 } } }, /props.x cycles is a whole number above 0 \(so a swing ends at rest\)/);
  bad({ props: { x: { from: 30, to: 0, span: [.5, .2] } } }, /props.x span is \[a, b\], the share of the move it runs over, 0 ≤ a < b ≤ 1/);
  bad({ loop: true }, /an ambient move loops \(loop: true\), and only an ambient move does/);
  bad({ split: 'word' }, /gives split \(word, letter\) and gap \(seconds between the pieces: 0.09 between words\) together/);
  bad({ pairs: 'fade-slide' }, /pairs names the entrance an exit closes; only an exit has it/);
  bad({ name: 'Nudge In' }, /a move's name is lower-case words joined by hyphens \(e.g. "soft-rise"\), not "Nudge In"/);
  bad({ speed: 2 }, /a move has no key speed/);
  assert.throws(() => readMove({ ...nudge, kind: 'feedback', props: { x: [0, 0], y: { rest: 2, wave: 1, cycles: 1 } } }), /feedback starts at rest, and its y is not at rest there/);
});

test('a spring move lasts until its spring has settled, not only until it passes its rest', () => {
  const popIn = { name: 'cut-short', kind: 'entrance', feel: 'bouncy', uses: ['ui'], spring: 'playful', props: { scale: [0, 1] } };
  // At 0.1558 s the playful spring is at 1 on its way up to its 19% overshoot: right where it is, but still moving.
  assert.ok(Math.abs(spring(.1558, 'playful') - 1) < .01);
  assert.throws(() => readMove({ ...popIn, seconds: .1558 }), /move "cut-short": its spring \(playful\) is still moving at 0.1558 s: it comes within 1% of rest for good only at 0.593 s; give it seconds of at least 0.6$/);
  assert.equal(readMove({ ...popIn, seconds: .6 }).seconds, .6, 'the number the refusal gives is enough');
  // The settling time is exact: after it the spring never strays 1% from rest again, and just before it, it does.
  const after = Array.from({ length: 4000 }, (_, i) => .593 + i / 1000).map((t) => Math.abs(1 - spring(t, 'playful')));
  assert.ok(after.every((d) => d < .01) && Math.abs(1 - spring(.5925, 'playful')) >= .01);
  for (const m of Object.values(MOVES).filter((m) => m.spring)) {
    const late = Array.from({ length: 200 }, (_, i) => m.seconds + i / 100).map((t) => Math.abs(1 - spring(t, m.spring)));
    assert.ok(late.every((d) => d < .01), `${m.name} has settled by its seconds`);
  }
});

test('a spring that does not settle within 10 s cannot drive a move, and the refusal says how long it would take', () => {
  assert.throws(() => moveAt('fade-slide', .1, { feel: { k: 1, d: .01 } }), /moveAt: the spring \{k: 1, d: 0.01\} takes 921 s to come within 1% of rest, and a move's spring must settle within 10 s: give it more damping \(d\) or more stiffness \(k\)/);
  assert.throws(() => readMove({ name: 'lazy', kind: 'entrance', feel: 'soft', uses: ['ui'], seconds: 10, spring: { k: 1, d: .05 }, props: { x: [10, 0] } }), /move "lazy": the spring \{k: 1, d: 0.05\} takes 183 s to come within 1% of rest/);
  assert.throws(() => moveAt('pop', 0, { feel: { k: 1, d: .5 } }), /moveAt: the spring \{k: 1, d: 0.5\} takes 17.27 s to come within 1% of rest/);
  assert.equal(moveAt('fade-slide', .4, { feel: { k: 4, d: 1 } }).y, 0, 'one that settles in time is fine, however slowly (8.6 s)');
});

test('a move of yours is read as it is now: a change after its first use counts, and what you pass is never frozen', () => {
  const mine = { name: 'nudge-in', kind: 'entrance', feel: 'crisp', uses: ['ui'], seconds: .3, ease: 'outQuint', props: { x: [30, 0] } };
  const before = moveAt(mine, .15).x;
  mine.seconds = 3; mine.props.x = [300, 0];
  assert.equal(moveAt(mine, .15).x, 300 * (1 - EASES.outQuint(.05)), 'the new seconds and the new start');
  assert.notEqual(moveAt(mine, .15).x, before);
  mine.kind = 'nonsense';
  assert.throws(() => moveAt(mine, 1), /moveAt "nudge-in": kind is entrance, exit, feedback, ambient, not "nonsense"/);
  const feel = { k: 200, d: 30 }, sprung = { ...mine, kind: 'entrance', seconds: 1.5, ease: undefined, spring: feel };
  const m = readMove(sprung);
  assert.ok(!Object.isFrozen(feel) && !Object.isFrozen(sprung) && !Object.isFrozen(sprung.props) && Object.isFrozen(m.spring) && m.spring !== feel, 'your spring stays yours; the move keeps its own copy');
  feel.d = 2;
  assert.equal(m.spring.d, 30, 'and a change to yours does not reach the copy');
});
