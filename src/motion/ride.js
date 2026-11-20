// ride — how a packet rides a line: plain numbers in, plain numbers out, nothing drawn.
//
// A wire's running packets ride its line once a run, on one clock. These are the numbers of that ride, for any length
// of line:
//
//   rideProfile(ease, length)        how far along the line a packet is (a share of its length) at each moment of the
//                                    ride (a share of its time): stops [[time, progress], …] to draw straight lines
//                                    between — CSS's linear() easing, or a film's own interpolation
//   rideSeconds(length, speed, ease) the ride's time for a speed in px a second — the steady speed of its middle
//   speedAt(progress, ease)          the speed at a place along the line, as a share of that steady speed
//   withHold(stops, share)           a ride that takes `share` of the run, then rests at the end for the rest of it
//   showStops(share, {end})          how much of the packet shows over a run (0 to 1): in at the start, out before the
//                                    end — or kept at the end, where it rests
//   hiddenRamps(unseen, length, …)   where along the line it fades out before a stretch a block hides, and back after
//                                    it: [[outFrom, outTo, backFrom, backTo], …] as shares of the length
//
// WHY here and not in a tool: these are the numbers of a motion, not of a page. StoryDeck turns them into CSS, and a
// film can ride the same packets with the same numbers — the place is the same share of the same line at the same
// moment in both. They came from StoryDeck 0.27.0 (deck/ride.js) unchanged in what they give for what it gave them
// (a property test against a copy of that code, test/control/); what is new is that every number is checked.
// WHY "ease-ends" is measured along the LENGTH, not the time: whoever draws says where the packet eases (out of the
// port, into the switch), and a place on the line stays the place whatever the ride's time.
//
// The ease: the packet starts from rest and gathers speed evenly over the first `a` of the line, keeps one steady
// speed, and slows evenly to rest over the last `b` (a, b from 0 to 0.5). Evenly gathered speed covers a stretch in
// twice the time the steady speed would, so the ride takes (1 + a + b) times as long as the line at its steady speed.
// (A constant pull from rest and to rest: the trapezoid of speed that machines are moved by — REFERENCES.md.)

/** Px a stop may stand off the true ease, at most: under half a pixel, so no one sees the corners of the stops. */
const TOLERANCE = 0.4;   // 0.1 px left for a page to round the stops it writes: under half a px in all
const MOST_STOPS = 40;   // stops for one eased end, at most: within TOLERANCE for half of any line up to 4096 px (a slide is 1920)
const SHOW = { in: 0.12, out: 0.15 };   // the share of a ride a packet takes to fade in at its start and out before its end
/** The most of a line one eased end may take: half — the two ends together are the whole line. */
export const MOST_EASE = 0.5;
/** The furthest a length, a speed or a place may be from 0 (px, px a second): far past any picture, short of overflow. */
const FAR = 1e9;

// Every value may come from anyone: each is read by its own stored value (a getter is somebody's code and is never run;
// a list with a hole in it is refused), and a refusal says what to give.
const own = (o, key) => { const d = Object.getOwnPropertyDescriptor(o, key); return d && 'value' in d ? d.value : undefined; };
const shown = (v) => (Array.isArray(v) ? `a list of ${v.length}` : v !== null && typeof v === 'object' ? 'an object' : typeof v === 'string' ? JSON.stringify(v.length > 40 ? `${v.slice(0, 40)}…` : v) : String(v));
const refuse = (fix) => { throw new Error(`ride: ${fix}`); };
const isNumber = (n, lo, hi) => typeof n === 'number' && Number.isFinite(n) && n >= lo && n <= hi;
const number = (n, lo, hi, what) => (isNumber(n, lo, hi) ? n : refuse(`${what} — not ${shown(n)}`));
/** Each index of a list by its own stored value, through `read` (which refuses what it cannot take); a new list. */
function list(v, what, read) {
  if (!Array.isArray(v)) refuse(`${what} — not ${shown(v)}`);
  return Array.from({ length: v.length }, (_, i) => { if (!Object.hasOwn(v, i)) refuse(`${what} — not a list with a hole at ${i}`); return read(own(v, i), i); });
}
const pair = (v, what, lo, hi) => { const out = Array.isArray(v) && v.length === 2 ? list(v, what, (n) => n) : null; return out && out.every((n) => isNumber(n, lo, hi)) ? out : refuse(`${what} — not ${Array.isArray(v) ? `[${Array.from({ length: Math.min(v.length, 4) }, (_, i) => shown(own(v, i))).join(', ')}${v.length > 4 ? ', …' : ''}]` : shown(v)}`); };
const easeOf = (ease) => pair(ease, `an ease is [a, b]: the shares of the line eased at its start and its end, each 0 to ${MOST_EASE}`, 0, MOST_EASE);
const lengthOf = (length) => number(length, 0, FAR, `a line's length is its px, 0 to ${FAR}`);
/** An options object's own stored field, or the usual value. */
const option = (options, key, usual) => (options === undefined || options === null ? usual : typeof options === 'object' && !Array.isArray(options) ? own(options, key) ?? usual : refuse(`options are an object — not ${shown(options)}`));

/** The ride's time, in seconds: a line `length` px long at `speed` px a second, its steady speed, with its ends eased [a, b]. */
export function rideSeconds(length, speed, ease = [0, 0]) {
  const px = lengthOf(length), perSecond = number(speed, Number.MIN_VALUE, FAR, `a speed is px a second, above 0 and at most ${FAR}`), [a, b] = easeOf(ease);
  return (px * (1 + a + b)) / perSecond;
}

/** The speed at `progress` (a share of the line, 0 to 1), as a share of the steady speed: gathered evenly from rest over the first `a`, shed evenly over the last `b`. */
export function speedAt(progress, ease = [0, 0]) {
  const at = number(progress, -FAR, FAR, 'progress is a share of the line, a number (0 to 1 lies on it)'), [a, b] = easeOf(ease);
  if (a > 0 && at < a) return Math.sqrt(Math.max(0, at) / a);
  if (b > 0 && at > 1 - b) return Math.sqrt(Math.max(0, 1 - at) / b);
  return 1;
}

/**
 * Where the packet is over its ride: [[time, progress], …] from [0, 0] to [1, 1], each a share (of the ride's time, of
 * the line's length), straight between stops. [a, b]: the eased shares of the line at its start and its end; with
 * neither, the two stops of a steady ride. `length`: the line's length in px — an eased end gets as many stops as
 * keep it within TOLERANCE px of the true curve there (a straight stretch is never off it), and at least two.
 */
export function rideProfile(ease = [0, 0], length = 0) {
  const [a, b] = easeOf(ease), px = lengthOf(length);
  if (!(a > 0) && !(b > 0)) return [[0, 0], [1, 1]];
  const whole = 1 + a + b, ta = (2 * a) / whole, tb = (2 * b) / whole;   // the time each eased end takes, as a share of the ride
  // a parabola cut into n straight pieces strays at most (its stretch) / (4·n²) off it
  const pieces = (share) => Math.min(MOST_STOPS, Math.max(2, Math.ceil(Math.sqrt((share * px) / (4 * TOLERANCE)))));
  const stops = [[0, 0]];
  if (a > 0) { const n = pieces(a); for (let i = 1; i <= n; i++) stops.push([(ta * i) / n, a * (i / n) ** 2]); }
  if (b > 0) {
    const n = pieces(b);
    if (stops.at(-1)[0] < 1 - tb) stops.push([1 - tb, 1 - b]);   // the steady stretch: one straight line
    for (let i = n - 1; i >= 0; i--) stops.push([1 - (tb * i) / n, 1 - b * (i / n) ** 2]);
  } else stops.push([1, 1]);
  return stops;
}

/** A ride's stops (rideProfile) when the ride takes only `share` of the run (above 0; 1 or more: all of it): the packet then rests at the end. */
export function withHold(stops, share) {
  const read = list(stops, 'stops are [[time, progress], …]', (stop, i) => pair(stop, `stop ${i + 1} is [time, progress], two numbers`, -FAR, FAR));
  const part = number(share, Number.MIN_VALUE, FAR, 'share is the share of the run the ride takes, above 0 (1: all of it)');
  return part >= 1 ? read : [...read.map(([t, p]) => [t * part, p]), [1, 1]];
}

/**
 * How much of the packet shows over a run: [[time, shown], …], `shown` 0 to 1, straight between. `share`: the share of
 * the run the ride takes (the rest it rests at the end); `end`: it stays at the end when it arrives. Without either: in
 * over the first 12% of the ride, out over its last 15%.
 */
export function showStops(share = 1, options = undefined) {
  const part = number(share, Number.MIN_VALUE, FAR, 'share is the share of the run the ride takes, above 0 (1: all of it)');
  const end = option(options, 'end', false);
  if (typeof end !== 'boolean') refuse(`end says whether the packet stays at the end, true or false — not ${shown(end)}`);
  const seen = [[0, 0], [SHOW.in * part, 1]];
  return end ? [...seen, [1, 1]] : [...seen, [1 - SHOW.out, 1], [1, 0]];
}

/**
 * Where a packet fades out before each stretch a block hides and comes back after it: [[outFrom, outTo, backFrom,
 * backTo], …], shares of the line. `unseen`: the stretches, [[from, to], …] in px along the line (an isometric route's
 * `unseen`, in px); `length`: the line's px; `speed`: its steady px a second; `ease`: [a, b] (speedAt). Each fade takes
 * `frames` frames at `fps` — about three, the least a fade is seen as one and not as a jump — at the speed the packet
 * has at that edge, and never less than `least` px. It is gone by the time its front reaches the block — `radius` px
 * (the packet's own) before the stretch — and comes back from as far past it, so it never shows cut by the block, and
 * comes out on the same line it went in on. A stretch at the line's start has no fade out, one at its end no fade
 * back; a stretch with no length is no stretch; a line with no length has none.
 */
export function hiddenRamps(unseen, length, speed, ease = [0, 0], options = undefined) {
  const stretches = list(unseen, 'unseen is the stretches a block hides, [[from, to], …] in px along the line', (s, i) => pair(s, `stretch ${i + 1} is [from, to], in px along the line`, -FAR, FAR));
  const px = lengthOf(length), steady = number(speed, 0, FAR, `a speed is px a second, 0 to ${FAR}`), [a, b] = easeOf(ease);
  const frames = number(option(options, 'frames', 3), Number.MIN_VALUE, FAR, 'frames is how many frames a fade takes, above 0');
  const fps = number(option(options, 'fps', 60), Number.MIN_VALUE, FAR, 'fps is frames a second, above 0');
  const least = number(option(options, 'least', 2), 0, FAR, 'least is the fewest px a fade takes, 0 or more');
  const radius = number(option(options, 'radius', 0), 0, FAR, "radius is the packet's own, in px, 0 or more");
  if (!(px > 0)) return [];
  const fade = (at) => Math.max(least, (steady * speedAt(at / px, [a, b]) * frames) / fps), share = (v) => Math.min(px, Math.max(0, v)) / px;
  return stretches
    .map(([lo, hi]) => [Math.max(0, lo), Math.min(px, hi)])
    .filter(([lo, hi]) => hi > lo)
    .map(([lo, hi]) => (lo > 0 ? [share(lo - radius - fade(lo)), share(lo - radius)] : [0, 0]).concat(hi < px ? [share(hi + radius), share(hi + radius + fade(hi))] : [1, 1]));
}
