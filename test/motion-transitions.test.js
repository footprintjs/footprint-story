import test from 'node:test';
import assert from 'node:assert/strict';
import { TRANSITIONS, TRANSITION_NAMES, FAMILIES, checkTransition, extendTransitions, readTransition } from '../src/motion/transitions.js';
import { readSettings } from '../src/motion/settings.js';

test('the shared collection: every family an editor keeps, each entry valid by the same check a drawer\'s own passes', () => {
  assert.deepEqual(FAMILIES, ['cut', 'dissolve', 'wipe', 'iris', 'motion', 'zoom', 'page', 'match']);
  for (const name of TRANSITION_NAMES.filter((n) => n !== 'cut')) assert.doesNotThrow(() => checkTransition(TRANSITIONS[name], name), name);
  assert.ok(Object.isFrozen(TRANSITIONS.push.params.from), 'data, frozen all the way down');
});

test('readTransition: a name or {type, …settings}, defaults filled in; a cut takes nothing else', () => {
  assert.deepEqual(readTransition('push', 'click 3'), { type: 'push', family: 'motion', seconds: .7, ease: 'inOut', sound: 'slide', p: { from: 'right' } });
  assert.deepEqual(readTransition({ type: 'wipe', from: 'top', seconds: .5, sound: false }, 'click 3'), { type: 'wipe', family: 'wipe', seconds: .5, ease: 'inOut', sound: null, p: { from: 'top' } });
  assert.equal(readTransition('cut', 'x').seconds, 0);
  assert.throws(() => readTransition({ type: 'cut', seconds: 1 }, 'x'), /x: a cut takes no seconds and no centre/);
  assert.throws(() => readTransition({ type: 'push', from: 'up' }, 'x'), /x: enter.from must be left, right, top, bottom/);
  assert.throws(() => readTransition({ type: 'push', color: '#fff' }, 'x'), /x: enter has unsupported key color \(a push takes seconds, ease, sound, from\)/);
  assert.throws(() => readTransition({ type: 'push', seconds: 9 }, 'x'), /enter.seconds must be between 0.2 and 4/);
  assert.throws(() => readTransition('dissolve', 'x', { more: '; or a move' }), /x: enter must be a transition: cut, fade, .* \(not "dissolve"\); or a move/);
});

test('a point\'s default is the middle of whatever frame the change is drawn on', () => {
  assert.deepEqual(readTransition('iris', 'x').p.at, [800, 450], 'a film\'s 1600×900');
  assert.deepEqual(readTransition('zoom', 'x', { frame: [1920, 1080] }).p.at, [960, 540], 'a deck\'s 1920×1080');
  assert.deepEqual(readTransition({ type: 'iris', at: [100, 200] }, 'x', { frame: [1920, 1080] }).p.at, [100, 200]);
  assert.deepEqual(readSettings({ at: { point: true, default: 'centre' } }, {}, 'x', { frame: [10, 20] }), { at: [5, 10] });
});

test('an ease that overshoots only where the frame\'s edge cannot show', () => {
  assert.throws(() => readTransition({ type: 'push', ease: 'outBack' }, 'x'), /a push cannot take the ease "outBack" .*; slide can/);
  assert.equal(readTransition({ type: 'slide', ease: 'outBack' }, 'x').ease, 'outBack');
});

test('a drawer adds its own, checked; it may not take a shared name', () => {
  const swirl = { family: 'wipe', seconds: .6, ease: 'inOut', sound: null, params: { turns: { number: [1, 4], default: 2 } }, draw: () => {} };
  const all = extendTransitions(TRANSITIONS, { swirl }, { who: 'the kit "x"\'s transition', extra: ['draw'] });
  assert.equal(readTransition({ type: 'swirl', turns: 3 }, 'x', { catalog: all }).p.turns, 3);
  assert.throws(() => extendTransitions(TRANSITIONS, { swirl }), /has unsupported key draw/);
  assert.throws(() => extendTransitions(TRANSITIONS, { push: swirl }, { extra: ['draw'] }), /"push" has a name the collection already has/);
  assert.throws(() => extendTransitions(TRANSITIONS, { Swirl: swirl }, { extra: ['draw'] }), /one word in camelCase/);
  assert.throws(() => checkTransition({ ...swirl, params: { move: { oneOf: ['a'], default: 'a' } } }, 'mine', { extra: ['draw'] }), /a setting may not be called "move"/);
  assert.throws(() => checkTransition({ ...swirl, params: { at: { name: true } } }, 'mine', { extra: ['draw'] }), /no regions\(p\) to look it up/);
});

test('the match family says which things it looks for, in the picture it leaves and the one it arrives at', () => {
  assert.deepEqual(TRANSITIONS.through.regions({ region: 'window' }), { from: ['window'] });
  assert.deepEqual(TRANSITIONS.match.regions({ region: 'cup', into: null }), { from: ['cup'], to: ['cup'] });
  assert.deepEqual(TRANSITIONS.match.regions({ region: 'cup', into: 'mug' }), { from: ['cup'], to: ['mug'] });
  assert.throws(() => readTransition('through', 'x'), /x: a through needs enter.region: the name of a thing in the picture/);
});

test('a drawer\'s transition is refused with the fix, whatever is wrong with it', () => {
  const ok = { family: 'wipe', seconds: .6, ease: 'inOut', sound: null };
  const refused = [
    [null, /must be \{family, seconds, ease, sound, params\?\}/],
    [{ ...ok, colour: 1 }, /has unsupported key colour/],
    [{ ...ok, family: ' ' }, /needs a family/],
    [{ ...ok, seconds: 9 }, /seconds must be between 0.2 and 4/],
    [{ ...ok, ease: 'nope' }, /"nope" is not an ease/],
    [{ ...ok, sound: 3 }, /sound must be null or a sound's name/],
    [{ ...ok, hitAt: 1 }, /hitAt is where in the change its sound hits/],
    [{ ...ok, overshoot: 'yes' }, /overshoot must be true or false/],
    [{ ...ok, regions: [] }, /regions must be p =>/],
    [{ ...ok, params: [] }, /params must be \{name:/],
    [{ ...ok, params: { side: { oneOf: [1], default: 1 } } }, /the setting "side" lists its choices as words/],
    [{ ...ok, params: { size: { number: [4, 1], default: 2 } } }, /the setting "size" gives number as \[min, max\]/],
    [{ ...ok, params: { size: { number: [1, 4], default: 9 } } }, /enter.size must be a number 1–4/],
    [{ ...ok, params: { at: { point: false, default: [0, 0] } } }, /the setting "at" must be one of/],
  ];
  for (const [def, why] of refused) assert.throws(() => checkTransition(def, 'mine'), why, JSON.stringify(def));
  assert.equal(checkTransition({ ...ok, params: { at: { point: true, default: 'centre' } } }, 'mine').params.at.default, 'centre');
});
