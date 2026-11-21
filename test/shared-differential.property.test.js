// The differential properties of the rules that moved here from the tools in 0.18.0: a part that differs from the
// real thing (differs/differs.js, from StoryDeck 0.28.0's deck/differs.js and StoryReel 0.33.0's src/differs.mjs), the
// zoom that frames a box (layout/frame.js, from StoryDeck 0.28.0's focus.js) and words broken across a width
// (layout/wrap.js, from StoryReel 0.33.0's layout.mjs, endcard.mjs and kits/paper/paper.mjs). The CONTROLS are that
// code, copied and never edited but for imports and `export` (test/control/README.md). For every input the tools could
// hand over, the kit's answer is the control's: the same numbers to the last bit, the same lines, the same rule broken.
// FC_RUNS=200000 npm test runs a deep sweep.
import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import * as deck0 from './control/storydeck-0.28.0-differs.js';
import * as reel0 from './control/storyreel-0.33.0-differs.mjs';
import * as focus0 from './control/storydeck-0.28.0-focus.js';
import * as wrap0 from './control/storyreel-0.33.0-wrap.mjs';
import { timeWords, analogyWords, differsFactors, foldDiffers, timeProblem, differsStatements, differsLines, differsProblem, differsEnglish, normSpeech, DIFFERS_MOST, DIFFERS_SAID_MOST, DIFFERS_TIME_MOST } from '../index.js';
import { frameZoom, wrapWords, narrowestWidth } from '../layout.js';
import { wordsToFit } from '../isometric.js';

const RUNS = Number(process.env.FC_RUNS) || 2000;
/** What a call gives, or the words it refuses with. */
const outcome = (f) => { try { return { value: f() }; } catch (e) { return { error: e.message }; } };

// ── differs ─────────────────────────────────────────────────────────────────────────────────────────────────

// factors a writer gives: ordinary ones, the edges of real time and of the range, and what is no factor at all
const factor = fc.oneof(
  fc.double({ min: 1e-3, max: 1e3, noNaN: true }), fc.integer({ min: 2, max: 400 }),
  fc.constantFrom(1, 1.004, 1.005, 0.996, 0.995, 0.99, 1.01, 1e9, 1e9 + 1, 1e-9, 0.99e-9, 30, 0.04, 2.5, 12.5, 0.125),
  fc.double({ noNaN: false }), fc.constantFrom(0, -0, -1, NaN, Infinity, -Infinity, 1e300, 5e-324));
/** The rule a control's time refusal states, as the kit's code. */
const timeCode = (message) => (/reads as 1 time/.test(message) ? 'real-time' : /no viewer reads the number/.test(message) ? 'past-range' : 'not-a-factor');

test('differs: timeProblem says what StoryDeck 0.28.0 and StoryReel 0.33.0 refused a time for, and passes what they passed', () => {
  fc.assert(fc.property(factor, (t) => {
    const deck = outcome(() => deck0.readTime(String(t), 'p')), reel = outcome(() => reel0.readTime(t, 'p'));
    assert.equal(timeProblem(t), 'error' in reel ? timeCode(reel.error) : null);
    assert.equal(timeProblem(t), 'error' in deck ? timeCode(deck.error) : null);   // the deck reads the number from its attribute's text
  }), { numRuns: RUNS });
});

test('differs: the time words, the analogy\'s label and the factors a label may write are the tools\' own, character for character', () => {
  fc.assert(fc.property(factor.filter((t) => timeProblem(t) === null), (t) => {
    assert.equal(timeWords(t), deck0.timeWords(t)); assert.equal(timeWords(t), reel0.timeWords(t));
    assert.deepEqual(differsFactors(t), deck0.factorsOf(t)); assert.deepEqual(differsFactors(t), reel0.factorsOf(t));
  }), { numRuns: RUNS });
  fc.assert(fc.property(fc.string({ maxLength: 60 }), (s) => { assert.equal(analogyWords(s), deck0.analogyWords(s)); assert.equal(analogyWords(s), reel0.analogyWords(s)); }), { numRuns: RUNS });
  for (const [k, v] of Object.entries({ DIFFERS_MOST, DIFFERS_SAID_MOST, DIFFERS_TIME_MOST })) { assert.equal(v, deck0[k]); assert.equal(v, reel0[k]); }
});

// words a declaration may say: some with figures (as a time's line has), some alike as speech, all short enough to read
const word = fc.constantFrom('dots', 'Thirty', 'thirty', 'times', 'faster', 'slower', 'larger', 'real', 'H2O', 'a', 'the', '30', '3', '25', '1,000', '1.000', '1,5', '1.5', '0.04', '2.5', '12.5', '100%', 'x30', '30x');
const phrase = fc.array(word, { minLength: 1, maxLength: 6 }).map((w) => w.join(' '));
const spoken = fc.oneof(phrase, phrase.map((p) => `${p.toUpperCase()}!`), phrase.map((p) => p.replace(/ /g, '  ')));
const spec = fc.record({
  time: fc.option(factor.filter((t) => timeProblem(t) !== 'not-a-factor' && Number(String(t)) === t), { nil: undefined }),
  scale: fc.option(phrase, { nil: undefined }),
  analogy: fc.option(phrase.filter((p) => p.length <= 50), { nil: undefined }),
  shown: fc.option(fc.oneof(fc.constant(false), phrase, fc.array(phrase, { minLength: 1, maxLength: 4 }), factor.filter((t) => timeProblem(t) === null).map((t) => [timeWords(t)])), { nil: undefined }),
  said: fc.option(fc.oneof(spoken, fc.array(spoken, { minLength: 1, maxLength: 4 })), { nil: undefined }),
}, { requiredKeys: [] }).map((s) => Object.fromEntries(Object.entries(s).filter(([, v]) => v !== undefined)));

/**
 * A scene's declaration read with the kit's rules, in StoryReel's order — the time, something declared, the lines, the
 * rest (differsProblem) — on input that passes every check of a field's own form (texts short enough, phrases with
 * words): the oracle that the kit's rules compose to what the tool said. Returns the declaration, or the rule broken.
 */
function readWithKit({ time, scale, analogy, shown, said }) {
  if (time !== undefined && timeProblem(time)) return { rule: timeProblem(time) };
  if (time === undefined && scale === undefined && analogy === undefined) return { rule: 'nothing-declared' };
  const out = { ...(time === undefined ? {} : { time }), ...(scale === undefined ? {} : { scale: foldDiffers(scale) }), ...(analogy === undefined ? {} : { analogy: foldDiffers(analogy) }) };
  const lines = shown === false ? [] : shown === undefined ? differsLines(out) : [shown].flat().map(foldDiffers);
  const phrases = said === undefined ? null : [said].flat().map(foldDiffers);
  const broken = differsProblem(out, lines, phrases);
  if (broken) return { rule: broken.problem, ...(broken.problem === 'unstated' ? { statements: broken.statements, says: broken.says } : {}), ...(broken.problem === 'contradicts' ? { figure: broken.figure } : {}) };
  return { value: { ...out, shown: lines, ...(phrases ? { said: phrases } : {}) } };
}
/** The rule a control's refusal states. */
function ruleOf(message) {
  if (/is how many times faster/.test(message)) return { rule: timeCode(message) };
  if (/(says how the scene differs: give|say how the part differs:)/.test(message)) return { rule: 'nothing-declared' };
  if (/(so the voice must say it|so the notes must say it)/.test(message)) return { rule: 'unsaid' };
  const unstated = /declares .* and says only (\d+) thing/.exec(message);
  if (unstated) return { rule: 'unstated', says: Number(unstated[1]) };
  const contra = /shown says (\S+) where/.exec(message);
  if (contra) return { rule: 'contradicts', figure: contra[1] };
  if (/(differs\.said is the phrase|names the same phrase twice)/.test(message)) return { rule: 'said-twice' };
  return { rule: `other: ${message}` };
}
const kitRule = (r) => (r.rule === 'unstated' ? { rule: 'unstated', says: r.says } : r);

test('differs: StoryReel 0.33.0\'s scenes and StoryDeck 0.28.0\'s parts are read to the same declaration, or refused by the same rule, as the kit\'s rules give', () => {
  fc.assert(fc.property(spec, (s) => {
    const kit = readWithKit(s);
    const reel = outcome(() => reel0.readDiffers(s, 'scene'));
    assert.deepEqual('error' in reel ? ruleOf(reel.error) : { value: { ...reel.value } }, 'value' in kit ? { value: kit.value } : kitRule(kit));
    // the deck's attributes: a time as text, shown and said with "|" between lines, shown "false" for the notes alone
    const attr = (name, v) => (v === undefined ? '' : ` ${name}="${v}"`);
    const attrs = `data-label="P"${attr('data-differs-time', s.time === undefined ? undefined : String(s.time))}${attr('data-differs-scale', s.scale)}${attr('data-differs-analogy', s.analogy)}${attr('data-differs-shown', s.shown === undefined ? undefined : s.shown === false ? 'false' : [s.shown].flat().join('|'))}${attr('data-differs-said', s.said === undefined ? undefined : [s.said].flat().join(' | '))}`;
    const deck = outcome(() => deck0.readDiffers(attrs, 'part'));
    // a part that names no data-differs-* at all declares nothing (null), where a scene's empty differs is refused
    assert.deepEqual('error' in deck ? ruleOf(deck.error) : { value: deck.value }, !Object.keys(s).length ? { value: null } : 'value' in kit ? { value: kit.value } : kitRule(kit));
  }), { numRuns: RUNS });
});

test('differs: a declaration\'s English default words, in another language, are the ones the tools refused', () => {
  const lang = fc.constantFrom(null, undefined, '', 'en', 'en-GB', 'EN', 'fr', 'de-AT', 'english', 'ja');
  fc.assert(fc.property(spec.filter((s) => 'value' in readWithKit(s)), lang, (s, l) => {
    const d = readWithKit(s).value;
    const deck = outcome(() => deck0.refuseEnglishWords(d, l, 'p')), reel = outcome(() => reel0.differsOf({ scenes: [{ id: 'a', differs: s }] }, { lang: l }));
    const english = differsEnglish(d, d.shown, l);
    assert.equal('error' in deck, english !== null);
    assert.equal('error' in reel, english !== null);
    if (english !== null) { assert.ok(deck.error.includes(`"${english}"`)); assert.ok(reel.error.includes(`"${english}"`)); }
    assert.equal(differsStatements(d), reel0.statementsOf(d));
  }), { numRuns: RUNS });
});

test('differs: phrases alike as speech are one phrase said twice, as both tools found', () => {
  fc.assert(fc.property(fc.array(spoken, { minLength: 1, maxLength: 5 }), (list) => {
    const twice = new Set(list.map(foldDiffers).map(normSpeech)).size < list.length;
    assert.equal(differsProblem({ scale: 'x' }, ['x'], list.map(foldDiffers))?.problem === 'said-twice', twice);
    assert.equal('error' in outcome(() => reel0.readSaid(list, 'p')), twice);
  }), { numRuns: RUNS });
});

// ── frameZoom ───────────────────────────────────────────────────────────────────────────────────────────────

// boxes as a deck's pieces give them: a point, a line, a word, a map far larger than the slide; rooms through any view
const side = fc.oneof(fc.constant(0), fc.double({ min: 0, max: 4000, noNaN: true }), fc.integer({ min: 0, max: 5000 }), fc.constantFrom(0.5, 1, 1024, 2560, 3584, 4096, 1e7));
const box = fc.record({ x: fc.integer({ min: -500, max: 2000 }), y: fc.integer({ min: -500, max: 1200 }), w: side, h: side });
const area = fc.oneof(fc.constant({ x: 0, y: 0, w: 1600, h: 900 }), fc.record({ x: fc.integer({ min: -400, max: 400 }), y: fc.integer({ min: -400, max: 400 }), w: fc.oneof(fc.double({ min: 1, max: 160000, noNaN: true }), fc.constantFrom(800, 1280, 1600 / 1.5, 16)), h: fc.oneof(fc.double({ min: 1, max: 90000, noNaN: true }), fc.constantFrom(900, 450, 9)) }));
// an option as a page gives it: left out, empty, a number written as text, or no number at all
const option = fc.oneof(fc.constant(undefined), fc.constant(''), fc.double({ min: 0.01, max: 5, noNaN: true }).map(String), fc.constantFrom('0.7', '1', '2.5', '.3', 'abc', '1e-300', 'Infinity'));
const num = (v, d) => (v === undefined || v === null || v === '' ? d : Number(v));

test('frameZoom: the zoom of StoryDeck 0.28.0\'s zoom and fit cameras, to the last bit, for any box, room and option', () => {
  fc.assert(fc.property(box, area, option, option, option, (subject, a, share, most, least) => {
    const zoom = focus0.FOCUS.zoom.place({ subject, area: a, options: { share, most } });
    assert.equal(frameZoom([subject.w, subject.h], [a.w, a.h], { share: num(share, 0.7), least: 1, most: num(most, 2.5), smallest: 1 }), zoom.stage.s);
    const fit = outcome(() => focus0.FOCUS.fit.place({ subject, context: null, look: 'hide', area: a, options: { share, most, least } }));
    // fit frames the box round what is shown, worked out again from its corners (the deck's union): its sides as the deck has them
    const shown = { w: (subject.x + subject.w) - subject.x, h: (subject.y + subject.h) - subject.y };
    if ('value' in fit) assert.equal(frameZoom([shown.w, shown.h], [a.w, a.h], { share: num(share, 0.8), least: num(least, 0.25), most: num(most, 2.5), smallest: 1 }), fit.value.stage.s);
  }), { numRuns: RUNS });
});

test('frameZoom: the size StoryDeck 0.28.0\'s side movers grow the subject to, in the room the context leaves', () => {
  fc.assert(fc.property(fc.constantFrom('left', 'right', 'up', 'down'), box, box, area, option, option, option, option, (sideName, subject, context, a, scale, fill, least, grow) => {
    const options = { scale, fill, least, grow }, view = { s: 1 };
    const placed = focus0.FOCUS[sideName].place({ subject, context, area: a, view, options });
    // the room the context leaves, as the mover works it out (the deck keeps this; the kit sizes the subject in it)
    const s = num(scale, 0.6), gap = num(undefined, 40) / view.s, w = context.w * s, h = context.h * s;
    const room = { left: [a.w - 2 * gap - w, a.h], right: [a.w - 2 * gap - w, a.h], up: [a.w, a.h - 2 * gap - h], down: [a.w, a.h - 2 * gap - h] }[sideName];
    assert.equal(frameZoom([subject.w, subject.h], [Math.max(room[0], 1), Math.max(room[1], 1)], { share: num(fill, 0.9), least: num(least, 0.5), most: num(grow, 1.4), smallest: 1 }), placed.subject.s);
  }), { numRuns: RUNS });
});

// ── wrapWords, narrowestWidth ───────────────────────────────────────────────────────────────────────────────

// a face's measure that is not a sum of its words (a pair of letters kerns), so a line measured whole is what is compared
const measure = (text) => { let w = 0; for (let i = 0; i < text.length; i += 1) w += (text.charCodeAt(i) % 7) * 1.37 + 3.1 - (text[i] === text[i - 1] ? 0.45 : 0); return w; };
const ctx = { measureText: (text) => ({ width: measure(text) }) };
const wordOf = fc.stringMatching(/^[a-zA-Z0-9]{1,12}$/);
const text = fc.array(fc.oneof(wordOf, fc.constantFrom('', ' ', '  ', '\t', 'a', 'Supercalifragilistic')), { maxLength: 14 }).map((w) => w.join(' '));
const width = fc.oneof(fc.double({ min: 0, max: 400, noNaN: true }), fc.integer({ min: 0, max: 400 }), fc.constantFrom(0, 50, 120, 1600, Infinity));

test('wrapWords: the lines of StoryReel 0.33.0\'s title band, end card and summary cards, line for line', () => {
  fc.assert(fc.property(text, width, fc.constantFrom(20, 32, 54), (t, w, size) => {
    const words = t.split(/\s+/).filter(Boolean);
    assert.deepEqual(wrapWords(words, w, measure), wrap0.wrap(ctx, words, w));
    assert.deepEqual(wrapWords(words, w, measure), wrap0.wrapEndCard(ctx, t, w));
    // the summary cards split at single spaces: an empty word joins as written
    const P = { measure: (s, sz) => measure(s) * sz / 32 };
    assert.deepEqual(wrapWords(t.split(' '), w, (s) => P.measure(s, size, { display: true, weight: 600 })), wrap0.wrapPaper(P, t, size, w));
  }), { numRuns: RUNS });
});

test('narrowestWidth: StoryReel 0.33.0\'s balanced title lines, at the same width to the last bit', () => {
  fc.assert(fc.property(text, width.filter(Number.isFinite), (t, w) => {
    const words = t.split(/\s+/).filter(Boolean), lines = wrapWords(words, w, measure);
    const kit = lines.length < 2 ? lines : wrapWords(words, narrowestWidth(w, lines.length, (at) => wrapWords(words, at, measure).length), measure);
    assert.deepEqual(kit, wrap0.balancedLines(ctx, t, w));
  }), { numRuns: RUNS });
});

test('narrowestWidth: a caption\'s balancing in StoryReel 0.33.0, at the same width, for any words and box', () => {
  fc.assert(fc.property(fc.array(wordOf, { minLength: 1, maxLength: 12 }), fc.integer({ min: 200, max: 1500 }), fc.constantFrom(28, 40, 56), (words, w, size) => {
    const caption = { words: words.map((text) => ({ text })) }, was = wrap0.captionLines(ctx, caption, [0, 0, w, 300], size, { balance: true });
    const space = measure(' '), widths = words.map(measure);
    const wrapAt = (limit) => { const out = [[]]; let lw = 0; widths.forEach((wd, i) => { const add = (out.at(-1).length ? space : 0) + wd; if (out.at(-1).length && lw + add > limit) { out.push([]); lw = 0; } lw += (out.at(-1).length ? space : 0) + wd; out.at(-1).push(i); }); return out; };
    const first = wrapAt(w - size), lines = first.length > 1 ? wrapAt(narrowestWidth(w - size, first.length, (at) => wrapAt(at).length)) : first;
    assert.deepEqual(was.lines.map((l) => l.line), lines);
  }), { numRuns: RUNS });
});

// ── wordsToFit's measure ────────────────────────────────────────────────────────────────────────────────────

test('wordsToFit: a measure that gives each word its letters sets every name as the count does, by function and by table', () => {
  const letters = (w) => [...w.replace(/[\p{M}\p{Cf}]/gu, '')].length;
  const name = fc.array(fc.oneof(wordOf, fc.constantFrom('Load', 'Balancer', 'é', 'áb', 'x​y')), { minLength: 0, maxLength: 8 }).map((w) => w.join(' '));
  const room = fc.tuple(fc.integer({ min: 1, max: 600 }), fc.integer({ min: 1, max: 200 }));
  fc.assert(fc.property(name, room, fc.integer({ min: 17, max: 40 }), (n, r, size) => {
    const counted = wordsToFit(n, r, { letter: 1, size });
    assert.deepEqual(wordsToFit(n, r, { measure: letters, size }), counted);
    const table = Object.fromEntries([...n.split(/\s+/).filter(Boolean), ' '].map((w) => [w, letters(w)]));
    assert.deepEqual(wordsToFit(n, r, { measure: table, size }), counted);
    assert.deepEqual(wordsToFit(n, (high) => (high === 0 ? r[0] : r[0] / 2), { measure: letters, size }), wordsToFit(n, (high) => (high === 0 ? r[0] : r[0] / 2), { letter: 1, size }));
  }), { numRuns: RUNS });
});
