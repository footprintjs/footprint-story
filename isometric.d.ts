// footprint-story/isometric — a floor of tiles seen from a corner, as plain numbers. Hand-kept: test/doors.test.js
// checks every symbol the door hands out is declared here, and CI compiles test/types.check.ts against it.

/** A place on the frame, in pixels. */
export interface IsoPoint { x: number; y: number }
/** A box on the frame, in pixels. */
export interface IsoBox { x: number; y: number; w: number; h: number }
/** A thing on the floor: it stands on the tiles from `at` ([col, row] or [col, row, lift]) and is `size` ([wide, deep, high]) tiles. */
export interface IsoThing { at: readonly number[]; size: readonly number[] }
/** A box's faces, each four points round: its top, the side towards the lower left, the side towards the lower right. */
export interface IsoBlock { top: IsoPoint[]; left: IsoPoint[]; right: IsoPoint[]; outline: IsoPoint[]; centre: IsoPoint; box: IsoBox }
/** An ellipse on the frame. */
export interface IsoEllipse { cx: number; cy: number; rx: number; ry: number }
/** A round thing: the ellipse of its top and of its foot. */
export interface IsoCylinder { top: IsoEllipse; bottom: IsoEllipse; centre: IsoPoint; box: IsoBox }
/** A floor: its four corners, and every tile line as [x1, y1, x2, y2]. */
export interface IsoFloor { outline: IsoPoint[]; lines: number[][]; box: IsoBox }

/** One grid: `col` runs down and to the right of the frame, `row` down and to the left, height up. */
export interface IsoGrid {
  /** A tile's [width, height] on the frame. */
  readonly tile: readonly [number, number];
  /** Where the floor's far corner lands. */
  readonly origin: readonly [number, number];
  /** A unit of height, in pixels. */
  readonly rise: number;
  /** A point on the frame. */
  at(col: number, row: number, height?: number): IsoPoint;
  /** The floor point under a place on the frame. */
  tileAt(x: number, y: number): { col: number; row: number };
  /** The faces of a box. */
  block(thing: IsoThing): IsoBlock;
  /** A round thing on a square of tiles. */
  cylinder(thing: IsoThing): IsoCylinder;
  /** A floor of cols × rows tiles from `at`. */
  floor(floor: { cols: number; rows: number; at?: readonly number[] }): IsoFloor;
  /** A line along the floor from a to b, turning once: along the cols first, or the rows. */
  route(a: readonly number[], b: readonly number[], options?: { first?: 'col' | 'row' }): IsoPoint[];
  /**
   * `items` sorted so the furthest is drawn first; `thingOf` gives an item's {at, size} (default: the item is one).
   * Only things that meet on the frame are ordered; the rest keep the order given.
   */
  backToFront<T>(items: readonly T[], thingOf?: (item: T) => IsoThing): T[];
}

/**
 * A grid. `tile` is a tile's width in pixels, twice its height (or [width, height]); `origin` is where the floor's far
 * corner lands; `rise` is a unit of height in pixels (default: what makes a cube look like a cube).
 */
export function isometric(options?: { tile?: number | readonly [number, number]; origin?: readonly [number, number]; rise?: number }): IsoGrid;
/** A thing's place and size, checked: `at` as [col, row, lift], `size` as [wide, deep, high]. */
export function readThing(thing: IsoThing, what?: string): { at: [number, number, number]; size: [number, number, number] };
/** The most things one picture orders. */
export const MOST_ISOMETRIC_THINGS: number;

/** A thing to arrange: its name (links say it), and how big it is, [wide, deep, high] in tiles. */
export interface IsoNamed { name: string; size: readonly number[] }
/** A thing arranged: where it stands on the floor, [col, row, 0]. It is a thing a grid draws. */
export interface IsoPlaced { readonly name: string; readonly at: readonly [number, number, number]; readonly size: readonly number[] }
/** An arrangement: the things in the order given, and how far it reaches from its far corner, [0, 0], along the cols and the rows: whole tiles. */
export interface IsoArrangement { readonly things: readonly IsoPlaced[]; readonly cols: number; readonly rows: number }
/**
 * Where things stand, from what is joined to what. `links` are [from, to] by name: a joined thing stands one step
 * further along the cols than what leads to it, and things led to from one place stand side by side along the rows.
 * Things joined to nothing stand in rows past the rest, nearer the viewer; a link to a name that is not a thing here is
 * left out. `gap`: the tiles left between two things side by side; `step`: the tiles left between one step and the next,
 * where the links run. Left out, `gap` is what lets the floor show past the tallest thing in the usual two-to-one view
 * (1.22 tiles a tile of height, and half a tile; never under 1), and `step` a tile more (never under 2): room for a
 * link's arrow. The same things and links always give the same places.
 */
export function arrange(things: readonly IsoNamed[], links?: readonly (readonly [string, string])[], options?: { gap?: number; step?: number } | null): IsoArrangement;
/** The most links one arrangement reads. */
export const MOST_LINKS: number;
/**
 * The grid on which placed things fill a box of the frame, `into` = [x0, y0, x1, y1]: a two-to-one tile as wide as lets
 * every thing sit inside the box (a whole even number of pixels from `least`, 24, to `most`, 160: each read as the even
 * number inside it), the picture in the middle of the box.
 */
export function gridFor(things: readonly IsoThing[], into: readonly [number, number, number, number], options?: { most?: number; least?: number } | null): IsoGrid;
