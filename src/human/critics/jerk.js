/**
 * The `jerk` critic: speed peaks a move has beyond the pushes it was planned as. A reach is one push, so its speed is
 * one bell (minimum jerk); a letter is one push a stroke. More peaks than that is a move that stops and starts — it
 * reads as twitchy, a machine correcting itself.
 * A wrapped move (src/human/models/wrap.js) is scored in two parts, so no wrapper can excuse the model's own bell and a
 * wrapper that makes more peaks than its table is found: the model's own (`track.base`: its plan sampled alone) peaks
 * beyond its pushes, plus the wrapped track's peaks beyond the model's own and the bells the wrappers declare
 * (`track.pushes − track.base.pushes`).
 */
import { speedsOf, speedPeaks } from './track.js';

/** A rise and fall smaller than this share of the top speed is a wobble, not a peak. */
export const JERK_PEAK_SHARE = 0.1;

export const jerk = Object.freeze({
  name: 'jerk',
  limit: 0,
  measure(track) {
    const speeds = speedsOf(track.samples).map((s) => s.speed);
    if (speeds.length < 3) return null;
    const all = speedPeaks(speeds, JERK_PEAK_SHARE);
    if (!track.base) return Math.max(0, all - track.pushes);
    const own = speedPeaks(speedsOf(track.base.samples).map((s) => s.speed), JERK_PEAK_SHARE);
    return Math.max(0, own - track.base.pushes) + Math.max(0, all - own - (track.pushes - track.base.pushes));
  },
  finding(extra, who) {
    if (!(extra > 0)) return null;
    return { level: 'warn', message: `${who}: its move has ${extra} speed peak${extra === 1 ? '' : 's'} more than the pushes it was planned as — it stops and starts, and reads as twitchy`,
      fix: "use do: 'reach' for one smooth push (model: 'min-jerk'), or do: 'write' for strokes that overlap" };
  },
});
