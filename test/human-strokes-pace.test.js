// The `pace` critic on `hand-sketch`: a drawing asked for in too little time (or at too high a speed) is drawn faster
// than a hand draws, and says so with the seconds it needs. The plan itself is untouched: only the finding is new.
// FC_RUNS=5000 npm test runs a deeper sweep of the property below.
import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { createHash } from 'node:crypto';
import { planMove, sampleMove, checkMove, planIntents, intentKey, HUMAN_CRITICS, PACE_MOST, PEN_LIFTS_MOST, STROKE_ORDER_MOST, SKETCH } from '../human.js';
import { pace } from '../src/human/strokes/pace.js';
import { runHumanFlow } from '../humanflow.js';
import { square } from './strokeHelpers.js';

const RUNS = Number(process.env.FC_RUNS) || 300;
const house = [{ points: square(0, 100, 100), closed: true }, { points: [[0, 100], [100, 200]] }, { points: [[100, 100], [0, 200]] }, { points: [[0, 100], [50, 50], [100, 100]] }];
const box = [{ points: square(100, 100, 200), closed: true, fill: { kind: 'hatch', spacing: 10 } }, { points: [[100, 200], [300, 200]], layer: 'detail' }];
const sketch = (shapes, more = {}) => planMove({ do: 'sketch', name: 'figure', who: 'blocks[2] ("figure")', shapes, ...more });
const paceOf = (move) => checkMove(move).findings.filter((f) => f.critic === 'pace');
const fixSeconds = (f) => Number(/^slow it: seconds: ([\d.]+) /.exec(f.fix)[1]);

test('the registry: pace is a critic of this package, hand-sketch names it, its limit 2× a hand\'s usual pace', () => {
  assert.ok(HUMAN_CRITICS.includes('pace'));
  assert.deepEqual(sketch(house).checks, ['pen-lifts', 'stroke-order', 'hatch-gaps', 'pace']);
  assert.equal(PACE_MOST, 2); assert.equal(pace.limit, PACE_MOST);
});

test('a drawing at its natural pace, or slower, gives no finding: its pace is 1 (or under)', () => {
  for (const shapes of [house, box, [{ points: square(0, 0, 90), closed: true, edge: false, fill: { kind: 'scribble' } }]]) {
    const c = checkMove(sketch(shapes));
    assert.deepEqual(c.findings, []);
    assert.ok(Math.abs(c.measures.pace - 1) < 1e-9, `${c.measures.pace}`);
    assert.ok(Math.abs(c.bases.pace.handSeconds - c.bases.pace.seconds) < 1e-9, 'a hand\'s own seconds are the plan\'s');
    assert.ok(checkMove(sketch(shapes, { seconds: 60 })).measures.pace < 1);
  }
  // twice the usual speed is the limit itself, and passes
  assert.ok(Math.abs(checkMove(sketch(house, { speed: 2 * SKETCH.speed })).measures.pace - 2) < 1e-9);
  assert.deepEqual(paceOf(sketch(house, { speed: 2 * SKETCH.speed })), []);
});

test('the figure asked for in 0.05 s: 42.7× a hand\'s pace — said, with the seconds it needs; following the fix clears it', () => {
  const move = sketch(house, { seconds: 0.05 }), c = checkMove(move), natural = sketch(house).plan.seconds;
  assert.ok(Math.abs(c.measures.pace - natural / 0.05) < 1e-9, `${c.measures.pace}`);
  const [f] = c.findings;
  assert.deepEqual(c.findings.map((x) => x.critic), ['pace'], 'the order critics see nothing wrong: the order is the same at any speed');
  assert.equal(f.level, 'warn');
  assert.equal(f.message, 'blocks[2] ("figure"): its pen draws at 42.7× a hand\'s pace (17085 px a second along its lines, where a hand draws 400) — past 2×, it reads as a drawing played fast, not a hand drawing it');
  assert.equal(f.fix, "slow it: seconds: 1.07 (or more; 2.14 draws it at a hand's own pace)");
  assert.equal(fixSeconds(f), Math.ceil((natural / PACE_MOST) * 100) / 100);
  assert.deepEqual(paceOf(sketch(house, { seconds: fixSeconds(f) })), []);
  // a speed too high is the same fault, and seconds is its fix too (seconds scales every time, the lifts with them)
  const fast = sketch(house, { speed: 2000 }), [g] = paceOf(fast);
  assert.ok(Math.abs(g.basis.pace - 5) < 1e-9); assert.match(g.message, /at 5\.0× a hand's pace \(2000 px a second along its lines/);
  assert.deepEqual(paceOf(sketch(house, { speed: 2000, seconds: fixSeconds(g) })), []);
});

test('only the finding is new: the plan, its reason and its samples are 0.35.1\'s, byte for byte (digests taken there)', () => {
  const digest = (move) => createHash('sha256').update(JSON.stringify([move.plan, move.reason, Array.from({ length: 50 }, (_, i) => sampleMove(move, (i / 49) * move.plan.seconds))])).digest('hex');
  assert.equal(digest(sketch(box)), '3dd0219d939568b1df7a5c8900d3c55f1cfefd5f014ee2502839258342be782f');
  const squeezed = sketch(box, { seconds: 0.05 }), before = JSON.stringify(squeezed);
  assert.equal(digest(squeezed), '57b4ead57eba6ceaba415dae67ecbf27b0fe1c81fee795b93b13624d029ec680');
  checkMove(squeezed);
  assert.equal(JSON.stringify(squeezed), before, 'checking it changes nothing');
});

test('on simple input the order critics cannot fire — fewest strokes, outline first, no fills — so only pace says a squeeze', () => {
  const c = checkMove(sketch([{ points: square(0, 0, 100), closed: true }], { seconds: 0.05 }));
  assert.equal(c.measures['pen-lifts'], PEN_LIFTS_MOST); assert.equal(c.measures['stroke-order'], STROKE_ORDER_MOST); assert.equal(c.measures['hatch-gaps'], null);
  assert.deepEqual(c.findings.map((f) => f.critic), ['pace']);
});

test('planIntents: the pace finding lands under the intent\'s own key, findings-<i>, with its critic, level and fix', () => {
  const r = planIntents([{ do: 'sketch', name: 'calm', shapes: house }, { do: 'sketch', name: 'rushed', shapes: house, seconds: 0.05 }]);
  assert.deepEqual(r[intentKey('findings', 0)], []);
  assert.deepEqual(r[intentKey('findings', 1)], [{ critic: 'pace', level: 'warn', fix: "slow it: seconds: 1.07 (or more; 2.14 draws it at a hand's own pace)" }]);
  assert.deepEqual(r.findings.map((f) => [f.intent, f.critic, f.model]), [[1, 'pace', 'hand-sketch']]);
  // a tool that accepts the critic by name (StoryReel's `accept: ['pace']`) finds it by that name
  assert.ok(r.findings.every((f) => HUMAN_CRITICS.includes(f.critic)));
});

test('the human flow\'s record: its commit log writes the pace finding under findings-<i>', async () => {
  const { result, snapshot } = await runHumanFlow([{ do: 'sketch', shapes: house, seconds: 0.05 }]);
  assert.deepEqual(result[intentKey('findings', 0)].map((f) => f.critic), ['pace']);
  const wrote = snapshot.commitLog.filter((c) => JSON.stringify(c).includes('"findings-0"'));
  assert.ok(wrote.length && wrote.every((c) => JSON.stringify(c).includes('slow it: seconds: 1.07')), 'the record holds the finding and its fix');
});

test('a tool\'s own sketch plan: lengths from its drawn points, no time or no length is no answer, a fill-only pace, a drawing too long for one move', () => {
  const stroke = (layer, xs, seconds, more = {}) => ({ layer, group: '', start: 0, seconds, xs, ys: xs.map(() => 0), ...more });
  const of = (strokes) => pace.measure({ plan: { seconds: 1, strokes } });
  assert.equal(of([stroke('outline', [0, 400], 1)]).value, 1, '400 px in 1 s: a hand\'s pace, read from the points');
  assert.equal(of([stroke('outline', [0, 400], 1, { length: 800 })]).value, 2, 'its own length first');
  assert.equal(of([stroke('outline', [0, 400], 0)]), null);
  assert.equal(of([stroke('outline', [0, 0], 1)]), null);
  assert.equal(of([{ layer: 'outline', start: 0, seconds: 1 }]), null, 'no length and no points');
  assert.equal(pace.measure({ plan: { seconds: 1, strokes: [] } }), null);
  const fill = of([stroke('fill', [0, 8000], 1)]);
  assert.equal(fill.value, 10); assert.equal(fill.basis.lineSpeed, null);
  assert.match(pace.finding(fill.value, 'w', fill.basis).message, /^w: its pen draws at 10\.0× a hand's pace \(along its fills\)/);
  assert.equal(pace.finding(5, 'w', { pace: 5, lineSpeed: 2000, seconds: 2000, handSeconds: 10000 }).fix, "too much to draw at a hand's pace in one move (5000 s; the most is 3600): draw it in parts");
  assert.equal(pace.finding(2, 'w', { pace: 2, lineSpeed: 800, seconds: 1, handSeconds: 2 }), null);
});

// ---- the property -----------------------------------------------------------------------------------------------------

const lattice = fc.tuple(fc.integer({ min: 0, max: 6 }), fc.integer({ min: 0, max: 6 })).map(([x, y]) => [x * 40, y * 40]);
const ring = fc.tuple(lattice, fc.integer({ min: 1, max: 3 }), fc.integer({ min: 1, max: 3 }), fc.boolean())
  .map(([[x, y], w, h, filled]) => ({ points: [[x, y], [x + w * 40, y], [x + w * 40, y + h * 40], [x, y + h * 40]], closed: true, ...(filled ? { fill: { kind: 'hatch', spacing: 20 } } : {}) }));
const segment = fc.tuple(lattice, lattice).filter(([a, b]) => a[0] !== b[0] || a[1] !== b[1]).map(([a, b]) => ({ points: [a, b] }));

test('any drawing, any seconds: its pace is its natural seconds over the seconds asked; none at its own pace; the fix clears it', () => {
  fc.assert(fc.property(fc.array(fc.oneof(ring, segment), { minLength: 1, maxLength: 5 }), fc.double({ min: 0.01, max: 30, noNaN: true }), (shapes, seconds) => {
    const usual = checkMove(sketch(shapes)), natural = usual.bases.pace.seconds;
    assert.ok(Math.abs(usual.measures.pace - 1) < 1e-9); assert.deepEqual(usual.findings, []);
    const asked = checkMove(sketch(shapes, { seconds }));
    assert.ok(Math.abs(asked.measures.pace / (natural / seconds) - 1) < 1e-9, `${asked.measures.pace} vs ${natural / seconds}`);
    const found = asked.findings.filter((f) => f.critic === 'pace');
    assert.equal(found.length, natural / seconds > PACE_MOST * (1 + 1e-9) ? 1 : 0);
    if (found.length) assert.deepEqual(paceOf(sketch(shapes, { seconds: fixSeconds(found[0]) })), []);
  }), { numRuns: Math.max(20, Math.round(RUNS * 0.2)) });
});
