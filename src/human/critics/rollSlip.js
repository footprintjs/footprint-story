/**
 * The `roll-slip` critic: how far the drawn turn strays from distance / radius — the turn a wheel makes when it rolls
 * without slipping. Read step by step on the track: the ground each step covers over the radius the plan names (the
 * body's size, as the contact critic reads it) is the turn it owes; the drawn angle's change is what it made. A wheel
 * that turns at the wrong rate reads as skidding or spinning in place, the plainest way a roll stops looking real.
 *
 *   value  Σ |drawn − owed| / Σ |owed| over the steps it rolls: 0 rolls true, 1 slides without turning (or turns twice
 *          as fast); null when it rolls less than a pixel, names no radius, or draws no angle
 *   basis  { rate: the drawn turn over the owed (1 true, 0 slides, 2 twice too fast, below 0 the wrong way), travel,
 *            radius, steps }
 *
 * Which steps roll: a step with a sample in the air (air: 1) or one that says it slides (rolls: 0) owes no turn and is
 * skipped; a track that says neither rolls all the way. The ground covered: on a floor seen from above (a sample with
 * `heading`), the travel along the heading; side on, the step's length signed by its way across (+ right: a roll to the
 * right turns clockwise, + in y down) — true on any floor no steeper than vertical.
 * WHY the drawn turn is read nearest the owed one (geom/angles.js · wrapAngle of their difference): an angle drawn
 * wrapped into (−π, π], or a whole turn ahead, looks the same on the frame, so only what differs on the frame counts.
 */
import { wrapAngle } from '../../geom/angles.js';
import { basePlan } from '../models/wrap.js';
import { finite } from '../read.js';
import { round } from '../models/options.js';

/** The most a drawn turn may stray from distance / radius, as a share of it: 5%. Ours. */
export const ROLL_SLIP_MOST = 0.05;

const rolling = (s) => s.air !== 1 && s.rolls !== 0;

export const rollSlip = Object.freeze({
  name: 'roll-slip',
  limit: ROLL_SLIP_MOST,
  measure(track) {
    const base = track.plan ? basePlan(track.plan) : null, radius = base?.radius;
    if (!(finite(radius) && radius > 0)) return null;   // no size named: no turn is owed
    const s = track.samples;
    let slip = 0, owedAll = 0, made = 0, travel = 0, steps = 0;
    for (let i = 1; i < s.length; i += 1) {
      const a = s[i - 1], b = s[i];
      if (!rolling(a) || !rolling(b)) continue;
      if (!finite(a.angle) || !finite(b.angle)) return null;   // it draws no angle: nothing to measure
      const dx = b.x - a.x, dy = b.y - a.y;
      const along = finite(a.heading) ? dx * Math.cos(a.heading) + dy * Math.sin(a.heading) : Math.sign(dx) * Math.hypot(dx, dy);
      const owed = along / radius, off = wrapAngle(b.angle - a.angle - owed);
      slip += Math.abs(off); owedAll += Math.abs(owed); travel += Math.abs(along); steps += 1;
      if (owed !== 0) made += (owed + off) * Math.sign(owed);
    }
    if (!(travel >= 1)) return null;   // it rolls less than a pixel: there is no turn to judge
    return { value: slip / owedAll, basis: { rate: made / owedAll, travel, radius, steps } };
  },
  finding(value, who, basis) {
    if (!(value > ROLL_SLIP_MOST)) return null;
    const rate = basis.rate, r = basis.radius;
    const how = Math.abs(rate) < ROLL_SLIP_MOST ? 'it slides along without turning' : rate < 0 ? 'it turns the wrong way for the way it goes' : rate > 1 ? 'it spins faster than it rolls, a wheel skidding' : 'it turns slower than it rolls, sliding as it goes';
    const size = rate >= ROLL_SLIP_MOST ? ` — or, if it is drawn ${rate > 1 ? 'smaller' : 'larger'}, radius: ${round(r / rate, 1)}` : '';
    return { level: 'warn', message: `${who}: its drawn turn is ${round(rate, 2)}× distance / radius (radius ${round(r, 1)} px, ${(value * 100).toFixed(0)}% astray) — ${how}`,
      fix: `turn it by distance / radius: do: 'roll' (model: 'no-slip') with radius: ${round(r, 1)}${size}` };
  },
});
