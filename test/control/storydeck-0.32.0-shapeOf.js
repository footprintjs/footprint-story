// deck/iso.js lines 80-81 (fixed, points) and 301-321 (shapeOf), at fc9e4ca
import {floorLabelPlace, roundOutline} from '../../isometric.js';
const fixed = (v) => +v.toFixed(1);
const points = (list, x, y) => list.map((p) => `${fixed(p.x - x)},${fixed(p.y - y)}`).join(' ');
export function shapeOf(p, grid, covers = []) {
  try {
    if (p.kind === 'floor') {
      if (p.size.length !== 2) throw new Error(`isometric: a floor's size is "cols rows" — not "${p.size.join(' ')}"`);
      const f = grid.floor({cols: p.size[0], rows: p.size[1], at: p.at.slice(0, 2)}), {x, y} = f.box;
      const lines = f.lines.map(([x1, y1, x2, y2]) => `M${fixed(x1 - x)} ${fixed(y1 - y)}L${fixed(x2 - x)} ${fixed(y2 - y)}`).join('');
      const label = p.label ? floorLabelPlace({at: p.at, size: p.size}, grid, p.label, covers, {icon: Boolean(p.icon)}) : null;
      return {box: f.box, art: `<polygon class="iso-ground" points="${points(f.outline, x, y)}"/><path class="iso-lines" d="${lines}"/>`, say: null, label};
    }
    const thing = {at: p.at, size: p.size};
    if (p.kind === 'cylinder') {
      const c = grid.cylinder(thing), {x, y} = c.box, t = c.top, b = c.bottom;
      const side = `M${fixed(t.cx - t.rx - x)} ${fixed(t.cy - y)}L${fixed(b.cx - b.rx - x)} ${fixed(b.cy - y)}A${fixed(b.rx)} ${fixed(b.ry)} 0 0 0 ${fixed(b.cx + b.rx - x)} ${fixed(b.cy - y)}L${fixed(t.cx + t.rx - x)} ${fixed(t.cy - y)}Z`;
      return {box: c.box, art: `<path class="iso-side" d="${side}"/><ellipse class="iso-top" cx="${fixed(t.cx - x)}" cy="${fixed(t.cy - y)}" rx="${fixed(t.rx)}" ry="${fixed(t.ry)}"/>`, say: c.centre, room: (high) => grid.room({...thing, round: true}, high), outline: roundOutline(t, b)};   // a round thing's outline: footprint-story/isometric's, so a film's cylinder has the same edge
    }
    const b = grid.block(thing), {x, y} = b.box;
    return {box: b.box, art: `<polygon class="iso-left" points="${points(b.left, x, y)}"/><polygon class="iso-right" points="${points(b.right, x, y)}"/><polygon class="iso-top" points="${points(b.top, x, y)}"/>`, say: b.centre, room: (high) => grid.room(thing, high), outline: b.outline};
  } catch (e) {
    throw new Error(`${p.where}: ${e.message.replace(/^isometric: /, '')}`, {cause: e});
  }
}
