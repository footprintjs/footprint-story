// voice/ — the clip key, the cache and the Chatterbox kit adapter (StoryDeck 0.2.0's voice.test.js, moved; its
// embedClips cases stay in StoryDeck). The four key goldens are the keys of clips a real deck has: they never change.
import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { clipKey, clipFor, pickSteps, voiceClips, chatterboxKit } from '../voice.js';
import { autoRules, spokenMap } from '../index.js';

// The settings of a real profile (no audio): its keys must keep matching the clips a deck already has.
const PROFILE = {
  id: 'me', exaggeration: 0.5, cfgWeight: 0.5, seed: 7, sentenceGapSeconds: 0.3,
  takes: { 'The end.': { seed: 17114, note: 'default take came out clipped (0.24 s, letters 0.0); this take scored minWord 0.93, letters 1.0' } },
};

// [what the deck's note says (written), what the voice says (spoken, as StoryDeck 0.2.0 said it), the clip's key]
const GOLDEN = [
  ['To give the agent a ledger in the UI, we first need to see how the UI works today. So let’s start with what we already have.',
    'To give the agent a ledger in the U I, we first need to see how the U I works today. So let’s start with what we already have.', '6601f43cc082'],
  ['The second design lets the page offer its own tools. It’s called WebMCP. MCP is a direct API connection for the AI; WebMCP puts that inside the web page. It’s a proposal from engineers at Google and Microsoft, and the details are still changing, so let’s look at the design.',
    'The second design lets the page offer its own tools. It’s called WebMCP. MCP is a direct A P I connection for the AI; WebMCP puts that inside the web page. It’s a proposal from engineers at Google and Microsoft, and the details are still changing, so let’s look at the design.', 'bb591fd40fa1'],
  ['Which brings me to the central challenge: when is an action complete? Answer that, and Action Binding falls out. To give the agent a “done” signal, we first need to see why apps lost it. So, a short history of the web, in three steps, from about 2000 to today.',
    'Which brings me to the central challenge: when is an action complete? Answer that, and Action Binding falls out. To give the agent a “done” signal, we first need to see why apps lost it. So, a short history of the web, in three steps, from about two thousand to today.', '735cd41dbbe4'],
  ['Now put an LLM in your place. Its tools are its books. It picks which to call, sometimes sure, sometimes on a hunch. So where is its ledger?',
    'Now put an LLM in your place. Its tools are its books. It picks which to call, sometimes sure, sometimes on a hunch. So where is its ledger?', '603dfe55ab88'],
];

let dir;
beforeEach(() => { dir = mkdtempSync(path.join(tmpdir(), 'fn-voice-')); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

test('the key: the keys of clips voiced before stay (a deck\'s 198 clips must still match)', () => {
  const rules = autoRules();
  for (const [written, spoken, key] of GOLDEN) {
    assert.equal(clipKey(spoken, PROFILE), key);
    assert.equal(spokenMap(written, { rules }).spoken, spoken, 'what the rules say for the note');
  }
});

test('the key changes with the words and with the voice settings, not with fields outside the recipe', () => {
  const k = clipKey('Hello.', PROFILE);
  assert.notEqual(clipKey('Hello!', PROFILE), k);
  assert.notEqual(clipKey('Hello.', { ...PROFILE, seed: 8 }), k);
  assert.equal(clipKey('Hello.', { ...PROFILE, description: 'anything', consent: true }), k);
  assert.match(clipKey('Hello.', { id: 'me' }), /^[0-9a-f]{12}$/);
});

test('the cache finds a clip (its .wav, else its .m4a) and nothing for a text not voiced or empty; a clip from before keeps no words', () => {
  const key = clipKey('Hi.', PROFILE);
  writeFileSync(path.join(dir, `${key}.json`), JSON.stringify({ text: 'Hi.', duration: 1.5, sentences: [0.1] }));
  writeFileSync(path.join(dir, `${key}.m4a`), 'm4a');
  assert.deepEqual(clipFor('Hi.', { cache: dir, profile: PROFILE }), { key, audio: path.join(dir, `${key}.m4a`), duration: 1.5, sentences: [0.1], words: null, take: null });
  writeFileSync(path.join(dir, `${key}.wav`), 'wav');
  assert.equal(clipFor('Hi.', { cache: dir, profile: PROFILE }).audio, path.join(dir, `${key}.wav`));
  assert.equal(clipFor('Other.', { cache: dir, profile: PROFILE }), null);
  assert.equal(clipFor('', { cache: dir, profile: PROFILE }), null);
});

test('which steps to work on', () => {
  assert.deepEqual(pickSteps('1-3,7'), new Set([1, 2, 3, 7]));
  assert.deepEqual(pickSteps(' 4 - 5 , 9'), new Set([4, 5, 9]));
  assert.deepEqual(pickSteps(12), new Set([12]));
  for (const all of ['', ' ', undefined, null]) assert.equal(pickSteps(all), null);
  for (const bad of ['a', '3-1', '0', '1,,2', '1-2-3']) assert.throws(() => pickSteps(bad), /is not a step \(1 or more\) or a range of steps like 1-3/);
});

/** A fake engine: writes a file per scene, times its words evenly, and remembers what it was asked. */
const fakeEngine = () => {
  const calls = [];
  return {
    calls, name: 'fake',
    synthesize(scenes, { work }) {
      calls.push(scenes.map((s) => s.text));
      return scenes.map((s) => {
        const audio = path.join(work, `${s.id}.wav`);
        writeFileSync(audio, `audio of ${s.text}`);
        return { id: s.id, audio, duration: s.text.length / 10, words: s.text.split(/\s+/).map((t, i) => ({ text: t, start: i * 0.5, end: i * 0.5 + 0.4, score: 0.9 })) };
      });
    },
  };
};

test('voicing: only what is not cached, once per text, in batches, each cached as it is done — with its words', async () => {
  const cache = path.join(dir, 'cache'), engine = fakeEngine(), lines = [];
  const texts = ['One. Two.', '', 'Three.', 'One. Two.', 'Four.', 'Five.', 'Six.'];
  const done = await voiceClips(texts, { cache, profile: PROFILE, engine, batch: 2, work: path.join(dir, 'work'), log: (l) => lines.push(l) });
  assert.deepEqual(done, { wanted: 6, todo: 5, voiced: 5 });
  assert.deepEqual(engine.calls, [['One. Two.', 'Three.'], ['Four.', 'Five.'], ['Six.']]);
  const clip = clipFor('One. Two.', { cache, profile: PROFILE });
  assert.equal(clip.duration, 0.9);
  assert.deepEqual(clip.sentences, [0, 0.5]);
  assert.deepEqual(clip.words, [{ text: 'One.', start: 0, end: 0.4 }, { text: 'Two.', start: 0.5, end: 0.9 }], 'the words the aligner timed, without the engine\'s extras');
  assert.equal(readFileSync(clip.audio, 'utf8'), 'audio of One. Two.');
  assert.equal(lines[0], '6 clips wanted · 5 to voice · the rest are cached');
  assert.equal(lines.at(-1), 'clips cached: 5/5');
  assert.equal((await voiceClips(texts, { cache, profile: PROFILE, engine, work: path.join(dir, 'work') })).voiced, 0, 'a second run voices nothing');
  texts[4] = 'Four, edited.';
  await voiceClips(texts, { cache, profile: PROFILE, engine, work: path.join(dir, 'work') });
  assert.deepEqual(engine.calls.at(-1), ['Four, edited.'], 'an edited text voices that one alone');
});

test('voicing: the picked steps only, by default in a temporary folder of its own, removed afterwards', async () => {
  const cache = path.join(dir, 'cache'), engine = fakeEngine(), works = [];
  const spy = { name: 'spy', synthesize: (scenes, opts) => { works.push(opts.work); return engine.synthesize(scenes, opts); } };
  assert.deepEqual(await voiceClips(['A.', 'B.', 'C.'], { cache, profile: PROFILE, engine: spy, only: new Set([2]) }), { wanted: 3, todo: 1, voiced: 1 });
  assert.deepEqual(engine.calls, [['B.']]);
  assert.ok(works[0].startsWith(tmpdir()) && path.basename(works[0]).startsWith('footprint-story-voice-'));
  assert.equal(existsSync(works[0]), false, 'gone: never a folder beside the cache (a kit\'s reference recording lives there)');
  assert.deepEqual(await voiceClips(['B.'], { cache, profile: PROFILE, engine: spy }), { wanted: 1, todo: 0, voiced: 0 });
  assert.equal(works.length, 1, 'nothing to do: no folder at all');
});

test('voicing: folders relative to where it runs; a batch that is not a whole number of clips is refused', async () => {
  const was = process.cwd();
  process.chdir(dir);
  try {
    await voiceClips(['A.'], { cache: 'rel/cache', profile: PROFILE, engine: fakeEngine(), work: 'rel/work' });
    assert.ok(existsSync(path.join(dir, 'rel', 'cache', `${clipKey('A.', PROFILE)}.json`)));
    assert.ok(existsSync(path.join(dir, 'rel', 'work')), 'a folder you name is yours to keep');
  } finally {
    process.chdir(was);
  }
  for (const batch of [0, -1, 1.5, NaN]) await assert.rejects(voiceClips(['A.'], { cache: dir, profile: PROFILE, engine: fakeEngine(), batch }), RangeError);
});

test('voicing: a page\'s copy of the old take goes when a clip is voiced again; a batch another run voiced is skipped', async () => {
  const cache = path.join(dir, 'cache'), key = clipKey('A.', PROFILE);
  mkdirSync(cache, { recursive: true });
  writeFileSync(path.join(cache, `${key}.m4a`), 'the old take');
  await voiceClips(['A.'], { cache, profile: PROFILE, engine: fakeEngine() });
  assert.equal(existsSync(path.join(cache, `${key}.m4a`)), false);
  const engine = fakeEngine();
  let n = 0;
  const racing = { name: 'race', synthesize(scenes, opts) {   // while voicing the first batch, another run caches the second
    if (n++ === 0) { writeFileSync(path.join(cache, `${clipKey('D.', PROFILE)}.json`), JSON.stringify({ text: 'D.', duration: 1, sentences: [0] })); writeFileSync(path.join(cache, `${clipKey('D.', PROFILE)}.wav`), 'wav'); }
    return engine.synthesize(scenes, opts);
  } };
  const done = await voiceClips(['B.', 'C.', 'D.'], { cache, profile: PROFILE, engine: racing, batch: 2, work: path.join(dir, 'w') });
  assert.deepEqual(engine.calls, [['B.', 'C.']]);
  assert.equal(done.voiced, 2);
});

test('the kit adapter runs the kit on a storyboard and reads its timings, words and all', () => {
  const work = path.join(dir, 'work'), seen = [];
  mkdirSync(work, { recursive: true });
  const words = [{ text: 'Hello', start: 0.1, end: 0.5 }, { text: 'there.', start: 0.6, end: 1 }];
  const run = (cmd, args, opts) => {
    seen.push({ cmd, args, cwd: opts.cwd, offline: opts.env.HF_HUB_OFFLINE });
    writeFileSync(path.join(work, 'timings.json'), JSON.stringify({ scenes: [{ id: 'kabc', audio: 'kabc.wav', duration: 2.5, words }] }));
    return { status: 0 };
  };
  const engine = chatterboxKit({ kit: '/kit', run, env: {} });
  assert.equal(engine.name, 'chatterbox');
  assert.deepEqual(engine.synthesize([{ id: 'kabc', text: 'Hello there.' }], { work }), [{ id: 'kabc', audio: path.join(work, 'kabc.wav'), duration: 2.5, words }]);
  assert.deepEqual(seen[0], { cmd: '/kit/.venv-voice/bin/python', args: ['scripts/voice/tts_chatterbox.py', '--storyboard', path.join(work, 'storyboard.json'), '--profile', 'voices/me.voice.json', '--device', 'mps', '--out', work], cwd: '/kit', offline: '1' });
  assert.deepEqual(JSON.parse(readFileSync(path.join(work, 'storyboard.json'), 'utf8')), { scenes: [{ id: 'kabc', narration: 'Hello there.' }] });
});

test('the kit adapter hands the kit absolute paths only: it runs in its own folder', () => {
  const was = process.cwd();
  process.chdir(dir);
  try {
    mkdirSync('rel/work', { recursive: true });
    let seen;
    const run = (cmd, args, opts) => { seen = { cmd, args, cwd: opts.cwd }; writeFileSync(path.join(dir, 'rel', 'work', 'timings.json'), JSON.stringify({ scenes: [] })); return { status: 0 }; };
    chatterboxKit({ kit: 'kits/voice', run }).synthesize([{ id: 'k1', text: 'x' }], { work: 'rel/work' });
    assert.equal(seen.cwd, path.join(process.cwd(), 'kits', 'voice'));
    assert.equal(seen.cmd, path.join(process.cwd(), 'kits', 'voice', '.venv-voice', 'bin', 'python'));
    assert.equal(seen.args[seen.args.indexOf('--storyboard') + 1], path.join(process.cwd(), 'rel', 'work', 'storyboard.json'));
    assert.equal(seen.args.at(-1), path.join(process.cwd(), 'rel', 'work'));
    chatterboxKit({ kit: 'kits/voice', python: '/opt/voice/bin/python', run }).synthesize([{ id: 'k1', text: 'x' }], { work: 'rel/work' });
    assert.equal(seen.cmd, '/opt/voice/bin/python', 'a Python given whole is not put under the kit');
  } finally {
    process.chdir(was);
  }
});

test('the kit adapter says so when the kit fails — an exit code, a missing Python, a kill — and keeps a scene without words', () => {
  const work = path.join(dir, 'work');
  mkdirSync(work, { recursive: true });
  assert.throws(() => chatterboxKit({ kit: '/kit', run: () => ({ status: 2 }), env: { HF_HUB_OFFLINE: '0' } }).synthesize([], { work }), /voice kit failed \(exit 2\)/);
  assert.throws(() => chatterboxKit({ kit: '/kit', run: () => ({ status: null, error: new Error('spawnSync python ENOENT') }) }).synthesize([], { work }), { message: 'the voice kit failed (spawnSync python ENOENT) in /kit' });
  assert.throws(() => chatterboxKit({ kit: '/kit', run: () => ({ status: null, signal: 'SIGKILL' }) }).synthesize([], { work }), /\(signal SIGKILL\)/);
  const run = () => { writeFileSync(path.join(work, 'timings.json'), JSON.stringify({ scenes: [{ id: 'k1', audio: 'a.wav', duration: 1 }] })); return { status: 0 }; };
  assert.equal(chatterboxKit({ kit: '/kit', run }).synthesize([{ id: 'k1', text: 'x' }], { work })[0].words, undefined, 'no words aligned: none passed on');
});

test('voicing with an engine that aligns no words: the clip keeps none, and says so with null', async () => {
  const cache = path.join(dir, 'cache');
  const mute = { name: 'mute', synthesize: (scenes, { work }) => scenes.map((s) => { const audio = path.join(work, `${s.id}.wav`); writeFileSync(audio, 'x'); return { id: s.id, audio, duration: 1 }; }) };
  await voiceClips(['A. B.'], { cache, profile: PROFILE, engine: mute });
  const clip = clipFor('A. B.', { cache, profile: PROFILE });
  assert.equal(clip.words, null);
  assert.deepEqual(clip.sentences, [0, 0], 'no word times: every sentence starts at 0');
});

// ── narrate: the one narration step ─────────────────────────────────────────────────────────────────────────────────
import { symlinkSync, lstatSync } from 'node:fs';
import { narrate, narrationState, narrationSummary, narrationVoice } from '../voice.js';

const lineEngine = (calls = []) => ({
  name: 'fake',
  synthesize(scenes, { work }) {
    calls.push(scenes.map((s) => s.text));
    return scenes.map((s) => {
      const audio = path.join(work, `${s.id}.wav`);
      writeFileSync(audio, 'not really audio');
      return { id: s.id, audio, duration: 1.5, words: s.text.split(' ').map((text, i) => ({ text, start: i * .3, end: i * .3 + .2 })) };
    });
  },
});
const LINES = [{ id: 'one', text: 'The first line' }, { id: 'quiet', text: '' }, { id: 'two', text: 'The second line' }];
const folder = () => mkdtempSync(path.join(tmpdir(), 'narrate-'));

test('narrate with no engine only reads, and says what is left, costing nothing', async () => {
  const cache = folder();
  const report = await narrate(LINES, { cache, profile: { id: 'p' } });
  assert.deepEqual([report.voiced, report.toVoice, report.silent, report.seconds, report.ran], [0, 2, 1, 0, 0]);
  assert.deepEqual(report.lines.map((l) => l.state), ['to voice', 'silent', 'to voice']);
  const text = narrationSummary(report, { noun: 'clicks', hint: 'name a kit' });
  assert.match(text, /^0 of 2 clicks voiced · 2 to voice · 1 silent · 0 s so far\n {2}1 {2}one: The first line\n {2}3 {2}two: The second line\nnext: name a kit$/);
  rmSync(cache, { recursive: true, force: true });
});

test('narrate voices only what is missing, by line number when asked, and keeps the words', async () => {
  const cache = folder(), calls = [], profile = { id: 'p' };
  const first = await narrate(LINES, { cache, profile, engine: lineEngine(calls), only: '1' });
  assert.deepEqual([first.ran, first.voiced, first.toVoice], [1, 1, 1]);
  assert.deepEqual(calls, [['The first line']]);
  const second = await narrate(LINES, { cache, profile, engine: lineEngine(calls) });
  assert.deepEqual([second.ran, second.voiced, second.toVoice, second.seconds], [1, 2, 0, 3]);
  assert.equal(second.lines[0].clip.words.length, 3);
  assert.match(narrationSummary(second), /^2 of 2 lines voiced · 0 to voice · 1 silent · 3 s so far\nvoiced 1 just now$/);
  const third = await narrate(LINES, { cache, profile, engine: lineEngine(calls) });
  assert.equal(third.ran, 0);
  assert.equal(calls.length, 2);
  assert.equal(narrationState(LINES, { cache, profile: { id: 'another' } }).toVoice, 2);
  rmSync(cache, { recursive: true, force: true });
});

test('narrationSummary stays short however long the script is', () => {
  const lines = Array.from({ length: 30 }, (_, i) => ({ n: i + 1, id: `l${i}`, text: 'x'.repeat(200), state: 'to voice', seconds: 0, clip: null }));
  const text = narrationSummary({ lines, voiced: 0, toVoice: 30, silent: 0, seconds: 0 });
  assert.equal(text.split('\n').length, 13);
  assert.match(text, /… and 20 more/);
  assert.ok(text.length < 1200);
});

test('narrationVoice: a kit\'s own settings, the recipe only; recordings need a kit; none finds what was voiced', async () => {
  const kit = folder(), cache = path.join(kit, 'cache');
  assert.throws(() => narrationVoice({ cache, takes: 'takes' }), /recordings need the voice kit too/);
  assert.throws(() => narrationVoice({ cache, kit }), /no voice settings at .*me\.voice\.json/);
  assert.deepEqual(narrationVoice({ cache }), { engine: null, profile: { id: 'default' } });
  mkdirSync(path.join(kit, 'voices'));
  writeFileSync(path.join(kit, 'voices', 'me.voice.json'), JSON.stringify({ id: 'me', seed: 7, consent: 'a private note', reference: 'me.wav' }));
  const { engine, profile } = narrationVoice({ cache, kit });
  assert.equal(engine.name, 'chatterbox');
  assert.deepEqual(JSON.parse(JSON.stringify(profile)), { id: 'me', seed: 7 });
  await narrate(LINES, { cache, profile, engine: lineEngine() });
  assert.deepEqual(JSON.parse(readFileSync(path.join(cache, 'recipe.json'), 'utf8')), { id: 'me', seed: 7 }, 'what the key is made of, and no private note');
  const later = narrationVoice({ cache });
  assert.equal(later.engine, null);
  assert.equal(narrationState(LINES, { cache, profile: later.profile }).voiced, 2, 'asked later with no voice named, the clips are found');
  rmSync(kit, { recursive: true, force: true });
});

test('a recording session\'s clips and a voice\'s stay apart, and a refused voice leaves the settings as they were', async () => {
  const cache = folder();
  await narrate(LINES, { cache, profile: { id: 'first' }, engine: lineEngine() });
  await assert.rejects(narrate(LINES, { cache, profile: { id: 'x', engine: 'recorded' }, engine: lineEngine() }), /recorded session/);
  assert.equal(narrationVoice({ cache }).profile.id, 'first');
  rmSync(cache, { recursive: true, force: true });
});

test('a cache from someone\'s folder: a link is never read or written through, and a torn or foreign record is voiced again', async () => {
  const cache = folder(), outside = folder(), secret = path.join(outside, 'secret'), profile = { id: 'p' }, text = 'The first line', key = clipKey(text, profile);
  writeFileSync(secret, '{"duration":1,"sentences":[0]}');
  const at = (ext) => path.join(cache, `${key}.${ext}`);
  for (const ext of ['json', 'wav']) symlinkSync(secret, at(ext));
  symlinkSync(secret, path.join(cache, 'recipe.json'));
  assert.equal(clipFor(text, { cache, profile }), null, 'a link is no clip');
  assert.deepEqual(narrationVoice({ cache }).profile, { id: 'default' }, 'nor are a link\'s settings read');
  await narrate([{ id: 'one', text }], { cache, profile, engine: lineEngine() });
  assert.equal(readFileSync(secret, 'utf8'), '{"duration":1,"sentences":[0]}', 'voicing replaces the links, and what they point at is untouched');
  for (const ext of ['json', 'wav']) assert.equal(lstatSync(at(ext)).isSymbolicLink(), false);
  assert.equal(lstatSync(path.join(cache, 'recipe.json')).isSymbolicLink(), false);
  assert.equal(clipFor(text, { cache, profile }).duration, 1.5);
  for (const torn of ['{"duration":', '{"duration":"long","sentences":[0]}', '{"duration":1,"sentences":["x"]}', '{"duration":1,"sentences":[0],"words":[{"text":1}]}', 'null']) {
    writeFileSync(at('json'), torn);
    assert.equal(clipFor(text, { cache, profile }), null, torn);
  }
  writeFileSync(at('json'), '{"duration":1,"sentences":[0]}');
  rmSync(at('wav'));
  assert.equal(clipFor(text, { cache, profile }), null, 'no sound beside it');
  rmSync(cache, { recursive: true, force: true }); rmSync(outside, { recursive: true, force: true });
});
