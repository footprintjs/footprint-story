/**
 * A seeded tremor: a small swing to and fro across a line, so a drawn line is not ruler-straight. It is value noise
 * along the line's length whose knots alternate in sign — a seeded size from 0.3 to 1 every `wavelength` px, one side
 * then the other (a swing a wavelength, a to-and-fro every two), eased from one knot to the next (smoothstep) — scaled
 * by `amplitude` and brought to 0 over the first and last wavelength, so the line still starts and ends on its points. WHY value noise: smooth (a hand does not jitter
 * frame to frame), cheap, the same for the same seed. WHY alternating: a tremor swings about the line, as a
 * physiological tremor oscillates; free knots wander, and a wander a few hundred px long is a bend, which a pen would
 * slow for and a critic would read. Averaged over a wavelength either side (the pen's BEND_WIDTH), it is gone.
 *
 * Our defaults (TREMOR): amplitude 0.8 px, wavelength 24 px — a wobble a viewer feels more than sees. The seed is the
 * caller's random() (src/human/seed.js · seeded), made from the entry, so the same entry wobbles the same way.
 */
import { refuse, shown, finite } from '../read.js';

export const TREMOR = Object.freeze({ amplitude: 0.8, wavelength: 24 });
/** The most knots one tremor holds (a line of 4096 wavelengths). */
export const MOST_TREMOR_KNOTS = 4098;

/** A tremor's knots for a line `length` px long: every `wavelength` px (one swing) a seeded size from 0.3 to 1, alternating in sign. Plain data. */
export function tremorKnots(random, length, { wavelength = TREMOR.wavelength } = {}) {
  if (!(finite(length) && length >= 0)) refuse(`a tremor's line is from 0 px long — not ${shown(length)}`);
  if (!(finite(wavelength) && wavelength >= 1 && wavelength <= 10000)) refuse(`a tremor's wavelength is from 1 to 10000 px — not ${shown(wavelength)}`);
  const count = Math.ceil(length / wavelength) + 2;
  if (count > MOST_TREMOR_KNOTS) refuse(`a tremor of wavelength ${wavelength} px over ${Math.round(length)} px is ${count} knots — at most ${MOST_TREMOR_KNOTS}: give a longer wavelength`);
  return Array.from({ length: count }, (_, i) => (i % 2 ? -1 : 1) * (0.3 + 0.7 * random()));
}

/** The tremor's offset across the line at distance s (px): amplitude · the eased noise · the taper at the ends. */
export function tremorAt(knots, s, length, { amplitude = TREMOR.amplitude, wavelength = TREMOR.wavelength } = {}) {
  if (!(amplitude > 0) || !(length > 0)) return 0;
  const at = Math.max(0, Math.min(s, length)) / wavelength, i = Math.min(Math.floor(at), knots.length - 2), f = at - i;
  const eased = f * f * (3 - 2 * f), noise = knots[i] + (knots[i + 1] - knots[i]) * eased;
  const taper = Math.min(1, Math.max(0, Math.min(s, length - s)) / wavelength);
  return amplitude * noise * taper * taper * (3 - 2 * taper) + 0;   // + 0: never −0 on a record
}
