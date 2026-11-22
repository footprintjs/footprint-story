/**
 * A moving block on the frame: whether a point of it is on the frame, what of its drawing is off, and a point of it
 * where its pose puts it. Plain numbers in frame pixels; nothing is drawn.
 *
 *   offFrame([x, y], [w, h])            null, or how far off the frame a point lies ("34 px to the right")
 *   drawnOff(outline, rope, [w, h])     null, or {part: 'block' | 'rope', off}: the outline first, then a hang's rope
 *   posed([x, y], pose)                 a point of a block as built, where its pose puts it
 *
 * Moved from StoryReel 0.44.0 (motion-place.mjs · offFrame, drawnOff, posed: a fixed 1600×900 frame) and StoryDeck
 * 0.37.0 (motionPlace.js · offSlide, posed; drawnOff written inline in motionPlan.js · keepOnSlide): the frame is now
 * the caller's.
 */
import { finite, framePoints, own, refuse, shown } from './thing.js';

const xy = (v, what) => framePoints([v], what)[0];
function frameOf(v, what) {
  const f = framePoints([v], what)[0];
  if (!(f[0] > 0 && f[1] > 0)) refuse(`${what} is [width, height] in pixels, both above 0 — not ${shown(v)}`);
  return f;
}

/**
 * Null when a point is on the frame ([w, h], edges included), else how far off it lies, in words: "34 px to the right",
 * "2 px to the left and 10 px below". A whole pixel at least: a point a tenth of a pixel off is off, and "0 px" would
 * say it is not.
 */
export function offFrame(point, frame) {
  const [x, y] = xy(point, "offFrame's point"), [w, h] = frameOf(frame, "offFrame's frame"), said = [];
  const px = (v) => Math.max(1, Math.round(v));
  if (x < 0) said.push(`${px(-x)} px to the left`); else if (x > w) said.push(`${px(x - w)} px to the right`);
  if (y < 0) said.push(`${px(-y)} px above`); else if (y > h) said.push(`${px(y - h)} px below`);
  return said.length ? said.join(' and ') : null;
}

/**
 * What of a drawn block is off the frame: null, or {part, off} — `part` 'block' when a point of its outline is off (it is
 * what is seen, so it is said first), else 'rope' for a hang's rope; `off` the first such point's words (offFrame).
 * `outline` and `rope` are frame points, [[x, y], …].
 */
export function drawnOff(outline, rope, frame) {
  const f = frameOf(frame, "drawnOff's frame");
  const block = framePoints(outline, "drawnOff's outline").map((p) => offFrame(p, f)).find(Boolean);
  if (block) return { part: 'block', off: block };
  const cord = framePoints(rope ?? [], "drawnOff's rope").map((p) => offFrame(p, f)).find(Boolean);
  return cord ? { part: 'rope', off: cord } : null;
}

/**
 * A point of a block as built, where its pose puts it: scaled about `pivot` by `sx`, `sy` (a bounce's squash; 1 when
 * left out), then moved by `dx`, `dy`. `pose` is {dx, dy, pivot: [x, y], sx?, sy?}, frame pixels.
 */
export function posed(point, pose) {
  const [x, y] = xy(point, "posed's point");
  if (!pose || typeof pose !== 'object') refuse(`posed's pose is {dx, dy, pivot: [x, y], sx?, sy?} — not ${shown(pose)}`);
  const [px, py] = xy(own(pose, 'pivot'), "posed's pivot"), dx = own(pose, 'dx'), dy = own(pose, 'dy'), sx = own(pose, 'sx') ?? 1, sy = own(pose, 'sy') ?? 1;
  if (![dx, dy, sx, sy].every(finite)) refuse(`posed's pose has dx, dy (and sx, sy when given) as finite numbers — not ${shown([dx, dy, sx, sy])}`);
  return [px + (x - px) * sx + dx, py + (y - py) * sy + dy];
}
