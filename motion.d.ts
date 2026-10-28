/**
 * footprint-story/motion — how things move, in a film and on a slide: named eases and springs, named moves, named
 * changes of picture as data, and pace. Pure: runs anywhere, imports nothing. Nothing here draws.
 */

// ── ease: the ease table by name, and any CSS cubic-bezier ────────────────────────────────────────────────

/** A curve: u (how far through its seconds, clamped to 0..1) → how far the value has gone, exactly 0 at the start and 1 at the end. */
export type Ease = (u: number) => number;
/** The names in the ease table. */
export type EaseName = 'linear' | 'in' | 'out' | 'inOut' | 'back' | 'walk' | 'jump' | 'spring' | 'bounce' | 'outCubic' | 'outQuint' | 'outExpo' | 'outBack' | 'inOutCubic' | 'standard' | 'emphasized';

/** The ease table, by name. */
export const EASES: Readonly<Record<EaseName, Ease>>;
/** The table's names, in its order. */
export const EASE_NAMES: readonly EaseName[];
/** Slow, fast, slow (smoothstep): the curve StoryReel's films used before the table. */
export function inOut(u: number): number;
/** CSS's cubic-bezier(x1, y1, x2, y2) as a curve; x1 and x2 within 0..1, y1 and y2 any (outside 0..1 it overshoots). */
export function bezier(x1: number, y1: number, x2: number, y2: number): Ease;
/** The curve called `name` — a name from the table, or "cubic-bezier(a, b, c, d)" — or a refusal naming the eases; `where` says who asked. */
export function easeNamed(name: string, where?: string): Ease;
/** Whether the ease goes past its start or its end on the way (back, outBack, spring, and a cubic-bezier whose y leaves 0..1). */
export function overshoots(name: string): boolean;

// ── spring: closed-form springs by feel ───────────────────────────────────────────────────────────────────

/** A stiffness and a damping. */
export interface Feel { readonly k: number; readonly d: number }
export type FeelName = 'snappy' | 'default' | 'heavy' | 'playful';

/** The named feels: snappy (buttons), default (cards), heavy (big type, cameras), playful (pops). */
export const FEELS: Readonly<Record<FeelName, Feel>>;
export const FEEL_NAMES: readonly FeelName[];
/** A feel as given (a name or { k, d }) → { k, d }; anything else refuses, naming the feels. */
export function readFeel(feel?: FeelName | Feel): Feel;
/** A damped spring from 0 to 1, `t` seconds after it starts (0 before). */
export function spring(t: number, feel?: FeelName | Feel): number;
/** How long a feel takes to come within `within` (0.005) of its end and stay there, in seconds. */
export function settleTime(feel?: FeelName | Feel, options?: { within?: number }): number;
/** A pop: 0 → 1 from `at`, with the feel's overshoot (playful by default). */
export function pop(t: number, at: number, feel?: FeelName | Feel): number;
/** A value with several targets, [[time, value], …] in time order: one spring per change, so it never jumps. */
export function track(t: number, keys: readonly (readonly [number, number])[], feel?: FeelName | Feel): number;

// ── moves: named motions ──────────────────────────────────────────────────────────────────────────────────

export type MoveKind = 'entrance' | 'exit' | 'feedback' | 'ambient';
export type MoveUse = 'ui' | 'text' | 'logo' | 'character' | '3d';
export type MoveFeelName = 'smooth' | 'crisp' | 'soft' | 'heavy' | 'bouncy';
export type Mask = 'left' | 'right' | 'top' | 'bottom' | 'iris';
export type MoveProp = 'opacity' | 'x' | 'y' | 'scale' | 'rotate' | 'blur' | 'clip' | 'progress';
/** One property's animation: [from, to] on the move's curve; on an ease of its own over a span; or a swing or a swell about its rest. */
export type PropSpec =
  | readonly [number, number]
  | { readonly from: number; readonly to: number; readonly ease?: string; readonly span?: readonly [number, number] }
  | { readonly rest: number; readonly wave: number; readonly cycles: number; readonly span?: readonly [number, number] }
  | { readonly rest: number; readonly swell: number; readonly cycles: number; readonly span?: readonly [number, number] };

/** A move: data, never code. */
export interface Move {
  readonly name: string;
  readonly kind: MoveKind;
  readonly feel: MoveFeelName;
  readonly uses: readonly MoveUse[];
  readonly seconds: number;
  readonly ease?: string;
  readonly spring?: FeelName | Feel;
  readonly props: Readonly<Partial<Record<MoveProp, PropSpec>>>;
  readonly mask?: Mask;
  readonly split?: 'word' | 'letter';
  readonly gap?: number;
  readonly loop?: true;
  readonly pairs?: string;
}
/** Every property of a move at one moment; `mask` names the shape `clip` uncovers (null for none). */
export interface MoveValues { opacity: number; x: number; y: number; scale: number; rotate: number; blur: number; clip: number; progress: number; mask: Mask | null }

/** The table, by name: entrances, then exits, feedback and ambient moves. */
export const MOVES: Readonly<Record<string, Move>>;
export const MOVE_NAMES: readonly string[];
export const MOVE_KINDS: readonly MoveKind[];
export const MOVE_USES: readonly MoveUse[];
/** The feelings, and the curve each drives a move with: { ease } or { spring }. */
export const MOVE_FEELS: Readonly<Record<MoveFeelName, { readonly ease?: string; readonly spring?: FeelName }>>;
export const MOVE_FEEL_NAMES: readonly MoveFeelName[];
export const MASKS: readonly Mask[];
/** Each property at rest. */
export const REST: Readonly<Record<MoveProp, number>>;
/** Seconds between words in a reveal (0.09) and between letters (0.03); an exit's share of its entrance's seconds (0.5). */
export const WORD_GAP: number;
export const LETTER_GAP: number;
export const EXIT_SHARE: number;
/** A move by name, or one of your own, checked against the vocabulary and its kind's law; returned frozen. */
export function readMove(move: string | Move, where?: string): Move;
/** A move's values at t; `start` when it begins, `seconds` to stretch it, `feel` another curve, `reduced` to jump. */
export function moveAt(move: string | Move, t: number, options?: { start?: number; seconds?: number; feel?: MoveFeelName | FeelName | Feel; reduced?: boolean }): MoveValues;
/** Each item's delay: index × gap, the gap in seconds or a text reveal's own. */
export function stagger<T>(items: readonly T[], gap: number | string | Move): { item: T; index: number; delay: number }[];
/** The moves matching every filter given, in the table's order. */
export function movesBy(filter?: { feel?: MoveFeelName; use?: MoveUse; kind?: MoveKind }): Move[];

// ── transitions: the editor's changes of picture, as data ─────────────────────────────────────────────────

/** A setting a transition takes: exactly one kind, with its default. A point's default may be 'centre': the frame's middle. */
export type SettingSpec =
  | { readonly oneOf: readonly string[]; readonly default: string }
  | { readonly point: true; readonly default: readonly [number, number] | 'centre' }
  | { readonly color: true; readonly default: string | null }
  | { readonly number: readonly [number, number]; readonly default: number }
  | { readonly box: true; readonly default: readonly [number, number, number, number] }
  | { readonly name: true; readonly default?: null };
/** A transition: what it is, never how it is drawn (a drawer adds its own keys, such as StoryReel's draw). */
export interface Transition {
  readonly family: string;
  readonly seconds: number;
  readonly ease: string;
  readonly sound: string | null;
  readonly hitAt?: number;
  readonly overshoot?: boolean;
  readonly params: Readonly<Record<string, SettingSpec>>;
  readonly regions?: (p: Readonly<Record<string, unknown>>) => { from?: string[]; to?: string[] };
  readonly [drawerKey: string]: unknown;
}
/** A change of picture as read: its settings checked, the defaults filled in. */
export interface ReadTransition {
  readonly type: string;
  readonly family: string;
  readonly seconds: number;
  readonly ease: string;
  readonly sound: unknown;
  readonly p: Readonly<Record<string, unknown>>;
}

/** The shared collection: cut, fade, dip, wipe, split, clock, iris, push, slide, whip, zoom, page, through, match. */
export const TRANSITIONS: Readonly<Record<string, Transition>>;
export const TRANSITION_NAMES: readonly string[];
/** The families, in the collection's order. */
export const FAMILIES: readonly string[];
export const DIRECTIONS: readonly ('left' | 'right' | 'top' | 'bottom')[];
/** The keys every transition takes besides its own settings: type, seconds, ease, sound. */
export const COMMON: readonly string[];
/** How long a change of picture may take: [0.2, 4] seconds. */
export const SECONDS: readonly [number, number];
/** The names no setting may take. */
export const RESERVED: readonly string[];
/** A drawer's transition, checked; `extra` names the keys its drawer adds (StoryReel: ['draw']). */
export function checkTransition<T extends object>(def: T, who: string, options?: { extra?: readonly string[] }): Readonly<T & { params: Readonly<Record<string, SettingSpec>> }>;
/** A collection with a drawer's own added, each checked; a shared name may not be taken. */
export function extendTransitions(base: Readonly<Record<string, Transition>>, yours: Readonly<Record<string, object>>, options?: { who?: string; extra?: readonly string[] }): Readonly<Record<string, Transition>>;
/** A change of picture as asked for — a name, or { type, seconds?, ease?, sound?, …settings } — checked and read. */
export function readTransition(enter: string | { readonly type: string; readonly [setting: string]: unknown }, where: string, options?: { catalog?: Readonly<Record<string, Transition>>; frame?: readonly [number, number]; more?: string }): ReadTransition;

/** The settings `params` describes, read from `given`, each checked, the defaults filled in; frozen. */
export function readSettings(params: Readonly<Record<string, SettingSpec>>, given: Readonly<Record<string, unknown>>, where: string, options?: { key?: string; type?: string; frame?: readonly [number, number] }): Readonly<Record<string, unknown>>;
/** A hex colour: #rgb, #rrggbb or #rrggbbaa. */
export const isColor: (v: unknown) => boolean;
/** A box on the frame: [x0, y0, x1, y1], x0 < x1 and y0 < y1. */
export const isBox: (v: unknown) => boolean;
/** The setting kinds written as a flag: point, color, box, name. */
export const SETTING_FLAGS: readonly string[];

// ── pace: how long a picture may sit still ────────────────────────────────────────────────────────────────

/** hold: the seconds a still stretch may last; most: the dead share that fails a film; still: the still share that fails it; spare: end shots not counted. */
export interface Pace { readonly hold: number; readonly most: number; readonly still: number; readonly spare: number }
export type PaceName = 'lesson' | 'promo';

/** The paces: lesson (a child's film may pause) and promo (nothing still past 0.6 s). */
export const PACES: Readonly<Record<PaceName, Pace>>;
export const PACE_NAMES: readonly PaceName[];
/** A pace by name, or one of your own ({ hold, most, still, spare? }), checked and frozen. */
export function readPace(pace?: PaceName | { hold: number; most: number; still: number; spare?: number }, where?: string): Pace;
