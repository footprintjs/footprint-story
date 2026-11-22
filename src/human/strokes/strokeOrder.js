/**
 * The `stroke-order` critic: how many detail or fill strokes start before their piece's outline is finished. A hand
 * blocks in a shape first, then adds what is inside it, then shades; detail drawn first reads as a printer filling
 * rows, not a person drawing (Van Sommers 1984). Pieces are told apart by their `group`.
 */
import { sketchOf } from './critique.js';

/** The most strokes drawn before their outline is done: none. */
export const STROKE_ORDER_MOST = 0;

export const strokeOrder = Object.freeze({
  name: 'stroke-order',
  limit: STROKE_ORDER_MOST,
  measure(track) {
    const sketch = sketchOf(track);
    if (!sketch) return null;
    const ends = new Map();
    for (const s of sketch.strokes) if (s.layer === 'outline') ends.set(s.group, Math.max(ends.get(s.group) ?? -Infinity, s.start + s.seconds));
    const early = sketch.strokes.filter((s) => s.layer !== 'outline' && ends.has(s.group) && s.start < ends.get(s.group) - 1e-9);
    return { value: early.length, basis: { early: early.length, stroke: early.length ? early[0].index : null, layer: early.length ? early[0].layer : null, group: early.length ? early[0].group : null } };
  },
  finding(early, who, basis) {
    if (!(early > STROKE_ORDER_MOST)) return null;
    return { level: 'warn', message: `${who}: ${early} ${basis.layer} stroke${early === 1 ? ' starts' : 's start'} before the outline of its piece${basis.group ? ` "${basis.group}"` : ''} is finished (the first: stroke ${basis.stroke}) — a hand blocks in the outline first`,
      fix: "draw the outline first: mark each shape layer: 'outline' or layer: 'detail' and give each piece its group, with model: 'hand-sketch' (outline, then detail, then fills)" };
  },
});
