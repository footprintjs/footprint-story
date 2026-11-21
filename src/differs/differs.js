/**
 * A part that differs from the real thing says so — the rule a deck and a film share. A picture is believed: a process
 * run 30 times faster, or a part drawn far larger than it is, reads as how the thing is unless the part says otherwise.
 * A part declares how it differs — `time` (how many times faster it runs), `scale` (what is out of scale, in words),
 * `analogy` (what stands in for what) — and says it on the picture (the label `lines`), in the voice (the `phrases` its
 * narration says), or both.
 *
 *   timeWords(30)                               → 'Time shown 30 times faster'
 *   differsLines({ time: 30, scale: 'Dots drawn larger' })  → ['Time shown 30 times faster', 'Dots drawn larger']
 *   timeProblem(1.001)                          → 'real-time'   (it reads as 1 time)
 *   differsProblem(declaration, lines, phrases) → null, or the first rule a declaration breaks, as data
 *
 * WHY here: StoryDeck read a part's declaration from `data-differs-*` attributes and StoryReel from a scene's
 * `differs` field, and each held the same rules and the same default words — a deck and a film must say it alike, so
 * the rules live once. WHY codes and not sentences: each tool names its own fields (`data-differs-shown`,
 * `differs.shown`) and its own place for the rest (the notes, the voice), so the tool words the refusal; the kit says
 * which rule and with what numbers. Reading a writer's text (attributes, JSON) stays the tool's too.
 *
 * Inputs are read by their own stored fields: a getter is never run and an inherited field is never read — each is
 * refused by name, as is a list with a hole, a time that is not a number and a scale or analogy that is not words. The
 * work grows with the words given: each line is scanned once for its figures.
 */
import { normSpeech } from '../spoken/normSpeech.js';

/** The longest statement a label holds: a label is read in a glance, and the rest belongs in the notes or the voice. */
export const DIFFERS_MOST = 70;
/** The longest phrase of the narration a declaration names: the few words that say it, not a passage. */
export const DIFFERS_SAID_MOST = 120;
/** How far a time factor goes, faster or slower: past it no viewer reads the number, so it belongs in words (scale). */
export const DIFFERS_TIME_MOST = 1e9;
/** What an analogy's label starts with: "An analogy: everyday things stand in for the real ones". */
export const DIFFERS_ANALOGY = 'An analogy: ';

function refuse(fix) { throw new Error(`differs: ${fix}`); }
const kind = (v) => (v === null ? 'null' : Array.isArray(v) ? 'a list' : typeof v === 'string' ? JSON.stringify(v.length > 40 ? `${v.slice(0, 40)}…` : v) : typeof v === 'object' ? 'an object' : String(v));
/**
 * A field's own stored value, or undefined when the object has no such field at all. A getter (somebody's code, never
 * run) and a field only its prototype holds are refused by name: read as "not declared", either would drop a
 * statement the writer meant, and a part would then say less than it should.
 */
function stored(o, key, what) {
  const d = Object.getOwnPropertyDescriptor(o, key);
  if (d && !('value' in d)) refuse(`${what} is read as a stored value, and this one is a getter (code, never run) — give the value itself`);
  if (!d && key in o) refuse(`${what} is the object's own field, and this one is inherited — give it on the declaration itself`);
  return d ? d.value : undefined;
}
/** A time factor's words need a number: anything else is refused, never printed as "Time shown 30 times …" of a text. */
function number(time, what) {
  if (typeof time !== 'number') refuse(`${what} is a number (30; 0.04 is 25 times slower) — not ${kind(time)}`);
  return time;
}

/** A factor as its label prints it: whole from 10 up, else to two places, with no trailing zeros. */
const plain = (x) => String(+x.toFixed(x >= 10 ? 0 : 2));

/** A time factor in words: 30 → "Time shown 30 times faster"; 0.04 → "Time shown 25 times slower". */
export const timeWords = (time) => (number(time, 'a time factor') > 1 ? `Time shown ${plain(time)} times faster` : `Time shown ${plain(1 / time)} times slower`);
/** An analogy's label: the words after DIFFERS_ANALOGY. */
export const analogyWords = (text) => {
  if (typeof text !== 'string') refuse(`an analogy is words — not ${kind(text)}`);
  return `${DIFFERS_ANALOGY}${text}`;
};
/**
 * The values a written number may have and still be the declared factor: the factor as written, and as the time words
 * say it (30 and 30; 0.04 as 0.04, 25 and 25). WHY both: a label may write the factor as declared or as it reads.
 */
export const differsFactors = (time) => (number(time, 'a time factor') > 1 ? [time, +plain(time)] : [time, 1 / time, +plain(1 / time)]);

/** Spaces and control characters made one space, the ends trimmed: a declaration's words stay on one line wherever they are printed. */
export const foldDiffers = (text) => (typeof text === 'string' ? text : refuse(`foldDiffers folds words — not ${kind(text)}`)).replace(/[\s\p{Cc}]+/gu, ' ').trim();

/**
 * Why a time factor cannot be declared, or null when it can: 'not-a-factor' (no finite number above 0), 'real-time'
 * (it reads as 1 time — 1.004 prints as 1 — and 1 is real time, so it is left out), or 'past-range' (past
 * DIFFERS_TIME_MOST times faster or slower: no viewer reads the number, so it belongs in words).
 */
export function timeProblem(time) {
  if (!(typeof time === 'number' && Number.isFinite(time) && time > 0)) return 'not-a-factor';
  if (plain(time > 1 ? time : 1 / time) === '1') return 'real-time';
  if (time > DIFFERS_TIME_MOST || time < 1 / DIFFERS_TIME_MOST) return 'past-range';
  return null;
}

/**
 * A declaration's three statements, read by their own stored fields: {time, scale, analogy}, each undefined when not
 * declared — a time a number, a scale and an analogy words; anything else refused, naming the field.
 */
function statements(declaration) {
  if (!declaration || typeof declaration !== 'object' || Array.isArray(declaration)) refuse(`a declaration is {time?, scale?, analogy?} — not ${declaration === null ? 'null' : Array.isArray(declaration) ? 'a list' : typeof declaration}`);
  const time = stored(declaration, 'time', 'the declaration\'s time'), scale = stored(declaration, 'scale', 'the declaration\'s scale'), analogy = stored(declaration, 'analogy', 'the declaration\'s analogy');
  if (time !== undefined) number(time, 'the declaration\'s time');
  for (const [name, v] of [['scale', scale], ['analogy', analogy]]) if (v !== undefined && typeof v !== 'string') refuse(`the declaration's ${name} is words — not ${kind(v)}`);
  return { time, scale, analogy };
}
/** A list of texts, every index its own stored string: a hole and a getter refused by index. */
function texts(list, what) {
  if (!Array.isArray(list)) refuse(`${what} is a list of texts — not ${list === null ? 'null' : typeof list}`);
  return Array.from({ length: list.length }, (_, i) => {
    const d = Object.getOwnPropertyDescriptor(list, i);
    if (d && !('value' in d)) refuse(`${what}[${i}] is read as a stored value, and this one is a getter (code, never run) — give the text itself`);
    const text = d?.value;
    if (typeof text !== 'string') refuse(`${what}[${i}] is a text — not ${d ? kind(text) : 'missing'}`);
    return text;
  });
}

/** How many things a declaration says: one each for time, scale and analogy. */
export function differsStatements(declaration) {
  const { time, scale, analogy } = statements(declaration);
  return (time === undefined ? 0 : 1) + (scale === undefined ? 0 : 1) + (analogy === undefined ? 0 : 1);
}

/** The labels a declaration shows when its writer gives no words of their own: the time words, the scale, the analogy's label, in that order. */
export function differsLines(declaration) {
  const { time, scale, analogy } = statements(declaration);
  return [...(time === undefined ? [] : [timeWords(time)]), ...(scale === undefined ? [] : [scale]), ...(analogy === undefined ? [] : [analogyWords(analogy)])];
}

/** The numbers written in a line, as digits (a digit inside a word, as in "H2O", is none of them). */
const figures = (line) => line.match(/(?<![\p{L}\p{N}])\d+(?:[.,]\d+)*/gu) ?? [];
/** A written number's values, whichever way a language writes it: 1,000 and 1.000 may be a thousand, 1,5 and 1.5 one and a half. */
const readings = (run) => [run.replace(/,/g, ''), run.replace(/\./g, ''), run.replace(/\./g, '').replace(',', '.')].map(Number);

/**
 * The first rule a declaration breaks, with what its words need, or null when none: checked in this order —
 *   { problem: 'said-twice' }                         two phrases are the same words (compared as speech: normSpeech)
 *   { problem: 'unsaid' }                             no label and no phrase: nothing says it
 *   { problem: 'unstated', named, statements, says }  fewer lines and phrases than statements, so one goes unstated
 *                                                     (named: 'time', 'scale', 'an analogy' — those declared)
 *   { problem: 'contradicts', figure }                a number in the line that says the time is not the declared
 *                                                     factor (with time alone every line says it; with anything else
 *                                                     too, the first of two or more lines does; a single line beside
 *                                                     a phrase cannot be told)
 * `lines` are the labels' words (as differsLines gives, or the writer's own), `phrases` the narration's, or null for none.
 */
export function differsProblem(declaration, lines, phrases) {
  const { time, scale, analogy } = statements(declaration), shown = texts(lines, 'lines'), said = phrases === null || phrases === undefined ? null : texts(phrases, 'phrases');
  if (said && new Set(said.map(normSpeech)).size < said.length) return { problem: 'said-twice' };
  if (!shown.length && !said) return { problem: 'unsaid' };
  const named = [...(time === undefined ? [] : ['time']), ...(scale === undefined ? [] : ['scale']), ...(analogy === undefined ? [] : ['an analogy'])];
  const says = new Set(shown).size + (said?.length ?? 0);
  if (says < named.length) return { problem: 'unstated', named, statements: named.length, says };
  if (time === undefined) return null;
  const sayTime = scale === undefined && analogy === undefined ? shown : shown.length >= 2 ? [shown[0]] : [];
  const figure = sayTime.flatMap(figures).find((run) => !readings(run).some((v) => differsFactors(time).includes(v)));
  return figure === undefined ? null : { problem: 'contradicts', figure };
}

/**
 * The default English line a declaration in another language still shows, or null: the time words and the analogy's
 * label are English, so a deck or film in another language gives its own words (a scale is its writer's own words).
 * `lang` is a language tag ('fr', 'en-GB'); none, or English, is null.
 */
export function differsEnglish(declaration, lines, lang) {
  const { time, analogy } = statements(declaration), shown = texts(lines, 'lines');
  if (!lang || /^en\b/i.test(lang)) return null;
  return [...(time === undefined ? [] : [timeWords(time)]), ...(analogy === undefined ? [] : [analogyWords(analogy)])].find((line) => shown.includes(line)) ?? null;
}
