/**
 * A cable on the frame: its numbers, its walk, and where its label stands on it. Plain numbers in, plain numbers out;
 * nothing is drawn — StoryDeck writes SVG with these, StoryReel paints a canvas.
 *
 *   CABLE                                     the cable's numbers: how far its ends stand off, its lanes, its head, its label
 *   LABEL_PLACES                              where along its cable a label may stand: the middle first, then out by turns
 *   labelHalf(letters)                        half a label's plate, [wide, high], for that many letters
 *   walkWay(way, from?, to?)                  a way walked: points CABLE.sample px apart at most
 *   held(points)                              points with the box round them: what a label is asked against
 *   labelPlace(way, half, hides, runs, looks, tip)   → [x, y], the label's middle on its cable
 *   stopShort(points, back?)                  a cable's points, the last pulled `back` px for a head
 *   cableWay({points, radius}, back?)         the cable's line: stopShort, its corners rounded
 *
 * WHY here: a deck and a film draw the same cable, so its label must stand in the same place on it, its plate be the
 * same size and its line walked the same way. They came from StoryDeck 0.29.0 (deck/cable.js · labelPlace, cableWalk,
 * held, LABEL_PLACES, its numbers; deck/transforms.js · labelBox, its numbers), which StoryReel 0.34.0 had copied
 * (kits/isometric/cables.mjs · labelAt, walk, labelHalf, ISO_CABLE); a property test holds each to those copies
 * (test/control/). The label's place is a candidate-position search: Christensen, Marks and Shieber (REFERENCES.md).
 */
import { numbers, own, refuse, shown, stored } from './thing.js';
import { rounded, MOST_WAY } from './path.js';
import { pairOf } from './outline.js';

/**
 * The cable's numbers, in px of the frame unless said: an end stands `clear` off the foot it touches; a straight wire
 * runs `gap` off the outlines, two on one pair `lane` apart at most and `laneInset` inside both, and fewer than `least`
 * px of it between the blocks is refused; a corner is rounded `corner` of a tile; an arrow's head is `head` long and its
 * line stops `headShort` of that before the tip; a walk asks a point each `sample` px, at most `walkMost` points; a
 * label is `label.size` px tall, `label.char` a letter (a generous width), `label.pad` round its letters; a cable keeps
 * `edge` off a label's plate, a label `tip` off the cable's tip (half that off its start); a map's labels spend at most
 * `looks` between them.
 */
export const CABLE = Object.freeze({ clear: 6, gap: 6, lane: 80, laneInset: 8, least: 12, corner: 0.4, head: 18, headShort: 0.8, sample: 6, walkMost: 512,
  label: Object.freeze({ size: 18, char: 12, pad: 4 }), edge: 3, tip: 16, looks: 60_000_000 });

/** Where a label may stand along its cable: the middle first, then a twentieth further to each side by turns, a fifth to four fifths of the way. */
export const LABEL_PLACES = Object.freeze(Array.from({ length: 13 }, (_, k) => +(0.5 + (k % 2 ? -1 : 1) * Math.ceil(k / 2) * 0.05).toFixed(2)));

/** The most entries of `hides` or `runs` one label is asked against (a map has 256 blocks and 1024 cables at most). */
export const MOST_HIDES = 1_000_000;

/** Half a label's plate, [wide, high]: `letters` (the letters it shows, counted by the tool) a generous width each, the line's height, and the pad round them. */
export function labelHalf(letters) {
  if (!(typeof letters === 'number' && letters >= 0 && Number.isFinite(letters))) refuse(`labelHalf takes how many letters a label shows, a number from 0 — not ${shown(letters)}`);
  const { size, char, pad } = CABLE.label;
  return [(letters * char) / 2 + pad, size / 2 + pad];
}

/** A way (rounded, or curveWay): its own `at` (a function), `start` and `length`. */
export function wayOf(v, what) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) refuse(`${what} is a way, as rounded() gives one ({start, pieces, length, at}) — not ${shown(v)}`);
  const at = own(v, 'at'), length = own(v, 'length');
  if (typeof at !== 'function' || typeof length !== 'number') refuse(`${what} is a way, as rounded() gives one: its own at(share) and length — not ${shown(v)}`);
  return { at, start: own(v, 'start'), length };
}

/**
 * A way walked from share `from` to share `to` (0 to 1): points CABLE.sample px apart at most, and never more than
 * CABLE.walkMost runs (a way longer than that is asked more coarsely, never at greater cost).
 */
export function walkWay(way, from = 0, to = 1) {
  const w = wayOf(way, 'walkWay\'s way');
  for (const [name, v] of [['from', from], ['to', to]]) if (!(typeof v === 'number' && v >= 0 && v <= 1)) refuse(`walkWay's ${name} is a share of the way, 0 to 1 — not ${shown(v)}`);
  const steps = Math.min(CABLE.walkMost, Math.max(1, Math.ceil(((to - from) * w.length) / CABLE.sample)));
  return Array.from({ length: steps + 1 }, (_, k) => w.at(from + ((to - from) * k) / steps));
}

/** The box round points already read: {points, left, top, right, bottom}. */
function box(points) {
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  for (const [x, y] of points) { left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y); }
  return { points, left, top, right, bottom };
}

/**
 * Points, with the box that holds them: {points, left, top, right, bottom}. What may be in the way of a label is asked
 * by its box first, so on a map of hundreds of cables each label looks only at the few things near it.
 */
export function held(points) {
  if (!Array.isArray(points)) refuse(`held takes points, [[x, y], …] — not ${shown(points)}`);
  if (points.length > CABLE.walkMost * 64) refuse(`held takes at most ${CABLE.walkMost * 64} points — not ${points.length}`);
  return box(Array.from({ length: points.length }, (_, i) => pairOf(Object.hasOwn(points, i) ? own(points, i) : undefined, `point ${i + 1} of held`)));
}

/** One entry of hides or runs: its box read now (a look each), its points only when it is near (`pointsOf`). */
function heldOf(v, what) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) refuse(`${what} is points held, as held() gives them ({points, left, top, right, bottom}) — not ${shown(v)}`);
  const h = { points: own(v, 'points'), left: own(v, 'left'), top: own(v, 'top'), right: own(v, 'right'), bottom: own(v, 'bottom'), of: own(v, 'of'), what };
  if (!Array.isArray(h.points) || ![h.left, h.top, h.right, h.bottom].every((n) => typeof n === 'number')) refuse(`${what} is points held, as held() gives them: its own points and the four numbers of its box — not ${shown(v)}`);
  return h;
}
/** A near entry's points, read once a place (each its own [x, y]). */
const pointsOf = (h) => Array.from({ length: h.points.length }, (_, i) => pairOf(Object.hasOwn(h.points, i) ? own(h.points, i) : undefined, `point ${i + 1} of ${h.what}`));

/** Whether a point is inside an outline (its points in order round it). */
function inside(outline, [x, y]) {
  let odd = false;
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
    const [xi, yi] = outline[i], [xj, yj] = outline[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) odd = !odd;
  }
  return odd;
}

/** Those of `things` (each held) whose box reaches within `far` px of the box round `at`. */
const near = (things, at, half, far = 0) => things.filter((t) => t.right > at[0] - half[0] - far && t.left < at[0] + half[0] + far && t.bottom > at[1] - half[1] - far && t.top < at[1] + half[1] + far);

/** A list of held entries, its length checked (listOf) before an entry is read (heldList). */
function listOf(v, what) {
  if (!Array.isArray(v)) refuse(`${what} is a list of points held (held()) — not ${shown(v)}`);
  if (v.length > MOST_HIDES) refuse(`${what} is at most ${MOST_HIDES} entries — not ${v.length}`);
  return v;
}
const heldList = (v, what) => Array.from({ length: v.length }, (_, i) => heldOf(Object.hasOwn(v, i) ? own(v, i) : undefined, `${what}[${i}]`));

/**
 * Where a cable's label stands: on the cable itself, as near its middle as it can be with nothing in its way. A cable
 * lies on the floor, so a block standing nearer the viewer is drawn over it and over its label, and beside the middle
 * of a cable there is often a block's face, or the cable's twin.
 *
 * `way`: the cable's line (rounded, or curveWay); `half`: half the label's width and height (labelHalf); `hides`: what
 * hides a label, each an outline held (held) — what each block draws, and the labels placed before this one; `runs`:
 * the map's cables, each walked (walkWay), held, and marked with its way (`of`) — this cable's own is passed over;
 * `looks`: {left}, the looks the map has left (CABLE.looks at its start), spent here; `tip`: the cable's tip (where its
 * head points), which the label keeps CABLE.tip px off (half that off the line's start).
 *
 * Gives [x, y], the label's middle: the first of LABEL_PLACES where no outline reaches it and no other cable runs
 * through it; where there is none, the place where the least of it is hidden, of those the one the least of another
 * cable runs through, and of those the earliest. A place that would cost more looks than are left is not asked, nor
 * any after it: the label takes the best place asked so far, or the cable's middle when none was. WHY a limit: a deck
 * is text someone wrote, built on every save — a map of thousands of labelled cables costs no more than this.
 */
export function labelPlace(way, half, hides, runs = [], looks = { left: CABLE.looks }, tip = undefined) {
  const w = wayOf(way, 'labelPlace\'s way'), start = pairOf(w.start, 'labelPlace\'s way\'s start');
  // the plate and the looks left are finite: a NaN or an Infinity there would make every place cost nothing (NaN is
  // more than no number), and the map's labels would search past their shared budget
  const [hw, hh] = pairOf(half, 'labelPlace\'s half (labelHalf)');
  if (!(Number.isFinite(hw) && Number.isFinite(hh) && hw >= 0 && hh >= 0)) refuse(`labelPlace's half (labelHalf) is [wide, high], two finite numbers from 0 — not ${shown([hw, hh])}`);
  const hideList = listOf(hides, 'labelPlace\'s hides'), runList = listOf(runs, 'labelPlace\'s runs');
  if (!looks || typeof looks !== 'object' || Array.isArray(looks)) refuse(`labelPlace's looks is {left}, the looks the map has left — not ${shown(looks)}`);
  const left = stored(looks, 'left', 'labelPlace\'s looks.left');
  if (!(typeof left === 'number' && Number.isFinite(left))) refuse(`labelPlace's looks.left is a finite number, the looks the map has left — not ${shown(left)}`);
  const end = pairOf(tip === undefined ? w.at(1) : tip, 'labelPlace\'s tip');
  // finding what is near is a look at each thing: with too few left for that, no place is asked — and no entry read
  if (hideList.length + runList.length > left) return w.at(0.5);
  const hiding = heldList(hideList, 'labelPlace\'s hides'), lines = heldList(runList, 'labelPlace\'s runs');
  const { sample, edge, tip: tipPx } = CABLE, size = [hw, hh];
  const across = Math.max(1, Math.ceil((2 * hw) / sample)), down = Math.max(1, Math.ceil((2 * hh) / sample));
  const round = ([x, y], far) => box([[x - far, y - far], [x + far, y - far], [x + far, y + far], [x - far, y + far]]);
  const ends = [round(end, tipPx), round(start, tipPx / 2)];
  let best = null;
  for (const t of LABEL_PLACES) {
    if (hiding.length + lines.length > looks.left) break;   // finding what is near is a look at each thing
    const at = w.at(t), over = [...near(hiding, at, size), ...near(ends, at, size)], crossing = near(lines, at, size, edge).filter((run) => run.of !== way);
    const sides = over.reduce((sum, outline) => sum + outline.points.length, 0), steps = crossing.reduce((sum, run) => sum + run.points.length, 0);
    const cost = (across + 1) * (down + 1) * sides + steps + hiding.length + lines.length;
    if (cost > looks.left) break;
    looks.left -= cost;
    const outlines = over.map((o) => (o.what ? pointsOf(o) : o.points));
    let hidden = 0, crossed = 0;
    for (let i = 0; outlines.length && i <= across; i++) {
      for (let j = 0; j <= down; j++) {
        const point = [at[0] - hw + (2 * hw * i) / across, at[1] - hh + (2 * hh * j) / down];
        if (outlines.some((outline) => inside(outline, point))) hidden += 1;
      }
    }
    for (const run of crossing) for (const [x, y] of pointsOf(run)) if (Math.abs(x - at[0]) < hw + edge && Math.abs(y - at[1]) < hh + edge) crossed += 1;
    if (!hidden && !crossed) return at;
    if (!best || hidden < best.hidden || (hidden === best.hidden && crossed < best.crossed)) best = { at, hidden, crossed };
  }
  return best ? best.at : w.at(0.5);
}

/**
 * A cable's points with the last pulled `back` px towards the one before it — where an arrow's head begins
 * (CABLE.head * CABLE.headShort, or 0 for none): never past 1 px short of the last run's own start, never forwards, so
 * a last run shorter than the pull keeps a sliver of line under its head. A new list; the points are read once each.
 * cableWay rounds what this gives; a tool that rounds a lead from one end (StoryDeck's lead into a port) reverses it.
 *
 * WHY here: a deck and a film draw the same cable, so its line must stop at the same place. StoryDeck 0.30.0
 * (deck/cable.js · cableWay, deck/transforms.js · leadOf) stopped it by this rule; StoryReel 0.35.0
 * (kits/isometric/cables.mjs · cableOf) pulled it back at most half the last run, so on a last run under twice the
 * pull (28.8 px) the film's line ran on nearer the tip, under the head, than the deck's.
 * test/control/storydeck-0.30.0-cableWay.js holds StoryDeck's copy; a property test holds this to it.
 */
export function stopShort(points, back = 0) {
  // the size first: no entry is read of a list longer than a way may be (a sparse list of millions is refused at once)
  if (!Array.isArray(points) || points.length < 2 || points.length > MOST_WAY) refuse(`stopShort takes a cable's points, a way of 2 to ${MOST_WAY} points, [[x, y], …] — not ${shown(points)}`);
  if (!(typeof back === 'number' && back >= 0)) refuse(`stopShort pulls the cable's tip back a number of px, 0 or more — not ${shown(back)}`);
  const list = Array.from({ length: points.length }, (_, k) => own(points, k));
  const tip = numbers(list.at(-1), [2], 'the cable\'s last point', '[x, y]');
  const before = numbers(list.at(-2), [2], 'the point before the cable\'s last', '[x, y]');
  const far = Math.hypot(tip[0] - before[0], tip[1] - before[1]) || 1, by = Math.max(0, Math.min(back, far - 1));   // never past the run's own start, never forwards
  return [...list.slice(0, -1), [tip[0] - (tip[0] - before[0]) * by / far, tip[1] - (tip[1] - before[1]) * by / far]];
}

/**
 * A cable's line on the frame: its `points` ([[x, y], …], two or more) stopped short for its head (stopShort) and its
 * corners rounded `radius` px (rounded; absent, 0). What StoryDeck draws as a cable's path and both tools ride a packet on.
 */
export function cableWay(cable, back = 0) {
  if (!cable || typeof cable !== 'object' || Array.isArray(cable)) refuse(`cableWay takes a cable, {points, radius} — not ${shown(cable)}`);
  const points = own(cable, 'points'), radius = own(cable, 'radius');
  if (!Array.isArray(points) || points.length < 2 || points.length > MOST_WAY) refuse(`cableWay takes a cable whose points are a way of 2 to ${MOST_WAY} points, [[x, y], …] — not ${shown(points)}`);
  if (!(typeof back === 'number' && back >= 0)) refuse(`cableWay pulls the cable's tip back a number of px, 0 or more — not ${shown(back)}`);
  return rounded(stopShort(points, back), radius === undefined ? 0 : radius);
}
