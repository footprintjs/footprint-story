/**
 * The camera move's numbers and its rule table, in one place both the planner and the critics read.
 *
 * WHY its own file: the planner sets a move's seconds from the same limits the critics judge it by, so the two can never
 * disagree about what "too fast" means; and a number shown beside a limit is printed so it reads on the side it is on
 * (`shownAgainst`), so a sentence never says "45° is more than 45°".
 */
import { deepFreeze } from './fields.js';

/**
 * The numbers the rule table, the timing and the critics use. Each is ours: a starting choice to be judged by eye on real
 * films, not a measurement.
 */
export const CAMERA_MOVES = deepFreeze({
  /** A turn of at most this many degrees keeps its height. */
  smallTurn: 45,
  /** A fly whose look turns past this many degrees cuts (an intent's `cutPast` says otherwise; 180 never cuts). */
  cutPast: 150,
  /** How many degrees an arc rises over its middle (an intent's `lift` says otherwise). */
  rise: 10,
  /** The highest an arc's middle goes, in degrees: above this the view looks down on the subject's top. */
  highest: 75,
  /** The fastest the look may turn, in degrees a second; the `turn-speed` critic's limit. */
  comfort: 45,
  /** The fastest the target may slide across the picture, in frame heights a second; part of `travel-speed`. */
  slide: 1,
  /** The most the subject may grow or shrink in a second, as a factor (a zoom or a dolly); part of `travel-speed`. */
  zoom: 2,
  /** The share of each limit a planned move's fastest moment is held to, so a check sampled at any rate stays under it. */
  planShare: 0.9,
  /** The shortest move, in seconds: even a move that barely moves takes a beat. */
  leastSeconds: 0.5,
  /** The longest fly, in seconds: one its limits would stretch past this (a thing far off, a zoom from a speck) cuts. */
  longest: 12,
});

/** The rule table, first match: which kind of move, and the words for why. The tests are in `KIND_TESTS`, keyed by rule. */
export const CAMERA_MOVE_RULES = deepFreeze([
  { rule: 'turn-past-cut', kind: 'cut', when: 'a fly whose look turns past cutPast' },
  { rule: 'too-far', kind: 'cut', when: 'a fly, its seconds not given, that would take longer than longest at a comfortable pace' },
  { rule: 'small-turn', kind: 'slerp', when: 'a turn of at most smallTurn: the same height, one speed' },
  { rule: 'large-turn', kind: 'arc', when: 'any other turn: it rises over its middle' },
]);
/** Each rule's test, on the facts {do, turn, smallTurn, cutPast, comfortSeconds, secondsGiven}: `turn` is the number the reason shows. */
export const KIND_TESTS = Object.freeze({ 'turn-past-cut': (b) => b.do === 'fly' && b.turn > b.cutPast,
  'too-far': (b) => b.do === 'fly' && !b.secondsGiven && b.comfortSeconds > CAMERA_MOVES.longest, 'small-turn': (b) => b.turn <= b.smallTurn, 'large-turn': () => true });
/** The kinds a camera move can be. */
export const CAMERA_MOVE_KINDS = Object.freeze(['slerp', 'arc', 'cut']);

/** To a tenth: the precision a reason shows and a rule decides on. */
export const tenth = (v) => Number(v.toFixed(1));

/** A number beside its limit, with as many decimals (1 to 6) as it takes to read on the side of the limit it is on. */
export function shownAgainst(value, limit) {
  if (Math.abs(value) >= 1e6) return value.toPrecision(3);   // far past any limit: three digits say it
  for (let d = 1; d < 6; d++) {
    const shown = Number(value.toFixed(d));
    if (Math.sign(shown - limit) === Math.sign(value - limit)) return String(shown);
  }
  return String(Number(value.toFixed(6)));
}
