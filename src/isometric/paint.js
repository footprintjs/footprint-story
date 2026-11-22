/**
 * A paint list: what a style gives back for one piece of a map — plain, cloneable items in paint order, which a tool's
 * painter draws (StoryReel on a canvas, StoryDeck as SVG). Nothing here draws.
 *
 *   { item: 'polygon', role: 'left', of: 'server', points: [[x, y], …], fill, stroke }
 *   { item: 'ellipse', role: 'top', of: 'db', cx, cy, rx, ry, fill, stroke }
 *   { item: 'path', role: 'side', of: 'db', segments: [['move', x, y], ['line', x, y], ['arc', cx, cy, rx, ry, from, to, anticlockwise], ['close']], fill, stroke }
 *   { item: 'lines', role: 'grid', of: 'ground', segments: [[x1, y1, x2, y2], …], fill: null, stroke }
 *   { item: 'stroke', role: 'ink', of: 'server', points: [[x, y, width, t], …], fill: null, stroke }
 *
 * `role` says what the item is (`top`, `left`, `right`, `side`, `ground`, `grid`, or a style's own, such as `hatch`): a
 * painter that colours by role (StoryDeck's CSS classes) reads it. `of` names the piece. A `fill` is null or
 * `{ mix: [toward, share], colour }` — the recipe a shading gave (the base colour mixed `share` of the way toward
 * `toward`, as CSS `color-mix` in srgb) and, when the caller gave a base colour, the colour it comes to (`colour`, a
 * `#rrggbb`; null when the base is the page's to decide). A `stroke` is null or `{ colour, alpha, width, join, cap }`.
 * Points are on the frame, in px: any finite number (a far piece on a big grid is far off the frame, never refused).
 * An arc runs from angle `from` to `to` (radians, y down, as a canvas's `ellipse`), at most half a turn (π) and never
 * none, counted the way it turns (`from - to` when anticlockwise, `to - from` when not, so a canvas never goes the long
 * way round), and like a canvas's it is reached by a straight line from where the pen is: an SVG painter writes that line,
 * then `A rx ry 0 0 (anticlockwise ? 0 : 1) endX endY`. WHY at most π: the large-arc flag is then always 0, and a
 * longer arc is two items' worth of trouble for every painter; a choice that needs more splits it.
 *
 * A `stroke` is a line drawn by hand (footprint-story/human · strokes): each point where the pen is, the width it lays
 * down there (0 to the stroke's `width`) and when, in seconds from the piece's start (rising along the item), so a painter
 * may draw it as it is drawn. A painter that cannot vary a line's width fills the ring round it (human ·
 * strokeOutline). WHY a kind of its own, not `lines` or `path` with a width per point: a painter that does not know it
 * then refuses it by name, never draws it at one width and calls it done; and its points are checked as what they are.
 * Its fill is null; its stroke names the colour, alpha and cap.
 *
 * WHY data: a deck and a film paint the same list, so they draw the same picture; a test compares lists, not
 * screenshots; and this package stays free of drawing code.
 */
import { fin, finite, refuse, shown } from './thing.js';

/** The kinds of item a painter must draw, the most items one piece's list may hold, and the most points or segments in one item. */
export const PAINT_ITEMS = Object.freeze(['polygon', 'ellipse', 'path', 'lines', 'stroke']);
export const MOST_PAINT_ITEMS = 512;
export const MOST_PAINT_POINTS = 4096;
const HEX = /^#[0-9a-f]{6}$/;
const NAME = /^[a-z][a-z0-9-]{0,31}$/;
const JOINS = ['round', 'miter', 'bevel'], CAPS = ['butt', 'round', 'square'];

const channels = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
/**
 * `hex` mixed `share` of the way toward `toward`, each channel rounded: StoryReel's `mix` and StoryDeck's CSS
 * `color-mix(in srgb, tone (1 - share), toward share)` (a browser may round a channel the other way at a half).
 */
export function mixColour(hex, toward, share) {
  const a = channels(hex), b = channels(toward);
  return `#${a.map((v, i) => Math.round(v + (b[i] - v) * share).toString(16).padStart(2, '0')).join('')}`;
}

/** A colour as this package takes it: `#rgb` or `#rrggbb`, any case — given back as lower-case `#rrggbb`. */
export function readColour(v, what) {
  if (typeof v !== 'string' || !/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)) refuse(`${what} is a colour, "#rgb" or "#rrggbb" — not ${shown(v)}`);
  const h = v.toLowerCase();
  return h.length === 4 ? `#${[...h.slice(1)].map((c) => c + c).join('')}` : h;
}

const point = (p, what) => { if (!(Array.isArray(p) && p.length === 2 && finite(p[0]) && finite(p[1]))) refuse(`${what} is a point [x, y], two finite numbers — not ${shown(p)}`); };
const count = (list, what) => { if (!Array.isArray(list) || list.length > MOST_PAINT_POINTS) refuse(`${what} is a list of at most ${MOST_PAINT_POINTS} — not ${Array.isArray(list) ? `${list.length} long` : shown(list)}`); };

function checkFill(fill, what) {
  if (fill === null) return;
  if (!fill || typeof fill !== 'object' || Array.isArray(fill)) refuse(`${what}'s fill is null or {mix: [toward, share], colour} — not ${shown(fill)}`);
  const keys = Object.keys(fill);
  if (keys.some((k) => k !== 'mix' && k !== 'colour')) refuse(`${what}'s fill holds mix and colour only — not ${shown(keys)}`);
  const { mix, colour } = fill;
  if (mix !== null && !(Array.isArray(mix) && mix.length === 2 && HEX.test(mix[0]) && fin(mix[1]) && mix[1] >= 0 && mix[1] <= 1)) refuse(`${what}'s fill mix is null or ["#rrggbb", a share from 0 to 1] — not ${shown(mix)}`);
  if (colour !== null && !HEX.test(colour)) refuse(`${what}'s fill colour is null or "#rrggbb" — not ${shown(colour)}`);
}

function checkStroke(stroke, what) {
  if (stroke === null) return;
  if (!stroke || typeof stroke !== 'object' || Array.isArray(stroke)) refuse(`${what}'s stroke is null or {colour, alpha, width, join, cap} — not ${shown(stroke)}`);
  const keys = Object.keys(stroke);
  if (keys.some((k) => !['colour', 'alpha', 'width', 'join', 'cap'].includes(k))) refuse(`${what}'s stroke holds colour, alpha, width, join and cap only — not ${shown(keys)}`);
  const { colour, alpha, width, join, cap } = stroke;
  if (colour !== null && !HEX.test(colour)) refuse(`${what}'s stroke colour is null (the page's) or "#rrggbb" — not ${shown(colour)}`);
  if (!(fin(alpha) && alpha >= 0 && alpha <= 1)) refuse(`${what}'s stroke alpha is from 0 to 1 — not ${shown(alpha)}`);
  if (!(fin(width) && width >= 0 && width <= 1000)) refuse(`${what}'s stroke width is from 0 to 1000 px — not ${shown(width)}`);
  if (!JOINS.includes(join) || !CAPS.includes(cap)) refuse(`${what}'s stroke join is ${JOINS.join(', ')} and its cap ${CAPS.join(', ')} — not ${shown([join, cap])}`);
}

/**
 * A paint list checked and frozen: every item one of PAINT_ITEMS, plain data (own stored fields, finite numbers, the
 * colours as `#rrggbb`), at most MOST_PAINT_ITEMS items and MOST_PAINT_POINTS points in each. `who` names the choice
 * that gave it, for the refusal. A function, a getter or a live object anywhere is refused: a record must clone.
 */
export function checkPaint(list, who, piece) {
  if (!Array.isArray(list)) refuse(`${who} gives back a paint list, a list of items — not ${shown(list)}`);
  if (list.length > MOST_PAINT_ITEMS) refuse(`${who} gives back ${list.length} items, and one piece holds at most ${MOST_PAINT_ITEMS}`);
  return Object.freeze(ownEntries(list, `${who}'s paint list`).map((raw, i) => {
    const what = `${who}'s item ${i + 1}`;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) refuse(`${what} is a plain object — not ${shown(raw)}`);
    // a deep copy of the plain data, read by own stored fields, so the list handed on shares nothing with the choice
    // that made it and no getter (code) is ever run
    const item = plainCopy(raw, what, 0);
    if (!PAINT_ITEMS.includes(item.item)) refuse(`${what} is a ${PAINT_ITEMS.join(', a ')} — not ${shown(item.item)}`);
    if (typeof item.role !== 'string' || !NAME.test(item.role)) refuse(`${what}'s role is a short lower-case name ("top", "hatch") — not ${shown(item.role)}`);
    if (item.of !== piece) refuse(`${what}'s of names its piece, ${shown(piece)} — not ${shown(item.of)}`);
    const allowed = { polygon: ['points'], ellipse: ['cx', 'cy', 'rx', 'ry'], path: ['segments'], lines: ['segments'], stroke: ['points'] }[item.item];
    const extra = Object.keys(item).filter((k) => !['item', 'role', 'of', 'fill', 'stroke', ...allowed].includes(k));
    if (extra.length) refuse(`${what} (a ${item.item}) holds item, role, of, ${allowed.join(', ')}, fill and stroke — not ${shown(extra)}`);
    if (!('fill' in item) || !('stroke' in item)) refuse(`${what} says its fill and its stroke (null for none)`);
    checkFill(item.fill, what);
    checkStroke(item.stroke, what);
    if (item.item === 'polygon') { count(item.points, `${what}'s points`); if (item.points.length < 3) refuse(`${what} is a polygon of at least 3 points — not ${item.points.length}`); item.points.forEach((p) => point(p, `${what}'s point`)); }
    if (item.item === 'ellipse' && !(['cx', 'cy', 'rx', 'ry'].every((k) => finite(item[k])) && item.rx >= 0 && item.ry >= 0)) refuse(`${what} is an ellipse {cx, cy, rx, ry}, finite numbers, rx and ry from 0 — not ${shown([item.cx, item.cy, item.rx, item.ry])}`);
    if (item.item === 'lines') { count(item.segments, `${what}'s segments`); for (const s of item.segments) if (!(Array.isArray(s) && s.length === 4 && s.every(finite))) refuse(`${what}'s segment is [x1, y1, x2, y2], finite numbers — not ${shown(s)}`); }
    if (item.item === 'stroke') {
      count(item.points, `${what}'s points`);
      if (item.points.length < 2) refuse(`${what} is a stroke of at least 2 points — not ${item.points.length}`);
      if (item.fill !== null || item.stroke === null) refuse(`${what} is a stroke: its fill is null and its stroke names its colour, alpha and cap`);
      let last = 0;
      for (const p of item.points) {
        if (!(Array.isArray(p) && p.length === 4 && p.every(finite) && p[2] >= 0 && p[2] <= item.stroke.width + 1e-9 && p[3] >= last)) refuse(`${what}'s point is [x, y, width, t]: finite numbers, the width from 0 to the stroke's ${item.stroke.width} px, t in seconds from ${last} on (rising along it) — not ${shown(p)}`);
        last = p[3];
      }
    }
    if (item.item === 'path') {
      count(item.segments, `${what}'s segments`);
      if (item.segments[0]?.[0] !== 'move') refuse(`${what} starts with a ['move', x, y]`);
      for (const s of item.segments) {
        const ok = Array.isArray(s) && ((s[0] === 'move' || s[0] === 'line') ? s.length === 3 && finite(s[1]) && finite(s[2])
          : s[0] === 'arc' ? s.length === 8 && s.slice(1, 7).every(finite) && s[3] >= 0 && s[4] >= 0 && typeof s[7] === 'boolean' && (s[7] ? s[5] - s[6] : s[6] - s[5]) > 0 && (s[7] ? s[5] - s[6] : s[6] - s[5]) <= Math.PI
            : s[0] === 'close' && s.length === 1);
        if (!ok) refuse(`${what}'s segment is ['move', x, y], ['line', x, y], ['arc', cx, cy, rx, ry, from, to, anticlockwise] (at most half a turn, never none) or ['close'] — not ${shown(s)}`);
      }
    }
    return deepFreeze(item);
  }));
}

/**
 * A list's entries, read as a plain list is read: its own stored value at each index, never its own `map` or a species,
 * a hole or a getter refused. WHY: a list handed in can carry its own methods; reading by index is what a record does.
 */
export function ownEntries(list, what) {
  if (!Array.isArray(list) || Object.getPrototypeOf(list) !== Array.prototype) refuse(`${what} is a plain list — not ${shown(list)}`);
  return Array.from({ length: list.length }, (_, i) => {
    const d = Object.getOwnPropertyDescriptor(list, i);
    if (!d) refuse(`${what} has a hole at ${i + 1} — give every entry`);
    if (!('value' in d)) refuse(`${what}'s entry ${i + 1} is read as a stored value, and this one is a getter (code, never run) — give the value itself`);
    return d.value;
  });
}

/** A copy of plain data — numbers, texts, booleans, null, plain lists and objects, at most 4 deep — or a refusal naming the fault. */
function plainCopy(v, what, depth) {
  if (v === null || typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') return v;
  if (typeof v !== 'object' || depth > 4) refuse(`${what} holds plain data only (numbers, texts, lists, objects, at most 4 deep) — not ${typeof v === 'object' ? 'one nested deeper' : shown(v)}`);
  const list = Array.isArray(v), proto = Object.getPrototypeOf(v);
  if (list ? proto !== Array.prototype : proto !== Object.prototype && proto !== null) refuse(`${what} holds plain lists and objects only — not ${shown(v)}`);
  if (list && v.length > MOST_PAINT_POINTS) refuse(`${what} holds lists of at most ${MOST_PAINT_POINTS} — not ${v.length} long`);
  const keys = list ? Array.from({ length: v.length }, (_, i) => String(i)) : Object.keys(v);
  const out = list ? [] : {};
  for (const key of keys) {
    const d = Object.getOwnPropertyDescriptor(v, key);
    if (!d) refuse(`${what} holds a list with a hole in it — give every entry`);
    if (!('value' in d)) refuse(`${what}: ${key} is read as a stored value, and this one is a getter (code, never run) — give the value itself`);
    out[list ? Number(key) : key] = plainCopy(d.value, what, depth + 1);
  }
  return out;
}

function deepFreeze(v) {
  if (v && typeof v === 'object') { for (const k of Object.keys(v)) deepFreeze(v[k]); Object.freeze(v); }
  return v;
}
