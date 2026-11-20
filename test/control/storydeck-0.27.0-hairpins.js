/** A U-turn whose middle stretch is shorter than this many tiles is a hairpin; a longer one goes round something. */
const TIGHT_U = 0.5;
/** A cable that runs back past its port within this many tiles of it has doubled back there. */
const NEAR_PORT = 2;
/** A stretch shorter than this many tiles is a jog onto the floor's lines, a few px on the slide: no turn to speak of. */
const JOG = 0.1;
/** A port faces the cable's other end only when its way out is within about 70° of it (cos above this). */
const FACING = 0.3;
const HAIRPIN_WORDS = ['start', 'end', 'start-hook', 'end-hook', 'middle'];
/**
 * Where a cable doubles back on itself, seen from above — `path` its points in tiles, [col, row, height] (the kit's
 * `route.path`, risers included), `ports` the port at each end (or null):
 *   'start'        it leaves its first port one way and, within NEAR_PORT tiles, runs back the other — and the port
 *                  faces away from the cable's other end, or sideways to it: the port is on the wrong side
 *   'start-hook'   the same, but the port faces the other end: a short loop near it (the router's lanes or lines)
 *   'end', 'end-hook'   the same at its last port
 *   'middle'       a tight U on the floor: two stretches of TIGHT_U or more, one each way, with less than TIGHT_U between
 * Asked at a port end only: out of a foot a cable steps half a tile off the block and may step back to change lanes,
 * which is no reversal on the slide. A riser is upright, so it is no stretch here; a jog shorter than JOG is none
 * either; stretches one way in a row are one. A wide U (out of a port more than NEAR_PORT tiles before turning back)
 * is a way round, and not said. On the slide a reversal on the floor is one too (the floor is drawn by a linear map).
 */
export function hairpins(path, ports = []) {
  const flat = [];
  for (const [col, row] of path) if (!flat.length || Math.hypot(col - flat.at(-1)[0], row - flat.at(-1)[1]) > 1e-6) flat.push([col, row]);
  const runs = [];
  for (let i = 1; i < flat.length; i++) {
    const dc = flat[i][0] - flat[i - 1][0], dr = flat[i][1] - flat[i - 1][1], len = Math.hypot(dc, dr), u = [dc / len, dr / len], last = runs.at(-1);
    if (len < JOG) continue;
    if (last && last.u[0] * u[0] + last.u[1] * u[1] > 0.99) last.len += len; else runs.push({u, len});
  }
  if (!runs.length) return [];
  const back = (a, b) => a.u[0] * b.u[0] + a.u[1] * b.u[1] < -0.99;
  /** Whether, leaving from the first of `list`, a later stretch runs back within NEAR_PORT tiles of travel. */
  const turnsBack = (list) => { let gone = list[0].len; for (let i = 1; i < list.length && gone <= NEAR_PORT; i++) { if (back(list[0], list[i])) return true; gone += list[i].len; } return false; };
  // whether a port's way out faces away from the cable's other end
  const across = [flat.at(-1)[0] - flat[0][0], flat.at(-1)[1] - flat[0][1]];
  // (sideways counts as away: a port at a right angle to the way loops out of it as one turned away does, and the fix is the same)
  const span = Math.hypot(...across) || 1, away = (u, sign) => sign * (u[0] * across[0] + u[1] * across[1]) / span <= FACING;
  const flipped = [...runs].reverse().map(({u, len}) => ({u: [-u[0], -u[1]], len}));
  const out = [];
  if (ports[0] && turnsBack(runs)) out.push(away(runs[0].u, 1) ? 'start' : 'start-hook');
  const first = ports[0] ? 2 : 1, last = runs.length - (ports[1] ? 3 : 2);
  for (let i = first; i + 2 <= last; i++) {
    if (runs[i + 1].len < TIGHT_U && runs[i].len >= TIGHT_U && runs[i + 2].len >= TIGHT_U && back(runs[i], runs[i + 2])) { out.push('middle'); break; }
  }
  if (ports[1] && turnsBack(flipped)) out.push(away(flipped[0].u, -1) ? 'end' : 'end-hook');
  return out;
}
