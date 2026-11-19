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
 * called `w1:2` is itself). The text may come from anyone: it is bounded as it is read (never after), a hidden
 * character in a name is refused, a list is read by its own stored values (a hole is refused, a getter is never
 * run), and every refusal says what to write. Seconds are kept to the millisecond, so what is written reads back.
 */

/** The most turns an order has, names a turn has, characters a name has and characters the written form has (all its parts together). */
export const MOST_TURNS = 256, MOST_TOGETHER = 64, MOST_TURN_NAME = 128, MOST_TURNS_TEXT = 8192;
/** The longest a turn takes, in seconds. */
export const MOST_TURN_SECONDS = 60;

const HIDDEN = /[\p{Cc}\p{Cf}\p{Cs}\p{Co}\p{Zl}\p{Zp}\p{Default_Ignorable_Code_Point}\p{Noncharacter_Code_Point}\p{Variation_Selector}⠀]/u;
const SECONDS = /^(?:\d+(?:\.\d*)?|\.\d+)$/;   // 1, 1.2, .5 — never '1.2.3', '-1' or '1e3'
const FORM = "names in the order they come, '(a b)' for names that come together, 'name:seconds' for a turn's own time — e.g. 'a (b c) d:1.2'";
/** A value's own stored field: undefined when it has none, and for a getter (somebody's code, which is never run). */
const own = (o, key) => { const d = Object.getOwnPropertyDescriptor(o, key); return d && 'value' in d ? d.value : undefined; };
/** A value as a refusal shows it, read the same way: a list by its own stored values, an object only named. */
function shown(v) {
  if (Array.isArray(v)) return `[${Array.from({ length: Math.min(v.length, 8) }, (_, i) => shown(own(v, i))).join(',')}${v.length > 8 ? ',…' : ''}]`;
  if (v !== null && typeof v === 'object') return 'an object';
  if (typeof v === 'string') return JSON.stringify(v.length > 60 ? `${v.slice(0, 60)}…` : v);
  return typeof v === 'function' ? 'a function' : String(v);
}
const short = (s) => (s.length > 40 ? `${s.slice(0, 40)}…` : s);
const round = (v) => Math.round(v * 1000) / 1000;
const isSeconds = (v) => typeof v === 'number' && v >= 0 && v <= MOST_TURN_SECONDS;
/** A name ending like a time (`w1:2`): alone with no time of its own, or inside a group, it would read back as a time. */
const endsLikeTime = (name) => name.lastIndexOf(':') > 0 && SECONDS.test(name.slice(name.lastIndexOf(':') + 1));

function refuse(where, fix) { throw new Error(`${where}: ${fix}`); }

function secondsOf(text, where, what) {
  const n = SECONDS.test(text) ? Number(text) : NaN;
  if (!isSeconds(n)) refuse(where, `${what} takes seconds, a number from 0 to ${MOST_TURN_SECONDS} — not "${short(text)}"`);
  return round(n);
}

function nameOf(name, where) {
  if (typeof name !== 'string' || !name) refuse(where, `a name is text, not ${shown(name)}`);
  if (name.length > MOST_TURN_NAME) refuse(where, `a name is at most ${MOST_TURN_NAME} characters — "${short(name)}" has ${name.length}`);
  if (HIDDEN.test(name)) refuse(where, `a name has a character nobody can see in it (${JSON.stringify(short(name))}): type the name again`);
  if (/\s/.test(name)) refuse(where, `a name has no space in it — not "${short(name)}"`);
  return name;
}

/** The names of one turn: a list read index by index (a hole is not a name), at most MOST_TOGETHER, each checked. */
function namesOf(names, where) {
  if (!Array.isArray(names) || !names.length) refuse(where, `a turn's names are a list of one name or more — not ${shown(names)}`);
  if (names.length > MOST_TOGETHER) refuse(where, `at most ${MOST_TOGETHER} names come together in one turn, not ${names.length}`);
  const out = [];
  // each index by its own stored value: a hole has none, and a getter is somebody's code, which is never run
  for (let i = 0; i < names.length; i += 1) out.push(nameOf(own(names, i), where));
  return out;
}

/** One written order, token by token, into `turns` (which may hold turns already: the bound is on them all). */
function parse(text, where, isName, turns) {
  const n = text.length;
  let i = 0;
  const space = () => { while (i < n && /\s/.test(text[i])) i += 1; };
  const word = () => { const from = i; while (i < n && !/\s/.test(text[i])) i += 1; return text.slice(from, i); };
  const add = (turn) => { if (turns.length >= MOST_TURNS) refuse(where, `an order has at most ${MOST_TURNS} turns`); turns.push(turn); };
  for (space(); i < n; space()) {
    const start = i, whole = word();
    if (isName?.(whole)) { add({ names: [nameOf(whole, where)], takes: null }); continue; }
    i = start;
    if (text[i] === '(') {
      const close = text.indexOf(')', i);
      if (close < 0) refuse(where, `"(" opens names that come together and ")" closes them — close "${short(text.slice(i))}"`);
      const inside = text.slice(i + 1, close);
      if (inside.includes('(')) refuse(where, `a "(" inside a "(": names that come together are one list — not "${short(text.slice(i, close + 1))}"`);
      const names = inside.trim() ? inside.trim().split(/\s+/) : [];
      if (!names.length) refuse(where, '"()" names nothing: write the names that come together inside it, or take it out');
      for (const x of names.slice(0, MOST_TOGETHER)) { const c = x.lastIndexOf(':'); if (c > 0 && SECONDS.test(x.slice(c + 1)) && !isName?.(x)) refuse(where, `a time follows the ")" and is the whole turn's — write "(${short(names.map((y) => (y === x ? y.slice(0, c) : y)).join(' '))})${x.slice(c)}", not "${short(x)}" inside it`); }
      i = close + 1;
      const after = word();
      if (after && after[0] !== ':') refuse(where, `after ")" comes a space or ":seconds" — not "${short(after)}"`);
      add({ names: namesOf(names, where), takes: after ? secondsOf(after.slice(1), where, `"(${short(inside.trim())})"`) : null });
    } else {
      const token = word(), cut = token.lastIndexOf(':'), name = cut < 0 ? token : token.slice(0, cut);
      if (!name) refuse(where, `":seconds" follows a name — not "${short(token)}"`);
      if (!isName?.(name) && /[()]/.test(name)) refuse(where, `")" with no "(" before it, or a "(" inside a name — not "${short(token)}": ${FORM}`);
      add({ names: [nameOf(name, where)], takes: cut < 0 ? null : secondsOf(token.slice(cut + 1), where, `"${short(name)}"`) });
    }
  }
}

/** A turn handed over as data: {names, takes?}, own fields only. */
function turnOf(raw, where) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) refuse(where, `an order is text, or a list of text and {names, takes?} — not ${shown(raw)}`);
  const takes = own(raw, 'takes') ?? null;
  const names = namesOf(own(raw, 'names'), where);
  if (takes !== null && takes !== undefined && !isSeconds(takes)) refuse(where, `a turn takes seconds, a number from 0 to ${MOST_TURN_SECONDS}, or nothing — not ${shown(takes)}`);
  return { names, takes: takes === null || takes === undefined ? null : round(takes) };
}

/**
 * An order, read: text in the written form, or a list of such text and of turns as data ({names, takes?}).
 * Returns frozen [{names, takes}] — takes is the turn's own seconds (to the millisecond), or null when it takes the
 * usual step. `isName(text)` says a token is one of the caller's own names, as written, whatever it looks like.
 */
export function readTurns(order, { where = 'turns', isName } = {}) {
  if (isName !== undefined && typeof isName !== 'function') refuse(where, `isName is a function that says a word is one of your names, not ${shown(isName)}`);
  const parts = typeof order === 'string' ? [order] : Array.isArray(order) ? order : refuse(where, `an order is ${FORM} — not ${shown(order)}`);
  if (parts.length > MOST_TURNS) refuse(where, `an order has at most ${MOST_TURNS} turns, not ${parts.length}`);
  const turns = [];
  let written = 0;
  for (let k = 0; k < parts.length; k += 1) {
    const part = own(parts, k);
    if (typeof part !== 'string') { if (turns.length >= MOST_TURNS) refuse(where, `an order has at most ${MOST_TURNS} turns`); turns.push(turnOf(part, where)); continue; }
    written += part.length;
    if (written > MOST_TURNS_TEXT) refuse(where, `an order is at most ${MOST_TURNS_TEXT} characters, not ${written} or more`);
    parse(part, where, isName, turns);
  }
  return Object.freeze(turns.map((t) => Object.freeze({ names: Object.freeze(t.names), takes: t.takes })));
}

/** A turn as turnTimes and writeTurns take it: what readTurns gave, or {names, takes?} of the same shape. */
function given(turn, where, what) {
  const names = turn && typeof turn === 'object' ? own(turn, 'names') : undefined, takes = names === undefined ? undefined : own(turn, 'takes');
  if (!Array.isArray(names)) refuse(where, `${what} takes the turns readTurns gave — not a turn: ${shown(turn)}`);
  if (takes !== null && takes !== undefined && !isSeconds(takes)) refuse(where, `a turn takes seconds, a number from 0 to ${MOST_TURN_SECONDS} — not ${shown(takes)}`);
  return { names: namesOf(names, where), takes: takes ?? null };
}

/**
 * When each turn starts. A turn takes its own seconds, or `takes(turn, index)` when that gives a number, or `step`.
 * Returns frozen {turns: [{names, at, takes}], last, end}: `last` is when the last turn starts, `end` when it is over
 * (both 0 for no turns). Seconds, to the millisecond; turns that take the step are counted, not summed, so the tenth
 * starts at exactly 9 × step.
 */
export function turnTimes(turns, { step = 0.35, takes, where = 'turns' } = {}) {
  if (!Array.isArray(turns)) refuse(where, `turnTimes takes the turns readTurns gave, not ${shown(turns)}`);
  if (turns.length > MOST_TURNS) refuse(where, `an order has at most ${MOST_TURNS} turns, not ${turns.length}`);
  if (!isSeconds(step)) refuse(where, `step is the seconds a turn takes when it does not say, a number from 0 to ${MOST_TURN_SECONDS} — not ${shown(step)}`);
  if (takes !== undefined && typeof takes !== 'function') refuse(where, `takes is a function (turn, index) that gives a turn's seconds, not ${shown(takes)}`);
  let steps = 0, spent = 0;   // spent: the seconds of the turns that said their own
  const timed = [];
  for (let index = 0; index < turns.length; index += 1) {
    const turn = given(turns[index], where, 'turnTimes'), asked = turn.takes ?? takes?.(turns[index], index) ?? null;
    if (asked !== null && !isSeconds(asked)) refuse(where, `a turn takes seconds, a number from 0 to ${MOST_TURN_SECONDS} — not ${shown(asked)}`);
    timed.push(Object.freeze({ names: Object.freeze(turn.names), at: round(steps * step + spent), takes: asked === null ? step : round(asked) }));
    if (asked === null) steps += 1; else spent += round(asked);
  }
  const last = timed.length ? timed[timed.length - 1].at : 0;
  return Object.freeze({ turns: Object.freeze(timed), last, end: timed.length ? round(steps * step + spent) : 0 });
}

/**
 * The written form of turns: what readTurns reads back to the same turns. A name the form cannot spell (one with a
 * bracket in it, or ending like a time: `w1:2`) is refused: such turns stay data.
 */
export function writeTurns(turns) {
  if (!Array.isArray(turns)) refuse('turns', `writeTurns takes the turns readTurns gave, not ${shown(turns)}`);
  const out = [];
  for (let index = 0; index < turns.length; index += 1) {
    const { names, takes } = given(turns[index], 'turns', 'writeTurns'), timed = takes !== null;
    // `a:1` with its own time writes as `a:1:2` and reads back; alone with none, or in a group, it would read back as a time
    for (const name of names) if (/[()]/.test(name) || (endsLikeTime(name) && (names.length > 1 || !timed))) refuse('turns', `the name "${short(name)}" cannot be written: it would read back as a group or a time — keep these turns as data`);
    out.push(`${names.length === 1 ? names[0] : `(${names.join(' ')})`}${timed ? `:${round(takes)}` : ''}`);
  }
  return out.join(' ');
}
