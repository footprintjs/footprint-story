/**
 * Words that fit: a name set on a face of a thing, on one line or two, as big as the room allows.
 *
 *   wordsToFit('Load Balancer', [170, 70])   → { lines: ['Load', 'Balancer'], size: 26, fits: true }
 *
 * `room` is [wide, high] in pixels. The words are tried at `size` on one line, then on two (broken at the space that
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
 */
import { numbers, own, refuse, shown } from './thing.js';

const MOST_SIZE = 1000;   // the biggest size, in pixels: the sizes tried are counted from it
const BREAK = /[ \t\n\r\f\v]+/;   // where a name may break
const NO_ROOM = /[\p{M}\p{Cf}]/gu;   // a mark on a letter, a character that draws nothing
/** How many letters a word takes room for. */
function letters(word) {
  let n = 0;
  for (const _ of word.replace(NO_ROOM, '')) n += 1;   // by character, not by half of a pair
  return n;
}

export function wordsToFit(text, room, options = undefined) {
  if (typeof text !== 'string') refuse(`wordsToFit takes the words as text — not ${shown(text)}`);
  const [wide, high] = numbers(room, [2], 'the room', '[wide, high] in pixels');
  if (!(wide > 0 && high > 0)) refuse(`the room is [wide, high] in pixels, both above 0 — not ${shown(room)}`);
  if (options !== undefined && options !== null && (typeof options !== 'object' || Array.isArray(options))) refuse(`wordsToFit takes its options as {size, least, letter, line}, or none — not ${shown(options)}`);
  const given = (key, usual) => (options ? own(options, key) ?? usual : usual);
  const size = given('size', 26), least = given('least', 16), letter = given('letter', 0.6), line = given('line', 1.15);
  if (![size, least, letter, line].every((n) => typeof n === 'number' && Number.isFinite(n) && n > 0) || least < 1 || least > size || size > MOST_SIZE) refuse(`a size is in pixels, from 1 to ${MOST_SIZE}, with least no more than size (26 and 16), letter and line above 0 — not ${shown([size, least, letter, line])}`);
  const words = text.split(BREAK).filter(Boolean), counts = words.map(letters);
  if (!words.length) return { lines: [], size, fits: true };
  const whole = counts.reduce((sum, n) => sum + n, 0) + words.length - 1;   // letters on one line, a space between words
  // on two lines: broken at the space that leaves the longer line shortest (of two alike, the earlier). Counted as the break moves along, so a long name costs its length once.
  let two = null, first = -1;
  for (let k = 1; k < words.length; k += 1) {
    first += counts[k - 1] + 1;   // the letters of the first k words and the spaces between them
    const longest = Math.max(first, whole - first - 1);
    if (!two || longest < two.longest) two = { k, longest };
  }
  const lines = (broken) => (broken ? [words.slice(0, two.k).join(' '), words.slice(two.k).join(' ')] : [words.join(' ')]);
  const steps = Math.ceil(size - least);
  for (let k = 0; k <= steps; k += 1) {
    const at = Math.max(least, size - k);
    if (whole * letter * at <= wide && line * at <= high) return { lines: lines(false), size: at, fits: true };
    if (two && two.longest * letter * at <= wide && 2 * line * at <= high) return { lines: lines(true), size: at, fits: true };
  }
  return { lines: lines(Boolean(two)), size: least, fits: false };
}
