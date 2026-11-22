/**
 * The named looks: a look is a style row written once under a name — data only, no code. A tool names one as it names a
 * choice, by its name in the row: `isoStyle({ look: 'line-art' })`, or a map's `style: { look: 'outlined' }`. A column
 * written beside the look replaces the look's entry for that column, whole (`{ look: 'line-art', texture: 'human:hatch' }`).
 *
 *   outlined   the sticker look: today's tones, a bold even contour round each piece and lighter inner lines
 *   line-art   ink lines on paper: every face the paper's white, a contour round each piece, lighter folds; the
 *              floor's tile lines (1.5 px at 16%) the faintest — silhouette 3 px > folds 1.25 px > detail
 *
 * WHY a name for a row and not a choice of its own: a look spans columns (line art is a shading and a line), and every
 * column's choice stays one strategy behind one interface — the look adds no code, so it can never paint what its row
 * would not. A look named and its row written out are the same style: the same row, the same options, the same seeds,
 * the same paint list (a test). The record keeps the name beside the row (`style.look`), so "which look drew this map"
 * is answered from it, and the row says which choices that was.
 *
 * The line art's numbers are ours (chosen by eye on its still, src/isometric/look-line-art.svg): a contour of 3 px, a
 * little over today's 2.5 px ink, because a line drawing has no tones to show the piece's edge — the line alone does;
 * folds of 1.25 px, under half of it, so the faces read as one solid and not as three panes. The outlined look takes
 * the contour line's own numbers (styleChoices.js · CONTOUR, 5 px and 1.5 px).
 */
export const ISO_LOOKS = Object.freeze({
  outlined: Object.freeze({ line: 'contour' }),
  'line-art': Object.freeze({ shading: 'paper', line: Object.freeze({ name: 'contour', width: 3, inner: 1.25 }) }),
});
