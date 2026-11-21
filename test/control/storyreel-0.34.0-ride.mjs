// footprint-storyreel src/kits/isometric/ride.mjs at 502044a (0.34.0): lines 18–26 (onStops) and 51–59 (seenAt). 'export' added to seenAt.
/** A value on stops [[time, value], …] (straight lines between, held past the ends): a film's own interpolation of CSS's linear(). */
export function onStops(stops, u) {
  if (u <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    const [t1, v1] = stops[i];
    if (u <= t1) { const [t0, v0] = stops[i - 1]; return t1 > t0 ? v0 + ((v1 - v0) * (u - t0)) / (t1 - t0) : v1; }
  }
  return stops.at(-1)[1];
}
/** How much of a packet at share `p` of its line shows by the hidden ramps: 1 in the open, 0 behind a block, straight between (deck/rides.js · seenOf). */
export function seenAt(ramps, p) {
  let seen = 1;
  for (const [outFrom, outTo, backFrom, backTo] of ramps) {
    const terms = [...(outTo > outFrom ? [(outTo - p) / (outTo - outFrom)] : []), ...(backTo > backFrom ? [(p - backFrom) / (backTo - backFrom)] : [])];
    seen = Math.min(seen, terms.length ? Math.max(0, Math.min(1, Math.max(...terms))) : 0);
  }
  return seen;
}
