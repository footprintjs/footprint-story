// footprint-storyreel at b02fb11 (0.49.0): src/contrast.mjs lines 20, 23–26 and 29 (CONTRAST, luminance, contrastRatio), src/kits/isometric/looks.mjs lines 41, 43 and 78–82 (lum, ratioOf, nameInk)
import {mixColour} from '../../isometric.js';
export const CONTRAST = Object.freeze({normal: 4.5, large: 3, largeHeight: .016, ring: .3, inkPercentile: .95, seen: 1.1});
export function luminance(r, g, b) {
  const lin = c => { const s = c / 255; return s <= .04045 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4; };
  return .2126 * lin(r) + .7152 * lin(g) + .0722 * lin(b);
}
export const contrastRatio = (a, b) => (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
const lum = (hex) => { const h = mixColour(hex, hex, 0); return luminance(...[1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))); };
export const ratioOf = (a, b) => contrastRatio(lum(a), lum(b));
export function nameInk(face, look) {
  if (face === null) return look.ink;
  const mine = ratioOf(look.ink, face);
  return mine >= CONTRAST.normal || ratioOf(look.bg, face) <= mine ? look.ink : look.bg;
}
