# isometric/ — a floor seen from a corner, as numbers

**Why:** a diagram drawn as blocks on a floor reads at a glance, and a film and a deck should place those blocks the same
way. Nothing recedes in this view: a thing far away is as big as one near, so every label stays readable. Everything here
is numbers in, numbers out. Each tool keeps its own drawing.

![A floor of tiles with a slab, a block and a cylinder on it, and a line along the floor](example.svg)

| file | holds |
|---|---|
| `grid.js` | the grid: where a point lands, and back; the faces of a box; a round thing's ellipses; the tile lines; a line along the floor |
| `order.js` | `backToFront`: the order to draw things in so the nearer covers the further |

```js
import { isometric, backToFront } from 'footprint-story/isometric';

const grid = isometric({ tile: 120, origin: [960, 240] });   // a tile 120 px wide, 60 tall; the far corner at 960, 240
grid.at(2, 1);                                               // { x: 1020, y: 330 }
const server = { at: [2, 1], size: [2, 2, 1.5] };            // on the tiles from col 2, row 1: 2 wide, 2 deep, 1.5 high
grid.block(server);                                          // { top, left, right, outline, centre, box }
backToFront([{ name: 'front', at: [4, 4], size: [1, 1, 1] }, { name: 'server', ...server }]);   // server first
```

**The words.** `col` runs down and to the right of the frame, `row` down and to the left, height up. A thing stands on
the tiles from `at` (`[col, row]`, or `[col, row, lift]` above the floor) and is `size` tiles: `[wide, deep, high]`.

**A cube looks like a cube.** The grid is the picture a camera with no depth takes from 45° round and, for the usual
two-to-one tile, 30° up. A unit of height (`rise`) follows from that: 0.61 of the tile's width. A test builds that
camera from first principles and compares every point.

**Drawing order.** A thing can cover another only from nearer the viewer: more cols, more rows, or higher. `backToFront`
draws a thing first when all of it stands at smaller cols, at smaller rows, or below. Things that cannot cover each other
keep the order given. Long boxes can be laid so each is behind the next in a ring; no order is right then, and the ring
is cut at the one given first.

**Not here:** a camera that turns (the corner is fixed), shadows, and a round thing on tiles that are not square.
`footprint-story/shot` is the camera with depth; it is not changed by this.
