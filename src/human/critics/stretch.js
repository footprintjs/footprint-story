/**
 * The `stretch` critic: the longest any link of a drawn chain is past its length, as a share of it — read on the track's
 * `points` against the link length the plan names (`rest`). A rope that stretches like elastic between frames stops
 * reading as a rope. The chain model holds its links within CHAIN_LENGTH_TOLERANCE by construction (sub-steps and a
 * relaxation pass per link); this says so on the record, and says it when a tool's own chain does not.
 */
import { CHAIN_LENGTH_TOLERANCE } from '../physics/chain.js';
import { basePlan } from '../models/wrap.js';
import { finite, isRecord } from '../read.js';

/** The fix by what stretched it, in the intent's own keys. */
const FIXES = Object.freeze({
  path: 'slow its pin: put its path keys further apart in time (path: [[t, x, y], …]), or fewer, longer links',
  world: 'give it room: move the boxes or the floor out of its swing (boxes, floor), or fewer, longer links',
  gravity: "fewer, longer links (model: {name: 'verlet', links: 8}) or less gravity (model: {name: 'verlet', gravity: 1960})",
});

export const stretch = Object.freeze({
  name: 'stretch',
  limit: CHAIN_LENGTH_TOLERANCE,
  measure(track) {
    const base = track.plan ? basePlan(track.plan) : null, rest = base?.rest;
    if (!(finite(rest) && rest > 0)) return null;   // no link length named: nothing to stretch
    let most = 0, at = null, link = null;
    for (const s of track.samples) {
      if (!Array.isArray(s.points)) continue;
      for (let i = 1; i < s.points.length; i += 1) {
        const v = (Math.hypot(s.points[i][0] - s.points[i - 1][0], s.points[i][1] - s.points[i - 1][1]) - rest) / rest;
        if (v > most) { most = v; at = s.t; link = i - 1; }
      }
    }
    // the cause, from the plan: a pin moved along a path, something in the way, or else gravity on the links
    const world = base.world, crowded = isRecord(world) && ((world.floor !== null && world.floor !== undefined) || (Array.isArray(world.boxes) && world.boxes.length > 0));
    const cause = base.basis?.pathKeys > 0 ? 'path' : crowded ? 'world' : 'gravity';
    return { value: most, basis: { at, link, rest, cause } };
  },
  finding(value, who, basis) {
    if (!(value > CHAIN_LENGTH_TOLERANCE)) return null;
    return { level: 'warn', message: `${who}: its link ${basis.link} stretches ${(value * 100).toFixed(1)}% past its length at ${basis.at.toFixed(2)} s — it reads as elastic, not a rope`,
      fix: FIXES[basis.cause] ?? FIXES.gravity };
  },
});
