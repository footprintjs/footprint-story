/**
 * Simple collisions: a floor line (y down, so "below the floor" is a larger y) and axis-aligned boxes {x, y, w, h}.
 *
 *   makeWorld({ floor: 900, boxes: [{ x: 100, y: 700, w: 200, h: 200 }] }, who)   → { floor, boxes }, checked
 *   collide(points, world, from = 1)                                               → the same points, pushed out
 *   depthIn(x, y, world, radius)                                                   → how far (px) a point is inside
 *
 * A point inside a box is moved to the box's nearest side; a point below the floor is moved up onto it.
 * WHY boxes may not overlap, nor reach below the floor: then one push is enough. A point put on one box's side is
 * never inside another (their insides do not meet), and a box push never moves a point below the floor — so after a
 * step no point is inside anything, which the tests check after every step.
 */
import { list, num, readKeys, refuse, shown, stored } from './read.js';

export const MOST_BOXES = 32;

const inside = (x, y, b) => x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h;

/** The world an intent names: `floor` (a y, or none) and `boxes` (each {x, y, w, h}, w and h above 0). */
export function readWorld(get, who) {
  const floor = get('floor') === undefined || get('floor') === null ? null : num(get('floor'), { who, key: 'floor', unit: ' (the floor\'s y, px)' });
  const raw = get('boxes') ?? [];
  const boxes = list(raw, MOST_BOXES, who, 'boxes', '{x, y, w, h} boxes').map((b, i) => {
    const key = `boxes[${i}]`;
    if (!b || typeof b !== 'object' || Array.isArray(b)) refuse(`${who}: its ${key} is a box {x, y, w, h} — not ${shown(b)}`);
    const v = (k, lo, open) => num(stored(b, k, `${who}: its ${key}.${k}`), { who, key: `${key}.${k}`, lo, open, unit: ' px' });
    const box = Object.freeze({ x: v('x'), y: v('y'), w: v('w', 0, 'lo'), h: v('h', 0, 'lo') });
    if (floor !== null && box.y + box.h > floor) refuse(`${who}: its ${key} reaches below the floor (its foot at y ${box.y + box.h}, the floor at ${floor}) — stand it on the floor: y ${floor - box.h}`);
    return box;
  });
  for (let i = 0; i < boxes.length; i += 1) for (let j = i + 1; j < boxes.length; j += 1) {
    const a = boxes[i], b = boxes[j];
    if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) refuse(`${who}: its boxes[${i}] and boxes[${j}] overlap — boxes may touch but not overlap: make them one box`);
  }
  return Object.freeze({ floor, boxes: Object.freeze(boxes) });
}

/** A world from plain data {floor, boxes}, checked as an intent's are: what pushOut, collide and depthIn take. */
export const makeWorld = (o, who = 'the world') => readWorld(readKeys(o, ['floor', 'boxes'], who, 'its world'), who);

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
