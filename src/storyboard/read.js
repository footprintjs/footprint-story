/**
 * The door's one rule: a storyboard is plain data on a named shape, and reading it gives scenes both tools can draw. It
 * names every problem at once, so whoever wrote it fixes them in one pass. No text here is trusted: whoever draws a scene
 * escapes it as text.
 */
import { fieldReader, deepFreeze } from './fields.js';
import { MOST } from './words.js';
import { readConversation } from './conversation.js';
import { toldTwice } from './toldTwice.js';
import { whatWeFound } from './whatWeFound.js';

const SHAPES = Object.freeze({ [toldTwice.name]: toldTwice, [whatWeFound.name]: whatWeFound });
const SHARED = ['shape', 'title', 'subtitle', 'lang'];
const OWN = { 'told-twice': ['analogy', 'intro', 'items', 'flow', 'together', 'remember', 'closing', 'labels'], 'what-we-found': ['intro', 'checked', 'found', 'unsure', 'next', 'closing', 'labels'] };

/** The shapes there are, for whoever is about to write one: [{name, about, fills}]. `fills` is a worked outline of its fields. */
export const storyShapes = () => Object.values(SHAPES).map(({ name, about, fills }) => ({ name, about, fills }));


/** What reading finds: {board, problems}. `board` only when there are no problems. */
function readAll(raw, { conversation } = {}) {
  const f = fieldReader();
  let parsed = raw;
  if (typeof raw === 'string') {
    try { parsed = JSON.parse(raw); } catch (e) { return { board: null, problems: [{ at: 'storyboard', message: `is not valid JSON: ${e.message}` }] }; }
  }
  const known = Object.keys(SHAPES), name = parsed !== null && typeof parsed === 'object' && Object.hasOwn(parsed, 'shape') ? parsed.shape : undefined;
  if (typeof name !== 'string' || !Object.hasOwn(SHAPES, name)) return { board: null, problems: [{ at: 'shape', message: `must be one of ${known.join(', ')}` }] };
  const input = f.object(parsed, '', [...SHARED, ...OWN[name]]);
  const base = { title: f.text(input, 'title', '', { most: MOST.title }), subtitle: f.text(input, 'subtitle', '', { most: MOST.subtitle, optional: true }), lang: f.text(input, 'lang', '', { most: 20, optional: true }) };
  const sources = conversation ? readConversation(conversation) : null;
  const drawn = SHAPES[name].read(f, input, base, sources);
  if (f.problems.length) return { board: null, problems: f.problems };
  return { board: deepFreeze({ shape: name, ...base, verified: Boolean(sources), ...drawn }), problems: [] };
}

/** Every problem in a storyboard, [{at, message}]; [] when it can be drawn. Never throws on what it is given to read. `conversation`: the messages its claims cite, [{id, text}]. */
export const storyboardProblems = (input, options) => readAll(input, options).problems;

/**
 * A storyboard read: frozen {shape, title, subtitle, lang, verified, labels, scenes, …}. Each scene is {id, part, look, title,
 * narration, beat}: `title` and `narration` make it a scene of a film's storyboard as they are, and `beat` says what happens.
 * Throws when it cannot be drawn, its `problems` listing all of them. `verified`: whether its claims were checked against a conversation.
 */
export function readStoryboard(input, options) {
  const { board, problems } = readAll(input, options);
  if (board) return board;
  const list = problems.map((p) => `${p.at ? `${p.at} ` : ''}${p.message}`);
  throw Object.assign(new TypeError(`this storyboard has ${list.length} problem${list.length === 1 ? '' : 's'}:\n- ${list.join('\n- ')}`), { problems });
}
