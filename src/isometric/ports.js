/**
 * Ports: named points on a thing's side where a link plugs in, and the places a route may leave or reach one at.
 *
 *   things: [{ name: 'sw', at: [9, 4], size: [4.7, 2, 0.4], ports: [{ name: 'p1', at: [0.4, 2, 0.3] }] }]
 *   links:  [[{ thing: 'lap', port: 'rj45' }, { thing: 'sw', port: 'p1' }]]
 *
 * A port is at [x, y, z] in the thing's own tiles — x along its width (the cols), y along its depth (the rows), z up
 * from its base — on one of its four sides. Which side is read from where the point is (x = width: `right`, the side
 * toward the lower right of the frame; y = depth: `left`, toward the lower left; x = 0: `back-left`; y = 0:
 * `back-right`); `face` names it, and must, where the point is on two (a corner). A route leaves a port straight out of
 * its side, drops to the floor (a riser, when the port is above the floor), runs out to the lattice, and from there along
 * the tile lines as any route does; it comes into the other end the same way, so the line ends on the port itself.
 *
 * WHY named points: where a cable plugs in is often the content (a laptop's port on its side, a switch's ports on its
 * front). WHY the side is read from the point: a model writes one number less, and a side named wrongly is caught. WHY
 * a port on a back side is allowed: a device's port can be there; the route is then behind its own thing at first, and
 * says so (`behind` names it), so a check can say how long it is hidden.
 *
 * Not here yet: a port on the top (a route would have to cross the top to leave it), and a port on a round thing.
 */
import { own, refuse, shown, fin } from './thing.js';

/** The most ports one thing has, and the longest port name. */
export const MOST_PORTS = 64;
const MOST_PORT_NAME = 60;
/** Tiles a route runs straight out of a port before it drops to the floor. */
export const OUT = 0.25;
/** The four sides a port may be on: the way out of each (0 cols on, 1 rows on, 2 cols back, 3 rows back), along which axis, and toward which end of it. */
export const SIDES = Object.freeze({ right: { way: 0, axis: 0, sign: 1 }, left: { way: 1, axis: 1, sign: 1 }, 'back-left': { way: 2, axis: 0, sign: -1 }, 'back-right': { way: 3, axis: 1, sign: -1 } });
const NAMES = Object.keys(SIDES);
const SEEN = new Set(['right', 'left']);
const near = (a, b) => Math.abs(a - b) <= 1e-9;

/** The sides a point [x, y] of a thing's footprint (wide × deep) is on. */
function sidesOf([x, y], [w, d]) {
  return [...(near(x, w) ? ['right'] : []), ...(near(y, d) ? ['left'] : []), ...(near(x, 0) ? ['back-left'] : []), ...(near(y, 0) ? ['back-right'] : [])];
}

/**
 * A thing's ports, checked: [{ name, at: [x, y, z], face, seen }] — its own (`size`: [wide, deep, high]), each on one
 * side. `round`: whether it is round (a round thing has none yet); `who` names the thing in a refusal. Absent: none.
 * A number within a billionth of a tile of a side, the floor or a lattice line is taken as on it.
 */
export function readPorts(given, size, round, who) {
  if (typeof who !== 'string') refuse(`readPorts names the thing it reads, as text — not ${shown(who)}`);
  if (!Array.isArray(size) || size.length !== 3 || ![0, 1, 2].every((k) => fin(own(size, k))) || !(own(size, 0) > 0 && own(size, 1) > 0 && own(size, 2) >= 0)) refuse(`${who}'s size is [wide, deep, high], wide and deep above 0 — not ${shown(size)}`);
  if (typeof round !== 'boolean') refuse(`${who}'s round says whether it is round, true or false — not ${shown(round)}`);
  if (given === undefined) return [];
  const count = Array.isArray(given) ? given.length : -1;   // read once: a list that grows while it is read is not read past its length
  if (count < 0 || count > MOST_PORTS) refuse(`${who}'s ports are a list of at most ${MOST_PORTS}, [{name, at: [x, y, z], face?}] — not ${shown(given)}`);
  if (round && count) refuse(`${who} is round, and a round thing has no ports yet: give the port to a block, or leave it out`);
  const out = [], names = new Set(), [w, d, h] = [own(size, 0), own(size, 1), own(size, 2)];
  for (let i = 0; i < count; i += 1) {
    const port = own(given, i), told = `${who}'s port ${i + 1}`;
    if (!port || typeof port !== 'object' || Array.isArray(port)) refuse(`${told} is {name, at: [x, y, z], face?} — not ${shown(port)}`);
    const name = own(port, 'name'), at = own(port, 'at'), face = own(port, 'face');
    if (typeof name !== 'string' || !name || name.length > MOST_PORT_NAME) refuse(`${told} has a name, some text of at most ${MOST_PORT_NAME} characters — not ${shown(name)}`);
    if (names.has(name)) refuse(`${who} has two ports named ${shown(name)}: a name tells one port from another`);
    const xyz = Array.isArray(at) && at.length === 3 ? [own(at, 0), own(at, 1), own(at, 2)] : null;
    if (!xyz || !xyz.every(fin)) refuse(`${who}'s port ${shown(name)} is at [x, y, z] in ${who}'s own tiles — not ${shown(at)}`);
    const [x, y, z] = xyz;
    if (x < -1e-9 || x > w + 1e-9 || y < -1e-9 || y > d + 1e-9 || z < -1e-9 || z > h + 1e-9) refuse(`${who}'s port ${shown(name)} is at ${shown(xyz)}, outside ${who} (x from 0 to ${w}, y from 0 to ${d}, z from 0 to ${h})`);
    if (face === 'top') refuse(`${who}'s port ${shown(name)} is on the top, and a port on the top is not routed yet: put it on a side (${NAMES.join(', ')})`);
    if (face !== undefined && !NAMES.includes(face)) refuse(`${who}'s port ${shown(name)} has the face ${shown(face)}: a side is ${NAMES.join(', ')} (left and right are the two sides that face the viewer)`);
    const on = sidesOf([x, y], [w, d]);
    if (!on.length) refuse(`${who}'s port ${shown(name)} is at ${shown(xyz)}, on no side of ${who}: x is 0 or ${w}, or y is 0 or ${d}`);
    if (face !== undefined && !on.includes(face)) refuse(`${who}'s port ${shown(name)} is at ${shown(xyz)}, on the ${on.join(' and ')} side, not ${face}: write face ${on[0]}, or move the point`);
    if (face === undefined && on.length > 1) refuse(`${who}'s port ${shown(name)} is at ${shown(xyz)}, a corner (the ${on.join(' and ')} sides): say which with its face`);
    names.add(name);
    // on its side exactly, and on the floor when it is within a billionth of it: no step of a billionth is ever drawn
    const side = face ?? on[0], snap = (v, to) => (near(v, to) ? to : v);
    const placed = [side === 'right' ? w : side === 'back-left' ? 0 : x, side === 'left' ? d : side === 'back-right' ? 0 : y, snap(z, 0)];
    out.push({ name, at: placed, face: side, seen: SEEN.has(side) });
  }
  return out;
}

/** Whether a straight stretch along the floor, from [x0, y0] to [x1, y1] (along one axis), passes over a thing's tiles. */
function overThing([x0, y0], [x1, y1], { at: [c, r], size: [w, d] }) {
  const [xa, xb] = [Math.min(x0, x1), Math.max(x0, x1)], [ya, yb] = [Math.min(y0, y1), Math.max(y0, y1)];
  return xa < c + w && xb > c && ya < r + d && yb > r;
}

/**
 * The places a route may leave or reach a port at: one when the port's line out meets a lattice line, else the two
 * lattice points either side of it on the first lattice line in front (a short run along that line, and a turn).
 * Each is shaped as a foot's place (routes.js · places), with `lead` the floor points between the port's floor point
 * and the lattice point, `turn` what the corner costs, `port` the port, and `cuts` the lattice stretches its run out
 * crosses (keys: a stretch's lower point × 2, + 1 along the rows): a route may not cross a port's run between two
 * lattice points, where no crossing could be counted. `along`: where the port's line out runs, its own number moved
 * onto a lattice line when it is within a billionth of one. Gives {list, along} or {why} (a NO_ROUTE key). `work`:
 * {left} — counted for each thing a place is asked against; null when it runs out.
 */
export function portPlaces(thing, port, read, lift, hides, { first, nx, ny, closed }, step, standsAt, hidesPoint, reach, turn, work) {
  const { at: [c, r], size: [w, d] } = thing, { axis, sign, way } = SIDES[port.face];
  const wall = axis === 0 ? (sign > 0 ? c + w : c) : (sign > 0 ? r + d : r), given = axis === 0 ? r + port.at[1] : c + port.at[0];
  const onLine = Math.abs(given / step - Math.round(given / step)) <= 1e-9, along = onLine ? Math.round(given / step) * step : given;
  const foot = wall + sign * OUT, k = sign > 0 ? Math.ceil((wall + reach) / step - 1e-9) : Math.floor((wall - reach) / step + 1e-9), line = k * step;
  const xy = (n, o) => (axis === 0 ? [n, o] : [o, n]), ij = (n, m) => (axis === 0 ? [n - first[0], m - first[1]] : [m - first[0], n - first[1]]);
  const at = xy(foot, along), corner = xy(line, along);
  const others = read.filter((t) => t !== thing && standsAt(t, lift));
  if (5 * read.length > work.left) return null;
  work.left -= 5 * read.length;
  // the run out to the lattice line passes over no other thing
  if (others.some((t) => overThing(xy(wall, along), corner, t))) return { why: 'port' };
  // the lattice lines across the run out, from its floor point (that one too) to the lattice line in front (not that one)
  const across = [];
  for (let n = k - sign; sign > 0 ? n * step >= foot - 1e-9 : n * step <= foot + 1e-9; n -= sign) across.push(n);
  const inside = ([i, j]) => i >= 0 && j >= 0 && i < nx && j < ny;
  const steps = onLine ? [Math.round(along / step)] : [Math.floor(along / step), Math.ceil(along / step)];
  const list = [];
  for (const m of steps) {
    const point = xy(line, m * step), [i, j] = ij(k, m);
    if (!inside([i, j]) || closed[j * nx + i]) continue;
    const jog = Math.abs(m * step - along);
    if (jog && others.some((t) => overThing(corner, point, t))) continue;
    // its way at the lattice point: straight out of the side, or along the line toward the point
    const jogWay = axis === 0 ? (m * step > along ? 1 : 3) : (m * step > along ? 0 : 2);
    // on a lattice line, its run out lies on the lattice as a foot's does: its stretches (`run`) and the points on it (`between`);
    // off one, the stretch of the line in front it runs along is its `run`, and the stretches its run out crosses are cut
    const run = [], between = [], cuts = [];
    if (onLine) {
      for (const n of across) {
        const [pi, pj] = ij(n, m), [qi, qj] = ij(n + sign, m);
        if (inside([pi, pj])) between.push(pj * nx + pi);
        if (inside([pi, pj]) && inside([qi, qj])) run.push(Math.min(pj * nx + pi, qj * nx + qi));
      }
    } else {
      const low = Math.floor(along / step), [li, lj] = ij(k, low);
      if (inside([li, lj]) && inside(ij(k, low + 1))) run.push(lj * nx + li);
      for (const n of across) { const [pi, pj] = ij(n, low); if (inside([pi, pj]) && inside(ij(n, low + 1))) cuts.push((pj * nx + pi) * 2 + (axis === 0 ? 1 : 0)); }
    }
    const lead = jog ? [corner] : [];
    // hidden: its floor point or its corner is behind a thing — its own too, when the port is on a back side
    const hidden = [at, ...lead].some(([x, y]) => read.some((t) => (t !== thing || !port.seen) && hidesPoint(t, lift, hides, x, y)));
    list.push({ edge: port.face, at, node: j * nx + i, way: jog ? jogWay : way, stub: Math.abs(line - foot) + jog, run, between, lead, hidden, off: 0, turn: jog ? turn : 0, port, cuts, along });
  }
  return list.length ? { list } : { why: 'port' };
}
