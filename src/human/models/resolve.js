/**
 * How densely a move is sampled when it is checked: at a rate tied to its own motion. WHY: a critic reads a drawn track
 * between its samples; a fast spin or a fast move between two samples is a picture the eye never sees, and a critic
 * reading it judges an alias (a small ball followed through at 3500 rad/s turns half a turn and more between 120-a-second
 * samples). So the track is sampled finely enough that no step turns more than MOST_STEP_TURN or travels more than
 * MOST_STEP_TRAVEL — starting at BASE_RATE, raised until it does, or until MOST_TRACK_SAMPLES would bind (then the track
 * says it is not resolved, and a critic that needs it says so in its basis rather than judge it).
 *
 *   stepNeed(samples)   → how many times finer the samples must be: the worst step's turn / MOST_STEP_TURN and travel /
 *                         MOST_STEP_TRAVEL (1 or under: fine). A step's turn is its samples' own spin × the step when
 *                         both give one (never aliased), else the drawn turn the short way (refined as the rate rises).
 *
 * A step that does not shrink as the rate rises (move.js · sampleTrack) is a jump in the drawing itself, not an alias:
 * the rate stops rising and the critics judge it as drawn. A track with no spin cannot tell a spin aliased past half a
 * turn a sample from such a jump; give its samples `spin` and the rate rises until it is read.
 */
import { shortestTurn } from '../../geom/angles.js';
import { finite } from '../read.js';

/** The rate a track starts at (samples a second): 120, twice a 60-frame film's. */
export const BASE_RATE = 120;
/** The most one step may turn (radians): 30°. Ours: the spin critic reads turns the short way, and a step past a third
 *  of a half turn begins to blur which way it went. */
export const MOST_STEP_TURN = Math.PI / 6;
/** The most one step may travel (px): 16. Ours: a body moving further between samples can slip past the edge of a thin
 *  box the contact critic reads. */
export const MOST_STEP_TRAVEL = 16;

/** How many times finer the samples must be for every step to turn and travel within the limits. */
export function stepNeed(samples) {
  let need = 0;
  for (let i = 1; i < samples.length; i += 1) {
    const a = samples[i - 1], b = samples[i], dt = b.t - a.t;
    if (!(dt > 0)) continue;
    need = Math.max(need, Math.hypot(b.x - a.x, b.y - a.y) / MOST_STEP_TRAVEL);
    if (finite(a.angle) && finite(b.angle)) {
      const turn = finite(a.spin) && finite(b.spin) ? Math.abs((a.spin + b.spin) / 2) * dt : Math.abs(shortestTurn(a.angle, b.angle));
      need = Math.max(need, turn / MOST_STEP_TURN);
    }
  }
  return need;
}
