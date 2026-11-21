/**
 * A scene that differs from the real thing says so. A picture is believed: a process run 30 times faster, or a part drawn
 * far larger than it is, reads as how the thing is unless the film says otherwise. A scene declares how it differs —
 * how many times faster its time runs, what is out of scale, what stands in for what — and the film says it, on screen,
 * in the voice, or both:
 *
 *   storyboard.json   {"id": "inside", "narration": "Here it runs thirty times faster.",
 *                      "differs": {"time": 30, "scale": "The dots are drawn far larger than real", "said": "thirty times faster"}}
 *
 * On screen by default: a label per statement, top right, over the scene ("Time shown 30 times faster"; `shown` gives
 * the words in the film's language, or false for the voice alone). `said` names the phrase of the scene's narration
 * that says it (one per statement, for the voice alone), checked as every phrase a recipe names is. Every statement
 * declared has a line or a phrase of its own, so none goes unstated. A verdict (the review's `differs`) reads the part it
 * is given: the labels as the frame draws them, long enough to read, the phrase where it is said whole, so a part cut to
 * lose it is caught. It reads what is declared, and cannot see a speed-up nobody declared.
 *
 *   readDiffers(spec, where)             the declaration, checked: {time?, scale?, shown: [lines], said?: [phrases]}, or null
 *   differsOf(storyboard, {lang})        each scene's, in order, held to its scene (null: none)
 *   ownFigure(line, time, lang)          whether a label's number is the film's own declaration, no claim about the world
 *   asLabel(ctx, mark, draw)             draw a label's words with a mark the review reads (labelMark)
 *   differsReached(film, part)           the declaring scenes whose picture reaches a part
 *   differsMeasure(film, part, options)  what the verdict measures, and its findings
 */
import {normSpeech} from '../../index.js';

/** What a scene's `differs` may hold. */
export const DIFFERS_KEYS = Object.freeze(['time', 'scale', 'analogy', 'shown', 'said']);
/** The longest statement a label holds: a label is read in a glance, and the rest belongs in the voice. */
export const DIFFERS_MOST = 70;
/** The longest phrase `said` names: the few words of the narration that say it, not a passage. */
export const DIFFERS_SAID_MOST = 120;
/** How far a time factor goes, faster or slower: past it no viewer reads the number, so it belongs in words (`scale`). */
export const DIFFERS_TIME_MOST = 1e9;

const plain = x => String(+x.toFixed(x >= 10 ? 0 : 2));
/** A time factor in words: 30 → "Time shown 30 times faster"; 0.04 → "Time shown 25 times slower". */
export const timeWords = time => (time > 1 ? `Time shown ${plain(time)} times faster` : `Time shown ${plain(1 / time)} times slower`);
/** What an analogy's label says: "An analogy: everyday things stand in for the real ones". */
const ANALOGY = 'An analogy: ';
export const analogyWords = text => `${ANALOGY}${text}`;
/** The values a number may have and still be the declared factor: as written, and as the time words say it. */
export const factorsOf = time => (time > 1 ? [time, +plain(time)] : [time, 1 / time, +plain(1 / time)]);

/** Spaces and control characters made one space: a declaration's words stay on one line wherever they are printed. */
const folded = text => text.replace(/[\s\p{Cc}]+/gu, ' ').trim();

const words = (value, name, where) => {
  const text = typeof value === 'string' ? folded(value) : '';
  if (!text) throw new Error(`${where}: differs.${name} is words, not ${JSON.stringify(value)}`);
  if (text.length > DIFFERS_MOST) throw new Error(`${where}: differs.${name} is ${text.length} characters, more than a label can hold in a glance (${DIFFERS_MOST}): shorten it, and say the rest in the voice`);
  return text;
};

/** An analogy's words, checked with the room its label leaves them. */
function readAnalogy(value, where) {
  const text = words(value, 'analogy', where), room = DIFFERS_MOST - ANALOGY.length;
  if (text.length > room) throw new Error(`${where}: differs.analogy is ${text.length} characters, more than its label can hold in a glance (${room}, after "${ANALOGY.trim()}"): shorten it, and say the rest in the voice`);
  return text;
}

/** A time factor checked: a number a label can say, neither real time nor past what a viewer reads. */
export function readTime(time, where) {
  const what = `${where}: differs.time is how many times faster the picture runs than the real thing (30; 0.04 is 25 times slower), not ${JSON.stringify(time)}`;
  if (!(typeof time === 'number' && Number.isFinite(time) && time > 0)) throw new Error(what);
  if (plain(time > 1 ? time : 1 / time) === '1') throw new Error(`${what}: it reads as 1 time, and 1 is real time, so leave it out (a factor that shows is 1.01 or more, or 0.99 or less)`);
  if (time > DIFFERS_TIME_MOST || time < 1 / DIFFERS_TIME_MOST) throw new Error(`${what}: past ${DIFFERS_TIME_MOST} times either way no viewer reads the number, so say it in words in differs.scale`);
}

/** The phrases `said` names, checked and folded: one, or a list; null when it names none. */
export function readSaid(said, where) {
  if (said === undefined) return null;
  const list = Array.isArray(said) ? said : [said];
  const refuse = value => new Error(`${where}: differs.said is the phrase of the scene's narration that says how it differs (or a list, one per statement), not ${JSON.stringify(value)}`);
  if (!list.length) throw refuse(said);
  const phrases = list.map(one => {
    if (typeof one !== 'string' || !normSpeech(one)) throw refuse(one);
    const text = folded(one);
    if (text.length > DIFFERS_SAID_MOST) throw new Error(`${where}: differs.said is ${text.length} characters, more than a phrase (${DIFFERS_SAID_MOST}): name the few words that say it`);
    if (/[{}]/.test(text)) throw new Error(`${where}: differs.said is the words the voice says, not a moment: "${text}" says nothing`);
    return text;
  });
  if (new Set(phrases.map(normSpeech)).size < phrases.length) throw refuse(said);
  return phrases;
}

/** The numbers written in a line, as digits (a digit inside a word, as in "H2O", is none of them). */
const figures = line => line.match(/(?<![\p{L}\p{N}])\d+(?:[.,]\d+)*/gu) ?? [];
/** A written number's values, whichever way a language writes it: 1,000 and 1.000 may be a thousand, 1,5 and 1.5 one and a half. */
const readings = run => [run.replace(/,/g, ''), run.replace(/\./g, ''), run.replace(/\./g, '').replace(',', '.')].map(Number);

/**
 * A number in the line that says the time, when it is not the declared factor: the line contradicts the declaration.
 * With `time` alone every line says it; with anything else too the first of two or more does (a line for each, the time
 * first); a single line beside a phrase cannot be told, and its number stays a claim (ownFigure).
 */
export function contradicting({time, scale, analogy}, lines) {
  if (time === undefined) return null;
  const says = scale === undefined && analogy === undefined ? lines : lines.length >= 2 ? [lines[0]] : [];
  return says.flatMap(figures).find(run => !readings(run).some(v => factorsOf(time).includes(v))) ?? null;
}

/** A scene's declaration checked, each refusal naming the fix: {time?, scale?, shown: [the labels' words], said?: [the phrases]}, or null when it declares none. */
export function readDiffers(spec, where = 'differs') {
  if (spec === undefined || spec === null) return null;
  if (typeof spec !== 'object' || Array.isArray(spec)) throw new Error(`${where}: differs says how the scene differs from the real thing: {time: 30, scale: "the dots are drawn far larger than real", said: "thirty times faster"}, not ${JSON.stringify(spec)}`);
  const other = Object.keys(spec).find(k => !DIFFERS_KEYS.includes(k));
  if (other !== undefined) throw new Error(`${where}: differs takes ${DIFFERS_KEYS.join(', ')}, not ${JSON.stringify(other)}`);
  const {time, scale, analogy, shown, said} = spec;
  if (time !== undefined) readTime(time, where);
  if (time === undefined && scale === undefined && analogy === undefined) throw new Error(`${where}: differs says how the scene differs: give time (how many times faster it runs), scale (what is out of scale, in words), analogy (what stands in for what), or more than one`);
  const out = {...(time === undefined ? {} : {time}), ...(scale === undefined ? {} : {scale: words(scale, 'scale', where)}), ...(analogy === undefined ? {} : {analogy: readAnalogy(analogy, where)})};
  const lines = shown === false ? [] : shown === undefined ? [...(time === undefined ? [] : [timeWords(time)]), ...(scale === undefined ? [] : [out.scale]), ...(analogy === undefined ? [] : [analogyWords(out.analogy)])]
    : (Array.isArray(shown) ? shown : [shown]).map(line => words(line, 'shown', where));
  if (shown !== undefined && shown !== false && !lines.length) throw new Error(`${where}: differs.shown is the words on the picture, or false for the voice alone, not an empty list`);
  const phrases = readSaid(said, where);
  if (!lines.length && !phrases) throw new Error(`${where}: differs.shown is false, so the voice must say it: give said, the phrase of the scene's narration that does`);
  const named = [...(time === undefined ? [] : ['time']), ...(scale === undefined ? [] : ['scale']), ...(analogy === undefined ? [] : ['an analogy'])], statements = statementsOf(out), says = new Set(lines).size + (phrases?.length ?? 0);
  if (says < statements) throw new Error(`${where}: differs declares ${statements === 2 ? `both ${named.join(' and ')}` : `${named.slice(0, -1).join(', ')} and ${named.at(-1)}`} and says only ${says} thing: give each its own line in differs.shown or its own phrase in differs.said (said takes a list), so ${statements === 2 ? 'neither' : 'none'} goes unstated`);
  const wrong = contradicting(out, lines);
  if (wrong !== null) throw new Error(`${where}: differs.shown says ${wrong} where differs.time says ${time}: leave shown out for the default words, or write the number declared (and with anything else too, the time's line first)`);
  return Object.freeze({...out, shown: Object.freeze(lines), ...(phrases ? {said: Object.freeze(phrases)} : {})});
}

/** How many things a declaration says: the time, what is out of scale, what stands in for what. */
export const statementsOf = d => (d.time === undefined ? 0 : 1) + (d.scale === undefined ? 0 : 1) + (d.analogy === undefined ? 0 : 1);

/**
 * Each scene's declaration, in the storyboard's order (null: the scene declares none), held to its scene and its film: a
 * silent scene says nothing, so it names no phrase, and the default time and analogy words are English, so another language gives its own.
 */
export const differsOf = (storyboard, {lang = null} = {}) => storyboard.scenes.map((scene, i) => {
  const where = `storyboard scene ${scene?.id ?? i}`, d = readDiffers(scene?.differs, where);
  if (!d) return null;
  if (d.said && scene.silent !== undefined) throw new Error(`${where}: differs.said names a phrase the voice says, and a silent scene says nothing: put the words on screen (differs.shown), or narrate the scene`);
  const english = lang && !/^en\b/i.test(lang) ? [...(d.time === undefined ? [] : [timeWords(d.time)]), ...(d.analogy === undefined ? [] : [analogyWords(d.analogy)])].find(line => d.shown.includes(line)) : null;
  if (english) throw new Error(`${where}: "${english}" is English and the film is in "${lang}": give the words in its language (differs.shown), or false for the voice alone`);
  return d;
});
