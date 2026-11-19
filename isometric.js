// footprint-story/isometric — a floor of tiles seen from a corner, as plain numbers: where a point lands, the faces of a
// box, the ellipses of a round thing, the tile lines, a line along the floor, and the order to draw things in. Pure: runs
// anywhere (browser or Node), imports nothing, and loads only when imported. Nothing here draws — StoryDeck writes SVG
// with these numbers, StoryReel paints a canvas.
//
//   const grid = isometric({ tile: 120, origin: [960, 240] })
//   grid.block({ at: [2, 1], size: [2, 2, 1.5] })      → { top, left, right, outline, centre, box }
//   backToFront(things)                                → the furthest first

export { isometric, readThing } from './src/isometric/grid.js';
export { backToFront, MOST_ISOMETRIC_THINGS } from './src/isometric/order.js';
