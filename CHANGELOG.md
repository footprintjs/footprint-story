# Changelog

## 0.18.0 — framing a box, breaking words, and a part that differs: written once for a deck and a film

Three rules each tool kept to itself move here, so a deck, its animation and a film work them out once. Each gives
what the tool's own code gave, to the last bit, for every input the tool can hand it — checked by property tests
against copies of that code (`test/control/storydeck-0.28.0-*`, `test/control/storyreel-0.33.0-*`) and, through each
tool, by its pages and frames before and after.

- **`footprint-story` · a part that differs from the real thing**: `differsProblem(declaration, lines, phrases)` (the
  first rule broken — `said-twice`, `unsaid`, `unstated` with `named`/`statements`/`says`, `contradicts` with the
  `figure` — or null), `differsLines`, `differsStatements`, `differsEnglish`, `timeProblem` (`not-a-factor`,
  `real-time`, `past-range`), `timeWords`, `analogyWords`, `differsFactors`, `foldDiffers`, and `DIFFERS_MOST` (70),
  `DIFFERS_SAID_MOST` (120), `DIFFERS_TIME_MOST` (1e9), `DIFFERS_ANALOGY`. From StoryDeck 0.28.0's `deck/differs.js`
  and StoryReel 0.33.0's `src/differs.mjs`, which held the same rules; codes, not sentences, so each tool words them.
- **`footprint-story/layout`, a new door**: `frameZoom(size, room, { share, least, most, smallest })`, StoryDeck's
  zoom, fit and side-mover rule (its exact operations, so a view rounded to 4 places rounds as before), which
  StoryReel 0.34.0's focus and pushes frame by too;
  `wrapWords(words, width, measure)`, StoryReel's greedy line breaking with each line measured whole (its cost grows
  with the words times a line's length: each word asks `measure` for the line so far); and
  `narrowestWidth(width, lines, linesAt)` with `NARROWEST_STEPS` (12), its balancing.
- **`wordsToFit(text, room, { measure })`**: a word's width (a function or a table, read by its own stored fields; the
  space as `' '`) in place of the letter count, for a tool that can measure its face. The same rule, summed widths;
  each distinct word measured once. Refused: `measure` with `letter`, a getter for `measure`, a width that is no
  number from 0 to 1,000,000. Without `measure`, every name is set as before. The options refusal now lists `measure`.
- Inputs are read by their own stored fields: a getter is never run, and in a declaration or a list it is refused by
  name, as is a declaration field only its prototype holds and a list with a hole. A time that is not a number
  (`differsLines({ time: '30' })`, `timeWords('30')`) and a scale or analogy that is not words are refused with a
  `differs:` message. `wrapWords` refuses a NaN width and a measure that gives no finite width from 0;
  `narrowestWidth` refuses a width or line count that is no finite number; no words at all is `['']`. `frameZoom`
  takes any number as IEEE arithmetic answers it (a NaN in is a NaN out, as the deck's unchecked `zoom` options always
  gave) and refuses anything that is not a number.

## 0.17.1 — 0.17.0, published

- 0.17.0 was tagged but never published: a test that timed the router's biggest picture against the clock (5 s) ran
  over on the release runner (5.6 s; a quarter of a second on a laptop). The bound that matters is the work counted
  (MOST_WORK), which the tests still pin; the clock checks now only say a call ended, with room for a slow runner.
  Nothing else changes: 0.17.1 is 0.17.0.

## 0.17.0 — what StoryDeck worked out, shared: a packet's ride, hairpins, the floor under words, a floor's name, groups

Five helpers StoryDeck 0.27.0 kept to itself move here, so a deck, its animation and a film work them out once.
Each gives what StoryDeck's gave for every input StoryDeck can hand it — places and lengths far past a frame, and the
NaN and Infinity a page's style can parse to, included — checked by property tests against copies of that code
(`test/control/storydeck-0.27.0-*.js`) and, through StoryDeck, by building its decks and 430 maps before and after.
What is new is that every value is read by its own stored fields (a getter is never run, and on an option or a grid's
number it is refused, never read as left out; a list with a hole is refused) and that inputs only another caller
could hand in are refused in words, listed below. One input StoryDeck could hand in is refused too: a line whose
length is NaN (a wire through the air written with numbers near 1e308, whose length overflows); StoryDeck 0.28.0
refuses such a wire itself, where 0.27.0 drew a broken ride. Two answers differ on purpose: `rideSeconds` refuses a time that
cannot be counted where StoryDeck's gave Infinity, and `floorUnder` answers a box with no floor with a reason where
StoryDeck's threw its own sentence (StoryDeck says both in its words, as before).

- **`footprint-story/motion` · a packet riding a line**: `rideProfile(ease, length)` (eased out of its start and into
  its end over shares of the line's length, stops within 0.4 px of the true ease), `rideSeconds(length, speed, ease)`,
  `speedAt(progress, ease)`, `withHold(stops, share)`, `showStops(share, { end })`, `hiddenRamps(unseen, length,
  speed, ease, { frames, fps, least, radius })`, and `MOST_EASE` (0.5). Any finite length and speed are taken (a
  wire through the air may be written 3,000,000,000 px long); a time `rideSeconds` cannot count is refused, never
  handed back as Infinity. Refusals start `ride:`.
- **`footprint-story/isometric` · `hairpins(path, ports)`**: where a way doubles back on itself, in a word
  (`HAIRPINS`: `start`, `start-hook`, `middle`, `end`, `end-hook`). What to say about it stays the tool's.
- **`floorUnder(box, grid, { lift, most })`** and **`crossesBox(points, box)`**: the floor under a box of the frame as
  `routes`' `keep` takes it, and whether a way on the frame passes strictly inside a box. A box with no floor answers
  `{ stretches: null, why, squares }`, `why` one of `NO_UNDER` (`far`, `big`, `most`), where StoryDeck threw its own
  sentence: the deck words it now. A box placed at NaN or Infinity is far, as it was; `crossesBox` takes any numbers, and a box or a stretch end that no number places (NaN, Infinity) is crossed by nothing. `UNDER_CELL` (0.5) and `MOST_UNDER_SQUARES` (200,000) are exported.
- **`floorLabelPlace(floor, grid, text, covers, { icon })`**: where a floor's name lies along its front edge, clear of
  what stands there; `MOST_FLOOR_LABEL` (120 letters), `FLOOR_LABEL_ICON` (1.5). Its work is bounded now: a floor at
  most 256 tiles a side (so at most 512 places), outlines of at most `MOST_OUTLINE_POINTS` (64) points and
  `MOST_COVER_POINTS` (1,000,000) in all, each asked by its box before the overlap test, and at most
  `MOST_LABEL_LOOKS` (50,000,000) looks in all — past any of them, refused in words. A floor's own label never
  reaches them (a deck's map spends a few thousand looks).
- **`arrangeByGroup(things, links)`**: each group arranged on the links inside it, then the groups on the links
  between them; `GROUP_MARGIN` (1). It calls this package's `arrange` (StoryDeck handed its own in). New refusals: two
  things with one name (StoryDeck refused that before calling), a group name past 100 characters.
- A grid handed to `floorUnder` or `floorLabelPlace` is read by its numbers (tile, origin, rise; `IsoGridNumbers`)
  and rebuilt, never called: a grid `isometric()` made gives the same answers.
- Refused here, never reached from StoryDeck: a hairpin path point further than 1,000,000 from 0, a floor label on a
  floor past 256 tiles, a speed that is no finite number above 0 (StoryDeck asks only within its 0.5–60 s range), and
  the bounds above.

## 0.16.0 — floor kept clear

- **`routes(things, links, { keep })`**: floor that words float over (`[{ at: [col, row, lift?], size: [wide, deep],
  name? }]`, at most 512). A route goes round it where it can — a stretch inside it costs 4 tiles a tile more — and
  where there is no other way runs over it; `under` names every area its drawn way passes strictly inside (feet's
  runs and ports' leads included, overlapping areas each named), present whenever `keep` is given. Kept floor is no
  thing: it never changes the lattice's step, it is asked at its own height, and marking it costs the lattice's work
  whatever the areas. Without `keep`, every route is as before (no `under` field). `MOST_KEEP` and `IsoKeep` are exported.

## 0.15.1 — long refusals print line by line; a far-off port says why

- **A refusal written on several lines carries them as `rows`.** A tool that prints this package's errors one line
  each (`errorText`) showed the storyboard and shot problem lists, the list of lines with no take, and the list of
  refused takes as one long line with `\n` in it. Each now carries `rows`, its own lines, so each prints on a line of
  its own. The message is what it was.
- **A port end on a coarse lattice says the things stand too far apart.** When things stand so far apart that the
  lattice is made coarser than its finest step, a port's run out to the lattice grows with it and may pass under
  another thing. That link said `NO_ROUTE.port` (a port closed in); it now says `NO_ROUTE.wide`, as a foot end
  already did. At the finest step it still says `port`.
- A test fix: the check that a route's `shared` is honest left out each route's short ends at its feet, so it now
  and then failed where a route's last short run lay on another's stretch and the router rightly said so. It compares
  the whole route now. The router is unchanged.

## 0.15.0 — ports: a link that plugs in where you say

- **Ports, in `footprint-story/isometric`.** A thing may name points on its sides where a link plugs in —
  `ports: [{ name: 'p1', at: [x, y, z] }]`, in its own tiles — and a link may end at one:
  `[{ thing: 'lap', port: 'rj45' }, { thing: 'sw', port: 'p1' }]`. The route leaves the port straight out of its side,
  drops to the floor, runs along the tile lines as any route does, and comes up into the other port, so the line ends
  on the port itself. Which side a port is on is read from the point (`face` names it, and must at a corner); a port on
  a back side is allowed, and the route says it starts behind its thing. Not yet: the top, and round things (refused,
  in words). `NO_ROUTE` gains `port` and `portName`; `MOST_PORTS` is 64; `readPorts` checks a thing's ports the same
  way, for a tool to refuse a wrong one in its own words.
- **`path` on every route**: the whole way in three dimensions, `[col, row, height]` from its first point to its last
  (out of a port at its height, down, along the floor, up into the other port). `ports` names the port at each end.
  A route with no port is what it was in 0.14 (compared on 2,583 random routes), with `path` its floor points and
  `ports: [null, null]` — but for one fix: two hidden stretches of a route that touch (or overlap) are one now in
  `unseen`, as its docs always said; a float test split them.
- `points`, `tiles`, `bends` and `unseen` are of a route's floor run; `path` adds each port's way out and riser.
- No route crosses a port's run out between two lattice points, nor hooks back across its own; a port's run laid
  across a route laid before it counts that crossing (`crosses`). A port within a billionth of a tile of a lattice
  line or of the floor is on it.

## 0.14.2 — a record with no log of the run's own is refused

- `whyFromRecord` walked a mounted chart's log as the run's own when the record held no log of the run itself. Such
  a record is now refused as changed. A log under a step the run never took is no mount of it: it is not read, and
  the answer says so first.

## 0.14.1 — a run that mounted a chart can say why

- **`whyFromRecord` reads a record that holds mounted charts' logs.** A run that mounts a chart (a subflow) writes
  that chart's log into the same file, under the run's address. 0.14.0 took it for a second run and refused the
  record as changed. The run's own log is now walked, and the answer says that a mounted chart keeps a log of its
  own. A second run in the file is still refused.
- A record written without what each stage had read (by a tool that did not yet keep the reads) says so under its
  answer, so a short walk is not taken for the whole story.

## 0.14.0 — why a value is so, and replies that stay the tool's own

- **`footprint-story/record`** (a new door, Node only): `whyFromRecord({ file, control, key })` says where a value
  of a run came from, from the run's record file alone — its value, the stage that wrote it, the decision that let
  that stage run and what each had read, walked back. `controlEdges(commitLog, recorder)` is what a run saves beside
  its record so the walk can cross a decision. The record is read as a file anyone may have written: bounded, one
  run, every line of the answer one line, and one that is not whole says so first. StoryDeck and StoryReel both keep
  such a record; this is the one reader for both. It needs `footprintjs` 14 and `foottrace` 2, as optional peer
  dependencies: no other door needs a package.
- **`oneLine`, `isOneLine`, `errorText`** (the root door): a row of a tool's reply is one line, whatever a project's
  files put in it. A line break, a control character, a mark that turns the reading direction and a character that
  draws nothing are shown as their escape, never obeyed. `errorText` says an error on one line, or on the rows its
  tool wrote itself (`error.rows`).

## 0.13.1 — a voice kit that hangs is stopped

- **`chatterboxKit` runs the kit within a time limit.** A kit that never finished (a model that does not load, a
  device that stalls) held its host for ever. It now has 10 minutes to load and 10 for each scene it voices; past
  that it is stopped, and the refusal says how long it had and how to give it longer (`minutes: { start, scene }`).

## 0.13.0 — the true room on a block's top

- **`grid.room(thing, high)`**: how wide an upright box `high` pixels tall may be on a thing's top, its middle on the
  top's centre (`round: true` for a round thing). The top of a block is a slanted diamond: across its middle it is as
  wide as the block's shorter side is long, and it narrows above and below. A name fitted to the rectangle round the
  top ran off a long thin block on both sides. It is a number: what `block` and `cylinder` give is plain data, as ever.
- **`wordsToFit(text, room)`** takes a function `(high) => wide` in place of `[wide, high]`, for a face that narrows:
  `(high) => grid.room(thing, high)`. Each line is measured across its own middle (the room is asked 0 for one line,
  one line's height for two).
- **Fixed, from 0.12.0: `routes` laid fewer links on a very big picture.** Saying where a route is hidden (`unseen`)
  was a second pass over its points, counted against the search's work (`MOST_WORK`), so the work ran out sooner: on
  60 things and 600 links, 406 were laid where 0.11.0 laid 557. Who hides a route and where are now asked in one
  pass, and the same links are laid as in 0.11.0. A picture the work covers was never affected.

## 0.12.0 — a picture that holds its links, and names that fit

- **`gridFor(things, box, { also })`**: floor points the picture holds too. A link that runs round a thing reaches
  past the things, and a picture fitted to its things alone cut it off: give `also` the routes' points.
- **`unseen`** on a route (`routes`): the stretches of it a thing hides, `[[from, to], …]` in tiles along the way from
  its start, right to the nearest half step, empty exactly when `behind` is. A packet riding the route can fade there; a check can say how long a
  hidden stretch is.
- **`wordsToFit(text, [wide, high])`**, in `footprint-story/isometric`: a name on one line, else on two (broken where
  the lines are most alike), else smaller, down to a least size — `{ lines, size, fits }`. `fits` is false when it does
  not fit even there, so a tool can say so and never hide a name: the whole name always comes back. Counted in letters
  (a mark on a letter and a zero-width character take no room): nothing here draws. A no-break space is never broken at.
- A refusal for a number too far from 0 now says the limit (1,000,000).

## 0.11.0 — links that lie on the floor

- **`routes`**, in `footprint-story/isometric`: the way each link runs along the floor, round what stands on it.
  `routes([{ name, at, size }], [[from, to]])` gives one entry a link: its `points` along the tile lines, from one of
  the two feet a viewer sees to one of the other thing's, the `feet` it uses, its `bends`, its length in `tiles`. It
  never passes under a thing that stands on its floor, keeps off floor a thing hides when it can, and takes the lane beside a route laid before
  it, so a request and its answer lie side by side. A thing straight in front of another, behind it or against it is
  reached too. The same things and links always give the same ways.
- **Each result says what happened.** `behind` names every thing that hides a point of a route, its feet too, `crosses`
  counts where it meets routes laid before it, `shared` is the tiles that lie on another's way for want of room, and a link with no way has
  `points: null` and `why` (`NO_ROUTE`: a name that is no thing here, a thing joined to itself, two heights, no
  place at a foot that can be seen, no way along the floor, too far apart for the smallest thing, too many links). `routeNote(route)` says it
  in words ("app to db: passes behind logs"), or null when a route lies well: a person or a model can change the
  picture without looking at it.
- **`rounded`**, in the same door: a way with its corners rounded. `rounded(points, radius)` gives `{ start, pieces,
  length, at(share) }`: a piece is a straight run or a corner (one curve, SVG's `Q`), and `at` is the point a share of
  the way along by length, so a deck's packet and a film's frame stand at the same place on the same way.
- Bounded: 256 things, 1,024 links (`MOST_ROUTES`), and a count of the search's steps (`MOST_WORK`): on a picture too
  big, the last links are not tried and say so. Every value is read by its own stored field, and a refusal says what
  to give. Where the methods come from: `src/isometric/REFERENCES.md`.

## 0.10.0 — places nobody types

- **`arrange`**, in `footprint-story/isometric`: where things stand on the floor, worked out from what is joined to
  what. `arrange([{ name, size }], [[from, to]])` gives each thing its `at`: a joined thing stands one step further along
  the cols than what leads to it, things led to from one place stand side by side along the rows, evenly either side of
  it, and the order within a step has few links that cross (the best of a few tries, not always the fewest). A ring of
  links is placed too, and things joined to nothing stand in rows past the rest, nearer the viewer. Two gaps, `gap`
  between things side by side and `step` between one step and the next: left out, `gap` is what lets the floor show
  between a thing and a taller one in front of it (1.22 tiles for each tile of the tallest thing's height, and half a
  tile, never under one), and `step` is a tile more (never under two), room for a link's arrow. Every slot is on the
  half tile, `cols` and `rows` are whole tiles (a
  floor that size lies under the arrangement, up to the 256 tiles a floor may be), and the same things and links
  always give the same places. What it
  returns is things a grid draws. Every value is read by its own stored value and bounded (256 things, 1,024 links),
  and a refusal says what to give. Not kept clear: a link that skips a step may pass a thing between.
- **Across the frame.** `arrange(things, links, { across: true })` runs the steps across the frame, left to right,
  where a chain along the cols runs down a long slant: it fills a frame wider than it is tall. The things of a step
  stand one below the other, the middle of every thing is on the half tile, and a step is one tile, because no step
  stands in front of the next.
- **`gridFor`**, in the same door: the grid on which placed things fill a box of the frame, `gridFor(things, [x0, y0,
  x1, y1])` — a two-to-one tile a whole even number of pixels wide (24 to 160, or `least` and `most`), the picture in
  the middle of the box.

## 0.9.0 — an order written once, and a floor seen from a corner

- **Turns**, in `footprint-story/motion`: an order written once, for a click of a deck and a beat of a film.
  `readTurns('camera laptop (dns server) w1:1.2 db')` reads names in the order they come, `(a b)` as names that come together
  and `name:seconds` as a turn's own time. `turnTimes(turns, { step })` says when each turn starts, when the last one starts
  and when it is over. `writeTurns` writes the form back. Names alone read as a plain list, so an order written before
  turns keeps its meaning. Text from anyone is bounded while it is read, a name with a character nobody can see is
  refused, a list is read by its own stored values (a hole is refused, a getter is never run), and every refusal says what
  to write. Seconds are kept to the millisecond, so what is written reads back. `stagger` is unchanged.
- **An isometric grid**, in a new door, `footprint-story/isometric`: a floor of tiles seen from a corner, as numbers.
  `isometric({ tile, origin })` gives where a point lands (`at`) and the way back (`tileAt`), the three faces of a box
  (`block`), a round thing's two ellipses (`cylinder`), the tile lines (`floor`) and a line along the floor (`route`).
  `grid.backToFront` gives the order to draw things in: only things that meet on the frame are ordered, so a long box
  beside a short one is drawn right, and a true ring of boxes is cut inside itself, never across to another thing or ring. A cube looks like a cube:
  the grid is checked against a camera with no depth, and the order against lines of sight worked out apart from the
  code. A tile's height is the height the viewer stands at, so the usual two-to-one view and the true isometric are both
  here. Nothing here draws, and no tool reads it yet.
- **`storyboardBrief` says how many entries each list holds**, and that every field not marked (optional) is needed. In a
  real run a model wrote four `found` entries without their `notes`, was refused, and had to be asked again: the brief
  gave the character limits and never the counts. The numbers come from the same table the reader checks a board
  against (a shape's `counts`), so the two cannot drift. Nothing a board may hold changes.

## 0.8.0 — a chatbot session read as a conversation

- **`sessionReader()` and `readSession(text)`**, in `footprint-story/storyboard`: a chatbot session file read as a conversation
  a storyboard can cite. It keeps what the person said and what the assistant answered, one turn per message with a short id,
  and counts what it left out by kind: tool calls and results, private thinking, the host's own notes, odd lines. It reads no
  file: a host hands it lines as it reads them, so a session bigger than memory works (a 795 MB Claude Code session reads in a
  few seconds). A line that is not JSON, too long, or of an unknown kind is counted and skipped, never thrown on.

## 0.7.0 — what to fix in a refused board, and a camera checked in words

- **Shots**, in a new door, `footprint-story/shot`: a camera in 3D as plain data, in the words a film and a deck already use.
  `readShot({ on, from: 'front-left high', size })` reads a shot, `frameOf` turns it into a camera, `project` and `boxOf` say where
  things land, and `shotLine(checkShot(scene, camera, frame, shot))` says in one line what the camera sees: how much is in frame,
  how big, what covers it and how many other things it was tested against, whether it is sharp, and what to do about any of that. It works without a picture and reads any
  camera, including a film's own numbers. It knows only the things it is given. Nothing here draws, and no tool reads a shot yet.
- **`storyboardFixBriefs`**, in `footprint-story/storyboard`: what to fix in a refused storyboard, piece by piece. It takes the
  board and its problems, and gives one short brief per piece at fault: the problems, what the piece says now, and the messages it
  cites. Every problem is still named at once. A host that keeps its board can change just those pieces. Nothing here takes a
  piece as an answer, so the host says what form to answer in. The instructions stay the same whatever the board or the
  conversation says, the words come apart from them as data, and a huge board or message still gives a short answer.
- **`dataLine`**, in `footprint-story/storyboard`: one value as one line of JSON. Line ends, tag characters and direction controls
  are escaped, so words in it can't start a line or hide text, and it parses back exactly. The material of `storyboardBrief` uses it.
- **`storyboardBrief` no longer asks for the whole object again** after a refusal: it asks to fix every problem and leave the
  rest as it is, and says the refusal gives the form to answer in.
- **A problem lists at most three of a claim's sources**, then how many more, and a long number or id is shortened, so the words
  that say what to do are never lost.

## 0.6.0 — one narration step for a film and a deck

- **`narrate`**, in `footprint-story/voice`: the one narration step StoryDeck and StoryReel share. `narrationVoice({ cache, kit, takes })`
  picks the voice a person named, `narrate(lines, { cache, profile, engine })` voices what is missing, and with no engine only
  reads, and `narrationSummary(report)` says what is done and what to do next.
- **A clip cache may have come with someone's folder.** A link at a clip's name is no clip: it is never read, and voicing replaces
  it instead of writing through it. A torn or foreign record, or one with no sound beside it, counts as not voiced, so it is
  voiced again where it used to throw or to hand back a sound that was not there.
- **A voice kit's own output goes to stderr**, so a command's answer on stdout stays its answer.

## 0.5.0 — what a model needs to write a storyboard

- **`storyboardBrief`**: what a model needs to write a storyboard, for any model, from a template and a conversation. The
  instructions and the conversation come back apart, so the conversation's own words can be sent as data. The library
  holds no model.

## 0.4.0 — a story written as data

- **storyboard** (`footprint-story/storyboard`, a fourth door, pure, loaded only when imported): a story written as plain
  data on a named shape, for a film and a deck to draw the same way. `storyShapes` lists the shapes with a worked outline,
  `storyboardProblems` names every mistake at once, and `readStoryboard` gives frozen scenes, each usable as a scene of a
  film's storyboard as it is. Two shapes: `told-twice` and `what-we-found`. Given a conversation, a claim must cite the
  messages it rests on, and its numbers must be in them. What a model writes must use plain digits: a disguised number is
  refused. Nothing here draws.
- The architecture test now checks four doors.

## 0.3.0 — footprint-narration is now footprint-story, and the motion words join it

**Renamed.** The package is `footprint-story` from this version: what a film (footprint-storyreel) and a deck
(StoryDeck) share, not only their narration. `footprint-narration` stays on npm at 0.2.0 and gets no new versions;
there is no copy under the old name. To move: replace `footprint-narration` with `footprint-story` in your
`package.json` and your imports — `footprint-story` and `footprint-story/voice` export exactly what the two old
doors did. A voice batch's temporary folder is now named `footprint-story-voice-…`.

- **motion** (`footprint-story/motion`, a third door, pure, loaded only when imported):
  - **ease, spring, moves**, moved from footprint-storyreel 0.23.0: the ease table and CSS `cubic-bezier`, the
    springs by feel, the named moves and their laws. What they give and how they refuse is unchanged — pinned by
    property tests against copies of that code (`test/control/storyreel-0.23.0-*`).
  - **transitions**: the editor's changes of picture (cut, fade, dip, wipe, split, clock, iris, push, slide, whip,
    zoom, page, through, match) as data — family, seconds, ease, sound name, settings — with `readTransition`,
    `checkTransition` and `extendTransitions` for a drawer's own. Nothing draws here.
  - **settings**: the one settings reader, as StoryReel 0.23.0 had it.
  - **pace**: `lesson` (StoryReel's slideshow numbers) and `promo` (a published launch film's checks), or your own.
- The architecture test now checks three doors: the main door never loads motion, and the motion door reaches
  nothing else.

### Differences from the code it replaced

- A point setting's default may be `'centre'`: the middle of the frame it is read for (`readSettings(…, { frame })`,
  1600×900 unless given). The shared transitions use it for `iris` and `zoom`, so a deck's 1920×1080 slide gets its
  own middle; on a 1600×900 film it is [800, 450], as before.
- A box setting's refusal names the frame's own size (1600×900 unless given).

## 0.2.0

Your own voice, recorded. A second adapter of the voice port voices a deck or a film from takes you read
yourself, lined up to their text the same way a cloned clip is.

- **voice** (`footprint-narration/voice`): `recordedTakes({ kit, takes, … })`.
  - **Find.** Each line's take is found through `takes.json` (text → file), matched word by word: "a part" is not
    "apart", while a curly quote or a dropped comma still finds its take. Every file must really be inside the
    takes folder (symlinks and the disk's own case are resolved), and every line without a take is refused at once,
    as lines ready to paste into `takes.json`.
  - **Trim.** ffmpeg cuts each take to exactly the kit's 0.2 s lead and 0.4 s tail, padding with silence where a
    take starts or ends at once, and caps inner pauses at 0.6 s. A short word at either end is kept.
  - **Align.** The kit's MMS_FA aligner runs offline through the shipped `align_take.py`, which refuses rather than
    downloads its weights.
  - **Check.** Words are scored as the kit's `check_words.py` scores them; low words are reported.
  - Each clip keeps a `take` record of what was cut, added and heard. The recording session is its own profile
    (`take-<hash>`), so a recorded and a cloned line of the same text never share a clip; `clipKey` is unchanged.
- `clipFor` returns a new `take` field (`null` for a clip a voice made).
- `voiceClips` hands every scene and the `work` folder to an engine's optional `preflight` before the first batch.
  It refuses a recorded engine with any other profile and a recorded profile with any other engine, and a `work`
  folder that is, holds or lies inside the takes folder (it is emptied before each batch). Calls with no engine and
  other engines' own `profile` fields behave as before.
- `chatterboxKit` takes an absolute `python` path as given.

## 0.1.0

The first release: the narration code that StoryDeck 0.2.0 and footprint-storyreel 0.9.0 each kept, moved into
one package both use.

- **spoken** — `spokenMap(text, { slots, rules })`: one text as shown and as spoken, piece by piece, with its
  letters-and-digits map. Slots (`checkSlots`, `findSlot`) come from footprint-storyreel's `say`; the automatic
  rules (`autoRules`, `SPELL`, `SAY`, `numberWords`) from StoryDeck's `narrationSummary`. `shownWords`,
  `spokenOffset`, `unsaidDigits` and `normSpeech` work on either.
- **sentences** — `sentences`, `saidSentences`, `sentenceStarts` (StoryDeck).
- **captions** — `captionCues` (StoryDeck), `captionChunks` / `captionAt` / `FILE_CHUNKS` (footprint-storyreel, now on
  tracks), ONE writer `captionFile` with `stamp`, and its reader `readCaptions` (footprint-storyreel).
- **chapters** — `youtubeChapters` (footprint-storyreel's rule, now with a report of what it changed), `clockText`,
  `readChapters`.
- **voice** (`footprint-narration/voice`, Node) — `clipKey`, `clipFor`, `voiceClips`, `pickSteps`, `chatterboxKit`
  (StoryDeck). A clip's `.json` now keeps its timed `words` too; `clipFor` returns them (`null` for a clip voiced
  before, or by an engine that aligns none). Clip keys are unchanged.

### Differences from the code it replaced

Pinned by the property tests in `test/`, which compare generated cases against copies of that code
(`test/control/`); each test leaves out exactly the cases named here.

From StoryDeck 0.2.0 (`storydeck/narration`, `storydeck/voice`):

- **What a rule says is final.** A spell value is not read again by a later spell entry or by the symbol rule:
  `{ A: 'B', B: 'C' }` says "B" (0.2.0 chained to "C"); `{ alpha: 'α' }` says "α" (0.2.0 then said "alpha").
- **A spell or say list is checked.** A key must be one word — not empty, no white space (0.2.0 also matched a
  multi-word key). A value must be words, a letter in every word, no digits, and no comma, semicolon or colon at
  its end: `{ Win: 'Windows 11' }` is refused (0.2.0 said "Windows eleven"); write `'Windows eleven'`. A value's
  white space is tidied — trimmed, one space inside — so `{ X: 'x ' }` no longer splits the word after it.
- **A million is a million.** Numbers from 1 000 000 are said in millions, billions and trillions (0.2.0 said
  "one thousand thousand"); a run of more than fifteen significant digits is said digit by digit (0.2.0 overflowed
  the stack past 308 digits). `numberWords` refuses anything but a whole number from 0 to 999 999 999 999 999.
  Every number under a million is said as before, zero-padded or not.
- **One caption writer.** WebVTT cues are numbered; a cue's text longer than 42 characters breaks onto two lines at
  the space nearest its middle (`lineChars: Infinity` keeps one; a long sentence makes long lines — nothing is cut);
  breaking white space in a text is one space (a no-break space stays); a cue shorter than 0.05 s, or with nothing
  to show, is left out. SRT files are otherwise as `toSrt` wrote them. `toSrt` / `toVtt` → `captionFile`.
- **Chapters are fixed, then reported.** `youtubeChapters` replaces `chapterList`: it moves the first chapter to
  0:00, lets an opening card under 10 s yield 0:00 to the next, merges a chapter shorter than 10 s into the one
  before, drops a last one shorter than 10 s — and lists each change. `problems` keeps only what it cannot fix
  (fewer than three). `clock` → `clockText`.
- `pickSteps` refuses anything but steps and ranges ("1-3,7"); 0.2.0 gave `NaN` steps. `voiceClips` works in a
  `footprint-narration-voice-` temporary folder and logs "N clips wanted · M to voice · the rest are cached".

From footprint-storyreel 0.9.0:

- `captionChunks` takes tracks (`[{ offset, duration, words }]`) instead of a film, and each chunk also carries its
  `text`. The chunks are otherwise the same, word for word and time for time.
- `captionFile` escapes WebVTT's `& < >`, never writes `-->` inside a text, makes breaking white space one space (a
  no-break space stays) and leaves out a cue with nothing to show; for every text without those, its bytes are the same.
- `readCaptions` also reads WebVTT's escapes (`&amp;` `&lt;` `&gt;` `&nbsp;` as a no-break space, `&lrm;` `&rlm;`) and a
  leading BOM.
- `youtubeChapters(marks, { length, min })` takes `[{ at, title }]` and returns `{ lines, text, kept, changes,
  problems }` (`lines` is what 0.9.0 returned); an hour is written `1:00:00` (0.9.0: `60:00`), and every mark past
  the video's end is dropped (0.9.0 dropped one). A title is one line (white space tidied); a mark without a title, or
  with a time that is not 0 or more seconds, is refused (0.9.0 wrote it as given).
- `findSlot` finds an empty shown text nowhere (0.9.0's, private there, would never return) and refuses a text
  that is not a string.
- `spokenMap` refuses a slot list `checkSlots` refuses (0.9.0's `slotPieces` stopped quietly at the first slot it
  could not find). `checkSlots` names the list by its `field` (`'slots'`; StoryReel passes `'say'`, so its
  messages are unchanged).
