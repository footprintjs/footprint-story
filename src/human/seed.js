/**
 * Seeded numbers, by the rule the isometric styles keep (src/isometric/style.js · seeded): FNV-1a of a text, then
 * mulberry32. WHY seeded: a tremor or a wobble must be the same every time a frame is drawn, in a deck and in a film,
 * so the seed is made from what the entry says (its piece's name and its own words), never from a clock.
 */

/** Numbers from 0 (in) to 1 (out), the same list for the same text. */
export function seeded(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return () => { h = (h + 0x6d2b79f5) >>> 0; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
