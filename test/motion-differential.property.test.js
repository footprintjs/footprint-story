// The differential properties of motion/: the door gives what StoryReel 0.23.0 gave, before the code moved here. The
// CONTROLS are that code, copied and never edited (test/control/README.md). The one difference on purpose — a point's
// default may be 'centre', the frame's middle — is left out of the settings generator and named in the CHANGELOG.
// FC_RUNS=200000 npm test runs a deep sweep.
import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import * as ease0 from './control/storyreel-0.23.0-ease.mjs';
import * as motion0 from './control/storyreel-0.23.0-motion.mjs';
import * as moves0 from './control/storyreel-0.23.0-moves.mjs';
import * as settings0 from './control/storyreel-0.23.0-settings.mjs';
import { EASES, EASE_NAMES, bezier, easeNamed, overshoots, spring, settleTime, track, readFeel, MOVES, MOVE_NAMES, readMove, moveAt, stagger, movesBy, readSettings } from '../motion.js';

const RUNS = Number(process.env.FC_RUNS) || 3000;
/** What a call gives, or the words it refuses with: the two must agree on both. */
const outcome = (f) => { try { return { value: f() }; } catch (e) { return { error: e.message }; } };
const same = (a, b) => assert.deepEqual(outcome(a), outcome(b));

const u = fc.oneof(fc.double({ min: -1, max: 2, noNaN: true }), fc.constantFrom(0, 1, .5, -0, 1e-12, 1 - 1e-12));
const unit = fc.double({ min: 0, max: 1, noNaN: true });
const y = fc.double({ min: -3, max: 3, noNaN: true });
const cssCurve = fc.tuple(unit, y, unit, y).map((p) => `cubic-bezier(${p.join(', ')})`);
const easeName = fc.oneof(fc.constantFrom(...EASE_NAMES, 'nope', 'cubic-bezier(2, 0, 0, 1)', 'cubic-bezier(a, 0, 0, 1)'), cssCurve);
const feel = fc.oneof(fc.constantFrom('snappy', 'default', 'heavy', 'playful', 'wobbly'), fc.record({ k: fc.double({ min: 1, max: 500, noNaN: true }), d: fc.double({ min: .5, max: 60, noNaN: true }) }));

test('ease: every curve by name or as CSS writes it, at every u, and every refusal, as StoryReel 0.23.0 drew it', () => {
  assert.deepEqual(EASE_NAMES, ease0.EASE_NAMES);
  fc.assert(fc.property(easeName, u, (name, at) => {
    same(() => easeNamed(name, 'x')(at), () => ease0.easeNamed(name, 'x')(at));
    same(() => overshoots(name), () => ease0.overshoots(name));
  }), { numRuns: RUNS });
  fc.assert(fc.property(fc.tuple(fc.double({ noNaN: false }), y, unit, y), u, (p, at) => same(() => bezier(...p)(at), () => ease0.bezier(...p)(at))), { numRuns: RUNS });
  for (const name of EASE_NAMES) assert.equal(EASES[name](.37), ease0.EASES[name](.37), name);
});

test('spring: the same value at every moment, the same settling and the same tracks, for every feel', () => {
  fc.assert(fc.property(fc.double({ min: -1, max: 5, noNaN: true }), feel, (t, f) => {
    same(() => spring(t, f), () => motion0.spring(t, f));
    same(() => readFeel(f), () => motion0.readFeel(f));
  }), { numRuns: RUNS });
  for (const f of ['snappy', 'default', 'heavy', 'playful', { k: 60, d: 4 }]) assert.equal(settleTime(f), motion0.settleTime(f));
  const keys = fc.array(fc.tuple(fc.double({ min: 0, max: 5, noNaN: true }), fc.double({ min: -1000, max: 1000, noNaN: true })), { minLength: 1, maxLength: 5 }).map((ks) => ks.sort((a, b) => a[0] - b[0]));
  fc.assert(fc.property(fc.double({ min: -1, max: 8, noNaN: true }), keys, feel, (t, ks, f) => same(() => track(t, ks, f), () => motion0.track(t, ks, f))), { numRuns: RUNS });
});

test('moves: the same table, and every move at every moment with every option, as StoryReel 0.23.0 played it', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(MOVES)), JSON.parse(JSON.stringify(moves0.MOVES)));
  const options = fc.record({ start: fc.double({ min: -1, max: 2, noNaN: true }), seconds: fc.oneof(fc.constant(undefined), fc.double({ min: .05, max: 3, noNaN: true })), feel: fc.oneof(fc.constant(undefined), fc.constantFrom('smooth', 'crisp', 'soft', 'heavy', 'bouncy'), feel), reduced: fc.boolean() }, { requiredKeys: ['start', 'reduced'] })
    .map((o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)));
  fc.assert(fc.property(fc.constantFrom(...MOVE_NAMES, 'nope'), fc.double({ min: -1, max: 6, noNaN: true }), options, (name, t, o) => same(() => moveAt(name, t, o), () => moves0.moveAt(name, t, o))), { numRuns: RUNS });
  for (const filter of [{}, { feel: 'heavy' }, { use: 'text' }, { kind: 'ambient' }, { feel: 'bouncy', use: 'logo' }, { feel: 'nope' }, { size: 1 }]) same(() => movesBy(filter).map((m) => m.name), () => moves0.movesBy(filter).map((m) => m.name));
  for (const gap of ['text-reveal-word', 'text-reveal-letter', 'slam', .2, -1]) same(() => stagger(['a', 'b', 'c'], gap), () => moves0.stagger(['a', 'b', 'c'], gap));
});

test('moves of your own: checked by the same laws, refused with the same words', () => {
  const prop = fc.oneof(fc.tuple(fc.integer({ min: -50, max: 50 }), fc.constantFrom(0, 10)), fc.record({ rest: fc.constantFrom(0, 1), wave: fc.integer({ min: 1, max: 9 }), cycles: fc.integer({ min: 0, max: 3 }) }));
  const mine = fc.record({
    name: fc.constantFrom('nudge-in', 'Bad Name', 'wave'), kind: fc.constantFrom('entrance', 'exit', 'feedback', 'ambient', 'other'), feel: fc.constantFrom('smooth', 'crisp', 'odd'),
    uses: fc.constantFrom(['ui'], ['text', 'logo'], [], ['tv']), seconds: fc.constantFrom(.3, 1, 0, 12), ease: fc.constantFrom('outQuint', 'linear', 'nope'),
    props: fc.dictionary(fc.constantFrom('x', 'y', 'opacity', 'scale', 'colour'), prop, { maxKeys: 2 }), loop: fc.constantFrom(undefined, true),
  }).map((m) => Object.fromEntries(Object.entries(m).filter(([, v]) => v !== undefined)));
  fc.assert(fc.property(mine, (m) => same(() => readMove(structuredClone(m), 'mine'), () => moves0.readMove(structuredClone(m), 'mine'))), { numRuns: RUNS });
});

test('settings: every kind read and refused with the same words (a point\'s \'centre\' default aside: new)', () => {
  const spec = fc.constantFrom({ from: { oneOf: ['left', 'right'], default: 'left' } }, { at: { point: true, default: [800, 450] } }, { color: { color: true, default: '#000000' } }, { tint: { color: true, default: null } },
    { box: { box: true, default: [0, 0, 10, 10] } }, { turns: { number: [1, 4], default: 2 } }, { region: { name: true } }, { into: { name: true, default: null } });
  const value = fc.oneof(fc.constant(undefined), fc.constantFrom('left', 'up', [1, 2], [1], '#fff', '#ggg', null, [0, 0, 5, 5], [5, 5, 0, 0], 3, 9, 'door', '  ', 0));
  fc.assert(fc.property(spec, value, (params, v) => {
    const name = Object.keys(params)[0], given = v === undefined ? { type: 'push' } : { type: 'push', [name]: v };
    same(() => readSettings(params, given, 'stage b'), () => settings0.readSettings(params, given, 'stage b'));
  }), { numRuns: RUNS });
});
