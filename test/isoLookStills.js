// The README's stills of the named looks (src/isometric/look-*.svg), written from the real paint list: a small map
// built by buildIsoMap in the look, each piece's items painted by a small SVG painter that draws an item as its fill
// and stroke say (no CSS, no role classes: every colour is the list's own, the map built with colours). The test
// (isometric-looks.test.js) pins each file to what this writes; WRITE_EXAMPLE=1 draws them again.
import { buildIsoMap, ISO_MAP_POLICIES } from '../isometric.js';
// the looks that name a "human:" choice (paper-grain) build with the human door's list; the others never read it
import { HUMAN_STYLE_CHOICES, strokeOutline } from '../human.js';
import { isometric, isoStyle, paintPiece, ISO_LOOKS } from '../isometric.js';

const n = (v) => String(Math.round(v * 10) / 10);
const INK = '#1f2430';

/** A path's segments as SVG data: a line to an arc's start unless the pen is there (paint.js), then the arc. */
function pathData(segments) {
  let pen = null;
  return segments.map(([op, ...a]) => {
    if (op === 'move' || op === 'line') { pen = [a[0], a[1]]; return `${op === 'move' ? 'M' : 'L'}${n(a[0])},${n(a[1])}`; }
    if (op === 'close') return 'Z';
    const [cx, cy, rx, ry, from, to, anti] = a, start = [cx + rx * Math.cos(from), cy + ry * Math.sin(from)], end = [cx + rx * Math.cos(to), cy + ry * Math.sin(to)];
    const lead = pen && Math.hypot(pen[0] - start[0], pen[1] - start[1]) < 1e-9 ? '' : `L${n(start[0])},${n(start[1])}`;
    pen = end;
    return `${lead}A${n(rx)},${n(ry)} 0 0 ${anti ? 0 : 1} ${n(end[0])},${n(end[1])}`;
  }).join('');
}

/** One item as an SVG element, its fill and stroke as the list says them. */
function itemSvg(it) {
  const s = it.stroke, paint = ` fill="${it.fill?.colour ?? 'none'}"${s ? ` stroke="${s.colour}" stroke-width="${n(s.width)}" stroke-linejoin="${s.join}" stroke-linecap="${s.cap}"${s.alpha === 1 ? '' : ` stroke-opacity="${s.alpha}"`}` : ' stroke="none"'}`;
  if (it.item === 'polygon') return `<polygon${paint} points="${it.points.map(([x, y]) => `${n(x)},${n(y)}`).join(' ')}"/>`;
  if (it.item === 'ellipse') return `<ellipse${paint} cx="${n(it.cx)}" cy="${n(it.cy)}" rx="${n(it.rx)}" ry="${n(it.ry)}"/>`;
  if (it.item === 'lines') return `<path${paint} d="${it.segments.map(([x1, y1, x2, y2]) => `M${n(x1)},${n(y1)}L${n(x2)},${n(y2)}`).join('')}"/>`;
  if (it.item === 'path') return `<path${paint} d="${pathData(it.segments)}"/>`;
  // a hand-drawn stroke (the look "sketchy"): the ring round it, its caps in it (human · strokeOutline), filled in its ink
  if (it.item === 'stroke') return `<path fill="${s.colour}"${s.alpha === 1 ? '' : ` fill-opacity="${s.alpha}"`} d="M${strokeOutline(it.points, { cap: s.cap }).map(([x, y]) => `${n(x)},${n(y)}`).join('L')}Z"/>`;
  throw new Error(`the still's painter draws a polygon, an ellipse, lines, a path or a stroke — not a ${it.item}`);
}

/** The still's map: a floor, two blocks, a cylinder and a slab, placed by hand on a written grid, with colours. */
export function lookMap(look) {
  const c = (base) => ({ base, ink: INK });
  return buildIsoMap({
    floors: [{ name: 'room', at: [0, 0], size: [8, 6], colours: c('#efe8da') }],
    blocks: [
      { name: 'web', at: [1, 1], size: [2, 2, 1], colours: c('#d9e4f3') },
      { name: 'api', at: [5, 1], size: [2, 2, 1.5], colours: c('#e6dcf5') },
      { name: 'db', kind: 'cylinder', at: [1, 4], size: [2, 2, 1.2], colours: c('#f3e3c7') },
      { name: 'cache', at: [5, 4], size: [2, 2, 0.4], colours: c('#dcefe0') },
    ],
    grid: { tile: 72, origin: [330, 36] },
    style: { look },
  }, ISO_MAP_POLICIES.film, { choices: HUMAN_STYLE_CHOICES });
}

/** A look's still: its map's pieces painted back to front on the page's paper. */
export function lookStill(look, paper) {
  const map = lookMap(look), byName = new Map(map.blocks.map((b, i) => [b.name, map.paints[i]]));
  const groups = [...map.floorPaints, ...map.order.map((name) => byName.get(name))];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="90 12 552 288" width="552" height="288">\n`
    + `<rect x="90" y="12" width="552" height="288" fill="${paper}"/>\n`
    + groups.map((items) => `<g>${items.map(itemSvg).join('')}</g>\n`).join('')
    + '</svg>\n';
}

/** The stills the README shows: each look, its file, and the paper it is drawn on. */
export const LOOK_STILLS = Object.freeze([
  Object.freeze({ look: 'outlined', file: 'look-outlined.svg', paper: '#faf6ee' }),
  Object.freeze({ look: 'line-art', file: 'look-line-art.svg', paper: '#ffffff' }),
  Object.freeze({ look: 'paper-grain', file: 'look-paper-grain.svg', paper: '#faf6ee' }),
  Object.freeze({ look: 'duotone', file: 'look-duotone.svg', paper: '#ffffff' }),
  Object.freeze({ look: 'sketchy', file: 'look-sketchy.svg', paper: '#ffffff' }),
]);

/** The styles a ball is drawn in for the README's still of it (0.37.0): today's look, then every named look. */
export const BALL_STYLES = Object.freeze([null, ...Object.keys(ISO_LOOKS)]);

/** A ball in each style, side by side on one floor line, each painted by paintPiece (ball.js): src/isometric/ball-looks.svg. */
export function ballStill() {
  const grid = isometric({ tile: 72, origin: [300, 40] }), ink = '#1f2430';
  const painted = BALL_STYLES.map((look, i) => paintPiece(isoStyle(look ? { look } : null, { choices: HUMAN_STYLE_CHOICES }), { name: `ball-${look ?? 'usual'}`, kind: 'ball', at: [i * 1.3, -i * 1.3], size: [1.1, 1.1, 1.1] }, grid, { base: '#f3e3c7', ink }));
  // the page round the balls' boxes, 12 px to spare (the outlined look's band reaches 5 px past a box)
  const x = Math.floor(Math.min(...painted.map((p) => p.box.x)) - 12), y = Math.floor(Math.min(...painted.map((p) => p.box.y)) - 12);
  const w = Math.ceil(Math.max(...painted.map((p) => p.box.x + p.box.w)) + 12 - x), h = Math.ceil(Math.max(...painted.map((p) => p.box.y + p.box.h)) + 12 - y);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${w} ${h}" width="${w}" height="${h}">\n`
    + `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#faf6ee"/>\n`
    + painted.map(({ items }) => `<g>${items.map(itemSvg).join('')}</g>\n`).join('')
    + '</svg>\n';
}
