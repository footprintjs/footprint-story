/**
 * A thing moving along a straight line on a floor, in closed form: a roll or a slide, slowed by its resistance, sped or
 * slowed by a slope, stopped by a box. One law for both: along the line the acceleration is constant while the thing
 * moves one way, so its path is a few pieces of constant acceleration (uniformly accelerated motion).
 *
 *   glide({ speed, along, resist, hold, ahead, behind, end, most })
 *     → { segments: [{ at, seconds, q, v, a }], q, v, seconds, travelled, endedBy, hitSpeed }
 *   glideAt(glide, t)          → { q, v }: how far along the line (px, + forward) and how fast, at t
 *   restSpeed(distance, slow)  → the start speed that comes to rest after `distance` px at `slow` px/s² of slowing: √(2·slow·d)
 *
 * `speed` ≥ 0 is the start speed forward; `along` the push along the line (px/s², + forward: a slope's share of
 * gravity); `resist` the slowing while it moves (rolling resistance or kinetic friction, always against the motion);
 * `hold` the most push that leaves it at rest once stopped (static friction; a roll's is its resistance). `ahead` and
 * `behind` are how far it may go each way before it touches a box (Infinity: nothing there); `end` where it ends
 * forward (null: none); `most` the longest it may run (s).
 *
 * endedBy: 'rest' (stopped and held), 'end' (reached `end`, exactly), 'box' (touched a box: stopped dead, `hitSpeed` the
 * speed it hit at — no bounce: a bounce off a wall is the bounce model's work), 'time' (still moving at `most`: the
 * caller refuses, never cuts it short in silence).
 * WHY closed form: any moment is drawn without the ones before it, and a test checks the textbook formula
 * (v² = v₀² + 2a·d) exactly. WHY a stop is written at its exact distance: the last frame lands on `to` or on the box's
 * side to the bit, and a wrapper keeps it.
 */

/** The start speed that comes to rest after `distance` px when slowed at `slow` px/s² (both ≥ 0): v² = 2·a·d. */
export const restSpeed = (distance, slow) => Math.sqrt(2 * slow * distance);

/** The time to cover `d` px ahead at speed `w` ≥ 0 and acceleration `b` along the travel; Infinity when it stops first. */
function reach(d, w, b, stopAt) {
  if (d <= 0) return 0;
  if (!(d < Infinity)) return Infinity;   // nothing there
  // a distance at its stop, to rounding (a start speed picked to rest there): reached as it stops, its speed exactly 0
  if (b < 0 && d >= stopAt * (1 - 1e-9)) return d <= stopAt * (1 + 1e-9) ? w / -b : Infinity;
  // the stable root of w·t + ½·b·t² = d: no loss of digits when b is small or w large
  return (2 * d) / (w + Math.sqrt(w * w + 2 * b * d));
}

/** The pieces of the motion along the line, and how it ended. */
export function glide({ speed, along, resist, hold, ahead = Infinity, behind = Infinity, end = null, most }) {
  const segments = [];
  let t = 0, q = 0, v = speed, travelled = 0;
  const done = (endedBy, hitSpeed = 0) => Object.freeze({ segments: Object.freeze(segments), q, v, seconds: t, travelled, endedBy, hitSpeed });
  // at most three pieces: forward, stopped, back. Once it starts from rest its push beats its resistance, so it never
  // stops again: the loop ends by `end`, a box or `most`
  for (;;) {
    let sgn = v > 0 ? 1 : v < 0 ? -1 : 0;
    if (sgn === 0) {
      if (Math.abs(along) <= hold) return done('rest');
      sgn = Math.sign(along);
    }
    const a = along - sgn * resist, w = sgn * v, b = sgn * a;   // w: its speed, b: its acceleration along the travel
    const stopAt = b < 0 ? (w * w) / (-2 * b) : Infinity, stopIn = b < 0 ? w / -b : Infinity;
    const boxAt = sgn > 0 ? ahead - q : behind + q, endAt = sgn > 0 && end !== null ? end - q : Infinity;
    const tBox = reach(boxAt, w, b, stopAt), tEnd = reach(endAt, w, b, stopAt), left = most - t;
    const dt = Math.min(tEnd, tBox, stopIn, left);
    segments.push(Object.freeze({ at: t, seconds: dt, q, v, a }));
    t += dt;
    if (dt === tEnd) { travelled += endAt; v = dt === stopIn ? 0 : v + a * dt; q = end; return done('end'); }
    if (dt === tBox) { travelled += boxAt; const hit = Math.abs(v + a * dt); q = sgn > 0 ? ahead : -behind; v = 0; return done('box', hit); }
    if (dt === stopIn) { travelled += stopAt; q += sgn * stopAt; v = 0; continue; }
    const moved = w * dt + 0.5 * b * dt * dt;
    travelled += moved; q += sgn * moved; v += a * dt;
    return done('time');
  }
}

/** Where along the line the glide is at t (s): {q, v}; before the start its start, after its end its end. */
export function glideAt(g, t) {
  if (!(t > 0)) return { q: 0, v: g.segments.length ? g.segments[0].v : 0 };
  if (t >= g.seconds) return { q: g.q, v: g.v };
  let k = g.segments.length - 1;
  while (k > 0 && g.segments[k].at > t) k -= 1;
  const s = g.segments[k], dt = t - s.at;
  return { q: s.q + s.v * dt + 0.5 * s.a * dt * dt, v: s.v + s.a * dt };
}
