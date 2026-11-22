/**
 * The plane geometry the strokes need, and nothing else: inside a ring, how far from a ring's edge, and where a
 * segment crosses one. Rings are closed lists of points [[x, y], …] (the last joins the first). WHY its own file: the
 * fills, the pen's room and the paint list's hidden edges all ask these three questions, and one answer each keeps them
 * agreeing.
 */

/** The distance from (x, y) to the segment a–b. */
export function toSegment(x, y, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / l2)) : 0;
  return Math.hypot(a[0] + dx * t - x, a[1] + dy * t - y);
}

/** The distance from (x, y) to the nearest edge of a ring. */
export function toRing(x, y, ring) {
  let d = Infinity;
  for (let i = 0; i < ring.length; i += 1) d = Math.min(d, toSegment(x, y, ring[i], ring[(i + 1) % ring.length]));
  return d;
}

/** Whether (x, y) is inside a ring, by the even-odd rule (a ray to the right crosses its edges an odd number of times). */
export function insideRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * Where the segment p–q crosses the edges of a ring, as shares of the way from p to q (0 to 1), in order. An edge
 * crossed at an end of it is counted once: by the half-open rule on the side of the segment's line each end lies, so a
 * segment through a corner counts it as a crossing only when the ring passes from one side to the other there.
 */
export function crossings(p, q, ring) {
  const dx = q[0] - p[0], dy = q[1] - p[1], out = [];
  const side = (r) => (r[0] - p[0]) * dy - (r[1] - p[1]) * dx;
  for (let i = 0; i < ring.length; i += 1) {
    const a = ring[i], b = ring[(i + 1) % ring.length], sa = side(a), sb = side(b);
    if ((sa > 0) === (sb > 0)) continue;
    const ex = b[0] - a[0], ey = b[1] - a[1], den = dx * ey - dy * ex;
    if (den === 0) continue;
    const t = ((a[0] - p[0]) * ey - (a[1] - p[1]) * ex) / den;
    if (t >= 0 && t <= 1) out.push(t);
  }
  return out.sort((u, v) => u - v);
}
