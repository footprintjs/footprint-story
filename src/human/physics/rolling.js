/**
 * Rolling without slipping: a round thing turns by exactly the distance it travels over its radius, and its spin is
 * held to its speed (ω = v / r) by the floor's grip. What it is made of decides how much of a push goes into turning.
 *
 *   rollTurn(distance, radius)                       → the turn (radians): distance / radius
 *   rollingPush({ along, normal, resistance, inertia }) → { along, resist, hold } per unit mass, for physics/glide.js
 *   landRoll(speed, spin, radius, inertia)           → the speed it rolls on with after it lands spinning
 *
 * `inertia` is k = I / (m r²): how much of its mass sits far from its middle (ROLL_SHAPES). Down a slope the push is
 * g sin θ / (1 + k) — a solid ball 5/7 of what a sliding block gets, a hoop half. Rolling resistance is the floor's
 * push against the motion, C_rr × the normal force, taken as a torque about the contact (the normal force sitting a
 * little ahead of it), so it too is shared with the turning: (C_rr g cos θ) / (1 + k). At rest it stays put while the
 * slope's push is within its resistance. Sources: the rolling-down-a-ramp law, Halliday, Resnick & Walker,
 * *Fundamentals of Physics*, ch. 11; rolling resistance as a lever on the normal force, Hibbeler, *Engineering
 * Mechanics: Statics*, "rolling resistance".
 */

/** k = I / (m r²) for each round shape (Halliday, Resnick & Walker, ch. 10, the table of rotational inertias). */
export const ROLL_SHAPES = Object.freeze({ ball: 2 / 5, disc: 1 / 2, ring: 1 });
/** Rolling resistance C_rr when none is named: 0.05. Ours, larger than life (a car tyre on concrete is about 0.01 to
 *  0.015, Gillespie, *Fundamentals of Vehicle Dynamics*, 1992), so a ball rolled across a frame stops within it. */
export const ROLLING_RESISTANCE = 0.05;
/** The steepest floor a roll takes (degrees). Ours: past it a ball needs more grip than most floors give to keep from
 *  skidding (no slip needs static friction μ ≥ k tan θ / (1 + k): 0.29 for a ball at 45°). */
export const MOST_SLOPE = 45;

export const rollTurn = (distance, radius) => distance / radius;

/** The push along the line and the slowing a rolling thing feels: gravity's share and the resistance, shared with its turn. */
export function rollingPush({ along, normal, resistance, inertia }) {
  const resist = (resistance * normal) / (1 + inertia);
  return { along: along / (1 + inertia), resist, hold: resist };
}

/**
 * The speed a round thing rolls on with after it lands moving across at `speed` and spinning at `spin` (rad/s, + turns
 * it the way a roll to the right turns, y down). The floor's grip acts at the contact, so the turning about the contact
 * point is kept through the landing: m v r + I ω = (m r² + I) ω′, so v′ = (v + k r ω) / (1 + k). A ball landing with
 * no spin rolls on at 5/7 of its speed; one already turning at v / r keeps its speed; enough backspin sends it back.
 * The skid that takes it there is not drawn: it is over at the landing (ours).
 */
export const landRoll = (speed, spin, radius, inertia) => (speed + inertia * radius * spin) / (1 + inertia);
