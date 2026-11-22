// footprint-story/human · planIntents (the intent decider): an author's intents in, every move decided by steps in one
// list — the model by the rule table and why, the plan and its basis, the wrapped move, a bounded track summary, the
// critics' measures and findings naming who and the fix.
import test from 'node:test';
import assert from 'node:assert/strict';
import { planIntents, HUMAN_STEPS, HUMAN_INPUT, CHOOSE_RULES, MOST_INTENTS, SUMMARY_POINTS, PER_INTENT, intentKey, planMove, checkMove, anticipate, overshoot, sampleTrack, USUAL_MODELS, HUMAN_DOS } from '../human.js';
import { firstRule } from '../src/human/models/rules.js';
import { trackSummary } from '../src/human/intents/summary.js';
import { keysOut, perIntentKeys } from '../src/human/intents/keys.js';

const HAND = Object.freeze({ do: 'reach', name: 'hand', from: [200, 600], to: [500, 200] });
const BALL = Object.freeze({ do: 'throw', who: 'blocks[2] ("ball")', from: [100, 600], to: [700, 600] });
const STRAIGHT = Object.freeze({ do: 'reach', from: [0, 0], to: [300, 0], model: { name: 'min-jerk', bend: 0 } });
/** A tool's own pen model, as a tool hands one in. */
const chalk = Object.freeze({ family: 'pen', name: 'reel:chalk', options: ['grit'], checks: ['pen-speed'],
  plan: (intent) => ({ seconds: 0.5, from: intent.path[0], to: intent.path[intent.path.length - 1], basis: { grit: 1 } }),
  sample: (plan, t) => { const u = Math.min(1, Math.max(0, t / plan.seconds)); return { x: plan.from[0] + (plan.to[0] - plan.from[0]) * u, y: plan.from[1] + (plan.to[1] - plan.from[1]) * u }; } });

test('the rule table is data, first match wins: the named model, else the family\'s usual — and planMove reads the same table', () => {
  assert.deepEqual(CHOOSE_RULES.map((r) => [r.when, r.then, r.label]), [
    [{ named: { eq: true } }, 'named', 'the intent names its model'],
    [{ usual: { ne: null } }, 'usual', "the intent names none: its family's usual"]]);
  assert.ok(Object.isFrozen(CHOOSE_RULES) && Object.isFrozen(CHOOSE_RULES[0].when.named));
  assert.equal(firstRule(CHOOSE_RULES, { named: true, usual: 'min-jerk' }).then, 'named');
  assert.equal(firstRule(CHOOSE_RULES, { named: false, usual: 'min-jerk' }).then, 'usual');
  assert.equal(firstRule(CHOOSE_RULES, { named: false, usual: null }), null);
  // every do word: the decider's choice is planMove's, by the same rule
  for (const [doWord, family] of Object.entries(HUMAN_DOS)) assert.equal(firstRule(CHOOSE_RULES, { named: false, usual: USUAL_MODELS[family] ?? null })?.then, 'usual', `do: '${doWord}' has a usual model`);
  const r = planIntents([HAND, STRAIGHT]);
  assert.deepEqual(r.choices.map((c) => [c.model, c.by, c.rule]), [['min-jerk', 'usual', "the intent names none: its family's usual"], ['min-jerk', 'named', 'the intent names its model']]);
  assert.deepEqual(r.plans.map((m) => m.choice.by), ['usual', 'named']);
});

test('planIntents: per intent the choice and why, the plan and its basis, the move, a track summary, the critics — frozen plain data', () => {
  const r = planIntents([HAND, BALL, STRAIGHT]);
  assert.deepEqual(Object.keys(r), [...HUMAN_INPUT, 'choices', 'chose', 'choseWhy', 'plans', 'model-0', 'model-1', 'model-2', 'moves', 'durations', 'duration-0', 'duration-1', 'duration-2', 'tracks', 'checks', 'findings', 'findings-0', 'findings-1', 'findings-2']);
  // one intent's values under keys of its own: its model and rule, its duration and basis flat, its findings
  assert.deepEqual(r['model-1'], { model: 'ballistic', family: 'throw', by: 'usual', rule: "the intent names none: its family's usual", own: false });
  const { seconds: planned, ...basis } = r.plans[0].plan.basis;
  assert.deepEqual(r['duration-0'], { seconds: r.durations[0].seconds, ...basis });
  assert.equal(planned, r['duration-0'].seconds);
  assert.deepEqual([r['findings-0'], r['findings-2']], [[], [{ critic: 'arc', level: 'warn', fix: "bow it: model: {name: 'min-jerk', bend: 0.06}" }]]);
  assert.deepEqual(r.intents.map((i) => i.who), ['intents[0] ("hand")', 'blocks[2] ("ball")', 'intents[2]']);
  assert.deepEqual(r.choices[1], { who: 'blocks[2] ("ball")', do: 'throw', family: 'throw', model: 'ballistic', by: 'usual', rule: "the intent names none: its family's usual", own: false });
  assert.equal(r.chose, 'ours');
  assert.equal(r.choseWhy, 'this package\'s models plan every move — intents[0] ("hand"): reach → min-jerk (usual); blocks[2] ("ball"): throw → ballistic (usual); intents[2]: reach → min-jerk (named)');
  // the plan is planMove's for the named intent, its basis carrying Fitts's numbers
  assert.deepStrictEqual(r.plans[0], planMove({ ...HAND, who: 'intents[0] ("hand")' }));
  assert.deepEqual([r.plans[0].plan.basis.distance, r.plans[0].plan.basis.target, r.plans[0].plan.basis.targetDefaulted], [500, 40, true]);
  assert.ok(Math.abs(r.plans[0].plan.basis.bits - Math.log2(500 / 40 + 1)) < 1e-12);
  assert.deepEqual(r.durations[0], { seconds: r.plans[0].plan.seconds, model: 'min-jerk', basis: r.plans[0].plan.basis, wrappers: [], who: 'intents[0] ("hand")' });
  assert.deepStrictEqual(r.moves, r.plans, 'nothing asked a wrapper');
  assert.deepStrictEqual(r.checks[1], checkMove(r.moves[1]));
  // the findings name who and the fix, in the intent's own keys
  assert.deepEqual(r.findings, [{ intent: 2, who: 'intents[2]', model: 'min-jerk', critic: 'arc', level: 'warn', message: r.checks[2].findings[0].message, fix: "bow it: model: {name: 'min-jerk', bend: 0.06}" }]);
  assert.match(r.findings[0].message, /^intents\[2\]: its move runs straight/);
  const frozen = (v) => v === null || typeof v !== 'object' || (Object.isFrozen(v) && Object.values(v).every(frozen));
  assert.ok(frozen(r));
  assert.deepStrictEqual(structuredClone(r), JSON.parse(JSON.stringify(r)), 'plain data');
});

test('a wrap asked in the intent wraps its move, innermost first; the duration says the wrappers and keeps the model\'s basis', () => {
  const r = planIntents([{ ...BALL, wrap: [{ wrapper: 'anticipate', share: 0.2 }, { wrapper: 'overshoot', by: 12 }] }, { ...HAND, wrap: [{ wrapper: 'hold', at: 0.1, seconds: 0.2 }, { wrapper: 'follow-through' }] }]);
  const own = overshoot(anticipate(planMove(BALL), { share: 0.2 }), { by: 12 });
  assert.deepStrictEqual(r.moves[0], own);
  assert.deepEqual(r.wraps[0], [{ wrapper: 'anticipate', share: 0.2 }, { wrapper: 'overshoot', by: 12 }]);
  assert.equal(r.intents[0].wrap, undefined, 'the wrap is taken apart: a model refuses a key it does not read');
  assert.deepEqual(r.durations[0], { seconds: own.plan.seconds, model: 'ballistic', basis: r.plans[0].plan.basis, wrappers: ['anticipate', 'overshoot'], who: 'blocks[2] ("ball")' });
  assert.deepEqual([r['duration-0'].seconds, r['duration-0'].wrappers, r['duration-0'].planned, r['duration-0'].apex], [own.plan.seconds, 'anticipate, overshoot', r.plans[0].plan.seconds, 150]);
  assert.deepEqual(r.moves[1].wrappers, ['hold', 'follow-through']);
  assert.ok(r.durations[1].seconds > r.plans[1].plan.seconds + 0.2 - 1e-12);
});

test('a track summary is bounded: at most SUMMARY_POINTS points, both ends in, and the numbers of the whole track', () => {
  const r = planIntents([{ do: 'reach', from: [0, 0], to: [900, 0], seconds: 30 }, { do: 'reach', from: [5, 5], to: [5, 5], seconds: 0.01 }]);
  const [long, still] = r.tracks, track = sampleTrack(r.moves[0]);
  assert.equal(long.count, track.samples.length);
  assert.equal(long.points.length, SUMMARY_POINTS);
  assert.deepEqual(long.points[0], [0, 0, 0]);
  assert.deepEqual(long.points.at(-1), [30, 900, 0]);
  assert.ok(long.distance >= 900 && long.peakSpeed > 900 / 30);
  assert.deepEqual([long.bounds[0], long.bounds[2]], [0, 900]);
  assert.equal(long.bounds[1] <= 0 && long.bounds[3] >= 0, true);
  assert.deepEqual([still.distance, still.peakSpeed, still.points.length], [0, 0, still.count]);
  // a move of no seconds: two samples at one time say nothing of speed
  const zero = trackSummary({ seconds: 0, pushes: 1, samples: [{ t: 0, x: 1, y: 2 }, { t: 0, x: 3, y: 2 }] });
  assert.deepEqual([zero.distance, zero.peakSpeed, zero.bounds], [2, 0, [1, 2, 3, 2]]);
});

test('a tool\'s own model: the list\'s choice is "own" and its reason says the code is outside the record; its models go to every step', () => {
  const r = planIntents([HAND, { do: 'draw', who: 'chalk line', path: [[0, 0], [100, 50]], model: 'reel:chalk' }], { models: [chalk] });
  assert.equal(r.chose, 'own');
  assert.equal(r.choseWhy, "a tool's own model plans 1 of 2 moves, from code this record does not hold — chalk line: draw → reel:chalk (named)");
  assert.deepEqual(r.choices[1], { who: 'chalk line', do: 'draw', family: 'pen', model: 'reel:chalk', by: 'named', rule: 'the intent names its model', own: true });
  assert.equal(r.tracks[1].points.at(-1)[1], 100);
  assert.deepEqual(Object.keys(r.checks[1].measures), ['pen-speed']);
  // no intents: nothing to plan
  const none = planIntents([]);
  assert.deepEqual([none.chose, none.choseWhy, none.plans, none.findings], ['ours', 'no intents: nothing to plan', [], []]);
});

test('the frame is handed to every model; the same intents give the same result, however often', () => {
  const a = planIntents([HAND, { do: 'draw', name: 'pen', path: [[0, 0], [200, 80], [400, 0]] }], { frame: [1920, 1080] });
  assert.deepEqual(a.frame, [1920, 1080]);
  assert.deepStrictEqual(planIntents([HAND, { do: 'draw', name: 'pen', path: [[0, 0], [200, 80], [400, 0]] }], { frame: [1920, 1080] }), a);
  assert.deepStrictEqual(planIntents([HAND], null), planIntents([HAND], { frame: null }));
  // this package's models do not read the frame; a tool's own may, and is handed it
  const framed = { ...chalk, name: 'reel:framed', plan: (intent, { frame }) => ({ ...chalk.plan(intent), basis: { width: frame?.[0] ?? null } }) };
  const line = [{ do: 'draw', path: [[0, 0], [10, 0]], model: 'reel:framed' }];
  assert.equal(planIntents(line, { models: [framed], frame: [1280, 720] }).plans[0].plan.basis.width, 1280);
  assert.equal(planIntents(line, { models: [framed] }).plans[0].plan.basis.width, null);
});

test('refusals name the entry and the fix, before anything is planned', () => {
  const refused = (intents, settings, words) => assert.throws(() => planIntents(intents, settings), words);
  refused('reach', undefined, /^Error: human: planIntents takes a list of intents \[\{do, …\}\]/);
  refused(Array.from({ length: MOST_INTENTS + 1 }, () => HAND), undefined, /planIntents takes at most 64 intents — not 65: plan them in parts/);
  refused([HAND, 5], undefined, /intents\[1\] is an intent \{do, …\} — not 5/);
  refused([, HAND], undefined, /intents\[0\] is an intent \{do, …\} — not undefined/);   // eslint-disable-line no-sparse-arrays
  refused([{ ...HAND, do: 'wave' }], undefined, /intents\[0\] \("hand"\)'s do is 'reach', 'draw'/);
  refused([{ ...HAND, who: '' }], undefined, /an intent's who is the words for where it was written/);
  refused([{ ...HAND, model: 'ballistic' }], undefined, /the model "ballistic" is for a throw or a fall, and this intent is do: 'reach'/);
  refused([{ ...HAND, model: 7 }], undefined, /intents\[0\] \("hand"\)'s model is a model's name, or \{name, …its options\}/);
  refused([{ ...HAND, model: 'reel:none' }], undefined, /there is no model "reel:none"/);
  // the choice's refusals name the intent, in words that hold whichever door asked
  refused([{ ...HAND, model: 'spring' }], undefined, /^Error: human: intents\[0\] \("hand"\): the model "spring" is for a settle, and this intent is do: 'reach'/);
  refused([HAND, { ...HAND, name: 'other', model: 'nope' }], undefined, (e) => /^human: intents\[1\] \("other"\): there is no model "nope" — the models are .*\(a tool's own is handed in as models\)$/.test(e.message) && !/planMove/.test(e.message));
  assert.throws(() => planMove({ ...HAND, model: 'nope' }), /^Error: human: "hand": there is no model "nope"/);
  refused([{ ...HAND, wrap: 'anticipate' }], undefined, /intents\[0\] \("hand"\)'s wrap is a list of at most 4 wrappers/);
  refused([{ ...HAND, wrap: [{ wrapper: 'squash' }] }], undefined, /intents\[0\] \("hand"\)'s wrap\[0\] is \{wrapper, …its options\}, the wrapper 'anticipate', 'follow-through', 'hold', 'overshoot' — not "squash"/);
  refused([{ ...HAND, wrap: Array.from({ length: 5 }, () => ({ wrapper: 'follow-through' })) }], undefined, /intents\[0\] \("hand"\)'s wrap is a list of at most 4 wrappers \[\{wrapper: 'anticipate', share: 0\.2\}\] — not \[/);
  refused([{ ...HAND, wrap: [5] }], undefined, /wrap\[0\] is \{wrapper, …its options\}.* — not 5/);
  refused([{ ...HAND, wrap: [{ wrapper: 'hold' }] }], undefined, /intents\[0\] \("hand"\): hold's at is a number/);
  refused([{ ...HAND, wrap: [{ wrapper: 'anticipate', speed: 2 }] }], undefined, /anticipate's options takes share, by — not "speed"/);
  refused([{ ...HAND, from: [0] }], undefined, /intents\[0\] \("hand"\)'s from is a point \[x, y\]/);
  refused([HAND], 'fast', /planIntents's settings are \{models, critics, frame\}, or none — not "fast"/);
  refused([HAND], { rate: 30 }, /planIntents's settings are models, critics, frame — not "rate"/);
  refused([HAND], { frame: [0] }, /planIntents' frame \(its width and height\) is a point/);
  refused([HAND], { models: 'chalk' }, /models are a list of at most 64/);
  let ran = 0;
  refused([{ ...HAND, get to() { ran += 1; return [1, 1]; } }], undefined, /intents\[0\] gives a getter at its top\.to \(code, never run\)/);
  refused([HAND], { get models() { ran += 1; return []; } }, /planIntents's models is read as a stored value, and this one is a getter/);
  const list = [HAND];
  Object.defineProperty(list, 0, { get() { ran += 1; return HAND; } });
  refused(list, undefined, /intents\[0\] is read as a stored value, and this one is a getter/);
  assert.equal(ran, 0, 'no getter ran');
});

test('each step reads only the keys it names: handed only those, it gives what the whole list gives', () => {
  const r = planIntents([HAND, { ...BALL, wrap: [{ wrapper: 'anticipate' }] }, STRAIGHT]);
  for (const s of HUMAN_STEPS.slice(1)) {
    const handed = Object.fromEntries(s.reads.map((k) => [k, r[k]]));
    const got = s.run(handed, {});
    for (const k of s.writes) assert.deepStrictEqual(got[k], r[k], `${s.name} wrote ${k}`);
  }
  assert.deepEqual(HUMAN_STEPS.map((s) => s.name), ['read', 'choose', 'wrap', 'sample', 'check', 'findings']);
  assert.deepEqual(HUMAN_STEPS[1].reads, ['intents', 'frame']);
  assert.deepEqual(Object.keys(HUMAN_STEPS[1].branches), ['ours', 'own']);
  assert.equal(HUMAN_STEPS[1].branches.ours, HUMAN_STEPS[1].branches.own, 'one plan, whichever the list chose: the branch names what the record can vouch for');
});

test('per-intent keys: named <what>-<i>, a key the record reader takes by its own name; each step names the prefixes it writes', () => {
  assert.deepEqual(PER_INTENT, { model: 'choose', duration: 'wrap', findings: 'findings' });
  assert.equal(intentKey('duration', 12), 'duration-12');
  for (const bad of [['plan', 0], ['duration', -1], ['duration', 1.5], ['duration', '3']]) assert.throws(() => intentKey(...bad), /intentKey takes model, duration, findings and an intent's place/);
  assert.deepEqual(HUMAN_STEPS.map((s) => [s.name, s.each]), [['read', []], ['choose', ['model']], ['wrap', ['duration']], ['sample', []], ['check', []], ['findings', ['findings']]]);
  for (const [what, by] of Object.entries(PER_INTENT)) assert.ok(HUMAN_STEPS.find((s) => s.name === by).each.includes(what));
  const r = planIntents([HAND]);
  assert.deepEqual(Object.keys(r).filter((k) => /-/.test(k)), ['model-0', 'duration-0', 'findings-0']);
  // only a step's own prefixes, and only a place written as a plain whole number, are taken from what it gives back
  const out = { moves: 1, durations: 2, 'duration-0': 3, 'duration-12': 4, 'duration-01': 5, 'duration-x': 6, 'duration-1-2': 7, 'model-0': 8, 'xduration-1': 9 };
  assert.deepEqual(keysOut(HUMAN_STEPS[2], out), ['moves', 'durations', 'duration-0', 'duration-12']);
  assert.deepEqual(perIntentKeys(out), ['model-0', 'duration-0', 'duration-12']);
});

test('the plan checks that its model is the one chosen: a choice the plan does not hold is refused, never kept', () => {
  const r = planIntents([HAND]), { run } = HUMAN_STEPS[1].branches.ours;
  assert.throws(() => run({ intents: r.intents, choices: [{ ...r.choices[0], model: 'spring' }], frame: null }, {}), /intents\[0\] \("hand"\): the choice was "spring" and the plan was made by "min-jerk" — the choice and the plan read apart/);
  assert.throws(() => run({ intents: r.intents, choices: [], frame: null }, {}), /the choice was undefined/);
});
