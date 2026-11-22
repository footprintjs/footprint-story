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
export interface IsoRoute { readonly from: string; readonly to: string; readonly points: readonly (readonly [number, number])[]; /** The whole way in three dimensions, [col, row, height]: out of a port at its height and down to the floor, along it, and up into the other port (the floor points alone when no end is a port). `points`, `tiles`, `bends` and `unseen` are of the floor run, from the floor point under a port's way out. */ readonly path: readonly (readonly [number, number, number])[]; /** The port at each end, or null for a foot. */ readonly ports: readonly [string | null, string | null]; readonly feet: readonly [IsoEndSide, IsoEndSide]; readonly bends: number; readonly tiles: number; readonly behind: readonly string[]; /** The stretches of it a thing hides: [from, to] in tiles along the way from its start, right to the nearest half step, in order and apart. */ readonly unseen: readonly (readonly [number, number])[]; readonly crosses: number; readonly shared: number; /** What it could not keep off of `keep`: each stretch's name, or its number from 1, in the order given — present only when `keep` was given. */ readonly under?: readonly (string | number)[] }
/** A link that has no way along the floor, and why (one of NO_ROUTE). */
export interface IsoNoRoute { readonly from: string; readonly to: string; readonly points: null; readonly why: string }
/** Floor kept clear, under words that float over the picture: a route goes round it where it can (routes · keep). */
export interface IsoKeep { readonly at: readonly [number, number] | readonly [number, number, number]; readonly size: readonly [number, number]; readonly name?: string }
/** The most stretches of kept floor one picture may name (routes · keep). */
export const MOST_KEEP: number;
/**
 * The way each link runs along the floor, round what stands on it: one entry a link, in the order given. A route
 * leaves and reaches a thing at a foot a viewer sees, runs along the tile lines, never passes under a thing that stands on its floor, keeps off
 * hidden floor when it can, and takes the lane beside a route laid before it. `hides`: the tiles of floor a thing
 * hides behind it for each tile of its height (1.22: the usual two-to-one view). The same things and links always give
 * the same ways, and the work is bounded (MOST_WORK): on a picture too big, the last links are not tried and say so.
 * `keep`: floor kept clear (IsoKeep, at most MOST_KEEP): a route goes round it where it can, and `under` names what
 * it crossed.
 */
export function routes(things: readonly IsoRouted[], links?: readonly (readonly [IsoEnd, IsoEnd])[], options?: { hides?: number; keep?: readonly IsoKeep[] } | null): (IsoRoute | IsoNoRoute)[];
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
 * room, and more than 1,000,000 as that; what it throws comes out as it is. `measure` — for a tool that can measure
 * its face — gives each word's width at 1 px of size (a function, or a table `{ [word]: width }` read by its own stored
 * fields; the space is the word ' ') in place of the letter count: the same rule, each line its words' and spaces'
 * widths summed. It replaces `letter` (both is refused); a width that is no number from 0 to 1,000,000 is refused.
 * `break` — the rule for two lines: `'even'` (the usual: the break that leaves the longer line shortest) or `'fill'`
 * (the first line as full as it goes at each size, the rest beneath it, never empty); the names of
 * footprint-story/layout's BREAK_RULES; fill's break is chosen against the width two lines have (a box too low for two
 * still gets it; a face with no width for two gets even's). Left out is 'even'; null or any other name is refused.
 */
export function wordsToFit(text: string, room: readonly [number, number] | ((high: number) => number), options?: { size?: number; least?: number; letter?: number; line?: number; measure?: ((word: string) => number) | Readonly<Record<string, number>>; break?: 'even' | 'fill' } | null): FittedWords;

/** Where a way doubles back on itself: leaving its first port ('start' — the port faces away — or 'start-hook', a short loop near a good one), a tight U on the floor ('middle'), or coming into its last port ('end', 'end-hook'). */
export type IsoHairpin = 'start' | 'start-hook' | 'middle' | 'end' | 'end-hook';
/** Every word `hairpins` may say, in the order it says them. */
export const HAIRPINS: readonly IsoHairpin[];
/**
 * Where a way doubles back on itself, seen from above: `path` its points in tiles ([col, row] or [col, row, height]: a
 * route's `path`), `ports` the port at each end (a route's `ports`; null or left out for a foot). A port end is asked
 * whether, within 2 tiles of it, the way runs back; the floor between, whether it makes a U under half a tile across.
 * A jog under a tenth of a tile and a riser are no stretch. [] when it doubles back nowhere.
 */
export function hairpins(path: readonly (readonly number[])[], ports?: readonly [(string | null)?, (string | null)?] | null): IsoHairpin[];

/** A stretch of floor kept clear, as `routes` takes it in `keep`: [col, row, lift] from its far corner, [wide, deep] tiles. */
export interface IsoUnder { at: [number, number, number]; size: [number, number] }
/** The floor under a box: its stretches — or none, and why (one of NO_UNDER) with how many squares it was counted at (null for `far`). */
export type IsoFloorUnder = { readonly stretches: IsoUnder[]; readonly why: null; readonly squares: number } | { readonly stretches: null; readonly why: string; readonly squares: number | null };
/** A grid as `floorUnder` and `floorLabelPlace` read it: its own numbers (an IsoGrid is one); getters are refused. */
export interface IsoGridNumbers { readonly tile: readonly [number, number]; readonly origin?: readonly [number, number]; readonly rise?: number }
/** The floor under a box is found in squares this many tiles a side (0.5). */
export const UNDER_CELL: number;
/** The most squares of floor one box is asked over (200,000). */
export const MOST_UNDER_SQUARES: number;
/** Why a box has no floor under it: the sentences `why` is one of — `far` (further than 1,000,000 px from the frame, or a place that is no finite number: NaN, Infinity), `big` (more than MOST_UNDER_SQUARES squares), `most` (more stretches than `most`). */
export const NO_UNDER: Readonly<{ far: string; big: string; most: string }>;
/**
 * The floor under a box of the frame at a height `lift` (0): every UNDER_CELL square whose drawn diamond meets the box,
 * those side by side along a row joined into one stretch, each a hair (0.01 tile) past its squares — `routes`' keep as
 * it takes it. `grid`: its tile, origin and rise are read (never its code). `most`: the most stretches to make, counted
 * as they are made (Infinity). A box with none answers why, never throws: a tool words it.
 */
export function floorUnder(box: IsoBox, grid: IsoGridNumbers, options?: { lift?: number; most?: number } | null): IsoFloorUnder;
/** Whether a way on the frame through `points` ([[x, y], …], straight between) passes strictly inside a box: not along its edge, not touching a corner. Any numbers are taken, and answered by the same arithmetic. */
export function crossesBox(points: readonly (readonly [number, number])[], box: IsoBox): boolean;

/** A floor's label placed: where its first line's foot starts on the frame, the transform that lays words on the floor, its size in px, its lines, and whether it fits and whether every place along the edge is covered. */
export interface FloorLabel { readonly x: number; readonly y: number; readonly matrix: [number, number, number, number]; readonly size: number; readonly lines: readonly string[]; readonly fits: boolean; readonly covered: boolean }
/** The most letters a floor's label has (120). */
export const MOST_FLOOR_LABEL: number;
/** An icon before a floor's label: its width with its gap, for each px of the label's size (1.5). */
export const FLOOR_LABEL_ICON: number;
/** The most points the outlines a label keeps clear of may hold between them (1,000,000). */
export const MOST_COVER_POINTS: number;
/** The most points one outline over a floor may have (64). */
export const MOST_OUTLINE_POINTS: number;
/** The most looks one label spends finding its place (50,000,000): an outline's box asked, or a point projected; past it, refused in words. */
export const MOST_LABEL_LOOKS: number;
/**
 * Where a floor's label lies: flat along the floor's near-left edge, sized from the tile (14 to 28 px), fitted with
 * `wordsToFit`, at the first place from the far end (half a tile at a time) whose strip of floor meets none of `covers`
 * (outlines on the frame: the things drawn over the floor, and each stretch of a laid route as two points). `fits` is
 * false when it does not fit even at the least size; `covered`, when it fits and no place is clear. Bounded: a floor of
 * at most 256 tiles a side, outlines (convex) of at most MOST_OUTLINE_POINTS points and MOST_COVER_POINTS in all, each
 * asked by its box first, and at most MOST_LABEL_LOOKS looks.
 */
export function floorLabelPlace(floor: { readonly at: readonly number[]; readonly size: readonly [number, number] }, grid: IsoGridNumbers, text: string, covers?: readonly (readonly (readonly [number, number])[])[], options?: { icon?: boolean } | null): FloorLabel;

/** A thing placed by group: its name (links say it), its size, and its group (null or left out: none). */
export interface IsoGrouped extends IsoNamed { readonly group?: string | null }
/** Tiles a group's floor reaches past its things on every side (1). */
export const GROUP_MARGIN: number;
/**
 * Where each thing stands when things are placed by group: [[col, row, 0], …] in the order given. Each group is
 * arranged on the links inside it, then the groups — each as big as its things, GROUP_MARGIN tiles all round and half
 * a tile more — on the links between them; both across the frame. Things with no group are a group of their own.
 */
export function arrangeByGroup(things: readonly IsoGrouped[], links?: readonly (readonly [string, string])[] | null): [number, number, number][];

// ── a cable on the frame (cable.js, outline.js, straight.js): from StoryDeck 0.29.0 and StoryReel 0.34.0 ──

type Xy = readonly [number, number];
/** The cable's numbers, in px of the frame unless said (cable.js · CABLE says what each is). */
export const CABLE: Readonly<{ clear: number; gap: number; lane: number; laneInset: number; least: number; corner: number; head: number; headShort: number; sample: number; walkMost: number;
  label: Readonly<{ size: number; char: number; pad: number }>; edge: number; tip: number; looks: number }>;
/** Where a label may stand along its cable, shares of its length: the middle first, then a twentieth further to each side by turns. */
export const LABEL_PLACES: readonly number[];
/** The most entries of `hides` or `runs` one label is asked against. */
export const MOST_HIDES: number;
/** The most points an outline read by exitOutline (or a straight wire's end) may have. */
export const MOST_OUTLINE: number;
/** The most wires lanesOf reads in one call. */
export const MOST_WIRES: number;
/** Half a label's plate, [wide, high], for `letters` letters (as the tool counts what the label shows). */
export function labelHalf(letters: number): [number, number];
/** A way walked from share `from` to share `to`: points CABLE.sample px apart at most, at most CABLE.walkMost runs. */
export function walkWay(way: RoundedWay, from?: number, to?: number): [number, number][];
/** Points, with the box that holds them. */
export interface HeldPoints { readonly points: readonly Xy[]; readonly left: number; readonly top: number; readonly right: number; readonly bottom: number }
/** A cable walked (walkWay) and held, marked with its way: labelPlace passes over the cable's own. */
export interface HeldRun extends HeldPoints { readonly of: unknown }
export function held(points: readonly Xy[]): { points: [number, number][]; left: number; top: number; right: number; bottom: number };
/** A cable's points with the last pulled `back` px towards the one before (never past 1 px short of that run's start): a new list. */
export function stopShort(points: readonly Xy[], back?: number): [number, number][];
/** A cable's lead into a port at `end` (0 its start, 1 its end), holding `count` of its points (2, or 3 with a riser): the line rounded from that end, the lead's pieces (through its floor corner) and their length in px. */
export function cableLead(cable: { readonly points: readonly Xy[]; readonly radius?: number }, end: 0 | 1, count: number, back?: number): { way: RoundedWay; pieces: RoundedWay['pieces']; length: number };
/** A cable's line: `points` with the last pulled `back` px towards the one before (never past 1 px short of that run's start), corners rounded `radius` (0). */
export function cableWay(cable: { readonly points: readonly Xy[]; readonly radius?: number }, back?: number): RoundedWay;
/**
 * Where a cable's label stands, [x, y]: the first of LABEL_PLACES where no outline in `hides` covers its plate and no
 * other cable in `runs` runs through it; else the least hidden, then the least crossed, then the earliest. `looks` is
 * spent (CABLE.looks for a map); `tip` the cable's tip (way.at(1) when left out).
 */
export function labelPlace(way: RoundedWay, half: Xy, hides: readonly HeldPoints[], runs?: readonly HeldRun[], looks?: { left: number }, tip?: Xy): [number, number];
/** How far a ray from `p` along the unit vector `u` runs before it leaves an outline with no dent (Infinity: never). */
export function exitOutline(points: readonly Xy[], p: Xy, u: Xy): number;
/** How far a ray from `p` (inside the box) along the unit vector `u` runs before it leaves the box. */
export function exitBox(box: IsoBox, p: Xy, u: Xy): number;
/** A round thing's outline: the upper half of its top, then the lower half of its foot (grid.cylinder's ellipses), each in `steps` runs. */
export function roundOutline(top: IsoEllipse, bottom: IsoEllipse, steps?: number): IsoPoint[];
/** A wire's lane among those joining the same two pieces; `flip`: it runs against the pair's own direction (its names in order). */
export interface StraightLane { readonly k: number; readonly count: number; readonly flip: boolean }
/** Each wire's lane: one entry a wire, [from, to] by name, or null for a wire that takes none. */
export function lanesOf(pairs: readonly (readonly [string, string] | null)[]): (StraightLane | null)[];
/** One end of a straight wire: what a block draws (its outline), or a flat piece's box; `middle` the line is drawn between. */
export type StraightEnd = { readonly middle: Xy; readonly outline: readonly Xy[] } | { readonly middle: Xy; readonly box: IsoBox };
/** A straight wire in the pair's own direction: {start, end}, or why it cannot be drawn ('middle': the two share a middle; 'close': under CABLE.least px between). */
export function straightRun(a: StraightEnd, b: StraightEnd, lane?: { readonly k: number; readonly count: number }): { start: [number, number]; end: [number, number]; why?: undefined } | { why: 'middle' | 'close'; start?: undefined; end?: undefined };
/** A wire bent `bend` px off its straight line: the curve's control point, its tip pulled `back` px, the way it arrives (a unit vector). */
export function bentWire(a: Xy, e: Xy, bend?: number, back?: number): { corner: [number, number]; tip: [number, number]; heading: [number, number] };
/** A quadratic curve from `a` to `e` drawn towards `c`, as a way, walked in `runs` straight runs (64). */
export function curveWay(a: Xy, c: Xy, e: Xy, runs?: number): RoundedWay;
/** The unit vector from `from` to `to` ([0, 0] for a point onto itself). */
export function headingOf(from: Xy, to: Xy): [number, number];
/** An arrow's head at `tip` pointing the way `heading`: [tip, left, right], `size` px long (CABLE.head). */
export function arrowHead(tip: Xy, heading: Xy, size?: number): [[number, number], [number, number], [number, number]];

// ── Styles (0.23.0): a row of named choices, each giving back a paint list as data (docs/design/2026-11-iso-styles.md) ──

/** A fill: the recipe a shading gave (the base mixed `share` of the way toward `toward`; null: the colour as given) and, when the caller gave a base, the colour it comes to (null: the page decides). */
export interface PaintFill { readonly mix: readonly [string, number] | null; readonly colour: string | null }
/** A stroke: its colour (null: the page's), its alpha, width in px, join and cap. */
export interface PaintStroke { readonly colour: string | null; readonly alpha: number; readonly width: number; readonly join: 'round' | 'miter' | 'bevel'; readonly cap: 'butt' | 'round' | 'square' }
interface PaintBase { readonly role: string; readonly of: string; readonly fill: PaintFill | null; readonly stroke: PaintStroke | null }
/** One segment of a path: move, line, an arc of an ellipse from angle `from` to `to` (radians, y down, as a canvas's `ellipse`), or close. */
export type PaintSegment = readonly ['move', number, number] | readonly ['line', number, number] | readonly ['arc', number, number, number, number, number, number, boolean] | readonly ['close'];
/** One item of a paint list: what a painter draws, in order. Points are any finite numbers; an arc spans more than 0 and at most π, its radii both above 0, reached by a line from the pen (none when the pen is already at its start). `role` says what it is (`top`, `left`, `right`, `side`, `ground`, `grid`, or a style's own); `of` names the piece. */
export type PaintItem =
  | (PaintBase & { readonly item: 'polygon'; readonly points: readonly (readonly [number, number])[] })
  | (PaintBase & { readonly item: 'ellipse'; readonly cx: number; readonly cy: number; readonly rx: number; readonly ry: number })
  | (PaintBase & { readonly item: 'path'; readonly segments: readonly PaintSegment[] })
  | (PaintBase & { readonly item: 'lines'; readonly segments: readonly (readonly [number, number, number, number])[] })
  /** A line drawn by hand (footprint-story/human · strokes): each point [x, y, width there, t in seconds from the piece's start]. Its fill is null. */
  | (PaintBase & { readonly item: 'stroke'; readonly points: readonly (readonly [number, number, number, number])[] });
/** The kinds of item a painter draws; the most items one piece's list holds; the most points or segments in one item. */
export const PAINT_ITEMS: readonly ['polygon', 'ellipse', 'path', 'lines', 'stroke'];
export const MOST_PAINT_ITEMS: number;
export const MOST_PAINT_POINTS: number;
/** `hex` mixed `share` of the way toward `toward`, each channel rounded: CSS `color-mix` in srgb. Each colour in is `#rgb` or `#rrggbb`, any case (anything else is refused); the colour out is lower-case `#rrggbb`. */
export function mixColour(hex: string, toward: string, share: number): string;

/** The columns of a style, in the order they run. */
export type IsoStyleColumn = 'shape' | 'shading' | 'line' | 'palette' | 'texture' | 'effects';
export const ISO_STYLE_COLUMNS: readonly ['shape', 'shading', 'line', 'palette', 'texture', 'effects'];
/** A column's entry: a choice's name, or `{name, …its options}`. */
export type IsoStyleEntry = string | ({ readonly name: string } & Readonly<Record<string, number | string | boolean>>);
/** The named looks (0.34.0; paper-grain and duotone 0.35.0): a look is a style row under a name. */
export type IsoLookName = 'outlined' | 'line-art' | 'paper-grain' | 'duotone';
/** A row of choices; a column left out is the usual one (or the named look's, when `look` names one: a column written beside it replaces the look's entry, whole). */
export interface IsoStyleRow { readonly look?: IsoLookName | null; readonly shape?: IsoStyleEntry; readonly shading?: IsoStyleEntry; readonly line?: IsoStyleEntry; readonly palette?: IsoStyleEntry; readonly texture?: IsoStyleEntry; readonly effects?: readonly IsoStyleEntry[] }
/** A style as isoStyle makes it — plain data, the record of it: a name per column, and the options written. */
export interface IsoStyle {
  readonly row: { readonly shape: string; readonly shading: string; readonly line: string; readonly palette: string; readonly texture: string; readonly effects: readonly string[] };
  readonly options: Readonly<Partial<Record<Exclude<IsoStyleColumn, 'effects'>, Readonly<Record<string, number | string | boolean>>>>> & { readonly effects?: readonly Readonly<Record<string, number | string | boolean>>[] };
  /** The look the row named, kept for the record (absent when it named none). The row is what it came to. */
  readonly look?: IsoLookName;
}
/**
 * The named looks, each a style row (0.34.0): `outlined` (the sticker look: tones, a bold even contour, lighter inner
 * lines) and `line-art` (paper faces, a 3 px contour, 1.25 px folds; the floor's tile lines the faintest). Named in a
 * row as `{look: 'outlined'}`; the same style as its row written out. 0.35.0: `paper-grain` (`{texture: 'human:grain'}`:
 * a fine, faint, seeded grain over every face — hand footprint-story/human's `grainTexture`, or its HUMAN_STYLE_CHOICES,
 * in `choices`) and `duotone` (`{palette: 'duotone'}`: every line the ink, every fill a tint of the accent on the paper).
 */
export const ISO_LOOKS: { readonly outlined: IsoStyleRow; readonly 'line-art': IsoStyleRow; readonly 'paper-grain': IsoStyleRow; readonly duotone: IsoStyleRow };
/**
 * The palette "duotone"'s numbers (ours, 0.35.0): its inks (`ink` every line, `accent` the tints, `paper` what they are
 * mixed from), the deepest tint (`most`, 0.6 of the way to the accent), the base a fill with no colour is read over
 * (`neutral`), and the least contrast a name in the ink keeps on every tint (`text`, 4.5 : 1 — a duotone whose inks
 * cannot is refused). A tool drawing names on a duotone map draws them in its ink: `style.options.palette?.ink ?? DUOTONE.ink`.
 */
export const DUOTONE: { readonly ink: string; readonly accent: string; readonly paper: string; readonly most: number; readonly neutral: string; readonly text: number };
/** The contour line's numbers (ours): the contour as it shows (`width`, 5 px; 1 to 20) and the inner lines (`inner`, 1.5 px; 0.25 to the width). Drawn under the faces at 2 · width − inner. */
export const CONTOUR: { readonly width: number; readonly inner: number; readonly least: number; readonly most: number; readonly leastInner: number };
/** Today's look: box, tones, ink, theme, none, no effects. */
export const USUAL_STYLE: { readonly shape: 'box'; readonly shading: 'tones'; readonly line: 'ink'; readonly palette: 'theme'; readonly texture: 'none'; readonly effects: readonly [] };
/** The names of the choices this package ships, by column. */
export const ISO_STYLE_CHOICES: Readonly<Record<IsoStyleColumn, readonly string[]>>;
export const MOST_EFFECTS: number;
export const MOST_OWN_CHOICES: number;

/** A piece as a style reads it. */
export interface IsoStylePiece { readonly name: string; readonly kind?: 'block' | 'cylinder' | 'floor'; readonly at: readonly number[]; readonly size: readonly number[] }
/** What a choice's apply is handed: the piece, the colours (null: the page decides), its options, and numbers from 0 to 1 seeded by the style, the piece and the column. */
export interface IsoStyleContext { readonly piece: Required<IsoStylePiece>; readonly colours: { readonly base: string | null; readonly ink: string | null }; readonly options: Readonly<Record<string, number | string | boolean>>; random(): number }
/**
 * A tool's own choice, named with its prefix (`'reel:chalk'`). A `shape` choice's apply takes `{piece, grid}` and gives
 * `{box, centre, outline, items}`; every other column's takes the items and gives items. `check` refuses an option it cannot take, once,
 * when the style is made; `clashes` names the choices it cannot sit with, and the fix.
 */
export interface IsoStyleChoice {
  readonly column: IsoStyleColumn;
  readonly name: string;
  apply(input: any, context: IsoStyleContext): any;
  readonly options?: readonly string[];
  /** The options it reads that say when, not what (a pen's speed): left out of the seed, so a slower draw keeps its wobble. Each one of `options`. */
  readonly unseeded?: readonly string[];
  check?(options: Readonly<Record<string, number | string | boolean>>): void;
  readonly clashes?: readonly { readonly column: IsoStyleColumn; readonly name: string; readonly fix: string }[];
}
/**
 * A style, checked: the columns left out are the usual ones; `choices` are a tool's own. Refuses an unknown column or
 * choice (naming the ones there are), an option a choice does not take, and a pairing a choice says cannot work (with
 * its fix).
 */
export function isoStyle(row?: IsoStyleRow | null, settings?: { readonly choices?: readonly IsoStyleChoice[] } | null): IsoStyle;
/**
 * A style made again from its record (`{row, options}`, as isoStyle gives it and a built map keeps it): the same
 * choices, the same seeds. A tool's own choices are code, which no record holds: hand them again in `settings.choices`.
 */
export function restyle(record: IsoStyle, settings?: { readonly choices?: readonly IsoStyleChoice[] } | null): IsoStyle;
/**
 * A piece's paint list in a style: `{box, centre, outline, items}`, frozen plain data — the box round it, where its
 * name stands, the outline round it (what a cable's end and a label keep clear of), and the items. A floor's lift is dropped. `grid` is the map's; `colours` the base and the
 * ink, or none (each fill then carries its recipe and no colour, for a page whose CSS colours by role). Each column's
 * output is checked before the next reads it.
 */
export function paintPiece(style: IsoStyle, piece: IsoStylePiece, grid: IsoGrid, colours?: { readonly base?: string | null; readonly ink?: string | null } | null): { readonly box: { readonly x: number; readonly y: number; readonly w: number; readonly h: number }; readonly centre: readonly [number, number]; readonly outline: readonly (readonly [number, number])[]; readonly items: readonly PaintItem[] };

// ── The map's steps (0.24.0; a deck's inputs 0.25.0): an isometric map built as named, pure steps (docs/design/2026-11-map-flow.md) ──

/** The colours a piece is painted with: `#rrggbb` each, or null for the page's. */
export interface IsoMapColours { readonly base?: string | null; readonly ink?: string | null }
/** A block (or a cylinder) of the spec. `who` is the tool's words for where it was written: every refusal names it. */
export interface IsoMapBlockSpec { readonly name: string; readonly kind?: 'block' | 'cylinder'; readonly at?: readonly number[] | null; readonly size: readonly [number, number, number]; readonly label?: string | null; readonly small?: string | null; readonly rule?: 'even' | 'fill' | null; readonly group?: string | null; readonly ports?: readonly IsoPort[] | null; readonly colours?: IsoMapColours | null; readonly who?: string }
/** A floor of the spec: its at and size, or neither (fitted round its blocks). `icon` (0.25.0): the tool draws an icon before its label, which then has that much less room. */
export interface IsoMapFloorSpec { readonly name?: string | null; readonly at?: readonly [number, number] | null; readonly size?: readonly [number, number] | null; readonly label?: string | null; readonly icon?: boolean | null; readonly group?: string | null; readonly colours?: IsoMapColours | null; readonly who?: string }
/** What stands on the floor that the tool draws itself (0.25.0; StoryDeck's footprint): laid round, may be a wire's end, fitted round, kept clear of by a floor's label, painted in order. */
export interface IsoMapObstacleSpec { readonly name: string; readonly at: readonly number[]; readonly size: readonly [number, number, number]; readonly ports?: readonly IsoPort[] | null; readonly who?: string }
/** A stretch of floor kept clear under words placed over the picture (0.25.0; routes · keep), in tiles; `name` names the words a route's `under` says. */
export interface IsoMapKeepSpec { readonly at: readonly number[]; readonly size: readonly [number, number]; readonly name: string }
/** A grid in numbers: a tile's width (and height), where the floor's far corner stands, and a unit of height. */
export interface IsoMapGridSpec { readonly tile: number | readonly [number, number]; readonly origin: readonly [number, number]; readonly rise?: number }
/** One end of a wire: a block's (or an obstacle's) name, and a port of it. */
export interface IsoMapEnd { readonly block: string; readonly port?: string | null }
export interface IsoMapWireSpec { readonly name?: string | null; readonly from: IsoMapEnd; readonly to: IsoMapEnd; readonly straight?: boolean; readonly who?: string }
/**
 * The map as data, read by a tool from its own format. All or none of the blocks have an at; a grid in numbers, the word
 * 'fit' (the map asks for the fitted grid), or an area to fit the picture into. `usualGrid` (0.25.0): the grid a map that
 * places its own blocks and writes none is drawn on (StoryDeck's: tile 120, its far corner at the slide's middle, 240 px down).
 */
export interface IsoMapSpec { readonly blocks?: readonly IsoMapBlockSpec[] | null; readonly floors?: readonly IsoMapFloorSpec[] | null; readonly wires?: readonly IsoMapWireSpec[] | null; readonly obstacles?: readonly IsoMapObstacleSpec[] | null; readonly keep?: readonly IsoMapKeepSpec[] | null; readonly grid?: IsoMapGridSpec | 'fit' | null; readonly usualGrid?: IsoMapGridSpec | null; readonly area?: readonly [number, number, number, number] | null; readonly style?: IsoStyleRow | null; readonly who?: string }
/** A tool's own numbers: a fitted tile's most and least px (`grouped`: the least for a map of groups), the inset and floor margin, a name's and a small line's size and least (small null: left as written), the share of a top's room a name gets, which floors a fitted picture holds, and (0.25.0) what a block covers of a floor's label: the outline it draws ('drawn', when left out) or the block it stands in ('block', StoryDeck's). */
export interface IsoMapPolicy {
  readonly fit: { readonly most: number; readonly least: number; readonly grouped: number; readonly inset: number; readonly margin: number };
  readonly name: { readonly size: number; readonly least: number };
  readonly small: { readonly size: number; readonly least: number } | null;
  readonly clear: number;
  readonly hold: 'groups' | 'groups-and-labels';
  readonly cover?: 'drawn' | 'block';
}
/** The tools' numbers: `film` StoryReel's (pinned), `deck` StoryDeck's. */
export const ISO_MAP_POLICIES: { readonly film: IsoMapPolicy; readonly deck: IsoMapPolicy };
/** How much a map holds: blocks, floors and obstacles together, wires, stretches kept clear, the letters of a name, a block's label (2000) and a floor's (120), a group and a `who`. */
export const ISO_MAP_LIMITS: { readonly pieces: number; readonly wires: number; readonly keep: number; readonly name: number; readonly label: number; readonly group: number; readonly who: number };
/** A piece's shape: the box round it, where its name stands, its outline, and its faces (the style's shape column, no fill or stroke yet). */
export interface IsoMapShape { readonly box: IsoBox; readonly centre: readonly [number, number]; readonly outline: readonly (readonly [number, number])[]; readonly faces: readonly PaintItem[] }
/** A block as the built map keeps it: checked, its at as written (or null), its ports read. */
export interface IsoMapBlock { readonly name: string; readonly kind: 'block' | 'cylinder'; readonly at: readonly [number, number, number] | null; readonly size: readonly [number, number, number]; readonly label: string | null; readonly small: string | null; readonly rule: 'even' | 'fill' | null; readonly group: string | null; readonly ports: readonly IsoPort[]; readonly colours: { readonly base: string | null; readonly ink: string | null } | null; readonly who: string }
export interface IsoMapFloor { readonly name: string | null; readonly at: readonly [number, number] | null; readonly size: readonly [number, number] | null; readonly label: string | null; readonly icon: boolean; readonly group: string | null; readonly colours: { readonly base: string | null; readonly ink: string | null } | null; readonly who: string }
export interface IsoMapObstacle { readonly name: string; readonly at: readonly [number, number, number]; readonly size: readonly [number, number, number]; readonly ports: readonly IsoPort[]; readonly who: string }
export interface IsoMapWire { readonly name: string | null; readonly from: { readonly block: string; readonly port: string | null }; readonly to: { readonly block: string; readonly port: string | null }; readonly straight: boolean; readonly who: string }
/**
 * The built map: the last state of the steps, frozen plain data. Lists run in the spec's order (block i, floor i, wire i).
 * `placed`/`placedWhy` and `grid`/`gridWhy` are the two choices and their reasons.
 */
export interface IsoMap {
  readonly who: string; readonly blocks: readonly IsoMapBlock[]; readonly floors: readonly IsoMapFloor[]; readonly wires: readonly IsoMapWire[];
  readonly obstacles: readonly IsoMapObstacle[]; readonly keep: readonly { readonly at: readonly [number, number, number]; readonly size: readonly [number, number]; readonly name: string }[];
  /** The grid as the map writes it: its numbers, 'fit', or null. */
  readonly written: IsoMapGridSpec | 'fit' | null; readonly usualGrid: IsoMapGridSpec | null;
  readonly area: readonly [number, number, number, number] | null; readonly style: IsoStyle; readonly policy: IsoMapPolicy & { readonly cover: 'drawn' | 'block' };
  readonly placed: 'hand' | 'build'; readonly placedWhy: string; readonly at: readonly (readonly [number, number, number])[];
  /** Each wire's route, its ends and what it passes behind by the pieces' names (and, with keep, `under`: the words it could not keep off); null for a straight wire. */
  readonly routes: readonly (IsoRoute | IsoNoRoute | null)[];
  readonly floorTiles: readonly { readonly at: readonly [number, number]; readonly size: readonly [number, number] }[];
  readonly grid: 'written' | 'fitted' | 'usual'; readonly gridWhy: string; readonly view: { readonly tile: readonly [number, number]; readonly origin: readonly [number, number]; readonly rise: number };
  readonly shapes: readonly IsoMapShape[]; readonly floorShapes: readonly IsoMapShape[];
  /** Each obstacle's block on the frame: its box, centre and outline (the tool draws the obstacle itself). */
  readonly obstacleShapes: readonly { readonly box: IsoBox; readonly centre: readonly [number, number]; readonly outline: readonly (readonly [number, number])[] }[];
  readonly names: readonly (FittedWords | null)[]; readonly smalls: readonly (FittedWords | null)[];
  /** The blocks' and obstacles' names, the furthest first: the order they are painted in. */
  readonly order: readonly string[];
  readonly floorLabels: readonly (FloorLabel | null)[];
  readonly paints: readonly (readonly PaintItem[])[]; readonly floorPaints: readonly (readonly PaintItem[])[];
}
/** The state a step is handed and gives back: the map's keys so far (a step reads only its `reads`). */
export type IsoMapState = Readonly<Partial<IsoMap>>;
/** A part of a step: the keys it reads and writes, and its pure function (a new state; the input is never edited). `tools`: the tool's own style choices (only `shape` and `style` read them). */
export interface IsoMapPart { readonly reads: readonly (keyof IsoMap)[]; readonly writes: readonly (keyof IsoMap)[]; run(state: IsoMapState, tools?: IsoMapSettings | null): IsoMapState }
/** One step: its name and what it does in words, its reads and writes, and — for a step that chooses — its choice (`decides`, writing the choice under `key` and its reason under `why`) and a branch per choice. */
export interface IsoMapStep extends IsoMapPart { readonly name: 'place' | 'route' | 'fitFloors' | 'grid' | 'shape' | 'names' | 'order' | 'floorLabels' | 'style'; readonly about: string; readonly decides?: IsoMapPart & { readonly key: 'placed' | 'grid'; readonly why: 'placedWhy' | 'gridWhy' }; readonly branches?: Readonly<Record<string, IsoMapPart>> }
/** The steps, in order: place, route, fitFloors, grid, shape, names, order, floorLabels, style. */
export const ISO_MAP_STEPS: readonly IsoMapStep[];
/**
 * A tool's own style choices, handed beside the spec (data a tool writes) and the policy (its numbers): the choices the
 * spec's style may name besides this package's — footprint-story/human's `sketchyLine` (`human:sketchy`) and
 * `hatchTexture` (`human:hatch`), or a tool's `reel:chalk`. Code, never state: the built map's `style` names the ones it used.
 */
export interface IsoMapSettings { readonly choices?: readonly IsoStyleChoice[] | null }
/**
 * The map built: the spec and the policy checked (a refusal names the piece's `who` and the fix), then each step in
 * order, each handed `settings`' choices. Frozen plain data. A style naming a tool's choice not handed in is refused, with the fix.
 */
export function buildIsoMap(spec: IsoMapSpec, policy: IsoMapPolicy, settings?: IsoMapSettings | null): IsoMap;

// ---- moving pieces (0.32.0): where a moving block stands, whether it passes through another, what it hides --------

/** A place in tiles: [col, row] or [col, row, lift]. */
export type IsoTiles = readonly number[];
/** A block standing somewhere: the block as the caller holds it (handed back by identity) and its corner in tiles. */
export interface IsoStanding<B extends { readonly size: readonly number[] } = { readonly size: readonly number[] }> { readonly block: B; readonly at: IsoTiles }
/** What a block lands on: the highest top under it (`block` and `at` null for the floor), at `lift`. */
export interface IsoLanding<B = unknown> { readonly lift: number; readonly block: B | null; readonly at: [number, number, number] | null }
/** How close two numbers may be and still count as one place, in tiles (1e-6). */
export const SAME_PLACE: number;
/** A block's foot in tiles: the middle of its footprint, at its lift. */
export function footOf(at: IsoTiles, size: readonly number[]): [number, number, number];
/** A block's top in tiles: the middle of its footprint, at its lift and height. */
export function topOf(at: IsoTiles, size: readonly number[]): [number, number, number];
/** A block's corner from its foot. */
export function cornerOf(foot: IsoTiles, size: readonly number[]): [number, number, number];
/** The highest top of `others` under a block that is not above its foot, else the floor. */
export function landingUnder<B extends { readonly size: readonly number[] }>(at: IsoTiles, size: readonly number[], others: readonly IsoStanding<B>[]): IsoLanding<B>;
/** Whether a foot is over what holds it (landingUnder's): inside that top, edges included, or anywhere on the floor. */
export function overTop(foot: IsoTiles, under: { readonly block: { readonly size: readonly number[] } | null; readonly at: IsoTiles | null }): boolean;
/** Whether `rider` rests on the top of `base`. */
export function ridesOn(rider: IsoStanding, base: IsoStanding): boolean;

/** How near a lift must be to a level the body keeps to be that level, in tiles (1e-9). */
export const LEVEL_SNAP: number;
/** A foot's place in tiles from where it is drawn, during a move between two feet (`share` of its time, 0 to 1, when both stand on one line of places). */
export function footTiles(grid: IsoGrid): (point: readonly [number, number], move: { readonly from: IsoTiles; readonly to: IsoTiles }, share: number) => [number, number, number];
/** The world's own px in one tile: a tile's width over √2. */
export function worldPx(grid: IsoGrid): number;
/** How a side-on move lies back on the floor. */
export interface IsoSideWay { readonly origin: readonly number[]; readonly heading: readonly number[]; readonly unit: number; readonly offset?: number; readonly levels: readonly number[] }
/** Where a side-on sample ({x, y}, world px) puts the body's foot, in tiles. */
export function sideFoot(side: IsoSideWay, sample: { readonly x: number; readonly y: number }): [number, number, number];

/** How deep a moving block may go into another before it passes through it, in tiles (0.05). */
export const THROUGH_MOST: number;
/** How often a move is checked, a second (30). */
export const CHECKS_PER_SECOND: number;
/** The most steps a move is checked in (900). */
export const MOST_CHECKS: number;
/** Another block moving straight over a stretch: its corners at the stretch's two ends. */
export interface IsoMover<B extends { readonly size: readonly number[] } = { readonly size: readonly number[] }> { readonly block: B; readonly from: IsoTiles; readonly to: IsoTiles }
/** The deepest a block goes into the others on one straight stretch, past THROUGH_MOST, or null. */
export function sweptThrough<B extends { readonly size: readonly number[] }>(size: readonly number[], from: IsoTiles, to: IsoTiles, others: readonly IsoMover<B>[]): { block: B; depth: number; share: number } | null;
/** The moments a move is checked at: its ends and CHECKS_PER_SECOND a second between (2 to MOST_CHECKS steps). */
export function checkMoments(seconds: number, start?: number): number[];
/** One stretch of a move: from t0 to t1, the block's size and corners at both, the others where they stand then. */
export interface IsoStretch<B extends { readonly size: readonly number[] } = { readonly size: readonly number[] }> { readonly t0: number; readonly t1: number; readonly size: readonly number[]; readonly from: IsoTiles; readonly to: IsoTiles; readonly others: readonly IsoMover<B>[] }
/** The deepest pass over a move's stretches and when, or null. */
export function deepestPass<B extends { readonly size: readonly number[] }>(stretches: readonly IsoStretch<B>[]): { block: B; depth: number; t: number } | null;
/** A finding, in words free of any tool's syntax: a tool prefixes the critic with its own name. */
export interface IsoMotionFinding { critic: 'contact' | 'covers'; level: 'warn'; message: string; fix: string }
/** A pass as a finding (`hit.t` from the move's start). */
export function passFinding(hit: { readonly block: unknown; readonly depth: number; readonly t: number }, move: { readonly do?: string; readonly tie?: string }): IsoMotionFinding;

/** Null when a point is on the frame, else how far off it lies, in words. */
export function offFrame(point: readonly [number, number], frame: readonly [number, number]): string | null;
/** What of a drawn block is off the frame: its outline first, then a hang's rope. */
export function drawnOff(outline: readonly (readonly [number, number])[], rope: readonly (readonly [number, number])[] | null | undefined, frame: readonly [number, number]): { part: 'block' | 'rope'; off: string } | null;
/** A point of a block as built, where its pose puts it: scaled about the pivot, then moved. */
export function posed(point: readonly [number, number], pose: { readonly dx: number; readonly dy: number; readonly pivot: readonly [number, number]; readonly sx?: number; readonly sy?: number }): [number, number];

/** How wide a letter of a name is taken, as a share of its size (1.2): font-free. */
export const NAME_WIDTH: number;
/** A block's words on its top as a box on the frame, or null when its name has no lines. */
export function nameBox(name: { readonly lines: readonly string[]; readonly size: number }, small: { readonly text: string; readonly size: number } | null, centre: readonly [number, number]): [number, number, number, number] | null;
/** Whether a convex outline and a box overlap. */
export function overlapsBox(points: readonly (readonly [number, number])[], box: readonly [number, number, number, number]): boolean;
/** The paint order of things where a moment puts them, by index, the furthest first (grid.backToFront). */
export function orderAt(grid: IsoGrid, things: readonly IsoThing[]): number[];
/** Which resting block (its index in things) hides each name, or null. */
export function hiddenNames(grid: IsoGrid, things: readonly IsoThing[], names: readonly { readonly piece: number; readonly box: readonly [number, number, number, number] }[], covers: readonly { readonly piece: number; readonly outline: readonly (readonly [number, number])[] }[]): (number | null)[];
/** A move that comes to rest over a name, as a finding. */
export function coverFinding(name: string, label: string): IsoMotionFinding;
