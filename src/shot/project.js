/** Numbers in, numbers out: a point on a frame and back, and the box a thing fills. Each reads its inputs first. */
import { deepFreeze, orRefuse, pointOf, readAll } from './fields.js';
import { add, aim, landing, mul, rayAt } from './lens.js';
import { boxFor, solidOf } from './solid.js';
import { thingFrom } from './scene.js';
import { cameraFrom, frameFrom } from './camera.js';

const opened = (f, camera, frame) => { const c = cameraFrom(camera, f), s = frameFrom(frame, f); return c && s ? aim(c, s) : null; };

/** Where a point lands on the frame: frozen {x, y, depth}, y growing downward. At or behind the camera, x and y are null. */
export const project = (point, camera, frame) => deepFreeze(orRefuse(readAll((f) => {
  const p = pointOf(f, point, 'point'), lens = opened(f, camera, frame);
  return p && lens ? landing(lens, p) : null;
}), 'projection'));

/** The point at a place on the frame and a depth in front of the camera: [x, y, z]. What a click means at that depth. */
export const unproject = (x, y, depth, camera, frame) => deepFreeze(orRefuse(readAll((f) => {
  const px = f.number(x, 'x'), py = f.number(y, 'y'), d = f.number(depth, 'depth', { least: 0, above: true }), lens = opened(f, camera, frame);
  return lens && px !== null && py !== null && d !== null ? add(lens.eye, mul(rayAt(lens, px, py), d)) : null;
}), 'projection'));

/** The box a thing fills: frozen {state, x0, y0, x1, y1, depth}. `state` is seen, behind, inside or crosses; only a thing seen has a box. */
export const boxOf = (thing, camera, frame) => deepFreeze(orRefuse(readAll((f) => {
  const t = thingFrom(thing, f, 'thing'), lens = opened(f, camera, frame);
  return t && lens ? boxFor(lens, solidOf(t)) : null;
}), 'projection'));
