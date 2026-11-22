# human/ — where the ideas come from

| what | used in | source | what was taken |
|---|---|---|---|
| Minimum jerk | `laws/minJerk.js`, `models/minJerk.js` | T. Flash, N. Hogan, "The Coordination of Arm Movements: An Experimentally Confirmed Mathematical Model", *Journal of Neuroscience* 5 (7), 1985 | the fifth-order path 10u³ − 15u⁴ + 6u⁵ from rest to rest, and that a reach's speed is one bell, highest half way |
| Fitts's law | `laws/fitts.js` | P. M. Fitts, "The Information Capacity of the Human Motor System in Controlling the Amplitude of Movement", *Journal of Experimental Psychology* 47 (6), 1954 | that a move's time grows with the log of its distance over its target's width |
| Fitts's law, the Shannon form | `laws/fitts.js` | I. S. MacKenzie, "Fitts' Law as a Research and Design Tool in Human-Computer Interaction", *Human-Computer Interaction* 7 (1), 1992 | the index of difficulty log2(D / W + 1), which is never below 0 |
| Fitts's constants for pointing | `laws/fitts.js` (`FITTS.b`) | R. W. Soukoreff, I. S. MacKenzie, "Towards a Standard for Pointing Device Evaluation, Perspectives on 27 Years of Fitts' Law Research in HCI", *International Journal of Human-Computer Studies* 61 (6), 2004 | the 3.7 to 4.9 bits a second reported for a mouse, near which b = 0.2 s a bit is chosen (ours: they warn that 1/b is not throughput) |
| The two-thirds power law | `laws/powerLaw.js`, `models/powerLawPen.js`, `critics/penSpeed.js` | F. Lacquaniti, C. Terzuolo, P. Viviani, "The Law Relating the Kinematic and Figural Aspects of Drawing Movements", *Acta Psychologica* 54, 1983 | angular speed ∝ curvature^(2/3), said here as speed ∝ curvature^(−1/3), and the regression on logs that measures it |
| Lognormal strokes | `laws/sigmaLognormal.js` | R. Plamondon, "A Kinematic Theory of Rapid Human Movements. Part I: Movement Representation and Generation", *Biological Cybernetics* 72 (4), 1995 | a rapid stroke's speed as a lognormal curve of the time since it began |
| The sigma-lognormal form | `laws/sigmaLognormal.js`, `models/sigmaLetter.js` | R. Plamondon, M. Djioua, "A Multi-Level Representation Paradigm for Handwriting Stroke Generation", *Human Movement Science* 25 (4–5), 2006 | strokes along circular arcs whose direction turns with the stroke's spread (the erf), overlapping and added as vectors |
| erf | `laws/sigmaLognormal.js` (`erf`) | M. Abramowitz, I. A. Stegun, *Handbook of Mathematical Functions*, National Bureau of Standards, 1964, formula 7.1.26 | the five-term rational approximation, within 1.5e-7 |
| Catmull-Rom splines | `paths/catmullRom.js` | E. Catmull, R. Rom, "A Class of Local Interpolating Splines", in *Computer Aided Geometric Design* (R. Barnhill, R. Riesenfeld, eds.), Academic Press, 1974 | a smooth curve through every point, each stretch set by its two neighbours |
| The pyramid form | `paths/catmullRom.js` (`pyramid`) | P. J. Barry, R. N. Goldman, "A Recursive Evaluation Algorithm for a Class of Catmull-Rom Splines", *Computer Graphics* 22 (4) (SIGGRAPH), 1988 | three rounds of mixing points by their knot spacing, which takes any knots |
| Centripetal knots | `paths/catmullRom.js` (alpha 0.5) | C. Yuksel, S. Schaefer, J. Keyser, "Parameterization and Applications of Catmull–Rom Curves", *Computer-Aided Design* 43 (7), 2011 | knots spaced by the square root of the distance: no cusp and no loop within a stretch; the test case of a short stretch between long ones |
| Curvature from three points | `paths/curvature.js` | K. Menger, "Untersuchungen über allgemeine Metrik", *Mathematische Annalen* 103, 1930 | 1 over the radius of the circle through three points: 4 · area / the product of the sides |
| Value noise | `laws/tremor.js` | the lattice noise that K. Perlin's gradient noise refined ("An Image Synthesizer", SIGGRAPH 1985) | a seeded number at each step of a lattice, eased between (smoothstep) |
| Seeded numbers | `seed.js` | G. Fowler, L. C. Noll, K.-P. Vo, the FNV-1a hash; T. Ettinger's mulberry32 (public domain) | the same rule the isometric styles keep (`src/isometric/style.js` · `seeded`) |
| Arcs | `critics/arc.js` | F. Thomas, O. Johnston, *The Illusion of Life: Disney Animation*, Abbeville Press, 1981 | that a living thing moves on arcs, and a straight slide reads as mechanical |

**Ours:** every default not in a row above — Fitts's a (0.1 s), b (0.2 s a bit) and the usual target (40 px); the power law's floor
(0.00025 per px) and ramp (a tenth at each end); the pen's speed (400 px a second); the tremor's amplitude (0.8 px),
wavelength (24 px), alternating swings and quieting into bends; the letter's mu (−1.6), sigma (0.3) and gap (0.16 s); the reach's bow (6% of its length, at most 30%); a turn past a right angle read as at least 2 · cos(B/2) / its shorter side; the
critics' limits (no extra speed peak, a 2% bow, 20% off the law) and the way `pen-speed` walks and smooths a track.
Each is a named constant beside its reason, and a test pins it.
