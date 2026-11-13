// A chatbot session read as a conversation: the person's words and the assistant's, in order; everything else counted.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readSession, sessionReader, storyboardBrief } from '../storyboard.js';
import { MOST_LINE, MOST_MESSAGES, MOST_TEXT } from '../src/storyboard/session.js';

const line = (record) => JSON.stringify(record);
const person = (content, extra = {}) => line({ type: 'user', message: { role: 'user', content }, ...extra });
const assistant = (content) => line({ type: 'assistant', message: { role: 'assistant', content } });
const text = (t) => ({ type: 'text', text: t });

test('keeps what the person said and what the assistant answered, in order, with short ids', () => {
  const { messages, left } = readSession([
    person('Why did the build fail?'),
    assistant([{ type: 'thinking', thinking: 'private' }]),
    assistant([text('The cache was stale.')]),
    assistant([{ type: 'tool_use', name: 'Bash', input: {} }]),
    person([{ type: 'tool_result', content: 'ok' }]),
    assistant([text('I cleared it; 12 tests pass now.')]),
    person([text('Thanks.')]),
  ].join('\n'));
  assert.deepEqual(messages, [
    { id: 'm1', who: 'person', text: 'Why did the build fail?' },
    { id: 'm2', who: 'assistant', text: 'The cache was stale.\n\nI cleared it; 12 tests pass now.' },
    { id: 'm3', who: 'person', text: 'Thanks.' },
  ]);
  assert.deepEqual(left, { 'assistant-no-words': 2, 'tool-result': 1 });
});

test("leaves out the host's own notes, and says how many", () => {
  const { messages, left } = readSession([
    person('hidden', { isMeta: true }),
    person('summary of before', { isCompactSummary: true }),
    assistant([text('a side task')]).replace('"type":"assistant"', '"type":"assistant","isSidechain":true'),
    person('<task-notification><status>completed</status></task-notification>'),
    person('<browser_instruction>use the browser</browser_instruction>'),
    person('<ide_selection>code</ide_selection>'),
    person('<command-name>/clear</command-name>'),
    person('Real question<system-reminder>a host note</system-reminder>'),
    line({ type: 'attachment', attachment: {} }),
  ].join('\n'));
  assert.deepEqual(messages, [{ id: 'm1', who: 'person', text: 'Real question' }]);
  assert.deepEqual(left, { 'host-note': 6, command: 1, 'record:attachment': 1 });
});

test('a pasted block is the person\'s own words, and stays', () => {
  const { messages } = readSession(person('<pasted_content>the log</pasted_content> what does this mean?'));
  assert.equal(messages.length, 1);
});

test('an odd line is counted and skipped, never thrown on', () => {
  const huge = person('x'.repeat(MOST_LINE + 1));
  const { messages, left } = readSession(['{not json', '[1,2]', huge, line({ type: 'user' }), '', '   ', person('ok')].join('\r\n'));
  assert.deepEqual(messages, [{ id: 'm1', who: 'person', text: 'ok' }]);
  assert.deepEqual(left, { 'not-json': 1, 'not-a-record': 1, 'line-too-long': 1, 'no-message': 1 });
});

test('a message keeps at most MOST_TEXT, and the cut is counted', () => {
  const { messages, left } = readSession(person('y'.repeat(MOST_TEXT + 10)));
  assert.equal(messages[0].text.length, MOST_TEXT);
  assert.equal(left['text-cut'], 1);
});

test('past MOST_MESSAGES a message is counted, not kept', () => {
  const reader = sessionReader();
  for (let n = 0; n <= MOST_MESSAGES; n++) reader.add(n % 2 ? assistant([text(`a${n}`)]) : person(`p${n}`));
  const { messages, left } = reader.result();
  assert.equal(messages.length, MOST_MESSAGES);
  assert.equal(left['over-most-messages'], 1);
});

test('reads no inherited fields: a record that only inherits a type is no message', () => {
  const reader = sessionReader();
  reader.add('{"__proto__":{"type":"user","message":{"content":"x"}}}');
  assert.deepEqual(reader.result().messages, []);
});

test('takes one line of text at a time, and says so otherwise', () => {
  assert.throws(() => sessionReader().add(42), /one line of the session file/);
  assert.throws(() => readSession(null), /session file's text/);
});

test('what it reads is a conversation the storyboard door takes', () => {
  const { messages } = readSession([person('We measured 40 ms.'), assistant([text('40 ms is under the 50 ms budget.')])].join('\n'));
  assert.doesNotThrow(() => storyboardBrief('what-we-found', { conversation: messages }));
});

test('the result is frozen', () => {
  const result = readSession(person('hi'));
  assert.ok(Object.isFrozen(result) && Object.isFrozen(result.messages) && Object.isFrozen(result.messages[0]) && Object.isFrozen(result.left));
});
