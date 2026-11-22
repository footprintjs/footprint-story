// Camera moves by property: on any two cameras or any orbit, the ends are exact, the choice follows the rule table, a move
// timed by the comfort limit stays under it, the horizon stays level, every sample is a camera, and the same intent gives
// the same move. FC_RUNS=20000 npm test runs a deep sweep.
import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { planCameraMove, sampleCameraMove, cameraTrack, checkCameraMove, readCamera, CAMERA_MOVES } from '../shot.js';
import { quatAngle } from '../geometry.js';
import { lookOf } from '../src/shot/movePace.js';

const RUNS = Number(process.env.FC_RUNS) || 200;
// a move is sampled hundreds of times: a share of the runs keeps the deep sweep to minutes
const runs = (share = 1) => ({ numRuns: Math.max(20, Math.round(RUNS * share)) });
const DEG = Math.PI / 180;
const coord = fc.double({ min: -20, max: 20, noNaN: true });
const camera = fc.record({
  target: fc.tuple(coord, coord, coord), azimuth: fc.double({ min: -7, max: 7, noNaN: true }), elevation: fc.double({ min: -1.3, max: 1.3, noNaN: true }),
  distance: fc.double({ min: 0.5, max: 50, noNaN: true }), focal: fc.double({ min: 0.5, max: 3, noNaN: true }),
});
const scene = { unit: 'm', things: [{ name: 'db', at: [0, 1, 0], r: 1 }, { name: 'cache', at: [4, 1, 0], r: 1 }] };
const views = fc.constantFrom('front', 'front-right', 'right high', 'back-right low', 'back', 'back-left high', 'left', 'front-left low', 'high');

test('property: a fly between any two cameras starts and ends on them exactly, by the rule table, every sample a camera', () => {
  fc.assert(fc.property(camera, camera, fc.option(fc.integer({ min: 0, max: 180 })), (a, b, cutPast) => {
    const move = planCameraMove({ do: 'fly', from: a, to: b, ...(cutPast === null ? {} : { cutPast }) });
    const turn = Number((quatAngle(lookOf(readCamera(a)), lookOf(readCamera(b))) / DEG).toFixed(1));
    const tooFar = move.basis.comfortSeconds > CAMERA_MOVES.longest;
    const kind = turn > (cutPast ?? CAMERA_MOVES.cutPast) || tooFar ? 'cut' : turn <= CAMERA_MOVES.smallTurn ? 'slerp' : 'arc';
    assert.equal(move.kind, kind);
    assert.equal(move.choice.turn, turn);
    assert.deepEqual(move.from, readCamera(a));
    assert.deepEqual(move.to, readCamera(b));
    const track = cameraTrack(move, { rate: 12 });
    assert.deepEqual(track.samples[0].camera, move.from);
    assert.deepEqual(track.samples.at(-1).camera, move.to);
    if (kind === 'cut') { assert.equal(move.seconds, 0); return; }
    let last = -1;
    for (const s of track.samples) { readCamera(s.camera); assert.ok(s.progress >= last); last = s.progress; }
    assert.ok(move.seconds >= CAMERA_MOVES.leastSeconds);
  }), runs());
});

test('property: a move timed by the comfort limit stays under it, and its horizon stays level', () => {
  fc.assert(fc.property(camera, camera, (a, b) => {
    const move = planCameraMove({ do: 'fly', from: a, to: b, cutPast: 180 });
    const { measures } = checkCameraMove(move, { rate: 60 });
    assert.ok(measures['turn-speed'] <= CAMERA_MOVES.comfort, `${measures['turn-speed']}°/s`);
    assert.ok(measures.horizon < 1e-6);
  }), runs(0.5));
});

test('property: an orbit turns by exactly its by, never cuts, and the same intent gives the same move', () => {
  fc.assert(fc.property(fc.integer({ min: -720, max: 720 }), views, fc.constantFrom('db', ['db', 'cache']), (by, from, around) => {
    const intent = { do: 'orbit', around, by, from }, move = planCameraMove(intent, scene);
    assert.notEqual(move.kind, 'cut');
    assert.equal(move.kind, Math.abs(by) <= CAMERA_MOVES.smallTurn ? 'slerp' : 'arc');
    assert.equal(move.to.azimuth, move.from.azimuth + by * DEG);
    assert.deepEqual(planCameraMove(intent, scene), move);
    const t = move.seconds * 0.37;
    assert.deepEqual(sampleCameraMove(move, t), sampleCameraMove(structuredClone(move), t));
  }), runs(0.5));
});

test('property: a move given too few seconds is found too fast, and planned again with the seconds the fix names it passes', () => {
  fc.assert(fc.property(camera, camera, fc.double({ min: 0.05, max: 1, noNaN: true }), (a, b, share) => {
    const free = planCameraMove({ do: 'fly', from: a, to: b, cutPast: 180, seconds: 1 });
    const fast = planCameraMove({ do: 'fly', from: a, to: b, cutPast: 180, seconds: Math.max(0.01, free.basis.comfortSeconds * share) });
    const speed = checkCameraMove(fast, { rate: 60 }).findings.filter((f) => f.critic === 'turn-speed' || f.critic === 'travel-speed');
    if (!speed.length) return;
    if (speed.some((f) => !/seconds: [\d.]+$/.test(f.fix))) { assert.ok(speed.every((f) => /leave seconds out, and it cuts$|seconds: [\d.]+$/.test(f.fix))); return; }
    const need = Math.max(...speed.map((f) => Number(f.fix.match(/seconds: ([\d.]+)$/)[1])));
    const again = checkCameraMove(planCameraMove({ do: 'fly', from: a, to: b, cutPast: 180, seconds: need }), { rate: 60 }).findings;
    assert.deepEqual(again.filter((f) => f.critic === 'turn-speed' || f.critic === 'travel-speed'), []);
  }), runs(0.5));
});
