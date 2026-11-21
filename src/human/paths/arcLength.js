/**
 * A line's length table: how far along each of its points is. WHY: a share of a move's time must be a share of its
 * distance (or the pen speeds up where the points are far apart), and the table turns one into the other.
 *
 *   arcTable(points)               → {points, along, length}: along[i] the distance from the first point to point i
 *   pointAt(table, distance)       → [x, y] that far along (held at the ends)
 *   shareToDistance(table, share)  → how far along a point is that sits `share` of the way through the points by
 *                                    count (as when they were sampled at even steps of a curve's parameter)
 *   distanceToShare(table, d)      → the other way: the share by count at which the line is d long
 *
 * The points are read as every point here is (src/human/read.js · readPoints); the table is frozen plain data, and the
 * three readers take only a table arcTable made.
 */
import { refuse, shown, readPoints } from '../read.js';

export const MOST_TABLE_POINTS = 16384;
const made = new WeakSet();
const tableOf = (table, call) => { if (!made.has(table)) refuse(`${call} reads a table arcTable(points) made — not ${shown(table)}`); return table; };
const number = (n, what) => { if (typeof n !== 'number' || Number.isNaN(n)) refuse(`${what} is a number — not ${shown(n)}`); return n; };

/** The length table of a line of points. */
export function arcTable(points) {
  points = readPoints(points, "arcTable's points", { least: 1, most: MOST_TABLE_POINTS });
  const along = [0];
  for (let i = 1; i < points.length; i += 1) along.push(along[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
  const table = Object.freeze({ points, along: Object.freeze(along), length: along[along.length - 1] });
  made.add(table);
  return table;
}

/** The index of the last point no further along than d (binary search over `along`, which only rises). */
export function indexAt(along, d) {
  let lo = 0, hi = along.length - 1;
  if (d <= along[0]) return 0;
  if (d >= along[hi]) return hi;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (along[mid] <= d) lo = mid; else hi = mid; }
  return lo;
}

/** The point `distance` along the line, between the two points it falls between; the first or last point past an end. */
export function pointAt(table, distance) {
  number(distance, "pointAt's distance");
  const { points, along } = tableOf(table, 'pointAt'), last = points.length - 1;
  if (!(distance > 0)) return points[0];
  if (distance >= table.length) return points[last];
  const i = indexAt(along, distance), span = along[i + 1] - along[i], f = span > 0 ? (distance - along[i]) / span : 0;
  return Object.freeze([points[i][0] + (points[i + 1][0] - points[i][0]) * f, points[i][1] + (points[i + 1][1] - points[i][1]) * f]);
}

/** How far along the line is at `share` (0..1) of the way through its points by count. */
export function shareToDistance(table, share) {
  number(share, "shareToDistance's share");
  const last = tableOf(table, 'shareToDistance').along.length - 1, at = Math.max(0, Math.min(1, share)) * last, i = Math.min(Math.floor(at), last - 1);
  if (last === 0) return 0;
  return table.along[i] + (table.along[i + 1] - table.along[i]) * (at - i);
}

/** The share by count (0..1) at which the line is `distance` long. Where points sit together, the first of them. */
export function distanceToShare(table, distance) {
  number(distance, "distanceToShare's distance");
  const last = tableOf(table, 'distanceToShare').along.length - 1;
  if (last === 0 || !(distance > 0)) return 0;
  if (distance >= table.length) return 1;
  let i = indexAt(table.along, distance);
  while (i > 0 && table.along[i - 1] === distance) i -= 1;   // points that sit together: the first of them
  const span = table.along[i + 1] - table.along[i];
  return (i + (span > 0 ? (distance - table.along[i]) / span : 0)) / last;
}
