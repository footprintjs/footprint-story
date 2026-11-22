/**
 * Sliding friction (Coulomb's law): a thing sliding on a floor is slowed by the kinetic coefficient times the normal
 * force, whatever its speed, and once stopped it stays while the push on it is within the static coefficient's.
 *
 *   slidingPush({ along, normal, kinetic, still })   → { along, resist, hold } per unit mass, for physics/glide.js
 *   slideDistance(speed, kinetic, gravity)          → how far it slides on a level floor before it stops: v² / (2 μ g)
 *
 * Source: the friction laws and their coefficients as Serway & Jewett, *Physics for Scientists and Engineers*, give
 * them (ch. 5, the table of coefficients of friction).
 */

/** The coefficients when none are named: wood on wood, kinetic 0.2 and static 0.25 (the low end of 0.25 to 0.5), as
 *  Serway & Jewett's table lists them. */
export const KINETIC_FRICTION = 0.2;
export const STATIC_FRICTION = 0.25;

export function slidingPush({ along, normal, kinetic, still }) {
  return { along, resist: kinetic * normal, hold: still * normal };
}

export const slideDistance = (speed, kinetic, gravity) => (speed * speed) / (2 * kinetic * gravity);
