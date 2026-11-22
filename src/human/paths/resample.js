/**
 * A line's points again, evenly spaced by distance: the first and the last kept, the rest every `spacing` px along it
 * (the last stretch may be shorter), or `count` points one even step apart. WHY: the power law and the critics read a
 * line point by point, and points bunched in one place and sparse in another would weigh that place more.
 */
import { refuse, shown, readPoints } from '../read.js';
import { arcTable, pointAt } from './arcLength.js';

export const MOST_RESAMPLED = 16384;

/** The points of `points` every `spacing` px along it, or `count` points evenly along it. */
export function resample(points, { spacing, count } = {}) {
  points = readPoints(points, "resample's points", { least: 1, most: MOST_RESAMPLED });
  const table = arcTable(points), L = table.length;
  let n;
  if (count !== undefined) {
    if (!(Number.isInteger(count) && count >= 2 && count <= MOST_RESAMPLED)) refuse(`a resample's count is a whole number from 2 to ${MOST_RESAMPLED} — not ${shown(count)}`);
    n = count;
  } else {
    if (!(typeof spacing === 'number' && spacing > 0 && Number.isFinite(spacing))) refuse(`a resample is every spacing px (above 0) or count points — not ${shown(spacing)}`);
    n = Math.max(2, Math.ceil(L / spacing - 1e-9) + 1);
    if (n > MOST_RESAMPLED) refuse(`a line ${Math.round(L)} px long every ${spacing} px is ${n} points — at most ${MOST_RESAMPLED}: give a larger spacing`);
  }
  const step = count !== undefined ? L / (n - 1) : spacing;
  return Object.freeze(Array.from({ length: n }, (_, i) => {
    const q = i === n - 1 ? points[points.length - 1] : pointAt(table, i * step);
    return Object.freeze([q[0], q[1]]);
  }));
}
