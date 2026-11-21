// storydeck deck/cable.js at 0cbd4d6 (0.30.0): lines 160–164 (cableWay), and deck/transforms.js lines 388–401 (leadOf, below). Their import of rounded points at ../../isometric.js.
import {rounded} from '../../isometric.js';

/** A cable's line on the slide: its points, the last pulled `back` px (where an arrow's head begins), its corners rounded — the kit's rounded way. */
export function cableWay({points, radius}, back = 0) {
  const tip = points.at(-1), before = points.at(-2), far = Math.hypot(tip[0] - before[0], tip[1] - before[1]) || 1, by = Math.max(0, Math.min(back, far - 1));   // never past the run's own start, never forwards
  return rounded([...points.slice(0, -1), [tip[0] - (tip[0] - before[0]) * by / far, tip[1] - (tip[1] - before[1]) * by / far]], radius);
}

// storydeck deck/transforms.js at 0cbd4d6 (0.30.0): lines 388–401 (leadOf). export added.
/**
 * A cable's lead at end `k` (0 the start, 1 the end) when it plugs into a port on a seen side: {way, pieces} — the
 * cable's points from that end, rounded, and the pieces of it the lead holds (out of the port, the riser and on to the
 * end of its floor corner: the upper part of that corner can be behind the block's face too); null for no lead.
 * `back`: px the line stops short of the tip there, for its head.
 */
export function leadOf({points, radius, ends}, k, back) {
  const end = ends?.[k];
  if (!end?.seen) return null;
  const run = k ? [...points].reverse() : [...points];
  if (back) { const [tip, next] = run, far = Math.hypot(next[0] - tip[0], next[1] - tip[1]) || 1, by = Math.max(0, Math.min(back, far - 1)); run[0] = [tip[0] + (next[0] - tip[0]) * by / far, tip[1] + (next[1] - tip[1]) * by / far]; }
  const way = rounded(run, radius);
  return {way, pieces: way.pieces.slice(0, 2 * (end.count - 2) + 2)};
}
