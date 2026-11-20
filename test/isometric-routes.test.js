// Routes and rounded ways: the way a link runs along the floor, and what it is drawn as. Checked against what a route
// must always hold — it starts and ends on a foot that is seen, runs along the tile lines, passes under nothing, shares
// no stretch with another — by tests written apart from the code, on blocks standing every way round each other.
import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { arrange, gridFor, routes, routeNote, rounded, wordsToFit, MOST_ALSO, MOST_ROUTES, MOST_WORK, NO_ROUTE, MOST_ISOMETRIC_THINGS } from '../isometric.js';

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
  assert.deepEqual(route, { from: 'a', to: 'b', points: [[2, 5], [6, 5], [6, 3]], feet: ['right', 'left'], bends: 1, tiles: 6, behind: [], unseen: [], crosses: 0, shared: 0 });
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
  assert.ok(performance.now() - began < 5000, `${Math.round(performance.now() - began)} ms`);
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
  assert.ok(performance.now() - began < 3000, `${Math.round(performance.now() - began)} ms`);
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
  assert.ok(performance.now() - began < 4000, `${Math.round(performance.now() - began)} ms`);
  for (const route of laid) assert.ok(route.points === null ? Object.values(NO_ROUTE).includes(route.why) : route.points.length >= 2);
});

test('routes: options are {hides} or none; a name is told on one line; what `at` gives is the caller\'s own', () => {
  assert.throws(() => routes([thing('a', [0, 0])], [], 5), /routes takes its options as \{hides\}, or none — not 5/);
  assert.throws(() => routes([thing('a', [0, 0])], [], [1]), /routes takes its options as \{hides\}/);
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
