/**
 * Words that fit: a name set on a face of a thing, on one line or two, as big as the room allows.
 *
 *   wordsToFit('Load Balancer', [170, 70])   → { lines: ['Load', 'Balancer'], size: 26, fits: true }
 *
 * `room` is [wide, high] in pixels. The words are tried at `size` on one line, then on two (broken at the space that
 * leaves the two lines most alike), then a pixel smaller at a time down to `least`. `fits` is false when they do not
 * fit even there: the caller draws them at `least` on two lines and says so (a name too long for its block is the
 * writer's to shorten: the tool must not hide it).
 *
 * WHY here: a deck and a film draw the same block with the same name, and must break and size it alike. WHY counted
 * in letters and not measured: nothing here draws, and a build has no browser. `letter` is how wide a letter is for
 * each pixel of its size (0.6: a bold sans face, a little generous), `line` how tall a line is (1.15).
 */
import { numbers, own, refuse, shown } from './thing.js';

const MOST_WORDS = 400;   // the most characters a name is read to

export function wordsToFit(text, room, options = undefined) {
  if (typeof text !== 'string') refuse(`wordsToFit takes the words as text — not ${shown(text)}`);
  const [wide, high] = numbers(room, [2], 'the room', '[wide, high] in pixels');
  if (!(wide > 0 && high > 0)) refuse(`the room is [wide, high] in pixels, both above 0 — not ${shown(room)}`);
  if (options !== undefined && options !== null && (typeof options !== 'object' || Array.isArray(options))) refuse(`wordsToFit takes its options as {size, least, letter, line}, or none — not ${shown(options)}`);
  const given = (key, usual) => (options ? own(options, key) ?? usual : usual);
  const size = given('size', 26), least = given('least', 16), letter = given('letter', 0.6), line = given('line', 1.15);
  if (![size, least, letter, line].every((n) => typeof n === 'number' && Number.isFinite(n) && n > 0) || least > size || size > 1000) refuse(`a size is in pixels with least no more than size (26 and 16), letter and line above 0 — not ${shown([size, least, letter, line])}`);
  const words = text.slice(0, MOST_WORDS).trim().split(/\s+/).filter(Boolean), whole = words.join(' ');
  if (!words.length) return { lines: [], size, fits: true };
  // on two lines: broken at the space that leaves the longer line shortest (of two alike, the earlier)
  let two = null;
  for (let k = 1; k < words.length; k += 1) {
    const lines = [words.slice(0, k).join(' '), words.slice(k).join(' ')], longest = Math.max(lines[0].length, lines[1].length);
    if (!two || longest < two.longest) two = { lines, longest };
  }
  const steps = Math.ceil(size - least);
  for (let k = 0; k <= steps; k += 1) {
    const at = Math.max(least, size - k);
    if (whole.length * letter * at <= wide && line * at <= high) return { lines: [whole], size: at, fits: true };
    if (two && two.longest * letter * at <= wide && 2 * line * at <= high) return { lines: two.lines, size: at, fits: true };
  }
  return { lines: two ? two.lines : [whole], size: least, fits: false };
}
