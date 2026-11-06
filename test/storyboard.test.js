import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { readStoryboard, storyboardProblems, storyShapes, numbersIn } from '../storyboard.js';

const told = (over = {}) => ({
  shape: 'told-twice', title: 'One picture', analogy: 'a café stands in for a web service', intro: 'We tell it twice.', closing: 'Remember the café.',
  items: [
    { id: 'customer', cast: { name: 'Customer', line: 'wants a coffee', icon: 'person-asking' }, real: { name: 'Browser', line: 'asks', icon: 'window' }, turn: { headline: 'It turns', callout: 'The customer is the browser', notes: 'Said.' } },
    { id: 'cashier', cast: { name: 'Cashier', line: 'takes it' }, real: { name: 'API', line: 'takes requests' }, turn: { headline: 'It turns too', callout: 'The cashier is the API', notes: 'Said.' } },
  ],
  flow: [{ path: ['customer', 'cashier'], calls: ['GET /order'], story: { headline: 'They ask', notes: 'Said.' }, real: { headline: 'It asks', notes: 'Said.' } }],
  remember: ['One door', 'One way back'], ...over,
});
const found = (over = {}) => ({
  shape: 'what-we-found', title: 'Why it slowed', intro: 'What we found.', closing: 'That is all.',
  checked: [{ what: 'Disk', found: '40% full, not the cause', sources: ['m1'] }],
  found: [{ headline: 'It waits on a lock', line: 'It waited 41 minutes', notes: 'Said.', sources: ['m2'] }],
  unsure: [{ what: 'Whether Tuesday is the same', why: 'no logs from then' }],
  next: ['Fix the lock'], ...over,
});
const found_ = found;
const CHAT = [{ id: 'm1', text: 'disk at 40 percent' }, { id: 'm2', who: 'agent', text: 'waited 41 minutes on 1,250 rows' }];
const ats = (input, options) => storyboardProblems(input, options).map((p) => p.at);

test('a told-twice board gives the story, the turn, the real telling and what to remember, in order', () => {
  const board = readStoryboard(told());
  assert.deepEqual(board.scenes.map((s) => s.id), ['title', 'story-1', 'turn-customer', 'turn-cashier', 'real-1', 'remember']);
  assert.deepEqual(board.scenes.map((s) => s.look), ['cast', 'cast', 'cast', 'cast', 'real', 'real']);
  assert.deepEqual(board.scenes[1].beat, { kind: 'path', path: ['customer', 'cashier'], calls: [] });
  assert.deepEqual(board.scenes[4].beat, { kind: 'path', path: ['customer', 'cashier'], calls: ['GET /order'] });
  assert.equal(board.scenes[1].title, 'They ask');
  assert.equal(board.scenes[4].title, 'It asks');
  assert.equal(board.labels.turn, 'The turn');
  assert.equal(board.items[1].cast.icon, null);
  assert.equal(board.verified, false);
  assert.ok(Object.isFrozen(board.scenes[1].beat.path));
});

test('every scene is a scene of a film\'s storyboard as it is: an id, a title and what is said', () => {
  for (const board of [readStoryboard(told()), readStoryboard(found())]) {
    for (const s of board.scenes) {
      assert.match(s.id, /^[a-z0-9-]+$/);
      assert.equal(typeof s.title, 'string');
      assert.equal(typeof s.narration, 'string');
    }
  }
});

test('a together click joins the turn only when it is written', () => {
  const board = readStoryboard(told({ together: { headline: 'All of them', notes: 'Said.' } }));
  assert.deepEqual(board.scenes.map((s) => s.id).slice(3, 5), ['turn-cashier', 'together']);
});

test('it names every problem at once, each at its place', () => {
  const bad = told({ title: '', items: [{ id: 'A B' }, told().items[1]], flow: [{ path: ['nope'] }], remember: ['one'], extra: 1 });
  const problems = ats(bad);
  for (const at of ['title', 'extra', 'items[0].id', 'items[0].cast', 'items[0].real', 'items[0].turn', 'flow[0].path[0]', 'flow[0].story', 'flow[0].real', 'remember']) {
    assert.ok(problems.includes(at), `${at} is not among ${problems.join(', ')}`);
  }
});

test('reading throws the whole list, keeping the problems as data', () => {
  assert.throws(() => readStoryboard(told({ title: '', closing: '' })), (e) => {
    assert.match(e.message, /^this storyboard has 2 problems:\n- title must be text with something in it\n- closing must be text/);
    assert.deepEqual(e.problems.map((p) => p.at), ['title', 'closing']);
    return true;
  });
  assert.throws(() => readStoryboard(told({ closing: undefined, title: 'x'.repeat(91) })), /this storyboard has 2 problems/);
  assert.throws(() => readStoryboard(told({ title: 'x'.repeat(91) })), /this storyboard has 1 problem:\n- title is 91 characters, and 90 is the most/);
});

test('it refuses a shape it does not have, naming the ones it does, and JSON it cannot read', () => {
  assert.deepEqual(storyboardProblems({ shape: 'nope' }), [{ at: 'shape', message: 'must be one of told-twice, what-we-found' }]);
  assert.deepEqual(ats({ shape: 'constructor' }), ['shape']);
  assert.deepEqual(ats(null), ['shape']);
  assert.match(storyboardProblems('{oops')[0].message, /is not valid JSON/);
  assert.equal(readStoryboard(JSON.stringify(told())).shape, 'told-twice');
});

test('a key it does not know is named with the ones there are, a __proto__ too', () => {
  const [problem] = storyboardProblems(JSON.parse(JSON.stringify(told()).replace('"title"', '"__proto__":{"x":1},"title"')));
  assert.equal(problem.at, '__proto__');
  assert.match(problem.message, /is not a field here \(the fields are shape, title, subtitle, lang, analogy/);
  assert.deepEqual(ats(told({ items: [{ ...told().items[0], oops: 1 }, told().items[1]] })), ['items[0].oops']);
});

test('told-twice: a turn must say both names, as whole words', () => {
  const items = told().items;
  const said = (callout) => told({ items: [{ ...items[0], turn: { ...items[0].turn, callout } }, items[1]] });
  assert.equal(storyboardProblems(said('The CUSTOMER is the browser')).length, 0);
  assert.match(storyboardProblems(said('It is the browser'))[0].message, /must say both names.*"Customer"/);
  const rapid = told({ items: [items[0], { ...items[1], turn: { ...items[1].turn, callout: 'The cashier is rapid' } }] });
  assert.match(storyboardProblems(rapid)[0].message, /does not say "API"/);
});

test('told-twice: a hop is between neighbours, a call per hop, and every item acts', () => {
  const three = [...told().items, { ...told().items[1], id: 'barista', cast: { name: 'Barista', line: 'makes' }, real: { name: 'App', line: 'works' }, turn: { headline: 'Turns', callout: 'The barista is the app', notes: 'Said.' } }];
  const moment = { story: { headline: 'a', notes: 'b' }, real: { headline: 'a', notes: 'b' } };
  const jump = storyboardProblems(told({ items: three, flow: [{ path: ['customer', 'barista'], ...moment }, { path: ['cashier'], ...moment }] }));
  assert.match(jump[0].message, /goes from "customer" to "barista", which do not stand next to each other/);
  assert.match(storyboardProblems(told({ flow: [{ path: ['customer', 'cashier'], calls: ['a', 'b'], ...moment }] }))[0].message, /has 2, and this path has 1 hop: one call per hop/);
  assert.match(storyboardProblems(told({ flow: [{ path: ['customer'], ...moment }] }))[0].message, /never reaches "cashier"/);
  assert.match(storyboardProblems(told({ items: [told().items[0], told().items[0]] }))[0].message, /is "customer" again/);
});

test('a part\'s labels can be its own; a story in another language must give them', () => {
  assert.equal(readStoryboard(told({ labels: { story: 'The café' } })).labels.story, 'The café');
  assert.equal(readStoryboard(told({ lang: 'en-GB' })).labels.story, 'The story');
  assert.equal(readStoryboard(told({ lang: 'en_US' })).labels.story, 'The story');
  const asked = storyboardProblems(told({ lang: 'fr', labels: { story: 'Le café' } }));
  assert.deepEqual(asked.map((p) => p.at), ['labels.turn', 'labels.real', 'labels.remember']);
  assert.match(asked[0].message, /this story is in "fr", and the label is "The turn" in English/);
  assert.equal(readStoryboard(found({ lang: 'fr', labels: { checked: 'a', found: 'b', unsure: 'c', next: 'd' } })).labels.next, 'd');
});

test('what-we-found gives what was checked, found, not known and next, in that order', () => {
  const board = readStoryboard(found());
  assert.deepEqual(board.scenes.map((s) => s.id), ['title', 'checked-1', 'found-1', 'unsure-1', 'next']);
  assert.deepEqual(board.scenes[1].beat, { kind: 'card', group: 'checked', tone: null, name: 'Disk', line: '40% full, not the cause', sources: ['m1'] });
  assert.equal(board.scenes[1].narration, 'Disk: 40% full, not the cause');
  assert.deepEqual(board.scenes[2].beat, { kind: 'card', group: 'found', tone: 'ok', name: 'It waited 41 minutes', line: null, sources: ['m2'] });
  assert.equal(board.scenes[3].beat.tone, 'warn');
  assert.equal(board.scenes[3].title, 'Whether Tuesday is the same');
  assert.equal(board.scenes[3].beat.name, 'no logs from then');
  assert.equal(readStoryboard(found({ checked: [{ what: 'Disk', found: 'fine', notes: 'Own words.' }] })).scenes[1].narration, 'Own words.');
});

test('what-we-found: "not sure" must be written, even empty, so a story cannot sound surer than the work was', () => {
  const { unsure, ...rest } = found();
  assert.deepEqual(ats(rest), ['unsure']);
  assert.deepEqual(readStoryboard(found({ unsure: [] })).scenes.map((s) => s.part), ['title', 'checked', 'found', 'next']);
});

test('with a conversation, each claim cites a message that is there and says its numbers', () => {
  assert.equal(readStoryboard(found(), { conversation: CHAT }).verified, true);
  assert.deepEqual(ats(found({ checked: [{ what: 'Disk', found: 'fine' }] }), { conversation: CHAT }), ['checked[0].sources']);
  assert.match(storyboardProblems(found({ found: [{ headline: 'Lock', line: 'a', notes: 'n', sources: ['m9'] }] }), { conversation: CHAT })[0].message, /names "m9", which the conversation does not have/);
  const wrong = storyboardProblems(found({ found: [{ headline: 'It waited 42 minutes', line: 'a', notes: 'n', sources: ['m2'] }] }), { conversation: CHAT });
  assert.match(wrong[0].message, /says 42, which none of its sources \(m2\) says/);
  assert.equal(storyboardProblems(found({ found: [{ headline: 'On 1250 rows', line: 'a', notes: 'n', sources: ['m2'] }] }), { conversation: CHAT }).length, 0);
  assert.match(storyboardProblems(found({ checked: [{ what: 'Disk', found: '41% full', sources: ['m1'] }] }), { conversation: CHAT })[0].message, /says 41/);
});

test('without a conversation nothing can be checked, and the board says so', () => {
  const board = readStoryboard(found({ found: [{ headline: 'It waited 42 minutes', line: 'a', notes: 'n' }] }));
  assert.equal(board.verified, false);
});

test('a conversation it cannot use is the app\'s mistake, and throws', () => {
  assert.throws(() => storyboardProblems(found(), { conversation: 'text' }), /a list of messages/);
  assert.throws(() => storyboardProblems(found(), { conversation: [{ text: 'x' }] }), /message 0: id/);
  assert.throws(() => storyboardProblems(found(), { conversation: [{ id: 'a' }] }), /message 0 \("a"\): text/);
  assert.throws(() => storyboardProblems(found(), { conversation: [{ id: 'a', text: '' }, { id: 'a', text: '' }] }), /two messages have the id "a"/);
  assert.throws(() => storyboardProblems(found(), { conversation: Array.from({ length: 5001 }, (_, i) => ({ id: `${i}`, text: '' })) }), /too long/);
});

test('numbersIn reads numbers as written, taking commas only from real thousands grouping', () => {
  assert.deepEqual(numbersIn('1,250.5 ms, 90%, EC2, 3.5 and 3.5'), ['1250.5', '90', '2', '3.5']);
  assert.deepEqual(numbersIn('none'), []);
  assert.deepEqual(numbersIn('1,250,000'), ['1250000']);
  assert.deepEqual(numbersIn('3,5 and 1,2,3 and 12,34,567'), ['3,5', '1,2,3', '12,34,567']);
  assert.deepEqual(numbersIn('\uFF14\uFF12 and \u0664\u0662'), ['42', '\u0664\u0662']);
});

test('a number it cannot compare fails the check, and never slips through', () => {
  const check = (board, text) => storyboardProblems(board, { conversation: [{ id: 'm1', text }] }).filter((p) => p.at === 'found[0]').length;
  const claim = (line) => ({ ...found_(), found: [{ headline: 'H', line, notes: 'n', sources: ['m1'] }] });
  assert.equal(check(claim('It took 3,5 hours'), 'it took 35 hours'), 1);
  assert.equal(check(claim('It took 35 hours'), 'it took 3,5 hours'), 1);
  assert.equal(check(claim('It took \u0664\u0662 hours'), 'it took 7 hours'), 1);
  assert.equal(check(claim('It took \uFF14\uFF12 hours'), 'it took 42 hours'), 0);
});

test('verified means its claims were checked: told-twice makes none, and says so even when given a conversation', () => {
  assert.equal(readStoryboard(told(), { conversation: CHAT }).verified, false);
  assert.equal(readStoryboard(found(), { conversation: CHAT }).verified, true);
});

test('with a conversation, what is said is checked as much as what is shown', () => {
  const problem = (over) => storyboardProblems(found(over), { conversation: CHAT });
  assert.deepEqual(problem({ found: [{ headline: 'Lock', line: 'a', notes: 'It took 99 minutes', sources: ['m2'] }] }).map((p) => p.at), ['found[0]']);
  assert.deepEqual(problem({ checked: [{ what: 'Disk', found: 'fine', notes: 'Used 99 of it', sources: ['m1'] }] }).map((p) => p.at), ['checked[0]']);
  for (const [field, value, at] of [['title', 'Down 99', 'title'], ['subtitle', '99 nights', 'subtitle'], ['intro', '99 of them', 'intro'], ['closing', '99 more', 'closing'], ['next', ['Fix 99'], 'next[0]']]) {
    const [p] = problem({ [field]: value });
    assert.equal(p.at, at);
    assert.match(p.message, /says 99, which the conversation never says/);
  }
  assert.equal(problem({ unsure: [{ what: 'Tuesday', why: 'only 99 logs' }] })[0].at, 'unsure[0]');
  assert.equal(problem({ intro: 'From 41 minutes down', title: 'At 40 percent' }).length, 0);
});

test('a path that names something other than an item is a problem, whatever it is', () => {
  const moment = { story: { headline: 'a', notes: 'b' }, real: { headline: 'a', notes: 'b' } };
  for (const id of [1n, Symbol('x'), {}, null, 7]) {
    const [p] = storyboardProblems(told({ flow: [{ path: ['customer', id, 'cashier'], ...moment }] }));
    assert.equal(p.at, 'flow[0].path[1]');
    assert.match(p.message, /is not an item/);
  }
});

test('reading leaves what it was given alone, and hands out nothing shared with it', () => {
  const input = told(), board = readStoryboard(input);
  assert.ok(!Object.isFrozen(input.flow[0].path));
  assert.notEqual(board.scenes[1].beat.path, input.flow[0].path);
  input.flow[0].path.push('x');
  assert.deepEqual(board.scenes[1].beat.path, ['customer', 'cashier']);
});

test('the outlines cannot be edited by whoever reads them', () => {
  assert.throws(() => storyShapes()[0].fills.items.push('x'), TypeError);
  assert.throws(() => storyShapes()[1].fills.checked.push('x'), TypeError);
});

test('a script with no spaces says a name as it writes it; a spaced one needs the whole word', () => {
  const items = told().items;
  const cjk = told({ items: [{ ...items[0], cast: { name: '客', line: 'x' }, real: { name: 'ブラウザ', line: 'y' }, turn: { ...items[0].turn, callout: '客はブラウザです' } }, items[1]] });
  assert.deepEqual(storyboardProblems(cjk), []);
  const thai = told({ items: [{ ...items[0], cast: { name: 'ลูกค้า', line: 'x' }, real: { name: 'Browser', line: 'y' }, turn: { ...items[0].turn, callout: 'ลูกค้าคือ Browser' } }, items[1]] });
  assert.deepEqual(storyboardProblems(thai), []);
  assert.match(storyboardProblems(told({ items: [{ ...items[0], turn: { ...items[0].turn, callout: 'Customers are the browser' } }, items[1]] }))[0].message, /does not say "Customer"/);
});

test('nothing inherited counts as written', () => {
  const input = Object.assign(Object.create({ labels: { story: 5 } }), told());
  assert.deepEqual(storyboardProblems(input), []);
  const item = Object.assign(Object.create({ cast: { name: 'Inherited', line: 'x' } }), { id: 'a', real: { name: 'B', line: 'y' }, turn: told().items[0].turn });
  assert.ok(ats(told({ items: [item, told().items[1]] })).includes('items[0].cast'));
});

test('one mistake is reported once, and messages stay sensible', () => {
  const moment = { story: { headline: 'a', notes: 'b' }, real: { headline: 'a', notes: 'b' } };
  const bad = storyboardProblems(told({ items: [{ ...told().items[0], id: 'A B' }, told().items[1]], flow: [{ path: ['cashier'], ...moment }] }));
  assert.deepEqual(bad.map((p) => p.at), ['items[0].id']);
  assert.ok(!ats(told({ flow: [{ calls: ['a'], ...moment }] })).includes('flow[0].calls'));
  assert.match(storyboardProblems(told({ flow: [{ path: ['customer', 'customer', 'cashier'], ...moment }] }))[0].message, /goes from "customer" to itself/);
  assert.equal(storyboardProblems(told({ flow: [{ path: ['x'.repeat(100000)], ...moment }] }))[0].message.length < 200, true);
});

test('what comes back stays short, however much is wrong', () => {
  const noisy = Object.fromEntries(Array.from({ length: 100 }, (_, i) => [`k${i}`, 1]));
  const problems = storyboardProblems({ ...told(), ...noisy });
  assert.equal(problems.length, 41);
  assert.equal(problems[40].message, 'and 60 more: fix these first');
  assert.equal(storyboardProblems({ ...told(), ['y'.repeat(5000)]: 1 })[0].at.length, 41);
});

test('what is not plain data is a problem, never an exception', () => {
  const hostile = { ...told(), get title() { throw new Error('boom'); } };
  assert.deepEqual(storyboardProblems(hostile), [{ at: 'storyboard', message: 'could not be read: it must be plain data' }]);
  const list = Object.assign([], { shape: 'told-twice' });
  assert.equal(storyboardProblems(list)[0].at, '');
  assert.match(storyboardProblems(list)[0].message, /must be an object/);
  assert.throws(() => readStoryboard(hostile), /could not be read/);
});

test('the shapes say what they are for and how to fill them, and each outline names only fields the shape takes', () => {
  const shapes = storyShapes();
  assert.deepEqual(shapes.map((s) => s.name), ['told-twice', 'what-we-found']);
  for (const s of shapes) {
    assert.ok(s.about.length > 40);
    const fieldProblems = storyboardProblems({ ...s.fills }).filter((p) => /is not a field here/.test(p.message));
    assert.deepEqual(fieldProblems.filter((p) => !p.at.startsWith('items[1]') && !p.at.startsWith('flow[1]') && !p.at.startsWith('unsure[1]')), []);
  }
});

test('it holds lists to a size a story can show', () => {
  assert.match(storyboardProblems(told({ flow: Array(21).fill(told().flow[0]) }))[0].message, /has 21, and 20 is the most/);
  assert.match(storyboardProblems(told({ items: 'x' }))[0].message, /must be a list/);
});

test('it never throws on what it is given to read, whatever that is', () => {
  fc.assert(fc.property(fc.anything(), (junk) => { assert.ok(Array.isArray(storyboardProblems(junk))); }));
  const leaves = fc.oneof(fc.string(), fc.integer(), fc.constant(null), fc.array(fc.string()), fc.dictionary(fc.string(), fc.string()));
  fc.assert(fc.property(fc.constantFrom(told(), found()), fc.constantFrom('title', 'items', 'flow', 'checked', 'found', 'unsure', 'next', 'remember', 'labels', 'together'), leaves, (good, key, value) => {
    assert.ok(Array.isArray(storyboardProblems({ ...good, [key]: value })));
  }));
});
