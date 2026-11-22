/**
 * The palette "duotone": a map printed in two inks on paper — every line in the ink, every fill a tint of the accent on
 * the paper. A style choice (palette column, styleChoices.js), named by the look "duotone" (looks.js).
 *
 *   ink     every stroke's colour, its alpha kept (a floor's tile lines stay the ink at 16%)
 *   accent  every fill: the paper mixed toward the accent by how dark the fill it replaces is — its darkness, 1 less
 *           its relative luminance (WCAG) — at most DUOTONE.most of the way (mixColour, the one mix), so the shading's
 *           order survives: a lit top stays lighter than a right face in shadow, and a lighter piece lighter than a
 *           darker one. A fill with no colour (the page's base: both tools build so) is read as its recipe over
 *           DUOTONE.neutral, so a map with no colours given is a duotone too, every piece alike
 *   paper   what a tint is mixed from: a fill as light as white is the paper
 *
 * Every fill comes out with its colour (`{mix: [colour, 1], colour}`: whatever the base, this colour), so a painter
 * that colours by role (StoryDeck's CSS) draws the duotone, as a paper fill carries its colour.
 *
 * WHY a check on the inks: a block's name stands on its face (words.js), so a name in the ink must read on every tint
 * the palette can give: at least 4.5 : 1 (WCAG's ratio for small text; StoryReel's review measures words by it,
 * contrast.mjs · CONTRAST.normal), from the paper to the deepest tint. A pair of inks that cannot is refused when the
 * style is made, naming the ratio and the fix. The usual inks stand 7.0 : 1 at worst, and the tools' usual ink
 * (#14181f) 9.4 : 1.
 */
import { mixColour, readColour } from './paint.js';
import { refuse } from './thing.js';

/**
 * The duotone's numbers. Ours:
 *   ink #22304a       a deep navy: dark enough that a name in it reads on every tint (7.0 : 1 at the deepest)
 *   accent #e07b39    a warm orange: far from the ink in hue, so the two inks read as two
 *   paper #ffffff     the page's white, as the paper shading's
 *   most 0.6          the deepest tint, 60% of the way to the accent: the accent whole stands 4.4 : 1 under the ink,
 *                     under the 4.5 a name needs; at 0.6 it is 7.0
 *   neutral #d9d9d9   the base a fill with no colour is read over: a light grey, about as light as the tools' usual
 *                     bases, so the faces' tints fall where a coloured map's do
 *   text 4.5          WCAG's least ratio for small text (a name on a face)
 */
export const DUOTONE = Object.freeze({ ink: '#22304a', accent: '#e07b39', paper: '#ffffff', most: 0.6, neutral: '#d9d9d9', text: 4.5 });
/** How finely the check walks the tints, paper to deepest: a step of 1% of the way. */
const STEPS = 100;

const linear = (c) => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
/** A colour's relative luminance (WCAG 2): 0 black, 1 white. */
export function luminance(hex) {
  const h = readColour(hex, 'the colour'), [r, g, b] = [1, 3, 5].map((i) => linear(parseInt(h.slice(i, i + 2), 16)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
/** The contrast ratio of two colours (WCAG 2): 1 (the same) to 21 (black on white). */
export function contrastRatio(a, b) {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** The duotone's three inks, its options read (each a colour as this package reads one). */
function inksOf(options) {
  const one = (key) => readColour(options[key] ?? DUOTONE[key], `the style's palette "duotone"'s ${key}`);
  return { ink: one('ink'), accent: one('accent'), paper: one('paper') };
}

/** The tint the palette gives a fill this dark (0 to 1): the paper mixed toward the accent, at most DUOTONE.most. */
const tintOf = ({ paper, accent }, darkness) => mixColour(paper, accent, Math.min(DUOTONE.most, Math.max(0, darkness)));

/** Every tint the palette can give, from the paper to the deepest, against the ink: refused under 4.5 : 1, naming the worst. */
export function checkDuotone(options) {
  const inks = inksOf(options);
  let worst = null;
  for (let k = 0; k <= STEPS; k += 1) {
    const tint = tintOf(inks, (DUOTONE.most * k) / STEPS), ratio = contrastRatio(inks.ink, tint);
    if (!worst || ratio < worst.ratio) worst = { tint, ratio };
  }
  if (worst.ratio < DUOTONE.text) refuse(`the style's palette "duotone": a name in its ink ${inks.ink} stands ${worst.ratio.toFixed(2)} : 1 on its tint ${worst.tint}, and a name on a face needs ${DUOTONE.text} : 1 — give a darker ink, a lighter accent or a lighter paper`);
}

/** The fill's colour as it would be drawn: its own, or its recipe over the neutral base when the page decides it. */
const seenAs = (fill) => fill.colour ?? (fill.mix ? mixColour(DUOTONE.neutral, fill.mix[0], fill.mix[1]) : DUOTONE.neutral);

export function duotone(items, { options }) {
  const inks = inksOf(options);
  return items.map((it) => {
    const fill = it.fill === null ? null : (() => { const colour = tintOf(inks, 1 - luminance(seenAs(it.fill))); return { mix: [colour, 1], colour }; })();
    return { ...it, fill, stroke: it.stroke === null ? null : { ...it.stroke, colour: inks.ink } };
  });
}
