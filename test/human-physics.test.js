// Light physics on the human door (0.27.0): the throw, fall, hang and settle models through planMove and sampleMove —
// what each gives, its reason and basis as data, and what it refuses, naming the entry and the fix.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  planMove, sampleMove, sampleTrack, HUMAN_MODELS, USUAL_MODELS, HUMAN_CRITICS, GRAVITY, MIN_APEX, MOST_CHAIN_SECONDS, SQUASH_SECONDS,
} from '../human.js';
import { settleTime } from '../src/motion/spring.js';

const who = 'blocks[2] ("ball")';
/** Frozen all the way down, and survives a structured copy unchanged: plain data a record keeps. */
function plain(v) {
  assert.deepEqual(structuredClone(v), v);
  const walk = (x) => { if (x && typeof x === 'object') { assert.ok(Object.isFrozen(x), 'frozen'); Object.values(x).forEach(walk); } else assert.notEqual(typeof x, 'function'); };
  walk(v);
}
const at = (move, t) => sampleMove(move, t);
const end = (move) => sampleMove(move, move.plan.seconds);

test('the physics models are the door\'s: one name for a throw and a fall alike, the usual for each family, their checks critics there are', () => {
  assert.deepEqual(HUMAN_MODELS.throw, ['ballistic', 'bounce']);
  assert.deepEqual(HUMAN_MODELS.fall, ['ballistic', 'bounce']);
  assert.deepEqual(HUMAN_MODELS.hang, ['verlet']);
  assert.deepEqual(HUMAN_MODELS.settle, ['spring']);
  assert.deepEqual([USUAL_MODELS.throw, USUAL_MODELS.fall, USUAL_MODELS.hang, USUAL_MODELS.settle], ['ballistic', 'ballistic', 'verlet', 'spring']);
  for (const c of ['spacing', 'volume', 'contact']) assert.ok(HUMAN_CRITICS.includes(c));
  // a model of one family is refused for another, naming the ones there are
  assert.throws(() => planMove({ do: 'hang', from: [0, 0], length: 40, model: 'ballistic' }), /the model "ballistic" is for a throw or a fall, and this intent is do: 'hang' \(a hang\) — name a hang model: "verlet"/);
});

test('a throw: the usual apex a 45° launch, both ends exact, its reason and basis as data', () => {
  const move = planMove({ do: 'throw', who, from: [100, 600], to: [700, 600] });
  plain(move);
  assert.equal(move.model, 'ballistic'); assert.deepEqual(move.choice, { by: 'usual' });
  assert.equal(move.reason, "do: 'throw' → ballistic, the usual for do: 'throw' — a throw over 0.78 s, up 150 px above its higher end (the usual: a quarter of the 600 px across), launched at 45° under 1960 px/s²");
  const b = move.plan.basis;
  assert.deepEqual([b.across, b.apexDefaulted, b.gravity, b.secondsGiven], [600, true, GRAVITY, false]);
  assert.ok(Math.abs(b.apex - 150) < 1e-9 && Math.abs(b.angle - 45) < 1e-9 && b.seconds === move.plan.seconds);
  assert.deepEqual(at(move, 0), { x: 100, y: 600, angle: -Math.PI / 4 });
  const last = end(move);
  assert.equal(last.x, 700); assert.equal(last.y, 600);
  assert.deepEqual(at(move, -5), at(move, 0)); assert.deepEqual(at(move, 99), last);
  const top = at(move, move.plan.seconds / 2);
  assert.ok(Math.abs(top.y - 450) < 1e-9 && Math.abs(top.angle) < 1e-12);
  const short = planMove({ do: 'throw', from: [0, 0], to: [10, 0] });
  assert.ok(Math.abs(at(short, short.plan.seconds / 2).y + MIN_APEX) < 1e-9);
  assert.match(short.reason, /at least 24 px/);
  const timed = planMove({ do: 'throw', from: [0, 500], to: [300, 200], seconds: 0.8, model: { name: 'ballistic', gravity: 1000 } });
  assert.equal(timed.plan.seconds, 0.8);
  assert.deepEqual(timed.plan.velocity, [375, (200 - 500 - 0.5 * 1000 * 0.64) / 0.8]);
  assert.match(timed.reason, /the seconds the intent gave/);
  assert.match(planMove({ do: 'throw', from: [0, 0], to: [100, 0], apex: 30 }).reason, /up 30 px .*the apex the intent gave/);
});

test('a fall: to the floor from rest or a start velocity; a body of radius lands its centre that far above', () => {
  const move = planMove({ do: 'fall', name: 'box', from: [50, 100], floor: 590, radius: 10 });
  assert.equal(move.plan.seconds, Math.sqrt(2 * 480 / GRAVITY));
  assert.deepEqual(end(move), { x: 50, y: 580, angle: Math.PI / 2 });
  assert.deepEqual(move.plan.basis, { drop: 480, startSpeed: 0, gravity: GRAVITY, seconds: move.plan.seconds });
  assert.match(move.reason, /a fall of 480 px onto the floor at y 590 from rest/);
  const up = planMove({ do: 'fall', from: [0, 500], floor: 500, velocity: [100, -490] });
  assert.ok(Math.abs(up.plan.seconds - 2 * 490 / GRAVITY) < 1e-12);
  assert.deepEqual(up.plan.to, [100 * up.plan.seconds, 500]);
  assert.match(up.reason, /from 500 px a second/);
});

test('a bounce: lower each time, at rest on the floor exactly; a squash keeps the area and springs back by the end', () => {
  const move = planMove({ do: 'fall', who, from: [0, 100], floor: 900, model: { name: 'bounce', restitution: 0.6, squash: 0.3 } });
  plain(move);
  const p = move.plan;
  assert.ok(p.segments.length > 3);
  assert.deepEqual(p.rest, [0, 900]);
  assert.equal(p.seconds, p.landed + SQUASH_SECONDS);
  assert.deepEqual(end(move), { x: 0, y: 900, sx: 1, sy: 1 });
  const hit = at(move, p.impacts[0].at);
  assert.ok(Math.abs(hit.sy - 0.7) < 1e-12 && Math.abs(hit.sx * hit.sy - 1) < 1e-12);
  assert.deepEqual(p.basis, { restitution: 0.6, keep: 1, squash: 0.3, bounces: p.segments.length - 1, landed: p.landed, gravity: GRAVITY, seconds: p.seconds, firstSeconds: p.segments[0].seconds });
  assert.match(move.reason, /then 6 bounces \(each giving back 60% of its speed\), at rest on the floor at y 900 after 3\.49 s, squashed 30%/);
  assert.deepEqual(Object.keys(at(planMove({ do: 'fall', from: [0, 100], floor: 900, model: 'bounce' }), 0.2)), ['x', 'y']);
  assert.equal(planMove({ do: 'fall', from: [0, 100], floor: 900, model: { name: 'bounce', restitution: 0 } }).plan.segments.length, 1);
  assert.match(planMove({ do: 'fall', from: [0, 899], floor: 900, model: { name: 'bounce', restitution: 0 } }).reason, /then 0 bounces/);
  // a thrown bounce lands on `to`, then bounces along the floor at `to`'s y; keep slows it across
  const thrown = planMove({ do: 'throw', from: [0, 300], to: [200, 500], radius: 5, model: { name: 'bounce', keep: 0.5 } });
  const s = thrown.plan.segments;
  assert.deepEqual(s[1].from, [200, 500]);
  assert.equal(s[1].velocity[0], s[0].velocity[0] * 0.5);
  assert.equal(thrown.plan.world.floor, 505);
  assert.equal(planMove({ do: 'throw', from: [0, 300], to: [200, 500], floor: 500, model: 'bounce' }).plan.world.floor, 500);
});

test('a hang: pinned at from, swings and settles below its pin; a moving pin trails it; its wobble is seeded from the entry', () => {
  const move = planMove({ do: 'hang', who: 'the lamp', from: [400, 100], to: [600, 100], model: { name: 'verlet', links: 10 } });
  plain(move);
  const last = end(move);
  assert.ok(Math.abs(last.x - 400) < 2 && Math.abs(last.y - 300) < 1, `settled below the pin: ${last.x}, ${last.y}`);
  assert.equal(last.points.length, 11);
  assert.deepEqual(last.points[0], [400, 100]);
  assert.ok(Math.abs(at(move, 0).x - 600) < 1e-9);
  assert.equal(move.plan.basis.settled, true);
  assert.match(move.reason, /a chain of 10 links, 200 px, pinned at its top: swings for [0-9.]+ s, until still for half a swing \(1 s\)/);
  const timed = planMove({ do: 'hang', from: [0, 0], length: 100, model: { name: 'verlet', links: 4 }, seconds: 0.5 });
  assert.ok(timed.plan.seconds >= 0.5 && timed.plan.seconds < 0.5 + 1 / 60);
  assert.match(timed.reason, /the seconds the intent gave/);
  const long = planMove({ do: 'hang', from: [0, 0], to: [1000, 0], model: { name: 'verlet', links: 20, damping: 0 } });
  assert.equal(long.plan.seconds, MOST_CHAIN_SECONDS); assert.equal(long.plan.basis.settled, false);
  assert.match(long.reason, /still swinging at 10 s, the most a chain runs/);
  const trail = planMove({ do: 'hang', from: [0, 0], length: 120, path: [[0.5, 300, 0]], seconds: 1, model: { name: 'verlet', links: 6 } });
  assert.deepEqual(at(trail, 0.5).points[0], [300, 0]);
  assert.ok(at(trail, 0.5).x < 300, 'the free end lags behind the pin');
  assert.match(trail.reason, /moved along 1 key/);
  // jitter: seeded from the entry (planMove's random), so the same entry wobbles the same; another piece another way
  const rope = (name, jitter = 5) => planMove({ do: 'hang', name, from: [0, 0], length: 80, seconds: 0.2, model: { name: 'verlet', links: 4, jitter } });
  assert.deepEqual(rope('a'), rope('a'));
  assert.notDeepEqual(rope('a').plan.frames[0], rope('b').plan.frames[0]);
  const straight = rope('a', 0).plan.frames[0], jittered = rope('a').plan.frames[0];
  for (let i = 2; i < 10; i += 1) assert.notEqual(jittered[i], straight[i], `coordinate ${i}: both axes`);
  // the last moment is the last kept frame exactly, whatever the step count (124 steps: 124/240 ÷ 1/60 is not 31 in floats)
  const odd = planMove({ do: 'hang', from: [0, 0], to: [100, 0], seconds: 124 / 240, model: { name: 'verlet', links: 4 } });
  assert.deepEqual(end(odd).points.flat(), [...odd.plan.frames.at(-1)]);
});

test('a chain longer than the drop lies on the floor and on a box, never through them, after every step', () => {
  for (const intent of [
    { do: 'hang', from: [0, 0], length: 400, floor: 300, seconds: 2, model: { name: 'verlet', links: 40 } },
    { do: 'hang', from: [0, 0], to: [300, 0], floor: 400, boxes: [{ x: -60, y: 200, w: 120, h: 200 }], seconds: 3, model: { name: 'verlet', links: 30 } },
  ]) {
    const { plan } = planMove(intent);
    for (const f of plan.frames) for (let i = 2; i < f.length; i += 2) {
      assert.ok(f[i + 1] <= intent.floor, `below the floor: ${f[i + 1]}`);
      for (const b of intent.boxes ?? []) assert.ok(!(f[i] > b.x && f[i] < b.x + b.w && f[i + 1] > b.y && f[i + 1] < b.y + b.h), 'inside the box');
    }
  }
});

test('a settle: on the motion spring, its seconds the feel\'s, exact at both ends', () => {
  const move = planMove({ do: 'settle', who: 'the card', from: [0, 0], to: [100, 50] });
  assert.equal(move.model, 'spring');
  assert.equal(move.plan.seconds, settleTime('default'));
  assert.deepEqual(at(move, 0), { x: 0, y: 0, progress: 0 });
  assert.deepEqual(end(move), { x: 100, y: 50, progress: 1 });
  assert.match(move.reason, /settles 111\.8 px on the "default" spring \(k 170, d 26: damping ratio 1\) in [0-9.]+ s, its feel's settle time/);
  const pop = planMove({ do: 'settle', from: [0, 0], to: [100, 0], model: { name: 'spring', feel: 'playful' } });
  assert.ok(sampleTrack(pop).samples.some((s) => s.x > 100), 'a playful spring passes its end on the way');
  assert.match(pop.reason, /passing its end by 18\.6%/);
  const own = planMove({ do: 'settle', from: [0, 0], to: [10, 0], model: { name: 'spring', k: 400, d: 40 } });
  assert.deepEqual([own.plan.basis.k, own.plan.basis.d, own.plan.basis.damping, own.plan.basis.overshoot], [400, 40, 1, 0]);
  assert.equal(own.plan.seconds, settleTime({ k: 400, d: 40 }));
  assert.match(own.reason, /on its own spring/);
});

test('refusals name the entry and the fix', () => {
  const cases = [
    [{ do: 'throw', who, from: [0, 0], to: [1, 1], apex: 10, seconds: 1 }, /blocks\[2\] \("ball"\)'s throw takes apex .* not both — drop one/],
    [{ do: 'throw', who, from: [0, 0], to: [1, 1], apx: 10 }, /blocks\[2\].*takes do, name, who, model, from, to, apex.* — not "apx"/],
    [{ do: 'throw', who, from: [0, 0], to: [10, 0], apex: 0 }, /no time in the air .* give an apex above 0, or seconds/],
    [{ do: 'throw', who, from: [0], to: [1, 1] }, /blocks\[2\] \("ball"\)'s from is a point \[x, y\]/],
    [{ do: 'throw', who, from: [0, 0], to: [9e5, 0], model: { name: 'ballistic', gravity: 1 } }, /at most 30 s: a lower apex, or seconds/],
    [{ do: 'throw', who, from: [0, 0], to: [1, 1], seconds: 40 }, /seconds is at most 30 for a throw/],
    [{ do: 'throw', who, from: [0, 0], to: [1, 1], model: { name: 'ballistic', gravity: 0 } }, /model "ballistic"'s gravity is a number from 1/],
    [{ do: 'fall', who, from: [0, 0] }, /fall needs the floor it lands on: floor: <y in px>/],
    [{ do: 'fall', who, from: [0, 600], floor: 500 }, /not above the floor .* move from above the floor/],
    [{ do: 'fall', who, from: [0, 0], floor: 9e5, model: { name: 'ballistic', gravity: 1 } }, /a nearer floor/],
    [{ do: 'fall', who, from: [0, 0], floor: 500, model: { name: 'bounce', restitution: 1.2 } }, /restitution .* above 1 the energy would grow/],
    [{ do: 'fall', who, from: [0, 0], floor: 500, model: { name: 'bounce', squash: 0.9 } }, /model "bounce"'s squash is a number from 0 to 0.5/],
    [{ do: 'throw', who, from: [0, 600], to: [100, 500], model: 'bounce' }, /below the floor it lands on .* start it above the floor/],
    [{ do: 'throw', who, from: [0, 0], to: [100, 500], floor: 600, model: 'bounce' }, /drop floor, or set to's y to 600/],
    [{ do: 'hang', who, from: [0, 0] }, /a hang needs its length \(px\) or to/],
    [{ do: 'hang', who, from: [0, 0], to: [0, 0] }, /no length — to is the pin itself/],
    [{ do: 'hang', who, from: [0, 0], length: 20, model: { name: 'verlet', links: 10 } }, /a link is at least 4 px: model: \{name: 'verlet', links: 5\}/],
    [{ do: 'hang', who, from: [0, 0], length: 20, model: { name: 'verlet', links: 1.5 } }, /links is a whole number/],
    [{ do: 'hang', who, from: [0, 0], length: 40, seconds: 11 }, /seconds is at most 10 for a hang/],
    [{ do: 'hang', who, from: [0, 0], length: 8, path: [[0, 1, 1]], model: { name: 'verlet', links: 2 } }, /path\[0\]'s t is a number above 0/],
    [{ do: 'hang', who, from: [0, 0], length: 8, path: [[1, 1]], model: { name: 'verlet', links: 2 } }, /path\[0\] is a key \[t, x, y\]/],
    [{ do: 'hang', who, from: [0, 0], length: 8, path: [[1, 1, 1], [0.5, 2, 2]], model: { name: 'verlet', links: 2 } }, /path\[1\]'s t is a number above 1/],
    [{ do: 'hang', who, from: [0, 0], length: 8, path: 3, model: { name: 'verlet', links: 2 } }, /path is a list of at most 64 keys/],
    [{ do: 'hang', who, from: [50, 50], length: 8, boxes: [{ x: 0, y: 0, w: 100, h: 100 }], model: { name: 'verlet', links: 2 } }, /pin \(from\) is inside a box/],
    [{ do: 'hang', who, from: [0, 600], length: 8, floor: 500, model: { name: 'verlet', links: 2 } }, /pin \(from\) is below the floor/],
    [{ do: 'fall', who, from: [0, 0], floor: 500, boxes: [{ x: 0, y: 450, w: 10, h: 100 }] }, /boxes\[0\] reaches below the floor .* stand it on the floor: y 400/],
    [{ do: 'fall', who, from: [0, 0], floor: 500, boxes: [{ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 }] }, /boxes\[0\] and boxes\[1\] overlap — .* make them one box/],
    [{ do: 'fall', who, from: [0, 0], floor: 500, boxes: [{ x: 0, y: 0, w: 0, h: 10 }] }, /boxes\[0\]'s w is a number above 0/],
    [{ do: 'fall', who, from: [0, 0], floor: 500, boxes: [{ x: 0, y: 0, w: 1, h: 1, z: 1 }] }, /boxes\[0\] takes x, y, w, h — not "z"/],
    [{ do: 'fall', who, from: [0, 0], floor: 500, boxes: [7] }, /boxes\[0\] is a box \{x, y, w, h\}/],
    [{ do: 'fall', who, from: [0, 0], floor: 500, boxes: 'all' }, /boxes are a list of at most 32/],
    [{ do: 'settle', who, from: [0, 0], to: [1, 1], model: { name: 'spring', feel: 'bouncy' } }, /model "spring"'s feel is one of snappy, default, heavy, playful — not "bouncy"/],
    [{ do: 'settle', who, from: [0, 0], to: [1, 1], model: { name: 'spring', feel: 'snappy', k: 1 } }, /a feel, or k and d — not both/],
    [{ do: 'settle', who, from: [0, 0], to: [1, 1], model: { name: 'spring', k: 100 } }, /k and d together/],
    [{ do: 'settle', who, from: [0, 0], to: [1, 1], seconds: 1 }, /takes do, name, who, model, from, to — not "seconds"/],
  ];
  for (const [intent, re] of cases) assert.throws(() => planMove(intent), (e) => e.message.startsWith('human: ') && re.test(e.message), String(re));
  // a getter is never run (planMove's plain copy refuses it first, naming the entry)
  assert.throws(() => planMove({ do: 'throw', who, from: [0, 0], get to() { throw new Error('ran'); } }), /blocks\[2\] \("ball"\).*getter/);
});
