/**
 * A thing spinning in flight: nothing touches it, so no torque acts and its spin is kept — its angle grows evenly
 * (the conservation of angular momentum; Halliday, Resnick & Walker, *Fundamentals of Physics*, ch. 11).
 *
 *   spinAt(angle, spin, t)                 → angle + spin · t (radians, + turns clockwise on the frame, y down)
 *   faceSpin(angle, spin, seconds, faces)  → the spin nearest `spin` that lands the thing on a face: its angle at
 *                                            `seconds` a whole share of a turn (a quarter for a box's four faces)
 *
 * WHY faceSpin: a tossed box that lands on a corner and then slides at that slant reads as wrong; the spin is moved
 * to the nearest one that lands it flat, never snapped at the landing (a jump the spin critic would see). Ours.
 */
export const spinAt = (angle, spin, t) => angle + spin * t;

export function faceSpin(angle, spin, seconds, faces = 4) {
  const face = (2 * Math.PI) / faces, landing = Math.round((angle + spin * seconds) / face) * face;
  return (landing - angle) / seconds;
}
