/**
 * The `contact` critic: how deep (px) a body goes into the floor or a box the plan names — its centre with the plan's
 * `radius`, and every point of a chain. A thrown thing that passes through a wall or under the floor is the plainest
 * way a move stops looking physical. It reads the world from the plan the model made (under any wrapper): `world`
 * ({floor, boxes}) and `radius`; a plan with no world has nothing to pass through.
 */
import { depthIn } from '../physics/collide.js';
import { basePlan } from '../models/wrap.js';

/** The deepest a body may go into something solid before it reads as passing through: half a pixel. Ours. */
export const CONTACT_MOST = 0.5;

export const contact = Object.freeze({
  name: 'contact',
  limit: CONTACT_MOST,
  measure(track) {
    const base = track.plan ? basePlan(track.plan) : null, world = base?.world;
    if (!world || (world.floor === null && !world.boxes.length)) return null;
    let deepest = 0, at = null, into = null;
    const see = (x, y, r, t) => {
      const d = depthIn(x, y, world, r);
      if (d > deepest) { deepest = d; at = t; into = world.floor !== null && y + r - world.floor >= d ? 'the floor' : 'a box'; }
    };
    for (const s of track.samples) {
      see(s.x, s.y, base.radius ?? 0, s.t);
      if (Array.isArray(s.points)) for (const p of s.points) see(p[0], p[1], 0, s.t);
    }
    return { value: deepest, basis: { at, into } };
  },
  finding(value, who, basis) {
    if (!(value > CONTACT_MOST)) return null;
    return { level: 'warn', message: `${who}: at ${basis.at.toFixed(2)} s it goes ${value.toFixed(1)} px into ${basis.into} — it passes through something solid`,
      fix: "raise its path (apex: a larger number, or to: above the box), or let it land there: model: 'bounce' with the floor (floor: <y>)" };
  },
});
