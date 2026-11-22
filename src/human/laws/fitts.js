/**
 * Fitts's law: how long a move takes, from how far it goes and how big the thing it ends on is (Fitts 1954), in the
 * Shannon form most studies now fit (MacKenzie 1992): seconds = a + b · log2(distance / width + 1). The log is the
 * move's index of difficulty, in bits: twice as far, or a target half the size, is one bit more. WHY a law and not a
 * number: a reach's duration then follows from what the picture shows, the same in a deck and a film, and is never
 * tuned by hand.
 *
 * The defaults (FITTS):
 *   b = 0.2 s a bit — ours, chosen near the 3.7 to 4.9 bits a second that Soukoreff & MacKenzie (2004) report for
 *       pointing with a mouse. A choice, not a measurement: they warn that 1/b is not a device's throughput.
 *   a = 0.1 s — ours. A study's a is fitted, not timed, and can come out below 0; a move of no length must still
 *       take a beat, or it reads as a jump.
 *   target = 40 px — ours: the width of a button, used when an intent names no target.
 */
import { refuse, shown, finite, FAR } from '../read.js';

export const FITTS = Object.freeze({ a: 0.1, b: 0.2, target: 40 });

/** The index of difficulty of a move, in bits: log2(distance / width + 1). Distance from 0, width above 0. */
export function fittsIndex(distance, width) {
  if (!(finite(distance) && distance >= 0 && distance <= 4 * FAR)) refuse(`a move's distance is from 0 px — not ${shown(distance)}`);
  if (!(finite(width) && width > 0 && width <= FAR)) refuse(`a target's width is above 0 px (how big the thing a move ends on is) — not ${shown(width)}`);
  return Math.log2(distance / width + 1);
}

/** How long a move takes, in seconds: a + b · fittsIndex(distance, width), with a and b from FITTS unless given. */
export function fittsSeconds(distance, width = FITTS.target, { a = FITTS.a, b = FITTS.b } = {}) {
  if (!(finite(a) && a >= 0 && a <= 10)) refuse(`Fitts's a is from 0 to 10 s (the time a move takes however short) — not ${shown(a)}`);
  if (!(finite(b) && b > 0 && b <= 10)) refuse(`Fitts's b is above 0 and at most 10 s a bit (how much longer each bit of difficulty takes) — not ${shown(b)}`);
  return a + b * fittsIndex(distance, width);
}
