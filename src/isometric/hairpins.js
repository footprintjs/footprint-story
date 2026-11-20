/**
 * Hairpins: where a route doubles back on itself, seen from above. A route that leaves a port one way and runs straight
 * back the other reads on the picture as a loop out of nowhere; whoever wrote the picture can fix it (move the port,
 * turn the thing) once told where. This says where, in a word — what to say about it is the tool's.
 *
 *   hairpins(route.path, route.ports)   → [] | ['start'] | ['middle', 'end-hook'] | …
 *
 * WHY its own file and not inside `routes`: it reads a finished way (any [col, row, height] points), so a film, a deck
 * and a check ask it of the same way and agree; and a route's own fields stay what they were. It came from StoryDeck
 * 0.27.0 (deck/cable.js · hairpins), unchanged in what it gives for what that gave it (a property test against a copy
 * of that code, test/control/); what is new is that every number is checked.
 */
import { fin, own, refuse, shown, stored } from './thing.js';

/** A U-turn whose middle stretch is shorter than this many tiles is a hairpin; a longer one goes round something. */
const TIGHT_U = 0.5;
/** A route that runs back past its port within this many tiles of it has doubled back there. */
const NEAR_PORT = 2;
/** A stretch shorter than this many tiles is a jog onto the floor's lines, a few px on the frame: no turn to speak of. */
const JOG = 0.1;
/** A port faces the route's other end only when its way out is within about 70° of it (cos above this). */
const FACING = 0.3;
/** What `hairpins` may say, in the order it says it (a route says each at most once). */
export const HAIRPINS = Object.freeze(['start', 'start-hook', 'middle', 'end', 'end-hook']);

/** A way's points read by their own stored values: [[col, row], …] (a height, when given, is read and left out: a riser is upright). */
function readPath(path) {
  if (!Array.isArray(path)) refuse(`hairpins takes a way, [[col, row, height?], …] — not ${shown(path)}`);
  return Array.from({ length: path.length }, (_, i) => {
    const p = Object.hasOwn(path, i) ? own(path, i) : undefined, n = Array.isArray(p) && (p.length === 2 || p.length === 3) ? Array.from({ length: p.length }, (_, k) => own(p, k)) : null;
    if (!n || !n.every(fin)) refuse(`point ${i + 1} of a way is [col, row] or [col, row, height], numbers no further than 1000000 from 0 — not ${shown(p)}`);
    return [n[0], n[1]];
  });
}

/** The port at each end, as `routes` gives them: [port | null, port | null] (fewer: the rest null). Only whether each end is a port is read. */
function readEnds(ports) {
  if (ports === undefined || ports === null) return [false, false];
  if (!Array.isArray(ports) || ports.length > 2) refuse(`a way's ports are [port, port], each a port's name or null — not ${shown(ports)}`);
  return [0, 1].map((k) => {
    const p = k < ports.length ? stored(ports, k, `a way's port ${k + 1}`) : null;
    if (p !== null && p !== undefined && typeof p !== 'string') refuse(`a way's ports are [port, port], each a port's name or null — not ${shown(ports)}`);
    return Boolean(p);
  });
}

/**
 * Where a way doubles back on itself, seen from above — `path` its points in tiles, [col, row, height?] (a route's
 * `path`, risers included), `ports` the port at each end (a route's `ports`; null or left out for a foot):
 *   'start'        it leaves its first port one way and, within NEAR_PORT tiles, runs back the other — and the port
 *                  faces away from the way's other end, or sideways to it: the port is on the wrong side
 *   'start-hook'   the same, but the port faces the other end: a short loop near it (the router's lanes or lines)
 *   'end', 'end-hook'   the same at its last port
 *   'middle'       a tight U on the floor: two stretches of TIGHT_U or more, one each way, with less than TIGHT_U between
 * Asked at a port end only: out of a foot a route steps half a tile off the thing and may step back to change lanes,
 * which is no reversal on the frame. A riser is upright, so it is no stretch here; a jog shorter than JOG is none
 * either; stretches one way in a row are one. A wide U (out of a port more than NEAR_PORT tiles before turning back)
 * is a way round, and not said. On the frame a reversal on the floor is one too (the floor is drawn by a linear map).
 * In the order 'start' | 'start-hook', then 'middle', then 'end' | 'end-hook'; [] when it doubles back nowhere.
 */
export function hairpins(path, ports = []) {
  const points = readPath(path), [startPort, endPort] = readEnds(ports);
  const flat = [];
  for (const [col, row] of points) if (!flat.length || Math.hypot(col - flat.at(-1)[0], row - flat.at(-1)[1]) > 1e-6) flat.push([col, row]);
  const runs = [];
  for (let i = 1; i < flat.length; i++) {
    const dc = flat[i][0] - flat[i - 1][0], dr = flat[i][1] - flat[i - 1][1], len = Math.hypot(dc, dr), u = [dc / len, dr / len], last = runs.at(-1);
    if (len < JOG) continue;
    if (last && last.u[0] * u[0] + last.u[1] * u[1] > 0.99) last.len += len; else runs.push({ u, len });
  }
  if (!runs.length) return [];
  const back = (a, b) => a.u[0] * b.u[0] + a.u[1] * b.u[1] < -0.99;
  /** Whether, leaving from the first of `list`, a later stretch runs back within NEAR_PORT tiles of travel. */
  const turnsBack = (list) => { let gone = list[0].len; for (let i = 1; i < list.length && gone <= NEAR_PORT; i++) { if (back(list[0], list[i])) return true; gone += list[i].len; } return false; };
  // whether a port's way out faces away from the way's other end
  const across = [flat.at(-1)[0] - flat[0][0], flat.at(-1)[1] - flat[0][1]];
  // (sideways counts as away: a port at a right angle to the way loops out of it as one turned away does, and the fix is the same)
  const span = Math.hypot(...across) || 1, away = (u, sign) => sign * (u[0] * across[0] + u[1] * across[1]) / span <= FACING;
  const flipped = [...runs].reverse().map(({ u, len }) => ({ u: [-u[0], -u[1]], len }));
  const out = [];
  if (startPort && turnsBack(runs)) out.push(away(runs[0].u, 1) ? 'start' : 'start-hook');
  const first = startPort ? 2 : 1, last = runs.length - (endPort ? 3 : 2);
  for (let i = first; i + 2 <= last; i++) {
    if (runs[i + 1].len < TIGHT_U && runs[i].len >= TIGHT_U && runs[i + 2].len >= TIGHT_U && back(runs[i], runs[i + 2])) { out.push('middle'); break; }
  }
  if (endPort && turnsBack(flipped)) out.push(away(flipped[0].u, -1) ? 'end' : 'end-hook');
  return out;
}
