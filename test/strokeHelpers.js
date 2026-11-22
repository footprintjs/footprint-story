// Shared by the stroke tests: a square's corners, and "inside its ring (or on an edge), out of its holes" — what "no
// stroke outside" means for one point.
import { insideRing, toRing } from '../src/human/strokes/geometry.js';

export const square = (x, y, s) => [[x, y], [x + s, y], [x + s, y + s], [x, y + s]];
export const within = (x, y, ring, holes = [], tol = 1e-6) => (insideRing(x, y, ring) || toRing(x, y, ring) <= tol) && holes.every((h) => !insideRing(x, y, h) || toRing(x, y, h) <= tol);
