// Routes and rounded ways: the way a link runs along the floor, and what it is drawn as. Checked against what a route
// must always hold — it starts and ends on a foot that is seen, runs along the tile lines, passes under nothing, shares
// no stretch with another — by tests written apart from the code, on blocks standing every way round each other.
import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { readPorts, isometric, arrange, gridFor, routes, routeNote, rounded, wordsToFit, MOST_ALSO, MOST_ROUTES, MOST_WORK, NO_ROUTE, MOST_ISOMETRIC_THINGS } from '../isometric.js';

const thing = (name, at, size = [2, 2, 1], more = {}) => ({ name, at, size, ...more });
const HIDES = Math.sqrt(1.5);
/** The stretches of a route: [[from, to], …]. */
const stretches = (route) => route.points.slice(1).map((p, k) => [route.points[k], p]);
/** Points along a route, a twentieth of a tile apart (its two ends left out: they are on a foot). */
const along = (route) => stretches(route).flatMap(([a, b]) => { const n = Math.max(1, Math.round((Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1])) * 20)); return Array.from({ length: n - 1 }, (_, k) => [a[0] + (b[0] - a[0]) * (k + 1) / n, a[1] + (b[1] - a[1]) * (k + 1) / n]); });
const under = ([x, y], t) => x > t.at[0] && x < t.at[0] + t.size[0] && y > t.at[1] && y < t.at[1] + t.size[1];
/** Whether a thing hides a floor point: somewhere towards the viewer, within what its height covers, is on its tiles. */
/**
 * Whether a thing hides a floor point (the floor at `lift`), asked the long way round and apart from the code: walk
 * from the point towards the viewer, a hundredth of a tile at a time, and see whether the walk is over the thing's
 * tiles at a height the thing has there.
 */
const hides = ([x, y], t, lift = 0, slack = 0) => {
  const [c, r, z = 0] = t.at, [w, d, h] = t.size;
  for (let k = 1; k <= 600; k += 1) {   // six tiles: further than any thing here is high enough to hide
    const far = k / 100, up = far / HIDES + lift;   // so far towards the viewer, the line of sight has risen so much
    if (x + far > c - slack && x + far < c + w + slack && y + far > r - slack && y + far < r + d + slack && up > z - slack && up < z + h + slack) return true;
  }
  return false;
};
/** The walk is a hundredth of a tile at a time: a thing hides a point surely when one a little smaller does, and not at all when one a little bigger does not. */
const SURE = -0.03, MAYBE = 0.03;
/** What every route holds, whatever stands where. */
function holds(route, things, where = '') {
  const byName = new Map(things.map((t) => [t.name, t])), a = byName.get(route.from), b = byName.get(route.to), tell = `${where} ${route.from}→${route.to} ${JSON.stringify(route.points)}`;
  assert.ok(route.points.length >= 2, tell);
  for (const [p, q] of stretches(route)) assert.ok((p[0] === q[0]) !== (p[1] === q[1]), `a stretch runs along a tile line: ${tell}`);
  // it leaves a foot that is seen, the way that foot faces, and comes into one against the way it faces
  const onFoot = (p, t, edge) => (edge === 'right' ? Math.abs(p[0] - (t.at[0] + t.size[0])) < 1e-9 && p[1] > t.at[1] && p[1] < t.at[1] + t.size[1] : Math.abs(p[1] - (t.at[1] + t.size[1])) < 1e-9 && p[0] > t.at[0] && p[0] < t.at[0] + t.size[0]);
  assert.ok(onFoot(route.points[0], a, route.feet[0]), `starts on its ${route.feet[0]} foot: ${tell}`);
  assert.ok(onFoot(route.points.at(-1), b, route.feet[1]), `ends on a ${route.feet[1]} foot: ${tell}`);
  const out = route.points[1], into = route.points.at(-2), end = route.points.at(-1);
  assert.ok(route.feet[0] === 'right' ? out[0] > route.points[0][0] : out[1] > route.points[0][1], `sets off outwards: ${tell}`);
  assert.ok(route.feet[1] === 'right' ? into[0] > end[0] : into[1] > end[1], `comes in from outside: ${tell}`);
  for (const p of along(route)) for (const t of things) assert.ok(!under(p, t), `passes under ${t.name} at ${p}: ${tell}`);
  assert.equal(route.bends, route.points.length - 2, tell);
  assert.ok(Math.abs(route.tiles - stretches(route).reduce((sum, [p, q]) => sum + Math.abs(q[0] - p[0]) + Math.abs(q[1] - p[1]), 0)) < 1e-9, tell);
}
/** Whether two routes share a stretch of floor (more than a point). */
const share = (one, other) => stretches(one).some(([a, b]) => stretches(other).some(([c, d]) => {
  const cols = a[1] === b[1], same = cols ? c[1] === d[1] && c[1] === a[1] : c[0] === d[0] && c[0] === a[0], k = cols ? 0 : 1;
  return same && Math.min(Math.max(a[k], b[k]), Math.max(c[k], d[k])) - Math.max(Math.min(a[k], b[k]), Math.min(c[k], d[k])) > 1e-9;
}));

test('routes: a thing to the side is reached in one turn, from the right foot to the left foot', () => {
  const things = [thing('a', [0, 4]), thing('b', [5, 1])];
  const [route] = routes(things, [['a', 'b']]);
  assert.deepEqual(route, { from: 'a', to: 'b', points: [[2, 5], [6, 5], [6, 3]], path: [[2, 5, 0], [6, 5, 0], [6, 3, 0]], feet: ['right', 'left'], ports: [null, null], bends: 1, tiles: 6, behind: [], unseen: [], crosses: 0, shared: 0 });
  holds(route, things);
  assert.equal(routeNote(route), null);
});

test('routes: a request and its answer lie in two lanes, and share no stretch', () => {
  const things = [thing('a', [0, 4]), thing('b', [5, 1])];
  const [request, answer] = routes(things, [['a', 'b'], ['b', 'a']]);
  holds(request, things); holds(answer, things);
  assert.deepEqual(answer.feet, ['left', 'right']);            // the same two feet, the other way
  assert.equal(share(request, answer), false);
  assert.notDeepEqual(answer.points.at(-1), request.points[0]);   // each has its own place on a foot
  assert.equal(answer.crosses, 0);
});

test('routes: a thing straight in front, behind, or beside along a tile line is reached too — round to a foot that is seen', () => {
  for (const b of [[5, 5], [-5, -5], [4, 0], [0, 4], [2, 0], [0, 2], [3, 0], [-4, 0], [0, -4]]) {
    const things = [thing('a', [0, 0]), thing('b', b)];
    for (const link of [['a', 'b'], ['b', 'a']]) {
      const [route] = routes(things, [link]);
      assert.ok(route.points, `b at ${b}, ${link}: ${route.why}`);
      holds(route, things, `b at ${b}`);
      assert.ok(route.bends <= 3, `b at ${b}: ${route.bends} bends`);
    }
  }
});

test('routes: wherever two things stand, there is a way, it holds, and a pair shares no stretch (four distances, every 5° round)', () => {
  let ways = 0;
  for (const far of [3, 4, 6, 10]) {
    for (let k = 0; k < 72; k += 1) {
      const turn = k * 5 * Math.PI / 180, b = [Math.round(far * Math.cos(turn) * 4) / 4, Math.round(far * Math.sin(turn) * 4) / 4];
      if (Math.abs(b[0]) < 2 && Math.abs(b[1]) < 2) continue;   // one on the other
      const things = [thing('a', [0, 0]), thing('b', b)], where = `b at ${b}`;
      const [request, answer] = routes(things, [['a', 'b'], ['b', 'a']]);
      assert.ok(request.points && answer.points, `${where}: ${request.why ?? answer.why}`);
      holds(request, things, where); holds(answer, things, where);
      assert.equal(share(request, answer), false, where);
      ways += 2;
    }
  }
  assert.ok(ways > 500);
});

test('routes: more links at a thing than its feet have places: the last lies on another, and says so', () => {
  const things = [thing('a', [0, 4]), thing('b', [5, 1])];
  const laid = routes(things, Array.from({ length: 7 }, (_, i) => (i % 2 ? ['b', 'a'] : ['a', 'b'])));
  for (const route of laid) holds(route, things);
  assert.deepEqual(laid.slice(0, 6).map((r) => r.shared), [0, 0, 0, 0, 0, 0]);   // three places a foot, two feet a thing
  assert.ok(laid[6].shared > 0);
  assert.equal(routeNote(laid[6]).includes('lies on another link for want of room'), true);
});

test('routes: a link goes round a thing that stands in its way, in front of it where it can be seen', () => {
  const things = [thing('a', [0, 4]), thing('mid', [4, 3], [2, 2, 2]), thing('b', [8, 4])];
  const [route] = routes(things, [['a', 'b']]);
  holds(route, things);
  assert.deepEqual(route.behind, []);
  for (const p of along(route)) assert.ok(!hides(p, things[1]), `behind mid at ${p}`);
  // and with no way in front, it passes behind and says so
  const walled = [thing('a', [0, 4]), thing('b', [8, 4]), thing('wall', [4, 5.5], [2, 40, 2])];
  const [hidden] = routes(walled, [['a', 'b']]);
  holds(hidden, walled);
  assert.deepEqual(hidden.behind, ['wall']);
  assert.ok(along(hidden).some((p) => hides(p, walled[2])));
  assert.equal(routeNote(hidden), 'a to b: passes behind wall');
});

test('routes: behind names exactly the things that hide a point of the way', () => {
  fc.assert(fc.property(fc.array(fc.tuple(fc.integer({ min: 0, max: 5 }), fc.integer({ min: 0, max: 5 }), fc.integer({ min: 0, max: 4 })), { minLength: 2, maxLength: 7 }), (cells) => {
    const seen = new Set(), things = [];
    for (const [i, j, h] of cells) if (!seen.has(`${i} ${j}`)) { seen.add(`${i} ${j}`); things.push(thing(`t${things.length}`, [i * 4, j * 4], [2, 2, h / 2])); }
    if (things.length < 2) return;
    const links = things.slice(1).map((t, k) => [things[k].name, t.name]);
    for (const route of routes(things, links)) {
      assert.ok(route.points, route.why);
      holds(route, things);
      // at the points half a tile apart it stands on, its two feet among them: what hides one is named, and what is named hides one
      const stood = stretches(route).flatMap(([a, b]) => { const n = Math.max(1, Math.round((Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1])) * 2)); return Array.from({ length: n + 1 }, (_, k) => [a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]); });
      const hiding = things.filter((t) => stood.some((p) => hides(p, t))).map((t) => t.name).sort();
      assert.deepEqual([...route.behind].sort(), hiding, JSON.stringify([things, route]));
    }
  }), { numRuns: 200 });
});

test('routes: on a map the build arranges, every link has a way; the same things and links, the same ways', () => {
  fc.assert(fc.property(fc.integer({ min: 2, max: 9 }), fc.array(fc.tuple(fc.nat(8), fc.nat(8)), { maxLength: 12 }), fc.boolean(), (n, pairs, across) => {
    const names = Array.from({ length: n }, (_, i) => `p${i}`), links = pairs.map(([a, b]) => [names[a % n], names[b % n]]).filter(([a, b]) => a !== b);
    const placed = arrange(names.map((name, i) => ({ name, size: [1 + i % 3, 1 + (i * 7) % 3, 0.5 + i % 2] })), links, { across }).things;
    const laid = routes(placed, links);
    assert.deepEqual(routes(placed, links), laid);
    laid.forEach((route, i) => {
      assert.ok(route.points, `${links[i]}: ${route.why}`);
      holds(route, placed);
      // `shared` is honest: 0 exactly when the route lies on no stretch of one laid before it. The whole of both is
      // compared, the two short ends at its feet too (an end's short run may lie on another's stretch); only a touch of
      // no length, as at a foot point the two meet at, is not lying on it
      const lies = laid.slice(0, i).some((before) => share(route, before));
      const sameFoot = laid.slice(0, i).some((before) => [before.points[0], before.points.at(-1)].some((p) => [route.points[0], route.points.at(-1)].some((q) => p[0] === q[0] && p[1] === q[1])));
      assert.equal(route.shared > 0, lies || sameFoot, `${links[i]}: shared ${route.shared}`);
    });
  }), { numRuns: 150 });
});

test('routes: a round thing is left and reached on its round base; a thin thing gets a finer lattice', () => {
  const things = [thing('a', [0, 4], [2, 2, 1], { round: true }), thing('b', [5, 0], [2, 2, 1], { round: true })];
  const laid = routes(things, [['a', 'b'], ['b', 'a']]);
  for (const route of laid) for (const [p, t] of [[route.points[0], route.from], [route.points.at(-1), route.to]]) {
    const c = things.find((x) => x.name === t);
    assert.ok(Math.abs(Math.hypot(p[0] - (c.at[0] + 1), p[1] - (c.at[1] + 1)) - 1) < 1e-9, `${p} is on ${t}'s rim`);
  }
  assert.deepEqual(laid[0].points[0], [2, 5]);            // the first takes the middle of the foot: the rim's furthest point
  assert.notEqual(laid[1].points.at(-1)[0], 2);           // the second a place beside it, nearer the middle than the square's side
  const thin = [thing('plate', [0, 0], [0.5, 0.5, 0]), thing('b', [3, -3])];
  const [route] = routes(thin, [['plate', 'b']]);
  assert.deepEqual(route.points[0], [0.5, 0.25]);          // the middle of a foot half a tile wide
  assert.throws(() => routes([thing('a', [0, 0], [2, 3, 1], { round: true })], []), /"a" is round: give it the same width and depth/);
});

test('routes: a link with no way says why, in its place', () => {
  const things = [thing('a', [0, 0]), thing('b', [6, -3]), thing('up', [0, 6, 2]), thing('boxed', [20, 20]), thing('e', [22, 20]), thing('s', [20, 22])];
  const laid = routes(things, [['a', 'nobody'], ['a', 'a'], ['a', 'up'], ['a', 'boxed'], ['a', 'b']]);
  assert.deepEqual(laid.slice(0, 4).map((r) => [r.points, r.why]), [[null, NO_ROUTE.name], [null, NO_ROUTE.self], [null, NO_ROUTE.heights], [null, NO_ROUTE.foot]]);
  assert.ok(laid[4].points);
  assert.equal(routeNote(laid[3]), 'a to boxed: no route along the floor (no place at a foot that can be seen: closed in, or too narrow)');
  assert.deepEqual(routes([], [['a', 'b']]), [{ from: 'a', to: 'b', points: null, why: NO_ROUTE.name }]);
  assert.deepEqual(routes(things, []), []);
  // walled in on every side: feet there are, a way there is not
  const ring = [thing('a', [0, 0]), thing('b', [20, 20]), thing('n', [16, 16], [10, 2, 1]), thing('s2', [16, 24], [10, 2, 1]), thing('w', [16, 18], [2, 6, 1]), thing('e2', [24, 18], [2, 6, 1])];
  assert.equal(routes(ring, [['a', 'b']])[0].why, NO_ROUTE.way);
  // too far apart for a lattice fine enough to give a foot a place
  assert.equal(routes([thing('a', [0, 0]), thing('b', [900000, 900000])], [['a', 'b']])[0].why, NO_ROUTE.wide);
  // two things standing at one height above the floor are joined at that height
  const raised = routes([thing('a', [0, 4, 2]), thing('b', [5, 1, 2])], [['a', 'b']])[0];
  assert.deepEqual(raised.points, [[2, 5], [6, 5], [6, 3]]);
});

test('routes: the note says what a person or a model needs to know, and nothing when a route lies well', () => {
  const base = { from: 'api', to: 'db', points: [[0, 0], [1, 0]], feet: ['right', 'left'], tiles: 1 };
  assert.equal(routeNote({ ...base, bends: 0, behind: [], crosses: 0, shared: 0 }), null);
  assert.equal(routeNote({ ...base, bends: 2, behind: ['logs', 'cache'], crosses: 0 }), 'api to db: passes behind logs, cache');
  assert.equal(routeNote({ ...base, bends: 5, behind: [], crosses: 1 }), 'api to db: crosses 1 other, turns 5 times');
  assert.equal(routeNote({ ...base, bends: 1, behind: [], crosses: 3 }), 'api to db: crosses 3 others');
  assert.equal(routeNote({ ...base, bends: 1, behind: [], crosses: 0, shared: 1.5 }), 'api to db: lies on another link for want of room');
});

test('routes: a picture too big to lay costs no more than the work allowed, and says which links were not tried', () => {
  const many = Array.from({ length: MOST_ISOMETRIC_THINGS }, (_, i) => thing(`b${i}`, [(i % 16) * 5, Math.floor(i / 16) * 5]));
  let s = 5;
  const next = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const links = Array.from({ length: MOST_ROUTES }, () => { const a = Math.floor(next() * 256); return [`b${a}`, `b${(a + 1 + Math.floor(next() * 255)) % 256}`]; });
  const began = performance.now(), laid = routes(many, links);
  assert.ok(performance.now() - began < 60_000, `${Math.round(performance.now() - began)} ms`);   // the bound is the work counted (MOST_WORK); the clock only says it ended
  assert.equal(laid.length, MOST_ROUTES);
  const tried = laid.findIndex((r) => r.why === NO_ROUTE.work);
  assert.ok(tried > 50 && laid.slice(tried).every((r) => r.why === NO_ROUTE.work), 'once the work is spent, no later link is tried');
  for (const route of laid.slice(0, 40)) holds(route, many);
  assert.equal(MOST_WORK, 4_000_000);
});

test('routes: a floor at every height costs work too — the heights past what is left are not built', () => {
  // 128 pairs, each at a height of its own: every floor is a lattice of its own, and every thing above it hides some of it
  const things = Array.from({ length: 256 }, (_, i) => thing(`p${i}`, [(i % 2) * 5, Math.floor(i / 2) * 4, Math.floor(i / 2)]));
  const began = performance.now(), laid = routes(things, Array.from({ length: 128 }, (_, i) => [`p${2 * i}`, `p${2 * i + 1}`]));
  assert.ok(performance.now() - began < 30_000, `${Math.round(performance.now() - began)} ms`);
  const built = laid.findIndex((r) => !r.points);
  assert.ok(built >= 2 && built < 128, `${built} heights were laid`);
  assert.ok(laid.slice(built).every((r) => r.why === NO_ROUTE.work));
  for (const route of laid.slice(0, built)) assert.equal(route.points.length >= 2, true);
});

test('routes: refuses what it cannot read, naming the fix; a getter is never run', () => {
  assert.throws(() => routes('a'), /routes takes a list of things/);
  assert.throws(() => routes([null]), /thing 1 is \{name, at: \[col, row\], size: \[wide, deep, high\]\}/);
  assert.throws(() => routes([{ name: '', at: [0, 0], size: [1, 1, 1] }]), /thing 1 has a name/);
  assert.throws(() => routes([thing('a', [0, 0]), thing('a', [5, 5])]), /two things are named "a"/);
  assert.throws(() => routes([thing('a', [0, 0], [2, 2, 1], { round: 'yes' })]), /round says whether it is a round thing/);
  assert.throws(() => routes([{ name: 'a', at: [0], size: [1, 1, 1] }]), /"a"'s at is \[col, row\]/);
  assert.throws(() => routes(Array.from({ length: MOST_ISOMETRIC_THINGS + 1 }, (_, i) => thing(`t${i}`, [i * 3, 0]))), /reads at most 256 things/);
  assert.throws(() => routes([thing('a', [0, 0])], 'x'), /routes takes a list of links/);
  assert.throws(() => routes([thing('a', [0, 0])], [['a']]), /link 1 is \[from, to\]/);
  assert.throws(() => routes([thing('a', [0, 0])], Array.from({ length: MOST_ROUTES + 1 }, () => ['a', 'a'])), /lays at most 1024 links/);
  assert.throws(() => routes([thing('a', [0, 0])], [], { hides: -1 }), /hides is the tiles of floor/);
  let ran = false;
  const sly = { name: 'a', size: [1, 1, 1] };
  Object.defineProperty(sly, 'at', { get() { ran = true; return [0, 0]; }, enumerable: true });
  assert.throws(() => routes([sly]), /"a"'s at/);
  assert.equal(ran, false);
  // hides: none hidden with 0, so nothing is "behind"
  const walled = [thing('a', [0, 4]), thing('b', [8, 4]), thing('wall', [4, 5.5], [2, 40, 2])];
  assert.deepEqual(routes(walled, [['a', 'b']], { hides: 0 })[0].behind, []);
  assert.deepEqual(routes(walled, [['a', 'b']], null)[0].behind, ['wall']);
});

test('rounded: a way with its corners rounded — the pieces, the length, and the place a share along it', () => {
  const way = rounded([[0, 0], [100, 0], [100, 80]], 20);
  assert.deepEqual(way.start, [0, 0]);
  assert.deepEqual(way.pieces, [{ to: [80, 0] }, { corner: [100, 0], to: [100, 20] }, { to: [100, 80] }]);
  assert.ok(way.length > 80 + 60 + 20 * Math.SQRT2 && way.length < 180);   // two straight runs and a corner: longer than its chord, shorter than the sharp way
  assert.deepEqual(way.at(0), [0, 0]);
  assert.deepEqual(way.at(1), [100, 80]);
  assert.deepEqual(way.at(40 / way.length), [40, 0]);
  const middle = way.at(0.5);
  assert.ok(middle[0] > 80 && middle[0] < 100 && middle[1] > 0 && middle[1] < 20, `${middle} is on the corner`);
  // sharp: the points themselves
  const sharp = rounded([[0, 0], [100, 0], [100, 80]]);
  assert.deepEqual(sharp.pieces, [{ to: [100, 0] }, { to: [100, 80] }]);
  assert.equal(sharp.length, 180);
  assert.deepEqual(sharp.at(0.5), [90, 0]);
});

test('rounded: a rounding never takes more than half a run; a point on a straight line is no corner; twice the same point is one', () => {
  const tight = rounded([[0, 0], [10, 0], [10, 100]], 50);
  assert.deepEqual(tight.pieces, [{ to: [5, 0] }, { corner: [10, 0], to: [10, 5] }, { to: [10, 100] }]);
  const full = rounded([[0, 0], [10, 0], [10, 10]], 5);
  assert.deepEqual(full.pieces, [{ to: [5, 0] }, { corner: [10, 0], to: [10, 5] }, { to: [10, 10] }]);
  const ess = rounded([[0, 0], [10, 0], [10, 10], [20, 10]], 5);
  assert.deepEqual(ess.pieces, [{ to: [5, 0] }, { corner: [10, 0], to: [10, 5] }, { corner: [10, 10], to: [15, 10] }, { to: [20, 10] }]);   // two corners back to back: no straight piece of no length between
  assert.deepEqual(rounded([[0, 0], [50, 0], [50, 0], [100, 0]], 20).pieces, [{ to: [50, 0] }, { to: [100, 0] }]);
  assert.equal(rounded([[0, 0], [3, 4]], 9).length, 5);
});

test('rounded: the place along a way moves on steadily and stays on it', () => {
  fc.assert(fc.property(fc.array(fc.tuple(fc.integer({ min: -200, max: 200 }), fc.integer({ min: -200, max: 200 })), { minLength: 2, maxLength: 8 }), fc.integer({ min: 0, max: 60 }), (points, radius) => {
    if (points.every((p) => p[0] === points[0][0] && p[1] === points[0][1])) return;
    const way = rounded(points, radius);
    let before = way.at(0), gone = 0;
    for (let k = 1; k <= 200; k += 1) {
      const here = way.at(k / 200), step = Math.hypot(here[0] - before[0], here[1] - before[1]);
      assert.ok(step <= way.length / 200 + 1e-6, 'never a jump longer than its share of the way');
      gone += step; before = here;
    }
    assert.ok(gone <= way.length + 1e-6 && gone >= way.length * 0.98, `${gone} of ${way.length}`);
  }), { numRuns: 200 });
});

test('rounded: refuses what it cannot read, naming the fix', () => {
  assert.throws(() => rounded([[0, 0]]), /rounded takes a way of 2 to 4096 points/);
  assert.throws(() => rounded('x'), /rounded takes a way/);
  assert.throws(() => rounded([[0, 0], [1, 'a']]), /point 2 of the way is \[x, y\]/);
  assert.throws(() => rounded([[0, 0], [1, 1]], -1), /a radius of 0 or more/);
  assert.throws(() => rounded([[2, 2], [2, 2]]), /its points are all one place/);
  assert.throws(() => rounded([[0, 0], [1, 1]]).at(2), /a share of it, from 0 to 1/);
});

test('routes: the short run out of a foot is part of the route — it passes under nothing, and a hidden foot is told', () => {
  // a thin thing stands right in front of a's right foot: no route may run through it to that foot
  const thin = [thing('a', [0, 0]), thing('thin', [2.1, -1], [0.15, 4, 1]), thing('b', [6, 0])];
  for (const route of routes(thin, [['a', 'b'], ['b', 'a']])) { assert.ok(route.points, route.why); holds(route, thin); }
  // the foot it reaches is hidden by the thing it comes from: said, where it used to be silent
  const tall = [thing('t0', [7.3, 1.5], [3.1, 1.6, 2.9]), thing('t1', [4.3, -2.6], [2.2, 3, 2.7])];
  const [route] = routes(tall, [['t0', 't1']]);
  holds(route, tall);
  const end = route.points.at(-1);
  assert.equal(hides(end, tall[0]), route.behind.includes('t0'), `${JSON.stringify(route)}`);
  // and a hidden foot costs: with a place on that foot that is seen, the route takes it
  assert.deepEqual(route.behind, [], JSON.stringify(route));
  assert.equal(hides(end, tall[0], 0, MAYBE), false);
  // only the middle of b's right foot is hidden (by T, in front of it): the route takes the place beside it that is seen
  const peek = [thing('b', [0, 0]), thing('T', [2.25, 3], [2, 2, 2]), thing('a', [8, -2])];
  assert.equal(hides([2, 1], peek[1], 0, SURE), true);
  assert.equal(hides([2, 0.5], peek[1], 0, MAYBE), false);
  const [seen] = routes(peek, [['a', 'b']]);
  assert.deepEqual([seen.points.at(-1), seen.behind], [[2, 0.5], []]);
  // a thing with a thin wall across the front of both its feet has no place at all: the run to any would pass under a wall
  const walled = [thing('a', [0, 0]), thing('e', [2.1, -1], [0.15, 4, 1]), thing('s', [-1, 2.1], [4, 0.15, 1]), thing('b', [8, 8])];
  assert.deepEqual(routes(walled, [['a', 'b'], ['b', 'a']]).map((r) => r.why), [NO_ROUTE.foot, NO_ROUTE.foot]);
});

test('routes: a round thing does not hide its own foot', () => {
  const things = [thing('r', [0, 0], [2, 2, 1], { round: true }), thing('n', [1.95, 1.7], [0.5, 0.25, 0.2]), thing('b', [6, 0])];
  for (const route of routes(things, [['r', 'b'], ['b', 'r']])) { assert.ok(route.points, route.why); assert.equal(route.behind.includes('r'), false, JSON.stringify(route)); }
});

test('routes: behind names every thing that hides a point, whatever order the things are given in', () => {
  const picture = (order) => order.map((name) => ({ A: thing('A', [2, -7], [2, 2, 0]), W1: thing('W1', [-10, -1], [12.5, 0.5, 0]), W2: thing('W2', [3.5, -1], [16, 0.5, 0]), X: thing('X', [4, 0], [1, 1, 4]), Y: thing('Y', [5, 1], [1, 1, 4]), B: thing('B', [2, 6], [2, 2, 0]) }[name]));
  const one = routes(picture(['A', 'W1', 'W2', 'X', 'Y', 'B']), [['A', 'B']])[0], other = routes(picture(['A', 'W1', 'W2', 'Y', 'X', 'B']), [['A', 'B']])[0];
  assert.deepEqual(one.points, other.points);
  assert.deepEqual([...one.behind].sort(), [...other.behind].sort());
  assert.deepEqual([...one.behind].sort(), ['X', 'Y']);
});

test('routes: behind and under, with things at any place, size and height (random pictures off the half tile)', () => {
  fc.assert(fc.property(fc.array(fc.tuple(fc.integer({ min: -20, max: 60 }), fc.integer({ min: -20, max: 60 }), fc.integer({ min: 3, max: 30 }), fc.integer({ min: 3, max: 30 }), fc.integer({ min: 0, max: 30 })), { minLength: 2, maxLength: 6 }), (raw) => {
    const things = [];
    for (const [c, r, w, d, h] of raw) {
      const t = thing(`t${things.length}`, [c / 5, r / 5], [w / 10, d / 10, h / 10]);
      if (!things.some((o) => t.at[0] < o.at[0] + o.size[0] + 0.3 && o.at[0] < t.at[0] + t.size[0] + 0.3 && t.at[1] < o.at[1] + o.size[1] + 0.3 && o.at[1] < t.at[1] + t.size[1] + 0.3)) things.push(t);
    }
    if (things.length < 2) return;
    const links = things.slice(1).flatMap((t, k) => [[things[k].name, t.name], [t.name, things[k].name]]);
    for (const route of routes(things, links)) {
      if (!route.points) continue;
      holds(route, things);
      // a foot the code says is seen is seen, and a thing it names does hide a point of the way (asked at a twentieth of a tile)
      const fine = stretches(route).flatMap(([p, q]) => { const n = Math.max(1, Math.round((Math.abs(q[0] - p[0]) + Math.abs(q[1] - p[1])) * 40)); return Array.from({ length: n + 1 }, (_, k) => [p[0] + (q[0] - p[0]) * k / n, p[1] + (q[1] - p[1]) * k / n]); });
      for (const name of route.behind) assert.ok(fine.some((p) => hides(p, things.find((t) => t.name === name), 0, MAYBE)), `${name} is named and hides nothing: ${JSON.stringify([things, route])}`);
      for (const foot of [route.points[0], route.points.at(-1)]) for (const t of things) if (hides(foot, t, 0, SURE)) assert.ok(route.behind.includes(t.name), `${t.name} hides a foot and is not named: ${JSON.stringify([things, route])}`);
    }
  }), { numRuns: 300 });
});

test('routes: a crossing at a route\'s own first point or short run is counted, and avoided when a lane is free', () => {
  const things = [thing('t1', [3.1, 1], [2.8, 2.4, 0.5]), thing('t3', [2.3, 7.2], [1.6, 2.6, 0.8])];
  const laid = routes(things, [['t3', 't1'], ['t3', 't1']]);
  for (const route of laid) holds(route, things);
  // counted by the geometry, apart from the code: two stretches that cross strictly inside both
  const strict = (one, other) => stretches(one).reduce((n, [a, b]) => n + stretches(other).filter(([c, d]) => {
    const cols = a[1] === b[1], across = c[0] === d[0];
    if (cols !== across) return false;
    const [h, v] = cols ? [[a, b], [c, d]] : [[c, d], [a, b]];
    return v[0][0] > Math.min(h[0][0], h[1][0]) + 1e-9 && v[0][0] < Math.max(h[0][0], h[1][0]) - 1e-9 && h[0][1] > Math.min(v[0][1], v[1][1]) + 1e-9 && h[0][1] < Math.max(v[0][1], v[1][1]) - 1e-9;
  }).length, 0);
  assert.equal(strict(laid[1], laid[0]) <= laid[1].crosses, true, JSON.stringify(laid));
  assert.equal(strict(laid[1], laid[0]), 0, 'a lane beside was free');
  // and on random pictures: a route never crosses more, by the geometry, than it says
  fc.assert(fc.property(fc.array(fc.tuple(fc.integer({ min: 0, max: 6 }), fc.integer({ min: 0, max: 6 })), { minLength: 3, maxLength: 7 }), fc.array(fc.tuple(fc.nat(6), fc.nat(6)), { minLength: 2, maxLength: 8 }), (cells, pairs) => {
    const seen = new Set(), placed = [];
    for (const [i, j] of cells) if (!seen.has(`${i} ${j}`)) { seen.add(`${i} ${j}`); placed.push(thing(`t${placed.length}`, [i * 4.3, j * 3.7], [2.1, 1.7, 1])); }
    if (placed.length < 2) return;
    const links = pairs.map(([a, b]) => [placed[a % placed.length].name, placed[b % placed.length].name]).filter(([a, b]) => a !== b);
    const out = routes(placed, links).filter((r) => r.points);
    out.forEach((route, k) => { const crossed = out.slice(0, k).reduce((n, before) => n + strict(route, before), 0); assert.ok(crossed <= route.crosses, `${crossed} by the geometry, ${route.crosses} said: ${JSON.stringify([placed, links, k])}`); });
  }), { numRuns: 200 });
});

test('routes: a thing with thousands of places costs no more to search: the work allowed still ends it', () => {
  const things = [thing('B', [0, 0], [18000, 1, 1]), thing('C', [0, 3], [18000, 2, 1]), thing('D', [-2, 0], [2, 5, 1]), thing('E', [18000, 0], [2, 5, 1]), thing('A', [-10, 0], [4, 4, 1])];
  const began = performance.now(), laid = routes(things, Array.from({ length: 6 }, () => ['A', 'B']));
  assert.ok(performance.now() - began < 40_000, `${Math.round(performance.now() - began)} ms`);
  for (const route of laid) assert.ok(route.points === null ? Object.values(NO_ROUTE).includes(route.why) : route.points.length >= 2);
});

test('routes: options are {hides} or none; a name is told on one line; what `at` gives is the caller\'s own', () => {
  assert.throws(() => routes([thing('a', [0, 0])], [], 5), /routes takes its options as \{hides, keep\}, or none — not 5/);
  assert.throws(() => routes([thing('a', [0, 0])], [], [1]), /routes takes its options as \{hides, keep\}/);
  assert.deepEqual(routes([thing('a', [0, 0])], [], undefined), []);
  assert.equal(routeNote({ from: 'a\nb', to: 'c', points: null, why: 'x' }), 'a b to c: no route along the floor (x)');
  assert.equal(routeNote({ from: 'a', to: 'b', points: [[0, 0], [1, 0]], bends: 0, behind: ['lo gs'], crosses: 0, shared: 0 }), 'a to b: passes behind lo gs');
  const way = rounded([[0, 0], [100, 0], [100, 80]], 20), end = way.at(1);
  end[0] = 999;
  assert.deepEqual(way.pieces.at(-1).to, [100, 80]);
  assert.deepEqual(way.at(1), [100, 80]);
});

test('routes: unseen says where along its way a route is hidden — nowhere when nothing hides it, and inside its length', () => {
  const open = routes([thing('a', [0, 4]), thing('b', [5, 1])], [['a', 'b']])[0];
  assert.deepEqual(open.unseen, []);
  const walled = [thing('a', [0, 4]), thing('b', [8, 4]), thing('wall', [4, 5.5], [2, 40, 2])];
  const [hidden] = routes(walled, [['a', 'b']]);
  assert.ok(hidden.unseen.length >= 1);
  // each stretch is inside the way, in order, apart from the next — and a point in its middle is hidden by a thing, asked apart from the code
  const at = (far) => { let left = far; for (const [p, q] of stretches(hidden)) { const run = Math.abs(q[0] - p[0]) + Math.abs(q[1] - p[1]); if (left <= run) return [p[0] + (q[0] - p[0]) * left / run, p[1] + (q[1] - p[1]) * left / run]; left -= run; } return hidden.points.at(-1); };
  let before = 0;
  for (const [from, to] of hidden.unseen) {
    assert.ok(from > before - (before ? 0 : 1) && to > from && to <= hidden.tiles + 1e-9, `${from}–${to} of ${hidden.tiles}`);   // apart from the one before: two that touch are one
    assert.ok(walled.some((t) => hides(at((from + to) / 2), t, 0, MAYBE)), `the middle of ${from}–${to} is hidden`);
    before = to;
  }
  // one picture worked by hand. The way runs along row 1 from col -4, in a lane between a low fence behind it and a wall in front
  // (cols 5 to 7, from row 1.75, a tile high). A thing hides the floor behind it for 1.22 tiles of each tile of its height, so on
  // row 1 the wall hides cols 3.78 to 6.25: 7.78 to 10.25 tiles along the way. One stretch, right to the nearest half step (0.25).
  const [by] = routes([thing('a', [-6, 0]), thing('b', [12, 0]), thing('wall', [5, 1.75], [2, 40, 1]), thing('fence', [-2, -6], [12, 6.75, 0.1])], [['a', 'b']]);
  assert.deepEqual(by.points.slice(0, 2), [[-4, 1], [11, 1]]);
  assert.deepEqual(by.behind, ['wall']);
  assert.deepEqual(by.unseen, [[7.75, 10.25]]);
  // on random pictures: hidden somewhere exactly when something is named
  fc.assert(fc.property(fc.array(fc.tuple(fc.integer({ min: 0, max: 5 }), fc.integer({ min: 0, max: 5 }), fc.integer({ min: 0, max: 4 })), { minLength: 2, maxLength: 7 }), (cells) => {
    const seen = new Set(), things = [];
    for (const [i, j, h] of cells) if (!seen.has(`${i} ${j}`)) { seen.add(`${i} ${j}`); things.push(thing(`t${things.length}`, [i * 4, j * 4], [2, 2, h / 2])); }
    if (things.length < 2) return;
    for (const route of routes(things, things.slice(1).map((t, k) => [things[k].name, t.name]))) assert.equal(route.unseen.length > 0, route.behind.length > 0, JSON.stringify(route));
  }), { numRuns: 150 });
});

test('gridFor: also — the picture holds the floor points given too, so a link that runs round the things is not cut off', () => {
  const things = [{ at: [0, 0], size: [2, 2, 1] }, { at: [5, -3], size: [2, 2, 1] }], box = [100, 100, 1820, 980];
  const alone = gridFor(things, box), also = [[0, 20], [30, 0], [4, 4, 2]], held = gridFor(things, box, { also });
  assert.ok(held.tile[0] < alone.tile[0]);
  // a point over the things' own floor that reaches past them only by its height
  const high = gridFor(things, box, { also: [[2, -1, 40]] }), top = high.at(2, -1, 40);
  assert.ok(high.tile[0] < alone.tile[0] && top.y >= box[1] - 1e-6, `a point 40 tiles up is in the box: ${top.y}`);
  for (const [col, row, lift = 0] of also) { const { x, y } = held.at(col, row, lift); assert.ok(x >= box[0] - 1e-6 && x <= box[2] + 1e-6 && y >= box[1] - 1e-6 && y <= box[3] + 1e-6, `${[col, row]} lands at ${[x, y]}`); }
  for (const t of things) { const { box: b } = held.block(t); assert.ok(b.x >= box[0] - 1e-6 && b.x + b.w <= box[2] + 1e-6 && b.y >= box[1] - 1e-6 && b.y + b.h <= box[3] + 1e-6); }
  // points inside what the things already reach change nothing; none given is the grid it always was
  assert.deepEqual(gridFor(things, box, { also: [[1, 1], [6, -2]] }).tile, alone.tile);
  assert.deepEqual(gridFor(things, box, { also: [] }).origin, alone.origin);
  assert.deepEqual(gridFor(things, box, {}).origin, alone.origin);
  assert.throws(() => gridFor(things, box, { also: 'x' }), /also is the floor points the picture holds too/);
  assert.throws(() => gridFor(things, box, { also: [[1]] }), /point 1 of also is \[col, row\] on the floor/);
  assert.throws(() => gridFor(things, box, { also: Array.from({ length: MOST_ALSO + 1 }, () => [0, 0]) }), /at most 65536/);
});

test('wordsToFit: a name on one line, then two, then smaller — and it says when it cannot fit', () => {
  assert.deepEqual(wordsToFit('API', [173, 90]), { lines: ['API'], size: 26, fits: true });
  assert.deepEqual(wordsToFit('Load Balancer', [173, 90]), { lines: ['Load', 'Balancer'], size: 26, fits: true });          // two lines at full size before any shrinking
  assert.deepEqual(wordsToFit('Authentication Service', [173, 90]), { lines: ['Authentication', 'Service'], size: 20, fits: true });
  assert.deepEqual(wordsToFit('Supercalifragilisticexpialidocious', [173, 90]), { lines: ['Supercalifragilisticexpialidocious'], size: 16, fits: false });
  assert.deepEqual(wordsToFit('a b c d e f', [60, 90]).lines, ['a b c', 'd e f']);                                          // broken where the two lines are most alike
  assert.deepEqual(wordsToFit('a b c', [50, 90]).lines, ['a', 'b c']);                                                      // of two breaks alike, the earlier
  assert.deepEqual(wordsToFit('Load Balancer', [173, 40]), { lines: ['Load Balancer'], size: 22, fits: true });              // room for one line only: smaller, not broken
  assert.deepEqual(wordsToFit('  Load \n Balancer ', [400, 90]).lines, ['Load Balancer']);                                   // spaces are one space
  assert.deepEqual(wordsToFit('', [100, 50]), { lines: [], size: 26, fits: true });
  assert.deepEqual(wordsToFit('Queue', [100, 50], { size: 40, least: 10, letter: 0.5, line: 1 }), { lines: ['Queue'], size: 40, fits: true });
  assert.deepEqual(wordsToFit('Queue', [50, 50], null), { lines: ['Queue'], size: 16, fits: true });
  // the whole name comes back, however long: nothing is cut, so "fits" is never said of half a name
  const long = `${'a'.repeat(395)} Database`, far = wordsToFit(long, [1e5, 1e5]);
  assert.equal(far.lines.join(' '), long);
  assert.deepEqual(wordsToFit(`${' '.repeat(5000)}Payments`, [200, 70]), { lines: ['Payments'], size: 26, fits: true });
  assert.equal(wordsToFit(`Primary ${'x'.repeat(400)} Store`, [200, 70]).fits, false);
  assert.deepEqual(wordsToFit(`Primary ${'x'.repeat(400)} Store`, [200, 70]).lines, ['Primary', `${'x'.repeat(400)} Store`]);
  { const t0 = performance.now(), big = wordsToFit('ab '.repeat(300_000), [200, 70]); assert.equal(big.lines.join(' ').length, 899_999); assert.ok(performance.now() - t0 < 2000, 'a long name costs its length once'); }
  // a letter is what takes room: an accent written apart, a zero-width space and half of a pair count for none
  assert.equal(wordsToFit('e\u0301'.repeat(10), [170, 70]).fits, true);            // ten letters, twenty code units
  assert.deepEqual(wordsToFit('Data\u200Bbase', [8 * 0.6 * 26, 70]), { lines: ['Data\u200Bbase'], size: 26, fits: true });   // eight letters: the ninth character takes no room
  assert.equal(wordsToFit('\u{1F5C4}\u{1F5C4}', [2 * 0.6 * 26, 70]).size, 26);
  // a no-break space is the writer's word: the name is not broken there
  assert.deepEqual(wordsToFit('Load\u00A0Balancer', [173, 90]), { lines: ['Load\u00A0Balancer'], size: 22, fits: true });
});

test('wordsToFit: what fits does fit — every line inside the room at the size given (random names and rooms)', () => {
  fc.assert(fc.property(fc.array(fc.stringMatching(/^[a-z]{1,12}$/), { minLength: 1, maxLength: 6 }), fc.integer({ min: 20, max: 400 }), fc.integer({ min: 10, max: 200 }), (words, wide, high) => {
    const got = wordsToFit(words.join(' '), [wide, high]);
    assert.equal(got.lines.join(' '), words.join(' '));
    assert.ok(got.lines.length <= 2 && got.size >= 16 && got.size <= 26);
    if (got.fits) { for (const line of got.lines) assert.ok(line.length * 0.6 * got.size <= wide + 1e-9); assert.ok(got.lines.length * 1.15 * got.size <= high + 1e-9); }
    else assert.ok(got.size === 16 && (Math.max(...got.lines.map((l) => l.length)) * 0.6 * 16 > wide || got.lines.length * 1.15 * 16 > high));
  }), { numRuns: 300 });
});

test('wordsToFit: refuses what it cannot read, naming the fix', () => {
  assert.throws(() => wordsToFit(5, [10, 10]), /takes the words as text/);
  assert.throws(() => wordsToFit('a', [10]), /the room is \[wide, high\] in pixels/);
  assert.throws(() => wordsToFit('a', [0, 10]), /both above 0/);
  assert.throws(() => wordsToFit('a', [10, 10], 'big'), /takes its options as \{size, least, letter, line\}/);
  assert.throws(() => wordsToFit('a', [10, 10], { size: 10, least: 20 }), /least no more than size/);
  assert.throws(() => wordsToFit('a', [10, 10], { letter: 0 }), /letter and line above 0/);
  assert.throws(() => wordsToFit('a', [10, 10], { size: 2000 }), /from 1 to 1000/);
  assert.throws(() => wordsToFit('a', [10, 10], { size: 1e-300, least: 1e-300 }), /from 1 to 1000/);
  assert.throws(() => wordsToFit('a', [1e7, 10]), /no number further than 1000000 from 0/);
});

test('routes: saying where a route is hidden costs the search nothing — a very big picture lays what it laid before unseen', () => {
  // 60 things in ten cols, 600 links by a fixed rule: the work (MOST_WORK) runs out on the way. 0.11.0 laid 557 of them; 0.12.0,
  // which asked where a route is hidden in a second counted pass, laid 406.
  let seed = 7;
  const next = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const things = Array.from({ length: 60 }, (_, i) => thing(`t${i}`, [(i % 10) * 4, Math.floor(i / 10) * 4])), links = [], had = new Set();
  while (links.length < 600) { const a = Math.floor(next() * 60), b = Math.floor(next() * 60); if (a !== b && !had.has(`${a} ${b}`)) { had.add(`${a} ${b}`); links.push([`t${a}`, `t${b}`]); } }
  const got = routes(things, links);
  assert.equal(got.filter((route) => route.points).length, 557);
  assert.equal(got.filter((route) => route.why === NO_ROUTE.work).length, 43);
});

test('room: the widest upright box on a top face — inside the top, and nothing wider is', () => {
  const grid = isometric({ tile: 96 }), on = (size, more = {}) => thing('a', [0, 0], size, more);
  assert.equal(grid.room(on([2, 2, 1])), 192);            // a square top: as wide across its middle as the block's box
  assert.equal(grid.room(on([8, 1, 0.2])), 96);           // a long thin one: as wide as its SHORT side, not 432
  assert.equal(grid.room(on([1, 8, 0.2])), 96);
  assert.equal(grid.room(on([2, 2, 1]), 30), 132);        // and narrower away from the middle: 2 px for each px of height
  assert.equal(grid.room(on([2, 2, 1]), 500), 0);
  assert.equal(grid.room(on([2, 2, 1], { round: true }), 500), 0);
  assert.ok(grid.room(on([2, 2, 1], { round: true })) < grid.room(on([2, 2, 1])));                 // a round top is inside the square one
  assert.throws(() => grid.room(on([2, 2, 1]), -1), /room\(thing, high\) takes how tall the words stand/);
  assert.throws(() => grid.room(on([2, 2, 1]), 'x'), /room\(thing, high\) takes how tall the words stand/);
  assert.throws(() => grid.room(on([2, 2, 1]), 1e9), /from 0 to 1000000/);
  assert.throws(() => grid.room(on([2, 3, 1], { round: true })), /a round thing has the same width and depth/);
  assert.throws(() => grid.room(on([2, 2, 1], { round: 'yes' })), /round says whether it is a round thing/);
  assert.throws(() => grid.room('a'), /a thing is \{at/);
  // what the grid gives of a thing is plain data still: it can be cloned, and kept in a record
  for (const drawn of [grid.block(on([2, 2, 1])), grid.cylinder(on([2, 2, 1]))]) assert.deepEqual(structuredClone(drawn), drawn);
  // asked apart from the code: a point is on a block's top when, taken back to the floor, it is on the block's tiles; on a round top when it is in the ellipse
  fc.assert(fc.property(fc.integer({ min: 1, max: 9 }), fc.integer({ min: 1, max: 9 }), fc.integer({ min: 0, max: 400 }), fc.constantFrom(96, 120, [100, 40]), fc.boolean(), (wide, deep, tall, tile, round) => {
    const g = isometric({ tile }), t = thing('a', [3, -2], [wide, round ? wide : deep, 1.5], round ? { round } : {}), drawn = round ? g.cylinder(t) : g.block(t), room = g.room(t, tall), { x, y } = drawn.centre;
    const onTop = ([px, py]) => {
      if (round) return ((px - drawn.top.cx) / drawn.top.rx) ** 2 + ((py - drawn.top.cy) / drawn.top.ry) ** 2 <= 1 + 1e-9;
      const { col, row } = g.tileAt(px, py + 1.5 * g.rise);   // the top is the floor's tiles, raised
      return col >= 3 - 1e-9 && col <= 3 + wide + 1e-9 && row >= -2 - 1e-9 && row <= -2 + deep + 1e-9;
    };
    const corners = (w) => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([i, j]) => [x + i * w / 2, y + j * tall / 2]);
    if (room > 0) assert.ok(corners(room).every(onTop), `a box ${room} by ${tall} is on the top of ${[wide, deep]}`);
    assert.ok(!corners(room + 0.2).every(onTop), `a box ${room + 0.2} by ${tall} is not`);
  }), { numRuns: 500 });
});

test('wordsToFit: on a face that narrows, each line is measured across its own middle', () => {
  const grid = isometric({ tile: 96 }), room = (size) => (high) => grid.room(thing('a', [0, 0], size), high), square = room([2, 2, 1]), thin = room([8, 1, 0.2]);
  assert.deepEqual(wordsToFit('API', square), { lines: ['API'], size: 26, fits: true });
  // two lines stand apart, where the top is narrower: 'Balancer' is 124.8 px at 26, and the top is 132.2 there less the margin (119) — a pixel smaller fits
  assert.deepEqual(wordsToFit('Load Balancer', (high) => 0.9 * square(high)), { lines: ['Load', 'Balancer'], size: 25, fits: true });
  assert.deepEqual(wordsToFit('Load Balancer', square), { lines: ['Load', 'Balancer'], size: 26, fits: true });
  // a long thin block: the name that the rectangle round its top (432 px) would hold on one line does not fit its top at all
  assert.deepEqual(wordsToFit('Authentication Service', thin), { lines: ['Authentication', 'Service'], size: 16, fits: false });
  assert.deepEqual(wordsToFit('DB', thin), { lines: ['DB'], size: 26, fits: true });
  // words exactly as wide as the room fit it: ten letters at 20 px are 120 px
  assert.deepEqual(wordsToFit('abcdefghij', () => 120, { size: 20, least: 20 }), { lines: ['abcdefghij'], size: 20, fits: true });
  assert.equal(wordsToFit('abcdefghij', () => 119.99, { size: 20, least: 20 }).fits, false);
  // what the function gives is read as a width: no finite number above 0 is no room, and nothing it gives stops the fitting
  for (const none of [() => NaN, () => -5, () => 'wide', () => undefined, () => null, () => Infinity, () => 10n, () => ({ valueOf: () => 500 })]) assert.deepEqual(wordsToFit('API', none), { lines: ['API'], size: 16, fits: false });
  assert.equal(wordsToFit('API', () => 1e300).fits, true);                                  // a huge room is a million: still a room
  assert.throws(() => wordsToFit('API', () => { throw new Error('the caller\'s own'); }), /the caller's own/);
  const asked = []; wordsToFit('Load Balancer', (high) => { asked.push(high); return 0; }, { size: 20, least: 19, line: 1 });
  assert.deepEqual(asked, [0, 20, 0, 19]);                                                 // 0 for one line, one line's height for two
  // a box is measured as it always was
  assert.deepEqual(wordsToFit('Load Balancer', [173, 90]), { lines: ['Load', 'Balancer'], size: 26, fits: true });
});

test('routes: behind names what hides a route in the order the things were given, wherever along the way each hides it', () => {
  // the way from a meets wall2's shadow first and wall1's after: behind is still [wall1, wall2], the order of the things
  const things = [thing('a', [-6, 0]), thing('b', [20, 0]), thing('wall1', [13, 1.75], [2, 40, 1]), thing('wall2', [5, 1.75], [2, 40, 1]), thing('fence', [-2, -6], [20, 6.75, 0.1])];
  const [route] = routes(things, [['a', 'b']]);
  assert.deepEqual(route.behind, ['wall1', 'wall2']);
  assert.equal(route.unseen.length, 2);
  assert.ok(route.unseen[0][1] < route.unseen[1][0]);
});

test('ports: a route leaves a port straight out of its side, drops to the floor, and comes up into the other port — the line ends on the port', () => {
  const things = [thing('lap', [0, 4], [2, 2, 0.4], { ports: [{ name: 'rj45', at: [2, 0.7, 0.2] }] }), thing('sw', [6, 4], [4.7, 2, 0.4], { ports: [{ name: 'p1', at: [0.4, 2, 0.3] }, { name: 'p3', at: [1.5, 2, 0.3], face: 'left' }, { name: 'up', at: [2, 0, 0.3] }, { name: 'low', at: [0, 1, 0] }] }), thing('router', [6, 0])];
  const [route] = routes(things, [[{ thing: 'lap', port: 'rj45' }, { thing: 'sw', port: 'p1' }]]);
  // its first point is the port, at the port's height; then a quarter tile out of the side; then the floor; the last point is the other port
  assert.deepEqual(route.path.slice(0, 3), [[2, 4.7, 0.2], [2.25, 4.7, 0.2], [2.25, 4.7, 0]]);
  assert.deepEqual(route.path.slice(-3), [[6.4, 6.25, 0], [6.4, 6.25, 0.3], [6.4, 6, 0.3]]);
  assert.deepEqual(route.ports, ['rj45', 'p1']);
  assert.deepEqual(route.feet, ['right', 'left']);
  assert.deepEqual(route.points[0], [2.25, 4.7]);                                                     // the floor run starts under the port's way out
  assert.equal(route.behind.length, 0);
  // a port on a lattice line runs straight out to it: no jog (p3 at col 7.5), and the side was checked when named
  const [straight] = routes(things, [[{ thing: 'sw', port: 'p3' }, 'router']]);
  assert.deepEqual(straight.points.slice(0, 2), [[7.5, 6.25], [7.5, 6.5]]);
  // a port at floor height has no riser: from the port along the floor
  const [low] = routes(things, [[{ thing: 'sw', port: 'low' }, 'lap']]);
  assert.deepEqual(low.path.slice(0, 2), [[6, 5, 0], [5.75, 5, 0]]);
  assert.equal(low.feet[0], 'back-left');
  // a port on a back side is allowed: its thing is between it and the viewer, and the route says so
  const [back] = routes(things, [[{ thing: 'sw', port: 'up' }, 'router']]);
  assert.equal(back.feet[0], 'back-right');
  assert.ok(back.behind.includes('sw'));
  assert.ok(back.unseen.length && back.unseen[0][0] === 0);
  // an end that names no port of its thing, a port to a port of the same thing, and a way out under another thing
  assert.equal(routes(things, [[{ thing: 'lap', port: 'nope' }, 'sw']])[0].why, NO_ROUTE.portName);
  assert.equal(routes(things, [[{ thing: 'sw', port: 'p1' }, { thing: 'sw', port: 'p3' }]])[0].why, NO_ROUTE.self);
  const walled = [thing('a', [0, 0], [2, 2, 1], { ports: [{ name: 'p', at: [2, 1, 0.5] }] }), thing('wall', [2.1, -3], [0.1, 8, 1]), thing('b', [6, 0])];
  assert.equal(routes(walled, [[{ thing: 'a', port: 'p' }, 'b']])[0].why, NO_ROUTE.port);   // a thin wall just in front of the side: the lattice point is open, the run out is not
  // the same wall with a thing far off: the lattice is made coarser than the finest step, and the run out to its first line
  // is then too long to miss the wall — the things stand too far apart, as a foot would say, not a port closed in
  const far = routes([...walled, thing('far', [20000, 20000])], [[{ thing: 'a', port: 'p' }, 'b'], ['b', { thing: 'a', port: 'p' }]]);
  assert.deepEqual(far.map((r) => r.why), [NO_ROUTE.wide, NO_ROUTE.wide]);
  // the same things and links always give the same ways; two links on one port share it, and say so
  assert.deepEqual(routes(things, [[{ thing: 'lap', port: 'rj45' }, { thing: 'sw', port: 'p1' }]]), routes(things, [[{ thing: 'lap', port: 'rj45' }, { thing: 'sw', port: 'p1' }]]));
  const twice = routes(things, [[{ thing: 'sw', port: 'p3' }, 'router'], [{ thing: 'sw', port: 'p3' }, 'lap']]);
  assert.ok(twice[1].shared > 0);
});

test('ports are read as given and refused in words: a side read from the point, a wrong side, a corner, the top, a round thing', () => {
  const at = (port, size = [2, 2, 1], more = {}) => routes([thing('a', [0, 0], size, { ports: [port], ...more }), thing('b', [6, 0])], [[{ thing: 'a', port: port?.name ?? 'p' }, 'b']]);
  assert.equal(at({ name: 'p', at: [1, 2, 0.5] })[0].feet[0], 'left');
  assert.equal(at({ name: 'p', at: [2, 1, 0.5] })[0].feet[0], 'right');
  assert.throws(() => at({ name: 'p', at: [1, 2, 0.5], face: 'front' }), /the face "front": a side is right, left, back-left, back-right/);
  assert.throws(() => at({ name: 'p', at: [1, 2, 0.5], face: 'right' }), /on the left side, not right: write face left, or move the point/);
  assert.throws(() => at({ name: 'p', at: [2, 2, 0.5] }), /a corner \(the right and left sides\): say which with its face/);
  assert.equal(at({ name: 'p', at: [2, 2, 0.5], face: 'right' })[0].feet[0], 'right');
  assert.throws(() => at({ name: 'p', at: [1, 1, 1], face: 'top' }), /on the top, and a port on the top is not routed yet/);
  assert.throws(() => at({ name: 'p', at: [1, 1, 0.5] }), /on no side of "a"/);
  assert.throws(() => at({ name: 'p', at: [3, 1, 0.5] }), /outside "a"/);
  assert.throws(() => at({ name: 'p', at: [1, 2] }), /is at \[x, y, z\]/);
  assert.throws(() => at({ name: '', at: [1, 2, 0] }), /has a name, some text/);
  assert.throws(() => routes([thing('a', [0, 0], [2, 2, 1], { ports: [{ name: 'p', at: [1, 2, 0] }, { name: 'p', at: [2, 1, 0] }] })], []), /two ports named "p"/);
  assert.throws(() => routes([thing('a', [0, 0], [2, 2, 1], { round: true, ports: [{ name: 'p', at: [1, 2, 0] }] })], []), /is round, and a round thing has no ports yet/);
  assert.throws(() => routes([thing('a', [0, 0], [2, 2, 1], { ports: 'p1' })], []), /ports are a list of at most 64/);
  assert.throws(() => routes([thing('a', [0, 0])], [[{ thing: 'a' }, 'a']]), /each the name of a thing or \{thing, port\}/);
  // the same reading, for a tool to refuse in its own words
  assert.deepEqual(readPorts([{ name: 'p', at: [1, 2, 0.5] }], [2, 2, 1], false, 'the switch'), [{ name: 'p', at: [1, 2, 0.5], face: 'left', seen: true }]);
  assert.deepEqual(readPorts(undefined, [2, 2, 1], false, 'x'), []);
  assert.throws(() => readPorts([{ name: 'p', at: [1, 1, 0.5] }], [2, 2, 1], false, 'the switch'), /^Error: isometric: the switch's port "p" is at \[1,1,0.5\], on no side of the switch/);
});

test('ports: a route never crosses a port\'s run out between two lattice points, and a lane beside a port is shared only when said', () => {
  // two ports a tenth of a tile apart on one side: the second takes the lane beside the first, or says it shares it
  const sw = thing('sw', [0, 0], [2, 2, 1], { ports: [{ name: 'a', at: [2, 0.6, 0.5] }, { name: 'b', at: [2, 0.7, 0.5] }] }), far = thing('far', [6, -3]);
  const [one, two] = routes([sw, far], [[{ thing: 'sw', port: 'a' }, 'far'], [{ thing: 'sw', port: 'b' }, 'far']]);
  const segs = (r) => r.points.slice(1).map((p, i) => [r.points[i], p]);
  const along = ([p, q], [s, t]) => { const k = p[1] === q[1] && s[1] === t[1] && p[1] === s[1] ? 0 : p[0] === q[0] && s[0] === t[0] && p[0] === s[0] ? 1 : -1; return k < 0 ? 0 : Math.max(0, Math.min(Math.max(p[k], q[k]), Math.max(s[k], t[k])) - Math.max(Math.min(p[k], q[k]), Math.min(s[k], t[k]))); };
  const overlap = segs(two).reduce((n, s) => n + segs(one).reduce((m, t) => m + along(s, t), 0), 0);
  assert.ok(overlap === 0 || two.shared > 0, `overlaps ${overlap} and shares ${two.shared}`);
  // the reviewer's picture: a route came back along a line between a port's floor point and its lattice line, under its own run out
  const t0 = { name: 't0', at: [6.41, 6.25, 1.3], size: [1.3, 1.5, 0] }, t2 = { name: 't2', at: [9.7, 7.65, 1.3], size: [0.6, 0.3, 2] };
  const t3 = { name: 't3', at: [13, 10.1, 1.3], size: [0.3, 0.3, 2], ports: [{ name: 'p0', at: [0.031344841003417966, 0.3, 0.27677] }, { name: 'p1', at: [0.05403267288208007, 0.3, 0.71292] }] }, t5 = { name: 't5', at: [1.14, 12.9, 1.3], size: [4.7, 1.5, 0] };
  const laid = routes([t0, t2, t3, t5], [[{ thing: 't3', port: 'p1' }, 't5'], ['t0', { thing: 't3', port: 'p0' }]]);
  const runs = laid.flatMap((r) => [r.ports[0] && r.points.slice(0, 2), r.ports[1] && r.points.slice(-2)]).filter(Boolean);
  const across = ([a, b], [c, d]) => { const h = a[1] === b[1]; if (h === (c[1] === d[1])) return false; const [H, V] = h ? [[a, b], [c, d]] : [[c, d], [a, b]]; const y = H[0][1], x = V[0][0]; return x > Math.min(H[0][0], H[1][0]) + 1e-9 && x < Math.max(H[0][0], H[1][0]) - 1e-9 && y > Math.min(V[0][1], V[1][1]) + 1e-9 && y < Math.max(V[0][1], V[1][1]) - 1e-9; };
  for (const r of laid.filter((x) => x.points)) for (const s of segs(r)) for (const lead of runs) assert.ok(!across(s, lead), `${r.from} to ${r.to} crosses a port's run out at ${JSON.stringify(s)}`);
});

test('ports: a back port names its own thing, wherever its floor is in view; a billionth is no step', () => {
  const a = thing('a', [0, 0], [2, 2, 2], { ports: [{ name: 'corner', at: [1.9, 0, 1] }, { name: 'low', at: [1, 0, 0.1] }, { name: 'near', at: [2, 1 + 1e-10, 0.5] }, { name: 'flat', at: [2, 1.5, 1e-10] }] }), b = thing('b', [6, -4]);
  for (const port of ['corner', 'low']) assert.ok(routes([a, b], [[{ thing: 'a', port }, 'b']])[0].behind.includes('a'), port);
  // a port a ten-billionth off a lattice line is on it: no jog, the bends of the port on it
  const [on] = routes([a, b], [[{ thing: 'a', port: 'near' }, 'b']]), [exact] = routes([{ ...a, ports: [{ name: 'near', at: [2, 1, 0.5] }] }, b], [[{ thing: 'a', port: 'near' }, 'b']]);
  assert.deepEqual(on.points, exact.points);
  assert.deepEqual(on.path, exact.path);
  // and a port a ten-billionth above the floor has no riser: every step of the path moves along one axis
  const [flat] = routes([a, b], [[{ thing: 'a', port: 'flat' }, 'b']]);
  for (let k = 1; k < flat.path.length; k += 1) assert.equal([0, 1, 2].filter((i) => flat.path[k][i] !== flat.path[k - 1][i]).length, 1, JSON.stringify(flat.path));
  // the jog's way out is checked too: a thin bar on the line in front, beside the port's line, refuses it
  const barred = routes([thing('a', [0, 0], [2, 2, 1], { ports: [{ name: 'p', at: [2, 1.01, 0.5] }] }), thing('bar', [2.45, 1.03], [0.1, 0.02, 1]), thing('b', [6, 0])], [[{ thing: 'a', port: 'p' }, 'b']]);
  assert.equal(barred[0].why, NO_ROUTE.port);
  // readPorts checks what it is given
  assert.throws(() => readPorts([], undefined, false, 'x'), /x's size is \[wide, deep, high\]/);
  assert.throws(() => readPorts([], [NaN, 1, 1], false, 'x'), /x's size is \[wide, deep, high\]/);
  assert.throws(() => readPorts([], [1, 1, 1], 'no', 'x'), /x's round says whether it is round/);
  assert.throws(() => readPorts([], [1, 1, 1], false, 5), /readPorts names the thing it reads, as text/);
});

test('ports: crossings at a back-left end are counted once, a later port\'s run across an earlier route is counted, a reused port does not hook across its own run', () => {
  // a port's run laid after a route that runs across its way out: it cannot go round, so it says so
  const t0 = { name: 't0', at: [6.9, 4.1], size: [1, 1, 0], ports: [{ name: 'p0', at: [0.3641762542724609, 1, 0] }, { name: 'p2', at: [0.44620361328125, 1, 0], face: 'left' }] };
  const t1 = { name: 't1', at: [7, 0.3], size: [1.9, 1, 0.5], ports: [{ name: 'p0', at: [1.1031759757995605, 0, 0.1777] }, { name: 'p2', at: [1.9, 0.16422142028808592, 0.1253] }] };
  const [first, second] = routes([t0, t1], [[{ thing: 't1', port: 'p0' }, { thing: 't0', port: 'p0' }], [{ thing: 't1', port: 'p2' }, { thing: 't0', port: 'p2' }]]);
  const segs = (r) => r.points.slice(1).map((p, i) => [r.points[i], p]);
  const across = ([a, b], [c, d]) => { const h = a[1] === b[1]; if (h === (c[1] === d[1])) return false; const [H, V] = h ? [[a, b], [c, d]] : [[c, d], [a, b]]; const y = H[0][1], x = V[0][0]; return x > Math.min(H[0][0], H[1][0]) - 1e-9 && x < Math.max(H[0][0], H[1][0]) + 1e-9 && y > Math.min(V[0][1], V[1][1]) - 1e-9 && y < Math.max(V[0][1], V[1][1]) + 1e-9; };
  const met = segs(second).reduce((n, s) => n + segs(first).filter((t) => across(s, t)).length, 0);
  assert.ok(second.crosses >= Math.min(1, met), `meets the first ${met} times and says it crosses ${second.crosses}`);
  // a port on a lattice line used three times: the third does not come back across its own run out
  const a = { name: 't0', at: [1, 5.76, 1.3], size: [2.7, 1.3, 2], ports: [{ name: 'p0', at: [0.5, 0, 1.8] }] }, b = { name: 't1', at: [8, 2.5, 1.3], size: [2.7, 1.9, 1] };
  const laid = routes([a, b], [['t1', { thing: 't0', port: 'p0' }], ['t1', { thing: 't0', port: 'p0' }], [{ thing: 't0', port: 'p0' }, 't1']]);
  for (const r of laid.filter((x) => x.points)) {
    const run = r.ports[0] ? r.points.slice(0, 2) : r.points.slice(-2), rest = r.ports[0] ? segs(r).slice(1) : segs(r).slice(0, -1);
    const node = r.ports[0] ? run[1] : run[0];   // where the run meets the lattice: a route touches its run there
    for (const s of rest) assert.ok(!across(s, run) || s.some((p) => p[0] === node[0] && p[1] === node[1]), `${JSON.stringify(r.points)} hooks across its own run`);
  }
  // a back-left end: a crossing at its last lattice point is counted once whether the route comes straight in or turns in
  const left = { name: 'L', at: [6, 0], size: [2, 2, 1], ports: [{ name: 'in', at: [0, 1, 0.5] }] }, src = thing('S', [0, 0]), cut = thing('C', [3, -4]), low = thing('D', [3, 4]);
  const [, through] = routes([left, src, cut, low], [['C', 'D'], ['S', { thing: 'L', port: 'in' }]]);
  assert.ok(through.crosses <= 1, `counts ${through.crosses}`);
});

// Floor kept clear (`keep`): words that float over the picture, a cable goes round them where it can.
test('keep: a route goes round floor kept clear where there is a way, and says nothing', () => {
  const things = [thing('a', [0, 0]), thing('b', [8, 0])];
  const plain = routes(things, [['a', 'b']])[0];
  assert.ok(!('under' in plain));   // no keep, no word of it: every route without one is as before
  const keep = [{ name: 'label', at: [4, 2], size: [1, 1] }];
  const r = routes(things, [['a', 'b']], { keep })[0];
  assert.deepEqual(r.under, []);
  // no point of it inside the kept floor
  for (const [p, q] of stretches(r)) for (let t = 0; t <= 1; t += 0.05) {
    const x = p[0] + (q[0] - p[0]) * t, y = p[1] + (q[1] - p[1]) * t;
    assert.ok(!(x > 4 && x < 5 && y > 2 && y < 3), `${x} ${y}`);   // strictly inside: along its edge is not under it
  }
  assert.notDeepEqual(r.points, plain.points);
});

test('keep: where there is no way round, the route runs over the kept floor and names it (a name, or its number from 1)', () => {
  const things = [thing('a', [0, 0]), thing('b', [8, 0])];
  const r = routes(things, [['a', 'b']], { keep: [{ at: [20, 20], size: [1, 1] }, { name: 'wall', at: [4, -5], size: [1, 12] }, { at: [6, -5], size: [0.5, 12] }] })[0];
  assert.deepEqual(r.points, routes(things, [['a', 'b']])[0].points);
  assert.deepEqual(r.under, ['wall', 3]);
});

test('keep: kept floor is no thing — it never changes the lattice, so a route far from it lies as before', () => {
  const things = [thing('a', [0, 0], [3, 3, 1]), thing('b', [7, 4], [3, 3, 1])];
  const links = [['a', 'b'], ['a', 'b'], ['a', 'b']];
  const plain = routes(things, links), far = routes(things, links, { keep: [{ at: [40, 40], size: [0.1, 0.1] }] });
  assert.deepEqual(far.map((r) => r.points), plain.map((r) => r.points));
  assert.deepEqual(far.map((r) => r.under), [[], [], []]);
});

test('keep: kept floor is asked at its own height', () => {
  const things = [thing('a', [0, 0, 1]), thing('b', [8, 0, 1])];
  const at0 = routes(things, [['a', 'b']], { keep: [{ name: 'low', at: [4, -5], size: [1, 12] }] })[0];
  const at1 = routes(things, [['a', 'b']], { keep: [{ name: 'high', at: [4, -5, 1], size: [1, 12] }] })[0];
  assert.deepEqual(at0.under, []);
  assert.deepEqual(at1.under, ['high']);
});

test('keep: under is said by the floor the drawn way crosses — an area thinner than a step, a foot\'s run, a port\'s lead, every one of overlapping areas', () => {
  const things = [thing('a', [0, 0]), thing('b', [8, 0])];
  const under = (keep, more = things, links = [['a', 'b']]) => routes(more, links, { keep })[0].under;
  // thinner than the lattice's step, holding no point of it: the walled way crosses it, and says so
  assert.deepEqual(under([{ name: 'thin', at: [4.1, -6], size: [0.3, 14] }]), ['thin']);
  // with a way round, it is gone round (the search pays for the stretches that cross it, not only the points in it)
  assert.deepEqual(under([{ name: 'short', at: [4.1, -1], size: [0.3, 4] }]), []);
  // in front of a foot, before the first lattice line
  assert.deepEqual(under([{ name: 'front', at: [1.6, 2.05], size: [14, 0.3] }]), ['front']);
  // a port's lead off the lattice
  const ported = [thing('a', [0, 0], [2, 2, 1], { ports: [{ name: 'p', at: [2, 0.7, 0.5] }] }), thing('b', [8, 0])];
  assert.deepEqual(routes(ported, [[{ thing: 'a', port: 'p' }, 'b']], { keep: [{ name: 'jog', at: [2.05, 0.55], size: [0.4, 0.3] }, { name: 'wall', at: [4, -6], size: [1, 14] }] })[0].under, ['jog', 'wall']);
  // overlapping areas: each is named, in the order given
  assert.deepEqual(under([{ name: 'outer', at: [3.9, -6], size: [1.2, 14] }, { name: 'inner', at: [4, -6], size: [1, 14] }, { name: 'same', at: [4, -6], size: [1, 14] }]), ['outer', 'inner', 'same']);
  // a keep that names nothing near still says under: given keep, there is always an answer
  assert.deepEqual(under([]), []);
});

test('keep: a foot\'s run and a port\'s floor quarter tile are paid for and said', () => {
  const things = [thing('a', [0, 0]), thing('b', [8, 0])];
  const plain = routes(things, [['a', 'b']])[0];
  assert.equal(plain.feet[0], 'left');
  // floor kept clear in front of the left foot, before the first lattice line: the route leaves by the other foot
  const r = routes(things, [['a', 'b']], { keep: [{ name: 'front', at: [0.1, 2.02], size: [1.8, 0.3] }] })[0];
  assert.equal(r.feet[0], 'right');
  assert.deepEqual(r.under, []);
  // a port at floor height: its quarter tile from the plug lies on the floor, and is said
  const ported = [thing('a', [0, 0], [2, 2, 1], { ports: [{ name: 'p', at: [2, 0.7, 0] }] }), thing('b', [8, 0])];
  assert.deepEqual(routes(ported, [[{ thing: 'a', port: 'p' }, 'b']], { keep: [{ name: 'stub', at: [2.02, -6], size: [0.15, 14] }] })[0].under, ['stub']);
  // kept floor at another height is not marked on this one: the route lies as it would with none
  const high = [thing('a', [0, 0, 1]), thing('b', [8, 0, 1])];
  assert.deepEqual(routes(high, [['a', 'b']], { keep: [{ at: [4, 2.2], size: [1, 1] }] })[0].points, routes(high, [['a', 'b']])[0].points);
});

test('keep: however many areas and however they overlap, the links are still laid', () => {
  const things = [thing('a', [0, 0]), thing('b', [300, 0]), thing('c', [0, 300]), thing('d', [300, 300])];
  const keep = Array.from({ length: 512 }, () => ({ at: [-10, -10], size: [320, 320] }));
  const laid = routes(things, [['a', 'b'], ['c', 'd'], ['a', 'c']], { keep });
  for (const r of laid) assert.ok(r.points, r.why);
  for (const r of laid) assert.equal(r.under.length, 512);
});

test('keep: refused in words when it is not floor', () => {
  const things = [thing('a', [0, 0]), thing('b', [8, 0])];
  const bad = (keep, message) => assert.throws(() => routes(things, [['a', 'b']], { keep }), (e) => e.message.includes(message), JSON.stringify(keep));
  bad('x', 'keep is a list of floor kept clear');
  bad([{ at: [0, 0], size: [0, 1] }], "keep 1's size is [wide, deep], in tiles, each above 0 and no more than 1000000 — not [0,1]");
  bad([{ at: [0, 0], size: [1, 1, 1] }], "keep 1's size is [wide, deep]");
  bad([{ at: [0, 0], size: [NaN, 1] }], 'not [NaN,1]');
  bad([{ at: [0, 0], size: [2e6, 1] }], "keep 1's size is [wide, deep], in tiles, each above 0 and no more than 1000000 — not [2000000,1]");
  // read by its own stored fields: a hole is refused, a getter never runs
  bad([, { at: [0, 0], size: [1, 1] }], 'keep 1 is {at: [col, row, lift?], size: [wide, deep], name?} — not undefined');
  let ran = false;
  const sly = [];
  Object.defineProperty(sly, 0, { get() { ran = true; return { at: [0, 0], size: [1, 1] }; }, enumerable: true });
  assert.throws(() => routes(things, [['a', 'b']], { keep: sly }), /keep 1 is/);
  assert.equal(ran, false);
  bad([{ at: [0, 0], size: [1, 1], name: '' }], 'keep 1 has a name');
  bad([{ at: ['a', 0], size: [1, 1] }], 'keep 1');
  bad(Array.from({ length: 513 }, () => ({ at: [0, 0], size: [1, 1] })), 'keep names at most 512 stretches of floor, not 513');
  assert.throws(() => routes(things, [['a', 'b']], []), /routes takes its options as \{hides, keep\}, or none/);
});

test('keep: the work is counted — floor kept clear everywhere gives a reason, never a hang', () => {
  const things = [thing('a', [0, 0]), thing('b', [900, 900])];
  const keep = Array.from({ length: 512 }, () => ({ at: [-50, -50], size: [1100, 1100] }));
  const t0 = Date.now(), [r] = routes(things, [['a', 'b']], { keep });
  assert.ok(Date.now() - t0 < 50_000);
  assert.ok(r.points === null ? r.why === NO_ROUTE.work || r.why === NO_ROUTE.wide : Array.isArray(r.under));
});
