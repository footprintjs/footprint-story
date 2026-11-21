// storydeck deck/cable.js at 0cbd4d6 (0.30.0): lines 160–164 (cableWay). Its import of rounded points at ../../isometric.js.
import {rounded} from '../../isometric.js';

/** A cable's line on the slide: its points, the last pulled `back` px (where an arrow's head begins), its corners rounded — the kit's rounded way. */
export function cableWay({points, radius}, back = 0) {
  const tip = points.at(-1), before = points.at(-2), far = Math.hypot(tip[0] - before[0], tip[1] - before[1]) || 1, by = Math.max(0, Math.min(back, far - 1));   // never past the run's own start, never forwards
  return rounded([...points.slice(0, -1), [tip[0] - (tip[0] - before[0]) * by / far, tip[1] - (tip[1] - before[1]) * by / far]], radius);
}
