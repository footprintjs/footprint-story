# isometric/ — where the ideas come from

| what | used in | source |
|---|---|---|
| The picture itself: a parallel (axonometric) view, of which isometric and dimetric are the kinds seen from a corner | `grid.js` | J. D. Foley, A. van Dam, S. K. Feiner, J. F. Hughes, *Computer Graphics: Principles and Practice*, 2nd ed., Addison-Wesley, 1990 (the chapter on viewing in 3D: parallel projections) |
| Drawing the furthest thing first, and that some arrangements have no right order | `order.js` | M. E. Newell, R. G. Newell, T. L. Sancha, "A Solution to the Hidden Surface Problem", Proceedings of the ACM Annual Conference, 1972 (the painter's algorithm) |
| Giving an order from "this before that" pairs: take what waits for nothing, again and again | `order.js` | A. B. Kahn, "Topological Sorting of Large Networks", Communications of the ACM 5 (11), 1962 |
| Which things are in one ring, and which ring waits for nothing outside itself (strongly connected components) | `order.js` | R. Tarjan, "Depth-First Search and Linear Graph Algorithms", SIAM Journal on Computing 1 (2), 1972 |
| Whether two boxes meet on the frame: their shadows overlap along each direction their edges run in (the separating-axis test for convex shapes) | `order.js` | S. Gottschalk, M. C. Lin, D. Manocha, "OBBTree: A Hierarchical Structure for Rapid Interference Detection", SIGGRAPH 1996 |

| Drawing a set of "this leads to that" links in steps: break the rings, give each thing a step, order each step, then place — and going towards the middle of one's neighbours to uncross the links | `arrange.js` | K. Sugiyama, S. Tagawa, M. Toda, "Methods for Visual Understanding of Hierarchical System Structures", IEEE Transactions on Systems, Man, and Cybernetics 11 (2), 1981 |
| The nearest values that keep an order, by least squares: pool neighbours that would break it, and give them their mean | `arrange.js` (`settle`) | M. Ayer, H. D. Brunk, G. M. Ewing, W. T. Reid, E. Silverman, "An Empirical Distribution Function for Sampling with Incomplete Information", The Annals of Mathematical Statistics 26 (4), 1955 (the pool-adjacent-violators algorithm) |

**Ours:** the test for "this can never cover that" (all of it at smaller cols, or at smaller rows, or below), with its
reason in `README.md`; ordering only pairs that meet on the frame; cutting a ring at its first given, and only a ring
that waits for nothing outside itself; `rise` worked out from the tile so a cube looks like a cube; the words (`col`,
`row`, `lift`, `wide`, `deep`, `high`). In `arrange.js`: turning "keep the gaps" into "never fall" by taking away what
stands before each thing, so the pooling above answers it exactly; a thing nothing leads to waiting one step before
what it leads to; the half-tile slots; the rows for things joined to nothing. In `fit.js`: measuring the picture once
on a tile 100 wide.

**Why not the simpler sort** (one score per thing, col + row + height): it is right for things one tile big and wrong
for long ones, where a long box and a short one beside it swap. A deck's blocks are often long.
