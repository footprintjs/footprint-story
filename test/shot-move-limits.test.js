// Camera moves at their limits: each subject owed what its ends lead you to expect (a fly from one subject to another, a
// start that is itself hidden), the pace counting travel and zoom as well as turning, a reason and a finding that read on
// the side of their limit, the fix that helps, and a hand path's own look honoured.
import test from 'node:test';
import assert from 'node:assert/strict';
import { planCameraMove, checkCameraMove, frameOf, readCamera, CAMERA_MOVES, SIGHT_DROP } from '../shot.js';
import { quatFromAxisAngle, quatMultiply } from '../geometry.js';
import { lookOf } from '../src/shot/movePace.js';

const DEG = Math.PI / 180, frame = [1280, 720];
const camAt = (azimuth, more = {}) => ({ target: [0, 1, 0], azimuth: azimuth * DEG, elevation: 0, distance: 8, focal: 1.25, ...more });

test('in-sight: a fly from one subject to another behind a wall is found — each subject is owed its share blended from the ends', () => {
  const scene = { unit: 'm', things: [{ name: 'db', at: [0, 1, 0], r: 1 }, { name: 'cache', at: [8, 1, 0], r: 1 }, { name: 'wall', at: [4, 1, 4], size: [3, 3] }] };
  const move = planCameraMove({ do: 'fly', from: { on: 'db', from: 'front' }, to: { on: 'cache', from: 'front' }, who: 'shots[7]' }, scene);
  const { measures, bases, findings } = checkCameraMove(move, { scene, frame });
  assert.ok(measures['in-sight'] > SIGHT_DROP, `${measures['in-sight']}`);
  assert.equal(bases['in-sight'].blocker, 'wall');
  const [found] = findings.filter((f) => f.critic === 'in-sight');
  assert.match(found.message, /^shots\[7\]: at \d+(\.\d)? s the most it shows of its subjects is \d+% \("(db|cache)"\), where its ends lead you to expect \d+% — "wall" covers it on the way$/);
  // without the wall the same fly passes: the blend is not a fault in itself
  const open = { unit: 'm', things: scene.things.slice(0, 2) };
  assert.ok(checkCameraMove(planCameraMove({ do: 'fly', from: { on: 'db', from: 'front' }, to: { on: 'cache', from: 'front' } }, open), { scene: open, frame }).measures['in-sight'] <= SIGHT_DROP);
});

test('in-sight: a start that is itself hidden does not hide what the move loses on the way; nothing seen at either end is null', () => {
  const scene = { things: [{ name: 'db', at: [0, 1, 0], r: 1 }, { name: 'w', at: [0, 1, 4], size: [3, 3] }, { name: 'w2', at: [3.2, 1, 3.2], size: [2, 3], normal: [1, 0, 1] }] };
  const move = planCameraMove({ do: 'fly', from: { on: 'db', from: 'front' }, to: { on: 'db', from: 'right' } }, scene);
  const { measures, bases } = checkCameraMove(move, { scene, frame });
  assert.ok(measures['in-sight'] > 0.5);
  assert.equal(bases['in-sight'].blocker, 'w2');
  const aside = { target: [0, 1, 0], azimuth: Math.PI, elevation: 0, distance: 8, focal: 1.25 };   // looking away from db, at both ends
  const away = { samples: [{ t: 0, camera: aside }, { t: 1, camera: { ...aside, azimuth: 0 } }, { t: 2, camera: aside }].map((x, i) => (i === 1 ? x : { ...x, camera: { ...x.camera, target: [0, 1, 30] } })), on: 'db' };
  assert.equal(checkCameraMove(away, { scene, frame }).measures['in-sight'], null);
});

test('in-sight: an arc whose rise is what hides its subject is told lift: 0, and following it clears it', () => {
  const beam = { things: [{ name: 'db', at: [0, 1, 0], r: 1 }, { name: 'beam', at: [2.09, 1.8, 2.09], size: [1.6, 0.5], normal: [0.7, 0, 0.7] }] };
  const arc = checkCameraMove(planCameraMove({ do: 'fly', from: { on: 'db', from: 'front' }, to: { on: 'db', from: 'right' } }, beam), { scene: beam, frame });
  assert.equal(arc.findings[0].fix, 'keep it level, its rise is what hides it: lift: 0');
  assert.deepEqual(checkCameraMove(planCameraMove({ do: 'fly', from: { on: 'db', from: 'front' }, to: { on: 'db', from: 'right' }, lift: 0 }, beam), { scene: beam, frame }).findings, []);
});

test('the pace counts travel: a fly to a thing far off would take minutes at a comfortable slide, so it cuts, and says why', () => {
  const far = { things: [{ name: 'db', at: [0, 1, 0], r: 1 }, { name: 'moon', at: [400, 1, 0], r: 1 }] };
  const intent = { do: 'fly', from: { on: 'db', from: 'front' }, to: { on: 'moon', from: 'front' } };
  const cut = planCameraMove(intent, far);
  assert.deepEqual([cut.kind, cut.choice.rule, cut.basis.limitedBy], ['cut', 'too-far', 'slide']);
  assert.match(cut.reason, /^do: 'fly' → cut: the look turns 0°, but at a comfortable pace the fly would take \d+\.\d+ s, longer than 12 s, set by its slide, how fast the target crosses the frame — a cut reads cleaner; give seconds to fly anyway$/);
  // given seconds it flies, and travel-speed finds it too fast, with the seconds that bring it under
  const rushed = planCameraMove({ ...intent, seconds: 0.5, who: 'shots[9]' }, far);
  assert.equal(rushed.kind, 'slerp');
  const [found] = checkCameraMove(rushed, { scene: far, frame }).findings.filter((f) => f.critic === 'travel-speed');
  assert.match(found.message, /^shots\[9\]: its target slides \d+(\.\d+)? frame heights a second at \d+(\.\d)? s, past 1 — the picture rushes past faster than an eye can follow$/);
  assert.equal(found.fix, `slow it: seconds: ${cut.basis.comfortSeconds}`);
  assert.deepEqual(checkCameraMove(planCameraMove({ ...intent, seconds: cut.basis.comfortSeconds }, far), { scene: far, frame }).findings.filter((f) => f.critic === 'travel-speed'), []);
});

test('the pace counts zoom: from 3.7 to 2520 away is timed by the subject\'s shrinking, never 0.5 s', () => {
  const near = camAt(0, { distance: 3.7 }), away = camAt(0, { distance: 2520 });
  const free = planCameraMove({ do: 'fly', from: near, to: away });
  assert.deepEqual([free.kind, free.choice.rule, free.basis.limitedBy], ['cut', 'too-far', 'zoom']);
  const comfortable = Math.log(2520 / 3.7) * 1.875 / (Math.log(CAMERA_MOVES.zoom) * CAMERA_MOVES.planShare);
  assert.ok(Math.abs(free.basis.comfortSeconds - comfortable) < 0.02, `${free.basis.comfortSeconds} against ${comfortable}`);
  const quick = planCameraMove({ do: 'fly', from: near, to: away, seconds: 3, who: 'z' });
  assert.match(quick.reason, /zooms \d+(\.\d+)?× a second \(limit 2×\)$/);
  const [found] = checkCameraMove(quick).findings;
  assert.match(found.message, /^z: its subject grows or shrinks \d+(\.\d+)?× a second at \d+(\.\d)? s, past 2× — it lurches$/);
  assert.equal(found.fix, `slow it: seconds: ${free.basis.comfortSeconds}`);
  assert.deepEqual(checkCameraMove(planCameraMove({ do: 'fly', from: near, to: away, seconds: free.basis.comfortSeconds })).findings, []);
  // past the longest move a fix cannot name seconds: it says to leave them out, and the fly cuts
  const huge = planCameraMove({ do: 'fly', from: camAt(0, { distance: 0.01 }), to: camAt(0, { distance: 0.01, target: [1e8, 1, 0] }), seconds: 1 });
  const [past] = checkCameraMove(huge).findings;
  assert.match(past.message, /slides \d\.\d\de\+\d+ frame heights a second/);
  assert.match(past.fix, /^too far to fly at a comfortable pace \(\d+(\.\d+)? s\): leave seconds out, and it cuts$/);
});

test('the rule decides on the turn it shows: both sides of 45° and of 150° read as they are chosen', () => {
  const at = (deg, more = {}) => planCameraMove({ do: 'fly', from: camAt(0), to: camAt(deg), ...more });
  const under = at(45.04), over = at(45.06);
  assert.deepEqual([under.kind, under.choice.turn], ['slerp', 45]);
  assert.match(under.reason, /^do: 'fly' → slerp: the look turns 45°, at most 45°, so/);
  assert.deepEqual([over.kind, over.choice.turn], ['arc', 45.1]);
  assert.match(over.reason, /^do: 'fly' → arc: the look turns 45\.1°, more than 45° and not past cutPast 150°/);
  const stays = at(149.96), cuts = at(150.06);
  assert.deepEqual([stays.kind, stays.choice.turn], ['arc', 150]);
  assert.match(stays.reason, /the look turns 150°, more than 45° and not past cutPast 150°/);
  assert.deepEqual([cuts.kind, cuts.choice.turn], ['cut', 150.1]);
  assert.match(cuts.reason, /the look turns 150\.1°, past cutPast 150°/);
});

test('turn-speed and horizon print a number beside its limit so it reads on its side: 45.04°/s is past 45, 0.504° past 0.5', () => {
  const camera = frameOf({ on: 'db', from: 'front' }, { things: [{ name: 'db', at: [0, 1, 0], r: 1 }] }), look = lookOf(readCamera(camera));
  const turned = (deg) => ({ samples: [{ t: 0, camera }, { t: 1, camera, look: quatMultiply(quatFromAxisAngle([0, 1, 0], deg * DEG), look) }], who: 'h' });
  assert.match(checkCameraMove(turned(45.04)).findings[0].message, /^h: its look turns 45\.04°\/s at 1 s, past 45°\/s/);
  assert.deepEqual(checkCameraMove(turned(44.96)).findings, []);
  const leaned = (deg) => ({ samples: [{ t: 0, camera, look: quatMultiply(look, quatFromAxisAngle([0, 0, 1], deg * DEG)) }, { t: 100, camera }], who: 'h' });
  assert.match(checkCameraMove(leaned(0.504)).findings[0].message, /^h: leans the horizon 0\.504° at 0 s/);
  assert.deepEqual(checkCameraMove(leaned(0.499)).findings, []);
});

test('a hand path\'s own look is honoured: in-sight sees through it, the line of action reads left and right through it, two subjects are its line', () => {
  const scene = { unit: 'm', things: [{ name: 'db', at: [0, 1, 0], r: 1 }, { name: 'cache', at: [4, 1, 0], r: 1 }] };
  const camera = frameOf({ on: 'db', from: 'front' }, scene), look = lookOf(readCamera(camera));
  const away = quatMultiply(quatFromAxisAngle([0, 1, 0], 90 * DEG), look);
  const glance = { samples: [{ t: 0, camera }, { t: 1, camera, look: away }, { t: 2, camera }], on: 'db' };
  assert.equal(checkCameraMove(glance, { scene, frame }).bases['in-sight'].inFrame, 0);
  assert.equal(checkCameraMove({ ...glance, samples: glance.samples.map(({ t, camera: c }) => ({ t, camera: c })) }, { scene, frame }).measures['in-sight'], 0);
  // turned upside down for a moment, the two swap sides of the frame and back; on two subjects, no line need be named
  const both = frameOf({ on: ['db', 'cache'], from: 'front' }, scene), level = lookOf(readCamera(both)), flipped = quatMultiply(level, quatFromAxisAngle([0, 0, 1], Math.PI));
  const flip = { samples: [{ t: 0, camera: both }, { t: 1, camera: both, look: flipped }, { t: 2, camera: both }], on: ['db', 'cache'] };
  const { measures, bases } = checkCameraMove(flip, { scene, frame });
  assert.equal(measures['line-of-action'], 2);
  assert.deepEqual([bases['line-of-action'].a, bases['line-of-action'].b], ['db', 'cache']);
});

test('in-sight: one of two subjects hidden whole on the way is found, though the other stays in view; a clear 8 m pan passes', () => {
  const scene = { unit: 'm', things: [{ name: 'db', at: [0, 1, 0], r: 1 }, { name: 'cache', at: [4, 1, 0], r: 1 }, { name: 'wall', at: [4, 1, 3], size: [2, 2.6] }] };
  const move = planCameraMove({ do: 'fly', from: { on: ['db', 'cache'], from: 'front-left', size: 'wide' }, to: { on: ['db', 'cache'], from: 'front-right', size: 'wide' }, who: 'shots[3]' }, scene);
  const { measures, bases, findings } = checkCameraMove(move, { scene, frame });
  assert.ok(measures['in-sight'] > 0.9, `${measures['in-sight']}`);
  assert.deepEqual([bases['in-sight'].kind, bases['in-sight'].subject, bases['in-sight'].blocker], ['own', 'cache', 'wall']);
  assert.match(findings.find((f) => f.critic === 'in-sight').message, /^shots\[3\]: at \d+(\.\d)? s it shows \d+% of "cache", where both its ends show at least 100% — "wall" covers it on the way$/);
  const pan = { unit: 'm', things: [{ name: 'db', at: [0, 1, 0], r: 1 }, { name: 'cache', at: [8, 1, 0], r: 1 }] };
  const clear = checkCameraMove(planCameraMove({ do: 'fly', from: { on: 'db', from: 'front' }, to: { on: 'cache', from: 'front' } }, pan), { scene: pan, frame });
  assert.ok(clear.measures['in-sight'] <= SIGHT_DROP, `${clear.measures['in-sight']}`);
});

test('a fly that leaves the frame without turning is told to frame its ends wider; a hand path\'s two speed fixes name one number', () => {
  const pan = { unit: 'm', things: [{ name: 'db', at: [0, 1, 0], r: 1 }, { name: 'cache', at: [20, 1, 0], r: 1 }] };
  const [found] = checkCameraMove(planCameraMove({ do: 'fly', from: { on: 'db', from: 'front', size: 'close' }, to: { on: 'cache', from: 'front', size: 'close' }, seconds: 9 }, pan), { scene: pan, frame }).findings.filter((f) => f.critic === 'in-sight');
  assert.equal(found.fix, "frame its ends wider: size: 'wide' on from and to");
  const a = camAt(0), b = camAt(60, { target: [20, 1, 0] });
  const fixes = checkCameraMove({ samples: [{ t: 0, camera: a }, { t: 1, camera: b }] }).findings.filter((f) => f.critic === 'turn-speed' || f.critic === 'travel-speed').map((f) => f.fix);
  assert.equal(fixes.length, 2);
  assert.equal(fixes[0], fixes[1]);
});
