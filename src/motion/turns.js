/**
 * Turns: an order written once, for a film and a deck. Things that come one after another each take a TURN; things in
 * one turn come together; a turn may say how long it takes before the next one starts.
 *
 *   camera laptop (dns server) w1:1.2 db
 *
 * reads: the camera; then the laptop; then the dns and the server together; then w1, which takes 1.2 s; then db.
 *
 *   readTurns('a (b c) d:1.2')        → [{names: ['a'], takes: null}, {names: ['b', 'c'], takes: null}, {names: ['d'], takes: 1.2}]
 *   turnTimes(turns, {step: 0.35})    → {turns: [{names, at, takes}, …], last, end}   seconds, to the millisecond
 *   writeTurns(turns)                 → 'a (b c) d:1.2'
 *
 * `stagger` is the plain case: every item its own turn, one gap. Nothing here knows what a name is: a tool looks its
 * names up in its own picture, and gives `isName` when one of its names looks like the written form (a thing really
 * called `w1:2` is itself). The text may come from anyone: it is bounded, a hidden character in a name is refused,
 * and every refusal says what to write.
 */

/** The most turns an order has, names a turn has, characters a name has and characters the written form has. */
export const MOST_TURNS = 256, MOST_TOGETHER = 64, MOST_TURN_NAME = 128, MOST_TURNS_TEXT = 8192;
/** The longest a turn takes, in seconds. */
export const MOST_TURN_SECONDS = 60;

const HIDDEN = /[\p{Cc}\p{Cf}\p{Cs}\p{Co}\p{Zl}\p{Zp}\p{Default_Ignorable_Code_Point}\p{Noncharacter_Code_Point}\p{Variation_Selector}⠀]/u;
const SECONDS = /^(?:\d+(?:\.\d*)?|\.\d+)$/;   // 1, 1.2, .5 — never '1.2.3', '-1' or '1e3'
const FORM = "names in the order they come, '(a b)' for names that come together, 'name:seconds' for a turn's own time — e.g. 'a (b c) d:1.2'";
const shown = (v) => (typeof v === 'number' || v === undefined ? String(v) : JSON.stringify(v));
const short = (s) => (s.length > 40 ? `${s.slice(0, 40)}…` : s);
const round = (v) => Math.round(v * 1000) / 1000;

function refuse(where, fix) { throw new Error(`${where}: ${fix}`); }

function secondsOf(text, where, what) {
  const n = SECONDS.test(text) ? Number(text) : NaN;
  if (!(n >= 0 && n <= MOST_TURN_SECONDS)) refuse(where, `${what} takes seconds, a number from 0 to ${MOST_TURN_SECONDS} — not "${short(text)}"`);
  return n;
}

function nameOf(name, where) {
  if (typeof name !== 'string' || !name) refuse(where, `a name is text, not ${shown(name)}`);
  if (name.length > MOST_TURN_NAME) refuse(where, `a name is at most ${MOST_TURN_NAME} characters — "${short(name)}" has ${name.length}`);
  if (HIDDEN.test(name)) refuse(where, `a name has a character nobody can see in it (${JSON.stringify(short(name))}): type the name again`);
  if (/\s/.test(name)) refuse(where, `a name has no space in it — not "${short(name)}"`);
  return name;
}

/** One written order, token by token. */
function parse(text, where, isName) {
  if (text.length > MOST_TURNS_TEXT) refuse(where, `an order is at most ${MOST_TURNS_TEXT} characters, not ${text.length}`);
  const turns = [], n = text.length;
  let i = 0;
  const space = () => { while (i < n && /\s/.test(text[i])) i += 1; };
  const word = () => { const from = i; while (i < n && !/\s/.test(text[i])) i += 1; return text.slice(from, i); };
  for (space(); i < n; space()) {
    const start = i, whole = word();
    if (isName?.(whole)) { turns.push({ names: [nameOf(whole, where)], takes: null }); continue; }
    i = start;
    if (text[i] === '(') {
      const close = text.indexOf(')', i);
      if (close < 0) refuse(where, `"(" opens names that come together and ")" closes them — close "${short(text.slice(i))}"`);
      const inside = text.slice(i + 1, close);
      if (inside.includes('(')) refuse(where, `a "(" inside a "(": names that come together are one list — not "${short(text.slice(i, close + 1))}"`);
      const names = inside.trim() ? inside.trim().split(/\s+/) : [];
      if (!names.length) refuse(where, '"()" names nothing: write the names that come together inside it, or take it out');
      for (const x of names) { const c = x.lastIndexOf(':'); if (c > 0 && SECONDS.test(x.slice(c + 1)) && !isName?.(x)) refuse(where, `a time follows the ")" and is the whole turn's — write "(${short(names.map((y) => (y === x ? y.slice(0, c) : y)).join(' '))})${x.slice(c)}", not "${short(x)}" inside it`); }
      i = close + 1;
      const after = word();
      if (after && after[0] !== ':') refuse(where, `after ")" comes a space or ":seconds" — not "${short(after)}"`);
      turns.push({ names: names.map((x) => nameOf(x, where)), takes: after ? secondsOf(after.slice(1), where, `"(${short(inside.trim())})"`) : null });
    } else {
      const token = word(), cut = token.lastIndexOf(':');
      if (cut < 0) {
        if (/[()]/.test(token)) refuse(where, `")" with no "(" before it, or a "(" inside a name — not "${short(token)}": ${FORM}`);
        turns.push({ names: [nameOf(token, where)], takes: null });
      } else {
        const name = token.slice(0, cut);
        if (!name) refuse(where, `":seconds" follows a name — not "${short(token)}"`);
        if (!isName?.(name) && /[()]/.test(name)) refuse(where, `")" with no "(" before it, or a "(" inside a name — not "${short(token)}": ${FORM}`);
        turns.push({ names: [nameOf(name, where)], takes: secondsOf(token.slice(cut + 1), where, `"${short(name)}"`) });
      }
    }
  }
  return turns;
}

/** A turn handed over as data: {names, takes?}. */
function turnOf(raw, where) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) refuse(where, `an order is text, or a list of text and {names, takes?} — not ${shown(raw)}`);
  const names = Object.hasOwn(raw, 'names') ? raw.names : undefined, takes = Object.hasOwn(raw, 'takes') ? raw.takes : null;
  if (!Array.isArray(names) || !names.length) refuse(where, `a turn's names are a list of one name or more — not ${shown(names)}`);
  if (takes !== null && takes !== undefined && !(typeof takes === 'number' && takes >= 0 && takes <= MOST_TURN_SECONDS)) refuse(where, `a turn takes seconds, a number from 0 to ${MOST_TURN_SECONDS}, or nothing — not ${shown(takes)}`);
  return { names: names.map((x) => nameOf(x, where)), takes: takes ?? null };
}

/**
 * An order, read: text in the written form, or a list of such text and of turns as data ({names, takes?}).
 * Returns frozen [{names, takes}] — takes is the turn's own seconds, or null when it takes the usual step.
 * `isName(text)` says a token is one of the caller's own names, as written, whatever it looks like.
 */
export function readTurns(order, { where = 'turns', isName } = {}) {
  if (isName !== undefined && typeof isName !== 'function') refuse(where, `isName is a function that says a word is one of your names, not ${shown(isName)}`);
  const parts = typeof order === 'string' ? [order] : Array.isArray(order) ? order : refuse(where, `an order is ${FORM} — not ${shown(order)}`);
  if (parts.length > MOST_TURNS) refuse(where, `an order has at most ${MOST_TURNS} turns, not ${parts.length}`);
  const turns = parts.flatMap((p) => (typeof p === 'string' ? parse(p, where, isName) : [turnOf(p, where)]));
  if (turns.length > MOST_TURNS) refuse(where, `an order has at most ${MOST_TURNS} turns, not ${turns.length}`);
  for (const t of turns) if (t.names.length > MOST_TOGETHER) refuse(where, `at most ${MOST_TOGETHER} names come together in one turn, not ${t.names.length}`);
  return Object.freeze(turns.map((t) => Object.freeze({ names: Object.freeze([...t.names]), takes: t.takes })));
}

/**
 * When each turn starts. A turn takes its own seconds, or `takes(turn, index)` when that gives a number, or `step`.
 * Returns frozen {turns: [{names, at, takes}], last, end}: `last` is when the last turn starts, `end` when it is over
 * (both 0 for no turns). Seconds, to the millisecond; turns that take the step are counted, not summed, so the tenth
 * starts at exactly 9 × step.
 */
export function turnTimes(turns, { step = 0.35, takes, where = 'turns' } = {}) {
  if (!Array.isArray(turns)) refuse(where, `turnTimes takes the turns readTurns gave, not ${shown(turns)}`);
  if (!(typeof step === 'number' && step >= 0 && step <= MOST_TURN_SECONDS)) refuse(where, `step is the seconds a turn takes when it does not say, a number from 0 to ${MOST_TURN_SECONDS} — not ${shown(step)}`);
  if (takes !== undefined && typeof takes !== 'function') refuse(where, `takes is a function (turn, index) that gives a turn's seconds, not ${shown(takes)}`);
  let steps = 0, own = 0;
  const timed = turns.map((turn, index) => {
    const asked = turn.takes ?? takes?.(turn, index) ?? null;
    if (asked !== null && !(typeof asked === 'number' && asked >= 0 && asked <= MOST_TURN_SECONDS)) refuse(where, `a turn takes seconds, a number from 0 to ${MOST_TURN_SECONDS} — not ${shown(asked)}`);
    const at = round(steps * step + own);
    if (asked === null) steps += 1; else own += asked;
    return Object.freeze({ names: turn.names, at, takes: asked ?? step });
  });
  const last = timed.length ? timed[timed.length - 1].at : 0;
  return Object.freeze({ turns: Object.freeze(timed), last, end: timed.length ? round(steps * step + own) : 0 });
}

/** The written form of turns: what readTurns reads back to the same turns. */
export function writeTurns(turns) {
  if (!Array.isArray(turns)) refuse('turns', `writeTurns takes the turns readTurns gave, not ${shown(turns)}`);
  return turns.map((t) => `${t.names.length === 1 ? t.names[0] : `(${t.names.join(' ')})`}${t.takes === null || t.takes === undefined ? '' : `:${t.takes}`}`).join(' ');
}
