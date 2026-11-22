// footprint-storyreel src/kits/isometric/motion-cover.mjs at 307d0f7 (0.44.0), lines 28–51 (NAME_WIDTH, nameBox, overlaps, area); `export` added to nameBox and overlaps.
export const NAME_WIDTH = 1.2;

/** A block's name on its top as a box on the frame, as built ([x0, y0, x1, y1]), or null when it has none: draw.mjs · drawBlock's layout. */
export function nameBox(b) {
  if (!b.fitted?.lines.length) return null;
  const {lines, size} = b.fitted, lh = size * 1.15, sf = b.smallFitted, small = sf ? sf.size * 1.15 + 2 : 0, height = lines.length * lh + small;
  const wide = Math.max(...lines.map((l) => [...l].length * size), sf ? [...sf.lines.join(' ')].length * sf.size : 0) * NAME_WIDTH;
  const [cx, cy] = b.shape.centre;
  return [cx - wide / 2, cy - height / 2, cx + wide / 2, cy + height / 2];
}

/** Whether a polygon (frame points) and a box overlap: their bounds meet, and the box is not wholly outside the polygon's convex hull's sides. */
export function overlaps(points, [x0, y0, x1, y1]) {
  const xs = points.map((p) => p[0]), ys = points.map((p) => p[1]);
  if (Math.max(...xs) <= x0 || Math.min(...xs) >= x1 || Math.max(...ys) <= y0 || Math.min(...ys) >= y1) return false;
  // a separating side of the outline (it is convex, its points in order round it): every box corner beyond it
  const corners = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], n = points.length, turn = Math.sign(area(points));
  for (let i = 0; i < n; i += 1) {
    const [ax, ay] = points[i], [bx, by] = points[(i + 1) % n];
    if (corners.every(([x, y]) => turn * ((bx - ax) * (y - ay) - (by - ay) * (x - ax)) < 0)) return false;
  }
  return true;
}
const area = (p) => p.reduce((s, [x, y], i) => { const [x2, y2] = p[(i + 1) % p.length]; return s + x * y2 - x2 * y; }, 0);
