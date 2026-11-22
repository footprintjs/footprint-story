/**
 * A camera's look: the turn that aims it, and how far its horizon leans.
 *
 *   lookAt(eye, target, up?)   the turn that aims a camera at `eye` towards `target`, its horizon level; null when they meet
 *   horizonRoll(q)             how far the frame's horizon leans, in radians (positive: the frame's right side raised);
 *                              null looking straight up or down, where no horizon is in the picture
 *
 * WHY a roll measure: a turn made by blending two looks (a slerp of two orientations far apart) can lean the horizon on
 * the way though both ends are level; the eye reads that as the ground tipping. Roll is read as atan2(right·up, top·up):
 * with yaw, pitch p and roll φ these are sin φ cos p and cos φ cos p, so it is exact until cos p is rounding.
 */
import { quatLook, quatRotate } from './quat.js';
import { sub, vectorOf } from './vec.js';

/** The turn that aims a camera at `eye` towards `target` with its top towards `up` (world +y unless given). */
export function lookAt(eye, target, up = [0, 1, 0]) {
  const e = vectorOf(eye, [3], 'lookAt\'s eye'), t = vectorOf(target, [3], 'lookAt\'s target'), forward = sub(t, e);
  return Math.hypot(...forward) > 0 ? quatLook(forward, up) : null;
}

/** Below this cosine of the pitch the camera looks straight up or down: about 0.06° from the pole. */
const POLE = 1e-3;

/** How far the horizon leans in a camera turned by q, radians in (−π, π]; null looking straight up or down. World up is +y. */
export function horizonRoll(q) {
  const right = quatRotate(q, [1, 0, 0]), top = quatRotate(q, [0, 1, 0]);
  if (Math.hypot(right[1], top[1]) < POLE) return null;
  return Math.atan2(right[1], top[1]);
}
