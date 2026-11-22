/**
 * The `spin` critic: whether the drawn angle turns smoothly — no jump between two samples, and in flight one even spin.
 * Read on the drawn angle, step by step, as a turning speed (each step's turn taken the short way, geom/angles.js ·
 * shortestTurn, so an angle drawn wrapped into (−π, π] is no jump):
 *
 *   flight  over the steps in the air (both samples air: 1): (fastest − slowest) / the middle spin. Nothing touches a
 *           thing in flight, so nothing can change its spin (no torque); a spin that speeds up or slows in the air reads
 *           as pushed by an invisible hand.
 *   jump    at any step: how far its turning speed stands off both neighbours the same way, over theirs. A spin may
 *           change at a landing or slow on the floor — a step then sits between its neighbours — but a single step
 *           that turns much more or less than both is a jump: the thing flicks.
 *
 *   value  the larger of the two (each over max(the spin it is read against, SPIN_FLOOR)); null when the track draws no
 *          angle or has under three steps
 *   basis  { kind: 'flight' | 'jump', at (s), flight (its spread, or null), jump, spin (the middle spin in flight, or null) }
 *
 * A track that marks no flight (no air) is read for jumps only. A turn of more than half a turn between two samples
 * cannot be told from one the other way — on the frame it looks the same — so it is read the short way.
 */
import { shortestTurn } from '../../geom/angles.js';
import { finite } from '../read.js';
import { round } from '../models/options.js';

/** The most a spin may spread in flight, or a step stand off its neighbours, as a share: 10%. Ours. */
export const SPIN_MOST = 0.1;
/** The slowest spin a share is read against (rad/s): under a sixth of a turn a second a change is measured against this. Ours. */
export const SPIN_FLOOR = 1;

const median = (xs) => { const s = [...xs].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

export const spin = Object.freeze({
  name: 'spin',
  limit: SPIN_MOST,
  measure(track) {
    const s = track.samples, rates = [];
    for (let i = 1; i < s.length; i += 1) {
      const a = s[i - 1], b = s[i];
      if (!finite(a.angle) || !finite(b.angle)) return null;   // it draws no angle
      if (!(b.t - a.t > 1e-9)) continue;
      rates.push({ t: (a.t + b.t) / 2, w: shortestTurn(a.angle, b.angle) / (b.t - a.t), air: a.air === 1 && b.air === 1 });
    }
    if (rates.length < 3) return null;
    const flying = rates.filter((r) => r.air), ws = flying.map((r) => r.w);
    const mid = ws.length >= 2 ? median(ws) : null;
    const flight = mid === null ? null : (Math.max(...ws) - Math.min(...ws)) / Math.max(Math.abs(mid), SPIN_FLOOR);
    let jump = 0, at = null;
    for (let i = 1; i + 1 < rates.length; i += 1) {
      const d1 = rates[i].w - rates[i - 1].w, d2 = rates[i].w - rates[i + 1].w;
      if (!(d1 * d2 > 0)) continue;   // between its neighbours, or level with one: a change of spin, not a flick
      const off = Math.min(Math.abs(d1), Math.abs(d2)) / Math.max(Math.abs(rates[i - 1].w), Math.abs(rates[i + 1].w), SPIN_FLOOR);
      if (off > jump) { jump = off; at = rates[i].t; }
    }
    const byFlight = flight !== null && flight >= jump;
    // in flight, the step that stands furthest off the middle spin
    if (byFlight) at = flying.reduce((far, r) => (Math.abs(r.w - mid) > Math.abs(far.w - mid) ? r : far)).t;
    return { value: byFlight ? flight : jump, basis: { kind: byFlight ? 'flight' : 'jump', at, flight, jump, spin: mid } };
  },
  finding(value, who, basis) {
    if (!(value > SPIN_MOST)) return null;
    if (basis.kind === 'flight') {
      return { level: 'warn', message: `${who}: its spin changes by ${(value * 100).toFixed(0)}% in the air (about ${round(basis.spin, 1)} rad/s, most off at ${basis.at.toFixed(2)} s) — nothing touches it in flight, so its spin should hold`,
        fix: "keep one spin in flight: do: 'tumble' (model: 'free-spin') with spin: <rad/s>" };
    }
    return { level: 'warn', message: `${who}: its drawn angle jumps at ${basis.at.toFixed(2)} s (one step turns ${(value * 100).toFixed(0)}% off both neighbours) — it flicks instead of turning`,
      fix: "let the model turn it: do: 'roll' (radius: …), do: 'tumble' (spin: …) or do: 'slide' (angle: …), never an angle set by hand between frames" };
  },
});
