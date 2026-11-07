# footprint-story

For developers building narration and animation tools, or integrating the shared rules used by StoryDeck and StoryReel.

[Install and import paths](#install-and-import-paths) · [Text mapping](#one-text-as-shown-and-as-spoken) · [Captions](#captions) · [Motion](#how-things-move-motion) · [Shots](#a-camera-in-3d-shots) · [Guarantees and limits](#what-is-guaranteed)

**What a film and a deck share.** [StoryDeck](https://github.com/footprintjs/storydeck) (slide decks that narrate
themselves) and [footprint-storyreel](https://github.com/footprintjs/storyreel) (drawn films) tell stories the same
way: a voice says the words, captions show them, and things move on screen. Each used to keep its own copy of those
rules, and the copies had started to disagree. This package holds them once. It was called `footprint-narration`
until 0.3.0, when the motion words joined it.

**What a voice says, and what a caption shows.** A voice drops or garbles digits and a forced aligner knows only
letters, so a narration is *said* in words while its captions *show* it as written: "16.67 ms" is said "sixteen
point six seven milliseconds", "UI" is said "U I", and a lone "—" is not said at all. The main door owns that one
law and everything that rests on it: the shown↔spoken map, sentences and word times, caption cues and caption
files, YouTube chapters, and — for Node — a voice port with a clip cache keyed by exactly what is said.

**How things move.** A curve, a spring, a move such as "slam", a change of picture such as "push" and how long a
picture may sit still are words both tools use, so they are named here once. Nothing here draws: StoryReel paints
them on a canvas, StoryDeck plays them in a page.

## Install and import paths

```sh
npm install footprint-story
```

Five doors, nothing else. A door loads only when you import it, so a page that only captions never loads motion:

| door | what | runs |
|---|---|---|
| `footprint-story` | the shown↔spoken map, sentences, captions, chapters | anywhere — browser or Node; no dependencies |
| `footprint-story/voice` | the voice port, the clip cache, its two adapters: the Chatterbox kit and your own recorded takes | **Node only** (files, child processes) |
| `footprint-story/motion` | eases and springs, moves, transitions as data, pace | anywhere — browser or Node; no dependencies |
| `footprint-story/storyboard` | a story written as data on a named shape, read and checked for both tools to draw | anywhere — browser or Node; no dependencies |
| `footprint-story/shot` | a camera in 3D as data, its projection maths, and a check of what it sees, in text | anywhere — browser or Node; no dependencies |

What may join: only what both tools use, and only the shared words and maths — each tool keeps its own drawing. A
new topic gets its own door; a door becomes a package of its own only if it ever needs a dependency or a release
pace of its own.

## A story written as data

An agent telling a story should not have to write a deck's HTML or a film's recipe. It fills in a **shape**, and every
mistake is named at once, so it fixes them in one pass. Whoever draws the board treats its words as text, never as code.

```js
import { storyShapes, storyboardBrief, storyboardProblems, storyboardFixBriefs, readStoryboard } from 'footprint-story/storyboard';

storyShapes();                   // [{ name, about, fills }]: the shapes, and a worked outline of each
storyboardBrief('what-we-found', { conversation });   // { instructions, material }: what a model needs to write one
storyboardProblems(fromAgent);   // [{ at: 'items[1].turn.callout', message: 'must say both names, …' }]
storyboardFixBriefs(fromAgent, problems, { conversation });   // { instructions, briefs, rest }: one short brief per piece at fault
const board = readStoryboard(fromAgent, { conversation: [{ id: 'm7', text: 'it waited 41 minutes' }] });
board.scenes[1];                 // { id, part, look, title, narration, beat }
```

A conversation becomes a story in three steps, and only the first needs a model: `storyboardBrief` gives the instructions
and the conversation for whichever model you use, `storyboardProblems` names what to fix in its answer, and a tool draws
the board. Send `instructions` as your own and `material` as data, because it holds a conversation's own words.
When a board is refused, `storyboardFixBriefs` gives a short brief for each piece at fault. It takes no answer itself, so say what
form you accept: a host that keeps its board can change just those pieces.

| shape | what it tells |
|---|---|
| `told-twice` | a cast of people and everyday things acts a system out, each turns into the real thing where it stood, then the same story runs again for real |
| `what-we-found` | what was checked, what was found, what is still not known (which must be written, even empty), and what happens next |

Given a conversation, a `what-we-found` claim must name the messages it rests on, and every number in it must be in one of
them; anything that cites none, such as its title, must use numbers from somewhere in the conversation. That catches a
wrong number. It does not catch a claim that is wrong in words, a number spelled out, or a sign (`-41` reads as 41). `verified` is true only when claims
really were checked: `told-twice` makes none, and with no conversation nothing is checked.

## A narration: one step for a film and a deck

Each tool says what its lines are, and this owns the rest. With no voice, `narrate` only reads, so asking costs nothing.

```js
import { narrate, narrationSummary, narrationVoice } from 'footprint-story/voice';

const cache = 'voice/cache';
const { engine, profile } = narrationVoice({ cache, kit: '../voice-kit' });   // or { cache, kit, takes } for your own recordings, or { cache } to only read
const report = await narrate(lines, { cache, profile, engine });
console.log(narrationSummary(report));   // 12 of 15 lines voiced · 3 to voice · 2 silent · 48.2 s so far …
```

A voice kit runs Python on your machine, so take its folder only from your own command or a server's start, never from a
project's files. StoryDeck and StoryReel each have a `narrate` command built on this.

## One text, as shown and as spoken

A **slot** says one exact place by hand; the **rules** say everything else. Use either or both.

```js
import { spokenMap, autoRules } from 'footprint-story';

spokenMap('Keep latency < 10 ms — the UI waits.', { rules: autoRules() }).spoken;
// 'Keep latency less than ten ms, the U I waits.'

const map = spokenMap('One frame takes 16.67 ms, at 60 Hz.', {
  slots: [['16.67 ms', 'sixteen point six seven milliseconds'], ['60 Hz', 'sixty hertz']],
});
map.spoken;   // 'One frame takes sixteen point six seven milliseconds, at sixty hertz.'
map.pieces;   // [{ shown: 'One frame takes ', spoken: 'One frame takes ', kind: 'text' },
              //  { shown: '16.67 ms', spoken: 'sixteen point six seven milliseconds', kind: 'slot' }, …]
```

The automatic rules spell the few acronyms a voice misreads as a word (`SPELL`: UI, API, APIs — every other
acronym stays, since a cloned voice says LLM or MCP as quick letters), say a lone symbol that means something
(`SAY`: `& + = × %`, Greek letters, and `< >` before a number only — "File > Save As" is a menu path), say numbers
in words, and turn every other word without a letter (— → … | an emoji) into a pause: its sentence end moves onto
the word before, else that word gets a comma. Bring your own lists — `autoRules({ spell: { ...SPELL, 日本: 'Japan' } })`
— or your own strategy (`{ name, apply(pieces) }`).

**Back to what is shown.** A voice aligner times the words it *said*. `shownWords` collapses each said run back
into what the text shows, timed from its first word to its last, so captions show digits where the voice said words:

```js
import { shownWords } from 'footprint-story';

shownWords(map, alignedWords).map((w) => w.text);   // ['One', 'frame', 'takes', '16.67 ms,', 'at', '60 Hz.']
```

`spokenOffset` maps a phrase written as shown onto the spoken words (so "at 60 Hz" finds "at sixty hertz"),
`unsaidDigits` lists the digits a voice would still have to read, and `checkSlots` refuses a slot list that cannot
be right, naming the fix.

## Captions

Two producers — by sentence (a deck's clips know each sentence's start) and by word (a film's aligner knows every
word) — one cue shape, **one writer**, one reader.

```js
import { captionCues, captionChunks, captionFile, readCaptions, FILE_CHUNKS } from 'footprint-story';

const cues = captionCues([{ start: 10, lead: 0.5, written: 'In 2000. Done.', spoken: 'In two thousand. Done.',
  clip: { duration: 4, sentences: [0.2, 2.5] } }]);                     // shows "In 2000." while the voice says it
const chunks = captionChunks([{ offset: 3.3, duration: 4.1, words }], { maxWords: 5 });   // burned-in chunks
captionFile(captionChunks(tracks, FILE_CHUNKS), 'srt', { offset: 2 });   // a numbered SRT, two lines at most
readCaptions(vttOrSrt);                                                  // back to [{ start, end, text }]
```

The writer numbers the cues, moves them onto the video's clock (`offset`), cuts them to a partial render
(`from`, `to`), wraps a long text onto two lines near its middle, never lets `-->` into a text, and escapes
WebVTT's `& < >`; the reader reads both formats and those escapes back.

## YouTube chapters

YouTube shows chapters only when the first is at 0:00, there are at least three, and each lasts 10 s or more.
`youtubeChapters` fixes what it can and says what it did.

```js
import { youtubeChapters } from 'footprint-story';

const list = youtubeChapters([{ at: 3, title: 'Card' }, { at: 6, title: 'Intro' }, { at: 40, title: 'One' },
  { at: 45, title: 'Aside' }, { at: 80, title: 'Two' }], { length: 205 });
list.text;      // '0:00 Intro\n0:40 One\n1:20 Two'
list.changes;   // Card replaced by Intro · Intro moved to 0:00 · Aside merged into One
```

## A voice, cached by what it says (Node)

```js
import { chatterboxKit, voiceClips, clipFor } from 'footprint-story/voice';

const engine = chatterboxKit({ kit: '../voice-kit' });                 // a local voice kit; nothing is uploaded
await voiceClips(texts, { cache: 'voice-cache', profile, engine });    // voices only what has no clip yet
clipFor(texts[3], { cache: 'voice-cache', profile });                 // { key, audio, duration, sentences, words }
```

A clip's key is a hash of its recipe — the voice profile's settings and the exact spoken text — so editing one
line re-voices that line alone, and an interrupted run keeps every batch it finished. The engine is a port,
`{ name, synthesize(scenes, { work }) }`; `chatterboxKit` is one adapter, a test fake or a cloud voice is another.
Clone only your own voice.

## Your own voice, recorded (Node)

**Why:** a cloned voice is a stand-in. When you would rather read the script yourself, each recording should land
in the film or deck exactly as a cloned line does: the same lead and tail of silence, its words timed against the
known text by the same aligner, cached by the same key recipe. `recordedTakes` is the second adapter of the voice
port, so nothing downstream changes.

```js
import { recordedTakes, voiceClips, clipFor } from 'footprint-story/voice';

const takes = recordedTakes({ kit: '../voice-kit', takes: 'takes' });          // your recordings + the kit's aligner
await voiceClips(texts, { cache: 'voice-cache', profile: takes.profile, engine: takes, batch: 50 });
clipFor(texts[3], { cache: 'voice-cache', profile: takes.profile }).take;
// { file: '004.m4a', trim: { length: 6.1, clip: 4.35, kept: 4.35, cutBefore: 0.82, cutAfter: 0.31, padBefore: 0, padAfter: 0,
//   pauses: [{ at: 2.4, was: 1.62, now: 0.6 }] }, check: { words: 14, meanScore: 0.86, lowWords: [['latency', 0.21]], letterMatch: 0.97 } }
```

The folder holds one recording per line (WAV or M4A, any name) and a `takes.json` that maps each line, as it is
said, to its file: `{ "One frame takes sixteen point six seven milliseconds.": "004.m4a" }`, every file inside the
folder. A line finds its take word by word, so case and punctuation do not matter, while "a part" is not "apart". A line with no take is refused, with every such line listed
and ready to paste into `takes.json`. The file names stay your recorder's, and an edited line is listed again
instead of being cut from a take of the old words. Each take then goes through four steps:

- **find**: its take in `takes.json`.
- **trim**: with ffmpeg, give every clip exactly the kit's 0.2 s before the first sound and 0.4 s after the last
  (a longer silence is cut, a shorter one padded), and shorten every pause longer than 0.6 s to 0.6 s. A short word
  at either end is kept; a click farther than 0.6 s from the speech is cut. The cut is computed in whole samples, so
  the same take always gives the same bytes.
- **align**: the kit's own MMS_FA aligner runs offline in the kit's Python, through `align_take.py`, which ships
  here. It never downloads: without the aligner's weights on disk, it refuses (run the kit's setup once).
- **check**: as the kit's `check_words.py` does it. A take the aligner cannot fit to its words is refused; a
  low-scored word is reported, for you to listen to.

What each step decided is the clip's `take` record, kept beside it in the cache.

The session's `profile` is a hash of the takes' bytes and the trim settings, so a recorded line and a cloned line of
the same text never share a key, and a line recorded again is never served stale. `voiceClips` refuses a recorded
engine with any other profile, and a recorded profile with any other engine. It also refuses a `work` folder that is
the takes folder, holds it or lies inside it, because a work folder is emptied before each batch.

- **Use a large `batch`.** Each batch loads the aligner's model once, about 2 s here, so `batch: 50` saves a load
  every few lines. The default stays 4 because batching is the cache's rule for every engine, and an interrupted run
  keeps each finished batch either way.
- **Reading clips without the takes.** `takes.profile` is two strings. Save it with the deck, and a machine without
  the recordings reads every clip with `clipFor(text, { cache, profile })`. `voiceClips` with no engine counts what
  is cached, and throws, as it always did, when a line is still to voice.
- **The limit:** the session cannot be pinned by name. Any change to the takes (a line recorded again, a new line, a
  trim setting) gives a new session, and every line is cut and aligned again. That takes seconds per line and
  generates no voice. A pinned id would let a line recorded again keep its old clip, because the cache never asks an
  engine about a clip it already has.

The voice is yours alone: never use this for anyone else's.

## How things move (motion)

**Why:** a move should look the same in a film and on a slide, and nobody should keep a second copy of a spring.
Every value is a pure function of time, so frame 812 is drawn without drawing 0–811.

```js
import { easeNamed, moveAt, movesBy, readTransition, readPace } from 'footprint-story/motion';

easeNamed('cubic-bezier(0.16, 1, 0.3, 1)')(0.5);   // the curve a browser draws for that text
moveAt('slam', 0.1);                  // { opacity, x, y, scale: 1.106…, rotate, blur: 0.18…, clip, progress, mask }
movesBy({ feel: 'heavy', use: 'text' });            // [slam]
readTransition({ type: 'push', from: 'left' }, 'click 3');
// { type: 'push', family: 'motion', seconds: 0.7, ease: 'inOut', sound: 'slide', p: { from: 'left' } }
readTransition('iris', 'click 4', { frame: [1920, 1080] }).p.at;   // [960, 540]: the middle of this frame
readPace('promo');   // { hold: 0.6, most: 0, still: 0.4, spare: 1 }: nothing still past 0.6 s, the end card spared
```

Moves keep their kind's law (an entrance ends at rest, an exit starts there, an ambient move loops from rest), and a
move of your own is checked by the same laws. A drawer adds its own transitions with `extendTransitions`, checked the
same way. More in [src/motion/README.md](src/motion/README.md).

## A camera in 3D (shots)

**Why:** a film and a deck should say a shot in the same words, and whoever writes one should learn what the camera really
sees without reading a picture. A scene is plain data, a shot names where the camera stands, and the check answers in one line.

```js
import { readShot, frameOf, checkShot, shotLine } from 'footprint-story/shot';

const scene = {
  unit: 'm',
  things: [
    { name: 'database', at: [0, 0, 0], r: 1 },          // a ball; a point has no r, and a card has a size: [w, h]
    { name: 'cache', at: [-2, 1.2, 2.2], r: 0.5 },
    { name: 'proxy', at: [3, 0, -6], r: 1 },
  ],
};
const shot = readShot({ on: 'database', from: 'front-left high', size: 'medium' }, scene);
const camera = frameOf(shot, scene);    // { target, azimuth, elevation, distance, focal, aperture }
shotLine(checkShot(scene, camera, [1280, 720], shot));
// shot "database" from front-left high (6.33 m, lens normal): in frame 100%, 40% of height (medium), "cache" covers 43% of it, sharp — move the view or lift it
```

`from` is a named view: `front`, `front-left`, `left`, `back-left`, `back`, `back-right`, `right` or `front-right`, then `high`,
`level` or `low`. `size` is `wide`, `medium`, `close` or `insert`, and `lens` is `wide`, `normal` or `long`. A camera may also come
from a film's own numbers: `checkShot(scene, camera, frame, { on })` reads any camera, and the line says `about` when it stands
near a named view rather than on it. The check reports a subject behind the camera, off frame, cut off, too small, covered by
something nearer, edge-on, showing its back or out of focus, and a camera on top of its subject.

Where things land, each thing's box and whether it is cut off are exact. Shares are areas on the frame, cut from the outlines
things really fill, so a thin card counts as surely as a wide one. On 600 random scenes, a third with thin cards as the subject,
against a separate dense oracle: worst error 0.2 points for in frame and 0.4 for covered, and 1.9 where a ball passes through
something, the one case that is sampled. There a clear result says so: `"rod" passes through it`. An overlap under about a third
of a pixel is not counted.

**The check knows only the scene it is given,** and the line says how many other things it was tested against: `none of the 3
other things in front`, or `no other things given`. A flat layer over the picture, a caption or a bond is not there unless you
add it as a thing, and every thing with a size is solid. Two things in one shot's `on` can hide each other, and that is reported:
name a tight cluster as one ball. The sizes, the lenses and "too small" are starting choices, not measurements. Nothing here draws, and no tool reads a shot yet. More in [src/shot/README.md](src/shot/README.md).

## API

| export | does |
|---|---|
| `spokenMap(text, { slots, rules })` | the text as shown and as spoken: `{ shown, spoken, pieces, norm }` |
| `autoRules({ spell, say })`, `SPELL`, `SAY` | the automatic strategy and its default lists |
| `checkSlots(text, slots, { name, field })`, `findSlot` | refuse a slot list that cannot be right; where a slot stands whole |
| `shownWords(map, words)` | timed spoken words, shown as written |
| `spokenOffset(map, at, { end })`, `unsaidDigits(map)` | a shown offset in the spoken text; the digits left to read |
| `numberWords(n)`, `normSpeech(text)` | a number in words; how two spellings are compared |
| `sentences`, `saidSentences`, `sentenceStarts` | split as a voice script splits; where each sentence starts |
| `captionCues(steps)`, `captionChunks(tracks, opts)`, `captionAt` | cues by sentence; chunks by word; the word being said |
| `captionFile(cues, kind, opts)`, `readCaptions`, `stamp`, `FILE_CHUNKS` | the one writer, its reader, its clock |
| `youtubeChapters(marks, { length, min })`, `readChapters`, `clockText` | chapters fixed and reported; read back; their clock |
| `/voice` `clipKey`, `clipFor`, `voiceClips`, `pickSteps`, `chatterboxKit`, `recordedTakes` | the clip cache and the voice port's two adapters |
| `/motion` `EASES`, `easeNamed`, `bezier`, `overshoots` | the ease table, any CSS cubic-bezier, which curves overshoot |
| `/motion` `spring`, `FEELS`, `readFeel`, `settleTime`, `pop`, `track` | closed-form springs by feel |
| `/motion` `MOVES`, `moveAt`, `readMove`, `movesBy`, `stagger` | named moves: their values at t, your own checked, a filter, delays |
| `/motion` `TRANSITIONS`, `readTransition`, `checkTransition`, `extendTransitions`, `readSettings` | changes of picture as data, read and checked |
| `/motion` `PACES`, `readPace` | how long a picture may sit still, by kind of film |
| `/shot` `readView`, `readScene`, `sceneProblems`, `readShot`, `shotProblems` | named views, scenes and shots, read and refused in words |
| `/shot` `readCamera`, `frameOf`, `distanceFor`, `apertureFor` | a camera's numbers; the camera a shot asks for |
| `/shot` `project`, `unproject`, `boxOf` | a point on a frame and back; the box a thing fills |
| `/shot` `checkShot`, `shotLine` | what a camera sees of a subject, as a report and as one line of text |
| `/shot` `ROUNDS`, `HEIGHTS`, `SIZES`, `LENSES`, `MOST_THINGS` | the camera's words, and the most things a scene may hold |

Types ship with every door (`index.d.ts`, `voice.d.ts`, `motion.d.ts`, `storyboard.d.ts`, `shot.d.ts`). Each `src/` folder has a README saying why it exists.

## What is guaranteed

- **Nothing a deck or a film already says changes.** The rules say exactly what StoryDeck 0.2.0 said, and the slots
  exactly what footprint-storyreel 0.9.0 said — pinned by property tests that compare thousands of generated texts
  against copies of that code, kept unedited in `test/control/`. The four clip-key goldens of a real deck stay.
- **The pieces always join back** to both texts, and only text said as written is ever rewritten: what a slot or
  a rule says is final.
- **Every move and curve StoryReel 0.23.0 drew is drawn the same**: property tests compare thousands of generated
  calls against copies of that code in `test/control/` — values and refusals alike.
- **The main, motion, storyboard and shot doors run in a browser**: nothing they reach imports a Node module, and the main
  door never loads motion (an architecture test).

The differences from the code it replaced are few and named in the [CHANGELOG](CHANGELOG.md).

## License

MIT
