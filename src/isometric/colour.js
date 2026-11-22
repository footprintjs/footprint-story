/**
 * The colour measures: how light a colour is, how well one reads on another, which ink reads on a face, and how far
 * apart two colours look. Pure numbers, no drawing. Every colour is read by readColour (paint.js), the one reader:
 * `#rgb` or `#rrggbb`, any case.
 *
 *   luminance(hex)                        → its relative luminance (WCAG 2): 0 black, 1 white
 *   contrastRatio(a, b)                   → the contrast ratio (WCAG 2): 1 (the same) to 21 (black on white)
 *   readableInk(face, inks, { least })    → { ink, ratio, reads }: the first ink that reads on the face, else the best
 *   deltaE76(a, b)                        → the colour difference ΔE*ab (CIE76, CIELAB under D65)
 *
 * WHY one module: StoryReel (0.49.0, `looks.mjs` · nameInk) chose a block's name's ink by WCAG's 4.5 : 1 and StoryDeck
 * needs the same rule; the duotone's check (duotone.js) and its tests measure by the same ratio and the same ΔE. One
 * copy, so a deck and a film write a name in the same ink on the same face. Sources (REFERENCES.md): the luminance and
 * the ratio are WCAG 2's (relative luminance, contrast ratio); ΔE76 is the CIE's 1976 L*a*b* distance.
 */
import { ownEntries, readColour } from './paint.js';
import { fin, refuse, shown } from './thing.js';

/** WCAG's least ratio for small text (1.4.3, AA): what readableInk asks by default. */
const SMALL_TEXT = 4.5;

const linear = (c) => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
/** A colour's three channels, linear light (0 to 1). */
const linearOf = (hex, what) => { const h = readColour(hex, what); return [1, 3, 5].map((i) => linear(parseInt(h.slice(i, i + 2), 16))); };

/** A colour's relative luminance (WCAG 2): 0 black, 1 white. */
export function luminance(hex) {
  const [r, g, b] = linearOf(hex, 'the colour');
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** The contrast ratio of two colours (WCAG 2): 1 (the same) to 21 (black on white). Unrounded: 4.48 does not pass 4.5. */
export function contrastRatio(a, b) {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/**
 * The ink a word is written in on a face: the first of `inks` (in the caller's order of preference) whose ratio on
 * `face` is at least `least` (default 4.5, WCAG's small text), else the one that reads best (the earlier on a tie).
 * Gives `{ ink, ratio, reads }`: the ink (lower-case `#rrggbb`), its ratio on the face, and whether it reaches `least`.
 * WHY `reads`: when no ink reads, the best one is still a choice a tool must draw something with — it is handed back
 * with its ratio and `reads: false`, never as if it passed, so the tool can say so (or fix the face).
 *
 * StoryReel's nameInk(face, look) is readableInk(face, [look.ink, look.bg]).ink for every face (pinned against its
 * code: test/control/storyreel-0.49.0-nameInk.mjs).
 */
export function readableInk(face, inks, options = {}) {
  const ground = readColour(face, 'the face the ink stands on');
  const list = ownEntries(inks, 'the inks').map((ink, i) => readColour(ink, `ink ${i + 1}`));
  if (!list.length) refuse('the inks are a list of at least one colour — not an empty list');
  const least = leastOf(options);
  let best = null;
  for (const ink of list) {
    const ratio = contrastRatio(ink, ground);
    if (ratio >= least) return Object.freeze({ ink, ratio, reads: true });
    if (!best || ratio > best.ratio) best = { ink, ratio };
  }
  return Object.freeze({ ...best, reads: false });
}

/** readableInk's options: `least`, a ratio from 1 to 21 (default 4.5); nothing else. */
function leastOf(options) {
  if (options === null || options === undefined) return SMALL_TEXT;
  if (typeof options !== 'object' || Array.isArray(options)) refuse(`readableInk's options are {least} — not ${shown(options)}`);
  const keys = Object.keys(options);
  if (keys.some((k) => k !== 'least')) refuse(`readableInk's options hold least only — not ${shown(keys)}`);
  const d = Object.getOwnPropertyDescriptor(options, 'least');
  if (!d) return SMALL_TEXT;
  if (!('value' in d)) refuse('readableInk\'s least is read as a stored value, and this one is a getter (code, never run) — give the number itself');
  if (d.value === undefined) return SMALL_TEXT;
  if (!(fin(d.value) && d.value >= 1 && d.value <= 21)) refuse(`readableInk's least is a contrast ratio from 1 to 21 (4.5 for small text, 3 for large) — not ${shown(d.value)}`);
  return d.value;
}

/** sRGB (D65) to CIELAB: the matrix of IEC 61966-2-1, the white D65 (0.95047, 1, 1.08883), the CIE's cube-root law. */
function lab(hex, what) {
  const [r, g, b] = linearOf(hex, what);
  const xyz = [(0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047, 0.2126 * r + 0.7152 * g + 0.0722 * b, (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883];
  const f = xyz.map((t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116));
  return [116 * f[1] - 16, 500 * (f[0] - f[1]), 200 * (f[1] - f[2])];
}

/**
 * The colour difference of two colours, ΔE*ab (CIE76): their distance in CIELAB (D65). 0 the same, 100 black to white;
 * about 2.3 is the least an eye tells apart side by side. WHY CIE76 and not CIEDE2000: the package's pins (ok / warn /
 * bad apart, a duotone tint apart from them) are floors with room, where the simple distance is enough, and a reader can
 * check it by hand.
 */
export function deltaE76(a, b) {
  const x = lab(a, 'the first colour'), y = lab(b, 'the second colour');
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
}
