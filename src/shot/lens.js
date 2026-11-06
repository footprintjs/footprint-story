/**
 * The camera's axes and the one law of the picture, the same as a thin-lens tracer's: the camera circles its target at a
 * distance, a point's place on the frame is its side and up offsets scaled by (focal × height) / depth, and `shift` slides
 * the whole picture by a share of the frame, right and up. y on the frame grows downward. No checks here: readers come first.
 */
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** The camera on a frame: where it stands, its axes, and how a point lands. */
export function aim(camera, [w, h]) {
  const { azimuth: az, elevation: el, distance, target, focal, shift } = camera, ce = Math.cos(el);
  const back = [ce * Math.sin(az), Math.sin(el), ce * Math.cos(az)], forward = mul(back, -1);
  // Straight up or down, world up gives no side: the side it would have from just off the pole.
  const side = [-forward[2], 0, forward[0]], length = Math.hypot(side[0], side[2]);
  const right = length > 1e-12 ? mul(side, 1 / length) : [Math.cos(az), 0, -Math.sin(az)];
  return { eye: add(target, mul(back, distance)), right, up: cross(right, forward), forward, k: focal * h, cx: w / 2 + w * shift[0], cy: h / 2 - h * shift[1], w, h };
}

/** What rounding can leave of a distance from the camera to `p`, so a smaller one means none: it scales with the numbers in play, never a fixed size that a small scene falls under. */
export const nearLimit = (lens, p, r = 0) => 1e-12 * Math.max(r, ...lens.eye.map(Math.abs), ...p.map(Math.abs));

/** A point in the camera's axes: side, up, depth. */
export const inCamera = (lens, p) => { const d = sub(p, lens.eye); return [dot(d, lens.right), dot(d, lens.up), dot(d, lens.forward) + 0]; };

/** Where a point lands: {x, y, depth}. At or behind the camera it lands nowhere, and x and y are null. */
export function landing(lens, p) {
  const [x, y, depth] = inCamera(lens, p);
  if (depth <= nearLimit(lens, p)) return { x: null, y: null, depth };
  return { x: lens.cx + x * lens.k / depth, y: lens.cy - y * lens.k / depth, depth };
}

/** The world direction through a place on the frame, scaled so that distance along it is depth. */
export function rayAt(lens, x, y) {
  const side = (x - lens.cx) / lens.k, up = (lens.cy - y) / lens.k;
  return add(add(mul(lens.right, side), mul(lens.up, up)), lens.forward);
}
