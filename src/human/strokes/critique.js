/**
 * What the sketch critics read of a track: the plan's strokes, checked enough to measure. A tool's own sketch model
 * gives its plan as it likes; a critic measures what it can read and says null (it cannot say) for the rest.
 *
 *   sketchOf(track) → {strokes: [{layer, group, start, seconds, length?, path?, set?, xs?, ys?}], sets} | null
 */
import { basePlan } from '../models/wrap.js';
import { finite, isRecord } from '../read.js';

const LAYERS = ['outline', 'detail', 'fill'];
const points = (v) => Array.isArray(v) && v.length >= 2 && v.every((p) => Array.isArray(p) && p.length === 2 && finite(p[0]) && finite(p[1]));

/** The plan's strokes, each with a layer and its timing (and, when it has them, its corners, set and drawn points). */
export function sketchOf(track) {
  const plan = isRecord(track.plan) ? basePlan(track.plan) : null;
  if (!isRecord(plan) || !Array.isArray(plan.strokes) || !plan.strokes.length) return null;
  const strokes = plan.strokes.filter((s) => isRecord(s) && LAYERS.includes(s.layer) && finite(s.start) && finite(s.seconds)).map((s, i) => ({
    index: i, layer: s.layer, group: typeof s.group === 'string' ? s.group : '', start: s.start, seconds: s.seconds,
    length: finite(s.length) && s.length >= 0 ? s.length : null,
    path: points(s.path) ? s.path : null, set: Number.isInteger(s.set) ? s.set : null,
    xs: Array.isArray(s.xs) && Array.isArray(s.ys) && s.xs.length === s.ys.length && s.xs.every(finite) && s.ys.every(finite) ? s.xs : null, ys: s.ys,
  }));
  const sets = Array.isArray(plan.sets) ? plan.sets.map((x) => (isRecord(x) && finite(x.angle) && finite(x.spacing) && x.spacing > 0 && finite(x.lo) && finite(x.hi) ? x : null)) : [];
  return strokes.length ? { strokes, sets } : null;
}
