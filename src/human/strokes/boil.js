/**
 * Boil: a finished drawing redrawn a little differently every few frames, as hand-drawn animation is — each frame
 * traced again by hand, so its lines shimmer. Here each held frame lays a fresh seeded tremor over every stroke's
 * smooth line, within the same rooms the plan kept (pen.js), so it never crosses another leg of a stroke nor leaves a
 * hatch's shape.
 *
 *   boilSketch(plan, frame, {every, amplitude}) → {frame, held, strokes: [{xs, ys}]}: the strokes' points for that frame
 *
 * The numbers (ours): a new drawing every 3 frames (BOIL.every — 8 a second at 24 frames a second, 10 at 30: the "on
 * threes" of hand-drawn boil); the tremor each stroke was drawn with, unless `amplitude` is given (at most 8 px).
 * Bounded: every boiled point is within its stroke's amplitude (and its room) of the smooth line — so within twice that
 * of the same point on any other frame. Seeded by the plan's `boilSeed` and the held frame's number
 * (src/seed/seeded.js): the same frame, the same drawing; frames 0, 1 and 2 the same, frame 3 another.
 */
import { refuse, shown, finite } from '../read.js';
import { seeded } from '../../seed/seeded.js';
import { wobbled } from './pen.js';

export const BOIL = Object.freeze({ every: 3, most: 8 });
/** The furthest frame a boil is asked for (a day at 60 frames a second, and some). */
export const MOST_BOIL_FRAME = 1e7;

export function boilSketch(plan, frame, { every = BOIL.every, amplitude } = {}) {
  if (!(Number.isInteger(frame) && frame >= 0 && frame <= MOST_BOIL_FRAME)) refuse(`a boil's frame is a whole number from 0 to ${MOST_BOIL_FRAME} — not ${shown(frame)}`);
  if (!(Number.isInteger(every) && every >= 1 && every <= 120)) refuse(`a boil's every is how many frames each drawing is held, a whole number from 1 to 120 — not ${shown(every)}`);
  if (amplitude !== undefined && !(finite(amplitude) && amplitude >= 0 && amplitude <= BOIL.most)) refuse(`a boil's amplitude is px across, from 0 to ${BOIL.most} — not ${shown(amplitude)}`);
  const held = Math.floor(frame / every), random = seeded(`human:boil|${plan.boilSeed}|${held}`);
  const strokes = plan.strokes.map((s) => {
    const points = s.sx.map((x, i) => [x, s.sy[i]]), along = [0];
    for (let i = 1; i < points.length; i += 1) along.push(along[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
    // the plan's rooms, as they are: a swing is scaled by its room over the amplitude, so it never passes either
    const { xs, ys } = wobbled(points, along, s.rs, random, { amplitude: amplitude ?? s.amplitude, wavelength: plan.wavelength });
    return Object.freeze({ xs: Object.freeze(xs), ys: Object.freeze(ys) });
  });
  return Object.freeze({ frame, held, strokes: Object.freeze(strokes) });
}
