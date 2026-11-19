/**
 * Back to front: the order to draw things in so the nearer one covers the further one. Seen from this corner, a thing
 * is behind another when all of it stands at smaller cols, or at smaller rows, or below it. Two things apart both ways
 * round cannot cover each other, and keep the order given. Things that pass through each other have no right order:
 * they keep the order given too.
 */
import { readThing } from './grid.js';

/** The most things one picture orders. */
export const MOST_ISOMETRIC_THINGS = 256;

const behind = (a, b) => a.at[0] + a.size[0] <= b.at[0] || a.at[1] + a.size[1] <= b.at[1] || a.at[2] + a.size[2] <= b.at[2];

/**
 * `items` sorted so the furthest is drawn first. `thingOf(item)` gives an item's {at, size} (default: the item is one).
 * Among things with no order between them, the one given first is drawn first. A ring of things each behind the next
 * (it can be built, with long boxes) is cut at the one given first.
 */
export function backToFront(items, thingOf = (item) => item) {
  if (!Array.isArray(items)) throw new Error(`isometric: backToFront takes a list of things, not ${typeof items}`);
  if (items.length > MOST_ISOMETRIC_THINGS) throw new Error(`isometric: backToFront orders at most ${MOST_ISOMETRIC_THINGS} things, not ${items.length}`);
  if (typeof thingOf !== 'function') throw new Error('isometric: backToFront(items, thingOf) takes a function that gives an item\'s {at, size}');
  const things = items.map((item, i) => readThing(thingOf(item), `thing ${i + 1}`)), n = things.length;
  // waits[j]: how many things must be drawn before j; after[i]: the things that wait for i
  const waits = new Array(n).fill(0), after = things.map(() => []);
  for (let i = 0; i < n; i += 1) for (let j = i + 1; j < n; j += 1) {
    const ij = behind(things[i], things[j]), ji = behind(things[j], things[i]);
    if (ij && !ji) { after[i].push(j); waits[j] += 1; } else if (ji && !ij) { after[j].push(i); waits[i] += 1; }
  }
  const drawn = new Array(n).fill(false), out = [];
  while (out.length < n) {
    let next = -1;
    for (let i = 0; i < n && next < 0; i += 1) if (!drawn[i] && waits[i] === 0) next = i;
    if (next < 0) next = drawn.indexOf(false);   // a ring: cut it at the one given first
    drawn[next] = true;
    out.push(items[next]);
    for (const j of after[next]) waits[j] -= 1;
  }
  return out;
}
