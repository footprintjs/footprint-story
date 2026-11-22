# Changelog

## Unreleased — a name's ink

- **The ink a name reads in on a face, once for both tools** (`src/isometric/colour.js`, on the isometric door):
  `readableInk(face, inks, {least})` gives `{ink, ratio, reads}` — the first ink (in the caller's order) that stands
  `least` : 1 on the face (default 4.5, WCAG's small text), else the best one with `reads: false`, never a failing ink
  as if it passed. StoryReel 0.49.0 had this rule in its own code (`looks.mjs` · `nameInk`); StoryDeck needs it too.
  `readableInk(face, [look.ink, look.bg]).ink` is StoryReel's `nameInk(face, look)` exactly — on its golden faces and,
  as a property, for any face and any two inks against a copy of its code (`test/control/storyreel-0.49.0-nameInk.mjs`),
  its ratios equal to the last bit — so it can switch with no picture moving.
- **The measures behind it, on the door:** `luminance`, `contrastRatio` (WCAG 2, unrounded: `#777` on white is 4.48,
  `#767676` 4.54, both pinned) and `deltaE76` (CIE76 in CIELAB, D65; black to white 100, sRGB red where its published
  Lab puts it). `luminance` and `contrastRatio` moved here from `duotone.js`, which now uses them; the duotone test's
  own ΔE copy is gone, it measures with `deltaE76`. Nothing draws differently.
- **The duotone's tint of an untoned block stays apart from ok / warn / bad** (pinned): StoryReel 0.49.0 hands an
  untoned block the usual tone (`#d9e4f3`) so the duotone tints it orange, and warn is orange too. Ours: more than
  ΔE76 10 from every status face — the floor the status faces keep from each other, one number for "apart at a
  glance" — on every face, for four sets of tones (ours, StoryReel's paper and storybook themes, the tools' default
  tokens), on a light page and a dark one. The nearest is 12.2 (warn, paper theme, the lit top; its faces 12.6 / 16.5 /
  12.2, as StoryReel's review measured). The tint clears the floor and did not move.

## 0.36.0 — a sketch drawn faster than a hand draws says so

- **A new finding a tool will now see: the critic `pace` on `hand-sketch`** (`src/human/strokes/pace.js` · `pace`,
  `PACE_MOST`). Until now a `do: 'sketch'` asked for in too short a `seconds` was squeezed with no word: the plan keeps
  every stroke and every share of each time, so `pen-lifts`, `stroke-order` and `hatch-gaps` (which read the order) and
  even `pen-speed` (which reads the bends) all pass it. `pace` reads the speed itself: each stroke's length at a hand's
  usual speed for its layer (400 px a second along a line, 800 along a fill), over the seconds the plan gives the pen
  down. Past 2× (ours: a hand in a hurry draws about as fast again as the usual quick, sure hand; faster reads as a
  recording run fast) it warns, and the fix names the seconds the drawing needs, rounded up:
  `slow it: seconds: 1.07 (or more; 2.14 draws it at a hand's own pace)` for the house of Nikolaus asked for in 0.05 s
  (42.7× a hand's pace). A `speed` too high is the same finding, with the same fix. It lands where every finding does:
  `checkMove(...).findings`, `planIntents`' `findings` and its key `findings-<i>`, the human flow's record. A tool that
  keeps a fast drawing on purpose accepts it by its name, `'pace'` (it is in `HUMAN_CRITICS`).
- **Nothing draws differently.** Plans, seeds, reasons and samples are 0.35.1's byte for byte (digests taken on 0.35.1
  are pinned); a drawing at its natural pace, or slower, measures 1 or under and gives no finding (pinned, and a
  property test over random drawings and seconds: the pace is the natural seconds over the seconds asked, and following
  the fix clears it). `hand-sketch`'s `checks` now end in `'pace'`, so `checkMove` gives one more measure and basis.
  The sketch critics' reader (`critique.js · sketchOf`) also carries a stroke's own `length` when it gives one.
- **The docs say what the order critics cannot see** (`src/human/strokes/README.md` · *What each critic can see*): on
  simple input — the fewest strokes, outline first, no fills — `pen-lifts` and `stroke-order` measure 0 and
  `hatch-gaps` null whatever the timing, because `hand-sketch` makes its order by the very rules they check.

## 0.35.1 — the check on the place along a rounded way

- **A test asked the wrong thing; the code was right, and nothing draws differently.** The property "rounded: the place
  along a way" said that 200 even steps along a way add up to at least 98% of its length. A step that crosses a corner
  cuts it, and at a hairpin (two runs nearly back on each other) it cuts almost a whole step, so a way of several
  hairpins falls short by more than any fixed share — seed 857978823 found one at 97.99% (the same way with sharp corners
  reaches only 98.3%). `way.at` was measuring the way correctly all along.
- **The check now asks laws that hold exactly:** `at(0)` is the start and `at(1)` the last point; every place is on a
  piece of the way (a straight piece, or inside a rounded corner's triangle); no step is longer than its share; and a
  step along one straight piece is exactly its share (within 1e-6, the last digits), so the walk can neither jump nor
  dawdle. A walk that lags, or one that slides unevenly along a straight piece, fails it (both were tried). The
  counterexample is pinned as a plain test, and the property now runs `FC_RUNS` times when that is set.

## 0.35.0 — named looks: paper grain and duotone

- **Two more named looks** (`src/isometric/looks.js` · `ISO_LOOKS`), each a style row under a name, as 0.34.0's:
  `{look: 'paper-grain'}` (`{texture: 'human:grain'}`: today's look printed on paper, a fine, faint, seeded grain over
  every face) and `{look: 'duotone'}` (`{palette: 'duotone'}`: two inks on paper). Named or written out, the same row,
  seeds and paint list; the record keeps `style.look`; `restyle` carries it.
- **The texture `human:grain`** (`src/human/strokes/grain.js` · `grainTexture`, `GRAIN`, `MOST_GRAIN_MARKS`): in each
  face, three sets of lines at seeded angles 16 px apart across, clipped by the hatch's own `hatchLines` (no second
  clipper), each broken into seeded marks 1 to 3 px long with gaps of 12 to 36 px; one `lines` item a face (role
  `grain`), the ink at 22%, 0.75 px — about 1.5 : 1 against its face (pinned under 1.6). No timing, so nothing is left
  out of its seed. Options `spacing` (4 to 200 px), `width` (0.25 to 4), `alpha` (0.02 to 1). **A big face is thinned,
  never refused:** past about `GRAIN.cap` (2048 marks, half an item's most) it is laid at a wider spacing and its role
  says so (`grain-thinned`) — a 10 × 10 slab fitted to 1920 × 1080 builds under both policies, its top at about twice
  the spacing (pinned). All numbers ours, with their WHY in grain.js. It is a `human:` choice because the clipper lives
  in src/human, which the isometric door never loads: hand it in `choices`. **`HUMAN_STYLE_CHOICES`** (the human door)
  lists every choice it ships, so a tool that hands that list in takes the next one without a change.
- **The palette `duotone`** (`src/isometric/duotone.js` · `DUOTONE`, exported): every stroke the `ink` (`#22304a`, its
  alpha kept), every fill with a colour the `paper` (`#ffffff`) mixed toward the `accent` (`#e07b39`) by how dark the
  fill it replaces is, at most 60% (`mixColour`) — the shading's order survives and white stays the paper. **Colour
  that means something survives:** a fill whose colour the page decides is left as it is, recipe and all — that is
  where the tools put ok / warn / bad (StoryReel's tones, StoryDeck's classes) — so ok / warn / bad stay at least ΔE76
  10 apart on every face (pinned; ours). A map built with no colours keeps its faces the page's and prints its lines in
  the ink. A name in the ink keeps WCAG's 4.5 : 1 on every tint (7.0 : 1 at worst for the usual inks; 9.4 : 1 in the
  tools' usual ink `#14181f`; a property over random pieces and bases), and inks that cannot are refused when the style
  is made. The duotone moves no point, on any kind of piece (a property).
- **Refused, with the fix:** the grain or the hatch beside a duotone (the texture runs after the palette, in the map's
  ink — a third ink), with the words naming the entry that came from the look; a look whose column is written beside it
  (`{look: 'duotone', palette: …}`: it would draw nothing); `{look: 'paper-grain'}` with no `human:grain` handed in;
  grain options out of range; duotone inks that are no colour or under 4.5 : 1. A refusal for a choice not handed in
  now says when the entry came from a look (that text is new; every other refusal is as it was).
- **The tools' budgets** (pinned on the record-size test's 64-block world): 358 items, 179 of them grain `lines`, 0
  `stroke` items (StoryDeck's and StoryReel's 2000-stroke notes count `stroke` items), 13,118 marks, 0.33 MB written as
  SVG path data — under StoryDeck's 2 MB. **The map flow's record stays small:** that world's commit log is 90,719
  bytes with the grain (90,679 plain), pinned under the plain bound.
- **Unchanged:** every existing style and both 0.34.0 looks draw byte for byte as before (3,000 random maps compared with
  0.34.0, ten styles with and without colours, both policies); both tools' painters draw the new lists as they are.
- **For the tools:** each needs the 0.34.0 reader change to accept `look`, and to hand `grainTexture` in (or replace its
  own list, `[sketchyLine, hatchTexture]`, with `HUMAN_STYLE_CHOICES`). StoryDeck writes a map's `lines` again on every
  click (only `stroke` runs are written once), so a 64-block grain map carries about 0.33 MB a click. On a duotone map,
  draw names in the duotone's ink (`style.options.palette?.ink ?? DUOTONE.ink`) or a darker one; to print a face in the
  duotone's tints, give its piece a base colour (a face the page colours stays the page's). **On a dark page**, pass
  the page's colours: the duotone's `paper` and `ink` (`palette: {name: 'duotone', paper, ink, accent}`), and a paper
  shading's `shading: {name: 'paper', colour}` — with the light defaults, names over a light floor tint read at about
  1.1 to 1.4 : 1 on StoryDeck's dark theme. A tool may note faces whose grain was thinned (role `grain-thinned`).
- README stills (`src/isometric/look-paper-grain.svg`, `look-duotone.svg`) written from a real map by
  `test/isoLookStills.js` and pinned. Tests: `test/isometric-looks-grain-duotone.test.js` (each list, marks inside their
  faces for any piece on any grid, seeds, geometry to 1e-6, budgets, contrast, refusals, the record); the map flow's drift
  property runs both looks; `test/mapflow-record-size.test.js` pins the grain world's record. Types: `IsoLookName`,
  `ISO_LOOKS`, `DUOTONE`, `grainTexture`, `GRAIN`, `MOST_GRAIN_MARKS`, `HUMAN_STYLE_CHOICES`.

## 0.34.0 — named looks: outlined and line art

- **Two named looks** (`src/isometric/looks.js` · `ISO_LOOKS`): a look is a style row under a name, data only. A tool
  names one in the row it already hands `isoStyle` or a map spec: `{look: 'outlined'}` (a bold, even contour round each
  piece and lighter inner lines over today's tones — the sticker look) or `{look: 'line-art'}` (white paper faces, ink
  lines only: silhouette 3 px, folds 1.25 px, the floor's tile lines faintest). A column written beside a look replaces
  its entry, whole (`{look: 'line-art', texture: 'human:hatch'}`). Named or written out, the same row, seeds and paint
  list; the record keeps the name beside the row (`style.look`, and a built map's `map.style.look`), absent when none is
  named, so every other record is as before. `restyle` carries it.
- **Two new choices** (`src/isometric/styleChoices.js`): line `contour` (options `width`, the contour as it shows, 1 to
  20 px, 5; `inner`, 0.25 px to the width, 1.5 — `CONTOUR`, ours) and shading `paper` (option `colour`, `#ffffff`). The
  contour is each face again under the faces with no fill and a wide stroke (role `contour`), trimmed to an even outside
  band by the faces' fills — no silhouette worked out, no new item kind. A paper fill carries its colour even with no
  base given. Both tools' painters draw these lists as they are: no painter change.
- **Refused, with the fix:** a look that is not one; a look whose every column the row writes itself (it draws nothing,
  so the record would name a look that drew nothing — drop the look or the column; `restyle` leaves the look's own
  columns to it, so a record made again is the style it was); `shading: 'paper'` with `line: 'none'` (saying when the paper came
  from the look); a contour width or inner out of range, or an inner bolder than the contour; a paper colour that is no
  colour; a tool's own shading that leaves a face unfilled under the contour (on the piece).
- **Known limits** (src/isometric/README.md): the paper is `#ffffff` unless a tool gives its page's (`shading: {name:
  'paper', colour}`) — a dark page should; and touching pieces get no draw-order rule, so a later band lies over its
  neighbour's edge.
- **For the tools:** StoryDeck's `data-style` reader and StoryReel's `readStyle` check a row's keys against
  `ISO_STYLE_COLUMNS`, so each needs a small reader change to accept `look`; until then each can write a look's row out
  (`line: contour`; `shading: paper; line: contour width 3 inner 1.25`), which draws the same.
- README stills (`src/isometric/look-outlined.svg`, `look-line-art.svg`) written from a real map's paint lists by
  `test/isoLookStills.js` and pinned. Tests: `test/isometric-looks.test.js` (each look's list, geometry to 1e-6, seeds,
  refusals, the record, faces unmoved for any piece on any grid); the map flow's drift property now runs the looks.
  Types: `IsoLookName`, `IsoStyleRow.look`, `IsoStyle.look`, `ISO_LOOKS`, `CONTOUR`.

## 0.33.1 — a map flow's record keeps the paint lists as counts and a digest

- **`runMapFlow`'s record no longer keeps every paint item's points** (`src/mapflow/summary.js`, `src/mapflow/flow.js`).
  The `style` stage wrote the whole paint lists into the run's state, so the record kept every polygon and every
  hand-drawn stroke with all its points: a 64-block world with `human:hatch` made 12,418,111 bytes of commit log, and
  footprintjs's file sink refused the `style` entry (over its 8 MB `maxEntryBytes`), so the record file held no style
  stage at all. The lists are derived from what the record already keeps (the spec, the policy, the choices' names in
  `style.row`), so the stage now writes a summary under the same keys: `{pieces, items, byItem, points, perPiece,
  digest}`, the digest FNV-1a (`src/seed/seeded.js` · `fnv1a`, the seed's own hash, now exported from that leaf) over the
  lists' JSON with keys sorted. That world's record: 90,778 bytes, every entry written; a plain one 90,679 (was 144,017).
  Pinned under 300 KB by `test/mapflow-record-size.test.js`.
- **The map is unchanged.** `runMapFlow`'s `map` still holds the full lists, equal to `buildIsoMap`'s: the stages keep
  them in a place of `runMapFlow`'s own, outside the run's state. Both drift properties now also check that the record's
  summary is the summary of the built lists.
- **Changed for a reader of the snapshot:** `snapshot.sharedState.paints` / `.floorPaints` (and the record's values at
  those keys) are the summaries, not the lists; `mapFlow()` run by hand keeps the summary only. The record's keys are
  the same, so `log --why paints` (StoryReel, StoryDeck) answers as before, now with the summary; neither tool needs a
  code change.

## 0.33.0 — hand-drawn maps

- **A map can be drawn by hand.** `buildIsoMap(spec, policy, {choices})` and `runMapFlow(spec, policy, {choices, sink,
  recorders})` take a tool's own style choices beside the spec and the policy (`[sketchyLine, hatchTexture]` from
  `footprint-story/human`), so a style naming `human:sketchy` / `human:hatch` builds under `film` or `deck`; before, the
  steps refused both. Each step gets them as `run(state, tools)`; `mapFlow({choices})` binds them into the chart (the
  humanflow way), so state never holds code and the record keeps the names (`style.row`). Refused by name: a settings
  key but `choices`, a getter, a bad choice; a style naming a choice not handed in (in the map's `who`, with the fix); a
  hatch too close for its piece (now in the piece's `who`: the `style` step wraps what a choice throws, as `shape` does,
  the original as `cause`). Only paint lists change. The flow's map equals `buildIsoMap`'s with hand-drawn rows (a property).
- **The seed leaves timing out.** A choice may name options that are timing (`unseeded`, each one of its `options`);
  they are left out of its seed. `sketchyLine` names `speed`: a faster pen draws the same wobble (`UNSEEDED_KEYS`' rule).
  A style writing none of them is seeded as before. A pinned map's pen points are held to 1e-6.
- **Stroke ends: the cap is in the ring.** `strokeOutline(points, {cap})` (now `src/human/strokes/outline.js`) caps both
  ends as one ring a painter fills: `round` (a half circle, `CAP_STEPS` 12), `butt`, `square`. **Changed:** with no cap
  it gives round ends, as `strokeItems` writes the cap (it gave flat ones: StoryDeck drew flat ends, StoryReel its own
  circles); `{cap: 'butt'}` is the old ring. A one-point stroke is a dot; a bad cap or point is refused.
- **`strokeAt(points, t)`: a stroke as drawn by a time** — the points at or before `t`, then the pen's place at `t`
  between the two around it (x, y, width linear); `[]` before, the whole stroke after. `strokeOutline(strokeAt(points,
  now - start), {cap})` is the partial ring, its cut end capped — one rule for both tools.
- Tests: `test/human-strokes-outline.test.js`, `test/hand-drawn-map.test.js`. Types: `IsoMapSettings`,
  `IsoStyleChoice.unseeded`, `strokeAt`, `STROKE_CAPS`, `CAP_STEPS`, `strokeOutline`'s options.
- **Fill a stroke's ring by the non-zero rule** (SVG's and a canvas's default): the ring can cross itself at a round
  cap on a short, sharply turning stroke, and even-odd would leave a hole there. Seeds change for a style that writes
  `speed` (it is left out of the seed now, as timing); every other style's seed is as before.

## 0.32.4 — `mixColour` reads a colour as the rest of the package does

- **`mixColour` takes `#rgb` as well as `#rrggbb`, any case, and refuses anything else**
  (`src/isometric/paint.js · mixColour`). It had its own parser, which read only `#rrggbb`: `'#abc'`, a colour every
  other door takes, came back as `'#5606NaN'`, and `'red'` as a colour of `NaN`s. It now reads both colours with
  `readColour`, the one colour reader, so `'#abc'`, `'#ABC'` and `'#aabbcc'` mix the same, and `'#ab'`, `'red'` or
  `'#abcd'` is refused naming which colour it was. A `#rrggbb` mixes exactly as before, so nothing either tool draws
  changed; StoryReel's kit keeps its own mix only to read `#rgb`, and may now ask this one.

## 0.32.3 — an arc with a radius of 0 refused, by name

- **A paint list's `arc` with `rx` or `ry` of 0 is refused** (`src/isometric/paint.js · checkPaint`), naming the item
  and the fix: give both radii above 0, or write a `['line', x, y]` to its end. WHY: the two tools drew it differently —
  SVG takes such an arc as a straight line between its ends (and nothing when they meet), a canvas walks the flattened
  ellipse, which can run past an end and back. This package's own choices never write one (a cylinder's radii come from
  its size, above 0); a tool's own style choice that wrote one is now refused before anything is drawn.
- **Docs:** the line a painter writes to an arc's start is none when it has no length — when the pen is already there,
  as on a cylinder's side (`paint.js`, the isometric README, `isometric.d.ts · PaintItem`). Pinned: the usual cylinder's
  side reaches its arc from where its edge ends, on three grids.

## 0.32.2 — a map's `who` counted in letters, as a name and a label are

- **A `who` is counted in letters (code points), not UTF-16 units** (`src/isometric/mapSpec.js · whoOf`). A name and a
  label already counted letters, so the same 200-letter limit refused a `who` of letters from beyond the Basic
  Multilingual Plane ("𝒜", an emoji) at 101 of them. Now 200 such letters are taken and 201 are refused, for a piece and
  for the map. Nothing either tool draws changed; a `who` that was taken before is still taken.

## 0.32.1 — a cable test that held the film's labels to the old rule

- **A test fix only: no code changed, nothing either tool draws changed.** The property test "StoryReel's straight
  wires and their labels, at a film's tile sizes" (`test/cable-differential.property.test.js`) failed with fast-check
  seed 580667364. It compared footprint-story's labels with StoryReel 0.34.0's own label rule, but footprint-story
  places labels by StoryDeck's rule, and StoryReel now asks footprint-story (`labelPlace`). The two rules part in a
  third way, now named: StoryReel 0.34.0 also asked a block whose box only touches the label's plate, and counted a
  point on a block's left or top edge as hidden. At tile 68 a plate that exactly fills the gap between two blocks was
  "hidden" there and moved partly under one; by StoryDeck's rule (and footprint-story's, and the film's today) it stays
  at its cable's middle.
- **What changed:** the property now holds the labels to StoryDeck 0.29.0's rule (its control copy) run on the cables
  StoryReel 0.34.0 laid; the cables are still held to StoryReel 0.34.0. The counterexample is a plain unit test beside
  the two differences already named.

## 0.32.0 — moving pieces on a map, one copy

- **The number rules a moving block is placed by, on `footprint-story/isometric`** — moved from StoryReel 0.44.0
  (`src/kits/isometric/motion-place.mjs`, `motion-cover.mjs`, `motion-side.mjs`) and StoryDeck 0.37.0
  (`deck/motionPlace.js`, `motionPlan.js`), which held the same rules twice. Tools can now import:
  - `footOf`, `topOf`, `cornerOf` — a block's foot (the middle of its footprint, at its lift), its top, and its corner
    back from its foot;
  - `landingUnder` — the highest top under a block that is not above its foot, else the floor (an overlap past
    `SAME_PLACE`, 1e-6 tile); `overTop` — whether a foot is over that top, edges included;
  - `ridesOn(rider, base)` — whether one block rests on another's top (the rider rule: a tool refuses moving the base);
  - `footTiles(grid)` — a moving foot in tiles from where footprint-story/human's sample draws it, on the move's way;
    `sideFoot`, `worldPx`, `LEVEL_SNAP` — a side-on sample (roll, slide, tumble) laid back on the floor along its way;
  - `sweptThrough`, `THROUGH_MOST` (0.05 tile) — the block a move goes deepest into on a straight stretch, swept by
    golden-section search, never sampled; `checkMoments`, `CHECKS_PER_SECOND` (30), `MOST_CHECKS` (900) — the moments a
    move is checked at; `deepestPass` — the deepest pass over a move's stretches, and when; `passFinding` — it as a
    finding, critic `'contact'`;
  - `offFrame(point, frame)`, `drawnOff(outline, rope, frame)`, `posed` — a point off the frame in whole pixels, what of
    a drawn block is off, a point where its pose puts it;
  - `nameBox`, `NAME_WIDTH` (1.2 em a letter, font-free), `overlapsBox` — a name's box on a block's top and whether an
    outline meets it; `orderAt(grid, things)` — the paint order at a moment, by index (`grid.backToFront`, the one
    sort); `hiddenNames` — which resting block hides each name; `coverFinding` — it as a finding, critic `'covers'`.
- Findings are `{critic, level, message, fix}` in words free of any tool's syntax; a tool prefixes the critic
  (`reel:contact`, `deck:covers`, the names its writers already accept). Every input is checked and a refusal says what
  to give (`isometric: …`); a getter is never run.
- Tests: each rule (`test/isometric-motion.test.js`); the swept test against an exact oracle and a 4000-step one — for
  any step, a block of side ≥ 0.1 tile entered past `THROUGH_MOST` is never missed and its depth is the true one; and a
  differential against both tools' copies (`test/isometric-motion.property.test.js`, controls in `test/control/`).
  The tools are not switched yet: each moves to the import in its own pull request.

### Differences between the two tools' copies

- **Which block hides a name.** StoryReel asked `grid.backToFront` of the two blocks alone whether the resting one is
  in front; StoryDeck asked the order of every piece. Both tools paint by the order of every piece, so StoryDeck's is
  right: two blocks that do not meet on the frame get no rule between them, and asked alone a block wholly behind the
  named one (at smaller rows, ordered behind it through a third block) came out in front — StoryReel counted the name
  hidden and stopped drawing it, while the picture draws it over that block. `hiddenNames` reads `orderAt` of every
  piece; the test pins the case. A bug in StoryReel 0.44.0.
- **`sideFoot`'s offset.** StoryReel's took the tie point's height above the foot (a rolling ball's radius) and needed
  it given; StoryDeck's had none, since it plans only a slide, whose offset is 0. `sideFoot` takes `offset`, 0 when left
  out — both copies' numbers. Not a bug: StoryDeck's form would put a rolling ball a radius in the air if it ever
  planned a roll.
- **The frame.** StoryReel's `offFrame` was fixed at 1600 × 900; StoryDeck's `offSlide` took the slide's size.
  `offFrame` takes the frame; the same words.
- **A small line's box.** StoryDeck handed its small line's words as written at the size it draws them; StoryReel its
  fitted small line, drawn joined on one line. `nameBox` takes `{text, size}`, the line as drawn — both give the same
  box.

## 0.31.0 — rolling, tumbling and sliding

- **Three families on `footprint-story/human`: `do: 'roll'`, `'slide'` and `'tumble'`,** each with its usual model.
  `no-slip` rolls a round thing without slipping: its `angle` is distance / radius, unwrapped; rolling resistance
  (`ROLLING_RESISTANCE`, 0.05, ours) slows it to rest; a slope (up to 45°) speeds or slows it by g sin θ / (1 + k), k
  from its `shape` (`ROLL_SHAPES`: ball 2/5, disc 1/2, ring 1); a box stops it dead; side on (`plane: 'side'`) or on a
  floor seen from above (`plane: 'floor'`, with `heading`). `coulomb` slides a thing to rest under kinetic friction
  (`KINETIC_FRICTION` 0.2, `STATIC_FRICTION` 0.25: wood on wood, Serway & Jewett), v² / (2 μ g) on the level, held by
  static friction once stopped, its angle kept. For both, `to` with no `speed` picks the start speed that rests it
  exactly there; a climb that stops rolls or slides back when the slope beats its hold. `free-spin` flies a ballistic
  arc spinning at one rate (no torque in flight) and hands over at the landing by `LANDING_RULES` (data, decide()'s
  shape): the `then` the intent names, else a round shape rolls on — its turning about the contact kept, v′ = (v + k r ω)
  / (1 + k) — and a box slides on, its spin stopped, its usual spin the one that lands it on a face. Samples carry
  `angle` and `spin` (a tumble's also `air` and `rolls`); plans carry `basis` and `why`. Refusals name the entry and the
  fix: nothing moves it, it stops short of `to` (with the speed that reaches it), a box stands between, it would still be
  moving after 30 s, `to` off its floor's line.
- **Two critics: `roll-slip`** (the drawn angle's change against distance / radius, over the steps that roll: over 5%
  astray it skids, slides without turning or turns the wrong way; the fix names the radius, or the radius it is drawn
  at) **and `spin`** (a drawn angle that jumps between two samples, or a spin that changes by over 10% in flight). Both
  read the drawn track. A fast spin, over half a turn between samples, is read as it turns: `roll-slip` nearest the turn
  the drawn distance owes, `spin` nearest its samples' own `spin`; a hand-drawn track with no spin is read the short way
  and `spin`'s basis says the fastest spin it can tell (`mostReadable`, π × the rate). Its jumps are one measure: for
  every run lasting up to `MOST_RUN_SECONDS` (0.05 s at the track's own rate, at least `MOST_RUN` = 6 steps), the extra turn beyond what each side says (read outside the run, its speed
  held, its line and its curve carried on), over the run's expected turn or `SPIN_FLOOR` (2π rad/s) × its time — flicks of any
  length, bursts, humps, dips, stutters and a flick on the last sample are caught; a stop, a start or a landing is not
  (a slow spin drifting 3 → 3.5 rad/s in flight passes); at the track's end a run easing monotonically to rest (by more
  than `RESTING`, 1e-9, a step) is a stop, at its start a run only growing is a start. `spacing` now reads only a track's flight
  when its samples mark `air: 0` on the floor.
- **A checked move is sampled at a rate its own motion sets** (`sampleTrack` with no `rate`; `BASE_RATE`,
  `MOST_STEP_TURN`, `MOST_STEP_TRAVEL`, `stepNeed`): from 120 a second, finer until no step turns more than 30° or
  travels more than 16 px, at most `MOST_TRACK_SAMPLES`; the track carries `rate` and `resolved`, and `spin` says
  `unresolved` (a note with the fix) rather than judge a track the cap left aliased. A `rate` given is used as given.
- **A wrapped roll stays a roll:** the `no-slip` plan names `turnVector` (its turn per px of travel), and `anticipate`,
  `followThrough`, `hold` and `overshoot` turn a plan that names one as they move it (a hold stops its spin), so a
  wrapped roll still turns distance / radius; a tumble that lands into a roll turns with the wrapper after it lands
  (`turnFrom`); a slide's angle stays its own. A model held still by a wrapper stops spinning and is not in flight
  (`air: 0`). **Wrappers respect their plan's world:** every offset (wind-up, follow-through, overshoot) is cut back
  along itself to where the body first touches the floor or a box its model's plan names, never turned aside. An
  anticipation is sized by the part it winds up for (`plan.lead`): a tumble's flight (its plan's `opening`), not the
  roll after it lands. A follow-through leaves the end at the speed the move arrives with, unpushed and unbraked
  (swinging out from rest when it arrives at rest, carrying on further than `by` when its speed alone takes it there),
  and ends still — a roll, a slide or a throw alike; an overshoot's
  settle carries that speed too (`settleCarry`, the spring's impulse response): no jump in speed or spin at the
  hand-over, on any roll.
- **A roll or a slide to `to` that would take longer than 30 s says so** ("it would take 30.03 s to come to rest at to,
  longer than the 30 s a physics plan may run — a nearer to, or a resistance that stops it in time …"; a speed given too
  slow: the speed that arrives in time), never "short of to": a slope that nearly balances its resistance creeps.
- **The 30 s refusal names the value that stops it** (`stoppingCoefficient`: above tan θ on a slope, at least (1 + k)·v /
  (g · 30 s) on the level for a roll, v / (g · 30 s) for a slide), and following it plans. A box tumble given its own
  spin keeps it and may land at a slant: `basis.slant` and the reason say so.
- **The physics under them, on the door:** `glide`, `glideAt`, `restSpeed` (straight-line motion in closed form),
  `touchAlong` (a line's first touch of a box, the slab test of Kay & Kajiya 1986), `rollTurn`, `rollingPush`,
  `landRoll`, `slidingPush`, `slideDistance`, `spinAt`, `faceSpin`, and their constants (`MOST_SLOPE`, `ROLL_KEYS`,
  `SLIDE_KEYS`, `TUMBLE_KEYS`, `TUMBLE_SHAPES`, `GROUND_PLANES`, `MIN_ROLL_RADIUS`, `MOST_GROUND_SPEED`, `OFF_LINE`,
  `MOST_FRICTION`, `ROLL_SLIP_MOST`, `SPIN_MOST`, `SPIN_FLOOR`). The human and humanflow doors now reach the geometry
  leaf (`src/geom/angles.js`) for the critics' turns, reused, never copied.

## 0.30.0 — hand-drawn strokes

- **`do: 'sketch'` and the model `hand-sketch`** (new family `sketch`; `footprint-story/human`;
  docs/design/2026-11-human-motion.md · "Hand-drawn strokes"): shapes in (`{points, closed?, layer?: 'outline' |
  'detail', group?, edge?, fill?, holes?}`), every stroke a hand would draw out, as frozen plain data — the order and the
  rule that put each stroke there (`plan.order`), each stroke's corners, timed points, widths, smooth line and tremor room
  (`plan.strokes`), the pen's lifts (`plan.lifts`), and the fewest strokes each layer allows (`plan.least`).
  `planSketch(shapes, {random | seed, …})` is the same plan without a move; `sampleSketch(plan, t)` says where the pen
  is, down or in the air (`planMove` / `sampleMove` read them for `do: 'sketch'`).
- **The order rule (`ORDER_RULE`):** piece by piece (`group`) from the top left; in each its outline, then its detail,
  then its fills; in a layer of lines a line two shapes share is drawn once, each stroke starts at the corner nearest
  the pen (a corner meeting an odd number of lines first) and follows the straightest line left that does not cut the
  rest in two (Fleury). A property test finds random line drawings drawn with every line once in exactly the fewest
  strokes Euler's count allows (`leastStrokes`).
- **The pen (`CORNER`, `PEN_WIDTH`, `SKETCH`, `WIDTH_SHARE`, `LIFT`; ours):** a 3 px hook (15% of the shorter line) past
  a turn of 60° or more; paced by the two-thirds power law at 400 px a second (fills 800); widths thinning to 65% at top
  speed and tapered over 8 px from 30%, detail at 70% and fills at 40% of 2.5 px; the seeded tremor capped at half the gap
  to another leg and, for a fill, at the distance to its shape's edge; lifts of 0.06 s plus 1500 px a second.
- **Fills by hand:** `hatchLines` cuts lines at a stated angle (−45°) and spacing (8 px) exactly to a shape and out of
  its holes, centred, the margin above 0 and at most half a spacing; `hatch` (one flick a line), `cross-hatch` (+90°,
  `CROSS_TURN`), `scribble` (joined back and forth where the link stays inside). A drawn fill, tremor and all, stays
  inside its shape.
- **`boilSketch(plan, frame, {every, amplitude})`:** a fresh seeded tremor every 3 frames (`BOIL`), within each
  stroke's room and amplitude of its line; the same frame, the same drawing.
- **Critics `pen-lifts`, `stroke-order`, `hatch-gaps`** (`PEN_LIFTS_MOST` 0, `STROKE_ORDER_MOST` 0, `HATCH_GAP_MOST`
  1.5): more strokes than the order needs, detail or fill begun before its piece's outline is finished, a band across a
  hatch wider than 1.5 spacings with no line — each naming `who` and the fix in the intent's keys.
- **The paint list has a `stroke` item** (`footprint-story/isometric`, `PAINT_ITEMS`): `{item: 'stroke', role, of,
  points: [[x, y, width, t], …], fill: null, stroke}`, checked by `checkPaint` (each width within the stroke's, times
  rising). This package's own style choices never give one, so every map draws as before. A painter that knows the four
  kinds must add it before it offers the choices below.
- **Two style choices on strokes, handed in, never built in:** `sketchyLine` (`human:sketchy`: a piece's silhouette then
  its inner edges drawn by hand, the faces' ink line dropped) and `hatchTexture` (`human:hatch`: left faces and sides
  hatched, right faces cross-hatched, kept out of the faces painted over them, timed after the line), with
  `shapesOfPaint`, `strokeItems` and `strokeOutline` (the ring a painter fills). The isometric door still never loads
  `src/human`.
- **Second-read fixes, before release:** a scribble's link is cut at every crossing and corner on it, so a link along
  a comb's tips never crosses its gaps, and a hatch line along an edge is cut at its corners and kept where the shape is
  beside it; a span a whole number of spacings keeps its half-spacing margins; `hatch-gaps` measures only where the
  shape is, so a hole across a hatch is no gap; each stroke keeps the room an 8 px tremor would have (`ROOM_MOST`), so
  `boilSketch`'s `amplitude` is never capped at the plan's tremor and a tremor-free sketch boils; a long stroke's step
  grows to keep it under `MOST_STROKE_POINTS` (4096), so `human:sketchy` draws big pieces, and `human:hatch` refuses a
  face too close-hatched for `MOST_PIECE_ITEMS` (512), naming the spacing that fits; corners merge transitively
  (each path's own points closer than 0.5 px folded first); a turn of exactly 60° gets its hook. The strokes' types are
  declared in `src/human/strokes/types.d.ts`, re-exported whole by `human.d.ts`.
- **The `power-law` pen's tremor cap now lives in `src/human/paths/wobble.js`**, shared with the strokes; its plans are
  unchanged byte for byte.

## 0.29.0 — angles, rotations and camera moves

- **A new door, `footprint-story/geometry`** (pure, no dependencies, loads only `src/geom/`), for the geometry leaf: `angleAt` (the angle at b in a–b–c, 2D or 3D, by
  atan2 so a sliver keeps its digits; null when a point sits on b), `dihedral` (the signed twist about b→c, IUPAC's sign;
  null when three points are in a line), `wrapAngle` ((−π, π]), `shortestTurn` (half a turn goes +π), `unwrapAngles`;
  quaternions `[w, x, y, z]`: `quatFromAxisAngle`, `quatMultiply`, `quatNormalize`, `quatRotate`, `quatAngle` (q and −q are
  one turn), `quatLook` / `quatForward` (to and from a look direction, horizon level; straight up or down it picks the
  same side every time), `quatFromAxes` (Shepperd's method); `slerp` (constant angular speed, the shorter way, opposite
  quaternions stay put, near-parallel safe) and `squad` through several keys (Shoemake 1985, 1987; passes through each
  key, C¹ at each); `toSpherical`, `fromSpherical` (the shot camera's convention) and `greatCircle` (opposite directions
  go over the top); `lookAt` and `horizonRoll` (null where no horizon is in the picture). Points are scaled together by a
  power of two before they are subtracted, so points near ±1e308 and subnormal ones give their angles; `quatFromAxes`
  refuses axes that are stretched, sheared or mirrored. Each refuses what is not a finite number in a TypeError that
  names it (NaN shown as NaN). Sources in `src/geom/REFERENCES.md`. WHY its own door: camera moves use it,
  and so will joint angles and rolling, which are not camera work; the shot door reaches the leaf and hands out none of it.
- **Camera moves between shots on `footprint-story/shot`:** `planCameraMove({do: 'fly', from, to} | {do: 'orbit', around,
  by}, scene?)` — an end is a shot in words or a camera in numbers. A rule table (`CAMERA_MOVE_RULES`, first match)
  picks the kind: a fly whose look turns past `cutPast` (150°) cuts, and so does a fly, its seconds not given, that would
  take longer than 12 s at a comfortable pace (`too-far`: a thing far off, a zoom from a speck); a turn of at most 45°
  keeps its height and turns at one speed (`slerp`); any other turn rises `lift` (10°) over its middle (`arc`), its middle
  at most 75° up. An orbit never cuts. The choice is data (`choice`: the rule, the kind, the turn, decided on the tenth of
  a degree the reason shows, so the sentence agrees with the choice), `basis` holds the numbers, `reason` is their
  sentence. The timing is minimum jerk; the seconds, unless given, the fewest that keep the look's turn (45°/s), the
  target's slide across the frame (1 frame height a second) and the subject's growth (2× a second) at 90% of their limits
  at the fastest moment, at least 0.5 s (`basis.limitedBy`, `basis.comfortSeconds`). Every number is ours.
  `sampleCameraMove(move, t)` and `cameraTrack(move, {rate})` give `{t, progress, camera, eye, look}`: every camera one
  `readCamera` takes, both ends exactly the cameras handed in.
- **Critics on a camera's path:** `checkCameraMove(move, {scene, frame, on, line, rate, who})`, for a planned move or a
  path made by hand (`{samples: [{t, camera, look?, cut?}]}`, its own `look` honoured): `in-sight` (the larger of the hand-over —
  the most the move shows of any one subject against the most any is owed, each owed its two ends' shares blended by
  progress — and each subject's own drop below the worse of its two ends, read by the shot check's own outlines; over a
  tenth; null when nothing is seen at either end), `turn-speed` (over 45°/s),
  `travel-speed` (a slide over 1 frame height a second or a growth over 2× a second), `line-of-action` (the two subjects
  swapping sides of the frame: on a cut a `warn`, in a move a `note`), `horizon` (a lean over 0.5°). Each finding names
  `who` and the fix in the intent's keys (`lift: 0` when an arc's rise is what hides it, `lift: 25`, `seconds: 4.42` — the
  planner's own seconds, so following it clears it — `cutPast: 180`, `by: 90`); a number beside its limit reads on its
  side ("45.04°/s, past 45°/s"). Without a scene the sight and line critics measure null.
- **The minimum-jerk law moved to a shared leaf, `src/timing/minJerk.js`,** unchanged: a hand's reach and a camera's
  move both use it, so there is one copy. The human door still hands out `minJerk`, `minJerkSpeed`, `minJerkAccel` and
  `MIN_JERK_PEAK` (one door per name); `src/human/laws/minJerk.js` is gone. The doors test allows the timing leaf in
  exactly the human and shot doors, the geometry leaf in exactly the geometry and shot doors, and finds no file elsewhere in `src/` or the doors that
  defines any name those leaves hand out, as a function or as a const, let or var.
- `src/shot/camera.js` gains `shotCamera` (the camera a shot asks for, read on a read scene with its problems under a
  path), which `frameOf` and the camera moves share; `src/shot/check.js` exports `reportOf` for the sight critic.
  Neither is on a door.

## 0.28.0 — the intent decider

- **`planIntents(intents, {models, critics, frame})` and `HUMAN_STEPS`** (`footprint-story/human`; docs/design/2026-11-human-motion.md ·
  "The decider"): an author's list of intents in, every move decided by named, pure steps in one list — read → choose →
  plan → wrap → sample → check → findings. It gives frozen plain data, per intent: the choice (`choices`: family, model,
  `by`, the rule's words, whether the model is a tool's own), the plan with its basis (`plans`), the wrapped move
  (`moves`; an intent asks with `wrap: [{wrapper: 'anticipate', …}]`, at most 4), its duration beside its model's basis
  (`durations`), its track summed up in a bounded record (`tracks`: at most `SUMMARY_POINTS`, 16, samples), the critics'
  measures (`checks`), and one list of `findings`, each naming its intent, `who`, the critic and the fix. Each intent's
  values are also written under keys of their own — `model-<i>`, `duration-<i>` (the seconds and the model's basis,
  flat), `findings-<i>` (`intentKey`, `PER_INTENT`) — so a record answers about one entry whole, never as a cut list. At
  most `MOST_INTENTS` (64) intents, so every step's rows stay within what the record reader keeps of a step; each read by its own stored fields (a getter never runs) and named `intents[i]` when it
  gives no `who`.
- **How a model is chosen is data:** `CHOOSE_RULES`, a first-match table in the shape of footprintjs `decide()` rules —
  the model the intent names, else its family's usual. `planMove` reads the same table, so its choices are unchanged.
- **`planMove`'s words for a model it cannot use now start with the intent's `who`** ("hand": there is no model
  "nope" …; "the move": the model "spring" is for a settle …), and say a tool's own model "is handed in as models"
  (was "goes in planMove's models"), since `planIntents` gives the same words.
- **New door `footprint-story/humanflow`** (`humanFlow`, `runHumanFlow`; `footprintjs` an optional peer, as for
  `/mapflow`): the same steps as a footprintjs chart, `choose` a decider that writes each choice and the list's reason
  (`chose`: `'ours'`, or `'own'` when a tool's own model — code no record holds — plans a move), run with
  `writeProvenance: 'reads-prefix'`. Its result equals `planIntents`' (a property test over random intent lists), so
  `whyFromRecord` answers from the record file why one move took its duration (`duration-<i>`: through the plan and
  the decision, Fitts's distance, target and bits in the answer) and why its model was chosen (`model-<i>`).
- **`whyFromRecord` shows the value asked for up to 1000 characters** (`WHY_LIMITS.asked`; one line, as before); every
  other name and value it shows stays at 200 (`WHY_LIMITS.value`). The cut counts code points, so an emoji at the cut
  is never split in two. The asked value is the answer: one entry asked by its
  own key comes back whole (a hanging chain's duration and its basis are about 300 characters).

## 0.27.0 — light physics and secondary motion on `footprint-story/human`; one seed rule

- **Models for `throw`, `fall`, `hang` and `settle`** (docs/design/2026-11-human-motion.md · Round 1 · B), each its family's
  usual, in the human door's one interface: `ballistic` (a throw or a fall in closed form; the usual apex a 45° throw, a
  quarter of the distance across, at least 24 px), `bounce` (a throw or a fall that lands and bounces to rest on the floor
  exactly; `restitution` at most 1, so it never gains energy; `keep`; `squash` with its area kept), `verlet` (a chain
  pinned at `from`, its pin may move along a `path`, never into the floor or a box; it runs until still for half a swing,
  π√(L/g), at most 10 s — its usual damping, 0.9, settles 40 of 40 random hangs, the longest in 8.2 s; its usual 8 links,
  or as many of at least 4 px as fit; a seeded `jitter`, relaxed before the first frame; a strong gravity is cut into
  sub-steps, so every link stays within 5% of its length up to `MOST_CHAIN_GRAVITY` (1e5 px/s²), `basis.stretch` the
  longest any link ran), `spring` (a settle on the motion spring, its seconds the feel's). Each plan carries `seconds`, its
  reason in words and a flat `basis` (a throw's apex, launch angle and speed; a bounce's count; a chain's link length and
  whether it settled; a spring's damping ratio and overshoot). `floor`, `boxes` and `radius` name the world. A bounce cut by
  the most bounces or the longest physics plan says so (`basis.stoppedBy`: `'low'` at rest, `'count'`, `'time'`). A throw
  takes at least one frame (`MIN_THROW_SECONDS`, 1/60 s); a spring of one's own that does not settle within 30 s is refused.
- **A model's `family` may be a list:** `ballistic` and `bounce` serve a throw and a fall alike — one strategy, one name.
- **Wrappers** `anticipate`, `followThrough`, `hold`, `overshoot` take any move (a reach too) and give a move: its plan
  wrapped (`{wrapper, seconds, inner, pushes, why, basis, …}`), its `reason` saying each, `wrappers` naming them. Each keeps
  the move's start and end exactly and adds the time it states (a move stays at most 3600 s); `sampleMove` (so
  `sampleTrack` and `checkMove`) reads a wrapped move over its model's own sample. Each wrapper adds the speed bells it
  makes to the plan's `pushes` (`ADDED_BELLS`: anticipate 2, follow-through 2, overshoot 1, a hold inside the move 1;
  none when it makes no motion: its amount under `MIN_TRAVEL`, no direction to push along, or a hold where the move is
  still), counted from the motion when the track is sampled (`wrappedPushes`). `jerk` scores a wrapped move in two parts —
  the model's own plan, sampled alone (`track.base`), against its pushes; the wrapped track's further peaks against the
  bells the wrappers declare — so no wrapper excuses a model's own stop-and-start, and a wrapper that makes more peaks
  than its table (an overshoot rising again after a reach has come to rest) is found. `overshoot` refuses a spring that never settles, by the spring model's
  own rule (`checkSettles`).
- **Critics** `spacing` (a fall's vertical acceleration under half its plan's gravity: slid, not falling; over twice it,
  `SPACING_MOST`: thrown down), `volume` (over
  10% change of area: rubber), `contact` (over 0.5 px into the floor or a box; the plan's world read as an intent's,
  refused in words; the fix in the family's own keys), `stretch` (a drawn chain's link over 5% past its length; the fix
  names the cause the plan shows: a pin on a path, something in the way, or gravity), each
  `{value, basis}`.
  `sampleTrack` now keeps each sample whole (a squash's `sx`/`sy`, a chain's `points`) and the move's `plan`.
- **The physics underneath**, on the door for a tool's own model: a fixed step (`PHYSICS_STEP` 1/240 s,
  `STEPS_PER_FRAME`) with position Verlet (`verletStep`, `simulate`), flight (`launch`, `flightAt`, `headingAt`,
  `fallSeconds`), bounces (`bounces`, `bounceAt`), chains with a relaxation pass per link (`runChain`, `relaxChain`,
  `pinAt`; Jakobsen 2001), a floor and non-overlapping boxes (`readWorld`, `makeWorld`, `pushOut`, `collide`, `depthIn`:
  no free point is left inside after any step), settling (`settleLeft`, `settleSeconds`). Bounds: physics plans at most
  30 s, chains 64 links of at least 4 px, 32 boxes, 24 bounces, 4 wrappers.
- **One seed rule:** FNV-1a then mulberry32 lives once, in `src/seed/seeded.js` (it imports nothing); the isometric
  styles and the human door both import it (the human door's own copy, `src/human/seed.js`, is gone). Every output is
  byte for byte 0.26.0's (pinned: test/seed-shared.test.js). The human door may reach that leaf and `src/motion/spring.js`.
- **Changed:** `HUMAN_MODELS` and `USUAL_MODELS` hold every family; an intent with no model for `throw`, `fall`, `hang`
  or `settle` now takes its usual one instead of being refused. `HUMAN_CRITICS` adds `spacing`, `volume`, `contact`,
  `stretch`. A track's samples carry every field the model gives.
- **TypeScript:** `HumanModel.family` is now `HumanFamily | readonly HumanFamily[]` — code that reads a model's `family`
  as one string must allow a list; `HumanTrack` adds `plan` and its samples are `HumanSample & {t}`.

## 0.26.0 — how people move and draw: `footprint-story/human`

- **A new door, `footprint-story/human`** (docs/design/2026-11-human-motion.md · Round 1 · A): pure, no dependencies,
  loads only `src/human/`. An author writes the intent; a named model plans the move from a law and says why; critics
  say in words what still looks wrong, with the fix in the intent's own keys. Same input, same output.
- **Laws:** minimum jerk (`minJerk`, `minJerkSpeed`, `minJerkAccel`; Flash & Hogan 1985); Fitts's law in the Shannon form
  (`fittsIndex`, `fittsSeconds`, `FITTS`: b = 0.2 s a bit, ours, chosen near the 3.7–4.9 bits a second Soukoreff &
  MacKenzie 2004 report for a mouse — they warn 1/b is not throughput; a = 0.1 s and the 40 px usual target ours); the
  two-thirds power law (`powerLawSpeed`, `powerLawTimes`, `powerLawFit`; Lacquaniti, Terzuolo & Viviani 1983; a
  curvature floor of 0.00025 per px, so a pen round a 300 × 100 or 300 × 30 px ellipse, its tremor on, goes as the true
  curvature to within 0.02 of the −1/3, and end ramps, ours);
  sigma-lognormal strokes and their exact integration along arcs (`sigmaLognormalAt`, `strokeBetween`, …; Plamondon
  1995, Plamondon & Djioua 2006); a seeded value-noise tremor that swings to and fro (knots alternating in sign, so it
  never wanders into a bend; its swing is set in px along the line, not in time; `tremorKnots`, `tremorAt`), seeded by the isometric styles' rule (FNV-1a, mulberry32).
- **Paths:** `arcTable` with `pointAt`, `shareToDistance`, `distanceToShare`; a centripetal Catmull-Rom line through
  points (`catmullRom`; Barry & Goldman's pyramid form, no loop within a stretch — Yuksel, Schaefer & Keyser 2011);
  `curvatures` (three-point, exact on a circle; a turn past a right angle reads as at least 2 · cos(B/2) / its shorter
  side, eased in from a right angle so it never jumps; a hairpin is the sharpest bend, never straight) and `legGaps` (the gap beside a line to another stretch of it) and `curvaturesOver` (over a width, held at the greatest bend
  that width can show, a fold read across it); `resample` by distance or count.
- **Models, one interface** (`{family, name, options, check?, plan, sample, checks}`): `min-jerk` (`do: 'reach'`, its
  seconds from Fitts unless given, bowed 6% of its length), `power-law` (`do: 'draw'`, a pen slower in the bends, from
  rest to rest, with a tremor), `sigma-lognormal` (`do: 'write'`, one overlapping stroke a point, or the strokes as
  numbers). `planMove(intent, {models, critics, frame})` gives frozen plain data with a `reason` in words and the data
  beside it: `choice: {by: 'named' | 'usual'}` and each plan's `basis` (its numbers: for a reach the distance, target,
  bits, seconds…). `sampleMove(move, t)` and `sampleTrack(move, {rate})` sample it; a sample may carry lists of numbers
  or points (at most `MOST_SAMPLE_LIST`). The seed is the model, its options, the piece's name and the intent's shape —
  never `who`, `seconds` or `speed` (`UNSEEDED_KEYS`). The pen reads the law on the smooth line, before the tremor, over one
  tremor wavelength (`BEND_WIDTH`), so a straight line keeps a steady pace; its tremor is never larger than half the
  gap to another leg of the line (`legGaps`), so a hairpin's legs a pixel apart never cross. A reach
  bows at most 0.3 of its length (`MOST_BEND`). A tool's own model is named under its prefix
  (`'reel:chalk'`), checked against the interface once, its plan and samples checked as plain data.
- **Critics:** `jerk` (speed peaks beyond the pushes planned), `pen-speed` (log error off the power law, read on the line as
  drawn over one tremor wavelength; over 0.2 it finds fault; its basis the free fit's exponent), `arc` (a straight slide); a critic's measure may give `{value, basis}`; `checkMove(move)` gives
  `{measures, bases, findings}`, each finding `{critic, level, message, fix, basis}`. A tool's own critic under its
  prefix. A list of models or critics changed after it was read is read again.
- `settle`, `fall`, `throw` and `hang` are families with no model yet (Round 1 · B fills them).

## 0.25.0 — the map's steps take what a deck hands them

- **`buildIsoMap` takes StoryDeck's map inputs** (docs/design/2026-11-map-flow.md · build order step 3, its
  prerequisites), each as data in the spec, each nothing when left out:
  - `obstacles: [{name, at, size, ports?, who?}]` — what stands on the floor that the tool draws itself (StoryDeck's
    footprints). A laid wire goes round it and may end at it (at a port of its own); a floor with no size and no group
    is fitted round it; a floor's label keeps clear of its block; it takes its place in `order`. The built map gives
    each one's `obstacleShapes` (box, centre, outline).
  - `keep: [{at, size, name}]` — floor kept clear under words placed over the picture, handed to `routes` as `keep`; a
    route's `under` names each words it could not keep off, once.
  - a floor's `icon: true` — the tool draws an icon before its label (`floorLabelPlace`'s `{icon}`), so it has less room.
  - `grid: 'fit'` — the map asks for the fitted grid; `usualGrid: {tile, origin, rise?}` — the grid a map that places its
    own blocks and writes none is drawn on (StoryDeck's tile 120 at [width / 2, 240]). The `grid` step's new choice
    `usual` says so in `gridWhy` ("it is the usual grid the tool handed in"), and the fitted grid now says why it was
    fitted: asked, or the build placed the blocks.
- **The policy's `cover`** (`'drawn' | 'block'`, left out `'drawn'`): what a block covers of a floor's label — the
  outline it draws (a film's), or the block it stands in (`ISO_MAP_POLICIES.deck`: a cylinder by its square box).
- **Two rules loosened for every tool**, neither touching a map 0.24.0 built: a map may have no block (floors and
  obstacles on a written or usual grid); a sized floor may name a group no block has (a named area), and a map where a
  floor alone names a group is fitted down to the policy's `grouped` tile, as StoryDeck fits it. `ISO_MAP_LIMITS` adds
  `keep` (512) and counts obstacles among the 256 pieces.
- **Pinned against StoryDeck 0.32.0**: a verbatim copy of its map code (`deck/iso.js` and the siblings it reads, its
  `cable.js` · `layRoutes`; `test/control/storydeck-0.32.0-*.js`), run on random deck maps written as the deck's HTML —
  blocks placed by hand and by the build, groups with and without blocks, cylinders, footprints, keep-clear, labelled
  floors with and without icons, written, fitted and usual grids, ports — gives the numbers `buildIsoMap(spec,
  ISO_MAP_POLICIES.deck)` gives for the same map as a spec: the grid, every block's and footprint's place, outline,
  middle and paint level, every floor's tiles and label place, every route, every name's fit
  (`test/deck-map-differential.property.test.js`). The map flow's chart gives `buildIsoMap`'s map for these maps too.
- **A film's map is 0.24.0's**: pinned against a copy of 0.24.0's steps (`test/control/footprint-story-0.24.0-map*.js`)
  for random film maps, styles and colours — every key the same, but the two echoes of the input that now name a new
  field (the policy's `cover: 'drawn'`, each floor's `icon: false`), and the new keys (`obstacles`, `keep`, `usualGrid`,
  `obstacleShapes`) empty.

### Differences from the code it replaced

- What StoryDeck reads from its HTML stays its own and is handed in as data: its pieces' names (the spec's are unique,
  1 to 64 letters, so a deck whose pieces share a first name, or have a longer one, hands names of its own), a sized
  floor's `at` of `[0, 0]`, the keep-clear stretches worked out from a box on the slide (`floorUnder`, on its written or
  usual grid), the usual grid's numbers, and a block's name as plain words (its entities decoded). A wire past the
  1024 the kit lays stays the deck's (StoryDeck leaves it straight; the spec holds at most 1024 wires).
- What a tool's adapter must do that the steps leave to it (src/isometric/README.md · "What a tool's adapter does"):
  drop a wire to a flat piece (a callout, a panel) — placement does not change; hand a wire whose block shares a name
  with another piece as straight (the deck's "alone" rule); slice a floor's three-number at to two; hand its own unique
  names (at most 64 letters); keep its own refusal of footprints and kept floor beside a fitted grid.
- A block's label may run to 2000 letters (`ISO_MAP_LIMITS.label`, 120 in 0.24.0): a deck draws a long name and says it
  does not fit, so the steps take it; a floor's label stays at 120 (`MOST_FLOOR_LABEL`).
- A map with no blocks on the usual grid says so in `gridWhy` ("the map has no blocks"), not that it placed them.
- The record reads more: the grid's decider reads `written`, `placed`, `usualGrid` and `blocks`; `route`, `fitFloors`, `shape`,
  `order` and `floorLabels` read `obstacles` (and `keep`, `policy`) — so a film's record names those keys too.

## 0.24.0 — a whole map as named steps, and as a footprintjs chart

- **`footprint-story/isometric` · `buildIsoMap(spec, policy)`** and **`ISO_MAP_STEPS`**: an isometric map built as
  named, pure steps — `place`, `route`, `fitFloors`, `grid`, `shape`, `names`, `order`, `floorLabels`, `style` — each
  reading only the keys it names and giving back new plain data (never editing what it was handed, never a function in
  the state). The spec is the map as data (blocks, floors, wires, a grid or an area, a style; each piece's `who` named in
  every refusal with the fix); the policy is the tool's numbers, `ISO_MAP_POLICIES.film` and `.deck` (also
  `ISO_MAP_LIMITS`). The built map is the last state, frozen: `at`, `routes`, `floorTiles`, `view`, `shapes`,
  `floorShapes`, `names`, `smalls`, `order`, `floorLabels`, `paints`, `floorPaints`, and the two choices with their
  reasons, `placed`/`placedWhy` (the map placed the blocks, or the build from its wires) and `grid`/`gridWhy` (written,
  or fitted to the area). The design: `docs/design/2026-11-map-flow.md` (step 1 of 4).
- **Moved from StoryReel 0.38.0** (`src/kits/isometric/build.mjs` · `buildMap`, itself StoryDeck's `deck/iso.js`
  order); its `ISO_FIT` is the film's policy. **Pinned** against a verbatim copy (`test/control/storyreel-0.38.0-build.mjs`):
  for random maps — placed by build with and without groups and by hand, written and fitted grids, ports, straight
  wires, labelled and fitted floors, cylinders — every block's at, box, centre, outline and faces, its fitted name and
  small line, every floor's at, size, shape and label, every route, the grid and the paint order are the same numbers,
  and a map it refused is refused. The deck's policy (StoryDeck 0.32.0's numbers; the small line left as written; only
  a group's floor held) is pinned when StoryDeck builds its maps here. **Neither tool uses it yet** (steps 2 and 3).
- A piece's shape is now the style's `shape` column: `paintPiece` is split into its two halves inside the package
  (`style.js` · `shapePiece`, `paintShaped`; `restyle` makes a style again from its record), and paints the same list
  as before (the 0.23.0 property tests are unchanged).
- **A new door, `footprint-story/mapflow`** · `mapFlow()` and `runMapFlow(spec, policy, {sink, recorders})`: the same
  step functions as a footprintjs chart — a stage per step, a decider for `place` and for `grid` that writes its choice
  and reason and labels its decision with the reason — run with `writeProvenance: 'reads-prefix'`, so
  `footprint-story/record` · `whyFromRecord` answers why a block's `at` is what it is, through the decision, from the
  record file alone. Its map equals `buildIsoMap`'s for random maps, styles and both policies (a property test).
  `footprintjs` stays an optional peer; this door reaches only its own folder and the isometric files the steps compose
  (`test/doors.test.js`).

### Differences from the code it replaced

- The map handed in is never mutated, and the built map holds no closure: a block's room is asked of the grid where a
  name is fitted, the grid is kept as its numbers (`view`: tile, origin, rise), the paint order is by name. A
  block's faces are the style's `shape` items (a block's `top`/`left`/`right` polygons; a cylinder's `top` ellipse and
  `side` path, whose arc is its foot's ellipse) — the same points StoryReel kept as `shape.top`/`left`/`right`/`bottom`.
- What a tool's read decided is the tool's: a floor gives its `at` and `size`, or neither (StoryReel's read put a floor
  with a size alone at `[0, 0]`), and a written grid gives its `origin`. A cylinder's width and depth are equal exactly
  (StoryReel's read let them differ by a billionth, which its grid then refused).
- A refusal is said in the spec's own words: `isometric: <who>: … — <fix>`, the map-wide ones in the spec's `who`
  ("the map" when it gives none), in place of StoryReel's `<where>: the isometric …`.
- A floor with no name is named by its place (`floors[0]`) as a piece of the style, and that name is one a block may not take.
- The spec's style is a row of this package's choices only: a tool's own choice is code, which no record holds.
- **`restyle(record, {choices})`**: a style made again from its record (`map.style`, `{row, options}`), the same
  choices and seeds; a tool's own choices are handed again, as no record holds code. A tool painting what the map flow
  does not (a cable) gets the map's style back this way.
- `runMapFlow` reads the spec itself before the run (footprintjs copies a run's input, and that copy would run a getter),
  so a refusal has `buildIsoMap`'s words and no getter runs. A piece's name is counted in letters (code points) in the
  style as in the spec: 0.23.0's `paintPiece` counted UTF-16 units, so a name of 33–64 letters outside the BMP was
  refused there.

## 0.23.0 — a map's look as a row of named choices

- **`footprint-story/isometric` · `isoStyle(row, {choices})`** and **`paintPiece(style, piece, grid, colours)`**: a
  style is one named choice per column — `shape`, `shading`, `line`, `palette`, `texture`, `effects` — and a piece's
  paint list is what the choices give, in that order: plain items (`polygon`, `ellipse`, `path`, `lines`) with a role, a
  fill and a stroke, which each tool paints. The design: `docs/design/2026-11-iso-styles.md` (step 1 of 4).
- This package's choices are today's look, written out: `box`, `tones`, `ink` (option `width`: an outlined look),
  `none` (no outline), `theme`, `none`. The usual style, painted, draws what StoryReel 0.38.0 drew call for call and
  writes what StoryDeck 0.32.0 wrote byte for byte, for any block, cylinder or floor on any grid (property tests against
  copies of that code, `test/control/storyreel-0.38.0-draw.mjs`, `test/control/storydeck-0.32.0-shapeOf.js`). Neither
  tool uses it yet: their painters come next.
- A tool's own choice (`'reel:chalk'`) has the same interface: `apply`, its `options` and a `check` run once, the
  choices it `clashes` with and the fix, and seeded `random()` so a mark is the same every time. What a choice gives
  back is checked as plain data and copied before the next column reads it; a bad pairing is refused before anything
  is drawn. `paintPiece` also gives the shape's `centre` (where a name stands) and `outline` (what a cable's end keeps
  clear of), which a later shape choice must give too. Also `ISO_STYLE_COLUMNS`, `ISO_STYLE_CHOICES`, `USUAL_STYLE`, `PAINT_ITEMS`, `MOST_*` limits and `mixColour`.

## 0.22.0 — the break rule is a named choice

- **`footprint-story/layout` · `wrapWords(words, width, measure, { break })`** and **`BREAK_RULES`** (`['fill',
  'even']`): `'fill'` is the usual and sets what `wrapWords` always set; `'even'` keeps fill's line count and sets the
  lines again at the narrowest width that keeps it (`narrowestWidth`), as alike as that many lines allow — the lines of
  StoryReel's title band, one call in place of two (a property test against StoryReel 0.33.0's `balancedLines`).
- **`footprint-story/isometric` · `wordsToFit(…, { break })`**: `'even'` is the usual and gives every name what 0.21.0
  gave it (a property test against a copy of 0.21.0's `wordsToFit`, `test/control/footprint-story-0.21.0-words.js`);
  `'fill'` sets the first line as full as it goes at each size and the rest beneath it, never empty (checked against an
  oracle written apart). A name not in the list, `null`, or a getter for `break` is refused on both doors; before
  0.22.0 `wordsToFit` ignored a `break` field and `wrapWords` ignored a fourth argument, so a caller that passed one
  by mistake is now told. A refusal from `footprint-story/layout` shows a function as "a function", never its source.
- WHY names and not a function the caller hands in: each rule is tested here, and a build's record can say which one
  broke a line ("broken by even"). StoryDeck and StoryReel pass their writers' choice through next.

## 0.21.0 — a lead into a port, worked out once

- **`footprint-story/isometric` · `cableLead(cable, end, count, back)`**: a cable's lead into a port — the stretch a
  tool draws again over the port's block, from the port up or down its riser and on through its floor corner — as
  `{way, pieces, length}`: the line rounded from that end (its tip pulled back for a head, `stopShort`), the lead's
  pieces, and their length in px; `length / cableWay(…).length` is the share of the line where a packet passes onto
  it. From StoryDeck 0.30.1's `deck/transforms.js · leadOf` and `deck/rides.js · piecesLength`, the same numbers
  wherever StoryDeck's lead ended at its floor point (a property test against copies of StoryDeck's code; a zero's
  sign aside). **Differences from the code it replaced:** StoryDeck counted the lead's pieces (2, or 4 with a riser);
  where a riser is too short for a straight run between its two corners, or the floor point is no corner, the count
  ran on along the floor, and the lead took in a piece of the floor run past its corner (a few px on a map's routes).
  `cableLead` ends it at the floor point by its place among the way's points (StoryDeck 0.31.0 takes this, a fix). StoryReel 0.36.0 took the share as the straight run of the lead's
  points, before the pull — short of the floor corner, and at a headed end counting the stretch under the head;
  StoryReel 0.37.0 takes this one.

## 0.20.1 — stopShort asks a way's size before it reads a point

- `footprint-story/isometric` · `stopShort` and `cableWay` refuse a list of more than 4,096 points (the most a way
  has, as `rounded` refuses) before reading any of it. 0.20.0 copied every entry first, so a huge sparse list was
  read in full before `rounded` refused it. Found in the second read of 0.20.0.

## 0.20.0 — a cable's line stops for its head by one rule

- **`footprint-story/isometric` · `stopShort(points, back)`**: a laid cable's points with the last pulled `back` px
  towards the one before (where an arrow's head begins: `CABLE.head * CABLE.headShort`), never past 1 px short of that
  run's start and never forwards — a new list. **`cableWay({points, radius}, back)`**: that, its corners rounded
  `radius` px (`rounded`). From StoryDeck 0.30.0's `deck/cable.js · cableWay` and `deck/transforms.js · leadOf` (a lead
  into a port, rounded from its end), the same way to the last bit for every cable a deck hands them (property tests
  against a copy of StoryDeck's code, `test/control/storydeck-0.30.0-cableWay.js`). **Differences from the code it
  replaced:** a `back` below 0 or not a number is refused (StoryDeck pulled none for one below 0, and never passed
  one). StoryReel 0.35.0's `cableOf` pulled the tip back at most half its last run, so on a last run under 28.8 px the
  film's line ran on nearer the tip, under the head; StoryReel 0.36.0 takes this rule.


## Older releases

0.1.0 to 0.19.0 are in [docs/changelog/0.1-0.19.md](docs/changelog/0.1-0.19.md) (moved so no file passes 1000 lines).
