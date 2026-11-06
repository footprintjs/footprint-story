/**
 * A thing as the camera meets it: the box it fills on the frame and where a ray first reaches it. A ball's box is exact, by
 * its tangent lines (it stretches away from the frame's centre, as a real lens draws it), and a card's is its corners'.
 */
import { AT_CAMERA, cross, dot, inCamera, landing, mul, sub } from './lens.js';

/** A thing with its card axes worked out, once. */
export function solidOf(thing) {
  if (!thing.size) return { thing, r: thing.r ?? 0 };
  const n = thing.normal ?? [0, 0, 1], side = cross([0, 1, 0], n), length = Math.hypot(...side);
  const right = length > 1e-12 ? mul(side, 1 / length) : [1, 0, 0];
  return { thing, n, right, up: cross(n, right), w: thing.size[0] / 2, h: thing.size[1] / 2 };
}

const nowhere = (state, depth) => ({ state, x0: null, y0: null, x1: null, y1: null, depth });

/** One axis of a ball's image: the place of its two tangent lines, as offsets from the centre of the frame. */
const tangents = (along, depth, r) => {
  const reach = r * Math.sqrt(along * along + depth * depth - r * r), under = depth * depth - r * r;
  return [(along * depth - reach) / under, (along * depth + reach) / under];
};

function ballBox(lens, { thing, r }) {
  const [x, y, depth] = inCamera(lens, thing.at), far = Math.hypot(x, y, depth);
  if (far <= r + AT_CAMERA) return nowhere('inside', depth);
  if (depth + r <= AT_CAMERA) return nowhere('behind', depth);
  if (depth - r <= AT_CAMERA) return nowhere('crosses', depth);
  const [left, right] = tangents(x, depth, r), [low, high] = tangents(y, depth, r);
  return { state: 'seen', x0: lens.cx + left * lens.k, y0: lens.cy - high * lens.k, x1: lens.cx + right * lens.k, y1: lens.cy - low * lens.k, depth };
}

function cardBox(lens, solid) {
  const { thing: { at }, right, up, w, h } = solid, [x, y, depth] = inCamera(lens, at);
  if (Math.hypot(x, y, depth) <= AT_CAMERA) return nowhere('inside', depth);
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => landing(lens, [0, 1, 2].map((i) => at[i] + a * w * right[i] + b * h * up[i])));
  const landed = corners.filter((c) => c.x !== null);
  if (!landed.length) return nowhere('behind', depth);
  if (landed.length < 4) return nowhere('crosses', depth);
  const xs = landed.map((c) => c.x), ys = landed.map((c) => c.y);
  return { state: 'seen', x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys), depth };
}

/** The box a thing fills: {state, x0, y0, x1, y1, depth}. `state` is seen, behind, inside (the camera is in it or on it) or crosses (it reaches past the camera, so it has no box). */
export const boxFor = (lens, solid) => (solid.n ? cardBox(lens, solid) : ballBox(lens, solid));

/** How far along a ray (from the eye, scaled so distance is depth) the thing is first met; Infinity when never. A point is never met. */
export function meet(solid, eye, ray) {
  if (solid.n) {
    const facing = dot(solid.n, ray), to = sub(solid.thing.at, eye);
    if (Math.abs(facing) < 1e-12) return Infinity;
    const t = dot(solid.n, to) / facing;
    if (t <= 0) return Infinity;
    const off = [eye[0] + ray[0] * t - solid.thing.at[0], eye[1] + ray[1] * t - solid.thing.at[1], eye[2] + ray[2] * t - solid.thing.at[2]];
    return Math.abs(dot(off, solid.right)) <= solid.w && Math.abs(dot(off, solid.up)) <= solid.h ? t : Infinity;
  }
  if (!solid.r) return Infinity;
  const from = sub(eye, solid.thing.at), a = dot(ray, ray), b = dot(from, ray), c = dot(from, from) - solid.r * solid.r, under = b * b - a * c;
  if (under < 0) return Infinity;
  const root = Math.sqrt(under), first = (-b - root) / a, second = (-b + root) / a;
  return first > 0 ? first : second > 0 ? second : Infinity;
}
