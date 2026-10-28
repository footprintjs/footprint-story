import test from 'node:test';
import assert from 'node:assert/strict';
import { FEELS, FEEL_NAMES, readFeel, spring, settleTime, pop, track } from '../src/motion/spring.js';

test('a spring starts at 0, ends at 1, and only the light feels overshoot', () => {
  for (const name of FEEL_NAMES) {
    assert.equal(spring(0, name), 0); assert.equal(spring(-1, name), 0);
    assert.ok(Math.abs(spring(10, name) - 1) < 1e-6, `${name} arrives`);
  }
  const peak = (name) => Math.max(...Array.from({ length: 600 }, (_, i) => spring(i / 240, name)));
  assert.ok(peak('playful') > 1.05, 'playful pops past its end');
  assert.ok(peak('heavy') <= 1.01, 'heavy barely passes it');
});

test('settleTime: when a feel arrives for good; snappy first, then default, then heavy and playful', () => {
  const t = Object.fromEntries(FEEL_NAMES.map((n) => [n, settleTime(n)]));
  assert.ok(t.snappy < t.default && t.default < t.heavy, JSON.stringify(t));
  for (const [name, s] of Object.entries(t)) for (let u = s; u < s + 2; u += 1 / 60) assert.ok(Math.abs(1 - spring(u, name)) <= .005, `${name} stays within half a percent after ${s}`);
  assert.throws(() => settleTime('default', { within: 0 }), /settleTime: within is how near the end counts as arrived/);
});

test('feels: a name or {k, d}; anything else refuses, naming the feels', () => {
  assert.equal(readFeel('heavy'), FEELS.heavy);
  assert.deepEqual(readFeel({ k: 10, d: 2 }), { k: 10, d: 2 });
  assert.throws(() => readFeel('wobbly'), /no feel called "wobbly" \(the feels are snappy, default, heavy, playful/);
  assert.throws(() => readFeel({ k: 0, d: 1 }), /a stiffness and a damping, both above 0/);
});

test('pop and track: a pop is a spring from its moment; a track never jumps between its targets', () => {
  assert.equal(pop(1.5, 1), spring(.5, 'playful'));
  const keys = [[0, 800], [1, 420], [1.05, 600]];
  for (let t = 0; t < 3; t += 1 / 240) assert.ok(Math.abs(track(t + 1 / 240, keys) - track(t, keys)) < 40, `continuous at ${t}`);
  assert.ok(Math.abs(track(5, keys) - 600) < 1e-3);
  assert.throws(() => track(0, []), /track: keys are \[\[time, value\], …\]/);
});
