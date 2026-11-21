---
name: footprint-story
description: What a film and a deck share (footprint-story, formerly footprint-narration). Say a narration with a voice and caption it as written — the shown↔spoken map (numbers, symbols and acronyms said in words, shown as written; hand slots and automatic rules), sentence and word captions in one SRT/WebVTT writer, YouTube chapters that are fixed and reported, and a voice clip cache keyed by exactly what is said. And name how things move, once for both tools: eases and springs, moves (slam, pop, soft-rise…), changes of picture as data (push, whip, zoom…), and pace (lesson, promo). Use when turning text into what a TTS voice should say, captioning a narrated video or deck, writing chapters for YouTube, voicing lines through a local voice kit, or picking a move, a transition or a pace for StoryReel or StoryDeck.
---

# footprint-story: what a film and a deck share

A voice drops or garbles digits and a forced aligner knows only letters, so a narration is **said in words and
shown as written**. Everything here rests on one map from the shown text to the spoken text. And a move, a change of
picture and a pace are named here once, so a film and a deck move alike. Nine doors:

| You need | Import | Runs |
|---|---|---|
| the shown↔spoken map, sentences, captions, chapters | `footprint-story` | anywhere (browser or Node), no dependencies |
| a voice clip cache, the voice port, the Chatterbox kit adapter | `footprint-story/voice` | **Node only** |
| eases, springs, moves, transitions as data, pace, turns (an order written once: `'a (b c) d:1.2'`), a packet riding a line (`rideProfile(ease, length)`: eased ends along its length, `rideSeconds`, `withHold`, `showStops`, `hiddenRamps`); read at a moment: `onStops(stops, u)`, `seenAt(ramps, p)` (`seenTerms` for a page that writes CSS) | `footprint-story/motion` | anywhere, no dependencies; nothing draws |
| a camera in 3D as data, projection, a check of what it sees in one line of text | `footprint-story/shot` | anywhere, no dependencies; nothing draws |
| a floor of tiles seen from a corner: where a point lands, a box's faces, the order to draw in; `arrange(things, links)` places things from what is joined to what, `gridFor(things, box)` fits the grid to a box, `routes(things, links)` lays each link along the floor round what stands in its way (and says what happened: `behind`, `why`; `routeNote` in words); a thing's `ports` (named points on its sides) and a link end `{thing, port}` plug a link in where you say, and `path` is the whole way in 3D, `routes(things, links, { keep })` keeps routes off floor under words where it can (`under` names what it could not), `rounded(points, radius)` rounds a way's corners and gives the point a share along it, `gridFor(things, box, { also })` fits the picture to links' points too, `wordsToFit(name, [wide, high])` puts a name on one line or two as big as fits (and says when it cannot); `grid.room(thing, high)` is the true room on a thing's top (a block's top is a diamond, as wide as its shorter side) and goes to `wordsToFit` in place of `[wide, high]`: `(high) => grid.room(thing, high)`; `hairpins(route.path, route.ports)` says where a way doubles back (`'start'`, `'middle'`, …), `floorUnder(box, grid, { lift })` is the floor under words as `routes`' keep takes it (or `why` there is none: `NO_UNDER`) and `crossesBox(points, box)` whether a way runs through them, `floorLabelPlace(floor, grid, name, covers)` lays a floor's name along its front edge clear of what stands there, `arrangeByGroup(things, links)` arranges each group then the groups; a cable's label on its cable: `labelPlace(way, labelHalf(letters), hides, runs, looks, tip)` (`CABLE` its numbers, `held`, `walkWay`), and its line stopped for its head: `cableWay({points, radius}, CABLE.head * CABLE.headShort)` (`stopShort(points, back)` for the points alone), and a lead into a port drawn again over its block: `cableLead(cable, end, count, back)` (`{way, pieces, length}`; its share of the line is `length / cableWay(cable, back).length`, the line as drawn); a wire drawn straight between two pieces: `lanesOf(pairs)`, `straightRun(a, b, lane)` (`{why}` when it cannot be), `bentWire`, `curveWay` (a curve as a way), `arrowHead(tip, headingOf(before, tip))`; `exitOutline`, `exitBox`, `roundOutline` (a cylinder's outline) | `footprint-story/isometric` | anywhere, no dependencies; nothing draws |
| a story as data on a named shape, read and checked | `footprint-story/storyboard` | anywhere, no dependencies; nothing draws |
| an isometric map built as a footprintjs chart (one stage per step of `ISO_MAP_STEPS`): `runMapFlow(spec, policy, {sink, recorders})` → `{map, snapshot}`, the map equal to `buildIsoMap`'s; then `whyFromRecord` says why a block stands where it does | `footprint-story/mapflow` | wherever footprintjs runs; needs `footprintjs` (the caller's) |
| why a value of a run is so, from the run's record file: `whyFromRecord({file, control, key})` (the value, the stage that wrote it, the decision that let it run, what each read); `controlEdges` is what a run saves for it | `footprint-story/record` | **Node only**; needs `footprintjs` and `foottrace` (the caller's) |
| a row of a reply kept one line whatever a project's files hold: `oneLine`, `errorText` | `footprint-story` | anywhere |
| a part that differs from the real thing: `differsProblem(declaration, lines, phrases)` (the first rule broken, as data), `differsLines`, `timeProblem`, `timeWords`, `differsEnglish` | `footprint-story` | anywhere; the tool words the refusal |
| a flat frame: `frameZoom([w, h], [roomW, roomH], { share, least, most, smallest })`, `wrapWords(words, width, (text) => width, { break })` (each line measured whole; `break: 'fill'` the usual, `'even'` balanced; `BREAK_RULES`), `narrowestWidth` | `footprint-story/layout` | anywhere, no dependencies; nothing draws |

Never import `footprint-story/voice` into browser code. This package was `footprint-narration` until 0.3.0: replace
the name in imports and `package.json`; the two old doors export exactly what they did.

**Motion, in one breath.** `moveAt('slam', t)` gives a move's values at t; `movesBy({ feel: 'heavy', use: 'text' })`
finds moves; `readTransition({ type: 'push', from: 'left' }, where, { frame: [1920, 1080] })` reads a change of
picture (a point's default `'centre'` is that frame's middle); `readPace('lesson' | 'promo')` says how long a picture
may sit still. Nothing here draws: StoryReel paints, StoryDeck animates the page.

## Recipes

**What should the voice say for this text?** The automatic rules say numbers in words, spell UI/API/APIs, say a
lone `& + = × %` or Greek letter, say `< >` only before a number, and drop every word without a letter (a pause:
its sentence end moves onto the word before, else that word gets a comma).

```js
import { spokenMap, autoRules, SPELL } from 'footprint-story';
const rules = autoRules({ spell: { ...SPELL, 日本: 'Japan' } });   // build once, reuse
spokenMap('Errors fell 90 % — then 3 more.', { rules }).spoken;   // 'Errors fell ninety percent, then three more.'
```

**A place the rules get wrong** ("1,250" reads as "one,two hundred fifty", "3.5" as "three.five"): give that exact
place a slot. Slots are positions, matched in order, each where its shown text stands whole.

```js
spokenMap('It took 1,250 ms.', { slots: [['1,250 ms', 'twelve hundred fifty milliseconds']], rules });
```

**Captions that show what is written while the voice said words:** time the spoken words (an aligner, or even
timings), then `shownWords(map, words)` collapses each said run back into what is shown; chunk them on tracks.

```js
import { shownWords, captionChunks, captionFile, FILE_CHUNKS } from 'footprint-story';
const tracks = scenes.map((s) => ({ offset: s.offset, duration: s.duration, words: shownWords(s.map, s.words) }));
const srt = captionFile(captionChunks(tracks, FILE_CHUNKS), 'srt');   // numbered, two lines at most
```

A deck whose clips know only sentence starts uses `captionCues(steps)` instead; both go through `captionFile`.

**YouTube chapters:** `youtubeChapters(marks, { length })` → `{ lines, text, kept, changes, problems }`. Paste
`text`; print `changes` (moved / replaced / merged / dropped) so the author sees what YouTube's rules changed.

**Voice lines through a local kit (Node):**

```js
import { chatterboxKit, voiceClips, clipFor, pickSteps } from 'footprint-story/voice';
const engine = chatterboxKit({ kit: '../voice-kit' });
await voiceClips(spokenTexts, { cache: 'voice-cache', profile, engine, only: pickSteps(process.env.ONLY) });
const clip = clipFor(spokenTexts[0], { cache: 'voice-cache', profile });   // { key, audio, duration, sentences, words }
```

Voice the **spoken** text (`map.spoken`), never the shown text: the key is a hash of what is said.

## Laws — do not break these

- `clipKey` is byte-stable: sha1/12 of `JSON.stringify({ id, exaggeration, cfgWeight, seed, gap, takes, text })` in
  that order. Never re-spell it (sorted keys, another hash): every existing clip would be lost.
- The pieces of a map join back to both texts exactly; a custom `rules` strategy (`{ name, apply(pieces) }`) may
  rewrite only `kind: 'text'` pieces and must never change what is shown (`spokenMap` refuses one that does).
- What a slot or a rule says is final: no later rule reads it again.
- A spell/say value is words — a letter in every word, no digits, no comma, semicolon or colon at its end
  (`autoRules` refuses `'Windows 11'`: write `'Windows eleven'`).
- Clone only your own voice; a profile carries its consent and its watermark.

## Pitfalls

- `spokenMap` refuses a slot list `checkSlots` refuses; check a storyboard's slots up front with
  `checkSlots(text, slots, { name: 'scene 3', field: 'say' })` to name the place in its message.
- `captionChunks` takes tracks, each word's times from its track's start; `offset` puts the track on the video's clock.
- `captionFile(…, 'vtt')` escapes `& < >`; read files back with `readCaptions`, which reads the escapes.
- `unsaidDigits(map)` lists digits a voice would still read: refuse them before voicing.
- `wordsToFit(name, room, { measure })` takes a word's width (a function or a table, the space as `' '`) in place of
  `letter`, never both; `wrapWords` instead takes a whole line's width. Two rules on purpose: a name on a face (one
  line or two, a size found) and a title over many lines at a chosen size.
- A map's look: `isoStyle(row, {choices})` (columns shape, shading, line, palette, texture, effects; a left-out column is
  today's look) and `paintPiece(style, piece, grid, colours)` → `{box, items}`, a paint list as plain data the tool paints.
  A tool's own choice is named `'prefix:name'`; record `style` (it is plain data). Never draw in the story package.
- A whole map: `buildIsoMap(spec, ISO_MAP_POLICIES.film | .deck)` — the spec is the map as data (blocks, floors, wires,
  grid or area, style; each piece's `who` is the tool's words, named in every refusal), the policy the tool's numbers.
  It runs `ISO_MAP_STEPS` (place, route, fitFloors, grid, shape, names, order, floorLabels, style; pure, plain data) and
  gives the last state, frozen: `at`, `routes`, `floorTiles`, `view`, `shapes`, `names`, `order`, `floorLabels`, `paints`,
  and `placed`/`placedWhy`, `grid`/`gridWhy`. Draw from it on the synchronous path; run `footprint-story/mapflow`'s
  `runMapFlow` in the run chart for the record. Never copy a step into a tool. A deck also hands `obstacles` (pictures
  standing on the floor by their footprint), `keep` (floor kept clear, in tiles), a floor's `icon: true`, `grid: 'fit'`
  and its `usualGrid`; `.deck` covers a floor's label by each block's box (`cover: 'block'`).
- The break rule is a NAME on both: `wrapWords(…, { break: 'fill' | 'even' })` (fill usual), `wordsToFit(…, { break:
  'even' | 'fill' })` (even usual). Pass the writer's choice through and put the name in the record; never a function.
