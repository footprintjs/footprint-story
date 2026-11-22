# isometric/ — a floor seen from a corner, as numbers

**Why:** a diagram drawn as blocks on a floor reads at a glance, and a film and a deck should place those blocks the same
way. Nothing recedes in this view: a thing far away is as big as one near, so every label stays readable. Everything here
is numbers in, numbers out. Each tool keeps its own drawing.

![A floor of tiles with a slab, a block and a cylinder on it, and a line along the floor](example.svg)

| file | holds |
|---|---|
| `grid.js` | the grid: where a point lands, and back; the faces of a box; a round thing's ellipses; the tile lines; a line along the floor |
| `thing.js` | a thing read: where it stands, how big it is; every number checked, a list with a hole refused |
| `order.js` | the order to draw things in so the nearer covers the further (`grid.backToFront`) |
| `arrange.js` | where things stand, worked out from what is joined to what (`arrange`) |
| `fit.js` | the grid on which a picture fills a box of the frame (`gridFor`) |
| `routes.js` | the way each link runs along the floor, round what stands on it, and what there is to say of it (`routes`, `routeNote`) |
| `ports.js` | named points on a thing's side where a link plugs in, and where a route leaves or reaches one (read by `routes`) |
| `path.js` | a way with its corners rounded, and the place a share along it (`rounded`) |
| `words.js` | a name on one line or two, as big as fits a face (`wordsToFit`) |
| `hairpins.js` | where a way doubles back on itself, in a word (`hairpins`) |
| `under.js` | the floor under a box of the frame, as `routes`' keep takes it (`floorUnder`); whether a way on the frame passes through a box (`crossesBox`) |
| `floorLabel.js` | where a floor's name lies, flat along its front edge, clear of what stands there (`floorLabelPlace`) |
| `groups.js` | placing things by group: each group arranged, then the groups (`arrangeByGroup`) |
| `cable.js` | a cable on the frame: its numbers (`CABLE`), a label's plate (`labelHalf`) and its place on the cable (`labelPlace`, `LABEL_PLACES`), a way walked (`walkWay`), points held in their box (`held`), its line stopped short for its head and rounded (`cableWay`; the points alone: `stopShort`) |
| `outline.js` | how far a ray runs before it leaves an outline or a box (`exitOutline`, `exitBox`); a round thing's outline (`roundOutline`) |
| `lead.js` | a cable's lead into a port, drawn again over its block: its way rounded from that end, its pieces through the floor corner and their length (`cableLead`) — the share of the line a tool hands a packet over at |
| `straight.js` | a wire drawn straight between two pieces: its lane (`lanesOf`), its ends (`straightRun`), its bend (`bentWire`), its curve as a way (`curveWay`), its head (`arrowHead`, `headingOf`) |
| `style.js` | a map's look: a row of named choices, one per column, and a piece's paint list in it (`isoStyle`, `paintPiece`) |
| `styleChoices.js` | the choices this package ships: today's look (`box`, `tones`, `ink`, `none`, `theme`), and `paper` (shading), `contour` (line) and `duotone` (palette) for the named looks |
| `duotone.js` | the palette `duotone`: two inks on paper, every line the ink, every fill with a colour a tint of the accent (a fill the page colours is left to it); a name in the ink kept at 4.5 : 1 on every tint (`DUOTONE`) |
| `looks.js` | the named looks: a style row under a name, data only (`ISO_LOOKS`: `outlined`, `line-art`, `paper-grain`, `duotone`) |
| `paint.js` | the paint list: its items (a hand-drawn `stroke` among them), checked as plain data (`PAINT_ITEMS`), and the colour mix (`mixColour`) |
| `colour.js` | the colour measures: luminance and the contrast ratio (WCAG 2), the ink a name reads in on a face (`readableInk`), and ΔE76 (`deltaE76`) |
| `mapSpec.js` | a whole map's input checked: the spec (the map as data) and the policy (a tool's numbers: `ISO_MAP_POLICIES`, `ISO_MAP_LIMITS`) |
| `mapSteps.js` | a whole map built as named, pure steps (`ISO_MAP_STEPS`, `buildIsoMap`): place, route, fitFloors, grid, shape, names, order, floorLabels, style |
| `standing.js` | where a moving block stands: its foot, its top, its corner (`footOf`, `topOf`, `cornerOf`), the top it lands on (`landingUnder`), whether its middle is over that top (`overTop`), whether one rests on another (`ridesOn`) |
| `footing.js` | a moving foot in tiles from footprint-story/human's samples: planned on the frame (`footTiles`), or side on (`sideFoot`, in `worldPx`) |
| `sweep.js` | whether a move passes through a block, swept between samples (`sweptThrough`, `THROUGH_MOST`), the moments a move is checked at (`checkMoments`), the deepest pass over a move (`deepestPass`) and its finding (`passFinding`) |
| `onFrame.js` | a moving block on the frame: a point off it (`offFrame`), what of a drawing is off (`drawnOff`), a point where a pose puts it (`posed`) |
| `cover.js` | which names a block at rest hides: a name's box, font-free (`nameBox`, `NAME_WIDTH`), an outline over a box (`overlapsBox`), the paint order at a moment (`orderAt`), the hiding block (`hiddenNames`) and its finding (`coverFinding`) |
| `REFERENCES.md` | where the ideas come from, and why not the simpler sort |

```js
import { isometric } from 'footprint-story/isometric';

const grid = isometric({ tile: 120, origin: [960, 240] });   // a tile 120 px wide, 60 tall; the far corner at 960, 240
grid.at(2, 1);                                               // { x: 1020, y: 330 }
const server = { at: [2, 1], size: [2, 2, 1.5] };            // on the tiles from col 2, row 1: 2 wide, 2 deep, 1.5 high
grid.block(server);                                          // { top, left, right, outline, centre, box }
grid.backToFront([{ name: 'front', at: [4, 3], size: [1, 1, 1] }, { name: 'server', ...server }]);   // server first
```

**The words.** `col` runs down and to the right of the frame, `row` down and to the left, height up. A thing stands on
the tiles from `at` (`[col, row]`, or `[col, row, lift]` above the floor) and is `size` tiles: `[wide, deep, high]`.

**A cube looks like a cube.** The grid is the picture a camera with no depth takes from 45° round and, for the usual
two-to-one tile, 30° up. A unit of height (`rise`) follows from that: 0.61 of the tile's width. A test builds that
camera from first principles and compares every point.

**Drawing order.** `grid.backToFront` gives a rule only to two things that meet on the frame: the one drawn first is the
one that can never cover the other (all of it at smaller cols, at smaller rows, or below). Where no rule says otherwise,
directly or through things between them, the order given is kept. Why only those that meet: a rule for every pair orders
things that never touch on the frame, and such rules can run round in a ring the picture does not have (a review found
four boxes where that drew one before a box it covers).

Long boxes can truly be laid each over the next in a ring, and no order is right among them. Such a ring is cut at its
first given thing, and only when nothing outside the ring must be drawn before it: so every rule between a ring and
anything else, another ring too, is still kept (the same review found two rings, one in front of the other, drawn the
wrong way round). A test checks all of this against lines of sight worked out apart from the code, on thousands of
pictures: boxes of any length, flat ones, rings, from four heights.

**Places nobody types.** Whoever writes a picture knows what is joined to what, and should not have to work out where
each block goes. `arrange(things, links)` does that: `things` are `[{name, size}]`, `links` are `[[from, to]]` by name.

```js
const { things, cols, rows } = arrange(
  [{ name: 'you', size: [2, 2, 1] }, { name: 'dns', size: [2, 2, 1] }, { name: 'server', size: [2, 2, 1] }, { name: 'db', size: [2, 2, 1] }],
  [['you', 'dns'], ['you', 'server'], ['server', 'db']],
);   // you [0, 2] · dns [5, 0] · server [5, 4] · db [10, 4]; the arrangement reaches 12 cols and 6 rows
```

A joined thing stands one step further along the cols than what leads to it, so a chain reads from the far corner
towards the viewer's right. Things led to from one place stand side by side along the rows, evenly either side of it
(to the half tile): each thing wants its middle on the middle of what it is joined to, and within a step the things
keep their order and their gaps and stand as near what they want as that allows (least squares: each time a step is
settled, the answer is exact and has one value). The order within a step has few links that cross: the best of a few
tries, not always the fewest there could be. A ring of links is placed too: the link that closes it is read the other
way round. Things joined to nothing stand in rows of their own past the rest, nearer the viewer. A link to a name that
is not a thing here is left out. Every slot is on the half tile (a thing stands in the middle of its slot), `cols` and
`rows` are whole tiles, so `grid.floor({ cols, rows })` lies under the arrangement (a floor is 1 to 256 tiles a side:
nothing arranged reaches 0, and a very long chain reaches past 256), and the same things and links always give the same
places.

**Across the frame.** Along the cols, a chain runs down and to the right of the frame. That is true to the floor, and a
long chain is a long slant that leaves two corners of a wide frame empty. `arrange(things, links, { across: true })`
runs the steps across the frame, left to right, and stands the things of a step one below the other: a step to the
right is a tile along the cols and one back along the rows, a step down is a tile along both. It is the same
arrangement laid out cornerwise, so the same rules hold measured across the frame and down it, where they were
measured along the cols and the rows: a joined thing stands one step to the right of what leads to it on the frame
(along the cols it may stand further back), and the middle of every thing is on the half tile. No step stands in front
of the next that way, so a step needs only room for an arrow: one tile, whatever the heights.

**The gaps.** There are two: `gap` between things side by side in a step, and `step` between one step and the next,
where the links run. Left out, each is what a thing's height asks for. In the usual two-to-one view a thing hides 1.22
tiles of floor behind it for each tile of its height. So `gap` is that for the tallest thing and half a tile of floor
to see, rounded up to the half tile and never under one tile: closer than that, the nearer thing covers the further
one's faces. And `step` is a tile more, never under two, so a link drawn between two steps has floor to be seen on and
room for its arrow. Give either to choose it yourself (another view hides another amount).

A property test holds it to what an arrangement must always be (every thing placed once, none nearer another than the
gaps, a link running on along the cols), the rows are checked against the closed form of the same least-squares answer,
written apart from the code, and a test shows the floor between a thing and a much taller one in front of it.

`gridFor(things, [x0, y0, x1, y1])` then gives the grid on which the placed things fill that box: the usual two-to-one
tile, a whole even number of pixels from 24 to 160 wide (`least`, `most`), the picture in the middle of the box. Every number of this
view grows with the tile, so the picture is measured once and the rest is one division.

**Which views.** Isometric is one of a family of views with no depth (axonometric). This grid gives every one of
them seen from the corner: `tile` is the height the viewer stands at. The usual `120` is two to one, about 30° up (what
tile games call isometric); `[120, 69.3]` (the width over √3) is the true isometric, where all three edges of a cube are
as long as each other; a flatter tile looks from lower, a taller one from higher.

**Links along the floor.** A link drawn straight from thing to thing reads as flying over the floor, and it runs
through whatever stands between. `routes(things, links)` gives each link a way along the tile lines instead:

```js
import { arrange, routes, routeNote, rounded } from 'footprint-story/isometric';

const { things } = arrange([{ name: 'app', size: [2, 2, 1] }, { name: 'logs', size: [2, 2, 1] }, { name: 'db', size: [2, 2, 1] }], [['app', 'logs'], ['app', 'db']]);
const laid = routes(things, [['app', 'db'], ['db', 'app']]);
laid[0];              // { from: 'app', to: 'db', points: [[col, row], …], feet: ['right', 'left'], bends, tiles, behind: [], crosses: 0, shared: 0 }
routeNote(laid[0]);   // null when it lies well — or "app to db: passes behind logs"

const onFrame = laid[0].points.map(([col, row]) => { const p = grid.at(col, row); return [p.x, p.y]; });
const way = rounded(onFrame, 24);    // { start, pieces: [{ to } | { corner, to }], length, at(share) }
way.at(0.5);                         // where a packet riding it stands halfway, by length
```

A route leaves a thing at one of the two feet a viewer sees (`right`: under its right face; `left`: under its left
face), runs along the tile lines, turns square, and comes into the other thing at a foot that is seen: an arrow's tip
at the back of a thing would be covered by it. It never passes under a thing that stands on its floor (a thing
floating above the floor closes nothing: it only hides). It keeps off floor that a thing hides when it can (`hides`:
1.22 tiles for each tile of height, the usual view); where it cannot, `behind` names every thing that hides a point
of it, its two feet and the short runs out of them too. A later link takes the lane beside one laid before it, one
lattice step off (half a tile as a rule), so a request and its answer lie side by side; a foot two tiles wide has
room for three, and past that `shared` says how much of the way lies on another's. `crosses` counts where it meets
a route laid before it, a touch at a corner too. A link alone takes the middle of a foot. Two things at one height above the floor
are joined at that height. A link with no way says `why`: a name that is no thing here, a thing joined to itself, two
different heights, no free place at a foot that can be seen, no way along the floor (walled in), too far apart for the smallest thing, or
too many links (the work is counted, `MOST_WORK`: a picture too big leaves its last links untried, never a build that
hangs).

**Why the result says what happened.** Whoever writes the picture — a person, or a model — can be told "app to db
passes behind logs" in words and move one thing. Without it the picture has to be looked at and the reason guessed.
`routeNote` is that sentence, the same in a deck and in a film.

**How.** The floor is a lattice of points half a tile apart — a quarter or an eighth when the narrowest thing is
under two tiles or one wide, so its foot still has places, and coarser again on a picture so wide that the lattice
would pass 200,000 points (a thing too small for that lattice then has no place, and its links say so). Each link, in the order given, takes the cheapest way
over it: a step costs its length, a turn a tile and a half more (so a way has few bends), hidden floor three times its
length more (so a way goes round where it can be seen), crossing a route laid before two tiles, and running along one
twenty-four (so it takes the lane beside). The same things and links always give the same ways.

**A way with rounded corners.** `rounded(points, radius)` takes a route's points once they are on the frame and
rounds each corner, from `radius` before it to `radius` after it (never over half the shorter run). A piece is a
straight run to `to`, or a corner: one curve to `to`, drawn towards `corner` (SVG's `Q`, a canvas's
`quadraticCurveTo`). `way.at(share)` is the point a share of the way along, by length. It is here and not in each
tool so that a deck's packet and a film's frame stand at the same place on the same way.

**Ports: a link that plugs in where you say.** A thing may name points on its sides, in its own tiles —
`ports: [{ name: 'p1', at: [x, y, z] }]`, x along its width, y along its depth, z up from its base — and a link may end
at one: `[{ thing: 'lap', port: 'rj45' }, { thing: 'sw', port: 'p1' }]` (or a thing's name, as before). The route
leaves the port straight out of its side (a quarter of a tile), drops to the floor, runs out to the lattice and on
along the tile lines, and comes up into the other port the same way, so its line ends on the port itself. `path` is
the whole way in three dimensions, `[col, row, height]` from the first point to the last (a route with no port has
its floor points there, at the floor's height); `points` stay the floor run; `ports` names the port at each end
(null for a foot). Which side a port is on is read from where it is: x = width is `right` (the side toward the lower
right of the frame), y = depth is `left` (toward the lower left), x = 0 `back-left`, y = 0 `back-right`; `face` names
it, and must at a corner, and a wrong one is refused with the right one. A port on a back side is allowed: its plug is on a face turned from the viewer, so `behind` always names its thing,
and `unseen` says how much of the floor run is hidden (none, near a corner, where the floor in front of it is in view). A port whose line out does not fall on a
lattice line meets the first lattice line in front and runs along it to the next lattice point: a turn there, which
merges into the route's own turn when it goes that way. No route crosses a port's run out between two lattice
points (where a crossing could not be counted), and the stretch of the line in front that a port's run joins is that
route's lane, as a foot's run is, so a second link beside it takes the next lane or says it shares. A route that must cross a port's run out laid
before it (a port's run is fixed) counts the crossing, and pays for it. A port within a billionth of a tile of a
lattice line, or of the floor, is taken as on it, so no step of a billionth is drawn.
`points`, `tiles`, `bends` and `unseen` are of the floor run, from the floor point under a port's way out; `path`
adds the stretch out of the port and its riser at each end. Whether a riser is hidden is judged by its floor point. Not yet: a port on the top, or on a round thing (both are
refused, in words). A route whose way out of a port passes under another thing has `why: NO_ROUTE.port`; an end that
names no port of its thing, `NO_ROUTE.portName`. `readPorts(ports, size, round, who)` checks a thing's ports as `routes`
does, so a tool can refuse a wrong one in its own words before it lays anything.

**Fitting the picture to its links too.** A link that runs round a thing reaches past the things, so a picture
fitted to its things alone cuts such a link off. `gridFor(things, box, { also })` takes floor points the picture
holds too: give it the routes' points (`[col, row]`, or `[col, row, lift]`).

**Where a route is hidden.** `unseen` on a route is the stretches of it a thing hides, `[[from, to], …]` in tiles along
the way from its start (empty when nothing hides it): a packet riding it can fade there, and a check can say how long
a stretch is. It is empty exactly when `behind` is. A stretch is right to the nearest half step of the search (a
quarter of a tile on a usual picture, more on a very big one), not to the edge of what hides it; stretches are in
order and never touch.

**Floor kept clear.** `routes(things, links, { keep })` takes floor that words float over —
`keep: [{ at: [col, row, lift?], size: [wide, deep], name? }, …]`, at most 512 — and a route goes round it where it can:
a stretch of the way that passes inside kept floor costs KEPT (4 tiles a tile) more, more than a short way round,
less than closed floor. Where there is no other way the route runs over it, and `under` on the route names every area
its drawn way passes strictly inside (its runs out of its feet and its ports' leads too; along an edge is not inside),
by `name` or by number from 1, in the order given — overlapping areas each named. `under` is there whenever `keep` is
given (`[]` when it crossed none) and absent otherwise. Kept floor is no thing: it never changes the lattice's step
(a picture's other routes lie as they did), it is asked at its own height (`lift`, 0 when left out), and however many
areas there are, or however they overlap, marking them costs the lattice's work, never a link's route. WHY a cost
and not a wall: words over a picture are a reason to go round, never a reason to leave a link with no route.

**A name that fits its face.** `wordsToFit('Load Balancer', [wide, high])` gives `{ lines, size, fits }`: the name on
one line at the usual size (26), else on two lines (broken where they are most alike), else a pixel smaller at a time
down to the least (16). `fits` is false when it does not fit even there: draw it at the least size and say so — a
name too long for its block is the writer's to shorten, and the tool must not hide it. The whole name always comes
back, however long; no words at all gives no lines. It is counted in letters (`letter`: 0.6 of the size, a bold sans
face), because nothing here draws; a tool with a browser can measure after. A mark that sits on a letter and a
character that draws nothing (a zero-width space) take no room. A name breaks at a space, a tab or a line end only: a
no-break space keeps two words on one line. Sizes are from 1 to 1000 pixels. The count suits Latin-like letters: a
script whose letters are wider (Chinese, Japanese, Korean) is under-counted, and wants a bigger `letter` or a measure.

**A name measured by its face.** A tool that can measure (a film's canvas) gives `measure`: each word's width at 1 px
of size, as a function `(word) => width` or a table `{ [word]: width }` (its own stored fields; the space is the word
`' '`). `wordsToFit('Load Balancer', [173, 90], { measure: (w) => ctx.measureText(w).width / 100 })` (with the font at
100 px) sets the name by the same rule — one line, the most even break, a pixel smaller — each line its words' and
spaces' widths summed. It replaces `letter` (giving both is refused); each distinct word is measured once, so the
time still grows with the name's length; a width that is no number from 0 to 1,000,000 is refused, naming the word.
WHY summed, not each line measured whole: the break is chosen among every place a name could break, and summing keeps
that linear. A film's title band breaks by another rule, greedily over any number of lines measured whole
(`footprint-story/layout` · `wrapWords`).

**A name broken by a rule you pick.** `break` chooses where two lines part: `'even'` (the usual, above: the break that
leaves the longer line shortest) or `'fill'` (the first line as full as it goes at each size, the rest beneath it — a
top-heavy name). `wordsToFit('aaaa bb cc dddd', [200, 90])` gives `['aaaa bb', 'cc dddd']`; with `{ break: 'fill' }`
it gives `['aaaa bb cc', 'dddd']`, both at 26. One line is tried first either way, and the sizes the same way. Under
fill a first word too wide for the line has it to itself, and the second line is never empty; fill is never set
bigger than even (even's break is the best a size can have). Fill chooses its break against the width two lines have:
a box too low for two lines still gets fill's break (with `fits: false`), and a face with no width at all for two gets
even's. Left out is the usual; `null` or any other name is refused. The names are `footprint-story/layout`'s `BREAK_RULES`.
Pinned: `test/break-rules.property.test.js` (even against a copy of 0.21.0's `wordsToFit`, fill against an oracle).

**The room on a top face.** The top of a block is a slanted diamond, not the rectangle round it: across its middle it
is as wide as the block's SHORTER side is long (a block 8 by 1 has a top 1 tile wide there, however long it is), and it
narrows above and below. `grid.room(thing, high)` gives the width of an upright box `high` pixels tall that stands on
the top, its middle on the top's centre, inside the top (`thing.round: true` for a round thing). It is a number: what
`block` and `cylinder` give stays plain data. Give it to `wordsToFit` in place of `[wide, high]`:
`wordsToFit('Load Balancer', (high) => grid.room(thing, high))`. Each line is then measured across its own middle (the
room is asked 0 for one line, one line's height for two), so the top of a letter may pass the face's edge where the
line's middle does not, and one line is never refused for the face's height. Scale it to leave a margin:
`(high) => 0.9 * grid.room(thing, high)`. What the function gives is read as a width (no finite number above 0 is no
room; more than a million is a million), and what it throws comes out as it is.

**Where a way doubles back.** A route out of a port that faces away from where it goes leaves the port one way and
runs straight back the other: on the picture, a loop out of nowhere. `hairpins(route.path, route.ports)` says where,
in a word: `'start'` (the first port faces away from the other end, or sideways to it: the port is on the wrong side),
`'start-hook'` (a short loop near a port that faces the right way), the same at the end (`'end'`, `'end-hook'`), or
`'middle'` (a tight U on the floor, under half a tile across). `[]` when it doubles back nowhere. A port end is asked
whether the way runs back within two tiles of it; a foot is not asked (out of a foot a route steps half a tile off the
thing and may step back to change lanes). A riser is upright, so it is no stretch, and a jog under a tenth of a tile
is none either. What to say about it is the tool's: a deck's check words each, with its fix.

**The floor under words.** Words that float over a picture stand in a box of the frame, not on the floor. A route keeps
off the floor they cover (`keep`) only once that floor is known in tiles. `floorUnder({ x, y, w, h }, grid, { lift })`
gives it: `{ stretches, why: null }`, every half-tile square of the floor at `lift` whose drawn diamond meets the box
(exactly), those side by side along a row joined into one stretch, each a hair past its squares so the line between
two is kept too — `routes`' keep as it takes it. A box it has no floor for answers why, and never throws, so a tool
says it in its own words: `NO_UNDER.far` (further than a million px from the frame, or a place that is no finite
number at all — NaN, Infinity — as a page's style can parse to), `NO_UNDER.big` (more than 200,000
squares, counted before any is looked at; `squares` says how many) or `NO_UNDER.most` (more stretches than `most`:
counted as they are made, so many boxes sharing one budget stop at it, not after). The grid is read by its numbers (its
tile, origin and rise), never by its code.

```js
const words = { x: 660, y: 420, w: 180, h: 36 };
const { stretches } = floorUnder(words, grid);
const laid = routes(things, links, { keep: stretches.map((s) => ({ ...s, name: 'lap-name' })) });
// a route that could not keep off: does its way on the frame really run through the words?
crossesBox(laid[0].points.map(([c, r]) => { const p = grid.at(c, r); return [p.x, p.y]; }), words);
```

`crossesBox(points, box)` is whether a way on the frame, straight between its points, passes strictly inside a box: a
stretch along its edge, or one that touches a corner, does not. The router's kept floor is the half-tile squares
round the box, a little wider than the words; whether a route really runs under them is asked of the box itself.

**A floor's name.** `floorLabelPlace({ at, size }, grid, 'Production account', covers, { icon })` lays a floor's name
flat on the floor along its front edge, the way a diagram heads a group box: its lines along the cols, just in from
the edge nearest the viewer on the left, from its far end. It gives `{ x, y }` where the first line's foot starts,
`matrix` (the transform that lays words on the floor: CSS's `matrix(a, b, c, d, 0, 0)`, a canvas's `transform`), the
font `size` (from the tile: 0.3 px a px of a tile's side, 14 to 28), the `lines` (fitted with `wordsToFit`), `fits`
(false when it does not fit along the edge even on two lines at the least size, or two lines are deeper than the
floor) and `covered`. `covers` are the outlines on the frame of what is drawn over the floor — the things, and each
stretch of a laid route as two points: the words move along the edge, half a tile at a time, to the first place whose
strip of floor meets none of them (the separating-axis test), and `covered` says there was none. A label is never cut;
an icon first takes 1.5 of the size more. WHY flat: a plate standing on the floor reads as one more thing. The work is
bounded whatever is handed in: a floor at most 256 tiles a side (at most 512 places), outlines (convex) of at most 64
points (`MOST_OUTLINE_POINTS`) and 1,000,000 in all, each asked by its box before the overlap test, and at most
`MOST_LABEL_LOOKS` (50,000,000) looks — past that it is refused in words, never left to run.

**Groups.** `arrangeByGroup([{ name, size, group }], links)` places things that belong together (an account, a team,
a tier) together: each group is arranged on the links inside it, then the groups — each a thing as big as its things,
`GROUP_MARGIN` (1) tile all round for its floor and half a tile more — on the links between them, both across the
frame. Things with no group (`group` null, or left out) are a group of their own. It gives `[[col, row, 0], …]` in the
order given. A floor fitted round a group's things, a tile past them on every side and out to whole tiles, keeps a
clear tile from the next group's. WHY arrange twice: a group is a thing to the arrangement, so the rule that places
things places groups the same way.

These four came from StoryDeck 0.27.0, unchanged in what they give for what it gave them (property tests against
copies of that code, `test/control/`); every value is now read by its own stored fields and refused in words.

**Not here:** a view turned to another side (the corner is fixed, so no trimetric or plan view), shadows, a round thing
on tiles that are not square, the fewest crossings there could be (links are laid one at a time, in the order given:
an earlier one is never moved for a later one), and a label's place on a way. `grid.route` is the older, simpler line:
it goes where it is told and turns once; `arrange` places nothing by its height. A view that turns is
`footprint-story/shot`'s camera, which has depth today; it is not changed by this. Where the ideas come from:
[REFERENCES.md](REFERENCES.md).

## Styles: a row of named choices, a paint list as data

A map can be drawn flat, outlined, as line art, sketchy, on paper, in pixels. The geometry is the same in all of them;
what changes is a handful of independent choices. So a style is a **row of named choices**, one per column, in the order
they run — each reads only what the one before it gave (the design: `docs/design/2026-11-iso-styles.md`):

| Column | Takes | Gives | This package's choices |
|---|---|---|---|
| `shape` | the piece and the grid | the faces, as items with a role (`top`, `left`, `right`, `side`, `ground`, `grid`) | `box` |
| `shading` | the items, the base colour | a fill per face | `tones`: top 20% toward white, left 6% and right (a cylinder's side) 18% toward black; `paper`: every face and the ground the paper's colour (option `colour`, `#ffffff`) |
| `line` | the items, the ink | strokes | `ink` (2.5 px, round joins; option `width`, 0.5 to 20), `none` (a floor keeps its tile lines), `contour` (a bold even contour round the piece and lighter inner lines; options `width`, 1 to 20, 5, and `inner`, 0.25 to the width, 1.5) |
| `palette` | the items | the same, recoloured | `theme`; `duotone`: every line the ink, every fill with a colour a tint of the accent on the paper, a fill the page colours left to it (options `ink`, `accent`, `paper`) |
| `texture` | the items | marks over them | `none` (footprint-story/human hands in `human:hatch` and `human:grain`) |
| `effects` | the items | items added to the whole, a list of choices | — |

`isoStyle(row, {choices})` checks a row (a column left out is the usual one, USUAL_STYLE: today's look) and gives back
`{row, options}` — plain, frozen data, the record of it. `paintPiece(style, piece, grid, colours)` gives a piece's
`{box, centre, outline, items}` — the box round it, where its name stands, the outline round it — and the **paint list**, plain items in paint order (`polygon`, `ellipse`, `path`, `lines`, and a hand-drawn `stroke`, below), each with its
`role`, the piece it is `of`, a `fill` (`{mix, colour}`: the recipe, and the colour it comes to when a base is given)
and a `stroke` (`{colour, alpha, width, join, cap}`). Give no colours and each fill keeps its recipe with no colour, for
a page whose CSS colours each role (StoryDeck's `iso-left`, `iso-right`, `iso-top`, …).

WHY a list and not drawing here: a deck and a film paint the same list, so they draw the same picture; a test compares
lists, not screenshots; and this package stays free of drawing code. Pinned: the usual style's list, painted by a
small canvas painter from a fresh canvas, draws what StoryReel 0.38.0's `drawBlock`/`drawFloor` drew call for call (a
floor's tile lines say join `miter`, where 0.38.0 kept whatever join the canvas had last: separate segments, so nothing
differs on screen), and painted as SVG
writes what StoryDeck 0.32.0's `shapeOf` wrote byte for byte, for any piece on any grid
(`test/isometric-style.property.test.js`, against copies of that code in `test/control/`), with the deck's centre and
outline too. Points are any finite numbers: a far piece on a big grid is far off the frame, never refused.

**A tool's own choice** has the same interface — `{column, name, apply(input, context), options, unseeded, check, clashes}` — and
a name with the tool's prefix (`'reel:chalk'`; this package's names have none). `apply` takes the items (a `shape`
takes `{piece, grid}` and gives `{box, centre, outline, items}`); `context` holds the piece, the colours, the options written for it,
and `random()`: numbers seeded by the style, the piece's name and the column, so a wobble or a grain is the same every
time it is drawn, in a deck and in a film. `check(options)` refuses a value once, when the style is made. `clashes` names
the choices it cannot sit with and the fix: `isoStyle` refuses that pairing before anything is drawn. What a choice gives
back is checked before the next column reads it — plain data only (no function, no getter, no live object), the items
this package knows, each `of` its own piece, at most MOST_PAINT_ITEMS (512) a piece and MOST_PAINT_POINTS (4096) points an
item, an arc at most half a turn with both radii above 0 (a radius of 0 SVG and a canvas draw differently; the line a
painter writes to an arc's start is none when the pen is already there) — read entry by entry (never a list's own `map`, a hole or a getter) and copied, so a
later edit of the choice's own objects reaches nothing. A Proxy's traps do run, once, as it is copied. Options are kept
in the order of their names, so `{a, b}` and `{b, a}` are the same style, seeded the same; a clash must name a choice
there is. What it throws comes out as it is: the tool's own code. `unseeded` names the options it reads that say when,
not what (a pen's `speed`): they are left out of the seed, so a slower draw keeps its wobble — the seed rule the human
door keeps (`UNSEEDED_KEYS`: never `who`, never the timing). A style that writes none of them is seeded as before.
A style naming a tool's choice not handed in is refused, and the words say it is a tool's own and to hand it in `choices`.

```js
const chalk = { column: 'texture', name: 'reel:chalk', options: ['marks'],
  clashes: [{ column: 'line', name: 'none', fix: 'chalk needs an outline to stop at — use line "ink"' }],
  apply: (items, { random, piece }) => [...items, …marks placed with random() …] };
isoStyle({ texture: 'reel:chalk' }, { choices: [chalk] });   // { row: { …, texture: 'reel:chalk' }, options: {} }
```

**A line drawn by hand** is an item of its own: `{item: 'stroke', role, of, points: [[x, y, width, t], …], fill: null,
stroke}` — each point's width (0 to the stroke's `width`) and when it is drawn (seconds from the piece's start, rising
along the item), so a painter may draw a piece being drawn. WHY a kind of its own rather than `lines` or `path` with a
width per point: a painter that does not know it refuses it by name, rather than drawing it at one width; and its
points are checked as what they are. This package's choices never give one; `footprint-story/human` has two that do —
`sketchyLine` (`human:sketchy`) and `hatchTexture` (`human:hatch`), handed in under `choices` — for when a tool's painter
draws `stroke` items ([../human/strokes/README.md](../human/strokes/README.md)). A painter that cannot vary a line's
width fills the ring round it, its ends capped (`strokeOutline`, the human door), and draws it as it is drawn with
`strokeAt` — one rule for both tools ([../human/strokes/README.md](../human/strokes/README.md)).

A copy of a style (`structuredClone`) is its record, not a style: only what `isoStyle` made paints (its choices are held
apart, never on the style), so a record read back can be shown but must be made into a style again to draw.

### Named looks: outlined, line art, paper grain and duotone

A **look** is a style row under a name (`looks.js` · `ISO_LOOKS`, data only — no code of its own). A tool names one as
it names a choice, by its name in the row: `isoStyle({look: 'outlined'})`, a map spec's `style: {look: 'line-art'}`. A
column written beside the look replaces the look's entry for that column, whole (`{look: 'line-art', texture:
'human:hatch'}` hatches a line drawing). The style is the row it comes to — named or written out, the same row, options,
seeds and paint list — and the record keeps the name beside it (`style.look`, absent when no look is named).

| Look | Row | Still |
|---|---|---|
| `outlined` | `{line: 'contour'}`: today's tones, a 5 px contour, 1.5 px inner lines | ![Two blocks, a cylinder and a slab on a floor of tiles, each with a bold dark outline round it and thin lines where its faces meet](look-outlined.svg) |
| `line-art` | `{shading: 'paper', line: {name: 'contour', width: 3, inner: 1.25}}`: white faces, ink lines only | ![The same map drawn in ink on white: a 3 px outline round each piece, thinner fold lines, faint tile lines](look-line-art.svg) |
| `paper-grain` (0.35.0) | `{texture: 'human:grain'}`: today's look printed on paper, a fine faint grain over every face | ![The same map in today's tones, each face flecked with short, faint, scattered marks like the tooth of a printed page](look-paper-grain.svg) |
| `duotone` (0.35.0) | `{palette: 'duotone'}`: two inks — every line a deep navy, every fill a tint of a warm orange | ![The same map printed in two inks: navy lines, the faces and the floor in light to mid tints of orange, the tops lightest](look-duotone.svg) |

**The contour** (`line: 'contour'`) is drawn with items every painter already draws: under the faces, each face again
(role `contour`, no fill) with a wide stroke; over them, the faces with a thin one. The faces' fills trim the wide
strokes to the outside, so what shows outside the piece is an even band round its whole silhouette with round corners —
however the faces meet, and with no silhouette worked out. `width` is the contour as it shows: the wide stroke is drawn
at 2 · width − inner, and shows width − inner / 2 outside the faces, the thin line inner / 2 inside them. The band
reaches past the piece's `box` (as today's ink does by half its width), so it covers a little of what is behind it —
the sticker look. A floor keeps its usual list: it is the ground the pieces stand on. A painter that writes nothing for
a null fill (StoryDeck: SVG's initial fill is black) fills a contour item, under faces that cover it whole: the same
picture. The faces must be filled — a contour is refused over a face with no fill.

**Line art** is a weight hierarchy: the silhouette 3 px, the fold edges 1.25 px, the detail — the floor's tile lines,
1.5 px at 16% of the ink — faintest. The tile lines keep their width because StoryDeck's CSS holds it (`.iso-lines`), so
a style that thinned them would differ between the tools. The paper's fills carry their colour even when the base is
the page's (it is the paper, whatever the base), so a painter that colours a face by its role draws them as said; give
the page's paper with `shading: {name: 'paper', colour: '#faf6ee'}`. There is no `shading: 'none'`: StoryDeck colours a
face with no fill by its role's CSS, so a null fill would draw tones in a deck and nothing in a film.

| Number | Value | Whose, and why |
|---|---|---|
| contour `width` | 5 px | ours: twice today's 2.5 px ink, so the edge reads first |
| contour `inner` | 1.5 px | ours: under today's 2.5, so the folds show without competing with the edge (a little over 3 : 1) |
| line art `width` / `inner` | 3 / 1.25 px | ours: a line drawing has no tones, so its edge is the line alone, a little over today's ink; folds under half of it, so the faces read as one solid |
| tile lines | 1.5 px at 16% | today's, kept (StoryDeck's CSS holds the width) |

Known limits. The paper is `#ffffff` unless the tool gives its page's: on a dark page (StoryDeck's dark theme) white
faces and a white floor under light ink read poorly, so a tool on a dark page writes its paper
(`{look: 'line-art', shading: {name: 'paper', colour: …}}`). It is a colour, not null, on purpose: in today's paint
contract a fill colour of null means "the recipe over the page's base", which StoryDeck draws as its role's CSS tones and
StoryReel as the piece's base — neither is the paper, and the two would differ. A page-paper fill would need a word in
the contract both painters read. And two pieces that touch side by side on the frame get no order rule
(`grid.backToFront` orders only pieces whose outlines overlap), so the band of the one drawn later lies over its
neighbour's edge; giving touching pieces a rule would move the order of every map, so it is left for its own change.

Refused, before anything is drawn, naming the entry and the fix: a look that is not one; a look whose every column the
row writes itself (it would draw nothing, and the record would name it — drop the look, or the column); `shading: 'paper'` with
`line: 'none'` (white on white shows nothing — use `contour` or `ink`), and when the paper came from the look the words
say so (`(from the look "line-art": write shading beside it to change it)`); a contour `width` or `inner` out of range,
an inner bolder than the contour; a paper colour that is no colour. A tool's own shading that leaves a face unfilled
under the contour is refused on the piece (the wide stroke under it would show whole). The stills are written by
`test/isoLookStills.js` from a real map's paint lists and pinned (`WRITE_EXAMPLE=1 node --test
test/isometric-looks.test.js` draws them again).

**Paper grain** (`texture: 'human:grain'`, footprint-story/human · `grainTexture`) lays fine, short, faint marks in
each face — top, left, right, a cylinder's side — as one `lines` item a face (role `grain`), so both tools' painters
draw it as they draw a floor's tile lines: no new kind of item, no `stroke` items (so nothing counted by either tool's
stroke budget). In each face: three sets of lines at seeded angles, 16 px apart across, each broken into seeded marks
1 to 3 px long with gaps of 12 to 36 px — clipped by the hatch's own clipper (`hatchLines`), so every mark lies inside
its face and out of each face painted over it (a property over any piece on any grid). The ink at 22%, 0.75 px wide:
a mark stands about 1.5 : 1 against its face. Seeded by the style, the piece's name and the column, with no timing (a
grain is printed, not drawn). A floor has none (the ground is the page's). **A big face is thinned, never refused:** a
face whose marks would pass about `GRAIN.cap` (2048, half an item's 4096) is laid at a wider spacing, so they come to
about the cap, and its item's role says so — `grain-thinned` — so a list, and a tool's build note, can tell (a 10 × 10
slab fitted to 1920 × 1080: its top, about 578,000 px², at about twice the spacing; pinned under both policies). It is
a `human:` choice because the clipper lives in src/human, which this door never loads: hand `grainTexture` (or the
human door's `HUMAN_STYLE_CHOICES`, every choice it ships) in `choices`; the look named without it is refused, with
that fix.

**Duotone** (`palette: 'duotone'`, duotone.js) prints a map in two inks on paper: every stroke the `ink` (`#22304a`;
its alpha kept, so a floor's tile lines are the ink at 16%), every fill that has a colour the `paper` (`#ffffff`) mixed
toward the `accent` (`#e07b39`) by how dark the fill it replaces is (1 less its WCAG relative luminance), at most 60% of
the way. So the shading's order survives — a lit top stays lighter than a right face in shadow, and white is the paper
(line art in duotone stays paper and ink). Each such fill carries its colour (`{mix: [colour, 1], colour}`).

**Colour that means something survives.** A fill whose colour the page decides (no colour in the list: its base is
given at draw time) is left as it is, recipe and all. That is where the tools put colour that carries meaning —
StoryReel's ok / warn / bad tones, StoryDeck's ok / warn / bad classes and theme — and a duotone that coloured it would
make an "ok" piece and a "bad" one alike. So a map built with no colours (both tools build so) prints its lines in the
duotone's ink and keeps each face's colour the page's; a tool that wants a face in the duotone's tints gives that
piece a base colour, and leaves the pieces whose colour means something to the page. Pinned: ok / warn / bad tones
painted through a duotone list stay at least ΔE76 10 apart on every face (ours: a difference read at a glance; about
2.3 is the least an eye tells apart).

A block's name stands on its face: a name in the ink keeps 4.5 : 1 (WCAG, small text; StoryReel's review measures words
by it) on every tint from the paper to the deepest — 7.0 : 1 at worst for the usual inks, 9.4 : 1 in the tools' usual
ink (`#14181f`) — and inks that cannot are refused when the style is made, naming the ratio, the tint and the fix. A
tool draws names on a duotone map in its ink (`style.options.palette?.ink ?? DUOTONE.ink`) or a darker one. **On a dark
page**, give the looks the page's colours: the duotone its paper and ink (`palette: {name: 'duotone', paper: '#1b1f27',
ink: '#f2f2f2', accent: …}` — the 4.5 : 1 check then holds the page's ink against the page's tints, light on dark), and
a paper shading the page's paper (`shading: {name: 'paper', colour: …}`). With the usual light inks on a dark page,
names over a light floor tint read at about 1.1 to 1.4 : 1 (measured on StoryDeck's dark theme).

| Number | Value | Whose, and why |
|---|---|---|
| grain spacing / sets | 16 px / 3 | ours: a line about every 5 px across a face in three seeded directions — one or two read as hatching, three as fibre |
| grain mark / gap | 1–3 px / 12–36 px | ours: about one mark in 140 px² of a face, a texture and not noise; a 64-block world at a film's tile (96 px) lays 13,118 marks, 0.33 MB as SVG path data (pinned, under StoryDeck's 2 MB note) |
| grain cap | 2048 marks a face | ours: half an item's most (4096), so a face's seeded count never reaches it; a face past it (about 284,000 px²) is thinned evenly, and says so |
| grain width / alpha | 0.75 px / 22% | ours: under the thinnest line a map draws (1.25 px folds), and about 1.5 : 1 against the face (pinned under 1.6) |
| duotone ink / accent / paper | `#22304a` / `#e07b39` / `#ffffff` | ours: a deep navy and a warm orange, far apart in hue, on white |
| duotone deepest tint | 60% | ours: the accent whole stands 4.4 : 1 under the ink, under the 4.5 a name needs; at 60%, 7.0 |
| name contrast | 4.5 : 1 | WCAG 2's least for small text |
| status apart | ΔE76 over 10 | ours: ok / warn / bad read apart at a glance (an eye tells about 2.3) |

Refused, naming the entry and the fix: a grain beside a duotone, and a hatch beside a duotone (the texture runs after
the palette, in the map's ink: a third ink — take the texture out, or keep it and the palette `theme`), with the words
saying which entry came from the look; `{look: 'duotone', palette: …}` and `{look: 'paper-grain', texture: …}` (the
look would draw nothing); a grain `spacing` (4 to 200 px), `width` (0.25 to 4 px) or `alpha` (0.02 to 1) out of range;
a duotone ink, accent or paper that is no colour, or inks under 4.5 : 1. No face is too big for the grain (it thins)
or too small (a face with no room for a mark gets none, and the piece's other faces carry it). Known limits: the grain
is in the map's ink at its alpha, so on a dark face it shows less; a dark base gives the deepest tint on every face, so
its faces part only by their ink lines; a map built with no colours keeps its faces the page's under the duotone.

### A name's ink: the ink that reads on a face

A block's name is written on its face, and the face's colour is the page's or the block's own: a light theme's dark ink
reads on a pale tone, a dark theme's light ink does not. `readableInk(face, inks, {least})` (colour.js) picks the ink:
the first of `inks` — the caller's order of preference — that stands at least `least` : 1 on the face (default 4.5,
WCAG 2's least for small text; 3 for large), else the one that reads best, the earlier on a tie. It gives
`{ink, ratio, reads}`. WHY `reads`: when no ink reads, a tool still has to draw the name in something, so the best ink
comes back with its ratio and `reads: false` — never a failing ink handed back as if it passed — and the tool can say
so or change the face.

```js
import { readableInk } from 'footprint-story/isometric';
readableInk('#d9e4f3', ['#14181f', '#f5f7fa'])      // → { ink: '#14181f', ratio: 13.8…, reads: true }: the theme's ink
readableInk('#d9e4f3', ['#e8e4da', '#161b22'])      // → { ink: '#161b22', ratio: 13.4…, reads: true }: a dark theme's ground
readableInk('#808080', ['#999999', '#ffffff'])      // → { ink: '#ffffff', ratio: 3.9…, reads: false }: none reads
```

WHY here: StoryReel 0.49.0 chose a block's name's ink by this rule in its own code (`looks.mjs` · `nameInk`: the
theme's ink when it reads at 4.5 : 1, else the ground when that reads better) and StoryDeck needs the same; an
algorithm lives once. `readableInk(face, [look.ink, look.bg]).ink` is StoryReel's `nameInk(face, look)` for every face
(pinned for its golden faces and, as a property, for any face and any two inks against a copy of its code,
`test/control/storyreel-0.49.0-nameInk.mjs`), so it can switch with no picture moving. Its only other rule — a face of
null, no fill of its own, takes the theme's ink — stays the tool's: a face here is always a colour.

The measures behind it: `luminance(hex)` and `contrastRatio(a, b)` (WCAG 2, unrounded: `#777` on white is 4.48 : 1,
which does not pass 4.5; `#767676` is 4.54) and `deltaE76(a, b)` (CIE76: the distance in CIELAB under D65; 100 black to
white, about 2.3 the least an eye tells apart). Each reads a colour as the package does (`#rgb` or `#rrggbb`, any case)
and refuses anything else by name; `readableInk` refuses an empty list, an ink that is no colour, a `least` outside 1 to
21, an option it does not know and a getter.

**An untoned block apart from the status faces.** StoryReel 0.49.0 hands a block with no tone its colour (the tools'
usual tone, `#d9e4f3`) so a duotone tints it toward its orange accent — and a warn tone is orange too. Pinned: that
tint stays more than ΔE76 10 from every ok / warn / bad face, on every face, for this package's test tones, StoryReel's
paper and storybook themes and the tools' default tokens, on a light page and a dark one. The floor is ours and the
same as the status faces keep from each other: a block that means nothing read as warn is the same mistake as warn read
as bad, so one number says "apart at a glance". The nearest is warn on StoryReel's paper theme, the lit top, at 12.2
(its three faces 12.6, 16.5, 12.2, as StoryReel's review measured); the tint clears the floor and did not move.

| Number | Value | Whose, and why |
|---|---|---|
| a name's least ratio | 4.5 : 1 | WCAG 2 (1.4.3, AA) for small text; a caller asks 3 for large |
| untoned tint apart from ok / warn / bad | ΔE76 over 10 | ours: the status faces' own floor, one number for "read apart at a glance"; nearest today 12.2 |

## A whole map, built as named steps

**Why:** each tool used to build a map in one opaque step of its own compile — place the blocks, lay the wires, fit the
floors, choose the grid, shape the pieces, fit the names, place the floor labels — the same order written twice
(StoryDeck's `deck/iso.js`, StoryReel's `kits/isometric/build.mjs`). Now it is one list of named steps, run in order
(the design: `docs/design/2026-11-map-flow.md`):

```js
import { buildIsoMap, ISO_MAP_POLICIES } from 'footprint-story/isometric';

const map = buildIsoMap({
  blocks: [{ name: 'web', size: [2, 2, 1], label: 'Web', small: 'nginx', who: 'blocks[0] ("web")' },
           { name: 'db', kind: 'cylinder', size: [2, 2, 1.2], label: 'Database' }],
  wires:  [{ from: { block: 'web' }, to: { block: 'db' } }],
  floors: [{ label: 'Production' }],          // no at, no size: fitted round the blocks
  area:   [0, 0, 1600, 900],                  // no grid written: fitted into this box
}, ISO_MAP_POLICIES.film);
map.placed      // 'build'
map.placedWhy   // 'no block has an at: the build places them from their wires, across the frame'
map.at          // [[c, r, lift], …] — block i's place
map.order       // ['web', 'db'] — the furthest first
```

| Step | Reads | Writes | Decides |
|---|---|---|---|
| `place` | blocks, wires | `at`; `placed`, `placedWhy` | the map placed them (every block has an at), or the build from its wires (by group when any has one) |
| `route` | blocks, at, obstacles, wires, keep | `routes` (null for a straight wire) | — |
| `fitFloors` | blocks, at, obstacles, floors, routes, policy | `floorTiles` (each floor's at and size) | — |
| `grid` | written, placed, usualGrid, area, … | `view` (tile, origin, rise); `grid`, `gridWhy` | written in numbers, fitted to the area, or the tool's usual grid |
| `shape` | blocks, obstacles, floors, view, style | `shapes`, `floorShapes` (box, centre, outline, faces: the style's `shape` column), `obstacleShapes` (box, centre, outline) | — |
| `names` | blocks, at, view, policy | `names`, `smalls` (each fitted to its top) | — |
| `order` | blocks, at, obstacles, view | `order` (block and obstacle names, the furthest first) | — |
| `floorLabels` | blocks, at, obstacles, floors, floorTiles, shapes, routes, view, policy | `floorLabels` (each label's place, fits, covered) | — |
| `style` | blocks, at, floors, floorTiles, shapes, floorShapes, style | `paints`, `floorPaints` (the style's other columns; a map flow's record keeps their counts and digest, src/mapflow/README.md) | — |

Each step is `{name, about, reads, writes, run}`: `run(state, tools)` reads only the keys it names and gives back a new state
with the keys it writes. It never edits what it was handed and never puts a function in the state — a block's room is
asked of the grid where it is needed, the grid is kept as its numbers — so every state is plain data a record can keep,
and the built map is the last state, frozen. `buildIsoMap` hands each step only its `reads`, so a step that reads a key
it does not name finds nothing. A step that chooses (`place`, `grid`) also has `decides` (the choice and its reason, as
data) and `branches` (one per choice); `footprint-story/mapflow` runs the same functions as a footprintjs chart, a
decider for each, so a run's record says what each step read, wrote and decided ([src/mapflow/README.md](../mapflow/README.md)).

**A tool's own style choices** — footprint-story/human's `sketchyLine` (`human:sketchy`) and `hatchTexture`
(`human:hatch`), a tool's `reel:chalk` — are handed beside the spec and the policy: `buildIsoMap(spec, policy,
{choices})`, `runMapFlow(spec, policy, {choices, …})`, and each step's `run(state, {choices})` (only `shape` and `style`
read them). The spec's style names them (`style: {line: 'human:sketchy', texture: 'human:hatch'}`).

```js
import { sketchyLine, hatchTexture } from 'footprint-story/human';
const map = buildIsoMap({ ...spec, style: { line: 'human:sketchy', texture: 'human:hatch' } }, ISO_MAP_POLICIES.film, { choices: [sketchyLine, hatchTexture] });
map.style.row.line;   // 'human:sketchy': the record names the choice that drew it
```

| Choice | Why |
|---|---|
| a third argument, not a key of the spec | the spec is data a tool writes and a record keeps whole; a choice is code, which no record holds — so the record keeps its name (`style.row`) and the code is handed again on every build, as `restyle(record, {choices})` takes it |
| not a key of the policy | the policy is a tool's numbers (`film`, `deck`); a hand-drawn map is a look either tool may draw under either policy |
| read once, by own stored fields, the list copied | a getter is refused, never run; a later edit of the caller's list reaches nothing; `mapFlow({choices})` binds them into the chart, so a run's state never holds code |
| a style naming a choice not handed in is refused | in the map's `who` (`slide 3's map's style: … "human:sketchy" is a tool's own choice …: hand the choice itself in {choices}`), before anything is placed |
| a hatch too close for its piece is refused in the piece's `who` | `blocks[0] ("big"): … give a wider spacing: texture: {name: 'human:hatch', spacing: 10}` — the spacing that fits |

Only the paint lists change: the places, the grid, the names and the labels of a hand-drawn map are the usual map's (a
test). The seeds are exact: the same map, the same strokes; `who` and the pen's speed never reach the wobble; the pen's
points of a pinned map are held to 1e-6 (`test/hand-drawn-map.test.js`, with the map flow's drift property).

**The spec** is the map as data, already read by the tool from its own format: `blocks` (`name`, `kind`, `at` or none,
`size`, `label`, `small`, `rule`, `group`, `ports`, `colours`, `who`), `floors` (`name`, `at` and `size` or neither,
`label`, `icon`, `group`, `colours`, `who`), `wires` (`from`/`to` `{block, port?}`, `straight`, `who`), `obstacles`
(`name`, `at`, `size`, `ports`, `who`), `keep` (`at`, `size`, `name`), `grid` (`{tile, origin, rise?}`, or `'fit'`),
`usualGrid`, `area`, `style` (a row of choices) and `who` (the map). `who` is the tool's own words for where a piece was
written: every refusal names it, with the fix, so a tool needs no rewording. Read by own stored fields (a getter is
refused, never run), each list a plain list, bounded (`ISO_MAP_LIMITS`: 256 blocks, floors and obstacles, 1024 wires,
512 stretches kept clear, a block's label 2000 letters, a floor's 120), a key a piece does not take refused. The tools' rules hold: all or none of the blocks have
an at, one name one piece, a floor fitted round a group has blocks in it, a wire to a port runs along the floor, and
the build places blocks only when nothing on the floor is placed by hand (no obstacle, no keep).

**What a deck hands in (0.25.0).** StoryDeck 0.32.0 hands its map's parts four things the steps did not take; each is
data, and left out each is nothing, so a film's map is 0.24.0's:

| Input | What it is | What the steps do with it | Why |
|---|---|---|---|
| `obstacles` | what stands on the floor that the tool draws itself (the deck's footprints: a picture of a laptop standing by the tiles it takes) | a laid wire goes round it and may end at it (at a port of its own); a floor with no size and no group is fitted round it; a floor's label keeps clear of its block; it takes its place in `order`; `obstacleShapes` gives its box, centre and outline | the floor it takes is what the wires and labels need to know; the picture is the tool's |
| `keep` | floor kept clear under words placed over the picture, `[{at, size, name}]` in tiles | handed to `routes` as `keep` (only when there are some, so a map that keeps none lays as before); a route's `under` names each words it could not keep off, once | the tool works the tiles out from where its words stand on the frame (`floorUnder`), on a grid that does not move |
| a floor's `icon` | `true`: the tool draws an icon before the label | `floorLabelPlace(…, {icon: true})`: the label has that much less room | the icon takes room on the edge |
| `usualGrid` | the grid the tool draws a map on when the map places its own blocks and writes none (the deck's: tile 120, its far corner at the slide's middle, 240 px down) | the `grid` step picks it (`grid: 'usual'`, said so in `gridWhy`) — not when the build placed the blocks, nor when the map writes `grid: 'fit'` | it depends on the slide's width, so it is data; and the record says honestly where the grid came from |

**What a tool's adapter does that the steps leave to it.** The spec is what the steps can check; a tool reads its own
format and hands it over. StoryDeck's adapter (sketched in `test/deckMaps.js`, which the differential runs) must:

- drop a wire to a flat piece (a callout, a panel): the steps lay and place only between blocks and obstacles, and
  placement does not change, since the build's `arrange` leaves out a link to a name it does not place;
- hand a wire as `straight: true` when its block shares a name with another piece (the deck's "alone" rule: such a
  wire is drawn straight, never laid), and never hand the shared name as a piece's;
- hand its own unique names, 1 to 64 letters (a deck whose pieces share a first name, or have a longer one, names them
  itself and maps back);
- slice a floor's at of three numbers to its first two, and hand a sized floor with no at as `[0, 0]`;
- keep its own refusals of what it places by its style: a footprint or kept floor beside a fitted grid (`'fit'`), or
  beside blocks the build places (the steps refuse the second too, in their own words);
- work its keep-clear stretches out from each box (`floorUnder`, on its written grid, else its usual one) and hand
  them in tiles; hand a block's name as plain words (its entities decoded); hand its usual grid in numbers;
- leave a wire past the 1024 the kit lays to itself (drawn straight), and keep its HTML, px, levels and record.

Two rules changed for every tool, neither touching a map 0.24.0 built: a map may have no block (floors and obstacles on
a written or usual grid; a fitted picture needs something to fit), and a sized floor may name a group no block has (a
named area) — which makes the map one of groups, fitted down to the policy's `grouped` tile, as StoryDeck fits it.

**The policy** is a tool's own numbers, where a deck and a film differ on purpose: `ISO_MAP_POLICIES.film` (StoryReel's
ISO_FIT: a small line fitted down to 12 px; a fitted picture holds every floor that names a group or has a label —
`hold: 'groups-and-labels'`) and `.deck` (StoryDeck's: the small line left as written, `small: null`; only a group's
floor held, `hold: 'groups'`; a block covers a floor's label by the block it stands in, `cover: 'block'` — a cylinder by
its square box, not its round edge, because the deck's label keeps clear of the box a click lights). `cover` left out is
`'drawn'`: the outline each block draws, the film's rule (mapSpec.js · `ISO_MAP_COVERS`).

Moved from StoryReel 0.38.0's `buildMap` and pinned against a verbatim copy of it (`test/control/storyreel-0.38.0-build.mjs`):
for random maps and the film policy, every block's at, shape, fitted name and small line, every floor's at, size, shape
and label, every route, the grid and the paint order are the same numbers (`test/isometric-map-differential.property.test.js`).
The deck's policy is pinned against a verbatim copy of StoryDeck 0.32.0's map code (`test/control/storydeck-0.32.0-iso.js`
and its siblings): for random deck maps written as the deck's HTML and as the spec, the grid, every block's and
footprint's place, outline and paint level, every floor's tiles and label place, every route and every name's fit are
the same numbers (`test/deck-map-differential.property.test.js`); and 0.25.0 builds every film map as 0.24.0 did
(`test/isometric-map-0.24.0.property.test.js`). **Not here:** cables on the frame (their line, label, head, lead and packets —
a later step: the tools differ most there), and what a deck reads from its HTML and writes into it — its pieces and
names, a footprint's box on the slide, the keep-clear stretches worked out from a box (`floorUnder`), the icon's
drawing, callouts, the px and levels it writes.


## Moving pieces: where a block stands, what it passes through, what it hides

**Why:** StoryReel (0.43–0.44, `src/kits/isometric/motion-place.mjs`, `motion-cover.mjs`, `motion-side.mjs`) and
StoryDeck (0.37, `deck/motionPlace.js`, `motionPlan.js`) both move blocks on a map by intent — footprint-story/human
decides each move — and both placed the moving block with the same number rules, written twice. They live here once.
A tool keeps its drawing and its messages: it hands plain data in (blocks in tiles, samples from `footprint-story/human`)
and takes plain data out; a finding comes back as `{critic, level, message, fix}` in words free of any tool's syntax, its
critic `'contact'` or `'covers'` for the tool to prefix (`reel:contact`, `deck:covers` — the names their writers already
accept).

```js
import { isometric, footOf, landingUnder, ridesOn, sweptThrough, checkMoments, deepestPass, passFinding } from 'footprint-story/isometric';

const server = { name: 'server', size: [2, 2, 1.4] }, box = { name: 'box', size: [1, 1, 1] };
landingUnder([0.5, 0.5, 3], box.size, [{ block: server, at: [0, 0, 0] }]);   // { lift: 1.4, block: server, at: [0, 0, 0] }
ridesOn({ block: box, at: [0.5, 0.5, 1.4] }, { block: server, at: [0, 0, 0] });   // true: moving the server would leave it on nothing
sweptThrough([1, 1, 1], [0, 1, 0], [10, 1, 0], [{ block: { name: 'wall', size: [0.1, 3, 1] }, from: [5, 0, 0], to: [5, 0, 0] }]);
// { block: wall, depth: 0.1, share: ≈0.45 } — a wall a tenth of a tile thin, found between two samples a whole move apart
```

Each rule, and why it is the rule:

- **A block moves by its foot** (`footOf`, `topOf`, `cornerOf`): the middle of its footprint, at its lift. A fall drops
  the foot, a throw lands it, a hang ties its rope to the top. One point per block, so a move is one curve.
- **It lands on the highest top under it that is not above its foot** (`landingUnder`), else the floor: a box dropped
  over a server lands on the server, never through it. An overlap counts only past `SAME_PLACE` (1e-6 tile, ours): a
  block edge to edge beside another is not on it.
- **It stays on a top while its middle is over it** (`overTop`), edges included: a body whose middle is past the edge
  would tip off, however much of its footprint still overlaps.
- **A rider rests on a block when it overlaps that block's top and stands at its height** (`ridesOn`, within
  `SAME_PLACE`). Why a tool asks: moving a block from under a rider leaves the rider on nothing — a wrong picture — and
  only the writer knows whether the rider goes too, so the tool refuses the move and names both.
- **A foot is worked back from where it is drawn** (`footTiles`): a point on the frame is a whole line of places, so the
  one taken is on the move's way (its col − row between the two ends; by the share of its time when both ends stand on
  one such line), and its lift brings it to the point's height. The place then projects exactly where the block is
  drawn, so the paint order and the pass-through check find it where it is seen. A lift under the floor (a wind-up's
  dip) is the floor.
- **A side-on sample lies back on the floor along its way** (`sideFoot`): roll, slide and tumble are planned in the
  upright plane through the way, where the floor is level and gravity is down — on the frame a floor seen from a corner
  runs at a slant. Lengths there are `worldPx` (a tile's width over √2: a level line across the frame is drawn at its
  true length). The tie point's `offset` (a rolling ball's radius) is taken off, a lift within `LEVEL_SNAP` (1e-9 tile,
  ours) of a level the body keeps is that level exactly, and under the floor is the floor.
- **A move is swept, not sampled** (`sweptThrough`): a 30-tile reach covers a tile and more between two samples, and a
  block a tenth of a tile thin stands wholly between them. Over a straight stretch the overlap along each axis is the
  least of (an end − a start), each moving straight, so the overlap is concave in the share and golden-section search
  finds its highest point — nothing between two samples is skipped (a property test checks it against an exact oracle
  and a 4000-step one). A pass counts past `THROUGH_MOST`, a twentieth of a tile (ours): a block resting on a top
  touches it, and a foot worked back from the frame is exact only to a few billionths.
- **A move is checked at its ends and `CHECKS_PER_SECOND` (30, ours) a second between** (`checkMoments`), 2 to
  `MOST_CHECKS` (900, ours) steps; each pair of neighbours is one stretch swept, its block and every other where it
  stands at both ends (`deepestPass`; a turning block is handed as shorter stretches, each at the box its corners fill).
- **A point off the frame is said in whole pixels, at least 1** (`offFrame`, `drawnOff`: the outline first, then a
  hang's rope): a point a tenth of a pixel off is off, and "0 px" would say it is not. The frame is the caller's.
- **A name's box is counted from its letters, never a font** (`nameBox`): `NAME_WIDTH` (1.2 of the size a letter, ours)
  is wider than any letter a sans font draws — a bold "W" is 0.95–1.03 em, a full-width form 1.0 — so a name that could
  peek out from under a block on any host is counted covered, and every host decides the same. Lines are 1.15 of their
  size tall and the small line 2 px under them (the names step's numbers).
- **A block at rest hides a name when its outline meets the name's box** (`overlapsBox`, the separating-axis test of a
  convex outline and a box) **and it is painted after the named block** (`hiddenNames`). One passing over a name in
  flight is a moment of natural occlusion, drawn as it is, so only resting blocks are handed in.
- **The paint order at a moment is `grid.backToFront` of every piece** (`orderAt`), each where the moment puts it — the
  one sort, never a second. Every piece, not the two in question: two blocks that do not meet on the frame get no rule
  between them and are ordered only through the pieces between, and both tools paint by the order of every piece. Asked
  of the two alone, a block wholly behind the named one could come out in front of it, and its name — drawn over that
  block — would be counted hidden (the test pins such a case).

Where the two tools' copies differed: StoryReel's cover check ordered the two blocks alone (StoryDeck ordered every
piece, which is the rule above); StoryDeck's `sideFoot` had no `offset` (it plans only a slide, whose offset is 0) and
StoryReel's needed one given; StoryReel's frame was fixed at 1600 × 900 and StoryDeck's `offSlide` took it. Everything
else gave the same numbers and words: `test/isometric-motion.property.test.js` runs both copies (test/control/) beside
the door.
