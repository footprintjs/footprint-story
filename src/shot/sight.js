/**
 * How much of a subject the camera sees: the share in the frame and the share each nearer thing covers, both as areas on the
 * frame, cut from the things' own outlines. No grid to fall between: a thin card counts as surely as a wide one.
 */
import { rayAt } from './lens.js';
import { meet } from './solid.js';
import { nearerArea } from './nearer.js';
import { areaOf, clipTo, rectangle } from './polygon.js';

const NEGLIGIBLE = 1e-12;
const frameOf = (lens) => rectangle(0, 0, lens.w, lens.h);

/** Which sides of the frame a box goes past. Box edges are exact, so this settles whether anything is cut. */
export function sidesPast(lens, box) {
  const sides = [];
  if (box.x0 < 0) sides.push('left');
  if (box.x1 > lens.w) sides.push('right');
  if (box.y0 < 0) sides.push('top');
  if (box.y1 > lens.h) sides.push('bottom');
  return sides;
}

/** What a thing fills inside the frame, worked out once per check. */
export const framedOf = (lens, seen) => { seen.framed ??= seen.outline ? clipTo(seen.outline, frameOf(lens)) : []; return seen.framed; };

/** A card seen exactly edge-on has no area: how far along its line it stays in frame. */
function lineShare(lens, box) {
  const inside = Math.hypot(Math.max(0, Math.min(box.x1, lens.w) - Math.max(box.x0, 0)), Math.max(0, Math.min(box.y1, lens.h) - Math.max(box.y0, 0)));
  return inside / Math.hypot(box.x1 - box.x0, box.y1 - box.y0);
}

/** The share of a subject inside the frame, 0..1. A point, with no outline, is in or out. */
export function shareInFrame(lens, seen) {
  const { box, outline } = seen;
  if (!outline) return box.x0 >= 0 && box.x0 <= lens.w && box.y0 >= 0 && box.y0 <= lens.h ? 1 : 0;
  const area = areaOf(outline);
  return area ? areaOf(framedOf(lens, seen)) / area : lineShare(lens, box);
}

const boxesMeet = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

/** What stands in front of a subject in frame: {blockers: [{name, share}], through: [names]}. A thing behind the camera blocks nothing. */
export function blockersOf(lens, subject, others) {
  const { solid, box, outline } = subject, blockers = [], through = [];
  const own = outline ? framedOf(lens, subject) : null, area = own ? areaOf(own) : 0;
  for (const other of others) {
    if (other.solid === solid || !other.outline || (other.box.state === 'seen' && !boxesMeet(box, other.box) && outline)) continue;
    if (!outline) {   // a point: the one ray to it arrives or meets something first
      if (meet(other.solid, lens.eye, rayAt(lens, box.x0, box.y0)) < box.depth) blockers.push({ name: other.solid.thing.name, share: 1 });
      continue;
    }
    const shared = area ? clipTo(own, framedOf(lens, other)) : [], part = areaOf(shared);
    if (part <= area * NEGLIGIBLE) continue;
    const near = nearerArea(lens, solid, other.solid, shared);
    if (near.area > area * NEGLIGIBLE) blockers.push({ name: other.solid.thing.name, share: Math.min(1, near.area / area) });
    if (near.through) through.push(other.solid.thing.name);
  }
  blockers.sort((a, b) => b.share - a.share || (a.name < b.name ? -1 : 1));
  return { blockers, through };
}
