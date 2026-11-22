// The critics of footprint-story/human: each measures a sampled track and, past its limit, says in words what looks
// wrong — naming the entry — and the fix in the intent's own keys. A tool's own critic under its prefix.
import test from 'node:test';
import assert from 'node:assert/strict';
import { planMove, checkMove, catmullRom, arcTable, pointAt, HUMAN_CRITICS, FINDING_LEVELS, ARC_LEAST, PEN_SPEED_MOST, JERK_PEAK_SHARE } from '../human.js';
import { speedPeaks, speedsOf } from '../src/human/critics/track.js';
import { penSpeed } from '../src/human/critics/penSpeed.js';

/** A tool's reach that stops half way and starts again: two pushes where one was planned. */
const twitchy = { family: 'reach', name: 'test:twitchy', checks: ['jerk', 'arc'],
  plan: (intent) => ({ seconds: 1, from: intent.from, to: intent.to }),
  sample(plan, t) { const u = Math.max(0, Math.min(1, t)), s = u < 0.5 ? 0.5 * (1 - Math.cos(2 * Math.PI * u)) / 2 : 0.5 + 0.5 * (1 - Math.cos(2 * Math.PI * (u - 0.5))) / 2;
    return { x: plan.from[0] + (plan.to[0] - plan.from[0]) * s, y: plan.from[1] + (plan.to[1] - plan.from[1]) * s }; } };
/** A tool's pen that keeps one speed whatever the line does: a plotter. */
const steady = { family: 'pen', name: 'test:steady', checks: ['pen-speed'],
  plan(intent) { const c = catmullRom(intent.path, { spacing: 2 }); return { seconds: arcTable(c).length / 400, points: c.map((p) => [...p]) }; },
  sample(plan, t) { const tab = arcTable(plan.points), p = pointAt(tab, Math.max(0, Math.min(1, t / plan.seconds)) * tab.length); return { x: p[0], y: p[1] }; } };
const models = [twitchy, steady];
const curl = Array.from({ length: 9 }, (_, i) => [200 + i * 80, 400 + 120 * Math.sin(i)]);
const ellipse = Array.from({ length: 40 }, (_, i) => [500 + 300 * Math.cos((i / 39) * 2 * Math.PI * 0.98), 400 + 60 * Math.sin((i / 39) * 2 * Math.PI * 0.98)]);

test("this package's models pass their own critics", () => {
  assert.deepEqual(HUMAN_CRITICS, ['jerk', 'pen-speed', 'arc', 'spacing', 'volume', 'contact', 'stretch', 'pen-lifts', 'stroke-order', 'hatch-gaps']);
  assert.deepEqual(checkMove(planMove({ do: 'reach', from: [100, 500], to: [800, 300] })).findings, []);
  for (const path of [curl, ellipse]) {
    const c = checkMove(planMove({ do: 'draw', name: 'w', path }));
    assert.deepEqual(c.findings, []); assert.ok(c.measures['pen-speed'] < PEN_SPEED_MOST / 2, `${c.measures['pen-speed']}`);
  }
  const letter = checkMove(planMove({ do: 'write', points: [[0, 0], [30, 60], [60, 0], [90, 60]] }));
  assert.deepEqual(letter, { measures: { jerk: 0 }, bases: { jerk: null }, findings: [] });
  assert.ok(Object.isFrozen(letter) && Object.isFrozen(letter.measures) && Object.isFrozen(letter.findings));
});

test('jerk: a reach that stops and starts has a speed peak too many — said with the entry and the fix', () => {
  const c = checkMove(planMove({ do: 'reach', who: 'blocks[2] ("hand")', from: [0, 0], to: [400, 100], model: 'test:twitchy' }, { models }), { models });
  assert.equal(c.measures.jerk, 1);
  assert.deepEqual(c.findings[0], { critic: 'jerk', level: 'warn', message: 'blocks[2] ("hand"): its move has 1 speed peak more than the pushes it was planned as — it stops and starts, and reads as twitchy',
    fix: "use do: 'reach' for one smooth push (model: 'min-jerk'), or do: 'write' for strokes that overlap", basis: null });
  assert.equal(c.findings[1].critic, 'arc', 'and it runs straight');
  assert.match(c.findings[1].message, /^blocks\[2\] \("hand"\): its move runs straight \(it bows 0\.0% of its length\)/);
  assert.equal(c.findings[1].fix, "bow it: model: {name: 'min-jerk', bend: 0.06}");
});

test('arc: a straight reach is found; a bowed one is not; a move of no length cannot be measured', () => {
  const straight = checkMove(planMove({ do: 'reach', name: 'head', from: [0, 0], to: [300, 0], model: { name: 'min-jerk', bend: 0 } }));
  assert.equal(straight.findings.length, 1); assert.match(straight.findings[0].message, /^"head": its move runs straight/);
  const bowed = checkMove(planMove({ do: 'reach', from: [0, 0], to: [300, 0], model: { name: 'min-jerk', bend: ARC_LEAST * 1.5 } }));
  assert.deepEqual(bowed.findings, []);
  const slight = checkMove(planMove({ do: 'reach', from: [0, 0], to: [300, 0], model: { name: 'min-jerk', bend: ARC_LEAST / 2 } }));
  assert.match(slight.findings[0].message, /bows 1\.0% of its length/, 'a bow under the limit is still found');
  const still = checkMove(planMove({ do: 'reach', from: [7, 7], to: [7, 7] }));
  assert.deepEqual(still.measures, { jerk: 0, arc: null }); assert.deepEqual(still.findings, []);
});

test('pen-speed: a pen that keeps one speed round the bends is found; a line too short to say is not measured', () => {
  for (const path of [curl, ellipse]) {
    const c = checkMove(planMove({ do: 'draw', who: 'wires[0]', path, model: 'test:steady' }, { models }), { models });
    assert.ok(c.measures['pen-speed'] > PEN_SPEED_MOST, `${c.measures['pen-speed']}`);
    const basis = c.bases['pen-speed'];
    assert.equal(basis.error, c.measures['pen-speed']); assert.ok(Math.abs(basis.exponent) < 0.1, `a steady pen's free exponent is near 0: ${basis.exponent}`);
    assert.equal(c.findings[0].message, `wires[0]: its pen keeps its speed round the bends (${(c.measures['pen-speed'] * 100).toFixed(0)}% off the two-thirds power law; its speed goes as curvature^${(-basis.exponent).toFixed(2)}, the law's ^-0.33) — it reads as a plotter, not a hand`);
    assert.deepEqual(c.findings[0].basis, basis);
    assert.equal(c.findings[0].fix, "use do: 'draw' with model: 'power-law', which slows where the line bends");
  }
  assert.deepEqual(checkMove(planMove({ do: 'draw', path: [[0, 0], [20, 0]] })).measures, { 'pen-speed': null });
  assert.equal(penSpeed.finding(0.1, 'x', { error: 0.1, exponent: 0.33, count: 9 }), null);
});

test('speed peaks: a rise and fall counted once however it wobbles on top; a peak still rising at the end counts', () => {
  assert.equal(speedPeaks([0, 1, 2, 3, 2, 1, 0]), 1);
  assert.equal(speedPeaks([0, 3, 0, 3, 0]), 2);
  assert.equal(speedPeaks([0, 10, 9.5, 10, 0]), 1, 'a wobble under the share is no peak');
  assert.equal(speedPeaks([0, 1, 2, 3]), 1);
  assert.equal(speedPeaks([0, 0, 0]), 0);
  assert.equal(speedPeaks([5, 4, 3, 2]), 0, 'only falling: no peak');
  assert.equal(JERK_PEAK_SHARE, 0.1);
  assert.deepEqual(speedsOf([{ t: 0, x: 0, y: 0 }, { t: 0, x: 1, y: 0 }, { t: 1, x: 4, y: 4 }]), [{ t: 0.5, speed: 5, along: 3.5 }], 'no time between: no speed');
});

test("a tool's own critic, under its prefix: measured and said; one that breaks the interface is refused", () => {
  const wide = { name: 'reel:wide', limit: 100, measure: (track) => Math.max(...track.samples.map((s) => s.x)) - Math.min(...track.samples.map((s) => s.x)),
    finding: (v, who) => (v > 100 ? { level: 'note', message: `${who}: it travels ${Math.round(v)} px across`, fix: 'move to nearer' } : null) };
  const own = { family: 'reach', name: 'reel:far', checks: ['reel:wide'], plan: () => ({ seconds: 1 }), sample: (p, t) => ({ x: t * 300, y: 0 }) };
  const settings = { models: [own], critics: [wide] };
  const c = checkMove(planMove({ do: 'reach', who: 'b1', model: 'reel:far' }, settings), settings);
  assert.deepEqual(c, { measures: { 'reel:wide': 300 }, bases: { 'reel:wide': null }, findings: [{ critic: 'reel:wide', level: 'note', message: 'b1: it travels 300 px across', fix: 'move to nearer', basis: null }] });
  assert.deepEqual(FINDING_LEVELS, ['warn', 'note']);
  const run = (critic, re) => {
    const s = { models: [own], critics: [critic] };
    assert.throws(() => checkMove(planMove({ do: 'reach', model: 'reel:far' }, s), s), re);
  };
  run({ ...wide, finding: () => ({ level: 'loud', message: 'x', fix: 'y' }) }, /the critic "reel:wide"'s finding's level is warn or note — not "loud"/);
  run({ ...wide, finding: () => ({ level: 'warn', message: '', fix: 'y' }) }, /the critic "reel:wide"'s finding's message is words, 1 to 400 letters/);
  run({ ...wide, finding: () => 'bad' }, /the critic "reel:wide"'s finding is null or \{level, message, fix\} — not "bad"/);
  run({ ...wide, measure: () => NaN }, /the critic "reel:wide" measures a finite number, \{value, basis\}, or null when it cannot say — not NaN/);
  run({ ...wide, measure: () => ({ value: 300, basis: { nested: { a: 1 } } }) }, /the critic "reel:wide"'s basis is a flat record of the numbers it read/);
  run({ ...wide, measure: () => ({ value: 300, basis: { f: () => 1 } }) }, /the critic "reel:wide"'s basis gives a function at its top\.f/);
  run({ ...wide, name: 'wide' }, /critics\[0\]'s name is the tool's prefix and a name, lower case \("reel:wobble"\)/);
  run({ ...wide, measure: 1 }, /critics\[0\] \(reel:wide\) gives measure\(track\) and finding\(value, who\) — not 1/);
  run({ ...wide, limit: Infinity }, /critics\[0\] \(reel:wide\)'s limit is a finite number/);
  run(7, /critics\[0\] is a critic \{name, measure, limit, finding\} — not 7/);
  assert.throws(() => planMove({ do: 'reach', model: 'reel:far' }, { models: [own], critics: [wide, wide] }), /critics\[1\]: "reel:wide" is given twice/);
  assert.throws(() => planMove({ do: 'reach', model: 'reel:far' }, { models: [own], critics: {} }), /critics are a list of at most 64/);
});

test('pen-speed sees a hairpin taken at full speed', () => {
  const hairpin = [[100, 100], [400, 100], [100, 100], [400, 100]];
  const law = checkMove(planMove({ do: 'draw', path: hairpin })), plotter = checkMove(planMove({ do: 'draw', path: hairpin, model: 'test:steady' }, { models }), { models });
  assert.deepEqual(law.findings, []);
  // found by a 20000-run sweep: a hairpin whose legs lie a pixel apart; its wobble is held to half that gap, so it
  // passes whatever its seed
  for (const name of [' ', 'a', 'b', 'zz', 'hand', 'wires[3]', 'é']) {
    const c = checkMove(planMove({ do: 'draw', name, path: [[0, 32], [1, 184], [1, 2]] }));
    assert.ok(c.measures['pen-speed'] < PEN_SPEED_MOST, `${name}: ${c.measures['pen-speed']}`);
  }
  assert.ok(plotter.measures['pen-speed'] > PEN_SPEED_MOST, `${plotter.measures['pen-speed']}`);
  assert.equal(plotter.findings[0].critic, 'pen-speed');
});

test('a list of critics changed after it was read is read again', () => {
  const own = { family: 'reach', name: 'reel:c', checks: ['reel:late'], plan: () => ({ seconds: 1 }), sample: (p, t) => ({ x: t, y: 0 }) };
  const critics = [];
  assert.throws(() => planMove({ do: 'reach', model: 'reel:c' }, { models: [own], critics }), /names the check "reel:late", which is no critic/);
  critics.push({ name: 'reel:late', limit: 0, measure: () => 1, finding: () => null });
  const models = [own], m = planMove({ do: 'reach', model: 'reel:c' }, { models, critics });
  assert.deepEqual(checkMove(m, { models, critics }).measures, { 'reel:late': 1 });
});
