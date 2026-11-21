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
 * then '' is 'a '), and a line that is still empty takes the next word in its place. No words at all is one empty
 * line, [''] (the caller draws nothing; StoryReel's titles always had it so).
 *
 * The break rule is a choice, `options.break`, one of BREAK_RULES: `'fill'` (the usual, the rule above: each line as
 * full as it goes) or `'even'` (as many lines as `'fill'` sets, as alike as they can be: set again at the narrowest width
 * that keeps that many lines, so no line ends with a word alone — StoryReel's title band). One line is left as it is.
 * WHY named rules and not a function the caller hands in: a rule the package owns is tested here and can be NAMED in a
 * build's record ("broken by even"); a function could be neither. `wordsToFit` (footprint-story/isometric) takes the
 * same two names, with `'even'` its usual.
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
 * Cost: `wrapWords` asks `measure` once per word (but the first on a line), with the line so far and that word, so the
 * work grows with the words times the length of a line (a canvas measures the whole text it is given);
 * `narrowestWidth` asks `linesAt` NARROWEST_STEPS times, each a whole wrap, and `'even'` is NARROWEST_STEPS + 2 wraps. What `measure` gives must be a width, a
 * finite number from 0 (else refused, naming the line); what `measure` or `linesAt` throws is the caller's own and
 * comes out as it is.
 */

/** How many times narrowestWidth halves: 12 halvings find the width to 1/4096 of it — finer than a pixel on a 1600 px frame. */
export const NARROWEST_STEPS = 12;

/** The break rules, by name: `'fill'` each line as full as it goes, `'even'` as many lines as fill sets, as alike as they can be. */
export const BREAK_RULES = Object.freeze(['fill', 'even']);

function refuse(fix) { throw new Error(`layout: ${fix}`); }
const shown = (v) => (Array.isArray(v) ? 'a list' : v === null ? 'null' : typeof v === 'object' ? 'an object' : typeof v === 'string' ? JSON.stringify(v.slice(0, 40)) : String(v));

/** What `measure` gives for a line, checked: a width is a finite number from 0. */
function widthOf(measure, line) {
  const n = measure(line);
  if (!(typeof n === 'number' && Number.isFinite(n) && n >= 0)) refuse(`measure gives a line's width, a finite number from 0 — not ${shown(n)} for ${shown(line)}`);
  return n;
}

/** The break rule asked for: `options.break`, read as its own stored field, `'fill'` when none is given. */
function ruleOf(options) {
  if (options === undefined || options === null) return 'fill';
  if (typeof options !== 'object' || Array.isArray(options)) refuse(`wrapWords takes its options as {break}, or none — not ${shown(options)}`);
  const d = Object.getOwnPropertyDescriptor(options, 'break');
  if (d && !('value' in d)) refuse('wrapWords\'s break is read as a stored value, and this one is a getter (code, never run) — give the name itself');
  const rule = d?.value ?? 'fill';
  if (!BREAK_RULES.includes(rule)) refuse(`wrapWords breaks by ${BREAK_RULES.map((r) => `'${r}'`).join(' or ')} — not ${shown(rule)}`);
  return rule;
}

/** Words set into lines no wider than `width` by a break rule, each line measured whole (see the module's header). */
export function wrapWords(words, width, measure, options = undefined) {
  if (!Array.isArray(words)) refuse(`wrapWords takes the words as a list of texts — not ${shown(words)}`);
  if (typeof width !== 'number' || Number.isNaN(width)) refuse(`wrapWords takes the width as a number — not ${shown(width)}`);
  if (typeof measure !== 'function') refuse(`wrapWords measures a line with a function (text) => width — not ${shown(measure)}`);
  const rule = ruleOf(options), lines = fill(words, width, measure);
  if (rule === 'fill' || lines.length < 2) return lines;
  // even: set again at the narrowest width that keeps this many lines (the words were read once already, so each is a text)
  return fill(words, narrowestWidth(width, lines.length, (at) => fill(words, at, measure).length), measure);
}

/** The fill rule: each line takes as many words as fit `width` (first fit); a word that does not starts the next. */
function fill(words, width, measure) {
  const lines = [''];
  for (let i = 0; i < words.length; i += 1) {
    const d = Object.getOwnPropertyDescriptor(words, i);
    if (d && !('value' in d)) refuse(`word ${i + 1} is read as a stored value, and this one is a getter (code, never run) — give the text itself`);
    const word = d?.value;
    if (typeof word !== 'string') refuse(`word ${i + 1} is a text — not ${d ? shown(word) : 'missing'}`);
    const last = lines[lines.length - 1], next = last ? `${last} ${word}` : word;
    // a line that holds something and would grow past the width ends here; the word starts the next
    if (last && widthOf(measure, next) > width) lines.push(word); else lines[lines.length - 1] = next;
  }
  return lines;
}

/** The narrowest width that keeps the words on `lines` lines (see the module's header). */
export function narrowestWidth(width, lines, linesAt) {
  if (typeof width !== 'number' || typeof lines !== 'number' || !Number.isFinite(width) || !Number.isFinite(lines)) refuse(`narrowestWidth takes the width and the line count as numbers — not ${shown(width)} and ${shown(lines)}`);
  if (typeof linesAt !== 'function') refuse(`narrowestWidth counts lines with a function (width) => lines — not ${shown(linesAt)}`);
  let lo = 0, hi = width;
  for (let i = 0; i < NARROWEST_STEPS; i += 1) {
    const mid = (lo + hi) / 2;
    if (linesAt(mid) > lines) lo = mid; else hi = mid;
  }
  return hi;
}
