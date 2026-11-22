// Camera moves between shots: the rule table (slerp, arc, cut) and its reasons, the ends exact, the timing the minimum-jerk
// law's, and each critic catching a bad path made by hand and passing a good one. Geometry to a tolerance; choices exactly.
import test from 'node:test';
import assert from 'node:assert/strict';
import { planCameraMove, sampleCameraMove, cameraTrack, checkCameraMove, frameOf, readCamera, quatAngle, quatFromAxisAngle, quatMultiply, quatRotate, slerp, CAMERA_MOVES,
  CAMERA_MOVE_RULES, CAMERA_CRITICS, HORIZON_MOST, SIGHT_DROP } from '../shot.js';
import { minJerk } from '../human.js';
import { minJerk as sharedMinJerk } from '../src/timing/minJerk.js';

const DEG = Math.PI / 180;
const frame = [1280, 720];
const scene = { unit: 'm', things: [{ name: 'db', at: [0, 1, 0], r: 1 }, { name: 'cache', at: [4, 1, 0], r: 1 }] };
const walled = { unit: 'm', things: [{ name: 'db', at: [0, 1, 0], r: 1 }, { name: 'wall', at: [0, 1, 3], size: [2.4, 2.6] }] };
const fly = (from, to, more = {}) => planCameraMove({ do: 'fly', from: { on: 'db', from }, to: { on: 'db', from: to }, ...more }, scene);
const near = (a, b, within = 1e-9) => assert.ok(Math.abs(a - b) <= within, `${a} is not within ${within} of ${b}`);
const filled = (c) => readCamera(c);

test('the minimum-jerk law has one copy: the human door hands out the very function the camera moves time by', () => {
  assert.equal(minJerk, sharedMinJerk);
});

test('the rule table: a small turn keeps its height, a large one arcs, a fly past cutPast cuts, an orbit never does', () => {
  const table = [
    [fly('front', 'front-right'), 'slerp', 'small-turn', 45],
    [fly('front', 'right'), 'arc', 'large-turn', 90],
    [fly('front', 'back-right'), 'arc', 'large-turn', 135],
    [fly('front', 'back'), 'cut', 'turn-past-cut', 180],
    [fly('front', 'back', { cutPast: 180 }), 'arc', 'large-turn', 180],
    [fly('front', 'right', { cutPast: 30 }), 'cut', 'turn-past-cut', 90],
    [planCameraMove({ do: 'orbit', around: 'db', by: 200 }, scene), 'arc', 'large-turn', 200],
    [planCameraMove({ do: 'orbit', around: 'db', by: -30 }, scene), 'slerp', 'small-turn', 30],
  ];
  for (const [move, kind, rule, turn] of table) {
    assert.equal(move.kind, kind);
    assert.equal(move.choice.rule, rule);
    assert.equal(move.choice.kind, kind);
    assert.equal(move.choice.turn, turn);
  }
  assert.deepEqual(CAMERA_MOVE_RULES.map((r) => [r.rule, r.kind]), [['turn-past-cut', 'cut'], ['small-turn', 'slerp'], ['large-turn', 'arc']]);
  assert.equal(table[6][0].choice.cutPast, null, 'an orbit has no cut to pass');
});

test('the reason says the choice and its numbers, in words a record keeps', () => {
  assert.equal(fly('front', 'right').reason, "do: 'fly' → arc: the look turns 90°, more than 45° and not past cutPast 150°, so it rises 10° over its middle to keep the subject in sight, over 4.42 s of minimum jerk, set so its fastest turn (40.4°/s) stays under 45°/s");
  assert.equal(fly('front', 'front-right', { seconds: 3 }).reason, "do: 'fly' → slerp: the look turns 45°, at most 45°, so it keeps its height and turns at one speed, over the 3 s given, of minimum jerk (its fastest turn 28.1°/s)");
  assert.equal(fly('front', 'back', { seconds: 2 }).reason, "do: 'fly' → cut: the look turns 180°, past cutPast 150° — a swing that far turns the whole world round, and a cut reads cleaner; seconds: 2 is not used");
  const high = planCameraMove({ do: 'orbit', around: 'db', by: 90, from: 'front high', lift: 45 }, scene);
  assert.match(high.reason, /, so it rises 45° over its middle to keep the subject in sight, over /);
  assert.equal(high.basis.liftCapped, false);
  const steep = planCameraMove({ do: 'fly', from: { target: [0, 1, 0], azimuth: 0, elevation: 70 * DEG, distance: 8, focal: 1.25 }, to: { target: [0, 1, 0], azimuth: Math.PI / 2, elevation: 70 * DEG, distance: 8, focal: 1.25 }, lift: 20 });
  assert.equal(steep.basis.lift, 5);
  assert.equal(steep.basis.liftCapped, true);
  assert.match(steep.reason, /rises 5° over its middle to keep the subject in sight \(20° asked; 75° is the highest its middle goes\)/);
});

test('the ends are the cameras handed in, exactly, and sampling past them holds them', () => {
  const move = fly('front-left', 'right high');
  assert.deepEqual(move.from, filled(frameOf({ on: 'db', from: 'front-left' }, scene)));
  assert.deepEqual(move.to, filled(frameOf({ on: 'db', from: 'right high' }, scene)));
  assert.deepEqual(sampleCameraMove(move, 0).camera, move.from);
  assert.deepEqual(sampleCameraMove(move, -5).camera, move.from);
  assert.deepEqual(sampleCameraMove(move, move.seconds).camera, move.to);
  assert.deepEqual(sampleCameraMove(move, 1e9).camera, move.to);
  const track = cameraTrack(move);
  assert.deepEqual(track.samples[0].camera, move.from);
  assert.deepEqual(track.samples.at(-1).camera, move.to);
  assert.equal(track.samples.at(-1).t, move.seconds);
  const orbit = planCameraMove({ do: 'orbit', around: 'db', by: -250, from: { from: 'front-left high', size: 'close' } }, scene);
  assert.equal(orbit.to.azimuth, orbit.from.azimuth - 250 * DEG);
  assert.deepEqual({ ...orbit.to, azimuth: 0 }, { ...orbit.from, azimuth: 0 });
});

test('a fly turns the shorter way round, across ±180° too: back-right to back-left goes through the back', () => {
  const move = fly('back-right', 'back-left');
  assert.equal(move.basis.swing, 90);
  near(Math.cos(sampleCameraMove(move, move.seconds / 2).camera.azimuth), -1, 1e-12);
  assert.equal(fly('back-left', 'back-right').basis.swing, -90);
});

test('a small turn at one height is a slerp about the vertical: the eye where the turned quaternion puts it', () => {
  const move = fly('front', 'front-right'), target = move.from.target, start = sampleCameraMove(move, 0).eye, yaw = quatFromAxisAngle([0, 1, 0], 45 * DEG);
  for (const t of [0.3, 0.9, 1.4]) {
    const sample = sampleCameraMove(move, t), want = quatRotate(slerp([1, 0, 0, 0], yaw, sample.progress), start.map((v, i) => v - target[i])).map((v, i) => v + target[i]);
    sample.eye.forEach((v, i) => near(v, want[i], 1e-9));
    near(sample.camera.elevation, 0, 1e-15);
  }
});

test('an arc rises by its lift over its middle; the timing is minimum jerk, so progress is its curve at every moment', () => {
  const move = fly('front', 'right high');
  const middle = sampleCameraMove(move, move.seconds / 2);
  near(middle.progress, 0.5, 1e-15);
  near(middle.camera.elevation, (0 + 30) / 2 * DEG + CAMERA_MOVES.rise * DEG, 1e-12);
  for (const t of [0.1, 1.7, 3.3]) assert.equal(sampleCameraMove(move, t).progress, minJerk(t / move.seconds));
  // the distance zooms at one rate: by equal ratios
  const wide = planCameraMove({ do: 'fly', from: { on: 'db', from: 'front', size: 'wide' }, to: { on: 'db', from: 'front', size: 'close' } }, scene);
  const half = sampleCameraMove(wide, wide.seconds / 2).camera;
  near(half.distance, Math.sqrt(wide.from.distance * wide.to.distance), 1e-9);
  near(half.focus, half.distance, 0, 'the focus follows the distance when both ends focus on their subject');
  assert.equal(wide.kind, 'slerp');
  assert.equal(wide.seconds, CAMERA_MOVES.leastSeconds, 'a move that does not turn takes the shortest beat');
});

test('the seconds come from the comfort limit: the planned path\'s fastest turn, sampled finely, stays under it', () => {
  for (const move of [fly('front', 'right'), fly('front', 'back', { cutPast: 180 }), planCameraMove({ do: 'orbit', around: ['db', 'cache'], by: 720, from: 'low' }, scene)]) {
    assert.equal(move.basis.secondsGiven, false);
    assert.ok(move.basis.peak <= CAMERA_MOVES.comfort * CAMERA_MOVES.planShare + 0.05);
    const measured = checkCameraMove(move, { rate: 240 }).measures['turn-speed'];
    assert.ok(measured <= CAMERA_MOVES.comfort, `${measured}°/s at 240 samples a second`);
  }
});

test('cameras as numbers fly with no scene; a camera over the top is the same view the other way round, and the path leaves it smoothly', () => {
  const a = { target: [0, 0, 0], azimuth: 0, elevation: 120 * DEG, distance: 10, focal: 1.25 }, b = { target: [1, 0, 0], azimuth: Math.PI, elevation: 30 * DEG, distance: 5, focal: 2, aperture: 0.1, focus: 4, shift: [0.1, 0] };
  const move = planCameraMove({ do: 'fly', from: a, to: b });
  assert.equal(move.choice.turn, 30);
  assert.deepEqual(move.from, filled(a));
  const first = sampleCameraMove(move, 0), soon = sampleCameraMove(move, 1e-3);
  first.eye.forEach((v, i) => near(v, soon.eye[i], 1e-6));
  assert.ok(quatAngle(first.look, soon.look) < 1e-6);
  for (const s of cameraTrack(move, { rate: 10 }).samples) readCamera(s.camera);   // every sample is a camera the shot door reads
  const measures = checkCameraMove(move).measures;
  assert.equal(measures['in-sight'], null);
  assert.equal(measures['line-of-action'], null);
});

test('a cut is its two views at 0 s; it turns nothing while the viewer watches', () => {
  const cut = fly('front', 'back');
  assert.equal(cut.seconds, 0);
  assert.equal(cut.plan, null);
  const track = cameraTrack(cut);
  assert.equal(track.samples.length, 2);
  assert.deepEqual(track.samples[0].camera, cut.from);
  assert.deepEqual(track.samples[1].camera, cut.to);
  assert.equal(track.samples[1].cut, true);
  assert.equal(sampleCameraMove(cut, 0).cut, true);
  assert.deepEqual(checkCameraMove(cut, { scene, frame }).measures, { 'in-sight': 0, 'turn-speed': 0, 'line-of-action': null, horizon: 0 });   // one subject: no line
});

test('the same intent, the same move; a structured copy samples the same, and every answer is frozen', () => {
  const intent = { do: 'orbit', around: ['db', 'cache'], by: 135, from: 'front-left high', who: 'shots[3]' };
  const a = planCameraMove(intent, scene), b = planCameraMove(intent, scene);
  assert.deepEqual(a, b);
  assert.ok(Object.isFrozen(a) && Object.isFrozen(a.basis) && Object.isFrozen(a.from.target));
  assert.deepEqual(sampleCameraMove(structuredClone(a), 1.234), sampleCameraMove(a, 1.234));
  assert.ok(Object.isFrozen(cameraTrack(a).samples[3].look));
});

test('in-sight: a fly through the front, behind a wall, is found with lift as its fix, and following the fix clears it', () => {
  const intent = { do: 'fly', from: { on: 'db', from: 'left' }, to: { on: 'db', from: 'right' }, cutPast: 180, who: 'shots[2]' };
  const low = checkCameraMove(planCameraMove(intent, walled), { scene: walled, frame });
  assert.equal(low.findings.length, 1);
  const [found] = low.findings;
  assert.equal(found.critic, 'in-sight');
  assert.equal(found.level, 'warn');
  assert.match(found.message, /^shots\[2\]: at \d+\.\d s it shows 0% of its subject, against 100% at its ends — "wall" covers it on the way$/);
  assert.equal(found.fix, 'lift it over: lift: 25');
  assert.equal(found.basis.blocker, 'wall');
  const mid = checkCameraMove(planCameraMove({ ...intent, lift: 25 }, walled), { scene: walled, frame });
  assert.equal(mid.findings[0].fix, 'lift it over: lift: 40');
  assert.deepEqual(checkCameraMove(planCameraMove({ ...intent, lift: 40 }, walled), { scene: walled, frame }).findings, []);
  // at the highest lift, a fly is told to cut; an orbit to start higher or wider
  const top = checkCameraMove(planCameraMove({ ...intent, lift: 45, from: { on: 'db', from: 'left low' }, to: { on: 'db', from: 'right low' } }, walled), { scene: walled, frame });
  assert.match(top.findings[0].fix, /^cut instead: cutPast: \d+$/);
  const orbit = checkCameraMove(planCameraMove({ do: 'orbit', around: 'db', by: 180, from: 'left low', lift: 45 }, walled), { scene: walled, frame });
  assert.equal(orbit.findings[0].fix, "start from a higher or wider view: from: {from: 'front high', size: 'wide'}");
  assert.ok(SIGHT_DROP > 0 && SIGHT_DROP < 1);
});

test('in-sight: a path made by hand that swings away from its subject is found; the shots\' own faults are not the move\'s', () => {
  const at = frameOf({ on: 'db', from: 'front' }, scene), away = { ...at, target: [30, 1, 0] };
  const swing = { samples: [{ t: 0, camera: at }, { t: 1, camera: away }, { t: 2, camera: at }], on: 'db', who: 'reel[4]' };
  const found = checkCameraMove(swing, { scene, frame }).findings.find((f) => f.critic === 'in-sight');
  assert.equal(found.message, 'reel[4]: at 1 s it shows 0% of its subject, against 100% at its ends — it leaves the frame on the way');
  assert.equal(found.fix, 'keep the subject in frame on the way, or cut');
  // a path that starts and ends behind the wall, and stays there, loses nothing the move added
  const hidden = frameOf({ on: 'db', from: 'front' }, walled);
  const still = { samples: [{ t: 0, camera: hidden }, { t: 1, camera: { ...hidden, azimuth: 0.01 } }, { t: 2, camera: hidden }], on: 'db' };
  assert.equal(checkCameraMove(still, { scene: walled, frame }).measures['in-sight'], 0);
  // a hand path behind a blocker names it, and with no intent to lift says to go round
  const round = { samples: [{ t: 0, camera: frameOf({ on: 'db', from: 'left' }, walled) }, { t: 1, camera: hidden }, { t: 2, camera: frameOf({ on: 'db', from: 'right' }, walled) }], on: 'db' };
  assert.equal(checkCameraMove(round, { scene: walled, frame }).findings[0].fix, 'take the path over or round "wall", or cut');
});

test('turn-speed: too few seconds is found, with the seconds that fix it; the fix passes', () => {
  const fast = fly('front', 'right', { seconds: 0.8, who: 'shots[5]' });
  const [found] = checkCameraMove(fast, { scene, frame }).findings;
  assert.equal(found.critic, 'turn-speed');
  assert.match(found.message, /^shots\[5\]: its look turns \d+\.\d°\/s at \d+\.\d s, past 45°\/s — the picture smears and the viewer loses their place$/);
  const need = Number(found.fix.match(/^slow it: seconds: (\d+(?:\.\d)?)$/)[1]);
  assert.ok(need > 3 && need < 5);
  assert.deepEqual(checkCameraMove(fly('front', 'right', { seconds: need }), { scene, frame }).findings, []);
  // a jump made by hand that is not marked a cut is a very fast turn
  const at = frameOf({ on: 'db', from: 'front' }, scene);
  const jump = { samples: [{ t: 0, camera: at }, { t: 0.1, camera: { ...at, azimuth: 1 } }] };
  assert.ok(checkCameraMove(jump).measures['turn-speed'] > 500);
  assert.deepEqual(checkCameraMove({ samples: [{ t: 0, camera: at }, { t: 0, camera: { ...at, azimuth: 1 }, cut: true }] }).measures['turn-speed'], 0);
  // a cut after a pause is still a cut: no turn is seen, however long the gap
  assert.deepEqual(checkCameraMove({ samples: [{ t: 0, camera: at }, { t: 0.5, camera: at }, { t: 0.6, camera: { ...at, azimuth: 2 }, cut: true }] }).measures['turn-speed'], 0);
});

test('line-of-action: a cut across the line is a fault, a move across it a note, a move that keeps to one side nothing', () => {
  const two = (from) => ({ on: ['db', 'cache'], from });
  const cut = checkCameraMove(planCameraMove({ do: 'fly', from: two('front'), to: two('back') }, scene), { scene, frame }).findings.find((f) => f.critic === 'line-of-action');
  assert.deepEqual([cut.level, cut.fix], ['warn', 'fly instead, so the viewer sees the camera go round: cutPast: 180']);
  assert.match(cut.message, /cuts across the line of action from "db" to "cache"/);
  const flown = checkCameraMove(planCameraMove({ do: 'fly', from: two('front'), to: two('back'), cutPast: 180 }, scene), { scene, frame }).findings.find((f) => f.critic === 'line-of-action');
  assert.deepEqual([flown.level, flown.fix], ['note', 'end on the side it starts: a to on the same side of the line of action from "db" to "cache"']);
  const kept = checkCameraMove(planCameraMove({ do: 'orbit', around: ['db', 'cache'], by: 90, from: 'front-left' }, scene), { scene, frame });
  assert.equal(kept.measures['line-of-action'], 0);
  // the long way round crosses twice and comes back: go the other way
  const long = checkCameraMove(planCameraMove({ do: 'orbit', around: ['db', 'cache'], by: -270, from: 'front-left' }, scene), { scene, frame });
  const note = long.findings.find((f) => f.critic === 'line-of-action');
  assert.equal(long.measures['line-of-action'], 2);
  assert.equal(note.fix, 'go the other way round: by: 90');
  // ends apart: no way round avoids it
  const apart = checkCameraMove(planCameraMove({ do: 'orbit', around: ['db', 'cache'], by: 180 }, scene), { scene, frame }).findings.find((f) => f.critic === 'line-of-action');
  assert.equal(apart.fix, 'stop on the side it starts: a by that keeps it on one side of the line of action from "db" to "cache"');
  // a line named in the settings, and a line with one thing above the other (no line on the ground)
  const stacked = { things: [...scene.things, { name: 'lamp', at: [0, 5, 0], r: 0.2 }] };
  assert.equal(checkCameraMove(planCameraMove({ do: 'orbit', around: 'db', by: 90 }, stacked), { scene: stacked, frame, line: ['db', 'lamp'] }).measures['line-of-action'], null);
  assert.equal(checkCameraMove(planCameraMove({ do: 'orbit', around: 'db', by: 90, line: ['db', 'cache'] }, scene), { scene, frame }).measures['line-of-action'], 0);
});

test('horizon: a planned path never leans; a hand path that blends in a roll is found', () => {
  const move = fly('front-left', 'back-right high', { cutPast: 180 });
  assert.ok(checkCameraMove(move).measures.horizon < 1e-9);
  const track = cameraTrack(move, { rate: 20 }), last = track.samples.length - 1;
  const lean = { samples: track.samples.map((s, i) => ({ t: s.t, camera: s.camera, look: quatMultiply(s.look, quatFromAxisAngle([0, 0, 1], 0.1 * Math.sin(Math.PI * i / last))) })), who: 'reel[1]' };
  const [found] = checkCameraMove(lean).findings.filter((f) => f.critic === 'horizon');
  assert.match(found.message, /^reel\[1\]: leans the horizon 5\.7° at \d+\.\d s — the ground looks to tip$/);
  assert.match(found.fix, /^keep it level: plan it as \{do: 'fly', from, to\}/);
  assert.ok(HORIZON_MOST < 5.7);
  assert.deepEqual(CAMERA_CRITICS, ['in-sight', 'turn-speed', 'line-of-action', 'horizon']);
});

test('a good move passes every critic', () => {
  const move = planCameraMove({ do: 'orbit', around: ['db', 'cache'], by: 60, from: 'front-left high' }, scene);
  const { measures, findings } = checkCameraMove(move, { scene, frame });
  assert.deepEqual(findings, []);
  assert.equal(measures['in-sight'], 0);
  assert.equal(measures['line-of-action'], 0);
});
