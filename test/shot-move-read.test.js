// Camera moves refuse what they are handed in words, every problem at once, each named where it is written; a move or a
// hand path that went astray is refused before it is sampled.
import test from 'node:test';
import assert from 'node:assert/strict';
import { planCameraMove, sampleCameraMove, cameraTrack, checkCameraMove, frameOf, MOST_ORBIT, MOST_LIFT, MOST_MOVE_SECONDS, CAMERA_MOVE_DOS, MOST_CAMERA_SAMPLES } from '../shot.js';

const scene = { unit: 'm', things: [{ name: 'db', at: [0, 1, 0], r: 1 }, { name: 'cache', at: [4, 1, 0], r: 1 }, { name: 'dot', at: [9, 9, 9] }] };
const cam = { target: [0, 0, 0], azimuth: 0, elevation: 0, distance: 5, focal: 1.25 };
const problems = (fn) => { try { fn(); } catch (e) { return e.problems.map((p) => `${p.at} ${p.message}`); } assert.fail('it did not refuse'); };

test('an intent names every problem at once', () => {
  assert.deepEqual(problems(() => planCameraMove({ do: 'zoom', who: '', seconds: 0, lift: 50, colour: 'red' }, scene)), [
    'intent.colour is not a field here (the fields are do, from, to, around, by, seconds, cutPast, lift, line, who)',
    "do must be 'fly' or 'orbit'",
    'who must have something in it that can be seen',
    'seconds is 0: it must be above 0 and at most 600',
    `lift is 50: it must be at least 0 and at most ${MOST_LIFT}`,
  ]);
  assert.deepEqual(problems(() => planCameraMove('fly')), ['intent must be an object with do, from, to, around, by, seconds, cutPast, lift, line, who']);
  assert.deepEqual(problems(() => planCameraMove({ do: 'fly', from: cam, to: cam }, { things: 'x' })), ['scene.things must be a list of things, each {name, at} with an r or a size']);
  assert.equal(MOST_MOVE_SECONDS, 600);
  assert.deepEqual([...CAMERA_MOVE_DOS], ['fly', 'orbit']);
});

test('a fly needs both ends; a shot needs the scene; orbit words do not belong', () => {
  assert.deepEqual(problems(() => planCameraMove({ do: 'fly', by: 3, around: 'db' })), [
    "around belongs to do: 'orbit'; a fly goes from one view to another: from, to",
    "by belongs to do: 'orbit'; a fly goes from one view to another: from, to",
    'from must say where the move starts: a shot or a camera',
    'to must say where the move ends: a shot or a camera',
  ]);
  assert.deepEqual(problems(() => planCameraMove({ do: 'fly', from: { on: 'db', from: 'front' }, to: 7 })), [
    'from is a shot, and a shot is framed on the scene: pass it, planCameraMove(intent, scene)',
    'to must be a shot ({on, from, size?, lens?}) or a camera ({target, azimuth, elevation, distance, focal})',
  ]);
  assert.deepEqual(problems(() => planCameraMove({ do: 'fly', from: { on: 'nope', from: 'front' }, to: { ...cam, distance: -1 }, cutPast: 200 }, scene)), [
    'from.on "nope" is not in the scene (it has "db", "cache", "dot")',
    'to.distance is -1: it must be at least 0 and at most 1000000000',
    'cutPast is 200: it must be at least 0 and at most 180',
  ]);
  assert.deepEqual(problems(() => planCameraMove({ do: 'fly', from: { on: 'dot', from: 'front' }, to: cam }, scene)), ['from.on "dot" has no size to frame: give it an r or a size, or name more things']);
});

test('an orbit names what it circles, how far, and a view to start from that names no subject', () => {
  assert.deepEqual(problems(() => planCameraMove({ do: 'orbit', to: cam, cutPast: 10 }, scene)), [
    "to belongs to do: 'fly'; an orbit says how far round: by, in degrees",
    "cutPast belongs to do: 'fly': an orbit is the move asked for, and never cuts",
    `by must say how far round, in degrees (at most ${MOST_ORBIT} either way; positive goes from front towards right)`,
    'around must name what the camera circles',
  ]);
  assert.deepEqual(problems(() => planCameraMove({ do: 'orbit', around: 'db', by: 721 })), [`by is 721: it must be at least -${MOST_ORBIT} and at most ${MOST_ORBIT}`, 'around names things in the scene: pass it, planCameraMove(intent, scene)']);
  assert.deepEqual(problems(() => planCameraMove({ do: 'orbit', around: 'db', by: 30, from: { on: 'cache', from: 'front' } }, scene)), ['from is the view the orbit starts from ({from, size?, lens?}): around names what it circles']);
  assert.deepEqual(problems(() => planCameraMove({ do: 'orbit', around: 'db', by: 30, from: 'sideways' }, scene)), ["from.from must be a named view such as 'front-left high': one of the eight round the subject, one of high, level, low, or both"]);
  assert.equal(planCameraMove({ do: 'orbit', around: 'db', by: 30, from: { from: 'back', lens: 'long' } }, scene).from.focal, 2.2);
});

test('a line names two things in the scene', () => {
  const base = { do: 'orbit', around: 'db', by: 30 };
  assert.deepEqual(problems(() => planCameraMove({ ...base, line: 'db' }, scene)), ['line must name the two things the line of action runs between: [a, b]']);
  assert.deepEqual(problems(() => planCameraMove({ ...base, line: ['db', 'db'] }, scene)), ['line must name two different things']);
  assert.deepEqual(problems(() => planCameraMove({ do: 'fly', from: cam, to: cam, line: ['db', 'cache'] })), ['line names two things in the scene: pass it, planCameraMove(intent, scene)']);
  assert.deepEqual(planCameraMove({ ...base, line: ['cache', 'db'] }, scene).line, ['cache', 'db']);
});

test('sampling and tracks refuse what is not a move', () => {
  const move = planCameraMove({ do: 'orbit', around: 'db', by: 30 }, scene);
  assert.throws(() => sampleCameraMove({ kind: 'zoom' }, 0), /sampleCameraMove takes a move from planCameraMove/);
  assert.throws(() => sampleCameraMove(null, 0), /takes a move/);
  assert.throws(() => sampleCameraMove(move, NaN), /sampleCameraMove's t is a number of seconds — not NaN/);
  assert.throws(() => cameraTrack(move, { rate: 0 }), /cameraTrack's rate is from 1 to 240 samples a second — not 0/);
  assert.equal(cameraTrack(move, { rate: 1 }).samples.length, Math.ceil(move.seconds) + 1);
  assert.ok(MOST_CAMERA_SAMPLES > 240 * 60);
});

test('a check refuses a move that went astray, a hand path out of order, and settings it does not know', () => {
  const move = planCameraMove({ do: 'orbit', around: 'db', by: 30 }, scene);
  assert.deepEqual(problems(() => checkCameraMove({ ...move, kind: 'zoom' })), ['move.kind must be slerp, arc, cut: pass a move from planCameraMove']);
  assert.deepEqual(problems(() => checkCameraMove({ ...move, plan: null, seconds: -1, to: 4 })), ['move.to must be an object with target, azimuth, elevation, distance, focal, aperture, focus, shift', 'move.seconds is -1: it must be above 0 and at most 1000000000', 'move.plan must be the plan planCameraMove made']);
  assert.deepEqual(problems(() => checkCameraMove({ ...move, plan: { ...move.plan, swing: 'x', elevation: [1] } })), ['move.plan.swing must be a finite number from -1000000000 to 1000000000', 'move.plan.elevation must be two numbers']);
  assert.deepEqual(problems(() => checkCameraMove(move, { colour: 1, rate: 500 })), ['settings.colour is not a field here (the fields are scene, frame, on, line, rate, who)', 'settings.rate is 500: it must be at least 1 and at most 240']);
  assert.deepEqual(problems(() => checkCameraMove(3)), ['move must be a move from planCameraMove or a path {samples}']);
  assert.deepEqual(problems(() => checkCameraMove(move, null)), ['settings must be an object with scene, frame, on, line, rate, who']);
  assert.deepEqual(problems(() => checkCameraMove(move, { on: 'db', line: ['db', 'cache'] })), ['on names things in the scene: pass it, {scene}', 'line names things in the scene: pass it, {scene}']);
  assert.deepEqual(problems(() => checkCameraMove(move, { scene, line: ['db', 'db'], who: 7 })), ['line must name two different things', 'who must be a name, as text']);
  assert.equal(checkCameraMove(move, { who: 'clips[0]', rate: 5 }).measures.horizon < 1e-9, true);
  const at = frameOf({ on: 'db', from: 'front' }, scene);
  assert.deepEqual(problems(() => checkCameraMove({ samples: [{ t: 0, camera: at }] })), [`move.samples must be a list of 2 to ${MOST_CAMERA_SAMPLES} samples, each {t, camera, look?, cut?}`]);
  assert.deepEqual(problems(() => checkCameraMove({ samples: [{ t: 1, camera: at }, { t: 1, camera: at }, { t: 0.5, camera: at, cut: 'yes', look: [0, 0, 0, 0] }, 9], speed: 2 })), [
    'move.speed is not a field here (the fields are samples, who, on, line, kind, seconds)',
    'move.samples[1].t is 1, before or at the sample before (1): times go forward, and only a cut takes none',
    'move.samples[2].cut must be true or false',
    'move.samples[2].look has no length: it is no turn',
    'move.samples[2].t is 0.5, before or at the sample before (1): times go forward, and only a cut takes none',
    'move.samples[3] must be an object with t, camera, look, cut, progress, eye',
  ]);
  // a sample cameraTrack made is read back as a hand path, extra keys and all
  const track = cameraTrack(move, { rate: 4 });
  assert.deepEqual(checkCameraMove({ samples: track.samples, who: 'again' }).measures.horizon < 1e-9, true);
});
