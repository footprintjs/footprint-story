// footprint-story/layout — a flat frame as plain numbers. See layout.js and src/layout/README.md.

/**
 * The zoom at which a box of `size` ([wide, high]) fills `share` of `room` ([wide, high]): max(least, min(most, share ×
 * min(roomW ÷ boxW, roomH ÷ boxH))). `smallest`, when given, is the least a box side counts as (StoryDeck counts a
 * point 1 px wide). Defaults: share 1, least 0, most Infinity, no smallest. Any number is taken as IEEE arithmetic
 * answers it (a NaN in is a NaN out); anything else is refused, and the options are read by their own stored fields.
 */
export function frameZoom(size: readonly [number, number], room: readonly [number, number], options?: { share?: number; least?: number; most?: number; smallest?: number } | null): number;

/** The break rules, by name: `'fill'` each line as full as it goes, `'even'` as many lines as fill sets, as alike as they allow. */
export const BREAK_RULES: readonly ['fill', 'even'];
/** A break rule's name: one of BREAK_RULES. `wordsToFit` (footprint-story/isometric) takes the same names. */
export type BreakRule = 'fill' | 'even';

/**
 * `words` set into lines no wider than `width`. By `'fill'` (the usual): each line takes as many words as fit, a word
 * wider than the width has a line to itself, uncut. By `'even'`: as many lines as fill sets, set again at the narrowest
 * width that keeps that many, as alike as that many lines allow (one line is left as it is). `measure(text)` gives the
 * width of a whole line's text as drawn (a canvas's `measureText(text).width`). The lines are the words joined with
 * one space. `options.break` is read as its own stored field; left out (or undefined) is 'fill'; null or a name not in
 * BREAK_RULES is refused.
 */
export function wrapWords(words: readonly string[], width: number, measure: (text: string) => number, options?: { break?: BreakRule } | null): string[];

/** How many times `narrowestWidth` halves the width (12: to 1/4096 of it). */
export const NARROWEST_STEPS: number;
/**
 * The narrowest width that still sets the words on `lines` lines, found by halving between 0 and `width`
 * NARROWEST_STEPS times; `linesAt(w)` counts the lines at width w. The words set at it are balanced.
 */
export function narrowestWidth(width: number, lines: number, linesAt: (width: number) => number): number;
