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
| `path.js` | a way with its corners rounded, and the place a share along it (`rounded`) |
| `words.js` | a name on one line or two, as big as fits a face (`wordsToFit`) |
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

**Fitting the picture to its links too.** A link that runs round a thing reaches past the things, so a picture
fitted to its things alone cuts such a link off. `gridFor(things, box, { also })` takes floor points the picture
holds too: give it the routes' points (`[col, row]`, or `[col, row, lift]`).

**Where a route is hidden.** `unseen` on a route is the stretches of it a thing hides, `[[from, to], …]` in tiles along
the way from its start (empty when nothing hides it): a packet riding it can fade there, and a check can say how long
a stretch is. It is empty exactly when `behind` is.

**A name that fits its face.** `wordsToFit('Load Balancer', [wide, high])` gives `{ lines, size, fits }`: the name on
one line at the usual size (26), else on two lines (broken where they are most alike), else a pixel smaller at a time
down to the least (16). `fits` is false when it does not fit even there: draw it at the least size and say so — a
name too long for its block is the writer's to shorten, and the tool must not hide it. It is counted in letters
(`letter`: 0.6 of the size, a bold sans face), because nothing here draws; a tool with a browser can measure after.

**Not here:** a view turned to another side (the corner is fixed, so no trimetric or plan view), shadows, a round thing
on tiles that are not square, the fewest crossings there could be (links are laid one at a time, in the order given:
an earlier one is never moved for a later one), and a label's place on a way. `grid.route` is the older, simpler line:
it goes where it is told and turns once; `arrange` places nothing by its height. A view that turns is
`footprint-story/shot`'s camera, which has depth today; it is not changed by this. Where the ideas come from:
[REFERENCES.md](REFERENCES.md).
