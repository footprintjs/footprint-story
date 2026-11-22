// The laws of footprint-story/human, each against its closed form or a numeric oracle: minimum jerk's ends, middle
// and symmetry, Fitts's bits, the two-thirds power law recovered by regression on an ellipse, sigma-lognormal strokes
// against their own integral and derivative, and the tremor's seed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { minJerk, minJerkSpeed, minJerkAccel, MIN_JERK_PEAK, FITTS, fittsIndex, fittsSeconds, POWER_LAW, powerLawSpeed, powerLawTimes, powerLawFit,
  SIGMA_LOGNORMAL, lognormalShare, lognormalSpeed, strokeEnd, strokeOffset, strokeBetween, sigmaLognormalAt, TREMOR, tremorKnots, tremorAt, curvatures } from '../human.js';
import { erf } from '../src/human/laws/sigmaLognormal.js';
import { rampShare } from '../src/human/laws/powerLaw.js';
import { seeded } from '../src/human/seed.js';

const close = (a, b, eps, what) => assert.ok(Math.abs(a - b) <= eps, `${what}: ${a} is not within ${eps} of ${b}`);

test('minimum jerk: 0 and 1 at the ends, half way at the middle, symmetric, and its speed and acceleration are its derivatives', () => {
  assert.equal(minJerk(0), 0); assert.equal(minJerk(1), 1); assert.equal(minJerk(0.5), 0.5);
  assert.equal(minJerk(-3), 0); assert.equal(minJerk(7), 1);
  assert.equal(minJerkSpeed(0), 0); assert.equal(minJerkSpeed(1), 0); assert.equal(minJerkSpeed(0.5), MIN_JERK_PEAK);
  for (const u of [0, 0.5, 1]) close(minJerkAccel(u), 0, 0, `no acceleration at ${u}`);
  const h = 1e-6;
  for (let u = 0.01; u < 1; u += 0.01) {
    close(minJerk(1 - u), 1 - minJerk(u), 1e-12, `symmetric at ${u}`);
    close(minJerkSpeed(1 - u), minJerkSpeed(u), 1e-12, `speed symmetric at ${u}`);
    close((minJerk(u + h) - minJerk(u - h)) / (2 * h), minJerkSpeed(u), 1e-6, `speed at ${u}`);
    close((minJerkSpeed(u + h) - minJerkSpeed(u - h)) / (2 * h), minJerkAccel(u), 1e-5, `acceleration at ${u}`);
    assert.ok(minJerkSpeed(u) <= MIN_JERK_PEAK + 1e-15, 'the middle is the fastest');
  }
});

test("Fitts's law: bits from distance over width, seconds a + b · bits, and refusals that say what to give", () => {
  assert.equal(fittsIndex(0, 40), 0);
  assert.equal(fittsIndex(120, 40), 2);
  assert.equal(fittsIndex(280, 40), 3);
  assert.equal(fittsSeconds(0), FITTS.a);
  close(fittsSeconds(280, 40), FITTS.a + 3 * FITTS.b, 1e-12, 'three bits');
  close(fittsSeconds(280, 40, { a: 0, b: 0.25 }), 0.75, 1e-12, 'its own constants');
  assert.deepEqual(FITTS, { a: 0.1, b: 0.2, target: 40 });
  assert.throws(() => fittsIndex(100, 0), /human: a target's width is above 0 px/);
  assert.throws(() => fittsIndex(-1, 10), /human: a move's distance is from 0 px/);
  assert.throws(() => fittsSeconds(10, 10, { a: -1 }), /Fitts's a is from 0 to 10 s/);
  assert.throws(() => fittsSeconds(10, 10, { b: 0 }), /Fitts's b is above 0/);
});

test('the two-thirds power law: speed ∝ curvature^−1/3, and the exponent comes back by regression on an ellipse traced as a hand traces it', () => {
  close(powerLawSpeed(1, { floor: 0 }), 1, 1e-12, 'unit curvature');
  close(powerLawSpeed(8, { floor: 0, gain: 3 }), 1.5, 1e-12, 'eight times the bend, half the speed');
  close(powerLawSpeed(0), POWER_LAW.floor ** (-1 / 3), 1e-9, 'a straight stretch runs at the floor\'s top speed');
  assert.throws(() => powerLawSpeed(-1), /a curvature is from 0/);
  assert.throws(() => powerLawSpeed(0, { floor: 0 }), /floor is from 0 per px, and above 0 where the curvature is 0/);
  // x = a cos t, y = b sin t: harmonic motion obeys the law exactly, speed = (ab)^(1/3) · curvature^(−1/3)
  const a = 300, b = 80, n = 2000, pts = [], speeds = [];
  for (let i = 0; i < n; i += 1) { const t = (i / n) * 2 * Math.PI; pts.push([a * Math.cos(t), b * Math.sin(t)]); speeds.push(Math.hypot(a * Math.sin(t), b * Math.cos(t))); }
  const exact = speeds.map((_, i) => { const t = (i / n) * 2 * Math.PI; return (a * b) / (a * a * Math.sin(t) ** 2 + b * b * Math.cos(t) ** 2) ** 1.5; });
  const fit = powerLawFit(speeds, exact);
  close(fit.exponent, 1 / 3, 1e-9, 'the exponent, from the exact curvature'); close(fit.gain, Math.cbrt(a * b), 1e-6, 'the gain'); close(fit.error, 0, 1e-9, 'nothing left');
  const sampled = powerLawFit(speeds.slice(1, -1), curvatures(pts).slice(1, -1));
  close(sampled.exponent, 1 / 3, 1e-3, 'the exponent, from the curvature of the samples');
  assert.equal(powerLawFit([1, 2], [1, 2]), null);
  close(powerLawFit(speeds, exact, { exponent: 1 / 3 }).error, 0, 1e-9, 'held at 1/3, nothing left');
});

test('power-law times run from 0 to the seconds asked, rising, and spend longer where the line bends', () => {
  const along = Array.from({ length: 101 }, (_, i) => i * 2), bends = along.map((_, i) => (i >= 40 && i <= 60 ? 0.1 : 0));
  const times = powerLawTimes(along, bends, 3, { ramp: 0 });
  assert.equal(times[0], 0); assert.equal(times[100], 3);
  for (let i = 1; i < times.length; i += 1) assert.ok(times[i] > times[i - 1]);
  assert.ok(times[51] - times[50] > 2 * (times[11] - times[10]), 'slower in the bend');
  const ramped = powerLawTimes(along, along.map(() => 0), 1);
  assert.ok(ramped[1] - ramped[0] > 3 * (ramped[51] - ramped[50]), 'slow from rest');
  assert.deepEqual(powerLawTimes([0, 0, 0], [0, 0, 0], 2), [0, 1, 2], 'a line of no length: even steps');
  assert.equal(rampShare(5, 10, 0), 1);
});

test('sigma-lognormal: a stroke is half done at start + e^mu, its speed is the derivative of its distance, and the pen lands on its point', () => {
  close(erf(0), 0, 1e-9, 'erf 0'); close(erf(1), 0.8427007929, 2e-7, 'erf 1'); close(erf(-0.5), -0.5204998778, 2e-7, 'erf −0.5');
  const s = { distance: 120, start: 0.2, mu: -1.6, sigma: 0.3, angleFrom: 0.4, angleTo: 1.4 };
  assert.equal(lognormalShare(0.2, s), 0); assert.equal(lognormalSpeed(0.1, s), 0);
  close(lognormalShare(0.2 + Math.exp(-1.6), s), 0.5, 1e-9, 'the median');
  close(lognormalShare(strokeEnd(s), s), 0.99865, 2e-5, 'done by three sigmas');
  const h = 1e-6;
  for (let t = 0.25; t < 1.2; t += 0.05) close((lognormalShare(t + h, s) - lognormalShare(t - h, s)) * s.distance / (2 * h), lognormalSpeed(t, s), 1e-3 * s.distance, `speed at ${t}`);
  // the velocity is the derivative of the position, strokes added
  const strokes = [s, { distance: 80, start: 0.35, mu: -1.5, sigma: 0.25, angleFrom: 2, angleTo: 2 }];
  for (let t = 0.3; t < 1.2; t += 0.07) {
    const a = sigmaLognormalAt(strokes, t - h), b = sigmaLognormalAt(strokes, t + h), v = sigmaLognormalAt(strokes, t);
    close((b.x - a.x) / (2 * h), v.vx, 0.02 * s.distance, `vx at ${t}`); close((b.y - a.y) / (2 * h), v.vy, 0.02 * s.distance, `vy at ${t}`);
  }
  // a stroke's arc: as long as its distance, ending where strokeOffset says
  const [dx, dy] = strokeOffset(s, 1); let len = 0, prev = [0, 0];
  for (let k = 1; k <= 1000; k += 1) { const q = strokeOffset(s, k / 1000); len += Math.hypot(q[0] - prev[0], q[1] - prev[1]); prev = q; }
  close(len, s.distance, 1e-3, 'the arc\'s length'); close(prev[0], dx, 1e-9, 'its end');
  const p = [10, 20], q = [70, -40];
  for (const bend of [0, 0.8, -2]) {
    const st = strokeBetween(p, q, { bend });
    const [ex, ey] = strokeOffset(st, 1);
    close(p[0] + ex, q[0], 1e-9, `bend ${bend} lands x`); close(p[1] + ey, q[1], 1e-9, `bend ${bend} lands y`);
    const end = strokeEnd(st), at = sigmaLognormalAt([st], end, p, end);
    close(at.x, q[0], 1e-9, 'at its end, exactly'); close(at.y, q[1], 1e-9, 'at its end, exactly');
    assert.deepEqual(sigmaLognormalAt([st], end + 5, p, end), { x: at.x, y: at.y, vx: 0, vy: 0 }, 'held after');
  }
  assert.ok(strokeBetween(p, q, { bend: 0.8 }).distance > Math.hypot(60, 60), 'a bent stroke is longer than its chord');
  assert.throws(() => strokeBetween(p, q, { bend: 7 }), /a stroke's bend is how far it turns/);
  assert.deepEqual(SIGMA_LOGNORMAL, { mu: -1.6, sigma: 0.3, gap: 0.16 });
});

test('the tremor: the same seed the same knots, another seed others; at most its amplitude; nothing at the two ends; smooth', () => {
  const k1 = tremorKnots(seeded('a'), 300), k2 = tremorKnots(seeded('a'), 300), k3 = tremorKnots(seeded('b'), 300);
  assert.deepEqual(k1, k2); assert.notDeepEqual(k1, k3);
  assert.equal(k1.length, Math.ceil(300 / TREMOR.wavelength) + 2);
  assert.ok(k1.every((v, i) => (i % 2 ? v <= -0.3 && v > -1 : v >= 0.3 && v < 1)), 'a swing to one side, then the other, never nothing');
  assert.equal(tremorAt(k1, 0, 300), 0); assert.equal(tremorAt(k1, 300, 300), 0);
  assert.equal(tremorAt(k1, 100, 300, { amplitude: 0 }), 0);
  let last = tremorAt(k1, 0, 300), most = 0;
  for (let s = 0.5; s <= 300; s += 0.5) { const v = tremorAt(k1, s, 300); assert.ok(Math.abs(v - last) < 0.1, `smooth at ${s}`); most = Math.max(most, Math.abs(v)); last = v; }
  assert.ok(most <= TREMOR.amplitude && most > 0.1);
  assert.throws(() => tremorKnots(seeded('a'), -1), /a tremor's line is from 0 px long/);
  assert.throws(() => tremorKnots(seeded('a'), 10, { wavelength: 0 }), /wavelength is from 1 to 10000 px/);
  assert.throws(() => tremorKnots(seeded('a'), 1e6, { wavelength: 1 }), /at most 4098: give a longer wavelength/);
});

/** The exponent a pen traced round an a × b ellipse gives against the ellipse's TRUE curvature (the middle 80% of it). */
export async function tracedExponent(a, b, floor, tremor = false) {
  const { planMove, sampleTrack } = await import('../human.js');
  const cx = 600, cy = 400, n = 120;
  const path = Array.from({ length: n }, (_, i) => [cx + a * Math.cos((i / (n - 1)) * 2 * Math.PI * 0.95), cy + b * Math.sin((i / (n - 1)) * 2 * Math.PI * 0.95)]);
  const model = { name: 'power-law', ramp: 0, ...(tremor ? {} : { tremor: 0 }), ...(floor === undefined ? {} : { floor }) };
  const tr = sampleTrack(planMove({ do: 'draw', name: 'ellipse', path, model }), { rate: 1000 }).samples, out = [];
  let along = 0, next = 0;
  for (let i = 1; i < tr.length; i += 1) {
    const ds = Math.hypot(tr[i].x - tr[i - 1].x, tr[i].y - tr[i - 1].y);
    while (ds > 0 && along + ds >= next) { const f = (next - along) / ds; out.push([tr[i - 1].x + (tr[i].x - tr[i - 1].x) * f, tr[i - 1].y + (tr[i].y - tr[i - 1].y) * f, tr[i - 1].t + (tr[i].t - tr[i - 1].t) * f]); next += 4; }
    along += ds;
  }
  const speeds = [], kappa = [];
  for (let i = Math.floor(out.length * 0.1); i < Math.floor(out.length * 0.9); i += 1) {
    const th = Math.atan2((out[i][1] - cy) / b, (out[i][0] - cx) / a);
    kappa.push((a * b) / (a * a * Math.sin(th) ** 2 + b * b * Math.cos(th) ** 2) ** 1.5);
    speeds.push(8 / (out[i + 1][2] - out[i - 1][2]));
  }
  return powerLawFit(speeds, kappa).exponent;
}

test('the law holds at a diagram\'s scale: a pen round a 300 × 100 and a 300 × 30 px ellipse goes as the TRUE curvature^−1/3, to within 0.02, its tremor off and on', async () => {
  assert.equal(POWER_LAW.floor, 0.00025);
  for (const tremor of [false, true]) for (const [a, b] of [[300, 100], [300, 30]]) close(await tracedExponent(a, b, undefined, tremor), 1 / 3, 0.02, `${a} × ${b}, tremor ${tremor ? 'on' : 'off'}`);
  assert.ok(await tracedExponent(300, 100, 0.002) < 0.25, 'the old floor, 0.002, flattened it');
});
