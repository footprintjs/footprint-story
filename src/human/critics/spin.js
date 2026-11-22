/**
 * The `spin` critic: whether the drawn angle turns smoothly — no burst of turn the turning on either side does not
 * explain, and in flight one even spin. Read on the drawn angle, step by step. Each step's turn is the drawn one nearest
 * the turn the samples' own `spin` says (their mean spin × the step, geom/angles.js · wrapAngle of the difference): a fast
 * spin turning more than half a turn between samples is read as it turns, not as a slow turn backwards. A track whose
 * samples carry no spin (a hand-drawn one) is read the short way (shortestTurn), and the basis says the fastest spin that
 * can be told that way, half a turn a sample (`mostReadable`, rad/s): sample it more densely (checkMove's `rate`) to read
 * faster. Either way an angle drawn wrapped into (−π, π] is no jump.
 *
 *   flight  over the steps in the air (both samples air: 1): (fastest − slowest) / the middle spin. Nothing touches a
 *           thing in flight, so nothing can change its spin (no torque); a spin that speeds up or slows in the air reads
 *           as pushed by an invisible hand.
 *   jump    THE ONE MEASURE (burstOf). For every run of consecutive steps lasting up to MOST_RUN_SECONDS (0.05 s at the
 *           track's own rate, at least MOST_RUN = 6 steps), the turn it made is set
 *           against the turn each side says it should have made — each side read only OUTSIDE the run, from up to three
 *           steps beyond it: its speed held (its nearest step), its trend carried on in time (the line through its two
 *           nearest), and its curve (the parabola through its three, so a smooth hump sampled coarsely is explained). The run's EXTRA TURN is how far its summed turn lies outside the span of
 *           those (zero when it lies between them: a stop, a start or a landing changes speed between two sides that
 *           disagree, and any turn between them is explained). Its value is |extra turn| over the larger of the run's
 *           expected turn (the span's far end) and SPIN_FLOOR × the run's time. A flick of any length, a burst kept for a
 *           few samples, a hump or a dip of turning speed, a stutter and a flick on the last sample all leave turn that
 *           neither side explains. At each end, where one side is missing, the samples' own spin (when every step of
 *           the run gives one) speaks for it: the turn they say joins the span. One allowance, stated: a run that reaches the track's end while the turning eases
 *           monotonically to rest (each step's speed under the one before by more than RESTING of it, the same way,
 *           through the run, and over the last three steps at least — a lone last step slower than a steady spin is a
 *           flick) is a move coming to a stop, not a burst; and, the same at the other end, a run that starts the
 *           track while the turning only grows through it (each step no slower than the one before, the same way) is a
 *           move setting off — so a flick on the very first sample cannot be told from a start: nothing comes before it. At either end only one side is there to say.
 *
 *   value  the larger of the two; null when the track draws no angle or has under three steps
 *   basis  { kind: 'flight' | 'jump', at (s: the run's first step), steps (its length), extra (rad, + more turn than the
 *            sides say), flight (its spread, or null), jump, spin (the middle spin in flight, or null), readBy ('spin':
 *            every step against its samples' spin | 'short': some step the short way), mostReadable (rad/s, or null) }
 *
 * A track that marks no flight (no air) is read for bursts only. A track sampled too coarsely for its own motion even at
 * MOST_TRACK_SAMPLES (sampleTrack's `resolved: false`) is not judged: value null, basis { kind: 'unresolved', rate }.
 */
import { shortestTurn, wrapAngle } from '../../geom/angles.js';
import { finite } from '../read.js';
import { round } from '../models/options.js';

/** The most a spin may spread in flight, or a run's turn stray from what its sides say, as a share: 10%. Ours. */
export const SPIN_MOST = 0.1;
/** The slowest spin a share is read against (rad/s): one turn a second. Ours: at 1 rad/s a change of 0.1 rad/s is
 *  under a tenth of a degree between samples, nothing an eye sees. */
export const SPIN_FLOOR = 2 * Math.PI;
/** The longest a run read as one burst may last: 0.05 s, at the track's own rate — and at least MOST_RUN (6) steps,
 *  0.05 s at 120 a second. Ours: a burst longer than that is a change of spin, which the sides around it show. WHY in
 *  time: a track sampled finer (models/resolve.js) must not shrink the window — a burst over 0.03 s is one at any rate. */
export const MOST_RUN_SECONDS = 0.05;
export const MOST_RUN = 6;
/** How much slower each step must be than the one before to count as easing to rest: 1e-9 of it (rounding never does). */
export const RESTING = 1e-9;
/** The shortest step read (s): a track's last sample can sit a hair after the one before it. */
const MIN_STEP = 1e-6;

/** Whether two turning speeds go the same way, a rounding's worth of the floor either side of 0 counting as still. */
const sameWay = (a, b) => { const e = RESTING * SPIN_FLOOR; return !((a < -e && b > e) || (a > e && b < -e)); };

/** Whether the steps from the run's first (and over the last three at least) to the end each turn slower than the one
 *  before, the same way: easing to rest. WHY three at least: a lone last step slower than a steady spin is a flick. */
function easesToRest(rates, i) {
  for (let k = Math.max(0, Math.min(i, rates.length - 3)); k + 1 < rates.length; k += 1) {
    const a = rates[k].w, b = rates[k + 1].w;
    if (!(sameWay(a, b) && Math.abs(b) < Math.abs(a) * (1 - RESTING))) return false;
  }
  return true;
}

/** Whether the run's steps, from the track's start, each turn no slower than the one before, the same way: setting off
 *  (still, then starting — at once or gradually). Only the run itself is read: past it the move may already ease. */
function setsOff(rates, j) {
  for (let k = 0; k < j; k += 1) {
    const a = rates[k].w, b = rates[k + 1].w;
    if (!(sameWay(a, b) && Math.abs(b) >= Math.abs(a) * (1 - RESTING))) return false;
  }
  return true;
}

/** The run lengths read (steps): every one from 1 to MOST_RUN, then growing by a third to `most`. WHY a ladder past six:
 *  a burst longer than six steps is met by the first length at or past it — the few steady steps a longer run takes in
 *  add no extra turn — and the measure stays near linear in the samples however fine the track. */
function runLengths(most) {
  const lengths = [];
  for (let l = 1; l <= Math.min(most, MOST_RUN); l += 1) lengths.push(l);
  for (let l = MOST_RUN; l < most;) { l = Math.min(most, Math.ceil(l * 4 / 3)); lengths.push(l); }
  return lengths;
}

/**
 * The worst run's extra turn, as a share (the one measure): {value, at, steps, extra}. Runs span up to MOST_RUN_SECONDS
 * at the track's own rate (at least MOST_RUN steps). Each side's turns over a run are summed in closed form from running
 * sums of dt, t·dt and t²·dt, so a run costs the same however long it is.
 */
function burstOf(rates) {
  const n = rates.length, dts = rates.map((r) => r.dt).sort((a, b) => a - b), typical = dts[dts.length >> 1];
  const most = Math.max(MOST_RUN, Math.round(MOST_RUN_SECONDS / typical)), lengths = runLengths(Math.min(most, n));
  const P0 = [0], P1 = [0], P2 = [0], PW = [0], PO = [0], NO = [0];
  for (const r of rates) {
    P0.push(P0.at(-1) + r.dt); P1.push(P1.at(-1) + r.t * r.dt); P2.push(P2.at(-1) + r.t * r.t * r.dt); PW.push(PW.at(-1) + r.w * r.dt);
    PO.push(PO.at(-1) + (r.own ?? 0) * r.dt); NO.push(NO.at(-1) + (r.own === null ? 1 : 0));
  }
  let worst = { value: 0, at: null, steps: 0, extra: 0 };
  for (let i = 0; i < n; i += 1) {
    for (const length of lengths) {
      const j = i + length - 1;
      if (j >= n) break;
      const S0 = P0[j + 1] - P0[i], S1 = P1[j + 1] - P1[i], S2 = P2[j + 1] - P2[i], made = PW[j + 1] - PW[i];
      // a side's turn over the run, for its speed as A + B·τ + C·τ² with τ the time from its nearest step
      const over = (t0, A, B, C) => A * S0 + B * (S1 - t0 * S0) + C * (S2 - 2 * t0 * S1 + t0 * t0 * S0);
      const said = [];
      // each side, read outside the run: its nearest speed held, its line through two, its parabola through three
      const side = (near, far, farther) => {
        said.push(over(near.t, near.w, 0, 0));
        if (!far) return;
        const t1 = far.t - near.t, d1 = (far.w - near.w) / t1;
        said.push(over(near.t, near.w, d1, 0));
        if (!farther) return;
        const t2 = farther.t - near.t, d2 = (farther.w - near.w) / t2, C = (d1 - d2) / (t1 - t2);
        said.push(over(near.t, near.w, d1 - C * t1, C));
      };
      if (i >= 1) side(rates[i - 1], i >= 2 ? rates[i - 2] : null, i >= 3 ? rates[i - 3] : null);
      if (j + 1 < n) side(rates[j + 1], j + 2 < n ? rates[j + 2] : null, j + 3 < n ? rates[j + 3] : null);
      // at an end one side is missing: there the samples' own spin, when every step gives it, speaks for that side
      if ((i === 0 || j === n - 1) && NO[j + 1] - NO[i] === 0) said.push(PO[j + 1] - PO[i]);
      const lo = Math.min(...said), hi = Math.max(...said), extra = made > hi ? made - hi : made < lo ? made - lo : 0;
      if (extra === 0 || (j === n - 1 && easesToRest(rates, i)) || (i === 0 && setsOff(rates, j))) continue;
      const value = Math.abs(extra) / Math.max(Math.abs(lo), Math.abs(hi), SPIN_FLOOR * S0);
      if (value > worst.value) worst = { value, at: rates[i].t, steps: length, extra };
    }
  }
  return worst;
}

const median = (xs) => { const s = [...xs].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

export const spin = Object.freeze({
  name: 'spin',
  limit: SPIN_MOST,
  measure(track) {
    // a track the motion outran (sampleTrack hit MOST_TRACK_SAMPLES before every step turned within 30°) is an alias:
    // said, never judged
    if (track.resolved === false) return { value: null, basis: { kind: 'unresolved', rate: track.rate ?? null } };
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
      rates.push({ t: (a.t + b.t) / 2, dt, w: turn / dt, own: said === null ? null : said / dt, air: a.air === 1 && b.air === 1 });
    }
    if (rates.length < 3) return null;
    const flying = rates.filter((r) => r.air), ws = flying.map((r) => r.w);
    const mid = ws.length >= 2 ? median(ws) : null;
    const flight = mid === null ? null : (Math.max(...ws) - Math.min(...ws)) / Math.max(Math.abs(mid), SPIN_FLOOR);
    const burst = burstOf(rates), byFlight = flight !== null && flight >= burst.value;
    // in flight, the step that stands furthest off the middle spin
    const at = byFlight ? flying.reduce((far, r) => (Math.abs(r.w - mid) > Math.abs(far.w - mid) ? r : far)).t : burst.at;
    const readable = longest > 0 ? Math.PI / longest : null;
    return { value: byFlight ? flight : burst.value, basis: { kind: byFlight ? 'flight' : 'jump', at, steps: burst.steps, extra: burst.extra, flight, jump: burst.value, spin: mid, readBy: readable === null ? 'spin' : 'short', mostReadable: readable } };
  },
  /** When it cannot say (the track unresolved), it says so: a note with the fix, never a silent null. */
  note(basis, who) {
    if (!basis || basis.kind !== 'unresolved') return null;
    return { level: 'note', message: `${who}: its spin is too fast to read — even at ${Math.round(basis.rate)} samples a second some step turns more than 30°, so no jump is judged`,
      fix: 'fewer turns a second (a larger radius, a slower speed or spin), or a shorter move so more samples fit in the track' };
  },
  finding(value, who, basis) {
    if (!(value > SPIN_MOST)) return null;
    if (basis.kind === 'flight') {
      return { level: 'warn', message: `${who}: its spin changes by ${(value * 100).toFixed(0)}% in the air (about ${round(basis.spin, 1)} rad/s, most off at ${basis.at.toFixed(2)} s) — nothing touches it in flight, so its spin should hold`,
        fix: "keep one spin in flight: do: 'tumble' (model: 'free-spin') with spin: <rad/s>" };
    }
    const deg = round((Math.abs(basis.extra) * 180) / Math.PI, 1), steps = `${basis.steps} step${basis.steps === 1 ? '' : 's'}`;
    return { level: 'warn', message: `${who}: its drawn angle jumps at ${basis.at.toFixed(2)} s — ${steps} turn ${deg}° ${basis.extra > 0 ? 'more' : 'less'} than the turning on either side says (${(value * 100).toFixed(0)}% off) — it flicks instead of turning`,
      fix: "let the model turn it: do: 'roll' (radius: …), do: 'tumble' (spin: …) or do: 'slide' (angle: …), never an angle set by hand between frames" };
  },
});
