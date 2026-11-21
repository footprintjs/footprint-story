// storydeck deck/transforms.js at d683b08 (0.29.0): lines 63–65 (fixed, BETWEEN), 74–83 (wireEndsOf), 90–92 (endsRead,
// LANE, GAP), 95–97 (LABEL, shown), 123 (HEAD), 130–135 (headAt, labelBox) and 259–311 (wiresBetween), unchanged; 'export'
// added to headAt, labelBox and wiresBetween. Its imports are replaced: exitOutline and exit by the boxes control,
// NO_ROUTE by the kit's; and the three things wiresBetween reads of a page stand in for a plain object handed as `html`
// ({names, boxes, alone}): pieceNames (transforms.js 85–88), boxFinder (boxes.js 11–25), and cables/cablesOn (never
// reached: the property passes no floor). Nothing inside the copied lines is changed.
import {exitOutline, exit} from './storydeck-0.29.0-boxes.js';
import {NO_ROUTE} from '../../isometric.js';
const pieceNames = (html) => new Set(html.names);
function boxFinder(html) {
  const find = (name, where) => { if (!html.boxes[name]) throw new Error(`${where}: no piece "${name}" with a box`); return html.boxes[name]; };
  find.alone = (name) => html.alone.includes(name);
  return find;
}
const cables = () => { throw new Error('not reached'); }, cablesOn = cables;
const fixed = (v) => +v.toFixed(1);
/** A wire written by the pieces it joins: "from to to [bend]". */
const BETWEEN = /^\s*(\S+)\s+to\s+(\S+)(?:\s+(-?\d+(?:\.\d+)?))?\s*$/;
export function wireEndsOf(spec, names) {
  const m = BETWEEN.exec(spec);
  if (!m) return null;
  const end = (token) => {
    if (names.has(token)) return {name: token, port: null};
    const dot = token.lastIndexOf('.');
    return dot > 0 && dot < token.length - 1 && names.has(token.slice(0, dot)) ? {name: token.slice(0, dot), port: token.slice(dot + 1)} : {name: token, port: null};
  };
  return {from: end(m[1]), to: end(m[2]), bend: m[3]};
}
const endsRead = (spec, names) => { const e = wireEndsOf(spec, names); return e && [spec, e.from.name, e.to.name, e.bend]; };
const LANE = 80;   // px between two wires joining the same pieces, at most (less when a box is too small to hold them)
const GAP = 6;     // px between a wire's end and the box it leaves or reaches
const LABEL = {size: 18, char: 12, clear: 8};   // deck.css's label: its px size, a generous width per letter, px clear of the wire
/** The letters a label shows: one written as an entity (&amp;) is one letter, not five. */
const shown = (label) => label.replace(/&(?:#\d+|#x[\da-f]+|[a-z][a-z\d]*);/gi, '.').length;
const HEAD = 18;   // an arrow's head, in px: its length (its line stops four fifths of that short of the tip)
export function headAt(tip, [ux, uy]) {
  const f = fixed, back = [tip[0] - ux * HEAD, tip[1] - uy * HEAD], nx = -uy * HEAD * 0.6, ny = ux * HEAD * 0.6;
  return `<path class="head" d="M${f(tip[0])} ${f(tip[1])}L${f(back[0] + nx)} ${f(back[1] + ny)}L${f(back[0] - nx)} ${f(back[1] - ny)}Z"/>`;
}
/** Half a label's box: the letters it shows, and 4 px round them. */
export const labelBox = (label) => (label ? [(shown(label) * LABEL.char) / 2 + 4, LABEL.size / 2 + 4] : null);
export function wiresBetween(html, found, {shapes, floor, solids, routes}) {
  const names = pieceNames(html), read = found.map((f) => endsRead(f.m[1], names));
  if (!read.some(Boolean)) return {between: read, laid: []};
  const boxOf = boxFinder(html);
  // the wires laid along the floor before the picture was fitted (transformed · lay), put on the slide — or, for a
  // caller that laid none, laid here: the name is that one isometric piece alone, with no bend asked for
  const laid = !floor ? [] : routes ? cablesOn(routes, floor)
    : cables(read.map((m) => (m && m[3] === undefined && [m[1], m[2]].every((name) => shapes.has(name) && boxOf.alone(name)) ? [m[1], m[2]] : null)), shapes, floor, solids);
  /** One end of a wire: its middle, how far a line may stand off that middle and still cross it, and where a ray leaves it. */
  const endOf = (name, where) => {
    // an isometric piece's own outline, when the name is that piece alone: a name several pieces share is one box round them all, as ever
    const shape = boxOf.alone(name) ? shapes.get(name) : undefined;
    if (shape) return {middle: shape.middle, across: (n) => Math.min(exitOutline(shape.outline, shape.middle, n), exitOutline(shape.outline, shape.middle, [-n[0], -n[1]])), exit: (p, u) => exitOutline(shape.outline, p, u)};
    const box = boxOf(name, where);
    // half the box measured across the line: a lane closer to the middle than this, less 8 px, crosses the box, so its
    // ends are found on the box's edges (exit: from any point of such a line, as the line leaves the box)
    return {middle: [box.x + box.w / 2, box.y + box.h / 2], across: (n) => (Math.abs(n[0]) * box.w + Math.abs(n[1]) * box.h) / 2, exit: (p, u) => exit(box, p, u)};
  };
  // a pair's wires across its line, in its own direction (its names in order): those running that way first, on their
  // left of it, then those running back — on their own left. A cable is not on that line: it takes no lane.
  const pairOf = (m) => [m[1], m[2]].sort().join('\u0000'), lanes = new Map();
  read.forEach((m, i) => { if (m && !laid[i]?.points) lanes.set(pairOf(m), [...(lanes.get(pairOf(m)) ?? []), i]); });
  for (const [key, ids] of lanes) {
    const along = (i) => read[i][1] === key.split('\u0000')[0];
    lanes.set(key, [...ids.filter(along), ...ids.filter((i) => !along(i))]);
  }
  const between = read.map((m, i) => {
    if (!m) return null;
    const spec = found[i].m[1];
    if (m[1] === m[2]) throw new Error(`data-arrow="${spec}": a wire joins two pieces, not "${m[1]}" to itself`);
    if (laid[i]?.points) return laid[i];
    // in the pair's own direction (its names in order), so the wires both ways share one set of lanes
    const [a, b] = [m[1], m[2]].sort(), A = endOf(a, `data-arrow="${spec}"`), B = endOf(b, `data-arrow="${spec}"`);
    const ca = A.middle, cb = B.middle, len = Math.hypot(cb[0] - ca[0], cb[1] - ca[1]);
    if (len === 0) throw new Error(`data-arrow="${spec}": "${a}" and "${b}" share a middle — place them apart, or give the wire numbers`);
    const u = [(cb[0] - ca[0]) / len, (cb[1] - ca[1]) / len], n = [-u[1], u[0]];
    const lane = lanes.get(pairOf(m)), k = lane.indexOf(i), most = Math.max(0, Math.min(A.across(n), B.across(n)) - 8);
    const step = lane.length > 1 ? Math.min(LANE, (2 * most) / (lane.length - 1)) : 0, off = (k - (lane.length - 1) / 2) * step;
    const pa = [ca[0] + n[0] * off, ca[1] + n[1] * off], pb = [cb[0] + n[0] * off, cb[1] + n[1] * off];
    const ta = A.exit(pa, u) + GAP, tb = B.exit(pb, [-u[0], -u[1]]) + GAP;
    // a wire the floor had no way for says so: "too close" alone would name the wrong cause
    if (!(len - ta - tb >= 12)) {
      const why = laid[i]?.route.why;
      if (!why) throw new Error(`data-arrow="${spec}": "${a}" and "${b}" are too close for a wire between them (they touch or overlap) — move them apart, or give the wire numbers`);
      const cure = why === NO_ROUTE.work ? 'take wires or blocks out of this map so that every wire is laid, or ' : '';
      throw new Error(`data-arrow="${spec}": no way along the floor was laid for it (${why}), and "${a}" and "${b}" are too close for a straight wire between them — ${cure}move them apart, or give the wire numbers`);
    }
    const start = [pa[0] + u[0] * ta, pa[1] + u[1] * ta], end = [pb[0] - u[0] * tb, pb[1] - u[1] * tb];
    const [from, to] = m[1] === a ? [start, end] : [end, start];
    return [...from, ...to, Number(m[3] ?? 0)].map(fixed).join(' ');
  });
  return {between, laid};
}
