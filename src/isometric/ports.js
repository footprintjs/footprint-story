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
 * A thing's ports, checked: [{ name, at: [x, y, z], face }] — its own (`size`: [wide, deep, high]), each on one side.
 * `who` names the thing in a refusal. Absent: none.
 */
export function readPorts(given, size, round, who) {
  if (given === undefined) return [];
  if (!Array.isArray(given) || given.length > MOST_PORTS) refuse(`${who}'s ports are a list of at most ${MOST_PORTS}, [{name, at: [x, y, z], face?}] — not ${shown(given)}`);
  if (round && given.length) refuse(`${who} is round, and a round thing has no ports yet: give the port to a block, or leave it out`);
  const out = [], names = new Set();
  for (let i = 0; i < given.length; i += 1) {
    const port = own(given, i), told = `${who}'s port ${i + 1}`;
    if (!port || typeof port !== 'object' || Array.isArray(port)) refuse(`${told} is {name, at: [x, y, z], face?} — not ${shown(port)}`);
    const name = own(port, 'name'), at = own(port, 'at'), face = own(port, 'face');
    if (typeof name !== 'string' || !name || name.length > MOST_PORT_NAME) refuse(`${told} has a name, some text of at most ${MOST_PORT_NAME} characters — not ${shown(name)}`);
    if (names.has(name)) refuse(`${who} has two ports named ${shown(name)}: a name tells one port from another`);
    const xyz = Array.isArray(at) && at.length === 3 ? [own(at, 0), own(at, 1), own(at, 2)] : null;
    if (!xyz || !xyz.every(fin)) refuse(`${who}'s port ${shown(name)} is at [x, y, z] in ${who}'s own tiles — not ${shown(at)}`);
    const [x, y, z] = xyz, [w, d, h] = size;
    if (x < -1e-9 || x > w + 1e-9 || y < -1e-9 || y > d + 1e-9 || z < -1e-9 || z > h + 1e-9) refuse(`${who}'s port ${shown(name)} is at ${shown(xyz)}, outside ${who} (x from 0 to ${w}, y from 0 to ${d}, z from 0 to ${h})`);
    if (face === 'top') refuse(`${who}'s port ${shown(name)} is on the top, and a port on the top is not routed yet: put it on a side (${NAMES.join(', ')})`);
    if (face !== undefined && !NAMES.includes(face)) refuse(`${who}'s port ${shown(name)} has the face ${shown(face)}: a side is ${NAMES.join(', ')} (left and right are the two sides that face the viewer)`);
    const on = sidesOf([x, y], [w, d]);
    if (!on.length) refuse(`${who}'s port ${shown(name)} is at ${shown(xyz)}, on no side of ${who}: x is 0 or ${w}, or y is 0 or ${d}`);
    if (face !== undefined && !on.includes(face)) refuse(`${who}'s port ${shown(name)} is at ${shown(xyz)}, on the ${on.join(' and ')} side, not ${face}: write face ${on[0]}, or move the point`);
    if (face === undefined && on.length > 1) refuse(`${who}'s port ${shown(name)} is at ${shown(xyz)}, a corner (the ${on.join(' and ')} sides): say which with its face`);
    names.add(name);
    out.push({ name, at: xyz, face: face ?? on[0], seen: SEEN.has(face ?? on[0]) });
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
 * and the lattice point, `turn` what the corner costs, and `port` the port. Gives {list} or {why} (a NO_ROUTE key).
 * `work`: {left} — a look for each thing a place is asked against; null when it runs out.
 */
export function portPlaces(thing, port, read, lift, hides, { first, nx, ny, closed }, step, standsAt, hidesPoint, reach, turn, work) {
  const { at: [c, r], size: [w, d] } = thing, { axis, sign, way } = SIDES[port.face];
  const wall = axis === 0 ? (sign > 0 ? c + w : c) : (sign > 0 ? r + d : r), along = axis === 0 ? r + port.at[1] : c + port.at[0];
  const foot = wall + sign * OUT, k = sign > 0 ? Math.ceil((wall + reach) / step - 1e-9) : Math.floor((wall - reach) / step + 1e-9), line = k * step;
  const xy = (n, o) => (axis === 0 ? [n, o] : [o, n]);
  const at = xy(foot, along), corner = xy(line, along);
  const others = read.filter((t) => t !== thing && standsAt(t, lift));
  if (read.length > work.left) return null;
  work.left -= read.length;
  // the run out to the lattice line passes over no other thing
  if (others.some((t) => overThing(xy(wall, along), corner, t))) return { why: 'port' };
  const onLine = Math.abs(along / step - Math.round(along / step)) <= 1e-9;
  const steps = onLine ? [Math.round(along / step)] : [Math.floor(along / step), Math.ceil(along / step)];
  const list = [];
  for (const m of steps) {
    const point = xy(line, m * step), [i, j] = axis === 0 ? [k - first[0], m - first[1]] : [m - first[0], k - first[1]];
    if (i < 0 || j < 0 || i >= nx || j >= ny || closed[j * nx + i]) continue;
    const jog = Math.abs(m * step - along);
    if (jog && others.some((t) => overThing(corner, point, t))) continue;
    // its way at the lattice point: straight out of the side, or along the line toward the point
    const jogWay = axis === 0 ? (m * step > along ? 1 : 3) : (m * step > along ? 0 : 2);
    const lead = jog ? [corner] : [];
    // hidden: its floor point or its corner is behind a thing — its own too, when the port is on a back side
    const hidden = [at, ...lead].some(([x, y]) => read.some((t) => (t !== thing || !port.seen) && hidesPoint(t, lift, hides, x, y)));
    list.push({ edge: port.face, at, node: j * nx + i, way: jog ? jogWay : way, stub: Math.abs(line - foot) + jog, run: [], between: [], lead, hidden, off: 0, turn: jog ? turn : 0, port });
  }
  return list.length ? { list } : { why: 'port' };
}
