/**
 * Back to front: the order to draw things in so the nearer one covers the further one.
 *
 * WHY not one score a thing (col + row + height): it is right for things one tile big and wrong for long ones.
 * WHY only pairs that meet on the frame: a rule for every pair ("this one is further along the cols") orders things
 * that never touch on the frame, and those extra rules can run round in a ring that the picture does not have. So a
 * pair gets a rule only when their outlines share some of the frame; then exactly one of them is in front there.
 *
 * Two boxes share some of the frame when their shadows overlap along the three directions a box's edges run in on
 * the frame (their outlines are six-sided with the same three directions, so those three tests are enough). Of two
 * that do, the one behind is the one that can never cover the other: all of it at smaller cols, or at smaller rows,
 * or below. Things that pass through each other have no right order and get no rule.
 *
 * A ring that IS in the picture (three long boxes, each over the next) has no right order. It is cut at the thing
 * given first among those in the ring, and everything outside the ring is still drawn in a right order.
 */
import { readThing } from './thing.js';

/** The most things one picture orders. */
export const MOST_ISOMETRIC_THINGS = 256;

const never = (a, b) => a.at[0] + a.size[0] <= b.at[0] || a.at[1] + a.size[1] <= b.at[1] || a.at[2] + a.size[2] <= b.at[2];

/** A box's shadow along the three edge directions of the frame: [lo, hi] each. `k` is a unit of height in tile heights. */
function shadows({ at: [c, r, z], size: [w, d, h] }, k) {
  return [[c - (r + d), c + w - r], [z * k - (r + d), (z + h) * k - r], [z * k - (c + w), (z + h) * k - c]];
}
const meet = (a, b) => a.every(([lo, hi], i) => lo < b[i][1] && b[i][0] < hi);

/** A thing in a ring among those not drawn: walk back along what each waits for until a thing comes round again, then take the ring's first given. */
function inRing(start, waitsFor, drawn) {
  const seen = new Map();
  let at = start;
  while (!seen.has(at)) { seen.set(at, seen.size); at = waitsFor[at].find((i) => !drawn[i]); }
  const from = seen.get(at);
  return Math.min(...[...seen].filter(([, order]) => order >= from).map(([i]) => i));
}

/**
 * `items` sorted so the furthest is drawn first, for a view where a tile is `tileHeight` tall and a unit of height
 * `rise` pixels. `thingOf(item)` gives an item's {at, size} (default: the item is one). Among things with no rule
 * between them, the one given first is drawn first.
 */
export function backToFront(items, thingOf, { tileHeight, rise }) {
  if (!Array.isArray(items)) throw new Error(`isometric: backToFront takes a list of things, not ${typeof items}`);
  if (items.length > MOST_ISOMETRIC_THINGS) throw new Error(`isometric: backToFront orders at most ${MOST_ISOMETRIC_THINGS} things, not ${items.length}`);
  if (typeof thingOf !== 'function') throw new Error('isometric: backToFront(items, thingOf) takes a function that gives an item\'s {at, size}');
  const n = items.length, things = [];
  for (let i = 0; i < n; i += 1) things.push(readThing(thingOf(items[i]), `thing ${i + 1}`));
  const shadow = things.map((t) => shadows(t, rise / tileHeight));
  // waitsFor[j]: the things that must be drawn before j; then[i]: the things that wait for i
  const waitsFor = things.map(() => []), then = things.map(() => []);
  for (let i = 0; i < n; i += 1) for (let j = i + 1; j < n; j += 1) {
    if (!meet(shadow[i], shadow[j])) continue;
    const ij = never(things[i], things[j]), ji = never(things[j], things[i]);
    if (ij && !ji) { waitsFor[j].push(i); then[i].push(j); } else if (ji && !ij) { waitsFor[i].push(j); then[j].push(i); }
  }
  const waits = waitsFor.map((l) => l.length), drawn = new Array(n).fill(false), out = [];
  while (out.length < n) {
    let next = -1;
    for (let i = 0; i < n && next < 0; i += 1) if (!drawn[i] && waits[i] === 0) next = i;
    if (next < 0) next = inRing(drawn.indexOf(false), waitsFor, drawn);
    drawn[next] = true;
    out.push(items[next]);
    for (const j of then[next]) waits[j] -= 1;
  }
  return out;
}
