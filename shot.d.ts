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
/** One subject as the camera sees it. Shares run 0..1, as areas on the frame; a share above 0 or below 1 never rounds to 0 or 1. */
export interface ShotRow {
  readonly name: string;
  readonly state: ThingBox['state'];
  readonly depth: number;
  readonly inFrame: number;
  readonly height: number;
  /** The sides of the frame its box goes past. */
  readonly sides: readonly ('left' | 'right' | 'top' | 'bottom')[];
  readonly blockers: readonly ShotBlocker[];
  readonly through: readonly string[];
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
  /** How many things the scene holds besides the subject: what a clear view was tested against. */
  readonly others: number;
  /** The smallest share in frame among what is seen. Exactly 1 only when nothing goes past the frame. */
  readonly inFrame: number;
  /** The whole subject's height, as a share of the frame's. */
  readonly height: number;
  readonly size: ShotSize | null;
  readonly blockers: readonly (ShotBlocker & { readonly of: string })[];
  /** Things that pass through a subject with no ray finding them in front: a small cover could still be there, so the line says so. */
  readonly through: readonly string[];
  readonly blur: number;
  readonly rows: readonly ShotRow[];
  readonly faults: readonly ShotFault[];
  readonly ok: boolean;
}
/** What `camera` sees of what `shot` is on, from numbers alone. `shot` is a read shot or just {on}. Throws, listing every problem at once. */
export function checkShot(scene: unknown, camera: unknown, frame: unknown, shot: { readonly on: string | readonly string[] }): ShotReport;
/** The report as one line of text a model reads, with a fix for each fault. `about` before a view means the camera stands near it. `label` leads the line in quotes. Throws on anything but a report. */
export function shotLine(report: ShotReport, options?: { readonly label?: string }): string;

// ── camera moves ─────────────────────────────────────────────────────────────────────────────────────────

import type { Quat } from './geometry.js';

/** What a camera move may do. */
export const CAMERA_MOVE_DOS: readonly ['fly', 'orbit'];
export const MOST_MOVE_SECONDS: number;
/** The most an orbit may turn, in degrees, either way. */
export const MOST_ORBIT: number;
/** The highest lift, in degrees. */
export const MOST_LIFT: number;
/** The numbers the rule table and the timing use, each ours: degrees, and degrees a second for `comfort`. */
export const CAMERA_MOVES: { readonly smallTurn: number; readonly cutPast: number; readonly rise: number; readonly highest: number; readonly comfort: number; readonly planShare: number; readonly leastSeconds: number };
export type CameraMoveKind = 'slerp' | 'arc' | 'cut';
export type CameraMoveRule = 'turn-past-cut' | 'small-turn' | 'large-turn';
/** The rule table, first match. */
export const CAMERA_MOVE_RULES: readonly { readonly rule: CameraMoveRule; readonly kind: CameraMoveKind; readonly when: string }[];
export const CAMERA_MOVE_KINDS: readonly CameraMoveKind[];
export const MOST_CAMERA_SAMPLES: number;

/** One end of a fly: a shot in words (framed on the scene) or a camera in numbers (it has a `target`). */
export type MoveEnd = Shot | Camera;
interface MoveCommon {
  /** Seconds; from the comfort limit when not given. */
  readonly seconds?: number;
  /** Degrees an arc rises over its middle (a small turn too, when given), 0 to MOST_LIFT. */
  readonly lift?: number;
  /** The two things the line of action runs between; the subjects when they are two. */
  readonly line?: readonly [string, string];
  /** Its words for where it was written, named in every finding. */
  readonly who?: string;
}
export interface FlyIntent extends MoveCommon { readonly do: 'fly'; readonly from: MoveEnd; readonly to: MoveEnd; /** Degrees past which the look's turn cuts; 180 never cuts. */ readonly cutPast?: number }
/** `by` in degrees, positive from front towards right; `from` is the view it starts from (front unless given). It never cuts. */
export interface OrbitIntent extends MoveCommon { readonly do: 'orbit'; readonly around: string | readonly string[]; readonly by: number; readonly from?: ViewName | Omit<Shot, 'on' | 'shot'> }
export type CameraMoveIntent = FlyIntent | OrbitIntent;

export interface CameraMove {
  readonly do: 'fly' | 'orbit';
  readonly kind: CameraMoveKind;
  readonly who: string;
  readonly seconds: number;
  readonly from: ReadCamera;
  readonly to: ReadCamera;
  /** The subjects the sight critic keeps in view. */
  readonly on: readonly string[];
  readonly line: readonly string[] | null;
  readonly reason: string;
  readonly choice: { readonly rule: CameraMoveRule; readonly kind: CameraMoveKind; readonly turn: number; readonly smallTurn: number; readonly cutPast: number | null };
  readonly basis: { readonly turn: number; readonly swing: number | null; readonly lift: number | null; readonly liftCapped: boolean; readonly seconds: number; readonly secondsGiven: boolean; readonly comfort: number; readonly peak: number };
  readonly plan: { readonly azimuth: number; readonly swing: number; readonly elevation: readonly [number, number]; readonly lift: number; readonly focusFollows: boolean } | null;
}
export interface CameraSample { readonly t: number; readonly progress: number; readonly camera: ReadCamera; readonly eye: Vector; readonly look: Quat; readonly cut?: true }
export interface CameraTrack { readonly who: string; readonly kind: CameraMoveKind; readonly seconds: number; readonly on: readonly string[]; readonly line: readonly string[] | null; readonly samples: readonly CameraSample[] }

/** A camera move planned from its intent. Throws, listing every problem at once. */
export function planCameraMove(intent: CameraMoveIntent, scene?: Scene): CameraMove;
/** Where the camera is t seconds in. */
export function sampleCameraMove(move: CameraMove, t: number): CameraSample;
/** The move sampled `rate` times a second (60), both ends included. */
export function cameraTrack(move: CameraMove, settings?: { readonly rate?: number }): CameraTrack;

export type CameraCriticName = 'in-sight' | 'turn-speed' | 'line-of-action' | 'horizon';
export const CAMERA_CRITICS: readonly CameraCriticName[];
/** The most of its subject a move may lose beyond what its shots show. */
export const SIGHT_DROP: number;
/** The most the horizon may lean, in degrees. */
export const HORIZON_MOST: number;
export interface CameraFinding { readonly critic: CameraCriticName; readonly level: 'warn' | 'note'; readonly message: string; readonly fix: string; readonly basis: Readonly<Record<string, string | number | boolean | null>> }
/** A path made by hand: samples in time, each a camera and, when it leans, its own look. */
export interface HandCameraPath { readonly samples: readonly { readonly t: number; readonly camera: Camera; readonly look?: Quat; readonly cut?: boolean }[]; readonly who?: string; readonly on?: string | readonly string[]; readonly line?: readonly [string, string] }
/** A move's path checked by the critics. Without a scene the sight and line critics measure null. Throws, listing every problem. */
export function checkCameraMove(move: CameraMove | HandCameraPath, settings?: { readonly scene?: Scene; readonly frame?: Frame; readonly on?: string | readonly string[]; readonly line?: readonly [string, string]; readonly rate?: number; readonly who?: string }): {
  readonly measures: Readonly<Record<CameraCriticName, number | null>>;
  readonly bases: Readonly<Record<CameraCriticName, Readonly<Record<string, string | number | boolean | null>> | null>>;
  readonly findings: readonly CameraFinding[];
};
