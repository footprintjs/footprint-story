/**
 * How much of a subject the camera sees: the share in the frame and the share each nearer thing covers, sampled by rays through
 * a grid of places on the frame. A ray answers what a box cannot: a corner of a box is not a ball, and a nearer centre is not
 * a nearer surface. Shares are good to a few percent; a thing wholly in frame or wholly covered comes out exactly.
 */
import { rayAt } from './lens.js';
import { meet } from './solid.js';

const GRID = 16;

const areaOf = (b) => Math.max(0, b.x1 - b.x0) * Math.max(0, b.y1 - b.y0);
const overlap = (a, b) => ({ x0: Math.max(a.x0, b.x0), y0: Math.max(a.y0, b.y0), x1: Math.min(a.x1, b.x1), y1: Math.min(a.y1, b.y1) });
const hasArea = (b) => b.x1 > b.x0 && b.y1 > b.y0;

/** Calls `visit(x, y)` at the middle of each cell of a grid over a box, and counts how many said true. */
function countOver(box, visit) {
  let count = 0;
  for (let i = 0; i < GRID; i++) for (let j = 0; j < GRID; j++) {
    if (visit(box.x0 + (box.x1 - box.x0) * (i + 0.5) / GRID, box.y0 + (box.y1 - box.y0) * (j + 0.5) / GRID)) count++;
  }
  return count;
}

const whole = (lens) => ({ x0: 0, y0: 0, x1: lens.w, y1: lens.h });

/** The area of a box the subject really fills. */
const filled = (lens, solid, box) => areaOf(box) * countOver(box, (x, y) => meet(solid, lens.eye, rayAt(lens, x, y)) < Infinity) / (GRID * GRID);

/** The share of a subject inside the frame, 0..1. A point with no area is in or out. */
export function shareInFrame(lens, solid, box) {
  if (!hasArea(box)) return box.x0 >= 0 && box.x0 <= lens.w && box.y0 >= 0 && box.y0 <= lens.h ? 1 : 0;
  const frame = whole(lens), inFrame = (x, y) => x >= 0 && x <= lens.w && y >= 0 && y <= lens.h;
  let hits = 0, kept = 0;
  countOver(box, (x, y) => { if (meet(solid, lens.eye, rayAt(lens, x, y)) < Infinity) { hits++; if (inFrame(x, y)) kept++; } return false; });
  if (kept) return kept / hits;
  // Too much of it is off frame for the grid to land on what is left: look only where the two boxes meet.
  const meetBox = overlap(box, frame);
  return hits && hasArea(meetBox) ? Math.min(1, filled(lens, solid, meetBox) / (areaOf(box) * hits / (GRID * GRID))) : 0;
}

/** Which sides of the frame a box goes past. */
export function sidesPast(lens, box) {
  const sides = [];
  if (box.x0 < 0) sides.push('left');
  if (box.x1 > lens.w) sides.push('right');
  if (box.y0 < 0) sides.push('top');
  if (box.y1 > lens.h) sides.push('bottom');
  return sides;
}

/** A point subject: a ray to it either arrives or meets something first. */
const coversPoint = (lens, box, other) => {
  const ray = rayAt(lens, box.x0, box.y0);
  return meet(other.solid, lens.eye, ray) < box.depth ? 1 : 0;
};

/** The share of what is in frame of a subject that another thing covers, 0..1. */
function shareCovered(lens, solid, box, other, seen, area) {
  if (!hasArea(box)) return coversPoint(lens, box, other);
  const reach = other.box.state === 'seen' ? overlap(seen, other.box) : seen;
  if (!hasArea(reach)) return 0;
  const covered = countOver(reach, (x, y) => {
    const ray = rayAt(lens, x, y), own = meet(solid, lens.eye, ray);
    return own < Infinity && meet(other.solid, lens.eye, ray) < own;
  });
  return Math.min(1, areaOf(reach) * covered / (GRID * GRID) / area);
}

/** What stands in front of a subject: [{name, share}], most first, then by name. A thing behind the camera blocks nothing. */
export function blockersOf(lens, subject, others) {
  const { solid, box } = subject, seen = overlap(box, whole(lens)), area = hasArea(box) ? filled(lens, solid, seen) : 1;
  if (!area) return [];
  const list = [];
  for (const other of others) {
    if (other.solid === solid || other.box.state === 'behind') continue;
    const share = shareCovered(lens, solid, box, other, seen, area);
    if (share > 0) list.push({ name: other.solid.thing.name, share });
  }
  return list.sort((a, b) => b.share - a.share || (a.name < b.name ? -1 : 1));
}
