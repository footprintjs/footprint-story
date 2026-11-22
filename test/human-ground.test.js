// Rolling and sliding on the human door (0.30.0): the roll (`no-slip`) and slide (`coulomb`) models and the parts under
// them (the glide law, the slab test, rolling and friction) — closed forms (distance v² / 2a, the turn distance / radius),
// slopes that speed or slow, a stop at a box, the floor seen from above, the reason and basis as data, and refusals that
// name the entry and the fix. Geometry is compared to a tolerance: sin, cos and sqrt differ in the last digits across engines.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  planMove, sampleMove, sampleTrack, checkMove, glide, glideAt, restSpeed, touchAlong, makeWorld, rollTurn, rollingPush, slidingPush, slideDistance,
  ROLL_SHAPES, ROLLING_RESISTANCE, KINETIC_FRICTION, STATIC_FRICTION, MOST_SLOPE, GRAVITY, HUMAN_MODELS, USUAL_MODELS, HUMAN_DOS, ROLL_KEYS, SLIDE_KEYS,
  GROUND_PLANES, MIN_ROLL_RADIUS, MOST_PHYSICS_SECONDS, overshoot,
} from '../human.js';
import { unwrapAngles } from '../geometry.js';

const who = 'blocks[3] ("ball")';
const near = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b)), `${a} ≉ ${b}`);
const end = (m) => sampleMove(m, m.plan.seconds);
function plain(v) {
  assert.deepEqual(structuredClone(v), v);
  const walk = (x) => { if (x && typeof x === 'object') { assert.ok(Object.isFrozen(x), 'frozen'); Object.values(x).forEach(walk); } };
  walk(v);
}
const DEG = Math.PI / 180;
/** The slowing of a ball rolling on a level floor at the usual resistance: C g / (1 + k) = 0.05 · 1960 / 1.4 = 70 px/s². */
const BALL_SLOW = (ROLLING_RESISTANCE * GRAVITY) / (1 + ROLL_SHAPES.ball);

test('the families roll, slide and tumble: their do words, their models, the usual each', () => {
  assert.deepEqual([HUMAN_DOS.roll, HUMAN_DOS.slide, HUMAN_DOS.tumble], ['roll', 'slide', 'tumble']);
  assert.deepEqual([HUMAN_MODELS.roll, HUMAN_MODELS.slide, HUMAN_MODELS.tumble], [['no-slip'], ['coulomb'], ['free-spin']]);
  assert.deepEqual([USUAL_MODELS.roll, USUAL_MODELS.slide, USUAL_MODELS.tumble], ['no-slip', 'coulomb', 'free-spin']);
  assert.deepEqual(ROLL_SHAPES, { ball: 0.4, disc: 0.5, ring: 1 });
  assert.deepEqual([ROLLING_RESISTANCE, KINETIC_FRICTION, STATIC_FRICTION, MOST_SLOPE, MIN_ROLL_RADIUS], [0.05, 0.2, 0.25, 45, 1]);
  assert.deepEqual(GROUND_PLANES, ['side', 'floor']);
  assert.ok(ROLL_KEYS.includes('shape') && !SLIDE_KEYS.includes('shape'));
});

test('a roll on a level floor: it stops after v² / (2a), a = C g / (1 + k), and turns distance / radius', () => {
  near(BALL_SLOW, 70);
  const move = planMove({ do: 'roll', who, from: [100, 480], speed: 280, radius: 20 });
  plain(move);
  near(move.plan.seconds, 4); near(move.plan.basis.distance, 560); near(move.plan.basis.turn, 28);
  const last = end(move);
  near(last.x, 660); assert.equal(last.y, 480); near(last.angle, 28); assert.equal(last.spin, 0);
  // half way in time: v t − ½ a t² along, the spin v / r
  const mid = sampleMove(move, 2);
  near(mid.x, 100 + 280 * 2 - 0.5 * 70 * 4); near(mid.angle, (280 * 2 - 0.5 * 70 * 4) / 20); near(mid.spin, (280 - 140) / 20);
  assert.deepEqual(Object.keys(mid), ['x', 'y', 'angle', 'spin']);
  assert.match(move.reason, /^do: 'roll' → no-slip, the usual for do: 'roll' — a ball of radius 20 px rolling 560 px on a level floor from 280 px a second, to rest after 4 s, turning 4\.46 turns: distance \/ radius$/);
  const b = move.plan.basis;
  assert.deepEqual([b.plane, b.slope, b.shape, b.inertia, b.resistance, b.gravity, b.speedDefaulted, b.endedBy, b.endSpeed, b.box, b.rolledBack], ['side', 0, 'ball', 0.4, 0.05, GRAVITY, false, 'rest', 0, null, false]);
  // to the left: the turn is the other way
  const left = planMove({ do: 'roll', from: [700, 480], speed: -280, radius: 20, angle: 1 });
  near(end(left).x, 140); near(end(left).angle, 1 - 28);
  assert.deepEqual(sampleMove(left, -1), sampleMove(left, 0));
  assert.deepEqual(sampleMove(left, 0), { x: 700, y: 480, angle: 1, spin: -14 });
});

test('a roll to `to`: the law picks the speed that brings it to rest exactly there; the shapes share a push differently', () => {
  const move = planMove({ do: 'roll', who, from: [100, 480], to: [660, 480], radius: 20 });
  near(move.plan.basis.speed, 280); assert.equal(move.plan.basis.speedDefaulted, true);
  assert.deepEqual(end(move), { x: 660, y: 480, angle: 28, spin: 0 });
  assert.equal(move.plan.basis.endedBy, 'end'); assert.equal(move.plan.basis.endSpeed, 0);
  assert.match(move.reason, /from 280 px a second \(the speed that brings it to rest at to under rolling resistance 0\.05\), to rest at to after 4 s/);
  for (const [shape, k] of Object.entries(ROLL_SHAPES)) {
    const m = planMove({ do: 'roll', from: [0, 0], to: [560, 0], radius: 10, shape }), a = (ROLLING_RESISTANCE * GRAVITY) / (1 + k);
    near(m.plan.basis.speed, Math.sqrt(2 * a * 560)); near(m.plan.seconds, Math.sqrt(2 * 560 / a)); assert.equal(m.plan.basis.inertia, k);
  }
  // a stronger resistance and gravity are the model's options
  const sticky = planMove({ do: 'roll', from: [0, 0], speed: 100, radius: 10, model: { name: 'no-slip', resistance: 0.2, gravity: 1000 } });
  near(sticky.plan.basis.distance, (100 * 100) / (2 * ((0.2 * 1000) / 1.4)));
});

test('a slope: down it from rest at (g sin θ − C g cos θ) / (1 + k); up it slower, stopping sooner', () => {
  const s = Math.sin(10 * DEG), c = Math.cos(10 * DEG), D = 400, to = [D * c, D * s];
  const down = planMove({ do: 'roll', who, from: [0, 0], to, radius: 10, slope: 10 });
  const a = (GRAVITY * (s - ROLLING_RESISTANCE * c)) / 1.4;
  near(down.plan.basis.speed, 0); near(down.plan.seconds, Math.sqrt(2 * D / a), 1e-9); near(down.plan.basis.endSpeed, Math.sqrt(2 * a * D), 1e-9);
  assert.deepEqual([end(down).x, end(down).y], to);
  near(end(down).angle, D / 10, 1e-9);
  assert.match(down.reason, /on a floor sloping 10° down the way it starts from rest \(the slope starts it\), reaching to after [\d.]+ s, still at \d+ px a second/);
  // a point half way along lies on the slope's line
  const mid = sampleMove(down, down.plan.seconds / 2);
  near(mid.y, mid.x * Math.tan(10 * DEG), 1e-9);
  // up the same slope to the same distance: the speed to come to rest there, more than on the level
  const up = planMove({ do: 'roll', from: to, to: [0, 0], radius: 10, slope: 10 });
  const aUp = (GRAVITY * (s + ROLLING_RESISTANCE * c)) / 1.4;
  near(up.plan.basis.speed, Math.sqrt(2 * aUp * D), 1e-9); assert.deepEqual([end(up).x, end(up).y], [0, 0]);
  assert.match(up.reason, /sloping 10° up the way it starts/);
  // a slope gentler than its resistance holds it still; steeper, it starts by itself
  assert.throws(() => planMove({ do: 'roll', from: [0, 0], radius: 10, slope: 2 }), /nothing moves it — give speed, to \(where it comes to rest\), or a slope/);
  const starts = planMove({ do: 'roll', from: [0, 0], radius: 10, slope: -4, boxes: [{ x: -300, y: -100, w: 10, h: 200 }] });
  assert.equal(starts.plan.basis.endedBy, 'box'); assert.ok(end(starts).x < 0, 'it rolls down to the left');
});

test('a climb that stops and rolls back, until a box behind it stops it dead', () => {
  // up a 10° slope to the left (the floor falls to the right), from 400 px a second; a wall to its right
  const move = planMove({ do: 'roll', who, from: [0, 0], speed: -400, radius: 10, slope: 10, boxes: [{ x: 300, y: -100, w: 20, h: 200 }] });
  const b = move.plan.basis;
  assert.equal(b.endedBy, 'box'); assert.equal(b.box, 0); assert.equal(b.rolledBack, true);
  assert.equal(move.plan.glide.segments.length, 2);
  near(end(move).x + 10, 300, 1e-9);   // its side touches the wall's
  assert.ok(b.hitSpeed > 0 && b.distance > end(move).x);
  assert.match(move.reason, /from 400 px a second, climbs, stops and rolls back, until its boxes\[0\] stops it dead after [\d.]+ s \(it hit at \d+ px a second\)/);
  // the angle turns one way up the slope, then back: never a jump between samples
  const angles = sampleTrack(move).samples.map((x) => x.angle);
  for (let i = 1; i < angles.length; i += 1) assert.ok(Math.abs(angles[i] - angles[i - 1]) < 1);
  assert.ok(Math.min(...angles) < angles[0] && Math.min(...angles) < angles.at(-1));
});

test('a box in the way stops it dead at the box\'s side; the slab test finds the first touch exactly', () => {
  const move = planMove({ do: 'roll', who, from: [0, 490], speed: 500, radius: 10, boxes: [{ x: 300, y: 400, w: 40, h: 100 }] });
  near(end(move).x, 290); assert.equal(move.plan.basis.box, 0);
  near(move.plan.basis.hitSpeed, Math.sqrt(500 * 500 - 2 * BALL_SLOW * 290), 1e-9);
  assert.match(move.reason, /until its boxes\[0\] stops it dead after/);
  assert.deepEqual(checkMove(move).findings, []);
  const world = makeWorld({ boxes: [{ x: 10, y: -5, w: 10, h: 10 }, { x: 40, y: -5, w: 10, h: 10 }] });
  assert.deepEqual(touchAlong([0, 0], [1, 0], world, 2), { distance: 8, box: 0, inside: null });
  assert.deepEqual(touchAlong([30, 0], [1, 0], world, 0), { distance: 10, box: 1, inside: null });
  assert.deepEqual(touchAlong([0, 0], [-1, 0], world, 2), { distance: Infinity, box: null, inside: null });
  assert.deepEqual(touchAlong([15, 0], [1, 0], world), { distance: 0, box: null, inside: 0 });
  assert.equal(touchAlong([0, 5], [1, 0], world).box, null, 'running along a side is not touching');
  assert.equal(touchAlong([0, 7], [1, 0], world).box, null, 'passing above misses');
  near(touchAlong([0, 0], [Math.SQRT1_2, Math.SQRT1_2], makeWorld({ boxes: [{ x: 10, y: 10, w: 5, h: 5 }] })).distance, 10 * Math.SQRT2);
  assert.equal(touchAlong([0, 0], [1, 0], makeWorld({ boxes: [{ x: 10, y: 0, w: 5, h: 5 }] })).box, null, 'grazing a corner is not touching');
  assert.equal(touchAlong([0, 0], [Math.SQRT1_2, Math.SQRT1_2], makeWorld({ boxes: [{ x: 10, y: 0, w: 10, h: 10 }] })).box, null, 'a diagonal through a corner only grazes it');
  assert.equal(touchAlong([0, 0], [1, 0], makeWorld({ boxes: [{ x: -20, y: -5, w: 5, h: 10 }] })).box, null, 'a box behind is never met');
  // starting inside a box, or against one moving into it, is refused
  assert.throws(() => planMove({ do: 'roll', who, from: [310, 490], speed: 5, radius: 10, boxes: [{ x: 300, y: 400, w: 40, h: 100 }] }), /blocks\[3\] \("ball"\) starts inside its boxes\[0\] — move from out of it/);
  assert.throws(() => planMove({ do: 'roll', from: [290, 490], speed: 5, radius: 10, boxes: [{ x: 300, y: 400, w: 40, h: 100 }] }), /starts against a box and moves into it/);
  assert.throws(() => planMove({ do: 'roll', from: [0, 490], to: [400, 490], radius: 10, boxes: [{ x: 300, y: 400, w: 40, h: 100 }] }), /its boxes\[0\] stands between from and to — it would stop there, 290 px along: move to before it, or the box/);
  assert.throws(() => planMove({ do: 'roll', from: [0, 490], speed: 5, radius: 10, boxes: [{ x: 300, y: 400, w: 40, h: 120 }] }), /reaches below the floor/);
});

test('a floor seen from above: toward `to` or along a heading, level, the turn about the line across its heading', () => {
  const move = planMove({ do: 'roll', who, plane: 'floor', from: [0, 0], to: [300, 400], radius: 10 });
  const at = sampleMove(move, 1);
  near(at.heading, Math.atan2(4, 3)); near(at.y / at.x, 4 / 3); near(at.angle, Math.hypot(at.x, at.y) / 10);
  assert.deepEqual([end(move).x, end(move).y], [300, 400]); near(end(move).angle, 50);
  near(move.plan.basis.speed, Math.sqrt(2 * BALL_SLOW * 500));
  assert.match(move.reason, /rolling 500 px on the floor \(seen from above\)/);
  const headed = planMove({ do: 'roll', plane: 'floor', from: [0, 0], speed: 280, heading: 90, radius: 20 });
  near(end(headed).y, 560); near(end(headed).x, 0, 1e-9); near(end(headed).heading, Math.PI / 2);
  assert.deepEqual(checkMove(headed).findings, []);
  assert.throws(() => planMove({ do: 'roll', who, plane: 'floor', from: [0, 0], to: [1, 1], slope: 3, radius: 10 }), /a floor seen from above is level — a slope is drawn side on \(plane: 'side'\): drop slope/);
  assert.throws(() => planMove({ do: 'roll', plane: 'floor', from: [0, 0], to: [1, 1], heading: 3, radius: 10 }), /toward to or along heading, not both/);
  assert.throws(() => planMove({ do: 'roll', plane: 'floor', from: [0, 0], speed: 10, radius: 10 }), /give to, or speed and heading/);
  assert.throws(() => planMove({ do: 'roll', plane: 'floor', from: [5, 5], to: [5, 5], radius: 10 }), /to is where it starts/);
  assert.throws(() => planMove({ do: 'roll', from: [0, 0], speed: 10, heading: 3, radius: 10 }), /heading is for a floor seen from above/);
  assert.throws(() => planMove({ do: 'roll', from: [0, 0], speed: 10, radius: 10, plane: 'top' }), /plane is 'side', 'floor' — not "top"/);
});

test('a slide: kinetic friction stops it after v² / (2 μ g); static friction holds it on a gentle slope; its angle is kept', () => {
  const move = planMove({ do: 'slide', who, from: [0, 300], speed: 560, angle: 0.3 });
  plain(move);
  near(move.plan.basis.distance, slideDistance(560, 0.2, GRAVITY)); near(move.plan.basis.distance, 400);
  near(move.plan.seconds, 560 / (0.2 * GRAVITY));
  assert.deepEqual(sampleMove(move, 0.5).angle, 0.3); assert.equal(sampleMove(move, 0.5).spin, 0);
  assert.match(move.reason, /^do: 'slide' → coulomb, the usual for do: 'slide' — a slide of 400 px on a level floor from 560 px a second, to rest after 1\.43 s, slowed by kinetic friction 0\.2 \(static 0\.25\)$/);
  assert.deepEqual(checkMove(move).findings, []);
  // to: the speed that rests it there
  const to = planMove({ do: 'slide', from: [0, 300], to: [400, 300] });
  near(to.plan.basis.speed, 560); assert.deepEqual([end(to).x, end(to).y], [400, 300]);
  // on a slope steeper than its static friction it starts by itself; between kinetic and static it needs a push
  const steep = planMove({ do: 'slide', from: [0, 0], slope: 30, to: [300, 300 * Math.tan(30 * DEG)] });
  near(steep.plan.basis.endSpeed, Math.sqrt(2 * GRAVITY * (Math.sin(30 * DEG) - 0.2 * Math.cos(30 * DEG)) * 300 / Math.cos(30 * DEG)), 1e-9);
  assert.throws(() => planMove({ do: 'slide', from: [0, 0], slope: 12 }), /nothing moves it/);
  assert.throws(() => planMove({ do: 'slide', who, from: [0, 0], slope: 12, to: [100, 100 * Math.tan(12 * DEG)], model: { name: 'coulomb', kinetic: 0.1, static: 0.3 } }), /on this slope it neither slows down nor starts by itself — give it a push: speed/);
  // up a slope steeper than static friction holds: it slides back
  const back = planMove({ do: 'slide', from: [0, 0], slope: 30, speed: -300, boxes: [{ x: 200, y: 0, w: 10, h: 300 }] });
  assert.equal(back.plan.basis.slidBack, true); assert.equal(back.plan.basis.endedBy, 'box');
  assert.match(back.reason, /climbs, stops and slides back/);
  // the options, and static never under kinetic
  near(planMove({ do: 'slide', from: [0, 0], speed: 100, model: { name: 'coulomb', kinetic: 0.5 } }).plan.basis.static, 0.5);
  assert.throws(() => planMove({ do: 'slide', from: [0, 0], speed: 100, model: { name: 'coulomb', kinetic: 0.5, static: 0.3 } }), /static friction \(0\.3\) is under its kinetic \(0\.5\) — .*static ≥ kinetic/);
  assert.throws(() => planMove({ do: 'slide', from: [0, 0], speed: 100, model: { name: 'coulomb', kinetic: 3 } }), /kinetic is a number from 0 to 2/);
  assert.throws(() => planMove({ do: 'slide', from: [0, 0], speed: 100, shape: 'ball' }), /takes do, name, who, model, from, to, speed, heading, slope, plane, radius, angle, boxes — not "shape"/);
});

test('refusals name the entry and the fix in its own keys', () => {
  const r = (intent, re) => assert.throws(() => planMove({ do: 'roll', who, from: [0, 490], radius: 10, ...intent }), re);
  r({ radius: 0.5 }, /blocks\[3\] \("ball"\)'s radius is a number from 1/);
  r({ shape: 'cube' }, /shape is 'ball', 'disc', 'ring' — not "cube"/);
  r({ slope: 50, speed: 1 }, /slope is a number from -45 to 45/);
  r({ to: [300, 495] }, /to is 5 px off its floor: side on it moves along the line through from — put to's y at 490/);
  r({ to: [0, 490] }, /to is where it starts/);
  r({ to: [300, 490], speed: 50 }, /from 50 px a second it stops 17\.9 px along, short of to \(300 px away\) — drop speed \(the law picks it\), or speed: 205/);
  r({ to: [300, 490], speed: -50 }, /speed -50 sends it left, and to is to its right — drop speed, or flip its sign/);
  r({ speed: 50000 }, /would still be moving after 30 s — give to \(where it comes to rest\), put a box in its way, or more resistance \(model: \{name: 'no-slip', resistance: 0\.11\}\)/);
  r({ speed: 1e6 }, /speed is a number from -100000 to 100000/);
  r({ floor: 500, speed: 1 }, /takes do, name, who, model, from, to, speed, heading, slope, plane, radius, shape, angle, boxes — not "floor"/);
  r({ speed: 1, model: { name: 'no-slip', resistance: 2 } }, /resistance is a number from 0 to 1/);
  assert.throws(() => planMove({ do: 'roll', from: [0, 0], speed: 10 }), /radius is a number from 1/);
  // downhill with speed given and to: it reaches to still moving; down a slope with no stop in 30 s, refused
  const fast = planMove({ do: 'roll', from: [0, 0], speed: 200, to: [100, 0], radius: 10 });
  assert.match(fast.reason, /reaching to after [\d.]+ s, still at \d+ px a second/);
  assert.throws(() => planMove({ do: 'slide', from: [0, 0], slope: 30, speed: 10 }), /more friction \(model: \{name: 'coulomb', kinetic: 0\.41\}\)/);
});

test('the glide law in closed form: v² = v₀² + 2a·d, a stop at its exact distance, and the time it never ends', () => {
  const push = rollingPush({ along: 0, normal: GRAVITY, resistance: 0.05, inertia: 0.4 });
  near(push.resist, 70); assert.equal(push.hold, push.resist); assert.equal(push.along, 0);
  assert.deepEqual(slidingPush({ along: 3, normal: 10, kinetic: 0.2, still: 0.3 }), { along: 3, resist: 2, hold: 3 });
  near(restSpeed(560, 70), 280); near(rollTurn(31.4, 10), 3.14);
  const g = glide({ speed: 280, ...push, most: 30 });
  assert.equal(g.endedBy, 'rest'); near(g.q, 560); near(g.seconds, 4); assert.equal(g.v, 0);
  assert.deepEqual(glideAt(g, 99), { q: g.q, v: 0 }); assert.deepEqual(glideAt(g, -1), { q: 0, v: 280 });
  near(glideAt(g, 1).v, 210);
  const ended = glide({ speed: 280, ...push, end: 100, most: 30 });
  assert.equal(ended.endedBy, 'end'); assert.equal(ended.q, 100); near(ended.v ** 2, 280 ** 2 - 2 * 70 * 100);
  const boxed = glide({ speed: 280, ...push, ahead: 50, most: 30 });
  assert.deepEqual([boxed.endedBy, boxed.q, boxed.v], ['box', 50, 0]); near(boxed.hitSpeed ** 2, 280 ** 2 - 2 * 70 * 50);
  const timed = glide({ speed: 0, along: 100, resist: 10, hold: 10, most: 2 });
  assert.equal(timed.endedBy, 'time'); near(timed.q, 0.5 * 90 * 4); near(timed.travelled, 180);
  const still = glide({ speed: 0, along: 5, resist: 10, hold: 10, most: 2 });
  assert.deepEqual([still.endedBy, still.seconds, still.segments.length], ['rest', 0, 0]);
  assert.deepEqual(glideAt(still, 1), { q: 0, v: 0 });
  assert.equal(glide({ speed: 0, along: 10, resist: 5, hold: 10, most: 2 }).endedBy, 'rest', 'a push of exactly its hold leaves it at rest');
  // forward, stopped, back: three pieces at most, the travelled distance both ways
  const back = glide({ speed: 10, along: -20, resist: 5, hold: 5, behind: 100, most: 30 });
  assert.equal(back.endedBy, 'box'); assert.equal(back.q, -100); near(back.travelled, 2 * (100 / 50) + 100);
});

test('a roll is the same for the same intent, plain data, and every model\'s own critics pass it', () => {
  const intent = { do: 'roll', who, from: [0, 490], to: [600, 490], radius: 15, shape: 'disc' };
  assert.deepEqual(planMove(intent), planMove({ ...intent }));
  const m = planMove(intent);
  assert.deepEqual(m.checks, ['roll-slip', 'spin', 'contact']);
  const c = checkMove(m);
  assert.deepEqual(c.findings, []);
  near(c.bases['roll-slip'].rate, 1, 1e-9); assert.ok(c.measures['roll-slip'] < 1e-9 && c.measures.spin < 1e-6 && c.measures.contact === 0);
  // the angle is unwrapped and continuous: unwrapping it changes nothing
  const angles = sampleTrack(m).samples.map((s) => s.angle);
  unwrapAngles(angles).forEach((a, i) => near(a, angles[i]));
  near(m.plan.turnVector[0], 1 / 15); assert.equal(m.plan.turnVector[1], 0);
  assert.ok(MOST_PHYSICS_SECONDS >= m.plan.seconds);
});
