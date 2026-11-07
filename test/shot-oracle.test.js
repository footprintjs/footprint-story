// The check's shares against an oracle that shares none of its method: many rays through points on the subject's own surface,
// each counted by the area it fills on the frame. Thin and oblique cards are the point: they are what a grid falls between.
import test from 'node:test';
import assert from 'node:assert/strict';
import { checkShot, shotLine } from '../shot.js';
import { boxFor, meet, solidOf } from '../src/shot/solid.js';
import { add, aim, cross, dot, mul, sub } from '../src/shot/lens.js';

const frame = [1280, 720], STEPS = 200;
let seed = 20261106;
const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const between = (a, b) => a + (b - a) * random();
const unit = () => { const v = [between(-1, 1), between(-1, 1), between(-1, 1)]; return mul(v, 1 / (Math.hypot(...v) || 1)); };

function thingOf(name, kind, spread) {
  const at = [between(-spread, spread), between(-spread, spread), between(-spread, spread)];
  if (kind === 'ball') return { name, at, r: between(0.1, 2.5) };
  const size = kind === 'thin' ? (random() < 0.5 ? [between(4, 14), between(0.02, 0.25)] : [between(0.02, 0.25), between(4, 14)]) : [between(0.5, 5), between(0.5, 5)];
  return { name, at, size, normal: unit(), back: true };
}

/** Points on what the camera sees of a subject, each with the area on the frame it stands for. */
function surfaceOf(lens, solid) {
  const points = [];
  if (solid.n) {
    for (let i = 0; i < STEPS; i++) for (let j = 0; j < STEPS; j++) {
      const p = add(add(solid.thing.at, mul(solid.right, solid.w * (2 * (i + 0.5) / STEPS - 1))), mul(solid.up, solid.h * (2 * (j + 0.5) / STEPS - 1)));
      const z = dot(sub(p, lens.eye), lens.forward);
      points.push({ ray: mul(sub(p, lens.eye), 1 / z), weight: 1 / (z * z * z) });
    }
    return points;
  }
  const to = sub(solid.thing.at, lens.eye), far = Math.hypot(...to), axis = mul(to, 1 / far), reach = solid.r / Math.sqrt(far * far - solid.r * solid.r);
  const u = (() => { const c = cross(axis, Math.abs(axis[0]) < 0.7 ? [1, 0, 0] : [0, 1, 0]); return mul(c, 1 / Math.hypot(...c)); })(), v = cross(axis, u);
  for (let i = 0; i < STEPS; i++) for (let j = 0; j < STEPS; j++) {
    const s = 2 * (i + 0.5) / STEPS - 1, t = 2 * (j + 0.5) / STEPS - 1;
    if (s * s + t * t > 1) continue;
    const d = add(add(axis, mul(u, s * reach)), mul(v, t * reach)), z = dot(d, lens.forward);
    points.push({ ray: mul(d, 1 / z), weight: 1 / (z * z * z) });
  }
  return points;
}

function truthOf(lens, things) {
  const [own, ...others] = things.map(solidOf), inFrame = ({ ray }) => { const x = lens.cx + dot(ray, lens.right) * lens.k, y = lens.cy - dot(ray, lens.up) * lens.k; return x >= 0 && x <= lens.w && y >= 0 && y <= lens.h; };
  let all = 0, kept = 0; const covered = new Map(others.map((o) => [o.thing.name, 0]));
  for (const point of surfaceOf(lens, own)) {
    all += point.weight;
    if (!inFrame(point)) continue;
    kept += point.weight;
    const t = meet(own, lens.eye, point.ray);
    for (const o of others) if (boxFor(lens, o).state !== 'behind' && meet(o, lens.eye, point.ray) < t) covered.set(o.thing.name, covered.get(o.thing.name) + point.weight);
  }
  return { inFrame: kept / all, cover: Object.fromEntries([...covered].map(([k, v]) => [k, kept ? v / kept : 0])) };
}

test('shares match the oracle on thin, oblique and round things, and "none" is said only of what is not there', () => {
  let scenes = 0, thin = 0, worstFrame = 0, worstCover = 0, worstThrough = 0;
  for (let n = 0; n < 120; n++) {
    const kinds = ['ball', 'card', 'thin'], kind = kinds[n % 3], things = [thingOf('a', kind, 1.5), thingOf('b', kinds[(n >> 2) % 3], 4), thingOf('c', kinds[(n >> 4) % 3], 4)];
    const camera = { target: [between(-1, 1), between(-1, 1), between(-1, 1)], azimuth: between(-3.1, 3.1), elevation: between(-1.5, 1.5), distance: between(6, 14), focal: between(0.8, 2.2) };
    const report = checkShot({ things }, camera, frame, { on: 'a' }), row = report.rows[0];
    if (row.state !== 'seen') continue;
    scenes++; if (kind === 'thin') thin++;
    const truth = truthOf(aim({ ...camera, shift: [0, 0] }, frame), things), own = solidOf(things[0]);
    const lens = aim({ ...camera, shift: [0, 0] }, frame);
    const worthKnowing = !own.n || Math.abs(dot(own.n, mul(sub(lens.eye, own.thing.at), 1 / Math.hypot(...sub(lens.eye, own.thing.at))))) > 0.02;   // nearly edge-on, the oracle's own points thin out
    if (worthKnowing) worstFrame = Math.max(worstFrame, Math.abs(row.inFrame - truth.inFrame));
    if (truth.inFrame === 0 || !worthKnowing) continue;
    for (const name of ['b', 'c']) {
      const said = row.blockers.find((b) => b.name === name)?.share ?? 0, gap = Math.abs(said - truth.cover[name]);
      if (row.through.includes(name) || touchesOwn(own, solidOf(things.find((t) => t.name === name)))) worstThrough = Math.max(worstThrough, gap);
      else {
        worstCover = Math.max(worstCover, gap);
        assert.ok(said > 0 || truth.cover[name] < 0.002, `${name} said to cover none, and it covers ${truth.cover[name]}`);
      }
    }
  }
  assert.ok(scenes > 90 && thin > 30, `${scenes} scenes, ${thin} thin`);
  assert.ok(worstFrame < 0.01, `in frame off by ${worstFrame}`);
  assert.ok(worstCover < 0.01, `cover off by ${worstCover}`);
  assert.ok(worstThrough < 0.05, `cover of things passing through each other off by ${worstThrough}`);
});

/** Whether two things might pass through each other: the oracle does not ask the check. */
function touchesOwn(a, b) {
  const reach = (s) => (s.n ? Math.hypot(s.w, s.h) : s.r);
  return Math.hypot(...sub(a.thing.at, b.thing.at)) < reach(a) + reach(b);
}

test('a thin card mostly behind a ball says so', () => {
  const things = [{ name: 'a', at: [0.21, 1.5, 0.58], size: [9.17, 0.1], normal: [-0.78, 0.01, 0.63], back: true }, { name: 'b', at: [0.31, -0.27, 0.66], r: 2.22 }];
  const camera = { target: [0, -0.22, -0.11], azimuth: 2.89, elevation: -1.14, distance: 9.57, focal: 2.04 };
  const report = checkShot({ things }, camera, frame, { on: 'a' }), truth = truthOf(aim({ ...camera, shift: [0, 0] }, frame), things);
  assert.ok(Math.abs(report.blockers[0].share - truth.cover.b) < 0.01, `${report.blockers[0].share} vs ${truth.cover.b}`);
  assert.ok(Math.abs(report.inFrame - truth.inFrame) < 0.01);
  assert.match(shotLine(report), /"b" covers 5\d% of it/);
});

test('a thin pole across a card is counted, at any thinness a frame can show', () => {
  const card = { name: 'a', at: [0, 0, 0], size: [6, 6] }, camera = { target: [0, 0, 0], azimuth: 0, elevation: 0, distance: 10, focal: 1.25 };
  for (const width of [0.5, 0.05, 0.005, 0.0005]) {
    const pole = { name: 'pole', at: [0.37, 0.11, 4], size: [24, width], normal: [0.3, 0.2, 1], back: true }, r = checkShot({ things: [card, pole] }, camera, frame, { on: 'a' });
    assert.equal(r.faults[0]?.kind, 'blocked', `width ${width}`);
    const seen = width * 90 / 6 / (10 / 6);
    assert.ok(r.blockers[0].share > seen / 200 && r.blockers[0].share < seen * 2, `${width}: ${r.blockers[0].share}`);
  }
  const beside = { name: 'pole', at: [0, 3.1 * 6 / 10, 4], size: [24, 0.1] };
  assert.deepEqual([...checkShot({ things: [card, beside] }, camera, frame, { on: 'a' }).blockers], [], 'one just past the edge is not there');
});

test('two cards crossing: each covers the part on its near side, exactly', () => {
  const camera = { target: [0, 0, 0], azimuth: 0, elevation: 0, distance: 10, focal: 1.25 };
  const flat = { name: 'a', at: [0, 0, 0], size: [4, 4] }, slanted = { name: 'b', at: [0, 0, 0], size: [4, 4], normal: [1, 0, 1], back: true };
  const r = checkShot({ things: [flat, slanted] }, camera, frame, { on: 'a' });
  const edge = 2 * Math.SQRT1_2, want = (edge / (10 - edge)) / 0.4;   // the slant's near end, as far along the frame as it lands, over the flat card's width
  assert.ok(Math.abs(r.blockers[0].share - want) < 1e-3, `${r.blockers[0].share} vs ${want}`);
  assert.deepEqual([...r.through], []);
  const twin = checkShot({ things: [flat, { name: 'twin', at: [0, 0, 0], size: [4, 4] }] }, camera, frame, { on: 'a' });
  assert.deepEqual([...twin.blockers], [], 'in one plane, neither is nearer');
});
