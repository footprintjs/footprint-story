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

**Not here:** a view turned to another side (the corner is fixed, so no trimetric or plan view), shadows, a round thing
on tiles that are not square, and finding a way round things (`route` goes where it is told; `arrange` does not keep a
link that skips a step clear of the things between, and places nothing by its height). A view that turns is
`footprint-story/shot`'s camera, which has depth today; it is not changed by this. Where the ideas come from:
[REFERENCES.md](REFERENCES.md).
