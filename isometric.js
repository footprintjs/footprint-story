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
//   hairpins(route.path, route.ports)                  → where a way doubles back on itself, in a word
//   floorUnder(box, grid, {lift})                      → the floor under a box of the frame (a route's keep)
//   crossesBox(points, box)                            → whether a way on the frame passes through a box
//   floorLabelPlace(floor, grid, name, covers)         → where a floor's name lies along its front edge
//   arrangeByGroup(things, links)                      → each group arranged, then the groups
//   labelPlace(way, labelHalf(n), hides, runs, looks)  → where a cable's label stands on it (CABLE: the cable's numbers)
//   cableWay({points, radius}, back)                   → a cable's line, its tip pulled back for its head, corners rounded
//   stopShort(points, back)                            → just the points, the last pulled back (a lead rounded from one end)
//   cableLead(cable, end, count, back)                 → a lead into a port: its way, its pieces and their length
//   paintPiece(isoStyle(row), piece, grid, colours)     → a piece's paint list in a style: shape, shading, line, palette, texture, effects
//   buildIsoMap(spec, ISO_MAP_POLICIES.film)           → the whole map built, step by step (ISO_MAP_STEPS), as frozen plain data
//   lanesOf(pairs) · straightRun(a, b, lane)           → a straight wire's lane, and where it starts and ends
//   bentWire · curveWay · arrowHead · headingOf        → its bend, its curve as a way, its head
//   exitOutline · exitBox · roundOutline · walkWay     → a ray leaving a shape, a cylinder's outline, a way walked

export { isometric } from './src/isometric/grid.js';
export { readThing } from './src/isometric/thing.js';
export { MOST_ISOMETRIC_THINGS } from './src/isometric/order.js';
export { arrange, MOST_LINKS } from './src/isometric/arrange.js';
export { gridFor, MOST_ALSO } from './src/isometric/fit.js';
export { wordsToFit } from './src/isometric/words.js';
export { routes, routeNote, MOST_KEEP, MOST_ROUTES, MOST_WORK, NO_ROUTE } from './src/isometric/routes.js';
export { MOST_PORTS, readPorts } from './src/isometric/ports.js';
export { rounded } from './src/isometric/path.js';
export { hairpins, HAIRPINS } from './src/isometric/hairpins.js';
export { floorUnder, crossesBox, UNDER_CELL, MOST_UNDER_SQUARES, NO_UNDER } from './src/isometric/under.js';
export { floorLabelPlace, MOST_FLOOR_LABEL, FLOOR_LABEL_ICON, MOST_COVER_POINTS, MOST_OUTLINE_POINTS, MOST_LABEL_LOOKS } from './src/isometric/floorLabel.js';
export { arrangeByGroup, GROUP_MARGIN } from './src/isometric/groups.js';
export { CABLE, LABEL_PLACES, MOST_HIDES, labelHalf, walkWay, held, labelPlace, stopShort, cableWay } from './src/isometric/cable.js';
export { exitOutline, exitBox, roundOutline, MOST_OUTLINE } from './src/isometric/outline.js';
export { cableLead } from './src/isometric/lead.js';
export { lanesOf, straightRun, bentWire, curveWay, headingOf, arrowHead, MOST_WIRES } from './src/isometric/straight.js';
export { isoStyle, paintPiece, restyle, ISO_STYLE_COLUMNS, ISO_STYLE_CHOICES, USUAL_STYLE, MOST_EFFECTS, MOST_OWN_CHOICES } from './src/isometric/style.js';
export { PAINT_ITEMS, MOST_PAINT_ITEMS, MOST_PAINT_POINTS, mixColour } from './src/isometric/paint.js';
export { ISO_MAP_STEPS, buildIsoMap } from './src/isometric/mapSteps.js';
export { ISO_MAP_POLICIES, ISO_MAP_LIMITS } from './src/isometric/mapSpec.js';
