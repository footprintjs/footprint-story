/**
 * A cable's lead into a port: the stretch of its line from the port, up or down its riser and on through its floor
 * corner — what a tool draws again over the port's block, since the cable lies on the floor under every block and a
 * port on a seen side stands in front of its block's face. Plain numbers in, plain numbers out.
 *
 *   cableLead({points, radius}, end, count, back?)   → {way, pieces, length}
 *
 * `end`: 0 the cable's start, 1 its end. `count`: how many of the cable's points the lead holds from that end — the
 * port and the floor point (2), or the port, the point out of its side and the floor point when the port stands above
 * the floor (3): routes' path gives both. `back`: px the line stops short of the tip there, for its head (stopShort,
 * as cableWay stops the whole line). `way` is the cable's line rounded from that end; `pieces` the first of its pieces,
 * the lead's (each straight run and corner up to the end of the floor point's corner — the upper part of that corner
 * can be behind the block's face too — or up to the floor point where it is no corner); `length` theirs, in px. A
 * tool's share of the cable's line the lead holds is `length / cableWay(…).length` (the line as drawn).
 *
 * WHY here: a deck and a film draw the same lead over the same block, and hand a packet over to it at the same place.
 * StoryDeck 0.30.1 worked it out (deck/transforms.js · leadOf, deck/rides.js · piecesLength) but counted the lead's
 * pieces (2, or 4 with a riser), and a count runs on along the floor where a riser is too short for a run between its
 * corners or the floor point is no corner — its lead then took in a piece of the floor run past its corner (a few px
 * on a map's routes); here the floor point is found by its place. StoryReel 0.36.0 took the share as the straight
 * run of the lead's points, before the pull — short of the floor corner, and at a headed end counting the stretch
 * under the head. test/control/ holds StoryDeck's code; a property test holds this to it wherever its count ended at
 * the floor point, and to an oracle of its own everywhere.
 */
import { own, refuse, shown } from './thing.js';
import { roundedOwned, MOST_WAY } from './path.js';
import { stopShort } from './cable.js';
import { curveWay } from './straight.js';

const CHORDS = 12;   // the runs a corner of a lead is measured in: StoryDeck's piecesLength

export function cableLead(cable, end, count, back = 0) {
  if (!cable || typeof cable !== 'object' || Array.isArray(cable)) refuse(`cableLead takes a cable, {points, radius} — not ${shown(cable)}`);
  const points = own(cable, 'points'), radius = own(cable, 'radius');
  if (!Array.isArray(points) || points.length < 2 || points.length > MOST_WAY) refuse(`cableLead takes a cable whose points are a way of 2 to ${MOST_WAY} points, [[x, y], …] — not ${shown(points)}`);
  if (end !== 0 && end !== 1) refuse(`cableLead's end is 0 (the cable's start) or 1 (its end) — not ${shown(end)}`);
  if (!(Number.isInteger(count) && count >= 2 && count <= points.length)) refuse(`cableLead's count is how many of the cable's points its lead holds, a whole number from 2 to ${points.length} — not ${shown(count)}`);
  if (!(typeof back === 'number' && back >= 0)) refuse(`cableLead pulls the tip back a number of px, 0 or more — not ${shown(back)}`);
  // each point read once, by its own stored value (a getter is never run); the points with that end last, its tip
  // pulled back for its head (with no pull they go to rounded as they are, as StoryDeck's did), then turned round so
  // the lead is rounded from that end — its port first, its floor point the count-th
  const list = Array.from({ length: points.length }, (_, k) => own(points, k)), run = end ? list : list.reverse();
  const { way, kept, owners } = roundedOwned([...(back ? stopShort(run, back) : run)].reverse(), radius === undefined ? 0 : radius);
  // the lead is every piece up to and through the floor point's own (its corner, or its run where it is no corner):
  // found by the point's place, never by counting pieces — a riser too short for a run between its two corners has
  // none, and a floor point on a straight line is no corner — and never by its coordinates, which a path can pass
  // again. A port on its floor point (a repeat, kept once) has a lead of nothing.
  const floor = kept[count - 1], pieces = [];
  let length = 0, at = way.start;
  for (let k = 0; floor > 0 && k < way.pieces.length && owners[k] <= floor; k += 1) {
    const piece = way.pieces[k];
    pieces.push(piece);
    length += piece.corner ? curveWay(at, piece.corner, piece.to, CHORDS).length : Math.hypot(piece.to[0] - at[0], piece.to[1] - at[1]);
    at = piece.to;
  }
  return { way, pieces, length };
}
