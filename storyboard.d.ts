/**
 * footprint-story/storyboard — a story written as plain data on a named shape, for a film and a deck to draw the same way.
 * Pure: runs anywhere, imports nothing. Nothing here draws.
 */

/** The shapes a storyboard may take. */
export type StoryShapeName = 'told-twice' | 'what-we-found';
/** A shape, for whoever is about to write one: what it is for, and a worked outline of its fields. */
export interface StoryShape { readonly name: StoryShapeName; readonly about: string; readonly fills: object }
/** One thing to fix: `at` is the place in the data, as it is written. */
export interface StoryboardProblem { readonly at: string; readonly message: string }
/** A message a claim can cite. An app maps its history onto this. */
export interface StoryMessage { readonly id: string; readonly who?: string; readonly text: string }
export interface StoryboardOptions {
  /** The messages the storyboard's claims rest on: every message cited must be here, and every number in a claim in one it cites. */
  readonly conversation?: readonly StoryMessage[];
}
/** What a scene does. */
export type StoryBeat =
  | { readonly kind: 'title'; readonly subtitle: string | null }
  /** Along the row of items, in order; on a told-twice story's real telling, what is called on each hop. */
  | { readonly kind: 'path'; readonly path: readonly string[]; readonly calls: readonly string[] }
  /** An item turns into the real thing where it stood, and the callout says both names. */
  | { readonly kind: 'turn'; readonly item: string; readonly callout: string }
  | { readonly kind: 'together' }
  | { readonly kind: 'points'; readonly points: readonly string[] }
  /** One card comes in beside the others of its group. */
  | { readonly kind: 'card'; readonly group: string; readonly tone: 'ok' | 'warn' | null; readonly name: string; readonly line: string | null; readonly sources: readonly string[] };
/** One moment. `title` and `narration` make it a scene of a film's storyboard as they are. */
export interface StoryScene { readonly id: string; readonly part: string; readonly look: 'cast' | 'real' | null; readonly title: string; readonly narration: string; readonly beat: StoryBeat }
/** Someone or something in a told-twice row. */
export interface StoryWho { readonly name: string; readonly line: string; readonly icon: string | null }
/** A storyboard read: checked and frozen. */
export interface Storyboard {
  readonly shape: StoryShapeName;
  readonly title: string;
  readonly subtitle: string | null;
  readonly lang: string | null;
  /** Whether its claims really were checked against a conversation: never for told-twice, which makes none. */
  readonly verified: boolean;
  /** Each part's label, by part. */
  readonly labels: Readonly<Record<string, string>>;
  readonly scenes: readonly StoryScene[];
  /** told-twice: the row, in order. */
  readonly items?: readonly { readonly id: string; readonly cast: StoryWho; readonly real: StoryWho }[];
  /** told-twice: says what stands in for what. */
  readonly analogy?: string;
}

/**
 * What a model needs to write a storyboard. Keep the two apart when you send them: `instructions` from you, and `material`
 * as data, because it holds a conversation's own words. The library holds no model.
 */
export interface StoryboardBrief {
  readonly instructions: string;
  /** The conversation as one JSON message per line; null when none was given. */
  readonly material: string | null;
}
/** A brief for this shape. Throws on a shape it does not have, or a conversation it cannot use. */
export function storyboardBrief(shape: StoryShapeName, options?: StoryboardOptions): StoryboardBrief;
/** The shapes there are. */
export function storyShapes(): readonly StoryShape[];
/** Every problem in a storyboard (data or JSON text); empty when it can be drawn. Never throws on what it is given to read. */
export function storyboardProblems(input: unknown, options?: StoryboardOptions): readonly StoryboardProblem[];
/** A storyboard read. Throws when it cannot be drawn, its `problems` listing all of them. */
export function readStoryboard(input: unknown, options?: StoryboardOptions): Storyboard;
/** Every number in a text, with any thousands commas taken out: '1,250.5' → '1250.5'. */
export function numbersIn(text: string): readonly string[];
