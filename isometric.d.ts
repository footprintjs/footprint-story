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
/** One item of a paint list: what a painter draws, in order. `role` says what it is (`top`, `left`, `right`, `side`, `ground`, `grid`, or a style's own); `of` names the piece. */
export type PaintItem =
  | (PaintBase & { readonly item: 'polygon'; readonly points: readonly (readonly [number, number])[] })
  | (PaintBase & { readonly item: 'ellipse'; readonly cx: number; readonly cy: number; readonly rx: number; readonly ry: number })
  | (PaintBase & { readonly item: 'path'; readonly segments: readonly PaintSegment[] })
  | (PaintBase & { readonly item: 'lines'; readonly segments: readonly (readonly [number, number, number, number])[] });
/** The kinds of item a painter draws; the most items one piece's list holds; the most points or segments in one item. */
export const PAINT_ITEMS: readonly ['polygon', 'ellipse', 'path', 'lines'];
export const MOST_PAINT_ITEMS: number;
export const MOST_PAINT_POINTS: number;
/** `hex` mixed `share` of the way toward `toward`, each channel rounded (`#rrggbb` in and out): CSS `color-mix` in srgb. */
export function mixColour(hex: string, toward: string, share: number): string;

/** The columns of a style, in the order they run. */
export type IsoStyleColumn = 'shape' | 'shading' | 'line' | 'palette' | 'texture' | 'effects';
export const ISO_STYLE_COLUMNS: readonly ['shape', 'shading', 'line', 'palette', 'texture', 'effects'];
/** A column's entry: a choice's name, or `{name, …its options}`. */
export type IsoStyleEntry = string | ({ readonly name: string } & Readonly<Record<string, number | string | boolean>>);
/** A row of choices; a column left out is the usual one. */
export interface IsoStyleRow { readonly shape?: IsoStyleEntry; readonly shading?: IsoStyleEntry; readonly line?: IsoStyleEntry; readonly palette?: IsoStyleEntry; readonly texture?: IsoStyleEntry; readonly effects?: readonly IsoStyleEntry[] }
/** A style as isoStyle makes it — plain data, the record of it: a name per column, and the options written. */
export interface IsoStyle {
  readonly row: { readonly shape: string; readonly shading: string; readonly line: string; readonly palette: string; readonly texture: string; readonly effects: readonly string[] };
  readonly options: Readonly<Partial<Record<Exclude<IsoStyleColumn, 'effects'>, Readonly<Record<string, number | string | boolean>>>>> & { readonly effects?: readonly Readonly<Record<string, number | string | boolean>>[] };
}
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
 * `{box, items}`; every other column's takes the items and gives items. `check` refuses an option it cannot take, once,
 * when the style is made; `clashes` names the choices it cannot sit with, and the fix.
 */
export interface IsoStyleChoice {
  readonly column: IsoStyleColumn;
  readonly name: string;
  apply(input: any, context: IsoStyleContext): any;
  readonly options?: readonly string[];
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
 * A piece's paint list in a style: `{box, items}`, frozen plain data. `grid` is the map's; `colours` the base and the
 * ink, or none (each fill then carries its recipe and no colour, for a page whose CSS colours by role). Each column's
 * output is checked before the next reads it.
 */
export function paintPiece(style: IsoStyle, piece: IsoStylePiece, grid: IsoGrid, colours?: { readonly base?: string | null; readonly ink?: string | null } | null): { readonly box: { readonly x: number; readonly y: number; readonly w: number; readonly h: number }; readonly items: readonly PaintItem[] };
