// The spin critic at a track's ends (found in the second read of 0.31.0): a sample's own `spin` is a claim, the angles
// drawn are the track. Where a run touches an end one side is missing, and the sample there may say only that the move
// is at rest. A final `spin` set to exactly the rate a flick implies agrees with the flick; 0.31.0's rule (the run's own
// reported turn joins the span) explained every run its rates agreed with, so such a flick hid (30°: value 6e-14).
// Hand-made tracks, read directly, so every step is exactly 1/120 s and the reported rate matches the drawn turn.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spin, SPIN_MOST } from '../src/human/critics/spin.js';

const D = Math.PI / 180, RATE = 120, N = 240, W = 20;   // 2 s at 120 a second, a steady 20 rad/s
/** A steady spin's samples, each one bent by `edit(sample, k)`. */
const track = (edit = () => {}) => ({ samples: Array.from({ length: N + 1 }, (_, k) => { const s = { t: k / RATE, x: k, y: 0, angle: (W * k) / RATE, spin: W }; edit(s, k); return s; }) });
const flicked = (m, why) => { assert.ok(m.value > SPIN_MOST, `${why}: ${m.value}`); assert.equal(m.basis.kind, 'jump', why); };
const passes = (m, why) => assert.ok(m.value <= SPIN_MOST, `${why}: ${m.value}`);

test('a flick on the last sample is caught even when that sample\'s own spin is the exact rate the flick implies', () => {
  for (const deg of [30, -30, 180, -180]) {
    const m = spin.measure(track((s, k) => {
      // the last step's reported turn, (20 + spin) / 2 × dt, equal to the drawn one: 20 dt + the flick
      if (k === N) { s.angle += deg * D; s.spin = W + 2 * deg * D * RATE; }
    }));
    flicked(m, `${deg}° on the last sample, its spin matching`);
    assert.equal(m.basis.at, (N - 0.5) / RATE, `${deg}°: the last step`);
    assert.equal(m.basis.steps, 1);
  }
});

test('a flick on the first sample is caught the same way; one only slower first, the same way, is a start (stated)', () => {
  for (const deg of [30, -30, 180, -180]) {
    // the first step's reported turn, (spin + 20) / 2 × dt, equal to the drawn one: 20 dt − the flick
    flicked(spin.measure(track((s, k) => { if (k === 0) { s.angle += deg * D; s.spin = W - 2 * deg * D * RATE; } })), `${deg}° on the first sample, its spin matching`);
  }
  // WHY it passes: nothing comes before the first sample, and a first step slower the same way, then steady, is how a
  // move sets off at once — the allowance the critic states (setsOff), not a reading of the sample's own spin
  passes(spin.measure(track((s, k) => { if (k === 0) { s.angle += 5 * D; s.spin = W - 2 * 5 * D * RATE; } })), 'a +5° first sample: a start');
});

test('a true stop at the end gives no finding — the last sample says it is at rest, and the angles agree', () => {
  // the last step slows evenly to rest (turns half the steady step) or stops halfway through it (a quarter)
  for (const share of [0.5, 0.25]) {
    const stop = (s, k) => { if (k === N) { s.angle = (W * (N - 1)) / RATE + (share * W) / RATE; s.spin = 0; } };
    const m = spin.measure(track(stop));
    passes(m, `stopped, the last step turning ${share} of a steady one`);
    // the same angles with the last sample still reporting the steady spin: nothing says it stopped, and a lone last
    // step slower than a steady spin is a flick
    flicked(spin.measure(track((s, k) => { stop(s, k); if (k === N) s.spin = W; })), `the same last step, its spin still ${W}`);
  }
  // at rest says "no turn" and nothing more: it never explains a turn the other way, nor more than the inside says
  flicked(spin.measure(track((s, k) => { if (k === N) { s.angle -= 30 * D; s.spin = 0; } })), 'a −30° flick on a sample at rest');
  flicked(spin.measure(track((s, k) => { if (k === N) { s.angle += 30 * D; s.spin = 0; } })), 'a +30° flick on a sample at rest');
});

test('easing to rest gives no finding, with or without the samples\' own spin', () => {
  // 20 t − 5 t²: its spin 20 − 10 t reaches 0 at the end, slower every step
  for (const spun of [true, false]) {
    const m = spin.measure(track((s) => { const t = s.t; s.angle = W * t - 5 * t * t; if (spun) s.spin = W - 10 * t; else delete s.spin; }));
    assert.ok(m.value < 1e-9, `easing to rest${spun ? '' : ', no spin'}: ${m.value}`);
  }
});
