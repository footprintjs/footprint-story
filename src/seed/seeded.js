/**
 * Seeded numbers: FNV-1a of a text, then mulberry32. Numbers from 0 (in) to 1 (out), the same list for the same text.
 *
 * WHY one leaf, imported by two doors: an isometric style's grain (src/isometric/style.js) and a hand's tremor
 * (src/human/models/move.js) are both "the same every time a frame is drawn, in a deck and in a film". Two copies of
 * the rule could drift apart, and a deck and a film would then disagree. This file imports nothing, so a page that
 * moves a hand never loads the isometric maths, nor the other way round (test/doors.test.js allows exactly this leaf).
 * Pinned byte for byte against 0.26.0's outputs: test/seed-shared.test.js.
 * Sources: G. Fowler, L. C. Noll and K.-P. Vo, the FNV-1a hash; T. Ettinger, mulberry32 (public domain).
 */
export function seeded(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return () => { h = (h + 0x6d2b79f5) >>> 0; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
