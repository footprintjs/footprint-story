/**
 * A conversation, as the sources of a storyboard: messages in order, each with an id a claim can cite. This shape is the
 * library's own: an app maps its history onto it. Whoever writes the storyboard may get things wrong, so a claim says which
 * messages it rests on, and every number in it must be in one of them.
 */
const MOST_MESSAGES = 5000;

const THOUSANDS = /^\d{1,3}(?:[,   ]\d{3})+(?:\.\d+)?$/;
const GROUPING = /[,   ]/g;
const FULLWIDTH = /[０-９]/g;
/** Digits of any kind, kept with whatever joins them into one number, so a source's '10²' or '1 250' is not also a 10 or a 250. */
const NUMBER = /[\p{Nd}\p{No}]+(?:[.,，．   ․﹐﹒][\p{Nd}\p{No}]+)*/gu;
const BIDI = /[؜‎‏‪-‮⁦-⁩]/;
/** Two digits with something between them that a reader cannot read as what it is: anything but a visible letter or printable ASCII. */
const ODDLY_JOINED = /\p{Nd}(?:[^\p{L}\p{Nd}\x20-\x7E]|\p{Default_Ignorable_Code_Point})+\p{Nd}/u;
/** A control character other than a tab or a line break. */
const CONTROL = /[^\P{Cc}\t\n\r]/u;
const plainWidth = (text) => String(text).replace(FULLWIDTH, (d) => String.fromCharCode(d.charCodeAt(0) - 0xFF10 + 48));
const digitCount = (text) => (text.match(/\p{Nd}/gu) ?? []).length;

/**
 * Every number in a text: digits in any script, fullwidth ones read as plain, hidden characters ignored. Grouping goes only
 * when it is real thousands ('1,250.5' → '1250.5', and with a thin space too); anything else stays as written, so '3,5' is
 * not 35 and '10²' is not 10.
 */
export function numbersIn(text) {
  const seen = plainWidth(text).replace(/[\p{Cf}\p{Default_Ignorable_Code_Point}]/gu, '');
  return [...new Set((seen.match(NUMBER) ?? []).map((n) => (THOUSANDS.test(n) ? n.replace(GROUPING, '') : n)))];
}

/**
 * Whether words write a number in a form that may not show what it reads as: a compatibility digit (10², ½, ①, ㏳), digits
 * joined by anything odd, or direction controls that reorder what is shown. What a model writes must use plain digits, so
 * these are refused rather than read: the rule allows one form instead of chasing each disguise.
 */
function disguisesNumber(text) {
  const plain = plainWidth(text);
  if (/\p{No}/u.test(plain) || digitCount(plain.normalize('NFKC')) !== digitCount(plain)) return true;
  return digitCount(plain) > 0 && (BIDI.test(plain) || CONTROL.test(plain) || ODDLY_JOINED.test(plain));
}
const DISGUISED = 'writes a number in a form that cannot be checked: use plain digits, with no hidden or special characters near them';

/**
 * [{id, who?, text}] read and checked: a Map of id → text. Throws, naming the place, on anything it cannot use, as what
 * is passed here comes from the app, not from whoever writes the storyboard.
 */
export function readConversation(messages) {
  if (!Array.isArray(messages)) throw new TypeError('a conversation is a list of messages: [{id, text}]');
  if (messages.length > MOST_MESSAGES) throw new RangeError(`a conversation of ${messages.length} messages is too long: ${MOST_MESSAGES} is the most`);
  const out = new Map();
  messages.forEach((m, i) => {
    if (m === null || typeof m !== 'object' || typeof m.id !== 'string' || !m.id.trim()) throw new TypeError(`message ${i}: id must be text with something in it`);
    if (typeof m.text !== 'string') throw new TypeError(`message ${i} ("${m.id}"): text must be text`);
    if (out.has(m.id)) throw new TypeError(`message ${i}: two messages have the id "${m.id}"`);
    out.set(m.id, m.text);
  });
  return out;
}

/**
 * Checks one claim against the messages it cites, keeping any problem on `fields`: every message it cites is there, and
 * every number it says is in one of them. `claim`: the words it says. With no conversation there is nothing to check
 * against, and a board says so (`verified: false`).
 */
export function checkClaim(fields, conversation, at, claim, cited) {
  if (!conversation) return;
  if (!cited.length) { fields.say(`${at}.sources`, 'must name the messages this rests on'); return; }
  const missing = cited.filter((id) => !conversation.has(id));
  for (const id of missing) fields.say(`${at}.sources`, `names "${id}", which the conversation does not have`);
  if (missing.length) return;
  if (disguisesNumber(claim)) { fields.say(at, DISGUISED); return; }
  const said = new Set(cited.flatMap((id) => numbersIn(conversation.get(id))));
  for (const n of numbersIn(claim)) {
    if (!said.has(n)) fields.say(at, `says ${n}, which none of its sources (${cited.join(', ')}) says: fix the number, cite the message that says it, or move it to what you are not sure about`);
  }
}

/** Words that cite no message (a title, what is said at the end, what happens next): any number in them must be somewhere in the conversation. */
export function checkAnywhere(fields, conversation, at, text) {
  if (!conversation) return;
  if (disguisesNumber(text)) { fields.say(at, DISGUISED); return; }
  const said = new Set([...conversation.values()].flatMap((message) => numbersIn(message)));
  for (const n of numbersIn(text)) if (!said.has(n)) fields.say(at, `says ${n}, which the conversation never says: fix the number, or take it out`);
}
