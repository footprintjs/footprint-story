// footprint-story/isometric — a floor of tiles seen from a corner, as plain numbers: where a point lands, the faces of a
// box, the ellipses of a round thing, the tile lines, a line along the floor, and the order to draw things in. Pure: runs
// anywhere (browser or Node), imports nothing, and loads only when imported. Nothing here draws — StoryDeck writes SVG
// with these numbers, StoryReel paints a canvas.
//
//   const grid = isometric({ tile: 120, origin: [960, 240] })
//   grid.block({ at: [2, 1], size: [2, 2, 1.5] })      → { top, left, right, outline, centre, box }
//   grid.backToFront(things)                           → the furthest first
//   arrange(things, links)                             → where each thing stands, from what is joined to what
//   gridFor(placed, [x0, y0, x1, y1])                  → the grid on which they fill that box
//   routes(placed, links)                              → the way each link runs along the floor, round what stands on it
//   rounded(points, radius)                            → that way with its corners rounded, and the place a share along it
//   wordsToFit(name, [wide, high])                     → the name on one line or two, as big as fits a face

export { isometric } from './src/isometric/grid.js';
export { readThing } from './src/isometric/thing.js';
export { MOST_ISOMETRIC_THINGS } from './src/isometric/order.js';
export { arrange, MOST_LINKS } from './src/isometric/arrange.js';
export { gridFor, MOST_ALSO } from './src/isometric/fit.js';
export { wordsToFit } from './src/isometric/words.js';
export { routes, routeNote, MOST_ROUTES, MOST_WORK, NO_ROUTE } from './src/isometric/routes.js';
export { MOST_PORTS, readPorts } from './src/isometric/ports.js';
export { rounded } from './src/isometric/path.js';
