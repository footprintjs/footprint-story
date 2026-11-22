# Changelog

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
  rising). This package's own style choices never give one, so every map draws as before. A painter that knows the five
  kinds must add it before it offers the choices below.
- **Two style choices on strokes, handed in, never built in:** `sketchyLine` (`human:sketchy`: a piece's silhouette then
  its inner edges drawn by hand, the faces' ink line dropped) and `hatchTexture` (`human:hatch`: left faces and sides
  hatched, right faces cross-hatched, kept out of the faces painted over them, timed after the line), with
  `shapesOfPaint`, `strokeItems` and `strokeOutline` (the ring a painter fills). The isometric door still never loads
  `src/human`.
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

## 0.19.0 — a cable on the frame: its label, a straight wire, its head — written once for a deck and a film

StoryReel's isometric kit carried copies of StoryDeck's cable pieces; each now lives here once, and both tools import
it (StoryDeck 0.30.0, StoryReel 0.35.0). Each gives what the tool's own code gave, to the last bit, for every input
the tool can hand it — checked by property tests against copies of both tools' code (`test/control/storydeck-0.29.0-*`,
`test/control/storyreel-0.34.0-*`; 30,000 runs each in a deep sweep) and, through each tool, by its pages and frames
before and after (StoryDeck: 2,500 generated maps, 150 compiled decks and their pages, the example deck; StoryReel:
its iso-world film, 1,500 generated worlds and 24 generated films — none changed).

- **`footprint-story/isometric` · a cable's label**: `labelPlace(way, half, hides, runs, looks, tip)` (the first of
  `LABEL_PLACES` where no outline covers the plate and no other cable runs through it; else the least hidden, the
  least crossed, the earliest; the looks a map's labels share), `labelHalf(letters)` (half the plate: the tool counts
  the letters its label shows), `held(points)` (points with their box: asked before their points), `walkWay(way, from,
  to)` (a way walked a point each `CABLE.sample` px, at most `CABLE.walkMost` runs), and `CABLE` (the cable's numbers:
  `clear`, `gap`, `lane`, `laneInset`, `least`, `corner`, `head`, `headShort`, `sample`, `walkMost`, `label`, `edge`,
  `tip`, `looks`). From StoryDeck 0.29.0's `deck/cable.js` and `deck/transforms.js`; StoryReel 0.34.0's
  `kits/isometric/cables.mjs` had copied them.
- **A wire drawn straight**: `lanesOf(pairs)` (each wire's lane among those joining one pair, and whether it runs
  against the pair's own direction), `straightRun(a, b, lane)` (from `CABLE.gap` px off one piece's edge — an outline,
  or a box — to as far off the other's; `{why: 'middle' | 'close'}` where it cannot be drawn, for the tool to word),
  `bentWire(a, e, bend, back)` (the bend's control point, the tip pulled back for the head, the way it arrives),
  `curveWay(a, c, e, runs)` (a curve as a way, as `rounded` gives one: its length StoryDeck's `curveLength`),
  `headingOf(from, to)` and `arrowHead(tip, heading, size)` (the head's three corners; a tool closes and fills them).
- **Outlines**: `exitOutline(points, p, u)`, `exitBox(box, p, u)` (how far a ray runs before it leaves), and
  `roundOutline(top, bottom, steps)` (a cylinder's outline, as `grid.block` gives a block's: `{x, y}` points).
- **`footprint-story/motion` · read at a moment**: `onStops(stops, u)` (a value on stops, CSS's `linear()` read at
  `u`), `seenTerms(ramps)` (the terms each hidden ramp shows a packet by — what a page writes as CSS) and
  `seenAt(ramps, p)` (how much of a packet at share `p` shows).
- Inputs are read by their own stored fields (a getter is never run; `looks.left` as a getter is refused by name), a
  list's length is checked before an entry is read (`MOST_HIDES`, `MOST_OUTLINE`, `MOST_WIRES`, 4,096 stops or ramps),
  and a far entry of `hides` or `runs` costs one look: its points are read only when it is near the label. Any number
  is taken where a tool's arithmetic answered NaN or Infinity before (a wire through the air 3,000,000,000 px long).
- **Where the tools' copies differed, named — `labelPlace` is StoryDeck's rule in both:**
  1. StoryReel 0.34.0's label search asked a block only when one of its corners stood within 200 px of the label; a
     large block covering the label from further off was passed over. With blocks up to 7 tiles a side, one label
     moved in 3 of 1,500 worlds (out from under a block).
  2. It charged its looks far more for the same search (every point of every other cable at every place tried, where
     StoryDeck charges the cables and blocks near the place and a look an entry), so a busy world — over about a
     hundred labelled cables — ran out, and every later label fell to its cable's middle. Here they are placed by the
     rule: on a lattice of 48 blocks and 160 labelled wires, 52 labels (wires 105 to 159) move.
  StoryReel's example and its generated worlds and films at a film's tile sizes are unchanged.
  `test/cable-differential.property.test.js` shows both cases.
- `labelPlace` refuses a `half` that is not two finite numbers from 0, and a `looks.left` that is not a finite number
  (either would make every place cost nothing and switch the map's shared budget off); with fewer looks left than
  entries to look at, it gives the cable's middle without reading one.

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
- `differsLines` refuses a time that is no factor (NaN, 0, a negative or an infinite one) rather than printing "NaN times".

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
