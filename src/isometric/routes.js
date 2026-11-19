/**
 * Routes: the way each link runs along the floor, round what stands on it.
 *
 *   routes(things, links)   → one entry a link, in the order given:
 *     { from, to, points: [[col, row], …], feet: ['right', 'left'], bends, tiles, behind: ['logs'], crosses, shared }   a way was found
 *     { from, to, points: null, why: 'no way along the floor' }                                              none was
 *
 * `things` are [{name, at, size, round?}], `links` are [[from, to]] by name. A route leaves a thing at one of the two
 * feet a viewer sees (`right`: under its right face, where the cols go on; `left`: under its left face, where the rows
 * go on), runs along the tile lines, turns square, and comes into the other thing at one of its two feet. It never
 * passes under a thing. It keeps off floor that a thing hides when it can; where it cannot, `behind` names the things
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
 * links are laid in the order given, and the same things and links always give the same ways.
 *
 * Everything may come from anyone: every value is read by its own stored field and checked (thing.js), and the work is
 * counted — a picture too big to lay in MOST_WORK steps leaves its last links with a `why`, never a build that hangs.
 */
import { MOST_ISOMETRIC_THINGS } from './order.js';
import { own, readThing, refuse, shown } from './thing.js';

/** The most links one picture lays. */
export const MOST_ROUTES = 1024;
/** The most steps of the search one picture may take, all its links together. */
export const MOST_WORK = 4_000_000;
const MOST_NAME = 200, MOST_POINTS = 40_000;
/** The tiles of floor a thing hides behind it for each tile of its height, in the usual two-to-one view. */
const HIDES = Math.sqrt(1.5);
const STEPS = [0.5, 0.25, 0.125];   // how far apart the lattice's points may be, in tiles: the coarsest that gives the narrowest foot three places
const AROUND = 2;                   // tiles of floor round the things that a route may use
const TURN = 1.5, HIDDEN = 3, CROSS = 2, ALONG = 24, SHARED = 12;   // what each costs, in tiles (HIDDEN: for each tile of hidden floor)
const OFF_MIDDLE = 1.5;   // for each tile a place is off its foot's middle: more than the way it would save, so a link alone takes the middle
/** The four ways along the lattice: the cols on, the rows on, the cols back, the rows back. */
const WAYS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
/** Why a link has no route. */
export const NO_ROUTE = Object.freeze({
  name: 'a name that is no thing here', self: 'a thing joined to itself', heights: 'the two stand at different heights',
  foot: 'no free place at a foot that can be seen', way: 'no way along the floor', work: 'too many links to lay: not tried',
  wide: 'the things stand too far apart to lay links between',
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

/**
 * The lattice of one height of floor (`lift`): its points, which are under a thing (closed), and which a thing hides
 * (the thing's index, or -1). A thing closes the floor it stands on at that height; a thing whose top is above it hides
 * the floor behind it, as far as its height reaches.
 */
function lattice(read, lift, step, hides) {
  const lo = (key) => Math.min(...read.map((t) => t.at[key])), hi = (key) => Math.max(...read.map((t) => t.at[key] + t.size[key]));
  const first = [Math.floor((lo(0) - AROUND) / step), Math.floor((lo(1) - AROUND) / step)];
  const nx = Math.ceil((hi(0) + AROUND) / step) - first[0] + 1, ny = Math.ceil((hi(1) + AROUND) / step) - first[1] + 1;
  const closed = new Uint8Array(nx * ny), hidden = new Int16Array(nx * ny).fill(-1), keep = step / 2;
  read.forEach(({ at: [c, r, z], size: [w, d, h] }, index) => {
    const stands = z === lift || (z < lift && lift < z + h), from = Math.max(0, z - lift) * hides, to = (z + h - lift) * hides;
    if (!stands && !(to > 0)) return;
    // only the points its floor or its shadow can reach: its own tiles, and as far back as it hides
    const reach = Math.max(to, 0) + keep;
    const i0 = Math.max(0, Math.floor((c - reach) / step) - first[0]), i1 = Math.min(nx - 1, Math.ceil((c + w + keep) / step) - first[0]);
    const j0 = Math.max(0, Math.floor((r - reach) / step) - first[1]), j1 = Math.min(ny - 1, Math.ceil((r + d + keep) / step) - first[1]);
    for (let j = j0; j <= j1; j += 1) {
      for (let i = i0; i <= i1; i += 1) {
        const x = (first[0] + i) * step, y = (first[1] + j) * step, node = j * nx + i;
        if (stands && x > c - keep && x < c + w + keep && y > r - keep && y < r + d + keep) closed[node] = 1;
        // hidden: some way towards the viewer (a tile along the cols and a tile along the rows), within what the thing's height covers, is on its tiles
        const near = Math.max(c - x, r - y, from), far = Math.min(c + w - x, r + d - y, to);
        if (to > 0 && near < far && far > 0 && hidden[node] < 0) hidden[node] = index;
      }
    }
  });
  return { first, nx, ny, closed, hidden, alongCols: new Uint8Array(nx * ny), alongRows: new Uint8Array(nx * ny), taken: new Set() };
}

/**
 * The places a route may leave or reach a thing at: on each of its two seen feet, the lattice lines that cross it, each
 * {edge, at: [col, row] (on the foot), node (the lattice point in front of it), way (out of the foot), stub, off}.
 */
function places(thing, { first, nx, ny, closed }, step) {
  const { at: [c, r], size: [w, d], round } = thing, out = [];
  for (const edge of ['right', 'left']) {
    const [lo, span, wall, way] = edge === 'right' ? [r, d, c + w, 0] : [c, w, r + d, 1];
    const margin = Math.min(step / 2, span / 4);
    for (let k = Math.ceil((lo + margin) / step); k * step <= lo + span - margin; k += 1) {
      const along = k * step, front = Math.ceil((wall + step / 2) / step);   // the first lattice line at least half a step in front of the foot
      const [i, j] = edge === 'right' ? [front - first[0], k - first[1]] : [k - first[0], front - first[1]];
      if (i < 0 || j < 0 || i >= nx || j >= ny || closed[j * nx + i]) continue;
      // a round thing's foot is on its round base: nearer its middle than the square's side, away from the side's middle
      const off = along - (lo + span / 2), reach = round ? wall - span / 2 + Math.sqrt(Math.max(0, (span / 2) ** 2 - off ** 2)) : wall;
      out.push({ edge, at: edge === 'right' ? [reach, along] : [along, reach], node: j * nx + i, way, stub: front * step - reach, off: Math.abs(off) });
    }
  }
  return out;
}

/** The cheapest way over the lattice from one of `starts` to one of `ends` (places): {nodes, start, end, cost}, or null. `work`: {left}. */
function search(grid, starts, ends, step, seen, work) {
  const { nx, ny, closed, hidden, alongCols, alongRows, taken } = grid, stamp = (seen.turn += 1);
  const goals = new Map(ends.map((p) => [p.node, p]));
  const far = (node) => { let least = Infinity; const i = node % nx, j = (node - i) / nx; for (const g of goals.keys()) least = Math.min(least, Math.abs(g % nx - i) + Math.abs(Math.floor(g / nx) - j)); return least * step; };
  const placeCost = (p) => p.stub + p.off * OFF_MIDDLE + (taken.has(`${p.edge} ${p.at}`) ? SHARED : 0);
  const pointCost = (node) => (hidden[node] >= 0 ? HIDDEN * step : 0);
  const open = heap();
  let order = 0, best = null;
  const reach = (state, cost, from) => {
    if (seen.stamp[state] === stamp && seen.cost[state] <= cost) return;
    seen.stamp[state] = stamp; seen.cost[state] = cost; seen.from[state] = from;
    open.push([cost + far(state >> 2), order += 1, state, cost]);
  };
  for (const p of starts) reach(p.node * 4 + p.way, placeCost(p) + pointCost(p.node), -1 - starts.indexOf(p));
  while (open.size && (!best || open.top()[0] < best.cost)) {
    if (work.left <= 0) return null;
    work.left -= 1;
    const [, , state, cost] = open.pop();
    if (seen.cost[state] < cost) continue;
    const node = state >> 2, way = state & 3, goal = goals.get(node);
    // at the point in front of a foot of the other thing: turn into the foot (never out of it) and the way is whole
    if (goal && way !== goal.way) {
      const whole = cost + placeCost(goal) + (way === (goal.way + 2) % 4 ? 0 : TURN);
      if (!best || whole < best.cost) best = { cost: whole, state, end: goal };
    }
    const i = node % nx, j = (node - i) / nx;
    for (let next = 0; next < 4; next += 1) {
      if (next === (way + 2) % 4) continue;   // never straight back
      const ni = i + WAYS[next][0], nj = j + WAYS[next][1];
      if (ni < 0 || nj < 0 || ni >= nx || nj >= ny) continue;
      const to = nj * nx + ni;
      if (closed[to]) continue;
      const cols = next % 2 === 0, run = cols ? alongCols : alongRows, across = cols ? alongRows : alongCols;
      const stretch = next < 2 ? node : to;   // a stretch is kept at its lower end
      const crossed = across[to] || across[to - (cols ? nx : 1)] ? CROSS : 0;
      reach(to * 4 + next, cost + step + (next === way ? 0 : TURN) + pointCost(to) + (run[stretch] ? ALONG : 0) + crossed, state);
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
 * the names of the things it passes `behind`, how many routes laid before it `crosses`, and the tiles of it that lie on
 * another's way for want of room (`shared`, 0 as a rule) — or `points: null` and `why` (one of NO_ROUTE).
 */
export function routes(things, links = [], options = undefined) {
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
  const floorAt = (lift) => floors.get(lift) ?? floors.set(lift, (() => {
    const grid = lattice(read, lift, step, hides), size = grid.nx * grid.ny * 4;
    return { grid, seen: { stamp: new Int32Array(size), cost: new Float64Array(size), from: new Int32Array(size), turn: 0 }, places: new Map() };
  })()).get(lift);
  return wanted.map(([from, to]) => {
    const a = read[names.get(from)], b = read[names.get(to)];
    if (!a || !b) return none(from, to, NO_ROUTE.name);
    if (a === b) return none(from, to, NO_ROUTE.self);
    if (a.at[2] !== b.at[2]) return none(from, to, NO_ROUTE.heights);
    if (work.left <= 0) return none(from, to, NO_ROUTE.work);
    const floor = floorAt(a.at[2]), { grid, seen } = floor;
    const placesOf = (thing) => floor.places.get(thing) ?? floor.places.set(thing, places(thing, grid, step)).get(thing);
    const starts = placesOf(a), ends = placesOf(b);
    if (!starts.length || !ends.length) return none(from, to, step > fine ? NO_ROUTE.wide : NO_ROUTE.foot);
    const found = search(grid, starts, ends, step, seen, work);
    if (!found) return none(from, to, work.left <= 0 ? NO_ROUTE.work : NO_ROUTE.way);
    // the way is kept: its stretches, so a later link takes the lane beside it, and its two places
    const { nx, hidden, alongCols, alongRows, taken, first } = grid, { nodes, start, end } = found;
    let crosses = 0, shared = taken.has(`${start.edge} ${start.at}`) || taken.has(`${end.edge} ${end.at}`) ? step : 0;
    for (let k = 1; k < nodes.length; k += 1) {
      const cols = Math.abs(nodes[k] - nodes[k - 1]) === 1, [run, across] = cols ? [alongCols, alongRows] : [alongRows, alongCols];
      if (across[nodes[k]] || across[nodes[k] - (cols ? nx : 1)]) crosses += 1;
      if (run[Math.min(nodes[k], nodes[k - 1])]) shared += step;   // floor another route already runs along: only where there was no room beside it
    }
    for (let k = 1; k < nodes.length; k += 1) (Math.abs(nodes[k] - nodes[k - 1]) === 1 ? alongCols : alongRows)[Math.min(nodes[k], nodes[k - 1])] = 1;
    taken.add(`${start.edge} ${start.at}`); taken.add(`${end.edge} ${end.at}`);
    const point = (node) => [(first[0] + node % nx) * step, (first[1] + Math.floor(node / nx)) * step];
    const all = [start.at, ...nodes.map(point), end.at], points = all.filter((p, k) => k === 0 || k === all.length - 1 || (p[0] - all[k - 1][0]) * (all[k + 1][1] - p[1]) !== (p[1] - all[k - 1][1]) * (all[k + 1][0] - p[0]));
    const behind = [...new Set(nodes.map((node) => hidden[node]).filter((index) => index >= 0))].map((index) => read[index].name);
    const tiles = points.reduce((sum, p, k) => (k ? sum + Math.abs(p[0] - points[k - 1][0]) + Math.abs(p[1] - points[k - 1][1]) : 0), 0);
    return { from, to, points, feet: [start.edge, end.edge], bends: points.length - 2, tiles, behind, crosses, shared };
  });
}

/**
 * What there is to say about one route (an entry of `routes`), in words — or null when it lies well. For whoever
 * writes the picture, a person or a model: the state has a name, so the next change can be said exactly.
 */
export function routeNote(route) {
  const link = `${route.from} to ${route.to}`;
  if (!route.points) return `${link}: no route along the floor (${route.why})`;
  const said = [];
  if (route.behind.length) said.push(`passes behind ${route.behind.join(', ')}`);
  if (route.crosses) said.push(`crosses ${route.crosses} other${route.crosses === 1 ? '' : 's'}`);
  if (route.shared) said.push('lies on another link for want of room');
  if (route.bends > 3) said.push(`turns ${route.bends} times`);
  return said.length ? `${link}: ${said.join(', ')}` : null;
}
