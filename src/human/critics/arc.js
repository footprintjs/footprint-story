/**
 * The `arc` critic: how far a move bows from the straight line between its ends, as a share of that line's length.
 * A hand or a head travels on an arc (the animators' "arcs", Thomas & Johnston 1981); a dead-straight slide between two
 * places reads as a thing pulled on a wire. Below the limit it is straight.
 */

/** The least bow, as a share of the move's length, that reads as an arc: 2%. Ours. */
export const ARC_LEAST = 0.02;

export const arc = Object.freeze({
  name: 'arc',
  limit: ARC_LEAST,
  measure(track) {
    const s = track.samples, a = s[0], b = s[s.length - 1], len = Math.hypot(b.x - a.x, b.y - a.y);
    if (!(len >= 1)) return null;   // a move of less than a pixel has no line to bow from
    let most = 0;
    for (const p of s) most = Math.max(most, Math.abs((b.x - a.x) * (a.y - p.y) - (a.x - p.x) * (b.y - a.y)) / len);
    return most / len;
  },
  finding(bow, who) {
    if (!(bow < ARC_LEAST)) return null;
    return { level: 'warn', message: `${who}: its move runs straight (it bows ${(bow * 100).toFixed(1)}% of its length) — a hand or a head moves on an arc, and a straight slide reads as pulled on a wire`,
      fix: "bow it: model: {name: 'min-jerk', bend: 0.06}" };
  },
});
