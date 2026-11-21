// storydeck deck/rides.js at d683b08 (0.29.0): lines 30–37 (STEP), 81–106 (short, easing, seenOf) and 161–175 (curveLength, piecesLength). Unchanged.
const SHOWN = 60;   // letters of a deck's value an error quotes, at most
/**
 * How sharply a lead's copy of a packet takes over from the cable's own at the lead's edge: --sd-t × this. WHY a step
 * this steep: the two copies stand on the same point there, so the change must happen within one place along the line
 * (a ten-thousandth of it, under a px on any slide) — never a stretch where both show (a doubled glow) or neither.
 * `+ 1` puts the copy's whole step before the edge, so it is fully shown on the lead itself.
 */
const STEP = 10000;
/** A number for a page: at most `places` decimals, no trailing zeros, never "-0". */
export const short = (v, places = 4) => +v.toFixed(places) + 0;
/**
 * Stops [[time, value], …] (footprint-story/motion · rideProfile, showStops) as CSS's linear() easing: `linear` itself for a steady ride. A value keeps six
 * decimals (a millionth of the line: well under a px on any slide), a time three of its percent — so the emitted
 * easing keeps rideProfile's half-px promise.
 */
export const easing = (stops) => (stops.length === 2 && stops[0][1] === 0 && stops[1][1] === 1 ? 'linear' : `linear(${stops.map(([t, v]) => `${short(v, 6)} ${short(t * 100, 3)}%`).join(', ')})`);

/**
 * Where a packet shows along its line, as CSS on its --sd-t: 1 in the open, 0 behind a block, straight between; ''
 * where nothing hides it. `ramps`: footprint-story/motion · hiddenRamps; `pad`: a CSS share more each ramp keeps off its stretch (a
 * packet that keeps its size is a different size on the line at each zoom: its radius over --sd-keep); `leads`:
 * [startShare | null, endShare | null], the shares a lead's copy shows instead (the cable's own is hidden there).
 */
export function seenOf(ramps, pad = '', leads = [null, null]) {
  const t = 'var(--sd-t)', less = pad ? ` - ${pad}` : '';
  const each = ramps.map(([outFrom, outTo, backFrom, backTo]) => {
    const terms = [...(outTo > outFrom ? [`(${short(outTo, 5)} - ${t}${less}) * ${short(1 / (outTo - outFrom), 2)}`] : []), ...(backTo > backFrom ? [`(${t} - ${short(backFrom, 5)}${less}) * ${short(1 / (backTo - backFrom), 2)}`] : [])];
    return terms.length ? `clamp(0, ${terms.length > 1 ? `max(${terms.join(', ')})` : terms[0]}, 1)` : '0';
  });
  // off a lead's stretch: the cable's own packet is 1 minus the lead's copy (leadSeen), so the two never both show
  if (leads[0] !== null) each.push(`clamp(0, (${t} - ${short(leads[0], 5)}) * ${STEP}, 1)`);
  if (leads[1] !== null) each.push(`clamp(0, (${short(leads[1], 5)} - ${t}) * ${STEP}, 1)`);
  return each.length > 1 ? `min(${each.join(', ')})` : each[0] ?? '';
}
/** The length of a quadratic curve from `a` to `e` drawn towards `c`, in px: walked in so many straight runs. */
export function curveLength(a, c, e, runs = 64) {
  let length = 0, at = a;
  for (let k = 1; k <= runs; k++) {
    const t = k / runs, p = [0, 1].map((i) => (1 - t) * (1 - t) * a[i] + 2 * (1 - t) * t * c[i] + t * t * e[i]);
    length += Math.hypot(p[0] - at[0], p[1] - at[1]); at = p;
  }
  return length;
}
/** The length of a rounded way's pieces (footprint-story · rounded) from `start`, in px: a corner walked in 12 straight runs, as the kit walks it. */
export function piecesLength(start, pieces) {
  let length = 0, at = start;
  for (const piece of pieces) { length += piece.corner ? curveLength(at, piece.corner, piece.to, 12) : Math.hypot(piece.to[0] - at[0], piece.to[1] - at[1]); at = piece.to; }
  return length;
}
