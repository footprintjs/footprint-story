/**
 * told-twice: one picture, told twice. A cast of people and everyday things acts a system out, each turns into the real
 * thing where it stood, then the same story runs again for real. Written once, so the two tellings cannot drift: every
 * real moment is the same moment as a story one, by construction.
 */
import { MOST, isSafeId, readLabels, saysName } from './words.js';
import { deepFreeze } from './fields.js';

const LABELS = Object.freeze({ story: 'The story', turn: 'The turn', real: 'The real thing', remember: 'To remember' });
const WHO = { name: 20, line: 36 };   // what fits a piece in a row of five

function readWho(f, value, at) {
  const who = f.object(value, at, ['name', 'line', 'icon']);
  if (!who) return { name: null, line: null, icon: null };
  return { name: f.text(who, 'name', at, { most: WHO.name }), line: f.text(who, 'line', at, { most: WHO.line }), icon: f.text(who, 'icon', at, { most: MOST.icon, optional: true }) };
}

function readTold(f, value, at) {
  const told = f.object(value, at, ['headline', 'notes']);
  return told ? { title: f.text(told, 'headline', at, { most: MOST.headline }), narration: f.text(told, 'notes', at, { most: MOST.notes }) } : { title: null, narration: null };
}

function readItem(f, value, i, seen) {
  const at = `items[${i}]`, item = f.object(value, at, ['id', 'cast', 'real', 'turn']);
  if (!item) return null;
  const safe = isSafeId(item.id);
  if (!safe) f.say(`${at}.id`, 'must be lower case letters, digits and dashes');
  else if (seen.has(item.id)) f.say(`${at}.id`, `is "${item.id}" again: each item has an id of its own`);
  else seen.add(item.id);
  const cast = readWho(f, item.cast, `${at}.cast`), real = readWho(f, item.real, `${at}.real`);
  const turn = f.object(item.turn, `${at}.turn`, ['headline', 'callout', 'notes']);
  const callout = turn ? f.text(turn, 'callout', `${at}.turn`, { most: MOST.callout }) : null;
  for (const who of [cast, real]) {
    if (callout && who.name && !saysName(callout, who.name)) f.say(`${at}.turn.callout`, `must say both names, so the reader can tie them together, and it does not say "${who.name}"`);
  }
  return { id: safe ? item.id : null, cast, real, callout, title: turn ? f.text(turn, 'headline', `${at}.turn`, { most: MOST.headline }) : null, narration: turn ? f.text(turn, 'notes', `${at}.turn`, { most: MOST.notes }) : null };
}

/** A moment of the flow: its path along the row of items, what is called on each hop, and its words in each telling. */
function readMoment(f, value, i, order) {
  const at = `flow[${i}]`, moment = f.object(value, at, ['path', 'calls', 'story', 'real']);
  if (!moment) return null;
  const path = [...f.list(moment, 'path', at, { least: 1, most: 8 })], calls = f.list(moment, 'calls', at, { most: 7, optional: true });
  path.forEach((id, k) => {
    if (!order.includes(id)) f.say(`${at}.path[${k}]`, `is not an item (they are ${order.join(', ')})`);
    else if (k && id === path[k - 1]) f.say(`${at}.path[${k}]`, `goes from "${id}" to itself`);
    else if (k && order.includes(path[k - 1]) && Math.abs(order.indexOf(id) - order.indexOf(path[k - 1])) !== 1) f.say(`${at}.path[${k}]`, `goes from "${path[k - 1]}" to "${id}", which do not stand next to each other: items stand in one row, in the order written`);
  });
  if (calls.length && path.length && calls.length !== path.length - 1) f.say(`${at}.calls`, `has ${calls.length}, and this path has ${path.length - 1} hop${path.length === 2 ? '' : 's'}: one call per hop`);
  const called = calls.map((_, k) => f.text(calls, k, `${at}.calls`, { most: MOST.call }));
  return { path, calls: called, story: readTold(f, moment.story, `${at}.story`), real: readTold(f, moment.real, `${at}.real`) };
}

export const toldTwice = Object.freeze({
  name: 'told-twice',
  about: 'A cast of people and everyday things acts a system out, each turns into the real thing where it stood, then the same story runs again for real. For explaining a system to people who do not work on it.',
  fills: deepFreeze({
    shape: 'told-twice', title: 'One picture, told twice', subtitle: '(optional)', analogy: 'a café stands in for a web service', intro: 'what is said on the title',
    items: [{ id: 'customer', cast: { name: 'Customer', line: 'wants a coffee', icon: 'person-asking' }, real: { name: 'Browser', line: 'asks for a page', icon: 'window' },
      turn: { headline: 'The customer turns into the browser', callout: 'The customer is the browser: it asks, then waits', notes: 'what is said' } }, '… 2 or more, in the row they stand in'],
    flow: [{ path: ['customer', 'cashier'], calls: ['GET /order'], story: { headline: 'They tell the cashier', notes: 'what is said' }, real: { headline: 'It sends a request to the API', notes: 'what is said' } }, '… every item acts'],
    together: { headline: '(optional) a last turn showing them all', notes: 'what is said' }, remember: ['2 to 4 things to remember'], closing: 'what is said at the end',
    labels: { story: 'The café', turn: '…', real: '…', remember: '…' },
  }),

  read(f, input, base) {
    const seen = new Set(), items = f.list(input, 'items', '', { least: 2, most: 8 }).map((v, i) => readItem(f, v, i, seen)).filter(Boolean);
    const order = items.map((it) => it.id).filter(Boolean), flow = f.list(input, 'flow', '', { least: 1, most: 20 }).map((v, i) => readMoment(f, v, i, order)).filter(Boolean);
    const acting = new Set(flow.flatMap((m) => m.path));
    for (const id of order) if (!acting.has(id)) f.say('flow', `never reaches "${id}": every item acts in the story before it turns`);
    const analogy = f.text(input, 'analogy', '', { most: MOST.analogy }), labels = readLabels(f, input, base.lang, LABELS);
    const together = input.together === undefined ? null : readTold(f, input.together, 'together');
    const points = f.list(input, 'remember', '', { least: 2, most: 4 }).map((_, i, all) => f.text(all, i, 'remember', { most: MOST.point }));
    const intro = f.text(input, 'intro', '', { most: MOST.notes }), closing = f.text(input, 'closing', '', { most: MOST.notes });
    const path = (m, look, k) => ({ id: `${look === 'cast' ? 'story' : 'real'}-${k + 1}`, part: look === 'cast' ? 'story' : 'real', look, ...(look === 'cast' ? m.story : m.real), beat: { kind: 'path', path: m.path, calls: look === 'cast' ? [] : m.calls } });
    return {
      analogy, labels,
      items: items.map(({ id, cast, real }) => ({ id, cast, real })),
      scenes: [
        { id: 'title', part: 'title', look: 'cast', title: base.title, narration: intro, beat: { kind: 'title', subtitle: base.subtitle } },
        ...flow.map((m, k) => path(m, 'cast', k)),
        ...items.map((it) => ({ id: `turn-${it.id}`, part: 'turn', look: 'cast', title: it.title, narration: it.narration, beat: { kind: 'turn', item: it.id, callout: it.callout } })),
        ...(together ? [{ id: 'together', part: 'turn', look: 'cast', ...together, beat: { kind: 'together' } }] : []),
        ...flow.map((m, k) => path(m, 'real', k)),
        { id: 'remember', part: 'remember', look: 'real', title: labels.remember, narration: closing, beat: { kind: 'points', points } },
      ],
    };
  },
});
