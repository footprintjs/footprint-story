/**
 * Words broken across a width, measured as they are drawn — the greedy rule a film's titles, end cards and summary
 * cards use, and the narrowing that balances it.
 *
 *   wrapWords(['Hello', 'there', 'world'], 120, (text) => ctx.measureText(text).width)   → ['Hello there', 'world']
 *   narrowestWidth(120, 2, (w) => wrapWords(words, w, measure).length)                  → the least width still 2 lines
 *
 * `wrapWords` fills each line with as many words as fit `width` (first fit): a word that does not fit on the line so
 * far starts the next, and a word wider than the width has a line to itself, uncut. A line is measured whole —
 * `measure(text)` gives the width of the line's text as drawn (a canvas's `measureText`), so the space between words
 * and any kerning are the face's own. The lines are texts, joined with one space; an empty word joins as written ('a'
 * then '' is 'a '), and a line that is still empty takes the next word in its place.
 *
 * `narrowestWidth(width, lines, linesAt)` is the narrowest width that still sets the words on `lines` lines, found by
 * halving between 0 and `width` NARROWEST_STEPS times (a line count only falls as the width grows): the words set at it
 * are balanced, no line left with a word alone. `linesAt(w)` counts the lines at width w. It is asked
 * NARROWEST_STEPS times and gives back the upper end, a width at which the lines were `lines` or fewer.
 *
 * WHY here: StoryReel wrote the breaking three times (its title band, the end card, the summary cards) and the
 * balancing twice (titles, captions), and a film and a deck that set a title must break it alike. WHY measured whole lines and not summed
 * word widths: a canvas measures the line it draws, so a sum could put a line a hair past the width that the drawn
 * line is not. WHY greedy and not wordsToFit's best break: these set any number of lines at a size the caller chose;
 * `wordsToFit` (footprint-story/isometric) sets a name on one line or two and finds the size.
 *
 * Bounded: `wrapWords` measures each word once (a line as it grows), `narrowestWidth` asks NARROWEST_STEPS widths.
 * What `measure` or `linesAt` throws is the caller's own and comes out as it is.
 */

/** How many times narrowestWidth halves: 12 halvings find the width to 1/4096 of it — finer than a pixel on a 1600 px frame. */
export const NARROWEST_STEPS = 12;

const own = (o, key) => { const d = Object.getOwnPropertyDescriptor(o, key); return d && 'value' in d ? d.value : undefined; };
function refuse(fix) { throw new Error(`layout: ${fix}`); }
const shown = (v) => (Array.isArray(v) ? 'a list' : v === null ? 'null' : typeof v === 'object' ? 'an object' : typeof v === 'string' ? JSON.stringify(v.slice(0, 40)) : String(v));

/** Words set greedily into lines no wider than `width`, each line measured whole (see the module's header). */
export function wrapWords(words, width, measure) {
  if (!Array.isArray(words)) refuse(`wrapWords takes the words as a list of texts — not ${shown(words)}`);
  if (typeof width !== 'number') refuse(`wrapWords takes the width as a number — not ${shown(width)}`);
  if (typeof measure !== 'function') refuse(`wrapWords measures a line with a function (text) => width — not ${shown(measure)}`);
  const lines = [''];
  for (let i = 0; i < words.length; i += 1) {
    const word = Object.hasOwn(words, i) ? own(words, i) : undefined;
    if (typeof word !== 'string') refuse(`word ${i + 1} is a text — not ${word === undefined ? 'missing' : shown(word)}`);
    const last = lines[lines.length - 1], next = last ? `${last} ${word}` : word;
    // a line that holds something and would grow past the width ends here; the word starts the next
    if (last && measure(next) > width) lines.push(word); else lines[lines.length - 1] = next;
  }
  return lines;
}

/** The narrowest width that keeps the words on `lines` lines (see the module's header). */
export function narrowestWidth(width, lines, linesAt) {
  if (typeof width !== 'number' || typeof lines !== 'number') refuse(`narrowestWidth takes the width and the line count as numbers — not ${shown(width)} and ${shown(lines)}`);
  if (typeof linesAt !== 'function') refuse(`narrowestWidth counts lines with a function (width) => lines — not ${shown(linesAt)}`);
  let lo = 0, hi = width;
  for (let i = 0; i < NARROWEST_STEPS; i += 1) {
    const mid = (lo + hi) / 2;
    if (linesAt(mid) > lines) lo = mid; else hi = mid;
  }
  return hi;
}
