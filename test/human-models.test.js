// The models of footprint-story/human: an intent planned by a named model (the usual for its family, or the one it
// names), its reason in words, its plan frozen plain data, the same entry the same motion; a tool's own model under
// its prefix; and every refusal naming the entry (`who`) and the fix.
import test from 'node:test';
import assert from 'node:assert/strict';
import { planMove, sampleMove, sampleTrack, HUMAN_MODELS, USUAL_MODELS, HUMAN_DOS, FITTS, MIN_JERK_PEAK, PEN_SPEED, minJerk } from '../human.js';

const close = (a, b, eps, what) => assert.ok(Math.abs(a - b) <= eps, `${what}: ${a} is not within ${eps} of ${b}`);
const deepFrozen = (v) => v === null || typeof v !== 'object' || (Object.isFrozen(v) && Object.values(v).every(deepFrozen));
const reach = { do: 'reach', name: 'hand', who: 'blocks[2] ("hand")', from: [200, 600], to: [500, 200] };

test('a reach: min-jerk, the usual, over the seconds Fitts gives; it starts and ends at rest on its points, fastest half way', () => {
  const m = planMove(reach);
  assert.equal(m.model, 'min-jerk'); assert.equal(m.family, 'reach'); assert.equal(m.do, 'reach'); assert.equal(m.who, 'blocks[2] ("hand")');
  close(m.plan.seconds, FITTS.a + FITTS.b * Math.log2(500 / 40 + 1), 1e-12, "Fitts's seconds");
  assert.equal(m.reason, "do: 'reach' → min-jerk, the usual for do: 'reach' — over 0.85 s from Fitts's law: 500 px to a 40 px target (the usual: none was given), 3.75 bits, bowed 6% of its length");
  assert.deepEqual(m.checks, ['jerk', 'arc']);
  assert.ok(deepFrozen(m), 'frozen all the way down');
  assert.deepEqual(structuredClone(m), JSON.parse(JSON.stringify(m)), 'plain data');
  assert.deepEqual(sampleMove(m, 0), { x: 200, y: 600, progress: 0 });
  assert.deepEqual(sampleMove(m, m.plan.seconds), { x: 500, y: 200, progress: 1 });
  assert.deepEqual(sampleMove(m, -1), sampleMove(m, 0)); assert.deepEqual(sampleMove(m, 99), sampleMove(m, m.plan.seconds));
  assert.ok(Object.isFrozen(sampleMove(m, 0.3)));
  close(sampleMove(m, m.plan.seconds / 2).progress, minJerk(0.5), 0, 'half way at half time');
  const track = sampleTrack(m, { rate: 1000 });
  const speeds = track.samples.slice(1).map((s, i) => Math.hypot(s.x - track.samples[i].x, s.y - track.samples[i].y) / (s.t - track.samples[i].t));
  const top = speeds.indexOf(Math.max(...speeds));
  close(track.samples[top].t / m.plan.seconds, 0.5, 0.01, 'the top speed half way');
  close(Math.max(...speeds), (MIN_JERK_PEAK * 500) / m.plan.seconds, 0.02 * Math.max(...speeds), 'the top speed 1.875 · distance / seconds (a hair more for the bow)');
});

test('a reach with its own seconds, target and bend: the reason says which came from where', () => {
  const m = planMove({ ...reach, seconds: 1.5, model: { name: 'min-jerk', bend: 0 } });
  assert.equal(m.plan.seconds, 1.5);
  assert.match(m.reason, /over 1\.5 s \(the seconds the intent gave\), straight$/);
  assert.deepEqual(m.options, { bend: 0 });
  const mid = sampleMove(m, 0.75);
  close(mid.x, 350, 1e-9, 'straight: on the line'); close(mid.y, 400, 1e-9, 'straight: on the line');
  const t = planMove({ ...reach, target: 10, model: { name: 'min-jerk', a: 0, b: 0.1 } });
  close(t.plan.seconds, 0.1 * Math.log2(51), 1e-12, 'a smaller target, its own constants');
  assert.match(t.reason, /to a 10 px target, 5\.67 bits/);
  assert.equal(planMove({ do: 'reach', from: [5, 5], to: [5, 5], model: { name: 'min-jerk', a: 0 } }).plan.seconds, 0, 'nowhere to go, no time');
  const still = planMove({ do: 'reach', from: [5, 5], to: [5, 5], model: { name: 'min-jerk', a: 0 } });
  assert.deepEqual(sampleMove(still, 0), { x: 5, y: 5, progress: 1 });
  assert.equal(planMove({ do: 'reach', from: [0, 0], to: [1, 0] }).who, 'the move');
  assert.equal(planMove({ do: 'reach', name: 'cup', from: [0, 0], to: [1, 0] }).who, '"cup"');
});

test('the same entry, the same move; its keys in another order, the same; another piece, another tremor', () => {
  const path = [[100, 100], [300, 180], [420, 90], [600, 260]];
  const a = planMove({ do: 'draw', name: 'cable', path }), b = planMove({ path, name: 'cable', do: 'draw' });
  assert.deepEqual(a, b);
  const c = planMove({ do: 'draw', name: 'wire', path });
  assert.notDeepEqual(a.plan.xs, c.plan.xs, 'another piece wobbles another way');
  assert.equal(a.plan.seconds, c.plan.seconds, 'but keeps its time');
  const flat = planMove({ do: 'draw', name: 'cable', path, model: { name: 'power-law', tremor: 0 } });
  assert.notDeepEqual(flat.plan.xs, a.plan.xs);
  assert.deepEqual(sampleMove(structuredClone(a), 0.7), sampleMove(a, 0.7), 'a move from a record samples the same');
});

test('a pen line: power-law, through its points, from its first to its last, at the usual speed unless told', () => {
  const path = [[100, 100], [300, 180], [420, 90], [600, 260]];
  const m = planMove({ do: 'draw', name: 'cable', path });
  assert.equal(m.model, 'power-law');
  assert.match(m.reason, /^do: 'draw' → power-law, the usual for do: 'draw' — a line \d+ px long over [\d.]+ s \(at 400 px a second, the usual\), slower where it bends \(the two-thirds power law\), with a 0\.8 px tremor$/);
  const length = Number(/a line (\d+) px/.exec(m.reason)[1]);
  close(m.plan.seconds, length / PEN_SPEED, 0.01, 'its length at the usual speed');
  assert.deepEqual(sampleMove(m, 0), { x: 100, y: 100, progress: 0 });
  assert.deepEqual(sampleMove(m, m.plan.seconds), { x: 600, y: 260, progress: 1 });
  let last = -1;
  for (let t = 0; t <= m.plan.seconds; t += 0.01) { const p = sampleMove(m, t).progress; assert.ok(p >= last); last = p; }
  assert.match(planMove({ do: 'draw', path, seconds: 2, speed: 90 }).reason, /over 2 s \(the seconds the intent gave\)/);
  assert.match(planMove({ do: 'draw', path, speed: 90, model: { name: 'power-law', tremor: 0 } }).reason, /at 90 px a second\), slower where it bends \(the two-thirds power law\)$/);
});

test('a letter: sigma-lognormal, one stroke a point, landing on the last exactly; or the strokes as numbers; seconds slow them together', () => {
  const pts = [[0, 0], [30, 60], [60, 0], [90, 60]];
  const m = planMove({ do: 'write', name: 'n', points: pts });
  assert.equal(m.model, 'sigma-lognormal'); assert.equal(m.plan.pushes, 3); assert.equal(m.plan.strokes.length, 3);
  assert.match(m.reason, /3 strokes, each a lognormal push overlapping the next \(sigma-lognormal\), over [\d.]+ s$/);
  assert.deepEqual(sampleMove(m, 0), { x: 0, y: 0, progress: 0 });
  const end = sampleMove(m, m.plan.seconds);
  close(end.x, 90, 1e-9, 'lands on x'); close(end.y, 60, 1e-9, 'lands on y'); assert.equal(end.progress, 1);
  const slow = planMove({ do: 'write', name: 'n', points: pts, seconds: 3 });
  assert.equal(slow.plan.seconds, 3); assert.match(slow.reason, /over 3 s \(the seconds the intent gave\)$/);
  const se = sampleMove(slow, 3); close(se.x, 90, 1e-9, 'slowed, still lands'); close(se.y, 60, 1e-9, 'slowed, still lands');
  const one = planMove({ do: 'write', strokes: [{ distance: 50, start: 0, mu: -1.6, sigma: 0.3, angleFrom: 0, angleTo: 0 }], at: [10, 10] });
  const oe = sampleMove(one, one.plan.seconds); close(oe.x, 60, 1e-9, 'one stroke'); close(oe.y, 10, 1e-9, 'one stroke');
  assert.match(one.reason, /1 stroke, each/);
  const bent = planMove({ do: 'write', points: pts, model: { name: 'sigma-lognormal', bend: 0.5, gap: 0.3 } });
  close(sampleMove(bent, bent.plan.seconds).x, 90, 1e-9, 'bent strokes still land');
  assert.deepEqual(planMove({ do: 'write', strokes: [{ distance: 5, start: 0, mu: -1, sigma: 0.2, angleFrom: 1, angleTo: 1 }] }).plan.origin, [0, 0]);
});

test('the registry: this package\'s models by family, the usual one each, and the word each family\'s do says', () => {
  assert.deepEqual(HUMAN_MODELS, { reach: ['min-jerk'], pen: ['power-law'], letter: ['sigma-lognormal'], settle: [], fall: [], throw: [], hang: [] });
  assert.deepEqual(USUAL_MODELS, { reach: 'min-jerk', pen: 'power-law', letter: 'sigma-lognormal' });
  assert.equal(HUMAN_DOS.draw, 'pen'); assert.equal(HUMAN_DOS.write, 'letter');
});

test("a tool's own model, under its prefix: chosen when named, handed context, its plan and samples checked", () => {
  let seen;
  const chalk = { family: 'pen', name: 'reel:chalk', options: ['grit'], check(o) { if (o.grit !== undefined && o.grit > 3) throw new Error('reel: grit is at most 3'); }, checks: ['pen-speed'],
    plan(intent, context) { seen = context; return { seconds: 1, from: intent.path[0], to: intent.path[intent.path.length - 1], r: context.random(), why: 'chalk, rough' }; },
    sample(plan, t) { const u = Math.max(0, Math.min(1, t)); return { x: plan.from[0] + (plan.to[0] - plan.from[0]) * u, y: plan.from[1] + (plan.to[1] - plan.from[1]) * u, width: 3 }; } };
  const models = [chalk];
  const m = planMove({ do: 'draw', name: 'board', path: [[0, 0], [10, 0]], model: { name: 'reel:chalk', grit: 2 } }, { models, frame: [1920, 1080] });
  assert.equal(m.model, 'reel:chalk'); assert.equal(m.reason, "do: 'draw' → reel:chalk, named by the intent — chalk, rough");
  assert.equal(seen.who, '"board"'); assert.equal(seen.name, 'board'); assert.deepEqual(seen.frame, [1920, 1080]); assert.deepEqual(seen.options, { grit: 2 });
  assert.ok(Object.isFrozen(seen));
  assert.deepEqual(sampleMove(m, 0.5, { models }), { x: 5, y: 0, width: 3 });
  assert.equal(planMove({ do: 'draw', path: [[0, 0], [10, 0]], model: 'reel:chalk' }, { models }).plan.r, planMove({ do: 'draw', path: [[0, 0], [10, 0]], model: 'reel:chalk' }, { models }).plan.r, 'seeded');
  assert.throws(() => planMove({ do: 'draw', path: [[0, 0], [10, 0]], model: { name: 'reel:chalk', grit: 9 } }, { models }), /^Error: reel: grit is at most 3$/, 'its own check, as it throws');
  assert.throws(() => sampleMove(m, 0.5), /the move was planned by "reel:chalk", which is not here — a tool's own model is handed in again in models/);
  assert.throws(() => planMove({ do: 'draw', path: [[0, 0], [1, 0]], model: 'reel:chalk' }), /there is no model "reel:chalk" — the models are "min-jerk", "power-law", "sigma-lognormal"/);
  const noUsual = { ...chalk, family: 'fall', name: 'reel:drop' };
  assert.equal(planMove({ do: 'fall', path: [[0, 0], [1, 0]], model: 'reel:drop' }, { models: [noUsual] }).family, 'fall');
  assert.throws(() => planMove({ do: 'fall' }), /no model for do: 'fall' yet — name one of a tool's own with model: 'prefix:name' and hand it in planMove's models/);
});

test("a tool's own model that breaks the interface is refused, naming it and what to give", () => {
  const good = { family: 'reach', name: 'reel:ok', plan: () => ({ seconds: 1 }), sample: () => ({ x: 0, y: 0 }) };
  const bad = (m, re) => assert.throws(() => planMove({ do: 'reach', from: [0, 0], to: [1, 1] }, { models: [m] }), re);
  bad({ ...good, name: 'ok' }, /models\[0\]'s name is the tool's prefix and a name, lower case \("reel:chalk-pen"\): a name with no prefix is this package's — not "ok"/);
  bad({ ...good, family: 'swim' }, /models\[0\]'s family is one of reach, pen, letter, settle, fall, throw, hang — not "swim"/);
  bad({ ...good, plan: 1 }, /models\[0\] \(reel:ok\) gives plan\(intent, context\) and sample\(plan, t\) — not 1/);
  bad({ ...good, check: 'x' }, /models\[0\] \(reel:ok\)'s check is a function/);
  bad({ ...good, options: ['Bad'] }, /models\[0\] \(reel:ok\)'s options is a list of at most 16 names/);
  bad({ ...good, checks: ['wobble'] }, /the model "reel:ok" names the check "wobble", which is no critic — the critics are "jerk", "pen-speed", "arc"/);
  bad(null, /models\[0\] is a model \{family, name, options, plan, sample, checks\} — not null/);
  assert.throws(() => planMove({ do: 'reach', from: [0, 0], to: [1, 1] }, { models: [good, good] }), /models\[1\]: "reel:ok" is given twice/);
  assert.throws(() => planMove({ do: 'reach', from: [0, 0], to: [1, 1] }, { models: [{ ...good, name: 'min-jerk' }] }), /a name with no prefix is this package's/);
  assert.throws(() => planMove({ do: 'reach', from: [0, 0], to: [1, 1] }, { models: 'x' }), /models are a list of at most 64/);
  const named = (m, re) => assert.throws(() => planMove({ do: 'reach', who: 'scene 2', model: 'reel:ok' }, { models: [{ ...good, ...m }] }), re);
  named({ plan: () => ({ seconds: 1, f: () => 1 }) }, /scene 2: the model "reel:ok"'s plan gives a function at its top\.f: a plan is plain data/);
  named({ plan: () => ({ seconds: -1 }) }, /scene 2: the model "reel:ok"'s plan is \{seconds, …\}: how long the move takes, from 0 to 3600 s — not -1/);
  named({ plan: () => ({ seconds: 1, at: new Date(0) }) }, /gives a live object at its top\.at/);
  named({ plan: () => ({ seconds: 1, pushes: 1.5 }) }, /plan's pushes is how many pushes the move is made of/);
  named({ plan: () => { const o = { seconds: 1 }; o.self = o; return o; } }, /gives a value that holds itself at its top\.self/);
  named({ plan: () => ({ seconds: NaN }) }, /gives NaN at its top\.seconds: a plan holds finite numbers/);
  named({ plan: () => [1] }, /plan is \{seconds, …\}/);
  named({ plan: () => ({ seconds: 1, get g() { return 1; } }) }, /gives a getter at its top\.g \(code, never run\)/);
  const sampled = (s, re) => { const models = [{ ...good, sample: s }]; const m = planMove({ do: 'reach', who: 'scene 3', model: 'reel:ok' }, { models }); assert.throws(() => sampleMove(m, 0, { models }), re); };
  sampled(() => ({ x: NaN, y: 0 }), /scene 3: the model "reel:ok"'s sample's x is a finite number, or a list of at most 1024 numbers or points \[x, y\] — not NaN/);
  sampled(() => ({ x: 1 }), /scene 3: the model "reel:ok"'s sample gives x and y/);
  sampled(() => 5, /scene 3: the model "reel:ok"'s sample is \{x, y, …\} — not 5/);
});

test('refusals name the entry and say the fix in its own keys', () => {
  const r = (intent, re, settings) => assert.throws(() => planMove(intent, settings), re);
  r(null, /human: planMove takes an intent \{do, …\}/);
  r({ do: 'reach', from: [0, 0], to: [1, 1] }, /planMove's settings are \{models, critics, frame\}/, 5);
  r({ do: 'jump', who: 'beats[1]' }, /human: beats\[1\]'s do is 'reach', 'draw', 'write', 'settle', 'fall', 'throw', 'hang' — not "jump"/);
  r({ ...reach, from: [0] }, /blocks\[2\] \("hand"\)'s from is a point \[x, y\] on the frame/);
  r({ ...reach, speed: 3 }, /blocks\[2\] \("hand"\) \(an intent\) takes do, name, who, model, from, to, target, seconds — not "speed"/);
  r({ ...reach, target: 0 }, /blocks\[2\] \("hand"\)'s target is a number above 0/);
  r({ ...reach, seconds: 0 }, /blocks\[2\] \("hand"\)'s seconds is how long the move takes, above 0 and at most 3600 — not 0; leave it out and the law decides/);
  r({ ...reach, model: 'power-law' }, /the model "power-law" is for a pen, and this intent is do: 'reach' \(a reach\) — name a reach model: "min-jerk"/);
  r({ ...reach, model: { name: 'min-jerk', wobble: 1 } }, /blocks\[2\] \("hand"\)'s model "min-jerk" takes bend, a, b — not "wobble"/);
  r({ ...reach, model: { name: 'min-jerk', bend: 2 } }, /model "min-jerk"'s bend is a number from -0\.3 to 0\.3 — not 2/);
  r({ ...reach, model: { bend: 1 } }, /blocks\[2\] \("hand"\)'s model is a model's name, or \{name, …its options\}/);
  r({ ...reach, model: { name: 'min-jerk', bend: [1] } }, /model option bend is a number, a word or true\/false/);
  r({ ...reach, name: '' }, /an intent's name is its piece's name, 1 to 64 letters/);
  r({ ...reach, who: 5 }, /an intent's who is the words for where it was written/);
  r({ ...reach, f: () => 1 }, /blocks\[2\] \("hand"\) \(an intent\) gives a function at its top\.f/);
  r(Object.defineProperty({ do: 'reach' }, 'who', { get: () => 'x', enumerable: true }), /an intent's who is read as a stored value, and this one is a getter/);
  r(reach, /planMove's frame \(its width and height\) is a point/, { frame: 'big' });
  r({ do: 'draw', who: 'w1', path: [[3, 3], [3, 3]] }, /w1's path goes nowhere \(every point on one place\) — give at least two points that differ/);
  r({ do: 'draw', who: 'w1', path: [[3, 3]] }, /w1's path is 2 to 1024 points/);
  r({ do: 'draw', who: 'w1', path: [[0, 0], [5, 5]], speed: -1 }, /w1's speed is a number above 0/);
  r({ do: 'draw', who: 'w1', path: [[0, 0], [5, 5]], model: { name: 'power-law', tremor: 20 } }, /model "power-law"'s tremor is a number from 0 to 8 — not 20/);
  r({ do: 'write', who: 'k' }, /k writes its letter as points \(where the pen passes\) or as strokes \(the law's numbers\) — one of the two, not neither/);
  r({ do: 'write', who: 'k', points: [[0, 0], [1, 1]], strokes: [] }, /one of the two, not both/);
  r({ do: 'write', who: 'k', points: [[0, 0], [1, 1]], at: [0, 0] }, /k's at is where strokes start; written as points, the letter starts at its first point — leave at out/);
  r({ do: 'write', who: 'k', strokes: [] }, /k's strokes are 1 to 256 strokes/);
  r({ do: 'write', who: 'k', strokes: [5] }, /k's strokes\[0\] is \{distance, start, mu, sigma, angleFrom, angleTo\} — not 5/);
  r({ do: 'write', who: 'k', strokes: [{ distance: 1, start: 0, mu: 0, sigma: 0, angleFrom: 0, angleTo: 0 }] }, /k's strokes\[0\]'s sigma is a number from 0\.01 to 3 — not 0/);
  r({ do: 'write', who: 'k', strokes: [{ distance: 1, pace: 2 }] }, /k's strokes\[0\] takes distance, start, mu, sigma, angleFrom, angleTo — not "pace"/);
  r({ do: 'write', who: 'k', points: [[0, 0], [1, 1]], model: { name: 'sigma-lognormal', gap: -1 } }, /model "sigma-lognormal"'s gap is a number from 0 to 10/);
});

test('sampleMove and sampleTrack refuse what is not a move, a time or a rate', () => {
  const m = planMove(reach);
  assert.throws(() => sampleMove({}, 0), /human: sampleMove takes a move planMove made/);
  assert.throws(() => sampleMove(m, NaN), /sampleMove's t is seconds from the move's start, a finite number — not NaN/);
  assert.throws(() => sampleTrack(m, { rate: 0 }), /sampleTrack's rate is samples a second, from 1 to 1000 — not 0/);
  const long = planMove({ ...reach, seconds: 3600 });
  assert.throws(() => sampleTrack(long, { rate: 1000 }), /is 3600001 samples — at most 100000: give a lower rate/);
  const track = sampleTrack(m);
  assert.equal(track.samples.length, Math.ceil(m.plan.seconds * 120) + 1);
  assert.equal(track.samples[track.samples.length - 1].t, m.plan.seconds);
  assert.equal(track.pushes, 1); assert.ok(deepFrozen(track));
});

test("the seed: the piece's name and the intent's shape — never who (where the entry is listed), nor the timing keys", () => {
  const path = [[100, 100], [300, 180], [420, 90], [600, 260]];
  const base = planMove({ do: 'draw', name: 'cable', who: 'wires[0]', path });
  const moved = planMove({ do: 'draw', name: 'cable', who: 'wires[7]', path });
  assert.deepEqual([moved.plan.xs, moved.plan.ys], [base.plan.xs, base.plan.ys], 'moved in its list: the same wobble');
  for (const timing of [{ seconds: 4 }, { speed: 90 }]) {
    const slower = planMove({ do: 'draw', name: 'cable', who: 'wires[0]', path, ...timing });
    assert.deepEqual([slower.plan.xs, slower.plan.ys], [base.plan.xs, base.plan.ys], `${Object.keys(timing)[0]}: the same wobble's shape`);
    assert.notEqual(slower.plan.seconds, base.plan.seconds);
  }
  assert.notDeepEqual(planMove({ do: 'draw', who: 'wires[0]', path }).plan.xs, base.plan.xs, 'no piece name: another seed');
  assert.notDeepEqual(planMove({ do: 'draw', name: 'cable', path: [...path, [700, 300]] }).plan.xs.slice(0, 50), base.plan.xs.slice(0, 50), 'another shape, another wobble');
  assert.notDeepEqual(planMove({ do: 'draw', name: 'cable', path, model: { name: 'power-law', wavelength: 30 } }).plan.xs, base.plan.xs, 'its options count');
});

test('beside the words, the data: how the model was chosen, and the numbers each plan chose by', () => {
  const usual = planMove(reach), named = planMove({ ...reach, target: 80, model: 'min-jerk' });
  assert.deepEqual(usual.choice, { by: 'usual' }); assert.deepEqual(named.choice, { by: 'named' });
  assert.deepEqual(usual.plan.basis, { distance: 500, target: 40, targetDefaulted: true, bits: Math.log2(500 / 40 + 1), a: 0.1, b: 0.2, seconds: usual.plan.seconds, secondsGiven: false, bend: 0.06 });
  assert.equal(named.plan.basis.targetDefaulted, false); assert.equal(named.plan.basis.target, 80);
  assert.equal(planMove({ ...reach, seconds: 2 }).plan.basis.secondsGiven, true);
  const pen = planMove({ do: 'draw', path: [[0, 0], [300, 0]], speed: 150 }).plan.basis;
  assert.deepEqual(Object.keys(pen), ['length', 'speed', 'speedDefaulted', 'seconds', 'secondsGiven', 'tremor', 'wavelength', 'ramp', 'floor', 'points']);
  assert.equal(pen.speed, 150); assert.equal(pen.speedDefaulted, false); assert.equal(pen.floor, 0.00025);
  assert.deepEqual(planMove({ do: 'write', points: [[0, 0], [9, 9], [18, 0]] }).plan.basis, { strokes: 2, from: 'points', seconds: planMove({ do: 'write', points: [[0, 0], [9, 9], [18, 0]] }).plan.seconds, secondsGiven: false, mu: -1.6, sigma: 0.3, gap: 0.16, bend: 0 });
  const fromStrokes = planMove({ do: 'write', strokes: [{ distance: 5, start: 0, mu: -1, sigma: 0.2, angleFrom: 0, angleTo: 0 }], seconds: 1 }).plan.basis;
  assert.deepEqual([fromStrokes.from, fromStrokes.mu, fromStrokes.secondsGiven], ['strokes', null, true]);
  const own = (basis) => planMove({ do: 'reach', who: 'b2', model: 'reel:b' }, { models: [{ family: 'reach', name: 'reel:b', plan: () => ({ seconds: 1, basis }), sample: () => ({ x: 0, y: 0 }) }] });
  assert.deepEqual(own({ bits: 2 }).plan.basis, { bits: 2 });
  assert.throws(() => own({ deep: { bits: 2 } }), /b2: the model "reel:b"'s plan's basis is a flat record of the numbers it chose by/);
  assert.throws(() => own([1]), /plan's basis is a flat record/);
});

test('a sample may carry lists of numbers or points (a hanging chain), plain and bounded', () => {
  const chainModel = (chain) => ({ family: 'hang', name: 'reel:chain', plan: () => ({ seconds: 1 }), sample: () => ({ x: 0, y: 0, chain, weights: [1, 2] }) });
  const go = (chain) => { const models = [chainModel(chain)]; return sampleMove(planMove({ do: 'hang', who: 'rope', model: 'reel:chain' }, { models }), 0.5, { models }); };
  const s = go([[0, 0], [0, 10], [2, 20]]);
  assert.deepEqual(s, { x: 0, y: 0, chain: [[0, 0], [0, 10], [2, 20]], weights: [1, 2] });
  assert.ok(Object.isFrozen(s.chain) && Object.isFrozen(s.chain[1]) && Object.isFrozen(s.weights));
  assert.deepEqual(go([]).chain, []);
  assert.throws(() => go(Array.from({ length: 1025 }, () => [0, 0])), /rope: the model "reel:chain"'s sample's chain is at most 1024 long — not 1025/);
  assert.throws(() => go([[0, 0], [1, NaN]]), /sample's chain is a list of numbers, or of points \[x, y\] — its \[1\] is \[0,NaN\]|its \[1\] is \[1,NaN\]/);
  assert.throws(() => go([[0, 0, 0]]), /its \[0\] is \[0,0,0\]/);
  assert.throws(() => go([[[1, 2], 3]]), /a list of numbers, or of points/);
  assert.throws(() => go([() => 1]), /its \[0\] is a function/);
  assert.throws(() => go(Object.defineProperty([0, 0], 1, { get: () => 1 })), /sample's chain\[1\] is read as a stored value, and this one is a getter/);
  assert.throws(() => go({ a: 1 }), /sample's chain is a finite number, or a list of at most 1024 numbers or points/);
  const bad = [{ family: 'hang', name: 'reel:x', plan: () => ({ seconds: 1 }), sample: () => ({ x: [1], y: 0 }) }];
  assert.throws(() => sampleMove(planMove({ do: 'hang', model: 'reel:x' }, { models: bad }), 0, { models: bad }), /sample gives x and y/);
});

test('a reach bows at most 0.3 of its length either way, and at the most still passes its own jerk critic', async () => {
  const { checkMove } = await import('../human.js');
  for (const bend of [-0.3, 0.3]) assert.deepEqual(checkMove(planMove({ ...reach, model: { name: 'min-jerk', bend } })).measures.jerk, 0);
  assert.throws(() => planMove({ ...reach, model: { name: 'min-jerk', bend: 0.31 } }), /model "min-jerk"'s bend is a number from -0\.3 to 0\.3 — not 0\.31/);
});

test('a list of models changed after it was read is read again: a model added later is found, a model taken out is gone', () => {
  const models = [];
  assert.throws(() => planMove({ do: 'reach', model: 'reel:late' }, { models }), /there is no model "reel:late"/);
  models.push({ family: 'reach', name: 'reel:late', plan: () => ({ seconds: 1 }), sample: () => ({ x: 1, y: 2 }) });
  const m = planMove({ do: 'reach', model: 'reel:late' }, { models });
  assert.deepEqual(sampleMove(m, 0, { models }), { x: 1, y: 2 });
  models.pop();
  assert.throws(() => sampleMove(m, 0, { models }), /the move was planned by "reel:late", which is not here/);
});

test('a pen slows into a hairpin: the reversal is its sharpest bend, not a straight run', () => {
  const m = planMove({ do: 'draw', path: [[100, 100], [400, 100], [100, 100]] });
  const tr = sampleTrack(m, { rate: 1000 }).samples, speeds = tr.slice(1).map((s, i) => ({ x: s.x, v: Math.hypot(s.x - tr[i].x, s.y - tr[i].y) / (s.t - tr[i].t) }));
  const tip = speeds.reduce((b, p) => (p.x > b.x ? p : b)), mid = speeds.filter((p) => Math.abs(p.x - 250) < 3).map((p) => p.v);
  assert.ok(tip.v < Math.min(...mid) / 2, `the tip at ${tip.v} px a second, the legs at ${Math.min(...mid)} or more`);
});

test('a straight line keeps a steady speed away from its ends, tremor and all: the wobble moves the pen across, never changes its pace', () => {
  const m = planMove({ do: 'draw', name: 'rule', path: [[100, 500], [1300, 500]] });
  const tr = sampleTrack(m, { rate: 1000 }).samples, speeds = [];
  for (let i = 10; i < tr.length; i += 10) if (tr[i].x > 300 && tr[i].x < 1100) speeds.push(Math.hypot(tr[i].x - tr[i - 10].x, tr[i].y - tr[i - 10].y) / (tr[i].t - tr[i - 10].t));
  assert.ok(Math.max(...speeds) / Math.min(...speeds) < 1.02, `between ${Math.min(...speeds)} and ${Math.max(...speeds)} px a second`);
  assert.ok(tr.some((s) => Math.abs(s.y - 500) > 0.3), 'and it does tremble');
});

test('a wobble is never larger than the space it wobbles in: a hairpin a pixel wide swings at most half a pixel', () => {
  const path = [[0, 32], [1, 184], [1, 2]];
  const still = planMove({ do: 'draw', name: 'pin', path, model: { name: 'power-law', tremor: 0 } }), shaky = planMove({ do: 'draw', name: 'pin', path });
  const most = Math.max(...shaky.plan.xs.map((x, i) => Math.hypot(x - still.plan.xs[i], shaky.plan.ys[i] - still.plan.ys[i])));
  assert.ok(most <= 0.5 + 1e-9 && most > 0.05, `the most it swings: ${most}`);
  const open = planMove({ do: 'draw', name: 'pin', path: [[0, 32], [1, 184], [60, 2]] });
  const free = planMove({ do: 'draw', name: 'pin', path: [[0, 32], [1, 184], [60, 2]], model: { name: 'power-law', tremor: 0 } });
  assert.ok(Math.max(...open.plan.xs.map((x, i) => Math.hypot(x - free.plan.xs[i], open.plan.ys[i] - free.plan.ys[i]))) > 0.5, 'with room, the full swing');
});
