/**
 * Minimum jerk: the path in time of a purposeful move from rest to rest (Flash & Hogan 1985). Of every way to get
 * there in the time, it is the one whose jerk (the change of acceleration) adds up least; the speed is one smooth bell,
 * highest halfway. WHY this law for a reach: a hand reaching for a thing moves so, and an eye reads anything else
 * (an ease that starts fast, a linear slide) as a machine.
 *
 *   minJerk(u)          how far along, 0 → 1:            10u³ − 15u⁴ + 6u⁵
 *   minJerkSpeed(u)     its rate per unit of u:          30u² − 60u³ + 30u⁴   (MIN_JERK_PEAK = 1.875 at u = 0.5)
 *   minJerkAccel(u)     its acceleration per unit of u²: 60u − 180u² + 120u³  (0 at both ends and at the middle)
 *
 * u is how far through its time the move is, clamped to 0..1. A move over D px in T s goes D·minJerk(t/T) px by t, at
 * D/T·minJerkSpeed(t/T) px a second.
 *
 * WHY a shared leaf, imported by two doors: a hand's reach (src/human/models/minJerk.js) and a camera's move between
 * shots (src/shot/move.js) both start and stop as a purposeful move does. Two copies of the law could drift apart. This
 * file imports nothing, so a page that flies a camera never loads the human maths, nor the other way round; the human
 * door hands it out (one door per name) and test/doors.test.js allows exactly this file in both. Moved here from
 * src/human/laws/ in the release after 0.27.0, unchanged.
 */

const clamp01 = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u);

/** The highest speed, per unit: 15/8, at the middle. */
export const MIN_JERK_PEAK = 1.875;

/** How far along a minimum-jerk move is at u (0 at the start, 1 at the end, exactly). */
export function minJerk(u) {
  u = clamp01(u);
  // the second half as the mirror of the first, so the curve is symmetric to the last bit and never past 1
  const half = (v) => v * v * v * (10 + v * (-15 + 6 * v));
  return u <= 0.5 ? half(u) : 1 - half(1 - u);
}

/** Its speed at u, per unit of u: 0 at both ends, MIN_JERK_PEAK at the middle. */
export function minJerkSpeed(u) { u = clamp01(u); return 30 * u * u * (1 - u) * (1 - u); }

/** Its acceleration at u, per unit of u squared: up in the first half, down in the second. */
export function minJerkAccel(u) { u = clamp01(u); return 60 * u * (1 - u) * (1 - 2 * u); }
