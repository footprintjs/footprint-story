/** Convex polygons as lists of points, cut exactly: the one law behind every share of the picture. No checks here: callers build them. */

/** The part of a convex polygon where `g` is at least 0; `g` must be linear along an edge. Points may carry any number of coordinates. */
export function keep(points, g) {
  const out = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length], ga = g(a), gb = g(b);
    if (ga >= 0) out.push(a);
    if ((ga >= 0) !== (gb >= 0)) { const u = ga / (ga - gb); out.push(a.map((v, k) => v + (b[k] - v) * u)); }
  }
  return out;
}

const signedArea = (points) => {
  let sum = 0;
  for (let i = 0; i < points.length; i++) { const a = points[i], b = points[(i + 1) % points.length]; sum += a[0] * b[1] - b[0] * a[1]; }
  return sum / 2;
};

export const areaOf = (points) => Math.abs(signedArea(points));

/** The part of a convex polygon inside another convex polygon. */
export function clipTo(points, convex) {
  if (convex.length < 3) return [];
  const side = signedArea(convex) >= 0 ? 1 : -1;
  let out = points;
  for (let i = 0; i < convex.length && out.length; i++) {
    const a = convex[i], b = convex[(i + 1) % convex.length];
    out = keep(out, (p) => side * ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])));
  }
  return out;
}

export const rectangle = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];

/** A point inside a convex polygon. */
export const middleOf = (points) => [0, 1].map((k) => points.reduce((sum, p) => sum + p[k], 0) / points.length);
