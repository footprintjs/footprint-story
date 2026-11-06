/**
 * A conversation, as the sources of a storyboard: messages in order, each with an id a claim can cite. This shape is the
 * library's own: an app maps its history onto it. Whoever writes the storyboard may get things wrong, so a claim says which
 * messages it rests on, and every number in it must be in one of them.
 */
const MOST_MESSAGES = 5000;

const THOUSANDS = /^\d{1,3}(?:,\d{3})+(?:\.\d+)?$/;
const FULLWIDTH = /[\uFF10-\uFF19]/g;
/** Digits of any kind, and what may join them into one number: a point, a comma, or a space that does not break, in any width. */
const NUMBER = /[\p{Nd}\p{No}]+(?:[.,\uFF0C\uFF0E\u00A0\u2009\u202F][\p{Nd}\p{No}]+)*/gu;

/**
 * Every number in a text, as a reader sees it. Invisible characters go first, so '4\u200D2' is the 42 it shows, not a 4 and
 * a 2. Fullwidth digits read as plain ones. Commas go only from real thousands grouping ('1,250.5' → '1250.5'). Anything
 * else stays as written and must be found as it is: '3,5' is not 35, '10²' is not 102, and another script's digits are
 * their own. So a number it cannot compare fails the check, never passes.
 */
export function numbersIn(text) {
  const seen = String(text).replace(/\p{Cf}/gu, '').replace(FULLWIDTH, (d) => String.fromCharCode(d.charCodeAt(0) - 0xFF10 + 48));
  return [...new Set((seen.match(NUMBER) ?? []).map((n) => (THOUSANDS.test(n) ? n.replaceAll(',', '') : n)))];
}

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
  const said = new Set(cited.flatMap((id) => numbersIn(conversation.get(id))));
  for (const n of numbersIn(claim)) {
    if (!said.has(n)) fields.say(at, `says ${n}, which none of its sources (${cited.join(', ')}) says: fix the number, cite the message that says it, or move it to what you are not sure about`);
  }
}

/** Words that cite no message (a title, what is said at the end, what happens next): any number in them must be somewhere in the conversation. */
export function checkAnywhere(fields, conversation, at, text) {
  if (!conversation) return;
  const said = new Set([...conversation.values()].flatMap((message) => numbersIn(message)));
  for (const n of numbersIn(text)) if (!said.has(n)) fields.say(at, `says ${n}, which the conversation never says: fix the number, or take it out`);
}
