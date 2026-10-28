/**
 * Pace: how long a picture may sit still before it reads as a slide held up, by the kind of film. A lesson for a child
 * pauses on purpose; a launch film that parks between hits has lost its beat. One table, so a film's check and a
 * deck's video check ask the same question with the same numbers.
 *
 *   hold   a still stretch is dead when it lasts MORE than this many seconds
 *   most   the film fails when MORE than this share of its running time is dead (0: any dead stretch fails)
 *   still  the film fails, too, when MORE than this share of its running time is still at all, however short each stretch
 *   spare  how many shots at the very end are not counted (an end card holds still by design)
 *
 * Where each number comes from (only measured or published numbers go in this table):
 *   lesson  StoryReel's slideshow check since 0.13: 3 s, a half, 0.85, measured on its example and course films
 *           (src/slideshow.mjs in footprint-storyreel says how).
 *   promo   a 52-second launch film made as code, as its makers published it (Scenario's "Kinetic Film", 2026-10-28): its
 *           check asks for 40 % of the frames still or less; the film holds nothing longer than 0.6 s before its end
 *           card, and "a film that parks between hits fails".
 */

export const PACES = Object.freeze({
  lesson: Object.freeze({ hold: 3, most: .5, still: .85, spare: 0 }),
  promo: Object.freeze({ hold: .6, most: 0, still: .4, spare: 1 }),
});
export const PACE_NAMES = Object.freeze(Object.keys(PACES));
const KEYS = ['hold', 'most', 'still', 'spare'];

const shown = (v) => (typeof v === 'number' ? String(v) : JSON.stringify(v));

/** A pace as asked for: a name from the table, or {hold, most, still, spare?} of your own — checked, frozen. */
export function readPace(pace = 'lesson', where = 'pace') {
  if (typeof pace === 'string') {
    if (Object.hasOwn(PACES, pace)) return PACES[pace];
    throw new Error(`${where}: no pace called "${pace}"; the paces are ${PACE_NAMES.join(', ')} (or {hold, most, still, spare?} of your own)`);
  }
  if (!pace || typeof pace !== 'object' || Array.isArray(pace)) throw new Error(`${where}: a pace is a name (${PACE_NAMES.join(', ')}) or {hold, most, still, spare?}`);
  for (const key of Object.keys(pace)) if (!KEYS.includes(key)) throw new Error(`${where}: a pace has no key ${key} (a pace has ${KEYS.join(', ')})`);
  const { hold, most, still, spare = 0 } = pace;
  if (!(Number.isFinite(hold) && hold > 0)) throw new Error(`${where}: hold is the seconds a still stretch may last, above 0, not ${shown(hold)}`);
  for (const [k, v] of [['most', most], ['still', still]]) if (!(Number.isFinite(v) && v >= 0 && v < 1)) throw new Error(`${where}: ${k} is a share of the running time, 0 or more and below 1, not ${shown(v)}`);
  if (!(Number.isInteger(spare) && spare >= 0)) throw new Error(`${where}: spare is how many shots at the end are not counted, a whole number, 0 or more, not ${shown(spare)}`);
  return Object.freeze({ hold, most, still, spare });
}
