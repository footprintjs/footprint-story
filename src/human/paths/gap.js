/**
 * How much room a line has beside itself: at each point, the distance to the nearest piece of another stretch of the
 * same line — a hairpin's other leg, a loop passing close. WHY: a wobble across a line must never be larger than the
 * space it wobbles in, or two legs a pixel apart would cross and knot (the pen model caps its tremor at half this gap).
 *
 * "Another stretch" is a point whose way along the line from here is more than 1.5 times the straight distance
 * to it: on one stretch the two are nearly equal, and across a fold — even round the half circle at a hairpin's tip, π/2
 * times — the way round is longer than the gap. Only
 * gaps under `within` px are looked for (a grid of cells that wide), so the cost stays near one pass; a point with no
 * other stretch that near has the gap Infinity.
 */
import { refuse, shown, readPoints } from '../read.js';
import { arcTable } from './arcLength.js';

/** The gap beside each point of a line, up to `within` px (Infinity where there is none that near). Frozen. */
export function legGaps(points, within) {
  points = readPoints(points, "legGaps' points", { least: 1, most: 16384 });
  if (!(typeof within === 'number' && within > 0 && Number.isFinite(within))) refuse(`legGaps' within is how far to look, in px, above 0 — not ${shown(within)}`);
  const n = points.length, along = arcTable(points).along, cells = new Map(), key = (cx, cy) => `${cx},${cy}`;
  // the distance to each piece of the line (not only its points: two legs drawn over each other have no gap at all, wherever their points fall)
  let piece = 0;
  for (let j = 1; j < n; j += 1) piece = Math.max(piece, along[j] - along[j - 1]);
  const size = within + piece;
  points.forEach(([x, y], i) => { const c = key(Math.floor(x / size), Math.floor(y / size)); if (!cells.has(c)) cells.set(c, []); cells.get(c).push(i); });
  const toPiece = (x, y, j) => {
    const [ax, ay] = points[j], [bx, by] = points[j + 1], dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    const t = l2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2)) : 0;
    return { d: Math.hypot(ax + dx * t - x, ay + dy * t - y), at: along[j] + (along[j + 1] - along[j]) * t };
  };
  return Object.freeze(points.map(([x, y], i) => {
    const cx = Math.floor(x / size), cy = Math.floor(y / size);
    let gap = Infinity;
    for (let gx = cx - 1; gx <= cx + 1; gx += 1) for (let gy = cy - 1; gy <= cy + 1; gy += 1) {
      for (const j of cells.get(key(gx, gy)) ?? []) {
        if (j >= n - 1) continue;
        const { d, at } = toPiece(x, y, j);
        if (d < within && d < gap && Math.abs(at - along[i]) > 1.5 * d && Math.abs(at - along[i]) > 0) gap = d;
      }
    }
    return gap;
  }));
}
