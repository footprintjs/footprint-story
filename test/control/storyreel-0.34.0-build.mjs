// footprint-storyreel src/kits/isometric/build.mjs at 502044a (0.34.0): lines 87–91 (roundOutline). 'export' added.
/** A round thing's outline as points round it: the upper half of its top, then the lower half of its foot (StoryDeck's roundOutline). */
export function roundOutline(top, bottom, steps = 12) {
  const arc = (e, from) => Array.from({length: steps + 1}, (_, i) => { const a = from + (Math.PI * i) / steps; return [e.cx + e.rx * Math.cos(a), e.cy + e.ry * Math.sin(a)]; });
  return [...arc(top, Math.PI), ...arc(bottom, 0)];
}
