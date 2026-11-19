// Routes and rounded ways: the way a link runs along the floor, and what it is drawn as. Checked against what a route
// must always hold — it starts and ends on a foot that is seen, runs along the tile lines, passes under nothing, shares
// no stretch with another — by tests written apart from the code, on blocks standing every way round each other.
import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { arrange, routes, routeNote, rounded, MOST_ROUTES, MOST_WORK, NO_ROUTE, MOST_ISOMETRIC_THINGS } from '../isometric.js';

const thing = (name, at, size = [2, 2, 1], more = {}) => ({ name, at, size, ...more });
const HIDES = Math.sqrt(1.5);
/** The stretches of a route: [[from, to], …]. */
const stretches = (route) => route.points.slice(1).map((p, k) => [route.points[k], p]);
/** Points along a route, a twentieth of a tile apart (its two ends left out: they are on a foot). */
const along = (route) => stretches(route).flatMap(([a, b]) => { const n = Math.max(1, Math.round((Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1])) * 20)); return Array.from({ length: n - 1 }, (_, k) => [a[0] + (b[0] - a[0]) * (k + 1) / n, a[1] + (b[1] - a[1]) * (k + 1) / n]); });
const under = ([x, y], t) => x > t.at[0] && x < t.at[0] + t.size[0] && y > t.at[1] && y < t.at[1] + t.size[1];
/** Whether a thing hides a floor point: somewhere towards the viewer, within what its height covers, is on its tiles. */
const hides = ([x, y], t) => { const lo = Math.max(t.at[0] - x, t.at[1] - y, 0), hi = Math.min(t.at[0] + t.size[0] - x, t.at[1] + t.size[1] - y, t.size[2] * HIDES); return lo < hi && hi > 0; };
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
  assert.deepEqual(route, { from: 'a', to: 'b', points: [[2, 5], [6, 5], [6, 3]], feet: ['right', 'left'], bends: 1, tiles: 6, behind: [], crosses: 0, shared: 0 });
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
      // at the points half a tile apart the search stood on: what hides one is named, and what is named hides one
      const stood = stretches(route).slice(1, -1).flatMap(([a, b]) => { const n = Math.round((Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1])) * 2); return Array.from({ length: n + 1 }, (_, k) => [a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]); });
      const hiding = things.filter((t) => stood.some((p) => hides(p, t))).map((t) => t.name).sort();
      assert.deepEqual([...route.behind].sort(), hiding);
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
      // `shared` is honest: 0 exactly when the route lies on no stretch of one laid before it (its two short ends at a foot apart)
      const lies = laid.slice(0, i).some((before) => share({ points: route.points.slice(1, -1) }, { points: before.points.slice(1, -1) }));
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
  assert.equal(routeNote(laid[3]), 'a to boxed: no route along the floor (no free place at a foot that can be seen)');
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
  assert.ok(performance.now() - began < 5000, `${Math.round(performance.now() - began)} ms`);
  assert.equal(laid.length, MOST_ROUTES);
  const tried = laid.findIndex((r) => r.why === NO_ROUTE.work);
  assert.ok(tried > 50 && laid.slice(tried).every((r) => r.why === NO_ROUTE.work), 'once the work is spent, no later link is tried');
  for (const route of laid.slice(0, 40)) holds(route, many);
  assert.equal(MOST_WORK, 4_000_000);
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
