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
 * crosses. A step onto floor kept clear (`keep`, under words that float over the picture) costs KEPT more: a way goes
 * round words where it can, and `under` names the words it could not keep off. Kept floor is no thing: it never
 * changes the lattice's step, and it is asked at its own height. The links are laid in the order given, and the same
 * things and links always give the same ways.
 *
 * Everything may come from anyone: every value is read by its own stored field and checked (thing.js), and the work is
 * counted — building a floor's lattice and every step of the search. A picture too big to lay in MOST_WORK leaves its
 * last links with a `why`, never a build that hangs or a floor for every height held at once.
 */
import { MOST_ISOMETRIC_THINGS } from './order.js';
import { own, readThing, refuse, shown } from './thing.js';
import { readPorts, portPlaces, SIDES, OUT } from './ports.js';

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
/** For each tile of floor kept clear (`keep`: under words that float over the picture), what a route pays more: more than going round a few tiles, less than a closed floor. */
const KEPT = 4;
/** The most stretches of kept floor one picture may name. */
export const MOST_KEEP = 512;
const OFF_MIDDLE = 1.5;   // for each tile a place is off its foot's middle: more than the way it would save, so a link alone takes the middle
/** The four ways along the lattice: the cols on, the rows on, the cols back, the rows back. */
const WAYS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
/** Why a link has no route. */
export const NO_ROUTE = Object.freeze({
  name: 'a name that is no thing here', self: 'a thing joined to itself', heights: 'the two stand at different heights',
  foot: 'no place at a foot that can be seen: closed in, or too narrow', way: 'no way along the floor', work: 'too many links to lay: not tried',
  port: 'no way out of the port: its run to the floor passes under another thing, or the floor in front of it is closed', portName: 'a port that is no port of that thing',
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
    read.push({ name, at, size, round, ports: readPorts(own(thing, 'ports'), size, round, shown(name)) });
  }
  return { read, names };
}

/**
 * The floor kept clear, checked: null when none is asked, else [{name, index, at: [col, row], lift, size: [wide, deep]}]
 * — `keep` as given, each read by its own stored fields (a hole is refused, a getter is never run), as things are.
 */
function readKeep(keep) {
  if (keep === undefined || keep === null) return null;
  if (!Array.isArray(keep)) refuse(`keep is a list of floor kept clear, [{at: [col, row, lift?], size: [wide, deep], name?}, …] — not ${shown(keep)}`);
  if (keep.length > MOST_KEEP) refuse(`keep names at most ${MOST_KEEP} stretches of floor, not ${keep.length}`);
  return Array.from({ length: keep.length }, (_, i) => {
    const area = own(keep, i), what = `keep ${i + 1}`;
    if (!area || typeof area !== 'object' || Array.isArray(area)) refuse(`${what} is {at: [col, row, lift?], size: [wide, deep], name?} — not ${shown(area)}`);
    const name = own(area, 'name'), size = own(area, 'size');
    if (name !== undefined && (typeof name !== 'string' || !name || name.length > MOST_NAME)) refuse(`${what} has a name, some text of at most ${MOST_NAME} characters — not ${shown(name)}`);
    const sizes = Array.isArray(size) && size.length === 2 ? [own(size, 0), own(size, 1)] : null;
    if (!sizes || !sizes.every((v) => typeof v === 'number' && Number.isFinite(v) && v > 0)) refuse(`${what}'s size is [wide, deep], in tiles, each above 0 — not ${shown(size)}`);
    const thing = readThing({ at: own(area, 'at'), size: [...sizes, 0] }, what);
    return { name: name ?? null, index: i, at: [thing.at[0], thing.at[1]], lift: thing.at[2] ?? 0, size: sizes };
  });
}

/** Whether a stretch of floor from `p` to `q` passes strictly inside a kept area (touching its edge is not inside). */
function inArea([px, py], [qx, qy], { at: [c, r], size: [w, d] }) {
  let t0 = 0, t1 = 1;
  for (const [delta, lo, hi, from] of [[qx - px, c, c + w, px], [qy - py, r, r + d, py]]) {
    if (Math.abs(delta) < 1e-12) { if (!(from > lo + 1e-9 && from < hi - 1e-9)) return false; continue; }
    let a = (lo - from) / delta, b = (hi - from) / delta;
    if (a > b) [a, b] = [b, a];
    t0 = Math.max(t0, a); t1 = Math.min(t1, b);
    if (t1 - t0 <= 1e-9) return false;
  }
  return true;
}

function readLinks(links) {
  if (!Array.isArray(links)) refuse(`routes takes a list of links, [[from, to], …] by name — not ${shown(links)}`);
  if (links.length > MOST_ROUTES) refuse(`routes lays at most ${MOST_ROUTES} links, not ${links.length}`);
  // an end is a thing's name, or {thing, port}: a port of that thing
  const endOf = (end) => {
    if (typeof end === 'string') return { name: end, port: null };
    if (!end || typeof end !== 'object' || Array.isArray(end)) return null;
    const name = own(end, 'thing'), port = own(end, 'port');
    return typeof name === 'string' && typeof port === 'string' ? { name, port } : null;
  };
  return Array.from({ length: links.length }, (_, i) => {
    const link = own(links, i), ends = Array.isArray(link) && link.length === 2 ? [endOf(own(link, 0)), endOf(own(link, 1))] : [null, null];
    if (!ends[0] || !ends[1]) refuse(`link ${i + 1} is [from, to], each the name of a thing or {thing, port} — not ${shown(link)}`);
    return ends;
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
function lattice(read, lift, step, hides, work, clear = []) {
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
  // floor kept clear at this height, as the lattice's stretches that pass strictly inside it — a stretch along the cols
  // (keptCols) or the rows (keptRows), kept at its lower end, as the lanes are. Each area adds to a difference grid,
  // and one pass sums them: the work is the lattice's, whatever the areas or how they overlap.
  const keptCols = new Uint8Array(nx * ny), keptRows = new Uint8Array(nx * ny);
  if (clear.length) {
    if (2 * (nx + 1) * (ny + 1) + 8 * clear.length > work.left) return null;
    work.left -= 2 * (nx + 1) * (ny + 1) + 8 * clear.length;
    const mark = (out, along) => {
      const diff = new Int32Array((nx + 1) * (ny + 1));
      for (const { at: [c, r], size: [w, d] } of clear) {
        // along the cols: a stretch from i to i+1 at row j overlaps (c, c+w) and stands strictly inside (r, r+d)
        const [s0, s1, e0, e1] = along === 0 ? [c, c + w, r, r + d] : [r, r + d, c, c + w], [f0, f1] = along === 0 ? first : [first[1], first[0]];
        const a0 = Math.max(0, Math.floor(s0 / step + 1e-9) - f0), a1 = Math.min((along === 0 ? nx : ny) - 2, Math.ceil(s1 / step - 1e-9) - f0 - 1);
        const b0 = Math.max(0, Math.floor(e0 / step + 1e-9) + 1 - f1), b1 = Math.min((along === 0 ? ny : nx) - 1, Math.ceil(e1 / step - 1e-9) - 1 - f1);
        if (a0 > a1 || b0 > b1) continue;
        const [i0, i1, j0, j1] = along === 0 ? [a0, a1, b0, b1] : [b0, b1, a0, a1];
        diff[j0 * (nx + 1) + i0] += 1; diff[j0 * (nx + 1) + i1 + 1] -= 1; diff[(j1 + 1) * (nx + 1) + i0] -= 1; diff[(j1 + 1) * (nx + 1) + i1 + 1] += 1;
      }
      for (let j = 0; j < ny; j += 1) {
        let row = 0;
        for (let i = 0; i < nx; i += 1) {
          row += diff[j * (nx + 1) + i];
          const above = j ? diff[(j - 1) * (nx + 1) + i] : 0;   // the running sum of the row before, kept in place
          diff[j * (nx + 1) + i] = row + above;
          if (diff[j * (nx + 1) + i] > 0) out[j * nx + i] = 1;
        }
      }
    };
    mark(keptCols, 0); mark(keptRows, 1);
  }
  return { first, nx, ny, closed, hidden, keptCols, keptRows, clear, alongCols: new Uint8Array(nx * ny), alongRows: new Uint8Array(nx * ny), taken: new Set(), cut: new Set() };
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
      // the lattice points of its run, in order out of the foot, as floor points
      const lead = [...between].reverse().map((node) => [(first[0] + (node % nx)) * step, (first[1] + Math.floor(node / nx)) * step]);
      out.push({ edge, at, node: j * nx + i, way, stub: ahead - reach, run, between, lead, hidden: unseen, off: Math.abs(off), turn: 0, port: null });
    }
  }
  return out;
}

/** Whether a route laid before runs across a lattice point: across a stretch along the cols (`cols`), one along the rows. */
const crossedAt = ({ nx, alongCols, alongRows }, node, cols) => Boolean(cols ? alongRows[node] || alongRows[node - nx] : alongCols[node] || alongCols[node - 1]);
/** How many routes laid before run across a place's own run: at the lattice points on it, and at the one in front (`front`). */
const runCrossings = (grid, place, front) => [...(front ? [place.node] : []), ...place.between].filter((node) => crossedAt(grid, node, place.way % 2 === 0)).length;

/** How many routes laid before run across a port's run out (its `cuts`, which lie between lattice points): it cannot go round them, so it pays for each and says so. */
const cutCrossings = ({ alongCols, alongRows }, place) => (place.cuts ?? []).filter((key) => (key % 2 ? alongRows : alongCols)[Math.floor(key / 2)]).length;

/** The cheapest way over the lattice from one of `starts` to one of `ends` (places): {nodes, start, end, cost}, or null. `work`: {left}. */
function search(grid, starts, ends, step, seen, work) {
  const { nx, ny, closed, hidden, alongCols, alongRows, taken, cut, keptCols, keptRows, clear } = grid, stamp = (seen.turn += 1);
  // this link's own ports' runs out are not crossed either
  const own = new Set([...starts, ...ends].flatMap((p) => p.cuts ?? [])), crosses = (key) => cut.has(key) || own.has(key);
  // nor the lattice points on its own ports' runs out: a route does not hook back across the run it left by
  const onOwn = new Set([...starts, ...ends].flatMap((p) => (p.port ? p.between : [])));
  const goals = new Map(ends.map((p) => [p.node, p]));
  // how far a point is from the box round the points to reach, along the lattice: never more than the way still to go,
  // and one sum whatever the number of places (a thing thousands of tiles wide has thousands)
  const box = [Infinity, -Infinity, Infinity, -Infinity];
  for (const g of goals.keys()) { const i = g % nx, j = (g - i) / nx; box[0] = Math.min(box[0], i); box[1] = Math.max(box[1], i); box[2] = Math.min(box[2], j); box[3] = Math.max(box[3], j); }
  const far = (node) => { const i = node % nx, j = (node - i) / nx; return (Math.max(0, box[0] - i, i - box[1]) + Math.max(0, box[2] - j, j - box[3])) * step; };
  const lies = (p) => { const lanes = p.way % 2 === 0 ? alongCols : alongRows; return p.run.filter((stretch) => lanes[stretch]).length; };
  // what a place costs: its run (three times more over hidden floor), being off the foot's middle, being taken, lying
  // on another's stretch, and crossing the routes laid before — `front`: whether the lattice point's own crossing is its to pay
  // a place's run out of its foot (or its port's lead) over kept floor pays KEPT for its length, as a stretch does
  const nodeAt = (node) => [(grid.first[0] + node % nx) * step, (grid.first[1] + Math.floor(node / nx)) * step];
  const runKept = (p) => { if (!clear.length) return 0; const way = [p.at, ...(p.lead ?? []), nodeAt(p.node)]; work.left -= clear.length; return way.slice(1).some((q, k) => clear.some((area) => inArea(way[k], q, area))) ? KEPT * p.stub : 0; };
  const placeCost = (p, front) => runKept(p) + p.stub * (p.hidden ? 1 + HIDDEN : 1) + p.off * OFF_MIDDLE + p.turn + cutCrossings(grid, p) * CROSS + (taken.has(`${p.edge} ${p.at}`) ? SHARED : 0) + lies(p) * ALONG + runCrossings(grid, p, front) * CROSS;
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
      if (closed[to] || onOwn.has(to)) continue;
      const cols = next % 2 === 0, run = cols ? alongCols : alongRows;
      const stretch = next < 2 ? node : to;   // a stretch is kept at its lower end
      if (crosses(stretch * 2 + (cols ? 0 : 1))) continue;
      reach(to * 4 + next, cost + step + (next === way ? 0 : TURN) + pointCost(to) + ((cols ? keptCols : keptRows)[stretch] ? KEPT * step : 0) + (run[stretch] ? ALONG : 0) + (crossedAt(grid, to, cols) ? CROSS : 0), state);
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
  if (options !== undefined && options !== null && (typeof options !== 'object' || Array.isArray(options))) refuse(`routes takes its options as {hides, keep}, or none — not ${shown(options)}`);
  const { read, names } = readThings(things), wanted = readLinks(links), hides = option(options, 'hides', HIDES), keep = readKeep(option(options, 'keep', undefined));
  if (!(typeof hides === 'number' && hides >= 0 && hides <= 8)) refuse(`hides is the tiles of floor a thing hides behind it for each tile of its height, from 0 to 8 — not ${shown(hides)}`);
  const none = (from, to, why) => ({ from, to, points: null, why });
  if (!read.length) return wanted.map(([from, to]) => none(from.name, to.name, NO_ROUTE.name));
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
      const grid = lattice(read, lift, step, hides, work, (keep ?? []).filter((area) => area.lift === lift));
      seen ??= grid && { stamp: new Int32Array(grid.nx * grid.ny * 4), cost: new Float64Array(grid.nx * grid.ny * 4), from: new Int32Array(grid.nx * grid.ny * 4), turn: 0 };
      floors.set(lift, grid && { grid, places: new Map() });
    }
    return floors.get(lift);
  };
  return wanted.map(([fromEnd, toEnd]) => {
    const from = fromEnd.name, to = toEnd.name, a = read[names.get(from)], b = read[names.get(to)];
    if (!a || !b) return none(from, to, NO_ROUTE.name);
    const portA = fromEnd.port === null ? null : a.ports.find((q) => q.name === fromEnd.port), portB = toEnd.port === null ? null : b.ports.find((q) => q.name === toEnd.port);
    if (portA === undefined || portB === undefined) return none(from, to, NO_ROUTE.portName);
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
    // a port's places, or a thing's two seen feet
    const atPort = (thing, port) => portPlaces(thing, port, read, a.at[2], hides, grid, step, standsAt, hidesPoint, REACH, TURN, work);
    const startsAt = portA ? atPort(a, portA) : null, endsAt = portB ? atPort(b, portB) : null;
    if ((portA && !startsAt) || (portB && !endsAt)) return none(from, to, NO_ROUTE.work);
    // on a lattice made coarser than the finest step, an end with no place says the things stand too far apart: a port's
    // run out reaches the first lattice line in front, so a coarser lattice is what makes it long enough to meet a thing
    const coarse = step > fine;
    if (startsAt?.why || endsAt?.why) return none(from, to, coarse ? NO_ROUTE.wide : NO_ROUTE.port);
    const starts = portA ? startsAt.list : placesOf(a), ends = starts && (portB ? endsAt.list : placesOf(b));
    if (!starts || !ends) return none(from, to, NO_ROUTE.work);
    if (!starts.length || !ends.length) return none(from, to, coarse ? NO_ROUTE.wide : (portA && !starts.length) || (portB && !ends.length) ? NO_ROUTE.port : NO_ROUTE.foot);
    const found = search(grid, starts, ends, step, seen, work);
    if (!found) return none(from, to, work.left <= 0 ? NO_ROUTE.work : NO_ROUTE.way);
    // the way is kept: its stretches, so a later link takes the lane beside it, and its two places
    const { nx, alongCols, alongRows, taken, first } = grid, { nodes, start, end } = found;
    // what it crosses: at its first lattice point and along its two short runs, as on the way between
    const straightIn = nodes.length > 1 && (Math.abs(nodes.at(-1) - nodes.at(-2)) === 1) === (end.way % 2 === 0);
    let crosses = runCrossings(grid, start, true) + runCrossings(grid, end, !straightIn) + cutCrossings(grid, start) + cutCrossings(grid, end), shared = 0;
    for (const place of [start, end]) {
      const lanes = place.way % 2 === 0 ? alongCols : alongRows;
      if (taken.has(`${place.edge} ${place.at}`)) shared += place.stub;
      else shared += place.run.filter((stretch) => lanes[stretch]).length * step;
    }
    for (let k = 1; k < nodes.length; k += 1) {
      const cols = Math.abs(nodes[k] - nodes[k - 1]) === 1;
      if (crossedAt(grid, nodes[k], cols)) crosses += 1;
      if ((cols ? alongCols : alongRows)[Math.min(nodes[k], nodes[k - 1])]) shared += step;   // floor another route already runs along: only where there was no room beside it
    }
    for (let k = 1; k < nodes.length; k += 1) (Math.abs(nodes[k] - nodes[k - 1]) === 1 ? alongCols : alongRows)[Math.min(nodes[k], nodes[k - 1])] = 1;
    for (const place of [start, end]) {
      taken.add(`${place.edge} ${place.at}`);
      for (const stretch of place.run) (place.way % 2 === 0 ? alongCols : alongRows)[stretch] = 1;
      for (const cut of place.cuts ?? []) grid.cut.add(cut);   // a port's run out: no later route crosses it between two lattice points
    }
    const point = (node) => [(first[0] + node % nx) * step, (first[1] + Math.floor(node / nx)) * step];
    const all = [start.at, ...start.lead, ...nodes.map(point), ...[...end.lead].reverse(), end.at], points = all.filter((p, k) => k === 0 || k === all.length - 1 || (p[0] - all[k - 1][0]) * (all[k + 1][1] - p[1]) !== (p[1] - all[k - 1][1]) * (all[k + 1][0] - p[0]));
    // every thing that hides a point of it, and where along it — asked once for each point: the lattice points it stands on, those of
    // its two short runs, and its two feet (a foot is asked against every thing but its own: a round thing's foot is on its rim,
    // inside the square it stands on). One pass gives both answers, so saying where costs the search nothing more than saying who.
    // (a foot on a back side, a port's, is asked against its own thing too: that thing is between it and the viewer)
    const ownOf = (place, thing) => (place.port && !place.port.seen ? null : thing);
    const way = [[start.at, ownOf(start, a)], ...start.lead.map((p) => [p]), ...nodes.map((node) => [point(node)]), ...[...end.lead].reverse().map((p) => [p]), [end.at, ownOf(end, b)]];
    work.left -= way.length * read.length;
    const hiders = new Set(), unseen = [];
    let gone = 0;
    way.forEach(([[x, y], own], k) => {
      const step = k ? Math.abs(x - way[k - 1][0][0]) + Math.abs(y - way[k - 1][0][1]) : 0;
      gone += step;
      let hid = false;
      for (const thing of read) if (thing !== own && hidesPoint(thing, a.at[2], hides, x, y)) { hid = true; hiders.add(thing); }
      if (!hid) return;
      // the stretches of it that some thing hides, by how far along the way they are: a packet riding it can fade there, and a check can say how long
      const last = unseen.at(-1);
      if (last && Math.abs(last.upTo - (gone - step)) <= 1e-9) { last.upTo = gone; last.to = gone; } else unseen.push({ from: gone, to: gone, upTo: gone });
    });
    // a port on a back side is on a face turned from the viewer: its thing hides at least the plug, whatever of the floor is in view
    if (start.port && !start.port.seen) hiders.add(a);
    if (end.port && !end.port.seen) hiders.add(b);
    const behind = read.filter((thing) => hiders.has(thing)).map((thing) => thing.name);
    const tiles = points.reduce((sum, p, k) => (k ? sum + Math.abs(p[0] - points[k - 1][0]) + Math.abs(p[1] - points[k - 1][1]) : 0), 0);
    // a hidden point stands for the half step either side of it: a stretch is right to the nearest half step, not to the edge of what hides it
    const spans = unseen.map(({ from: lo, to: hi }) => [Math.max(0, lo - step / 2), Math.min(tiles, hi + step / 2)]);
    // the whole way in three dimensions: out of a port at its height, down to the floor, along it, and up into the other
    const lift = a.at[2], portPath = (thing, place) => {
      if (!place.port) return [];
      const { at: [c, r], size: [w, d] } = thing, [x, y, z] = place.port.at, { axis, sign } = SIDES[place.port.face];
      // (its line out where the places put it: on a lattice line when it was within a billionth of one)
      const plug = axis === 0 ? [sign > 0 ? c + w : c, place.along, lift + z] : [place.along, sign > 0 ? r + d : r, lift + z];
      return z > 1e-9 ? [plug, axis === 0 ? [plug[0] + sign * OUT, plug[1], plug[2]] : [plug[0], plug[1] + sign * OUT, plug[2]]] : [plug];
    };
    const path = [...portPath(a, start), ...points.map(([x, y]) => [x, y, lift]), ...portPath(b, end).reverse()];
    // the words it could not keep off: every kept area a stretch of its floor run passes strictly inside (its runs out of
    // its feet and its ports' leads too), by name or number, in the order given — there whenever `keep` is given
    let under = {};
    if (keep !== null) {
      const here = keep.filter((area) => area.lift === a.at[2]);
      work.left -= Math.max(0, points.length - 1) * here.length;
      under = { under: here.filter((area) => points.slice(1).some((q, k) => inArea(points[k], q, area))).map((area) => area.name ?? area.index + 1) };
    }
    return { from, to, points, path, feet: [start.edge, end.edge], ports: [start.port?.name ?? null, end.port?.name ?? null], bends: points.length - 2, tiles, behind, unseen: spans, crosses, shared, ...under };
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
