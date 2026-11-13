/**
 * A chatbot session, read as a conversation a storyboard can cite: what the person said and what the assistant answered, in
 * order, each with a short id. A session file is one JSON record per line (a Claude Code session is), and it can be far bigger
 * than memory can hold as one string, so it is read a line at a time: the host hands lines in as it reads them, and nothing
 * here reads a file. Tool calls, tool results, the assistant's private thinking and the host's own notes (records marked
 * `isMeta`, `isSidechain` or `isCompactSummary`, a background task's notice, and `<system-reminder>` blocks in a message) are
 * left out; what is left out is counted, by kind,
 * never kept.
 *
 * A session is untrusted: its words become a message's text as they are, never instructions. A line too long, a line that is
 * not JSON, and a record of a shape this reader does not know are each counted and skipped, never thrown on: one odd line
 * must not cost the rest of the session.
 */

/** The longest line read, in UTF-16 units (about 2 MB): longer is a tool's output or a pasted file, skipped and counted. */
export const MOST_LINE = 1 << 21;
/** The most messages kept: the storyboard door reads at most this many. Past it, a message is counted, not kept. */
export const MOST_MESSAGES = 5000;
/** The most text one message keeps, in UTF-16 units: past it, its text is cut and the cut counted. */
export const MOST_TEXT = 1 << 16;

const HOST_NOTE = /<system-reminder>[\s\S]*?<\/system-reminder>/g;
const COMMAND_ONLY = /^\s*<(command-name|command-message|command-args|local-command-stdout|local-command-caveat)>[\s\S]*$/;
/** A user record the host wrote, not the person: a background task's notice, an artifact's relayed content, browser or editor context. */
const HOST_LEAD = /^\s*<(task-notification|artifact-content-authored-by-others|browser[a-z_-]*|ide_[a-z_]+)[\s/>]/;

const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const own = (object, key) => (Object.hasOwn(object, key) ? object[key] : undefined);

/** The words of a message's content: a string, or the `text` of its text blocks. Anything else in it says no words. */
function wordsOf(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .filter((block) => isRecord(block) && own(block, 'type') === 'text' && typeof own(block, 'text') === 'string')
    .map((block) => block.text)
    .join('\n');
}

/** Whether content carries a tool result: a user record of that kind is the tool talking, not the person. */
const hasToolResult = (content) => Array.isArray(content) && content.some((block) => isRecord(block) && own(block, 'type') === 'tool_result');

/**
 * A reader you hand lines to, one at a time, in file order: `add(line)`, then `result()` →
 * `{ messages: [{ id, who, text }], left: { [kind]: count } }`. One turn of the assistant may be several records; its words
 * join into one message, so a message is one turn of one speaker. Ids are `m1`, `m2`, … in order.
 */
export function sessionReader() {
  const messages = [];
  const left = {};
  const count = (kind) => { left[kind] = (left[kind] ?? 0) + 1; };
  let open = null;   // the message the last record added to, while the same speaker goes on

  const keep = (who, text) => {
    if (open && open.who === who) {
      open.text = cut(`${open.text}\n\n${text}`);
      return;
    }
    if (messages.length >= MOST_MESSAGES) { count('over-most-messages'); open = null; return; }
    open = { id: `m${messages.length + 1}`, who, text: cut(text) };
    messages.push(open);
  };
  const cut = (text) => {
    if (text.length <= MOST_TEXT) return text;
    count('text-cut');
    return text.slice(0, MOST_TEXT);
  };

  function add(line) {
    if (typeof line !== 'string') throw new TypeError('sessionReader().add takes one line of the session file, as text');
    if (!line.trim()) return;
    if (line.length > MOST_LINE) { count('line-too-long'); return; }
    let record;
    try { record = JSON.parse(line); } catch { count('not-json'); return; }
    if (!isRecord(record)) { count('not-a-record'); return; }
    const type = own(record, 'type');
    if (type !== 'user' && type !== 'assistant') { count(typeof type === 'string' ? `record:${type}`.slice(0, 64) : 'record:unnamed'); return; }
    if (own(record, 'isMeta') === true || own(record, 'isSidechain') === true || own(record, 'isCompactSummary') === true) { count('host-note'); return; }
    const message = own(record, 'message');
    if (!isRecord(message)) { count('no-message'); return; }
    const content = own(message, 'content');
    if (type === 'user' && hasToolResult(content)) { count('tool-result'); return; }
    const text = wordsOf(content).replace(HOST_NOTE, '').trim();
    if (!text) { count(type === 'assistant' ? 'assistant-no-words' : 'user-no-words'); return; }
    if (type === 'user' && COMMAND_ONLY.test(text)) { count('command'); return; }
    if (type === 'user' && HOST_LEAD.test(text)) { count('host-note'); return; }
    keep(type === 'user' ? 'person' : 'assistant', text);
  }

  const result = () => Object.freeze({
    messages: Object.freeze(messages.map((m) => Object.freeze({ ...m }))),
    left: Object.freeze({ ...left }),
  });

  return Object.freeze({ add, result });
}

/** A whole session's text at once (small sessions, tests): the same as handing each line to `sessionReader()`. */
export function readSession(text) {
  if (typeof text !== 'string') throw new TypeError('readSession takes the session file\'s text');
  const reader = sessionReader();
  for (const line of text.split('\n')) reader.add(line.endsWith('\r') ? line.slice(0, -1) : line);
  return reader.result();
}
