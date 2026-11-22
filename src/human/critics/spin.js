/**
 * The `spin` critic: whether the drawn angle turns smoothly — no jump between two samples, and in flight one even spin.
 * Read on the drawn angle, step by step, as a turning speed. Each step's turn is the drawn one nearest the turn the
 * samples' own `spin` says (their mean spin × the step, geom/angles.js · wrapAngle of the difference): a fast spin turning
 * more than half a turn between samples is read as it turns, not as a slow turn backwards. A track whose samples carry
 * no spin (a hand-drawn one) is read the short way (shortestTurn), and the basis says the fastest spin that can be told
 * that way, half a turn a sample (`mostReadable`, rad/s): sample it more densely (checkMove's `rate`) to read faster.
 * Either way an angle drawn wrapped into (−π, π] is no jump.
 *
 *   flight  over the steps in the air (both samples air: 1): (fastest − slowest) / the middle spin. Nothing touches a
 *           thing in flight, so nothing can change its spin (no torque); a spin that speeds up or slows in the air reads
 *           as pushed by an invisible hand.
 *   jump    at any step that stands off both its neighbours the same way (a peak or a dip of turning speed): how far,
 *           over the neighbours' speed. A flick of any length makes one — into it and out of it — as does a kept jump
 *           or a stutter, while a spin that changes at a landing, slows on the floor or starts at once sits between its
 *           neighbours. One peak is no flick: a spin sped up and then stopped dead (at a box, or a hold). So a peak
 *           that lies on a side's own trend is let off — the trend read only from the three steps beyond it on that
 *           side, and only when they run smooth (their change steady within SPIN_MOST): steps a flick has touched are
 *           never smooth, so a flick's own return step cannot vouch for it. The last step has one side only: it is judged
 *           against its neighbour, or the trend of the two steps before it carried on in time (a flick on the final
 *           sample). The
 *           first is not: a spin that starts unevenly cannot be told from a flick with nothing before it.
 *   stutter a turning speed that changes suddenly (by over SPIN_MOST of its speed) back and forth: three such changes,
 *           each the other way to the one before, within STUTTER_STEPS steps — a spin that starts and stops, starts
 *           and stops. Each step there is level with one neighbour, so no peak shows it. A stop, a start or a landing
 *           is one change (or two the same way, a stop between samples), never three back and forth.
 *
 *   value  the largest of the three (each over max(the spin it is read against, SPIN_FLOOR)); null when the track draws
 *          no angle or has under three steps
 *   basis  { kind: 'flight' | 'jump' | 'stutter', at (s), flight (its spread, or null), jump, stutter, spin (the middle spin in flight, or
 *            null), readBy ('spin': every step against its samples' spin | 'short': some step the short way),
 *            mostReadable (rad/s: the fastest spin the short way can tell, null when every step was read by spin) }
 *
 * A track that marks no flight (no air) is read for jumps only.
 */
import { shortestTurn, wrapAngle } from '../../geom/angles.js';
import { finite } from '../read.js';
import { round } from '../models/options.js';

/** The most a spin may spread in flight, or a step stand off its neighbours, as a share: 10%. Ours. */
export const SPIN_MOST = 0.1;
/** The slowest spin a share is read against (rad/s): one turn a second. Ours: at 1 rad/s a change of 0.1 rad/s is
 *  under a tenth of a degree between samples, nothing an eye sees — a settling wrapper's curve read as a flick. */
export const SPIN_FLOOR = 2 * Math.PI;

/** The most steps three sudden changes of turning speed, back and forth, may span to read as a stutter: six (0.05 s at
 *  120 a second). Ours: a spin that starts and stops more often than that reads as stuttering. */
export const STUTTER_STEPS = 6;
/** The shortest step read (s): a track's last sample can sit a hair after the one before it. */
const MIN_STEP = 1e-6;

/** The worst back-and-forth run of sudden changes in turning speed: {value, at}, three changes within STUTTER_STEPS. */
function stutterOf(w, rates) {
  const big = [];
  for (let i = 0; i + 1 < w.length; i += 1) {
    const d = w[i + 1] - w[i], scale = Math.max(Math.abs(w[i]), Math.abs(w[i + 1]), SPIN_FLOOR);
    if (Math.abs(d) > SPIN_MOST * scale) big.push({ i, d, size: Math.abs(d) / scale });
  }
  let value = 0, at = null, run = 0;
  for (let k = 0; k < big.length; k += 1) {
    run = k > 0 && Math.sign(big[k].d) !== Math.sign(big[k - 1].d) ? run + 1 : 1;
    if (run >= 3 && big[k].i - big[k - 2].i <= STUTTER_STEPS) {
      const size = Math.min(big[k].size, big[k - 1].size, big[k - 2].size);
      if (size > value) { value = size; at = rates[big[k - 1].i + 1].t; }
    }
  }
  return { value, at };
}

/**
 * A side's turning speed carried on to the time `t`, from its nearest step `a` (then `b`, `c` further out: each {t, w}),
 * or null when the three do not run smooth: their change of speed not steady within SPIN_MOST of their speed. Read in
 * time, so a last step shorter than the rest is carried on to its own middle.
 */
function trendOf(a, b, c, t) {
  const scale = Math.max(Math.abs(a.w), Math.abs(b.w), Math.abs(c.w), SPIN_FLOOR);
  const near = (a.w - b.w) / (a.t - b.t), far = (b.w - c.w) / (b.t - c.t);
  return Math.abs(near - far) * Math.abs(a.t - b.t) <= SPIN_MOST * scale ? a.w + near * (t - a.t) : null;
}

const median = (xs) => { const s = [...xs].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

export const spin = Object.freeze({
  name: 'spin',
  limit: SPIN_MOST,
  measure(track) {
    const s = track.samples, rates = [];
    let longest = 0;   // the longest step read the short way (s)
    for (let i = 1; i < s.length; i += 1) {
      const a = s[i - 1], b = s[i], dt = b.t - a.t;
      if (!finite(a.angle) || !finite(b.angle)) return null;   // it draws no angle
      if (!(dt > MIN_STEP)) continue;   // a step this short shows nothing, and its rate is rounding
      // the turn its samples' spin says, and the drawn turn nearest it; with no spin, the short way
      const said = finite(a.spin) && finite(b.spin) ? ((a.spin + b.spin) / 2) * dt : null;
      if (said === null) longest = Math.max(longest, dt);
      const turn = said === null ? shortestTurn(a.angle, b.angle) : said + wrapAngle(b.angle - a.angle - said);
      rates.push({ t: (a.t + b.t) / 2, w: turn / dt, air: a.air === 1 && b.air === 1 });
    }
    if (rates.length < 3) return null;
    const flying = rates.filter((r) => r.air), ws = flying.map((r) => r.w);
    const mid = ws.length >= 2 ? median(ws) : null;
    const flight = mid === null ? null : (Math.max(...ws) - Math.min(...ws)) / Math.max(Math.abs(mid), SPIN_FLOOR);
    let jump = 0, at = null;
    const w = rates.map((r) => r.w), n = w.length;
    for (let i = 1; i + 1 < n; i += 1) {
      const d1 = w[i] - w[i - 1], d2 = w[i] - w[i + 1];
      if (!(d1 * d2 > 0)) continue;   // between its neighbours, or level with one: a change of spin, not a flick
      let off = Math.min(Math.abs(d1), Math.abs(d2));
      // let off a peak that a smooth side's own trend reaches (a stop after a speed-up): read beyond the step, never through it
      const t = rates[i].t, left = i >= 3 ? trendOf(rates[i - 1], rates[i - 2], rates[i - 3], t) : null, right = i + 3 < n ? trendOf(rates[i + 1], rates[i + 2], rates[i + 3], t) : null;
      if (left !== null) off = Math.min(off, Math.abs(w[i] - left));
      if (right !== null) off = Math.min(off, Math.abs(w[i] - right));
      off /= Math.max(Math.abs(w[i - 1]), Math.abs(w[i + 1]), SPIN_FLOOR);
      if (off > jump) { jump = off; at = rates[i].t; }
    }
    // the last step, against its one side: its neighbour, or that side's trend carried on in time (a flick on the final
    // sample). No smoothness asked: only the last sample is under test, so the steps before it are its own
    {
      const a = rates[n - 2], b = rates[n - 3], trend = a.w + ((a.w - b.w) / (a.t - b.t)) * (rates[n - 1].t - a.t);
      const off = Math.min(Math.abs(w[n - 1] - a.w), Math.abs(w[n - 1] - trend)) / Math.max(Math.abs(a.w), SPIN_FLOOR);
      if (off > jump) { jump = off; at = rates[n - 1].t; }
    }
    const stutter = stutterOf(w, rates);
    const kind = flight !== null && flight >= jump && flight >= stutter.value ? 'flight' : stutter.value > jump ? 'stutter' : 'jump';
    // in flight, the step that stands furthest off the middle spin
    if (kind === 'flight') at = flying.reduce((far, r) => (Math.abs(r.w - mid) > Math.abs(far.w - mid) ? r : far)).t;
    if (kind === 'stutter') at = stutter.at;
    const readable = longest > 0 ? Math.PI / longest : null;
    return { value: kind === 'flight' ? flight : kind === 'stutter' ? stutter.value : jump, basis: { kind, at, flight, jump, stutter: stutter.value, spin: mid, readBy: readable === null ? 'spin' : 'short', mostReadable: readable } };
  },
  finding(value, who, basis) {
    if (!(value > SPIN_MOST)) return null;
    if (basis.kind === 'flight') {
      return { level: 'warn', message: `${who}: its spin changes by ${(value * 100).toFixed(0)}% in the air (about ${round(basis.spin, 1)} rad/s, most off at ${basis.at.toFixed(2)} s) — nothing touches it in flight, so its spin should hold`,
        fix: "keep one spin in flight: do: 'tumble' (model: 'free-spin') with spin: <rad/s>" };
    }
    if (basis.kind === 'stutter') {
      return { level: 'warn', message: `${who}: its spin stutters at ${basis.at.toFixed(2)} s (its turning speed jumps back and forth by ${(value * 100).toFixed(0)}% or more, three times within ${STUTTER_STEPS} steps) — it starts and stops instead of turning`,
        fix: "let the model turn it: do: 'roll' (radius: …), do: 'tumble' (spin: …) or do: 'slide' (angle: …), never a turn started and stopped by hand between frames" };
    }
    return { level: 'warn', message: `${who}: its drawn angle jumps at ${basis.at.toFixed(2)} s (one step turns ${(value * 100).toFixed(0)}% off both neighbours) — it flicks instead of turning`,
      fix: "let the model turn it: do: 'roll' (radius: …), do: 'tumble' (spin: …) or do: 'slide' (angle: …), never an angle set by hand between frames" };
  },
});
