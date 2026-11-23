# body/ — where the ideas come from

| what | used in | source | what was taken |
|---|---|---|---|
| Two-bone IK | `twoBone.js` | the law of cosines; the planar two-link arm's closed-form solution as in J. J. Craig, *Introduction to Robotics: Mechanics and Control*, Pearson | the triangle of the two links and the reach; two mirror answers, one chosen by a side |
| A triangle's angles without lost digits | `twoBone.js` (`angleOpposite`, `angleOutside`) | W. Kahan, "Miscalculating Area and Angles of a Needle-like Triangle", University of California, Berkeley, 2014 (lecture notes) | the angle 2·atan(√(((a − b) + c)·μ / ((a + (b + c))·((a − c) + b)))) on sorted sides, brackets as written; the outside angle as its reciprocal form |
| Segment lengths and mass shares | `rig.js` (`humanRig`) | D. A. Winter, *Biomechanics and Motor Control of Human Movement*, 4th ed., Wiley, 2009 (tabulating W. T. Dempster 1955; lengths after R. Drillis, R. Contini 1966) | lengths as shares of height; the mass share of each segment |

**Ours:** the joint windows and widths of `humanRig`; the trunk split in two equal halves for the spine chain; the head
and neck's mass on the head; a part's mass at its middle (the same centre as half at each end, the ragdoll's split);
the degenerate rules' 0.5e-9 (half the 1e-9 guarantee); a free joint read nearest its angle in the pose handed in.
