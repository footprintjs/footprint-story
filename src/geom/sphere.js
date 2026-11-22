/**
 * Places on a sphere round a point: spherical coordinates as a camera holds them, and the great circle between two
 * directions.
 *
 *   toSpherical([x, y, z])                  {azimuth, elevation, distance}
 *   fromSpherical({azimuth, elevation, distance})   [x, y, z]
 *   greatCircle(a, b, s)                    the direction s of the way from a to b on the great circle, at constant angular speed
 *
 * The convention is the shot camera's (src/shot/lens.js · aim): azimuth from +z towards +x, elevation up from the ground
 * plane, +y up. So fromSpherical of a camera's angles is the way from its target to its eye.
 */
import { numberOf, unit, vectorOf } from './vec.js';

/** A vector as {azimuth, elevation, distance}: azimuth in (−π, π], elevation in [−π/2, π/2]. Straight up or down the azimuth is 0. */
export function toSpherical(v) {
  const [x, y, z] = vectorOf(v, [3], 'toSpherical\'s v'), flat = Math.hypot(x, z);
  const azimuth = flat === 0 ? 0 : Math.atan2(x, z);
  return { azimuth: azimuth === -Math.PI ? Math.PI : azimuth, elevation: Math.atan2(y, flat), distance: Math.hypot(x, y, z) };
}

/** The vector at an azimuth, an elevation and a distance. */
export function fromSpherical(place) {
  if (place === null || typeof place !== 'object') throw new TypeError('fromSpherical takes {azimuth, elevation, distance}');
  const az = numberOf(place.azimuth, 'fromSpherical\'s azimuth'), el = numberOf(place.elevation, 'fromSpherical\'s elevation'), d = numberOf(place.distance, 'fromSpherical\'s distance');
  const ce = Math.cos(el);
  return [d * ce * Math.sin(az), d * Math.sin(el), d * ce * Math.cos(az)];
}

/**
 * The unit direction s of the way from a to b along their great circle (both made unit length first). Opposite directions
 * have no one circle: it goes over the top, through the way nearest +y (or +z when they lie along y) — a camera rises.
 */
export function greatCircle(a, b, s) {
  const p = unit(vectorOf(a, [3], 'greatCircle\'s a')), q = unit(vectorOf(b, [3], 'greatCircle\'s b')), t = numberOf(s, 'greatCircle\'s s');
  if (!p || !q) throw new TypeError('greatCircle takes two directions with some length');
  const omega = 2 * Math.atan2(Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]), Math.hypot(p[0] + q[0], p[1] + q[1], p[2] + q[2]));
  if (omega < 1e-6) return unit(p.map((c, i) => c + (q[i] - c) * t));
  if (Math.PI - omega < 1e-9) {   // opposite: turn through the perpendicular nearest up, half way at s = 0.5
    const hint = Math.abs(p[1]) < 0.9 ? [0, 1, 0] : [0, 0, 1], along = hint[0] * p[0] + hint[1] * p[1] + hint[2] * p[2];
    const top = unit(hint.map((c, i) => c - along * p[i])), angle = t * Math.PI;
    return p.map((c, i) => c * Math.cos(angle) + top[i] * Math.sin(angle));
  }
  const sin = Math.sin(omega), k0 = Math.sin((1 - t) * omega) / sin, k1 = Math.sin(t * omega) / sin;
  return unit(p.map((c, i) => c * k0 + q[i] * k1));
}
