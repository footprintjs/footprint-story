/**
 * The shape a thing fills on the frame, as a convex polygon. A card's is its corners: exact. A ball's is its tangent cone met
 * with the frame, an ellipse drawn with enough sides that it stays within about a third of a pixel, for a ball that fits the
 * frame. What reaches past the camera is cut at a plane just in front of it, so what is left has a place on the frame.
 */
import { cross, inCamera, mul } from './lens.js';
import { keep, rectangle } from './polygon.js';

const LEAST_SIDES = 24, MOST_SIDES = 96, JUST_IN_FRONT = 1e-6;

const placed = (lens, points, near) => keep(points, (p) => p[2] - near).map(([x, y, z]) => [lens.cx + x * lens.k / z, lens.cy - y * lens.k / z]);

function ballOutline(lens, { thing, r }, box) {
  if (box.state === 'inside') return rectangle(0, 0, lens.w, lens.h);   // every ray from inside it leaves through it
  const at = inCamera(lens, thing.at), far = Math.hypot(...at), axis = mul(at, 1 / far), sin = r / far, cos = Math.sqrt(1 - sin * sin);
  const helper = Math.abs(axis[0]) < 0.7 ? [1, 0, 0] : [0, 1, 0], side = cross(axis, helper), length = Math.hypot(...side), u = mul(side, 1 / length), v = cross(axis, u);
  const across = box.state === 'seen' ? Math.max(box.x1 - box.x0, box.y1 - box.y0) / 2 : Infinity;
  const sides = Math.min(MOST_SIDES, Math.max(LEAST_SIDES, Math.ceil(Math.PI * Math.sqrt(2 * across))));
  const edge = Array.from({ length: sides }, (_, i) => {
    const a = 2 * Math.PI * i / sides, c = cos, s = sin * Math.cos(a), t = sin * Math.sin(a);
    return [0, 1, 2].map((k) => axis[k] * c + u[k] * s + v[k] * t);
  });
  return placed(lens, edge, JUST_IN_FRONT);
}

function cardOutline(lens, { corners }) {
  const points = corners.map((p) => inCamera(lens, p)), reach = Math.max(...points.flat().map(Math.abs));
  return placed(lens, points, reach * JUST_IN_FRONT);
}

/** The polygon a thing fills, or null when it fills none: a point, a thing wholly behind the camera, a card with the camera on it. */
export function outlineOf(lens, solid, box) {
  if (box.state === 'behind') return null;
  if (solid.n) return box.state === 'inside' ? null : cardOutline(lens, solid);
  return solid.r ? ballOutline(lens, solid, box) : null;
}
