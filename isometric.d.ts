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
  /**
   * How wide an upright box `high` pixels tall (0 when not given) may be on a thing's top, its middle on the top's
   * centre and all of it inside the top: the room words have there. A box's top is a diamond, as wide across its middle
   * as the box's shorter side is long. `round: true` for a round thing.
   */
  room(thing: IsoThing & { readonly round?: boolean }, high?: number): number;
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
/** An arrangement: the things in the order given, and how far it reaches from its far corner, [0, 0], along the cols and the rows: whole tiles (0 when nothing was given; a long chain reaches past the 256 a floor may be). */
export interface IsoArrangement { readonly things: readonly IsoPlaced[]; readonly cols: number; readonly rows: number }
/**
 * Where things stand, from what is joined to what. `links` are [from, to] by name: a joined thing stands one step
 * further along the cols than what leads to it, and things led to from one place stand side by side along the rows
 * (with `across`: one step to the right on the frame, and one below the other).
 * Things joined to nothing stand in rows past the rest, nearer the viewer; a link to a name that is not a thing here is
 * left out. `gap`: the tiles left between two things side by side; `step`: the tiles left between one step and the next,
 * where the links run. Left out, `gap` is what lets the floor show past the tallest thing in the usual two-to-one view
 * (1.22 tiles a tile of height, and half a tile; never under 1), and `step` a tile more (never under 2): room for a
 * link's arrow. `across`: the steps run across the frame, left to right, and the things of a step stand one below the
 * other (a step is then one tile: no step stands in front of the next) — for a frame wider than it is tall, where a
 * chain along the cols is a long slant. The same things and links always give the same places.
 */
export function arrange(things: readonly IsoNamed[], links?: readonly (readonly [string, string])[], options?: { gap?: number; step?: number; across?: boolean } | null): IsoArrangement;
/** The most links one arrangement reads. */
export const MOST_LINKS: number;
/**
 * The grid on which placed things fill a box of the frame, `into` = [x0, y0, x1, y1]: a two-to-one tile as wide as lets
 * every thing sit inside the box (a whole even number of pixels from `least`, 24, to `most`, 160: each read as the even
 * number inside it), the picture in the middle of the box. `also`: points of the floor the picture holds too — the
 * corners of the links laid between the things (`routes`), which run round them and so reach past them.
 */
export function gridFor(things: readonly IsoThing[], into: readonly [number, number, number, number], options?: { most?: number; least?: number; also?: readonly (readonly [number, number] | readonly [number, number, number])[] } | null): IsoGrid;
/** The most floor points a picture is fitted to beside its things (`also`). */
export const MOST_ALSO: number;

/** A thing a route is laid round: named, placed, and round or not (`round`: a cylinder, whose feet are on its round base). */
export interface IsoRouted extends IsoThing { readonly name: string; readonly round?: boolean; /** Points on its sides where a link may plug in, in its own tiles. */ readonly ports?: readonly IsoPort[] }
/** A port: a named point on a thing's side, [x, y, z] in its own tiles (x along its width, y along its depth, z up from its base). `face` names the side, read from the point when not given (and needed at a corner). */
export interface IsoPort { readonly name: string; readonly at: readonly [number, number, number]; readonly face?: IsoSide }
/** A side of a thing: `right` and `left` face the viewer (toward the lower right and lower left of the frame); `back-left` and `back-right` are behind. */
export type IsoSide = 'right' | 'left' | 'back-left' | 'back-right';
/** One end of a link: a thing's name, or one of its ports. */
export type IsoEnd = string | { readonly thing: string; readonly port: string };
/** One of a thing's two feet a viewer sees: `right` under its right face (where the cols go on), `left` under its left face (where the rows go on). */
export type IsoFoot = 'right' | 'left';
/** Where a route leaves or reaches a thing: one of its two seen feet, or the side of the port it plugs into. */
export type IsoEndSide = IsoFoot | IsoSide;
/**
 * The way one link runs along the floor. `points`: [col, row] from the foot it leaves to the foot it reaches, a square
 * turn at every point between; `feet`: the foot it leaves and the foot it reaches; `bends`: its turns; `tiles`: its
 * length; `behind`: the names of the things that hide a point of it, its feet too (hidden floor it could not go round);
 * `crosses`: how many times it meets a route laid before it, a touch at a corner too; `shared`: the tiles of it that
 * lie on another's way for want of room (0 as a rule).
 */
export interface IsoRoute { readonly from: string; readonly to: string; readonly points: readonly (readonly [number, number])[]; /** The whole way in three dimensions, [col, row, height]: out of a port at its height and down to the floor, along it, and up into the other port (the floor points alone when no end is a port). `points`, `tiles`, `bends` and `unseen` are of the floor run, from the floor point under a port's way out. */ readonly path: readonly (readonly [number, number, number])[]; /** The port at each end, or null for a foot. */ readonly ports: readonly [string | null, string | null]; readonly feet: readonly [IsoEndSide, IsoEndSide]; readonly bends: number; readonly tiles: number; readonly behind: readonly string[]; /** The stretches of it a thing hides: [from, to] in tiles along the way from its start, right to the nearest half step, in order and apart. */ readonly unseen: readonly (readonly [number, number])[]; readonly crosses: number; readonly shared: number }
/** A link that has no way along the floor, and why (one of NO_ROUTE). */
export interface IsoNoRoute { readonly from: string; readonly to: string; readonly points: null; readonly why: string }
/**
 * The way each link runs along the floor, round what stands on it: one entry a link, in the order given. A route
 * leaves and reaches a thing at a foot a viewer sees, runs along the tile lines, never passes under a thing that stands on its floor, keeps off
 * hidden floor when it can, and takes the lane beside a route laid before it. `hides`: the tiles of floor a thing
 * hides behind it for each tile of its height (1.22: the usual two-to-one view). The same things and links always give
 * the same ways, and the work is bounded (MOST_WORK): on a picture too big, the last links are not tried and say so.
 */
export function routes(things: readonly IsoRouted[], links?: readonly (readonly [IsoEnd, IsoEnd])[], options?: { hides?: number } | null): (IsoRoute | IsoNoRoute)[];
/** The most ports one thing has. */
export const MOST_PORTS: number;
/**
 * A thing's ports checked as `routes` checks them, so a tool can refuse a wrong one in its own words before laying:
 * [{name, at, face, seen}] — `face` read from the point when not given, `seen` whether that side faces the viewer.
 * `size`: the thing's [wide, deep, high]; `round`: a round thing (which has none yet); `who`: how a refusal names it.
 */
export function readPorts(ports: readonly IsoPort[] | undefined, size: readonly [number, number, number], round: boolean, who: string): readonly { readonly name: string; readonly at: readonly [number, number, number]; readonly face: IsoSide; readonly seen: boolean }[];
/** What there is to say about one route, in words ("api to db: passes behind logs") — or null when it lies well. */
export function routeNote(route: IsoRoute | IsoNoRoute): string | null;
/** The most links one picture lays. */
export const MOST_ROUTES: number;
/** The most steps of the search one picture may take, all its links together. */
export const MOST_WORK: number;
/** Why a link has no route: the sentences `why` is one of. */
export const NO_ROUTE: Readonly<{ name: string; self: string; heights: string; foot: string; way: string; work: string; wide: string; port: string; portName: string }>;

/** A piece of a rounded way: a straight run to `to`, or a corner — one curve to `to`, drawn towards `corner` (SVG's Q, a canvas's quadraticCurveTo). */
export type WayPiece = { readonly to: readonly [number, number]; readonly corner?: readonly [number, number] };
/** A way through points with its corners rounded: where it starts, its pieces, its length, and the point a share (0 to 1) along it by length. */
export interface RoundedWay { readonly start: readonly [number, number]; readonly pieces: readonly WayPiece[]; readonly length: number; at(share: number): [number, number] }
/**
 * `points` ([[x, y], …], two or more: a route's points once they are on the frame) with each corner rounded from
 * `radius` before it to `radius` after it (never over half the shorter of the two runs that meet there; 0: sharp).
 * A deck draws the pieces as SVG and a film as canvas; `at` is where a thing riding the way stands in both.
 */
export function rounded(points: readonly (readonly [number, number])[], radius?: number): RoundedWay;

/** A name set on a face: its lines (one or two, the whole name between them; none when there are no words), the size it is drawn at in pixels, and whether it fits the room at all. */
export interface FittedWords { readonly lines: readonly string[]; readonly size: number; readonly fits: boolean }
/**
 * `text` on one line or two, as big as fits `room` ([wide, high] in pixels): tried at `size` (26) on one line, then on
 * two, then a pixel smaller at a time down to `least` (16). `fits` is false when it does not fit even there. Counted
 * in letters: `letter` is a letter's width for each pixel of its size (0.6), `line` a line's height (1.15); a mark on
 * a letter and a character that draws nothing take no room. Broken at a space, a tab or a line end, never at a no-break
 * space. A size is from 1 to 1000 pixels, and a room given as [wide, high] no more than 1,000,000 either way. `room`
 * may be a function for a face that narrows (`(high) => grid.room(thing, high)`): it is asked how wide a box so tall
 * may be — 0 for one line, one line's height for two. What it gives that is no finite number above 0 is read as no
 * room, and more than 1,000,000 as that; what it throws comes out as it is.
 */
export function wordsToFit(text: string, room: readonly [number, number] | ((high: number) => number), options?: { size?: number; least?: number; letter?: number; line?: number } | null): FittedWords;
