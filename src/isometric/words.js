/**
 * Words that fit: a name set on a face of a thing, on one line or two, as big as the room allows.
 *
 *   wordsToFit('Load Balancer', [170, 70])   → { lines: ['Load', 'Balancer'], size: 26, fits: true }
 *
 * `room` is [wide, high] in pixels — or, for a face that narrows away from its middle (the top of a block:
 * `(high) => grid.room(thing, high)`), a function `(high) => wide`: how wide a box that tall may be. What it gives is
 * read as a width: no finite number above 0 is no room, and more than a million is a million. What it throws is the
 * caller's own, and comes out as it is. It is asked 0 for one line
 * and one line's height for two: each line is measured across its middle, so a letter's top may pass the face's edge
 * where a line's middle does not. The words are tried at `size` on one line, then on two (broken at the space that
 * leaves the two lines most alike), then a pixel smaller at a time down to `least`. `fits` is false when they do not
 * fit even there: the caller draws them at `least` on two lines and says so (a name too long for its block is the
 * writer's to shorten: the tool must not hide it). The whole name is always given back, however long: nothing is cut.
 * No words at all (an empty name, or only spaces) is `{ lines: [], fits: true }`: there is nothing to draw.
 *
 * WHY here: a deck and a film draw the same block with the same name, and must break and size it alike. WHY counted
 * in letters and not measured: nothing here draws, and a build has no browser. `letter` is how wide a letter is for
 * each pixel of its size (0.6: a bold sans face, a little generous), `line` how tall a line is (1.15). A letter is a
 * character that takes room: a mark that sits on a letter (an accent written apart) and a character that draws
 * nothing (a zero-width space, a joiner) count for none. A name breaks at a space, a tab or a line end only: a
 * no-break space is the writer's word that it may not break there. The time taken grows with the name's length.
 *
 * `measure` — a tool that can measure a face (StoryReel's canvas) gives each word's width instead of the count: a
 * function `(word) => width` or a table `{ [word]: width }` (its own stored fields), the width of the word drawn at 1 px
 * of size, and the space between words as the word ' '. The rule is the same — one line, else the break that leaves
 * the longer line shortest (of two alike, the earlier), else a pixel smaller — with each line as wide as its words and
 * spaces summed, times the size. It replaces `letter` (giving both is refused); each distinct word is measured once,
 * so the time still grows with the name's length. A width that is no finite number from 0 to 1,000,000 is refused,
 * naming the word; what the function throws comes out as it is. WHY summed and not a whole line measured: the break
 * is chosen among every place a name could break, and summing each word once keeps that linear in the name's length.
 *
 * `break` — the rule for two lines, one of BREAKS: `'even'` (the usual: the break that leaves the longer line shortest,
 * as above) or `'fill'` (the first line as full as it goes at each size, the rest beneath it — a top-heavy name: 'Load
 * Balancer Service' as 'Load Balancer' over 'Service'). One line is tried first either way, and the sizes are tried
 * as above. Under `'fill'` a first word wider than the line has the line to itself, and the second line is never empty.
 * WHY named rules: a build's record can name the one it used, and each is tested here. footprint-story/layout's
 * `wrapWords` takes the same two names (BREAK_RULES there; one list per door, pinned equal by a test).
 */
import { FAR, numbers, own, refuse, shown, stored } from './thing.js';

/** The break rules for two lines, by name: footprint-story/layout's BREAK_RULES (a door may not import another's file). */
const BREAKS = ['fill', 'even'];
const MOST_SIZE = 1000;   // the biggest size, in pixels: the sizes tried are counted from it
const BREAK = /[ \t\n\r\f\v]+/;   // where a name may break
const NO_ROOM = /[\p{M}\p{Cf}]/gu;   // a mark on a letter, a character that draws nothing
/** How many letters a word takes room for. */
function letters(word) {
  let n = 0;
  for (const _ of word.replace(NO_ROOM, '')) n += 1;   // by character, not by half of a pair
  return n;
}

/**
 * A word's width from `measure` — a function, or a table read by its own stored fields — checked: a finite number from 0
 * to FAR, each distinct word asked once.
 */
function measured(measure) {
  const table = typeof measure === 'function' ? null : measure;
  if (!table && typeof measure !== 'function') refuse(`wordsToFit's measure is a function (word) => width or a table {word: width} — not ${shown(measure)}`);
  if (table && (typeof table !== 'object' || Array.isArray(table))) refuse(`wordsToFit's measure is a function (word) => width or a table {word: width} — not ${shown(measure)}`);
  const seen = new Map();
  return (word) => {
    if (seen.has(word)) return seen.get(word);
    const n = table ? own(table, word) : measure(word);
    if (!(typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= FAR)) refuse(`wordsToFit's measure gives each word's width at 1 px of size, a number from 0 to ${FAR} — not ${shown(n)} for ${shown(word)}`);
    seen.set(word, n);
    return n;
  };
}

export function wordsToFit(text, room, options = undefined) {
  if (typeof text !== 'string') refuse(`wordsToFit takes the words as text — not ${shown(text)}`);
  // the room: a box, or what a face that narrows gives for words standing so tall (a number, read as 0 when it is none)
  const narrows = typeof room === 'function', [wide, high] = narrows ? [0, 0] : numbers(room, [2], 'the room', '[wide, high] in pixels, or a function (high) => wide');
  if (!narrows && !(wide > 0 && high > 0)) refuse(`the room is [wide, high] in pixels, both above 0 — not ${shown(room)}`);
  const wideFor = (tall) => { const n = room(tall); return typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.min(n, FAR) : 0; };
  if (options !== undefined && options !== null && (typeof options !== 'object' || Array.isArray(options))) refuse(`wordsToFit takes its options as {size, least, letter, line, measure, break}, or none — not ${shown(options)}`);
  const given = (key, usual) => (options ? own(options, key) ?? usual : usual);
  const measure = options ? stored(options, 'measure', "wordsToFit's measure") : undefined;
  if (measure !== undefined && options && own(options, 'letter') !== undefined) refuse('wordsToFit counts letters (letter) or measures words (measure) — give one, not both');
  const rule = (options ? stored(options, 'break', "wordsToFit's break") : undefined) ?? 'even';
  if (!BREAKS.includes(rule)) refuse(`wordsToFit breaks two lines by 'even' or 'fill' — not ${shown(rule)}`);
  const size = given('size', 26), least = given('least', 16), letter = given('letter', 0.6), line = given('line', 1.15);
  if (![size, least, letter, line].every((n) => typeof n === 'number' && Number.isFinite(n) && n > 0) || least < 1 || least > size || size > MOST_SIZE) refuse(`a size is in pixels, from 1 to ${MOST_SIZE}, with least no more than size (26 and 16), letter and line above 0 — not ${shown([size, least, letter, line])}`);
  const widthOf = measure === undefined ? null : measured(measure);
  const words = text.split(BREAK).filter(Boolean), counts = widthOf ? words.map(widthOf) : words.map(letters), space = widthOf && words.length > 1 ? widthOf(' ') : 1;
  if (!words.length) return { lines: [], size, fits: true };
  // on one line: the letters (or the widths), a space between words
  const whole = widthOf ? counts.reduce((sum, n) => sum + n, 0) + space * (words.length - 1) : counts.reduce((sum, n) => sum + n, 0) + words.length - 1;
  // on two lines: broken at the space that leaves the longer line shortest (of two alike, the earlier). Counted as the break moves along, so a long name costs its length once.
  let two = null, first = widthOf ? -space : -1;
  for (let k = 1; k < words.length; k += 1) {
    first += counts[k - 1] + space;   // the letters (widths) of the first k words and the spaces between them
    const longest = Math.max(first, whole - first - space);
    if (!two || longest < two.longest) two = { k, longest };
  }
  const per = widthOf ? 1 : letter;   // a measured width is already the face's own
  const lines = (k) => (k ? [words.slice(0, k).join(' '), words.slice(k).join(' ')] : [words.join(' ')]);
  // fill: the first k words and the spaces between them, for each k — so the fullest first line at a size is a search, not a walk
  const prefix = rule === 'fill' && two ? firsts(counts, space) : null;
  // the most words, from 1 to all but one, whose line fits `limit` at size `at` (a first word too wide still takes the line)
  const filled = (limit, at) => { let lo = 1, hi = words.length - 1; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (prefix[mid] * per * at <= limit) lo = mid; else hi = mid - 1; } return lo; };
  const steps = Math.ceil(size - least);
  let broken = two;
  for (let k = 0; k <= steps; k += 1) {
    const at = Math.max(least, size - k);
    // n lines at this size: in a box, as wide and as tall as the box; on a face that narrows, as wide as it is where the outer lines' middles are
    // (no room for that many lines is a limit below any width: -1)
    const limitFor = (n) => (narrows ? wideFor((n - 1) * line * at) : n * line * at <= high ? wide : -1);
    if (whole * per * at <= limitFor(1)) return { lines: lines(0), size: at, fits: true };
    if (!broken) continue;   // one word: only a smaller size can help
    const limit = limitFor(2);   // asked once a size, as the room is the caller's
    if (prefix) { const k2 = filled(limit, at); broken = { k: k2, longest: Math.max(prefix[k2], whole - prefix[k2] - space) }; }
    if (broken.longest * per * at <= limit) return { lines: lines(broken.k), size: at, fits: true };
  }
  return { lines: lines(broken ? broken.k : 0), size: least, fits: false };
}

/** The width (or letters) of the first k words and the spaces between them, for k from 0: entry 0 is -space, as nothing is. */
function firsts(counts, space) {
  const out = [-space];
  for (let k = 1; k <= counts.length; k += 1) out.push(out[k - 1] + counts[k - 1] + space);
  return out;
}
