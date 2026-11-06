/**
 * footprint-story/shot — a camera in 3D as plain data: where it stands, what it is on, and what it really sees.
 * Pure: runs anywhere, imports nothing. Nothing here draws. Every reader takes untrusted data and refuses it in words.
 */

/** One thing to fix: `at` is the place in the data, as it is written. */
export interface ShotProblem { readonly at: string; readonly message: string }

// ── words ─────────────────────────────────────────────────────────────────────────────────────────────────

export type ViewRound = 'front' | 'front-right' | 'right' | 'back-right' | 'back' | 'back-left' | 'left' | 'front-left';
export type ViewHeight = 'high' | 'level' | 'low';
export type ShotSize = 'wide' | 'medium' | 'close' | 'insert';
export type ShotLens = 'wide' | 'normal' | 'long';
/** Where the camera stands, as a named view: one of the eight round the subject, a height, or both ('front-left high'). */
export type ViewName = ViewRound | ViewHeight | `${ViewRound} ${ViewHeight}`;

/** Where the camera stands round the subject, in degrees. `front` is on the +z side, `left` on the -x side. */
export const ROUNDS: Readonly<Record<ViewRound, number>>;
/** How high it stands, in degrees. */
export const HEIGHTS: Readonly<Record<ViewHeight, number>>;
/** How much of the frame's height the subject fills, by size word. Starting choices, not measurements. */
export const SIZES: Readonly<Record<ShotSize, number>>;
/** A lens as a share of the frame's height. */
export const LENSES: Readonly<Record<ShotLens, number>>;
/** The most things a scene or a shot may hold. */
export const MOST_THINGS: number;

/** A named view read: `name` in full ('front level'), the angles in radians. Throws, naming the words. */
export function readView(from: ViewName): { readonly name: string; readonly azimuth: number; readonly elevation: number };

// ── scene and shot ────────────────────────────────────────────────────────────────────────────────────────

export type Vector = readonly [number, number, number];
/** A ball (`r`), a point (neither `r` nor `size`) or a card (`size`; `normal` is the way it faces, front by default; `back: true` when seeing its back is fine). */
export interface Thing { readonly name: string; readonly at: Vector; readonly r?: number; readonly size?: readonly [number, number]; readonly normal?: Vector; readonly back?: boolean }
/** What a tool knows about the picture in 3D. Names are read with hidden characters gone, and must then differ. */
export interface Scene { readonly unit?: string; readonly up?: 'y'; readonly things: readonly Thing[] }
export interface ReadScene { readonly unit: string; readonly up: 'y'; readonly things: readonly Thing[] }
/** Every problem in a scene; [] when it can be read. Never throws on what it is given. */
export function sceneProblems(scene: unknown): readonly ShotProblem[];
/** A scene read and frozen. Throws, its `problems` listing all of them. */
export function readScene(scene: unknown): ReadScene;

/** A shot as written. `shot` is where a film's list names the subject and `on` where a deck's click does: use one. `at`, `until`, `seconds`, `ease` and `feel` belong to whoever flies it, and nothing here reads them. */
export interface Shot {
  readonly on?: string | readonly string[];
  readonly shot?: string | readonly string[];
  readonly from: ViewName;
  /** What is sharp: a thing, or 'all' for a pinhole. The subject by default. */
  readonly focus?: string;
  readonly size?: ShotSize;
  readonly lens?: ShotLens;
  readonly at?: unknown;
  readonly until?: unknown;
  readonly seconds?: unknown;
  readonly ease?: unknown;
  readonly feel?: unknown;
}
export interface ReadShot { readonly on: readonly string[]; readonly from: string; readonly size: ShotSize; readonly lens: ShotLens; readonly focus?: string }
/** Every problem in a shot on a scene; [] when it can be read. Never throws on what it is given. */
export function shotProblems(shot: unknown, scene: unknown): readonly ShotProblem[];
/** A shot read and frozen. Reading its own answer gives the same answer. Throws, its `problems` listing all of them. */
export function readShot(shot: unknown, scene: unknown): ReadShot;

// ── camera and projection ─────────────────────────────────────────────────────────────────────────────────

/** A camera circling `target`: angles in radians, `focal` as a share of the frame's height, `aperture` a lens radius in the scene's units (0 is a pinhole). */
export interface Camera {
  readonly target: Vector;
  readonly azimuth: number;
  readonly elevation: number;
  readonly distance: number;
  readonly focal: number;
  readonly aperture?: number;
  /** The depth that is sharp: `distance` unless it says otherwise. */
  readonly focus?: number;
  /** Slides the picture by a share of the frame, right and up. */
  readonly shift?: readonly [number, number];
}
export type ReadCamera = Required<Camera>;
/** [width, height] in pixels. */
export type Frame = readonly [number, number];

/** A camera read and whole, with `aperture`, `focus` and `shift` filled in. Throws, listing every problem. */
export function readCamera(camera: unknown): ReadCamera;
/** The camera a shot asks for. Throws, listing every problem. */
export function frameOf(shot: unknown, scene: unknown): Camera;
/** How far to stand so a ball of `radius` fills `share` of the frame's height, straight on. */
export function distanceFor(radius: number, share: number, focal: number): number;
/** The default lens radius at a distance, in the scene's units. Its first term does not scale with the scene. */
export function apertureFor(distance: number): number;

/** Where a point lands: y grows downward. At or behind the camera, x and y are null. */
export function project(point: Vector, camera: Camera, frame: Frame): { readonly x: number | null; readonly y: number | null; readonly depth: number };
/** The point at a place on the frame and a depth in front of the camera. */
export function unproject(x: number, y: number, depth: number, camera: Camera, frame: Frame): Vector;
/** The box a thing fills. Only a thing `seen` has one; `inside` means the camera is in it or on it, `crosses` that it reaches past the camera. */
export interface ThingBox { readonly state: 'seen' | 'behind' | 'inside' | 'crosses'; readonly x0: number | null; readonly y0: number | null; readonly x1: number | null; readonly y1: number | null; readonly depth: number }
export function boxOf(thing: Thing, camera: Camera, frame: Frame): ThingBox;

// ── the camera check ──────────────────────────────────────────────────────────────────────────────────────

export type ShotFaultKind = 'behind' | 'inside' | 'crosses' | 'off-frame' | 'cut-off' | 'too-small' | 'edge-on' | 'back' | 'blocked' | 'soft';
/** What is wrong and what to do. `on` is the subject it is about, or null when it is about all of them together. */
export interface ShotFault { readonly kind: ShotFaultKind; readonly on: string | null; readonly fix: string }
export interface ShotBlocker { readonly name: string; readonly share: number }
/** One subject as the camera sees it. Shares run 0..1, sampled by rays: good to a few percent, exact when whole. */
export interface ShotRow {
  readonly name: string;
  readonly state: ThingBox['state'];
  readonly depth: number;
  readonly inFrame: number;
  readonly height: number;
  /** The sides of the frame its box goes past. */
  readonly sides: readonly ('left' | 'right' | 'top' | 'bottom')[];
  readonly blockers: readonly ShotBlocker[];
  /** How far it spreads under the aperture, a radius in pixels. */
  readonly blur: number;
  readonly facing: 'face' | 'edge-on' | 'back' | null;
  /** False for a point, which has a place and no size. */
  readonly area: boolean;
}
export interface ShotReport {
  readonly on: readonly string[];
  /** The named view nearest the camera. */
  readonly from: string;
  /** Whether the camera stands exactly on that view. */
  readonly exactView: boolean;
  /** How far along the view the subject is; null when none of it is seen. */
  readonly depth: number | null;
  readonly unit: string;
  readonly lens: ShotLens | number;
  /** The smallest share in frame among what is seen. */
  readonly inFrame: number;
  /** The whole subject's height, as a share of the frame's. */
  readonly height: number;
  readonly size: ShotSize | null;
  readonly blockers: readonly (ShotBlocker & { readonly of: string })[];
  readonly blur: number;
  readonly rows: readonly ShotRow[];
  readonly faults: readonly ShotFault[];
  readonly ok: boolean;
}
/** What `camera` sees of what `shot` is on, from numbers alone. `shot` is a read shot or just {on}. Throws, listing every problem at once. */
export function checkShot(scene: unknown, camera: unknown, frame: unknown, shot: { readonly on: string | readonly string[] }): ShotReport;
/** The report as one line of text a model reads, with a fix for each fault. `about` before a view means the camera stands near it. `label` leads the line. */
export function shotLine(report: ShotReport, options?: { readonly label?: string }): string;
