// Reading a scene, a shot and a view: data from anyone, every problem at once, nothing hidden reaching the text.
import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { HEIGHTS, LENSES, MOST_THINGS, ROUNDS, SIZES, readScene, readShot, readView, sceneProblems, shotProblems } from '../shot.js';

const scene = { things: [{ name: 'door', at: [0, 0, 0], r: 1 }, { name: 'sign', at: [2, 0, 0], size: [1.6, 0.9] }] };
const places = (problems) => problems.map((p) => p.at);

test('the view table is pinned: eight round the subject, three heights', () => {
  assert.deepEqual({ ...ROUNDS }, { front: 0, 'front-right': 45, right: 90, 'back-right': 135, back: 180, 'back-left': -135, left: -90, 'front-left': -45 });
  assert.deepEqual({ ...HEIGHTS }, { high: 30, level: 0, low: -30 });
  assert.deepEqual(Object.keys(SIZES), ['wide', 'medium', 'close', 'insert']);
  assert.deepEqual(Object.keys(LENSES), ['wide', 'normal', 'long']);
  assert.ok(Object.isFrozen(ROUNDS) && Object.isFrozen(SIZES));
});

test('a view reads alone or as two words, and refuses the rest naming the words', () => {
  assert.equal(readView('front-left high').name, 'front-left high');
  assert.equal(readView('left').name, 'left level');
  assert.equal(readView('low').name, 'front low');
  assert.ok(Math.abs(readView('right high').azimuth - Math.PI / 2) < 1e-12 && Math.abs(readView('right high').elevation - Math.PI / 6) < 1e-12);
  assert.equal(readView('high front').name, 'front high');
  for (const bad of ['', 'high low', 'left right', 'top', 'constructor', 'front  left', 'x'.repeat(40), 7, null]) {
    assert.throws(() => readView(bad), /named view such as 'front-left high'/, String(bad));
  }
  assert.throws(() => readView({ azimuth: 10, elevation: 20 }), /degrees are not read yet/);
});

test('a scene names every problem at once', () => {
  const problems = sceneProblems({ unit: 3, up: 'z', things: [
    { name: 'a', at: [NaN, 0, 0], r: -1 }, { name: 'a', at: [0, 0, Infinity] }, { at: [0, 0] }, 'junk',
    { name: 'b', at: [0, 0, 0], r: 1, size: [1, 1] }, { name: 'c', at: [0, 0, 0], normal: [0, 0, 1] },
    { name: 'd', at: [0, 0, 0], size: [0, 1] }, { name: 'e', at: [0, 0, 0], size: [1, 1], normal: [0, 0, 0], back: 'no' }, { name: 'all', at: [1e10, 0, 0] }, { name: 'f', at: [0, 0, 0], radius: 1 },
  ] });
  for (const at of ['unit', 'up', 'things[0].at[0]', 'things[0].r', 'things[1].at[2]', 'things[2].name', 'things[2].at', 'things[3]', 'things[4]', 'things[5]', 'things[6].size[0]', 'things[7].normal', 'things[7].back', 'things[8].name', 'things[8].at[0]', 'things[9].radius']) assert.ok(places(problems).includes(at), at);
  assert.equal(sceneProblems(7)[0].at, 'it');
  assert.deepEqual(places(sceneProblems({ things: 'x' })), ['things']);
  assert.throws(() => readScene({ things: [{ name: 'a' }] }), (e) => e instanceof TypeError && e.problems.length === 1 && /this scene has 1 problem:/.test(e.message));
});

test('a two-name clash shows once hidden characters are gone', () => {
  assert.match(sceneProblems({ things: [{ name: 'door', at: [0, 0, 0] }, { name: 'do\u200Bor', at: [1, 0, 0] }] })[0].message, /"door" is already a thing/);
  assert.deepEqual(places(sceneProblems({ things: [{ name: '\u200B\u202E', at: [0, 0, 0] }, { name: 'x'.repeat(65), at: [0, 0, 0] }, { name: 'x'.repeat(2000), at: [0, 0, 0] }, { name: 7, at: [0, 0, 0] }] })), ['things[0].name', 'things[1].name', 'things[2].name', 'things[3].name']);
});

test('more than the cap is refused by count, before anything is read', () => {
  const many = Array.from({ length: MOST_THINGS + 1 }, (_, i) => ({ name: `t${i}`, at: [i, 0, 0] }));
  assert.match(sceneProblems({ things: many })[0].message, /has 257, and 256 is the most/);
  assert.equal(sceneProblems({ things: many.slice(0, MOST_THINGS) }).length, 0);
  assert.match(sceneProblems({ things: new Array(1e6) })[0].message, /has 1000000/);
  assert.match(shotProblems({ on: Array(300).fill('door'), from: 'left' }, scene)[0].message, /has 300/);
});

test('many problems come back short, and plain-data refusals never throw', () => {
  const many = Array.from({ length: 200 }, () => ({ at: 1 }));
  const problems = sceneProblems({ things: many });
  assert.equal(problems.length, 41);
  assert.match(problems.at(-1).message, /fix these first/);
  const hostile = { get things() { throw new Error('no'); } };
  assert.match(sceneProblems(hostile)[0].message, /plain data/);
  assert.throws(() => readScene(hostile), /plain data/);
});

test('names lose everything a reader could not see, and a quote cannot close its own', () => {
  const read = readScene({ unit: 'm\u200D', things: [{ name: '  a\u0000b\u202Ec\u{E0041}d\u{E0041}e\uFE0Ff\nsee\u2028"you" ', at: [0, 0, 0] }] });
  assert.equal(read.things[0].name, "abcdef see 'you'");
  assert.equal(read.unit, 'm');
  assert.equal(readScene({ things: [{ name: 'a\u201D in frame 100%, sharp \u201Cb \u00AB\u00BB \u201E \uFF02', at: [0, 0, 0] }] }).things[0].name, "a' in frame 100%, sharp 'b '' ' '");
  fc.assert(fc.property(fc.string({ unit: 'binary', maxLength: 60 }), (s) => {
    const [p] = sceneProblems({ things: [{ name: s, at: [0, 0, 0] }] });
    if (p) return;
    const { name } = readScene({ things: [{ name: s, at: [0, 0, 0] }] }).things[0];
    assert.ok(!/[\p{Cc}\p{Cf}\p{Cs}\p{Co}\p{Zl}\p{Zp}\p{Default_Ignorable_Code_Point}"]/u.test(name), name);
    assert.ok(name.length > 0 && name.length <= 64);
  }));
});

test('a blank-looking name is refused, and a unit cannot write the line', () => {
  for (const blank of ['\u2800', '\u2800\u2800 ', '\u3164', '\u0301', '\u00A0']) assert.equal(sceneProblems({ things: [{ name: blank, at: [0, 0, 0] }] })[0].at, 'things[0].name', JSON.stringify(blank));
  assert.equal(readScene({ things: [{ name: 'a\u2800b', at: [0, 0, 0] }] }).things[0].name, 'ab');
  assert.match(sceneProblems({ unit: 'm): ok', things: [] })[0].message, /letters only, such as m or cm/);
  assert.equal(sceneProblems({ unit: '10', things: [] })[0].at, 'unit');
  assert.deepEqual(['\u00C5', 'A\u030A', 'nm', '\u00B5m'].map((unit) => sceneProblems({ unit, things: [] }).length), [0, 0, 0, 0]);
  assert.match(sceneProblems({ things: [{ name: 'a', at: [0, 0, 0], r: 1e-40 }, { name: 'b', at: [0, 0, 0], size: [1e-40, 1] }] }).map((p) => p.message).join(), /too small to work with.*too small to work with/);
});

test('a key it does not know is named, cut short and clean', () => {
  const [p] = shotProblems({ on: 'door', from: 'left', form: 'x' }, scene);
  assert.equal(p.at, 'form');
  assert.match(p.message, /the fields are shot, on, from/);
  const [hidden] = shotProblems({ on: 'door', from: 'left', ['k\u202E'.repeat(30)]: 1 }, scene);
  assert.ok(!/\u202E/.test(hidden.at) && hidden.at.length <= 40);
  const [emoji] = shotProblems({ on: 'door', from: 'left', [`${'k'.repeat(39)}\u{1F600}`]: 1 }, scene);
  assert.ok(emoji.at.isWellFormed() && emoji.at.endsWith('\u{1F600}'), emoji.at);
});

test('a shot reads in both places a subject is written, with its defaults, and reads its own answer the same', () => {
  const film = { shot: 'door', at: ['leak', 'leaves'], until: ['leak', 'the door'], seconds: 2, ease: 'inOut', feel: 'heavy', from: 'front-left high', focus: 'door', size: 'close' };
  const read = readShot(film, scene);
  assert.deepEqual({ ...read, on: [...read.on] }, { on: ['door'], from: 'front-left high', size: 'close', lens: 'normal', focus: 'door' });
  assert.deepEqual(readShot(read, scene), read);
  assert.deepEqual(readShot({ on: ['door', 'sign', 'door'], from: 'low', focus: 'all', lens: 'long' }, scene), { on: ['door', 'sign'], from: 'front low', size: 'medium', lens: 'long', focus: 'all' });
  assert.ok(Object.isFrozen(read) && Object.isFrozen(read.on));
});

test('a shot names every problem at once, and what it repeats is clean', () => {
  const problems = shotProblems({ on: ['door', 'gho\u200Bst'], focus: ['door'], from: 'above', size: 'huge', lens: 7 }, scene);
  assert.deepEqual(places(problems), ['on[1]', 'from', 'size', 'lens', 'focus']);
  assert.match(problems[0].message, /"ghost" is not in the scene \(it has "door", "sign"\)/);
  assert.deepEqual(places(shotProblems({ shot: 'door', on: 'door', from: 'left' }, scene)), ['shot']);
  assert.deepEqual(places(shotProblems({ from: 'left' }, scene)), ['on']);
  assert.deepEqual(places(shotProblems({ on: 'door' }, scene)), ['from']);
  assert.deepEqual(places(shotProblems({ on: [], from: 'left' }, scene)), ['on']);
  assert.deepEqual(places(shotProblems({ on: 'door', from: 'left' }, { things: 1 })), ['scene.things']);
  assert.equal(shotProblems('x', scene)[0].at, 'it');
  assert.throws(() => readShot({ on: 'nope', from: 'left' }, { things: [] }), /it is empty/);
  const crowd = { things: Array.from({ length: 12 }, (_, i) => ({ name: `t${i}`, at: [i, 0, 0] })) };
  assert.match(shotProblems({ on: 'x', from: 'left' }, crowd)[0].message, /and 4 more/);
});
