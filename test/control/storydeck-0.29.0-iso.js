// storydeck deck/iso.js at d683b08 (0.29.0): lines 272–276 (roundOutline). 'export' added.
/** A round thing's outline as points round it: the upper half of its top, then the lower half of its foot. */
export function roundOutline(top, bottom, steps = 12) {
  const arc = (e, from) => Array.from({length: steps + 1}, (_, i) => { const a = from + (Math.PI * i) / steps; return {x: e.cx + e.rx * Math.cos(a), y: e.cy + e.ry * Math.sin(a)}; });
  return [...arc(top, Math.PI), ...arc(bottom, 0)];
}
