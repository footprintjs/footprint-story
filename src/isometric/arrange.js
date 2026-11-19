/**
 * Arrange: where things stand on the floor, worked out from what is joined to what — so whoever writes the picture
 * says "the browser asks the server, the server asks the database" and never types a place.
 *
 *   arrange(things, links, {gap?})  → {things: [{name, at: [col, row, 0], size}], cols, rows}
 *
 * `things` are [{name, size: [wide, deep, high]}], `links` are [[from, to], …] by name. A joined thing stands one step
 * further along the cols than what leads to it, so a chain reads from the far corner towards the viewer's right; things
 * led to from the same place stand side by side along the rows, as near the middle of what they are joined to as the
 * gaps allow. Things joined to nothing stand in a row of their own behind the rest. The same things and links always
 * give the same places: among equals, the one given first comes first.
 *
 * HOW (each step has its source in REFERENCES.md):
 *   1. A ring of links (a to b to a) has no first thing, so one link of it is read the other way round: the link that
 *      closes the ring, walking the things in the order given.
 *   2. Steps: a thing stands one step after the furthest-on thing that leads to it. A thing nothing leads to waits
 *      one step before the nearest thing it leads to, so its link is short.
 *   3. Order within a step: each thing goes towards the middle of the things it is joined to in the step before (then
 *      the step after), a few times over, keeping the order with the fewest links that cross.
 *   4. Rows: each thing wants its middle on the middle of what it is joined to. Within a step the things keep their
 *      order and their gaps, and stand as near what they want as that allows — exactly, by least squares.
 *   5. Everything is on the half tile: a slot is the thing's size rounded up to a half, and the thing stands in its middle.
 *
 * WHY not just a row: joined things in a row put every link through the things between. WHY least squares for the
 * rows: two things led to from one place then stand evenly either side of it, which is what a person would draw.
 * Not here: links that skip a step are not kept clear of the things between, and nothing is placed by its height.
 *
 * Pure numbers. Every value may come from anyone: each is read by its own stored value, bounded, and a refusal says
 * what to give.
 */
import { MOST_ISOMETRIC_THINGS } from './order.js';
import { numbers, own, refuse, shown } from './thing.js';

/** The most links one arrangement reads. */
export const MOST_LINKS = 1024;
/** The biggest a thing may be, in tiles, and the longest name. */
const MOST_SIZE = 64, MOST_NAME = 200;
/** How often the order within the steps is gone over, down the steps and back. */
const SWEEPS = 4;

/** A length rounded up to a half tile (what is a half already stays one). */
const half = (n) => Math.ceil(n * 2 - 1e-9) / 2;
const mean = (list) => list.reduce((a, b) => a + b, 0) / list.length;

/** The things, read: [{name, size}] and each name's place in the list. */
function readThings(things) {
  if (!Array.isArray(things)) refuse(`arrange takes a list of things, [{name, size: [wide, deep, high]}] — not ${shown(things)}`);
  if (things.length > MOST_ISOMETRIC_THINGS) refuse(`arrange places at most ${MOST_ISOMETRIC_THINGS} things, not ${things.length}`);
  const list = [], names = new Map();
  for (let i = 0; i < things.length; i += 1) {
    const thing = own(things, i);
    if (!thing || typeof thing !== 'object' || Array.isArray(thing)) refuse(`thing ${i + 1} is {name, size: [wide, deep, high]} — not ${shown(thing)}`);
    const name = own(thing, 'name');
    if (typeof name !== 'string' || !name || name.length > MOST_NAME) refuse(`thing ${i + 1} has a name, some text of at most ${MOST_NAME} characters — not ${shown(name)}`);
    if (names.has(name)) refuse(`two things are named ${shown(name)}: a name tells one thing from another`);
    const size = numbers(own(thing, 'size'), [3], `${shown(name)}'s size`, '[wide, deep, high], in tiles');
    if (!(size[0] > 0 && size[1] > 0 && size[2] >= 0 && size.every((v) => v <= MOST_SIZE))) refuse(`${shown(name)}'s size is [wide, deep, high] with wide and deep above 0, high 0 or more, none over ${MOST_SIZE} — not ${shown(size)}`);
    names.set(name, i);
    list.push({ name, size });
  }
  return { list, names };
}

/**
 * The links, read as pairs of places in the list: one a pair of things (the first given), none from a thing to itself,
 * none to a name that is not a thing here (a link may join things this arrangement does not place).
 */
function readLinks(links, names, n) {
  if (!Array.isArray(links)) refuse(`arrange takes a list of links, [[from, to], …] by name — not ${shown(links)}`);
  if (links.length > MOST_LINKS) refuse(`arrange reads at most ${MOST_LINKS} links, not ${links.length}`);
  const seen = new Set(), out = [];
  for (let i = 0; i < links.length; i += 1) {
    const link = own(links, i), from = Array.isArray(link) && link.length === 2 ? own(link, 0) : undefined, to = from === undefined ? undefined : own(link, 1);
    if (typeof from !== 'string' || typeof to !== 'string') refuse(`link ${i + 1} is [from, to], the names of two things — not ${shown(link)}`);
    const u = names.get(from), v = names.get(to);
    if (u === undefined || v === undefined || u === v || seen.has(u * n + v) || seen.has(v * n + u)) continue;
    seen.add(u * n + v);
    out.push([u, v]);
  }
  return out;
}

/** The links with no ring among them: walking the things as given, a link that closes a ring is read the other way round. */
function withoutRings(n, links) {
  const out = Array.from({ length: n }, () => []), state = new Array(n).fill(0), kept = [];   // 0 not met, 1 being walked, 2 done
  for (const [u, v] of links) out[u].push(v);
  const walk = (u) => {
    state[u] = 1;
    for (const v of out[u]) {
      if (state[v] === 1) { kept.push([v, u]); continue; }
      kept.push([u, v]);
      if (state[v] === 0) walk(v);
    }
    state[u] = 2;
  };
  for (let u = 0; u < n; u += 1) if (state[u] === 0) walk(u);
  return kept;
}

/** Each joined thing's step: one after the furthest-on thing that leads to it; a thing nothing leads to, one before the nearest it leads to. */
function stepsOf(n, links) {
  const from = Array.from({ length: n }, () => []), to = Array.from({ length: n }, () => []), waits = new Array(n).fill(0), step = new Array(n).fill(0);
  for (const [u, v] of links) { to[u].push(v); from[v].push(u); waits[v] += 1; }
  const ready = [];
  for (let v = 0; v < n; v += 1) if (waits[v] === 0) ready.push(v);
  for (let i = 0; i < ready.length; i += 1) {   // what waits for nothing, again and again: no ring is left to stop it
    const u = ready[i];
    for (const v of to[u]) {
      step[v] = Math.max(step[v], step[u] + 1);
      waits[v] -= 1;
      if (waits[v] === 0) ready.push(v);
    }
  }
  for (let v = 0; v < n; v += 1) if (!from[v].length && to[v].length) step[v] = Math.min(...to[v].map((w) => step[w])) - 1;
  return { step, from, to };
}

/** How many pairs of links cross, among links that join the same two steps. `place[v]` is where v stands in its step. */
function crossings(links, step, place) {
  let count = 0;
  for (let i = 0; i < links.length; i += 1) for (let j = i + 1; j < links.length; j += 1) {
    const [a, b] = links[i], [c, d] = links[j];
    if (step[a] === step[c] && step[b] === step[d] && (place[a] - place[c]) * (place[b] - place[d]) < 0) count += 1;
  }
  return count;
}

/** The order within each step with the fewest crossing links found: [[thing, …] a step]. */
function orderSteps(joined, links, { step, from, to }) {
  const count = Math.max(...joined.map((v) => step[v])) + 1, rows = Array.from({ length: count }, () => []);
  for (const v of joined) rows[step[v]].push(v);   // as given, to begin with
  const place = [];   // where a thing stands in its step, from 0 to 1: steps of different lengths compare
  const stand = () => { for (const row of rows) row.forEach((v, i) => { place[v] = (i + 0.5) / row.length; }); };
  const towards = (row, others) => {
    const wants = new Map(row.map((v) => [v, others[v].length ? mean(others[v].map((w) => place[w])) : place[v]]));
    row.sort((a, b) => wants.get(a) - wants.get(b) || place[a] - place[b]);   // equals keep the order they had
  };
  stand();
  let best = rows.map((row) => [...row]), fewest = crossings(links, step, place);
  for (let sweep = 0; sweep < SWEEPS && fewest > 0; sweep += 1) {
    for (let k = 1; k < count; k += 1) { towards(rows[k], from); stand(); }
    for (let k = count - 2; k >= 0; k -= 1) { towards(rows[k], to); stand(); }
    const now = crossings(links, step, place);
    if (now < fewest) { fewest = now; best = rows.map((row) => [...row]); }
  }
  return best;
}

/**
 * Where the things of one step start along the rows: each as near the middle it wants as the order and the gaps allow,
 * by least squares. With `before[i]` what stands before thing i, start[i] − before[i] must never fall from one thing
 * to the next: neighbours that would are pooled, and share the mean of what they want.
 */
export function settle(depths, wanted, gap) {
  const before = [];
  let sum = 0;
  for (const depth of depths) { before.push(sum); sum += depth + gap; }
  const pools = [];
  depths.forEach((depth, i) => {
    pools.push({ total: wanted[i] - depth / 2 - before[i], count: 1 });
    while (pools.length > 1 && pools.at(-2).total / pools.at(-2).count > pools.at(-1).total / pools.at(-1).count) {
      const last = pools.pop();
      pools.at(-1).total += last.total;
      pools.at(-1).count += last.count;
    }
  });
  return pools.flatMap((pool) => new Array(pool.count).fill(pool.total / pool.count)).map((value, i) => value + before[i]);
}

/** The joined things placed: [col, row] of each one's slot, by its place in the list. */
function placeJoined(rows, slots, gap, { from, to }) {
  const start = [], middle = (v) => start[v] + slots[v][1] / 2;
  for (const row of rows) {   // to begin with, every step packed and centred on one line
    let at = -(row.reduce((sum, v) => sum + slots[v][1], 0) + gap * (row.length - 1)) / 2;
    for (const v of row) { start[v] = at; at += slots[v][1] + gap; }
  }
  const pull = (row, others) => {
    const wanted = row.map((v) => (others[v].length ? mean(others[v].map(middle)) : middle(v)));
    settle(row.map((v) => slots[v][1]), wanted, gap).forEach((value, i) => { start[row[i]] = value; });
  };
  for (let k = 1; k < rows.length; k += 1) pull(rows[k], from);
  for (let k = rows.length - 2; k >= 0; k -= 1) pull(rows[k], to);
  for (let k = 1; k < rows.length; k += 1) pull(rows[k], from);
  const place = [];
  let col = 0;
  for (const row of rows) {
    const wide = Math.max(...row.map((v) => slots[v][0]));
    // onto the half tile without losing a gap: what is rounded is each thing's start less what stands before it, which never falls along the step
    let before = 0;
    for (const v of row) {
      // in the middle of its step, to the half tile (a quarter would put it between the floor's lines)
      place[v] = [col + Math.floor(wide - slots[v][0]) / 2, Math.round((start[v] - before) * 2) / 2 + before];
      before += slots[v][1] + gap;
    }
    col += wide + gap;
  }
  return place;
}

/** Things joined to nothing, in rows behind the rest: as wide as the rest (or near a square, when there is no rest). */
function placeLoose(loose, slots, gap, { cols, rows }) {
  const place = [], perRow = Math.ceil(Math.sqrt(loose.length));
  let col = 0, row = rows ? rows + gap : 0, deep = 0, inRow = 0;
  for (const v of loose) {
    if (inRow && (cols ? col + slots[v][0] > cols : inRow === perRow)) { col = 0; row += deep + gap; deep = 0; inRow = 0; }
    place[v] = [col, row];
    col += slots[v][0] + gap;
    deep = Math.max(deep, slots[v][1]);
    inRow += 1;
  }
  return place;
}

/**
 * Where things stand, from what is joined to what. `things`: [{name, size: [wide, deep, high]}]; `links`: [[from, to]]
 * by name; `gap`: the tiles left between two things (1). Gives {things: [{name, at: [col, row, 0], size}], cols, rows}
 * — the things in the order given, each standing on the floor, the nearest corner of the arrangement at [0, 0] and its
 * far corner at [cols, rows].
 */
export function arrange(things, links = [], { gap = 1 } = {}) {
  if (!(typeof gap === 'number' && gap >= 0 && gap <= MOST_SIZE)) refuse(`gap is the tiles left between two things, from 0 to ${MOST_SIZE} — not ${shown(gap)}`);
  const { list, names } = readThings(things), n = list.length, between = half(gap);
  const all = withoutRings(n, readLinks(links, names, n)), graph = stepsOf(n, all);
  const slots = list.map(({ size }) => [half(size[0]), half(size[1])]);
  const isJoined = list.map((_, v) => graph.from[v].length + graph.to[v].length > 0);
  const joined = list.map((_, v) => v).filter((v) => isJoined[v]), loose = list.map((_, v) => v).filter((v) => !isJoined[v]);
  const lowest = joined.length ? Math.min(...joined.map((v) => graph.step[v])) : 0;
  for (const v of joined) graph.step[v] -= lowest;   // a thing that waits before step 0 makes its step the first
  const place = joined.length ? placeJoined(orderSteps(joined, all, graph), slots, between, graph) : [];
  const top = joined.length ? Math.min(...joined.map((v) => place[v][1])) : 0;
  for (const v of joined) place[v][1] -= top;
  const reach = (list_, axis) => (list_.length ? Math.max(...list_.map((v) => place[v][axis] + slots[v][axis])) : 0);
  placeLoose(loose, slots, between, { cols: reach(joined, 0), rows: reach(joined, 1) }).forEach((at, v) => { place[v] = at; });
  const placed = list.map(({ name, size }, v) => Object.freeze({ name, size: Object.freeze([...size]),
    at: Object.freeze([place[v][0] + (slots[v][0] - size[0]) / 2, place[v][1] + (slots[v][1] - size[1]) / 2, 0]) }));   // in the middle of its slot
  const everything = list.map((_, v) => v);
  return Object.freeze({ things: Object.freeze(placed), cols: reach(everything, 0), rows: reach(everything, 1) });
}
