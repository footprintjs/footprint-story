/**
 * Routes: the way each link runs along the floor, round what stands on it.
 *
 *   routes(things, links)   → one entry a link, in the order given:
 *     { from, to, points: [[col, row], …], feet: ['right', 'left'], bends, tiles, behind: ['logs'], unseen: [[3, 4.5]], crosses, shared }   a way was found
 *     { from, to, points: null, why: 'no way along the floor' }                                              none was
 *
 * `things` are [{name, at, size, round?}], `links` are [[from, to]] by name. A route leaves a thing at one of the two
 * feet a viewer sees (`right`: under its right face, where the cols go on; `left`: under its left face, where the rows
 * go on), runs along the tile lines, turns square, and comes into the other thing at one of its two feet. It never
 * passes under a thing that stands on its floor. It keeps off floor that a thing hides when it can; where it cannot, `behind` names the things
 * it passes behind. Two routes do not share a stretch of floor while there is room beside: a request and its answer lie
 * in two lanes. Where there is none (more links at a thing than its feet have places), `shared` says how many tiles of
 * the way lie on another's.
 *
 * WHY the feet a viewer sees: an arrow's tip at the back of a thing is covered by the thing. WHY the tile lines: a line
 * that follows them reads as lying on the floor; a line straight from thing to thing reads as flying over it.
 * WHY a result that says why: whoever writes the picture (a person, or a model) can be told "this link passes behind
 * logs" in words and move one thing, where a picture would have to be looked at and guessed from.
 *
 * HOW: the floor is a lattice of points half a tile apart (finer when a thing is under two tiles wide, so its foot has
 * room for a link, its answer and one more). Each link in turn
 * takes the cheapest way over it, found by the search of REFERENCES.md: a step costs its length; a turn costs TURN more,
 * so a way has few bends; a step over hidden floor costs HIDDEN more, so a way goes round where it can be seen; crossing
 * a route laid before costs CROSS, and running along one costs ALONG, so the later link takes the lane beside it. The
 * short run out of a foot is a stretch like any other: it passes under nothing, pays for hidden floor and for what it
 * crosses. The links are laid in the order given, and the same things and links always give the same ways.
 *
 * Everything may come from anyone: every value is read by its own stored field and checked (thing.js), and the work is
 * counted — building a floor's lattice and every step of the search. A picture too big to lay in MOST_WORK leaves its
 * last links with a `why`, never a build that hangs or a floor for every height held at once.
 */
import { MOST_ISOMETRIC_THINGS } from './order.js';
import { own, readThing, refuse, shown } from './thing.js';

/** The most links one picture lays. */
export const MOST_ROUTES = 1024;
/** The most work one picture may take, all its links together: a step of the search, or a point looked at while a floor is built. */
export const MOST_WORK = 4_000_000;
const MOST_NAME = 200, MOST_POINTS = 200_000;   // the most points a lattice has: past that it is made coarser
/** The tiles of floor a thing hides behind it for each tile of its height, in the usual two-to-one view. */
const HIDES = Math.sqrt(1.5);
const STEPS = [0.5, 0.25, 0.125];   // how far apart the lattice's points may be, in tiles: the coarsest that gives the narrowest foot three places
const AROUND = 2;                   // tiles of floor round the things that a route may use
const REACH = 0.5;                  // tiles a route runs straight out of a foot, at least: room for an arrow's head on its last run
const TURN = 1.5, HIDDEN = 3, CROSS = 2, ALONG = 24, SHARED = 12;   // what each costs, in tiles (HIDDEN: for each tile of hidden floor)
const OFF_MIDDLE = 1.5;   // for each tile a place is off its foot's middle: more than the way it would save, so a link alone takes the middle
/** The four ways along the lattice: the cols on, the rows on, the cols back, the rows back. */
const WAYS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
/** Why a link has no route. */
export const NO_ROUTE = Object.freeze({
  name: 'a name that is no thing here', self: 'a thing joined to itself', heights: 'the two stand at different heights',
  foot: 'no place at a foot that can be seen: closed in, or too narrow', way: 'no way along the floor', work: 'too many links to lay: not tried',
  wide: 'the things stand too far apart for the smallest of them: no lattice fine enough to give its feet a place',
});

const option = (options, key, usual) => (options !== null && typeof options === 'object' ? own(options, key) ?? usual : usual);

function readThings(things) {
  if (!Array.isArray(things)) refuse(`routes takes a list of things, [{name, at: [col, row], size: [wide, deep, high]}] — not ${shown(things)}`);
  if (things.length > MOST_ISOMETRIC_THINGS) refuse(`routes reads at most ${MOST_ISOMETRIC_THINGS} things, not ${things.length}`);
  const read = [], names = new Map();
  for (let i = 0; i < things.length; i += 1) {
    const thing = own(things, i);
    if (!thing || typeof thing !== 'object' || Array.isArray(thing)) refuse(`thing ${i + 1} is {name, at: [col, row], size: [wide, deep, high]} — not ${shown(thing)}`);
    const name = own(thing, 'name'), round = own(thing, 'round') ?? false;
    if (typeof name !== 'string' || !name || name.length > MOST_NAME) refuse(`thing ${i + 1} has a name, some text of at most ${MOST_NAME} characters — not ${shown(name)}`);
    if (names.has(name)) refuse(`two things are named ${shown(name)}: a name tells one thing from another`);
    if (typeof round !== 'boolean') refuse(`${shown(name)}'s round says whether it is a round thing, true or false — not ${shown(round)}`);
    const { at, size } = readThing(thing, shown(name));
    if (round && size[0] !== size[1]) refuse(`${shown(name)} is round: give it the same width and depth — not ${shown(size)}`);
    names.set(name, read.length);
    read.push({ name, at, size, round });
  }
  return { read, names };
}

function readLinks(links) {
  if (!Array.isArray(links)) refuse(`routes takes a list of links, [[from, to], …] by name — not ${shown(links)}`);
  if (links.length > MOST_ROUTES) refuse(`routes lays at most ${MOST_ROUTES} links, not ${links.length}`);
  return Array.from({ length: links.length }, (_, i) => {
    const link = own(links, i), from = Array.isArray(link) && link.length === 2 ? own(link, 0) : undefined, to = from === undefined ? undefined : own(link, 1);
    if (typeof from !== 'string' || typeof to !== 'string') refuse(`link ${i + 1} is [from, to], the names of two things — not ${shown(link)}`);
    return [from, to];
  });
}

/** A heap of [cost, turn, …]: the least cost first, and of two alike the one put in first. */
function heap() {
  const items = [];
  const before = (a, b) => a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]);
  return {
    get size() { return items.length; },
    top: () => items[0],
    push(item) {
      let i = items.push(item) - 1;
      for (let up = (i - 1) >> 1; i > 0 && before(item, items[up]); i = up, up = (i - 1) >> 1) items[i] = items[up];
      items[i] = item;
    },
    pop() {
      const first = items[0], last = items.pop();
      if (!items.length) return first;
      let i = 0;
      for (;;) {
        let down = 2 * i + 1;
        if (down >= items.length) break;
        if (down + 1 < items.length && before(items[down + 1], items[down])) down += 1;
        if (!before(items[down], last)) break;
        items[i] = items[down]; i = down;
      }
      items[i] = last;
      return first;
    },
  };
}

/** Whether a thing stands on the floor at `lift`: on it, or through it. */
const standsAt = ({ at: [, , z], size: [, , h] }, lift) => z === lift || (z < lift && lift < z + h);
/**
 * Whether a thing hides the floor point [x, y] at `lift`: some way towards the viewer (a tile along the cols and a
 * tile along the rows), within what the thing's height covers there, is on its tiles.
 */
function hidesPoint({ at: [c, r, z], size: [w, d, h] }, lift, hides, x, y) {
  const from = Math.max(0, z - lift) * hides, to = (z + h - lift) * hides;
  const near = Math.max(c - x, r - y, from), far = Math.min(c + w - x, r + d - y, to);
  return to > 0 && near < far && far > 0;
}

/**
 * The lattice of one height of floor (`lift`): its points, which are under a thing (closed), and which some thing
 * hides. A thing closes the floor it stands on at that height; a thing whose top is above it hides the floor behind
 * it, as far as its height reaches. Building it is work too (`work`: {left}), a look for each point
 * and for each point a thing may reach: a picture with a floor at every height must not cost more than one — null
 * when there is not enough work left to build it.
 */
function lattice(read, lift, step, hides, work) {
  const lo = (key) => Math.min(...read.map((t) => t.at[key])), hi = (key) => Math.max(...read.map((t) => t.at[key] + t.size[key]));
  const first = [Math.floor((lo(0) - AROUND) / step), Math.floor((lo(1) - AROUND) / step)];
  const nx = Math.ceil((hi(0) + AROUND) / step) - first[0] + 1, ny = Math.ceil((hi(1) + AROUND) / step) - first[1] + 1;
  if (nx * ny > work.left) return null;
  work.left -= nx * ny;
  const closed = new Uint8Array(nx * ny), hidden = new Uint8Array(nx * ny), keep = step / 2;
  for (const thing of read) {
    const { at: [c, r, z], size: [w, d, h] } = thing, stands = standsAt(thing, lift), to = (z + h - lift) * hides;
    if (!stands && !(to > 0)) continue;
    // only the points its floor or its shadow can reach: its own tiles, and as far back as it hides
    const reach = Math.max(to, 0) + keep;
    const i0 = Math.max(0, Math.floor((c - reach) / step) - first[0]), i1 = Math.min(nx - 1, Math.ceil((c + w + keep) / step) - first[0]);
    const j0 = Math.max(0, Math.floor((r - reach) / step) - first[1]), j1 = Math.min(ny - 1, Math.ceil((r + d + keep) / step) - first[1]);
    const looks = Math.max(0, i1 - i0 + 1) * Math.max(0, j1 - j0 + 1);
    if (looks > work.left) return null;
    work.left -= looks;
    for (let j = j0; j <= j1; j += 1) {
      for (let i = i0; i <= i1; i += 1) {
        const x = (first[0] + i) * step, y = (first[1] + j) * step, node = j * nx + i;
        if (stands && x > c - keep && x < c + w + keep && y > r - keep && y < r + d + keep) closed[node] = 1;
        if (hidesPoint(thing, lift, hides, x, y)) hidden[node] = 1;
      }
    }
  }
  return { first, nx, ny, closed, hidden, alongCols: new Uint8Array(nx * ny), alongRows: new Uint8Array(nx * ny), taken: new Set() };
}

/**
 * The places a route may leave or reach a thing at: on each of its two seen feet, the lattice lines that cross it, each
 * {edge, at: [col, row] (on the foot), node (the lattice point in front of it), way (out of the foot), stub (the
 * straight run between the two, in tiles), run (the lattice stretches that run lies on), between (the lattice points
 * on it), hidden (whether a thing hides the foot or the run), off}. The run from a foot to its lattice point is part
 * of the route like any other stretch: a place whose run would pass under another thing is no place, and one a thing
 * hides is told as hidden. `work`: {left} — a look for each thing a place is asked against; null when it runs out.
 */
function places(thing, read, lift, hides, { first, nx, ny, closed, hidden }, step, work) {
  const { at: [c, r], size: [w, d], round } = thing, out = [], others = read.filter((t) => t !== thing && standsAt(t, lift));
  for (const edge of ['right', 'left']) {
    const [lo, span, wall, way] = edge === 'right' ? [r, d, c + w, 0] : [c, w, r + d, 1];
    const margin = Math.min(step / 2, span / 4), front = Math.ceil((wall + REACH) / step);   // the first lattice line at least REACH in front of the foot
    for (let k = Math.ceil((lo + margin) / step); k * step <= lo + span - margin; k += 1) {
      const along = k * step, [i, j] = edge === 'right' ? [front - first[0], k - first[1]] : [k - first[0], front - first[1]];
      if (i < 0 || j < 0 || i >= nx || j >= ny || closed[j * nx + i]) continue;
      if (read.length > work.left) return null;   // not enough work left to ask: no list at all, never a short one
      work.left -= read.length;
      // a round thing's foot is on its round base: nearer its middle than the square's side, away from the side's middle
      const off = along - (lo + span / 2), reach = round ? wall - span / 2 + Math.sqrt(Math.max(0, (span / 2) ** 2 - off ** 2)) : wall;
      // under no other thing, from the foot to the lattice point: the run is a line, a thing's floor a box
      const ahead = front * step;
      if (others.some(({ at: [oc, or], size: [ow, od] }) => (edge === 'right' ? along > or && along < or + od && reach < oc + ow && ahead > oc : along > oc && along < oc + ow && reach < or + od && ahead > or))) continue;
      // the stretches of lattice between the foot and that point (kept as the route's own, so no other runs along them) and the points on them
      const run = [], between = [];
      for (let back = 1; (front - back) * step >= wall - 1e-9; back += 1) {
        const node = edge === 'right' ? j * nx + i - back : (j - back) * nx + i;
        run.push(node);
        if ((front - back) * step > wall + 1e-9) between.push(node);
      }
      const at = edge === 'right' ? [reach, along] : [along, reach];
      const unseen = between.some((node) => hidden[node]) || read.some((t) => t !== thing && hidesPoint(t, lift, hides, at[0], at[1]));
      out.push({ edge, at, node: j * nx + i, way, stub: ahead - reach, run, between, hidden: unseen, off: Math.abs(off) });
    }
  }
  return out;
}

/** Whether a route laid before runs across a lattice point: across a stretch along the cols (`cols`), one along the rows. */
const crossedAt = ({ nx, alongCols, alongRows }, node, cols) => Boolean(cols ? alongRows[node] || alongRows[node - nx] : alongCols[node] || alongCols[node - 1]);
/** How many routes laid before run across a place's own run: at the lattice points on it, and at the one in front (`front`). */
const runCrossings = (grid, place, front) => [...(front ? [place.node] : []), ...place.between].filter((node) => crossedAt(grid, node, place.way === 0)).length;

/** The cheapest way over the lattice from one of `starts` to one of `ends` (places): {nodes, start, end, cost}, or null. `work`: {left}. */
function search(grid, starts, ends, step, seen, work) {
  const { nx, ny, closed, hidden, alongCols, alongRows, taken } = grid, stamp = (seen.turn += 1);
  const goals = new Map(ends.map((p) => [p.node, p]));
  // how far a point is from the box round the points to reach, along the lattice: never more than the way still to go,
  // and one sum whatever the number of places (a thing thousands of tiles wide has thousands)
  const box = [Infinity, -Infinity, Infinity, -Infinity];
  for (const g of goals.keys()) { const i = g % nx, j = (g - i) / nx; box[0] = Math.min(box[0], i); box[1] = Math.max(box[1], i); box[2] = Math.min(box[2], j); box[3] = Math.max(box[3], j); }
  const far = (node) => { const i = node % nx, j = (node - i) / nx; return (Math.max(0, box[0] - i, i - box[1]) + Math.max(0, box[2] - j, j - box[3])) * step; };
  const lies = (p) => { const kept = p.way === 0 ? alongCols : alongRows; return p.run.filter((stretch) => kept[stretch]).length; };
  // what a place costs: its run (three times more over hidden floor), being off the foot's middle, being taken, lying
  // on another's stretch, and crossing the routes laid before — `front`: whether the lattice point's own crossing is its to pay
  const placeCost = (p, front) => p.stub * (p.hidden ? 1 + HIDDEN : 1) + p.off * OFF_MIDDLE + (taken.has(`${p.edge} ${p.at}`) ? SHARED : 0) + lies(p) * ALONG + runCrossings(grid, p, front) * CROSS;
  const pointCost = (node) => (hidden[node] ? HIDDEN * step : 0);
  const open = heap();
  let order = 0, best = null;
  const reach = (state, cost, from) => {
    if (seen.stamp[state] === stamp && seen.cost[state] <= cost) return;
    seen.stamp[state] = stamp; seen.cost[state] = cost; seen.from[state] = from;
    open.push([cost + far(state >> 2), order += 1, state, cost]);
  };
  starts.forEach((p, k) => reach(p.node * 4 + p.way, placeCost(p, true) + pointCost(p.node), -1 - k));
  while (open.size && (!best || open.top()[0] < best.cost)) {
    if (work.left <= 0) return null;
    work.left -= 1;
    const [, , state, cost] = open.pop();
    if (seen.cost[state] < cost) continue;
    const node = state >> 2, way = state & 3, goal = goals.get(node);
    // at the point in front of a foot of the other thing: turn into the foot (never out of it) and the way is whole
    if (goal && way !== goal.way) {
      const straight = way === (goal.way + 2) % 4;   // straight in: this point's crossing was paid on the way to it
      const whole = cost + placeCost(goal, !straight) + (straight ? 0 : TURN);
      if (!best || whole < best.cost) best = { cost: whole, state, end: goal };
    }
    const i = node % nx, j = (node - i) / nx;
    for (let next = 0; next < 4; next += 1) {
      if (next === (way + 2) % 4) continue;   // never straight back
      const ni = i + WAYS[next][0], nj = j + WAYS[next][1];
      if (ni < 0 || nj < 0 || ni >= nx || nj >= ny) continue;
      const to = nj * nx + ni;
      if (closed[to]) continue;
      const cols = next % 2 === 0, run = cols ? alongCols : alongRows;
      const stretch = next < 2 ? node : to;   // a stretch is kept at its lower end
      reach(to * 4 + next, cost + step + (next === way ? 0 : TURN) + pointCost(to) + (run[stretch] ? ALONG : 0) + (crossedAt(grid, to, cols) ? CROSS : 0), state);
    }
  }
  if (!best) return null;
  const nodes = [];
  let state = best.state;
  for (; state >= 0; state = seen.from[state]) nodes.push(state >> 2);
  return { nodes: nodes.reverse(), start: starts[-1 - state], end: best.end, cost: best.cost };
}

/**
 * The way each link runs along the floor. `things`: [{name, at: [col, row, lift?], size: [wide, deep, high], round?}];
 * `links`: [[from, to]] by name; `hides`: the tiles of floor a thing hides behind it for each tile of its height (1.22,
 * the usual two-to-one view). Gives one entry a link, in the order given: its `points` ([col, row], from the foot it
 * leaves to the foot it reaches, a turn at every point between), the `feet` it uses, its `bends`, its length in `tiles`,
 * the names of the things it passes `behind` and where (`unseen`: [[from, to], …], the stretches a thing hides, in
 * tiles along the way from its start, right to the nearest half step of the search), how many routes laid before it `crosses`, and the tiles of it that lie on
 * another's way for want of room (`shared`, 0 as a rule) — or `points: null` and `why` (one of NO_ROUTE).
 */
export function routes(things, links = [], options = undefined) {
  if (options !== undefined && options !== null && (typeof options !== 'object' || Array.isArray(options))) refuse(`routes takes its options as {hides}, or none — not ${shown(options)}`);
  const { read, names } = readThings(things), wanted = readLinks(links), hides = option(options, 'hides', HIDES);
  if (!(typeof hides === 'number' && hides >= 0 && hides <= 8)) refuse(`hides is the tiles of floor a thing hides behind it for each tile of its height, from 0 to 8 — not ${shown(hides)}`);
  const none = (from, to, why) => ({ from, to, points: null, why });
  if (!read.length) return wanted.map(([from, to]) => none(from, to, NO_ROUTE.name));
  // the lattice: the coarsest step that gives the narrowest foot a place, made coarser again while the floor has too many points
  const narrow = Math.min(...read.map((t) => Math.min(t.size[0], t.size[1])));
  const reachOf = (key) => Math.max(...read.map((t) => t.at[key] + t.size[key])) - Math.min(...read.map((t) => t.at[key])) + 2 * AROUND;
  const fine = STEPS.find((s) => narrow / s >= 4) ?? STEPS.at(-1);
  let step = fine;
  while ((reachOf(0) / step + 2) * (reachOf(1) / step + 2) > MOST_POINTS) step *= 2;
  const floors = new Map(), work = { left: MOST_WORK };
  let seen = null;   // what the search remembers of one link: every floor's lattice has the same points, so one is enough
  const floorAt = (lift) => {
    if (!floors.has(lift)) {
      const grid = lattice(read, lift, step, hides, work);
      seen ??= grid && { stamp: new Int32Array(grid.nx * grid.ny * 4), cost: new Float64Array(grid.nx * grid.ny * 4), from: new Int32Array(grid.nx * grid.ny * 4), turn: 0 };
      floors.set(lift, grid && { grid, places: new Map() });
    }
    return floors.get(lift);
  };
  return wanted.map(([from, to]) => {
    const a = read[names.get(from)], b = read[names.get(to)];
    if (!a || !b) return none(from, to, NO_ROUTE.name);
    if (a === b) return none(from, to, NO_ROUTE.self);
    if (a.at[2] !== b.at[2]) return none(from, to, NO_ROUTE.heights);
    if (work.left <= 0) return none(from, to, NO_ROUTE.work);
    const floor = floorAt(a.at[2]);
    if (!floor) return none(from, to, NO_ROUTE.work);   // no work left to build this height's floor
    const { grid } = floor;
    const placesOf = (thing) => {
      if (!floor.places.has(thing)) { const found = places(thing, read, a.at[2], hides, grid, step, work); if (found) floor.places.set(thing, found); return found; }
      return floor.places.get(thing);
    };
    const starts = placesOf(a), ends = starts && placesOf(b);
    if (!starts || !ends) return none(from, to, NO_ROUTE.work);
    if (!starts.length || !ends.length) return none(from, to, step > fine ? NO_ROUTE.wide : NO_ROUTE.foot);
    const found = search(grid, starts, ends, step, seen, work);
    if (!found) return none(from, to, work.left <= 0 ? NO_ROUTE.work : NO_ROUTE.way);
    // the way is kept: its stretches, so a later link takes the lane beside it, and its two places
    const { nx, alongCols, alongRows, taken, first } = grid, { nodes, start, end } = found;
    // what it crosses: at its first lattice point and along its two short runs, as on the way between
    const straightIn = nodes.length > 1 && (Math.abs(nodes.at(-1) - nodes.at(-2)) === 1) === (end.way === 0);
    let crosses = runCrossings(grid, start, true) + runCrossings(grid, end, !straightIn), shared = 0;
    for (const place of [start, end]) {
      const kept = place.way === 0 ? alongCols : alongRows;
      if (taken.has(`${place.edge} ${place.at}`)) shared += place.stub;
      else shared += place.run.filter((stretch) => kept[stretch]).length * step;
    }
    for (let k = 1; k < nodes.length; k += 1) {
      const cols = Math.abs(nodes[k] - nodes[k - 1]) === 1;
      if (crossedAt(grid, nodes[k], cols)) crosses += 1;
      if ((cols ? alongCols : alongRows)[Math.min(nodes[k], nodes[k - 1])]) shared += step;   // floor another route already runs along: only where there was no room beside it
    }
    for (let k = 1; k < nodes.length; k += 1) (Math.abs(nodes[k] - nodes[k - 1]) === 1 ? alongCols : alongRows)[Math.min(nodes[k], nodes[k - 1])] = 1;
    for (const place of [start, end]) {
      taken.add(`${place.edge} ${place.at}`);
      for (const stretch of place.run) (place.way === 0 ? alongCols : alongRows)[stretch] = 1;
    }
    const point = (node) => [(first[0] + node % nx) * step, (first[1] + Math.floor(node / nx)) * step];
    const all = [start.at, ...nodes.map(point), end.at], points = all.filter((p, k) => k === 0 || k === all.length - 1 || (p[0] - all[k - 1][0]) * (all[k + 1][1] - p[1]) !== (p[1] - all[k - 1][1]) * (all[k + 1][0] - p[0]));
    // every thing that hides a point of it — the lattice points it stands on, those of its two short runs, and its two feet
    // (a foot is asked against every thing but its own: a round thing's foot is on its rim, inside the square it stands on)
    const stood = [...nodes, ...start.between, ...end.between].map(point), feet = [[start.at, a], [end.at, b]];
    work.left -= (stood.length + 2) * read.length;
    const behind = read.filter((thing) => stood.some(([x, y]) => hidesPoint(thing, a.at[2], hides, x, y)) || feet.some(([[x, y], own]) => thing !== own && hidesPoint(thing, a.at[2], hides, x, y))).map((thing) => thing.name);
    // the stretches of it that some thing hides, by how far along the way they are: a packet riding it can fade there, and a check can say how long
    const way = [[start.at, a], ...[...start.between].reverse().map((node) => [point(node)]), ...nodes.map((node) => [point(node)]), ...end.between.map((node) => [point(node)]), [end.at, b]];
    const unseen = [];
    let gone = 0;
    way.forEach(([[x, y], own], k) => {
      if (k) gone += Math.abs(x - way[k - 1][0][0]) + Math.abs(y - way[k - 1][0][1]);
      if (!read.some((thing) => thing !== own && hidesPoint(thing, a.at[2], hides, x, y))) return;
      const last = unseen.at(-1), before = k ? gone - (Math.abs(x - way[k - 1][0][0]) + Math.abs(y - way[k - 1][0][1])) : 0;
      if (last && last.upTo === before) { last.upTo = gone; last.to = gone; } else unseen.push({ from: gone, to: gone, upTo: gone });
    });
    work.left -= way.length * read.length;
    const tiles = points.reduce((sum, p, k) => (k ? sum + Math.abs(p[0] - points[k - 1][0]) + Math.abs(p[1] - points[k - 1][1]) : 0), 0);
    // a hidden point stands for the half step either side of it: a stretch is right to the nearest half step, not to the edge of what hides it
    const spans = unseen.map(({ from: lo, to: hi }) => [Math.max(0, lo - step / 2), Math.min(tiles, hi + step / 2)]);
    return { from, to, points, feet: [start.edge, end.edge], bends: points.length - 2, tiles, behind, unseen: spans, crosses, shared };
  });
}

/**
 * What there is to say about one route (an entry of `routes`), in words — or null when it lies well. For whoever
 * writes the picture, a person or a model: the state has a name, so the next change can be said exactly.
 */
export function routeNote(route) {
  const plain = (name) => String(name).replace(/[\u0000-\u001f\u007f\u2028\u2029]/g, ' ');   // a name is told on one line
  const link = `${plain(route.from)} to ${plain(route.to)}`;
  if (!route.points) return `${link}: no route along the floor (${route.why})`;
  const said = [];
  if (route.behind.length) said.push(`passes behind ${route.behind.map(plain).join(', ')}`);
  if (route.crosses) said.push(`crosses ${route.crosses} other${route.crosses === 1 ? '' : 's'}`);
  if (route.shared) said.push('lies on another link for want of room');
  if (route.bends > 3) said.push(`turns ${route.bends} times`);
  return said.length ? `${link}: ${said.join(', ')}` : null;
}
