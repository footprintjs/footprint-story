/**
 * Simple collisions: a floor line (y down, so "below the floor" is a larger y) and axis-aligned boxes {x, y, w, h}.
 *
 *   makeWorld({ floor: 900, boxes: [{ x: 100, y: 700, w: 200, h: 200 }] })   → { floor, boxes }, checked (readWorld: an intent's)
 *   collide(points, world, from = 1)                                               → the same points, pushed out
 *   depthIn(x, y, world, radius)                                                   → how far (px) a point is inside
 *
 * A point inside a box is moved to the box's nearest side; a point below the floor is moved up onto it.
 * WHY boxes may not overlap, nor reach below the floor: then one push is enough. A point put on one box's side is
 * never inside another (their insides do not meet), and a box push never moves a point below the floor — so after a
 * step no point is inside anything, which the tests check after every step.
 */
import { refuse, shown, stored, isRecord, readNumber } from '../read.js';

export const MOST_BOXES = 32;

const inside = (x, y, b) => x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h;

/**
 * The world an intent names, checked: `floor` (a y, or none) and `boxes` (each {x, y, w, h}, w and h above 0, none
 * overlapping another, none reaching below the floor). `o` is the intent (or any object with those keys).
 */
export function readWorld(o, who) {
  const rawFloor = stored(o, 'floor', `${who}'s floor`);
  const floor = rawFloor === undefined || rawFloor === null ? null : readNumber(o, 'floor', who);
  const raw = stored(o, 'boxes', `${who}'s boxes`) ?? [];
  if (!Array.isArray(raw) || raw.length > MOST_BOXES) refuse(`${who}'s boxes are a list of at most ${MOST_BOXES} boxes {x, y, w, h} — not ${shown(raw)}`);
  const boxes = Array.from({ length: raw.length }, (_, i) => {
    const key = `${who}'s boxes[${i}]`, b = Object.hasOwn(raw, i) ? stored(raw, i, key) : undefined;
    if (!isRecord(b)) refuse(`${key} is a box {x, y, w, h} (a hole or a getter is never read) — not ${shown(b)}`);
    for (const k of Object.keys(b)) if (!['x', 'y', 'w', 'h'].includes(k)) refuse(`${key} takes x, y, w, h — not ${shown(k)}`);
    const box = Object.freeze({ x: readNumber(b, 'x', key), y: readNumber(b, 'y', key), w: readNumber(b, 'w', key, { lo: 0, above: true }), h: readNumber(b, 'h', key, { lo: 0, above: true }) });
    if (floor !== null && box.y + box.h > floor) refuse(`${key} reaches below the floor (its foot at y ${box.y + box.h}, the floor at ${floor}) — stand it on the floor: y ${floor - box.h}`);
    return box;
  });
  for (let i = 0; i < boxes.length; i += 1) for (let j = i + 1; j < boxes.length; j += 1) {
    const a = boxes[i], b = boxes[j];
    if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) refuse(`${who}'s boxes[${i}] and boxes[${j}] overlap — boxes may touch but not overlap: make them one box`);
  }
  return Object.freeze({ floor, boxes: Object.freeze(boxes) });
}

/** A world from plain data {floor, boxes}, checked as an intent's are: what pushOut, collide and depthIn take. */
export function makeWorld(o, who = 'the world') {
  if (!isRecord(o)) refuse(`${who} is {floor, boxes} — not ${shown(o)}`);
  for (const k of Object.keys(o)) if (k !== 'floor' && k !== 'boxes') refuse(`${who} takes floor, boxes — not ${shown(k)}`);
  return readWorld(o, who);
}

/** The point pushed out of the world: up onto the floor, then out of a box by its nearest side. A new [x, y]. */
export function pushOut(x, y, world) {
  if (world.floor !== null && y > world.floor) y = world.floor;
  for (const b of world.boxes) {
    if (!inside(x, y, b)) continue;
    const left = x - b.x, right = b.x + b.w - x, top = y - b.y, bottom = b.y + b.h - y, least = Math.min(left, right, top, bottom);
    if (least === top) y = b.y; else if (least === left) x = b.x; else if (least === right) x = b.x + b.w; else y = b.y + b.h;
    break;   // the boxes do not overlap: a point is inside one at most, and on its side it is inside none
  }
  return [x, y];
}

/** Every point from index `from` on (flat [x, y, …]; the points before it are pinned) pushed out, in place. */
export function collide(points, world, from = 1) {
  if (world.floor === null && !world.boxes.length) return points;
  for (let i = from * 2; i < points.length; i += 2) { const [x, y] = pushOut(points[i], points[i + 1], world); points[i] = x; points[i + 1] = y; }
  return points;
}

/** How far a body of `radius` at (x, y) is inside the floor or a box (px; 0 when it is clear). */
export function depthIn(x, y, world, radius = 0) {
  let deepest = world.floor === null ? 0 : Math.max(0, y + radius - world.floor);
  for (const b of world.boxes) {
    const left = x + radius - b.x, right = b.x + b.w - (x - radius), top = y + radius - b.y, bottom = b.y + b.h - (y - radius);
    if (left > 0 && right > 0 && top > 0 && bottom > 0) deepest = Math.max(deepest, Math.min(left, right, top, bottom));
  }
  return deepest;
}
