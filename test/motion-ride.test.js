// How a packet rides a line (motion/ride.js): the ride's time from a speed, its eased ends within half a pixel of the
// true ease, a rest at the end, how much of it shows, and where it fades before a stretch a block hides. Moved from
// StoryDeck 0.27.0 (deck/ride.test.js) with the code; the refusals are new.
import test from 'node:test';
import assert from 'node:assert/strict';
import { hiddenRamps, rideProfile, rideSeconds, showStops, speedAt, withHold, MOST_EASE } from '../motion.js';

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} is not ${b}`);
/** Where a ride's stops (rideProfile) put the packet at `time`: straight between them, as CSS's linear() does. */
const at = (stops, time) => {
  const k = stops.findIndex(([t]) => t >= time);
  if (k <= 0) return stops[Math.max(0, k)][1];
  const [[t0, p0], [t1, p1]] = [stops[k - 1], stops[k]];
  return t1 === t0 ? p1 : p0 + ((p1 - p0) * (time - t0)) / (t1 - t0);
};

test('times a ride from a speed in px a second: 300 px at 300 px/s is 1 s; eased ends take longer at the same steady speed', () => {
  assert.equal(rideSeconds(300, 300), 1);
  assert.equal(rideSeconds(452, 226), 2);
  // gathered and shed evenly, an eased stretch takes twice the time the steady speed would: (1 + a + b) times the line
  close(rideSeconds(1000, 260, [0.15, 0.2]), (1000 * 1.35) / 260);
});

test('a steady ride is two stops; eased, it starts and ends at rest and keeps one steady speed between the eased ends', () => {
  assert.deepEqual(rideProfile(), [[0, 0], [1, 1]]);
  assert.deepEqual(rideProfile([0, 0], 900), [[0, 0], [1, 1]]);
  const length = 1000, ease = [0.15, 0.2], stops = rideProfile(ease, length), T = rideSeconds(length, 260, ease);
  assert.deepEqual(stops[0], [0, 0]);
  assert.deepEqual(stops.at(-1), [1, 1]);
  // time and progress never go back
  stops.slice(1).forEach(([t, p], k) => assert.ok(t >= stops[k][0] && p >= stops[k][1]));
  // the steady stretch, from 15% of the length to 80%: one straight line at the steady speed, 260 px/s
  const from = stops.findIndex(([, p]) => Math.abs(p - 0.15) < 1e-12), to = stops.findIndex(([, p]) => Math.abs(p - 0.8) < 1e-12);
  assert.equal(to, from + 1);
  const [[t0, p0], [t1, p1]] = [stops[from], stops[to]];
  close(((p1 - p0) * length) / ((t1 - t0) * T), 260, 1e-6);
  // and every stretch of the ride is at or under that speed: it peaks at the steady speed, never over it
  const steps = 400, speeds = Array.from({ length: steps }, (_, k) => ((at(stops, (k + 1) / steps) - at(stops, k / steps)) * length) / (T / steps));
  assert.ok(Math.max(...speeds) <= 260 + 1e-6);
  assert.ok(speeds[0] < 30 && speeds.at(-1) < 30);   // out of rest, into rest
});

test('keeps every eased stop within 0.4 px of the true ease (a page rounds the rest of half a px), more stops on a longer line, never past 40 an end', () => {
  for (const length of [100, 1000, 5000]) {
    const ease = [0.2, 0.3], stops = rideProfile(ease, length), whole = 1 + ease[0] + ease[1];
    // the true place at a time, from rest: a·(t / ta)² in, 1 − b·((1 − t) / tb)² out
    const truth = (t) => (t < (2 * ease[0]) / whole ? ease[0] * (t / ((2 * ease[0]) / whole)) ** 2 : t > 1 - (2 * ease[1]) / whole ? 1 - ease[1] * ((1 - t) / ((2 * ease[1]) / whole)) ** 2 : null);
    for (let k = 0; k <= 2000; k++) { const want = truth(k / 2000); if (want !== null) assert.ok(Math.abs(at(stops, k / 2000) - want) * length <= 0.4 + 1e-9); }
  }
  assert.ok(rideProfile([0.5, 0.5], 1e7).length <= 1 + 40 + 40);
  assert.ok(rideProfile([0.5, 0.5], 10).some(([t, p]) => t === 0.5 && p === 0.5));   // all ease, no steady stretch: in to the middle and out
});

test('only one end eased: the other starts or ends at the steady speed', () => {
  assert.deepEqual(rideProfile([0.25, 0], 400).at(-2), [0.4, 0.25]);   // eased in over 2·0.25/1.25 of the time, then straight to the end
  assert.deepEqual(rideProfile([0, 0.25], 400)[1], [0.6, 0.75]);       // straight from the start, then eased out
  close(speedAt(0.1, [0.25, 0]), Math.sqrt(0.4), 1e-12);
  assert.equal(speedAt(0.5, [0.25, 0.25]), 1);
  close(speedAt(0.95, [0, 0.2]), 0.5, 1e-12);
});

test('a ride with a rest at the end takes its share of the run and then stays at 1', () => {
  assert.deepEqual(withHold([[0, 0], [1, 1]], 1), [[0, 0], [1, 1]]);
  assert.deepEqual(withHold([[0, 0], [0.5, 0.4], [1, 1]], 0.75), [[0, 0], [0.375, 0.4], [0.75, 1], [1, 1]]);
});

test('shows the packet in over 12% of the ride and out over its last 15%, or keeps it at the end where it rests', () => {
  assert.deepEqual(showStops(), [[0, 0], [0.12, 1], [0.85, 1], [1, 0]]);
  assert.deepEqual(showStops(0.5, { end: true }), [[0, 0], [0.06, 1], [1, 1]]);
  assert.deepEqual(showStops(1, { end: true }), [[0, 0], [0.12, 1], [1, 1]]);
});

test('fades out before a hidden stretch and back after it, over three frames at the speed it has there', () => {
  // 600 px at 300 px/s: three frames are 15 px
  const [[outFrom, outTo, backFrom, backTo]] = hiddenRamps([[300, 360]], 600, 300);
  assert.deepEqual([outFrom * 600, outTo * 600, backFrom * 600, backTo * 600].map((v) => +v.toFixed(9)), [285, 300, 360, 375]);
  // slower where it eases: 30 px into a 0.25 ease of a 600 px line it has sqrt(30 / 150) of its steady speed
  const [[eased]] = hiddenRamps([[30, 60]], 600, 300, [0.25, 0]);
  close(30 - eased * 600, 15 * Math.sqrt(30 / 150));
  // at the line's start it is hidden from the start; at its end it stays hidden; a fade is never under 2 px
  assert.deepEqual(hiddenRamps([[0, 40]], 400, 300), [[0, 0, 0.1, (40 + 15) / 400]]);
  assert.deepEqual(hiddenRamps([[380, 400]], 400, 300), [[(380 - 15) / 400, 0.95, 1, 1]]);
  close(hiddenRamps([[100, 120]], 400, 1)[0][0], 98 / 400, 1e-12);
  // a stretch past the line is cut to it; one with no length, or a line with none, is nothing (whatever the speed)
  assert.deepEqual(hiddenRamps([[350, 900]], 400, 300), [[(350 - 15) / 400, 0.875, 1, 1]]);
  assert.deepEqual(hiddenRamps([[50, 50]], 400, 300), []);
  assert.deepEqual(hiddenRamps([[0, 10]], 0, 300), []);
  assert.deepEqual(hiddenRamps([[0, 10]], 0, 0), []);
  // with the packet's radius: gone when its front reaches the stretch, back once its back has left it
  assert.deepEqual(hiddenRamps([[300, 360]], 600, 300, [0, 0], { radius: 7 }).map((r) => r.map((v) => +(v * 600).toFixed(9))), [[278, 293, 367, 382]]);
  assert.deepEqual(hiddenRamps([[5, 40]], 400, 300, [0, 0], { radius: 7 }), [[0, 0, 47 / 400, 62 / 400]]);   // too near the start to fade out: hidden from it
});

test('every number is checked, read by its own stored value, and a refusal says what to give', () => {
  const refused = (f, words) => assert.throws(f, (e) => e.message.startsWith('ride: ') && e.message.includes(words), words);
  refused(() => rideSeconds(-1, 300), "a line's length is its px");
  refused(() => rideSeconds(300, 0), 'a speed is px a second, above 0');
  refused(() => rideSeconds(300, NaN), 'not NaN');
  refused(() => rideProfile([0.6, 0], 100), `each 0 to ${MOST_EASE}`);
  refused(() => rideProfile([0.2], 100), 'an ease is [a, b]');
  refused(() => rideProfile([0.1, -0.1], 100), 'an ease is [a, b]');
  refused(() => speedAt('0.5'), 'progress is a share of the line');
  refused(() => withHold([[0, 0], [1]], 0.5), 'stop 2 is [time, progress]');
  refused(() => withHold([[0, 0]], 0), 'share is the share of the run');
  // eslint-disable-next-line no-sparse-arrays
  refused(() => withHold([[0, 0], , [1, 1]], 0.5), 'a hole at 1');
  refused(() => showStops(1, { end: 'yes' }), 'end says whether');
  refused(() => showStops(1, 'end'), 'options are an object');
  refused(() => hiddenRamps('none', 100, 1), 'unseen is the stretches');
  refused(() => hiddenRamps([[0, 'x']], 100, 1), 'stretch 1 is [from, to]');
  refused(() => hiddenRamps([], 100, -1), 'a speed is px a second, 0 to');
  refused(() => hiddenRamps([], 100, 1, [0, 0], { fps: 0 }), 'fps is frames a second');
  refused(() => hiddenRamps([], 100, 1, [0, 0], { radius: -1 }), "radius is the packet's own");
  // a getter is somebody's code: never run, read as nothing stored
  let ran = false;
  const sneaky = [0.1, 0.1];
  Object.defineProperty(sneaky, 1, { get() { ran = true; return 0.1; } });
  refused(() => rideProfile(sneaky, 100), 'an ease is [a, b]');
  assert.equal(ran, false);
  const options = {};
  Object.defineProperty(options, 'radius', { get() { ran = true; return 3; }, enumerable: true });
  assert.deepEqual(hiddenRamps([[300, 360]], 600, 300, [0, 0], options), hiddenRamps([[300, 360]], 600, 300));
  assert.equal(ran, false);
});
