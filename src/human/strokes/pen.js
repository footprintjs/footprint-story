/**
 * One stroke as a hand draws it: from its corners to timed points with widths. The numbers (ours, each named below):
 *
 *   overshoot  at a corner that turns 60° or more (CORNER.angle), the pen runs past the corner along the line it came
 *              in on — by 15% of the shorter line there, at most 3 px (CORNER) — and comes back: the small hook a fast
 *              hand leaves at a sharp turn. A stroke's two ends have none.
 *   pace       walked every 2 px (corners kept exactly), slower where it bends by the two-thirds power law read on the
 *              smooth line over one tremor wavelength (laws/powerLaw.js, the `power-law` pen's reading), from rest and
 *              back to rest over the first and last tenth (POWER_LAW.ramp); its mean speed `speed` px a second.
 *   width      `width` where the pen is slowest, thinning to 65% of it at its top speed (PEN_WIDTH.thin = 0.35: ink
 *              laid down for less time is thinner), and tapered at both ends over min(8 px, a quarter of the stroke)
 *              from 30% of it (PEN_WIDTH.taper, PEN_WIDTH.tip), eased (smoothstep): a stroke lands and lifts.
 *   wobble     the seeded tremor (laws/tremor.js), never larger than half the gap to another leg of the stroke within a
 *              bend width (the `power-law` pen's cap, paths/wobble.js), nor than the distance to the edge of the shape
 *              it is clipped to (a hatch line stays inside its shape).
 *
 * WHY the smooth points and rooms are kept beside the drawn ones: a boil (boil.js) redraws the stroke with a fresh
 * tremor each held frame, over the same line and within the same room, without planning it again.
 */
import { curvaturesOver } from '../paths/curvature.js';
import { legGaps } from '../paths/gap.js';
import { wobbleRooms, wobbleAcross } from '../paths/wobble.js';
import { POWER_LAW, powerLawTimes } from '../laws/powerLaw.js';
import { TREMOR, tremorKnots } from '../laws/tremor.js';
import { BEND_WIDTH } from '../models/powerLawPen.js';
import { toRing } from './geometry.js';

export const CORNER = Object.freeze({ angle: 60, share: 0.15, most: 3 });
export const PEN_WIDTH = Object.freeze({ thin: 0.35, taper: 8, taperShare: 0.25, tip: 0.3 });
/** The step a stroke is walked at, in px, unless the sketch is long enough to need a longer one. */
export const STROKE_STEP = 2;
/** The widest tremor a stroke keeps room for, in px: the most the pen's tremor and a boil's amplitude may be. */
export const ROOM_MOST = 8;

const smooth = (u) => u * u * (3 - 2 * u);

/** The corners with a hook past each sharp turn: [[x, y], …]. `most` 0 leaves the corners as they are. */
export function withOvershoot(points, most = CORNER.most) {
  if (!(most > 0) || points.length < 3) return points;
  const out = [points[0]];
  for (let i = 1; i < points.length - 1; i += 1) {
    const a = points[i - 1], b = points[i], c = points[i + 1];
    const ux = b[0] - a[0], uy = b[1] - a[1], vx = c[0] - b[0], vy = c[1] - b[1], lu = Math.hypot(ux, uy), lv = Math.hypot(vx, vy);
    out.push(b);
    if (!(lu > 0 && lv > 0)) continue;
    const turned = Math.abs(Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy)) * (180 / Math.PI);
    if (turned < CORNER.angle - 1e-9) continue;   // a turn of exactly 60° is one, whatever atan2 rounds it to
    const by = Math.min(most, CORNER.share * Math.min(lu, lv));
    out.push([b[0] + (ux / lu) * by, b[1] + (uy / lu) * by], b);
  }
  out.push(points[points.length - 1]);
  return out;
}

/** The corners walked every `step` px or less, each corner kept exactly: points, and how far along each is. */
export function walk(corners, step) {
  const points = [corners[0]], along = [0];
  for (let i = 1; i < corners.length; i += 1) {
    const a = corners[i - 1], b = corners[i], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (!(len > 0)) continue;
    const n = Math.max(1, Math.ceil(len / step - 1e-9)), base = along[along.length - 1];
    for (let k = 1; k <= n; k += 1) {
      const f = k / n;
      points.push(k === n ? b : [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
      along.push(base + len * f);
    }
  }
  return { points, along };
}

/** The tremor laid over a walked stroke within its rooms: {xs, ys}. */
export function wobbled(points, along, rooms, random, { amplitude, wavelength }) {
  const length = along[along.length - 1], knots = tremorKnots(random, length, { wavelength });
  if (!(amplitude > 0)) return { xs: points.map((p) => p[0]), ys: points.map((p) => p[1]) };
  return wobbleAcross(points, along, length, knots, rooms, { amplitude, wavelength });
}

/**
 * A stroke drawn by hand: {xs, ys, ws, ts, sx, sy, rs, length, seconds, hooks}. `corners` are its corners in order;
 * `settings` {random, speed, width, amplitude, wavelength, overshoot, step, clip}: `clip` null, or {ring, holes} it
 * stays inside. `ts` are seconds from the stroke's start; `sx`, `sy` the line before the tremor; `rs` the room at each point for a
 * tremor of up to ROOM_MOST px (what a boil reads).
 */
export function penStroke(corners, { random, speed, width, amplitude = TREMOR.amplitude, wavelength = TREMOR.wavelength, overshoot = CORNER.most, step = STROKE_STEP, clip = null }) {
  const hooked = withOvershoot(corners, overshoot), { points, along } = walk(hooked, step), length = along[along.length - 1];
  const n = points.length, seconds = length / speed;
  const k = Math.max(1, Math.round(BEND_WIDTH / step)), bends = n > 2 ? curvaturesOver(points, k) : points.map(() => 0);
  const ts = n > 1 ? powerLawTimes(along, bends, seconds, { floor: POWER_LAW.floor, ramp: POWER_LAW.ramp }) : [0];
  // the room: half the gap to another leg of the stroke, and the distance to the edge of the shape it is clipped to —
  // read as far as ROOM_MOST, so a boil of any amplitude it allows finds its room kept (`rs`), whatever this tremor was
  const gaps = legGaps(points, 2 * ROOM_MOST).map((g, i) => (clip ? Math.min(g, 2 * Math.min(toRing(points[i][0], points[i][1], clip.ring), ...clip.holes.map((h) => toRing(points[i][0], points[i][1], h)))) : g));
  const rooms = amplitude > 0 ? wobbleRooms(gaps, k, amplitude) : null;
  const { xs, ys } = wobbled(points, along, rooms, random, { amplitude, wavelength });
  // the speed at each point (from the times either side), and the width it lays down
  const speeds = points.map((_, i) => { const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1), dt = ts[b] - ts[a]; return dt > 0 ? (along[b] - along[a]) / dt : 0; });
  const top = Math.max(...speeds), taper = Math.min(PEN_WIDTH.taper, PEN_WIDTH.taperShare * length);
  const ws = points.map((_, i) => {
    const end = taper > 0 ? Math.min(1, Math.min(along[i], length - along[i]) / taper) : 1;
    return width * (1 - PEN_WIDTH.thin * (top > 0 ? speeds[i] / top : 0)) * (PEN_WIDTH.tip + (1 - PEN_WIDTH.tip) * smooth(end));
  });
  return { xs, ys, ws, ts, sx: points.map((p) => p[0]), sy: points.map((p) => p[1]), rs: wobbleRooms(gaps, k, ROOM_MOST), length, seconds, hooks: (hooked.length - corners.length) / 2 };
}
