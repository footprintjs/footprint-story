// storydeck deck/boxes.js at d683b08 (0.29.0): lines 27–47 (exitOutline, exit). Unchanged.
/**
 * How far a ray from p along the unit vector u runs before it leaves an outline: `points` round a shape with no dent,
 * [[x, y], …], p inside it. Infinity when it never does (a point outside, running away).
 */
export function exitOutline(points, [px, py], [ux, uy]) {
  let least = Infinity;
  points.forEach(([ax, ay], i) => {
    const [bx, by] = points[(i + 1) % points.length], ex = bx - ax, ey = by - ay, cross = ux * ey - uy * ex;
    if (Math.abs(cross) < 1e-12) return;   // the ray runs along this side: it leaves by another
    const t = ((ax - px) * ey - (ay - py) * ex) / cross, along = ((ax - px) * uy - (ay - py) * ux) / cross;
    if (t > 1e-9 && along >= -1e-9 && along <= 1 + 1e-9) least = Math.min(least, t);
  });
  return least;
}

/** How far a ray from p (inside the box) along the unit vector u runs before it leaves the box. */
export function exit(b, [px, py], [ux, uy]) {
  const tx = ux > 0 ? (b.x + b.w - px) / ux : ux < 0 ? (b.x - px) / ux : Infinity;
  const ty = uy > 0 ? (b.y + b.h - py) / uy : uy < 0 ? (b.y - py) / uy : Infinity;
  return Math.min(tx, ty);
}
