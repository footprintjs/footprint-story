# geom/ — where the ideas come from

| what | used in | source | what was taken |
|---|---|---|---|
| Quaternions for turns, slerp | `quat.js`, `slerp.js` (`slerp`) | K. Shoemake, "Animating Rotation with Quaternion Curves", *SIGGRAPH '85 Proceedings*, Computer Graphics 19 (3), 1985 | turns as unit quaternions; slerp, sin((1−s)Ω)/sin Ω · a + sin(sΩ)/sin Ω · b, at constant angular speed; q and −q as one turn |
| Squad | `slerp.js` (`squad`) | K. Shoemake, "Quaternion Calculus and Fast Animation", *SIGGRAPH '87 Course Notes* 10, 1987 | the spherical quadrangle squad(qᵢ, qᵢ₊₁, sᵢ, sᵢ₊₁, h) and its inner controls from quaternion log and exp |
| A turn from its matrix | `quat.js` (`quatFromAxes`) | S. W. Shepperd, "Quaternion from Rotation Matrix", *Journal of Guidance and Control* 1 (3), 1978 | take the largest of the four sums first, so no division by a small number |
| The dihedral angle and its sign | `angles.js` (`dihedral`) | IUPAC, "Basic Terminology of Stereochemistry", *Pure and Applied Chemistry* 68 (12), 1996 (torsion angle) | the sign: positive when, seen along b→c, a–b turns clockwise to cover c–d |
| The dihedral by atan2 | `angles.js` (`dihedral`) | E. Blondel, M. Karplus, "New Formulation for Derivatives of Torsion Angles and Improper Torsion Angles in Molecular Mechanics", *Journal of Computational Chemistry* 17 (9), 1996 | the angle from atan2 of two products, with no singular arccos |
| Angles by atan2, not acos | `angles.js`, `quat.js`, `slerp.js` | W. Kahan, "How Futile are Mindless Assessments of Roundoff in Floating-Point Computation?", 2006 | the angle between vectors as 2·atan2(‖u − v‖, ‖u + v‖) (or atan2 of cross and dot), accurate near 0 and π where acos is not |
| Rodrigues' rotation formula | test/geom.property.test.js (the control) | O. Rodrigues, "Des lois géométriques qui régissent les déplacements d'un système solide…", *Journal de Mathématiques Pures et Appliquées* 5, 1840 | v cos θ + (k × v) sin θ + k (k·v)(1 − cos θ): an independent form a quaternion's turn is tested against |

**Ours:** the camera convention (looking along −z, azimuth from +z towards +x, as `src/shot/lens.js · aim` already had);
the side a look takes straight along its up (+x's, or +z's when it lies along x); a great circle between opposite ways
going over the top; null for an angle, a twist or a roll that is not defined, rather than a number that looks like one;
the 1e-6 below which slerp blends in a line (a guard against 0 / 0, not a tuning).
