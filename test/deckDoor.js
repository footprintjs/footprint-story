// The package's isometric door as StoryDeck 0.32.0's copied map code imports it (test/control/storydeck-0.32.0-*.js),
// with two of its parts watched: each grid's `floor` (the tiles each floor is drawn at) and `floorLabelPlace` (each
// label's place, and what it was handed). WHY: the deck's isoDrawn writes those numbers into the page rounded to a
// tenth of a px; watched here, the differential test (deck-map-differential.property.test.js) compares them exactly.
// Not a copy and not a test file: every other name is the package's own, unchanged.
import { isometric as gridMade, gridFor as gridFitted, floorLabelPlace as labelPlaced } from '../isometric.js';

export * from '../isometric.js';

/** What the watched parts were asked since the last `watch()`: floors [{cols, rows, at}], labels [{floor, text, options, place}]. */
export const seen = { floors: [], labels: [] };
export function watch() { seen.floors = []; seen.labels = []; }

/** A grid whose `floor` notes what it was asked; everything else is the grid's own (a copy of its own fields). */
const watched = (grid) => Object.freeze({ ...grid, floor: (spec) => { seen.floors.push({ cols: spec.cols, rows: spec.rows, at: [...spec.at] }); return grid.floor(spec); } });
export const isometric = (...given) => watched(gridMade(...given));
export const gridFor = (...given) => watched(gridFitted(...given));
export function floorLabelPlace(floor, grid, text, covers, options) {
  const place = labelPlaced(floor, grid, text, covers, options);
  seen.labels.push({ floor: { at: [...floor.at], size: [...floor.size] }, text, options, place });
  return place;
}
