# isometric/ — where the ideas come from

| what | used in | source |
|---|---|---|
| The picture itself: a parallel (axonometric) view, of which isometric and dimetric are the kinds seen from a corner | `grid.js` | J. D. Foley, A. van Dam, S. K. Feiner, J. F. Hughes, *Computer Graphics: Principles and Practice*, 2nd ed., Addison-Wesley, 1990 (the chapter on viewing in 3D: parallel projections) |
| Drawing the furthest thing first, and that some arrangements have no right order | `order.js` | M. E. Newell, R. G. Newell, T. L. Sancha, "A Solution to the Hidden Surface Problem", Proceedings of the ACM Annual Conference, 1972 (the painter's algorithm) |
| Giving an order from "this before that" pairs: take what waits for nothing, again and again | `order.js` | A. B. Kahn, "Topological Sorting of Large Networks", Communications of the ACM 5 (11), 1962 |
| Which things are in one ring, and which ring waits for nothing outside itself (strongly connected components) | `order.js` | R. Tarjan, "Depth-First Search and Linear Graph Algorithms", SIAM Journal on Computing 1 (2), 1972 |
| Whether two boxes meet on the frame: their shadows overlap along each direction their edges run in (the separating-axis test for convex shapes) | `order.js` | S. Gottschalk, M. C. Lin, D. Manocha, "OBBTree: A Hierarchical Structure for Rapid Interference Detection", SIGGRAPH 1996 |
| Drawing a set of "this leads to that" links in steps: give each thing a step, order each step, then place — and going towards the middle of one's neighbours to uncross the links | `arrange.js` | K. Sugiyama, S. Tagawa, M. Toda, "Methods for Visual Understanding of Hierarchical System Structures", IEEE Transactions on Systems, Man, and Cybernetics 11 (2), 1981 |
| Breaking a ring by walking the things and reading the link that closes it the other way round; keeping the best order met across the sweeps | `arrange.js` | E. R. Gansner, E. Koutsofios, S. C. North, K.-P. Vo, "A Technique for Drawing Directed Graphs", IEEE Transactions on Software Engineering 19 (3), 1993 |
| The nearest values that keep an order, by least squares: pool neighbours that would break it, and give them their mean | `arrange.js` (`settle`) | M. Ayer, H. D. Brunk, G. M. Ewing, W. T. Reid, E. Silverman, "An Empirical Distribution Function for Sampling with Incomplete Information", The Annals of Mathematical Statistics 26 (4), 1955 (the pool-adjacent-violators algorithm) |
| The cheapest way over a lattice of points, by spreading out from the start (the maze router of circuit boards) | `routes.js` (`search`) | C. Y. Lee, "An Algorithm for Path Connections and Its Applications", IRE Transactions on Electronic Computers EC-10 (3), 1961 |
| The cheapest way when steps cost different amounts: always go on from the point reached most cheaply so far | `routes.js` (`search`) | E. W. Dijkstra, "A Note on Two Problems in Connexion with Graphs", Numerische Mathematik 1, 1959 |
| Looking first where the way left is shortest, so the search goes towards the end and still finds the cheapest way | `routes.js` (`search`: the cost so far and the tiles still to go) | P. E. Hart, N. J. Nilsson, B. Raphael, "A Formal Basis for the Heuristic Determination of Minimum Cost Paths", IEEE Transactions on Systems Science and Cybernetics 4 (2), 1968 (A*) |
| Keeping what waits to be looked at in a heap, the least first | `routes.js` (`heap`) | J. W. J. Williams, "Algorithm 232: Heapsort", Communications of the ACM 7 (6), 1964 |
| Whether two convex outlines on the frame overlap: no line along one of their sides parts them (the separating-axis test) | `floorLabel.js` (`overlap`) | S. Gottschalk, M. C. Lin, D. Manocha, "OBBTree: A Hierarchical Structure for Rapid Interference Detection", SIGGRAPH 1996 |
| Whether a straight stretch passes inside a box: clip its parameter to the box's slab along each axis in turn, and see whether anything is left | `under.js` (`crossesBox`) | Y.-D. Liang, B. A. Barsky, "A New Concept and Method for Line Clipping", ACM Transactions on Graphics 3 (1), 1984 |
| A corner as one curve from two points and the corner between them (a quadratic Bézier curve) | `path.js` | as set out in G. Farin, *Curves and Surfaces for Computer Aided Geometric Design*, Academic Press, 1988 |

**Ours:** the test for "this can never cover that" (all of it at smaller cols, or at smaller rows, or below), with its
reason in `README.md`; ordering only pairs that meet on the frame; cutting a ring at its first given, and only a ring
that waits for nothing outside itself; `rise` worked out from the tile so a cube looks like a cube; the words (`col`,
`row`, `lift`, `wide`, `deep`, `high`). In `arrange.js`: turning "keep the gaps" into "never fall" by taking away what
stands before each thing, so the pooling above answers it exactly; a thing nothing leads to waiting one step before
what it leads to; the half-tile slots; the rows for things joined to nothing; the gap that lets the floor show past the
tallest thing. In `fit.js`: measuring the picture once
on a tile 100 wide. In `routes.js`: what a step costs (a turn, hidden floor, crossing, running along another: a link
laid later pays to cross or share, so it takes the lane beside); leaving and reaching a thing only at the two feet a
viewer sees; "hidden" as floor a thing's height covers towards the viewer; the short straight run out of a foot that
is the route's own; a count of the work so a picture too big ends; and a result that says in words what happened to
each link. In `path.js`: measuring a corner in chords so the place along a way is by length. In `hairpins.js`: a way's stretches one way in a row read as one, a jog under a tenth of a tile and a riser as none,
and a port end asked within two tiles of it whether the way runs back, said by which way the port faces. In
`under.js`: whether a square of floor's drawn diamond meets a box, asked exactly as the box grown by the diamond at the
diamond's middle; squares side by side joined into one stretch, each a hair past its squares so a line between two is
kept too; the squares counted before any is looked at. In `floorLabel.js`: a label's size from the tile, its letters
counted with capitals wider, moved half a tile at a time along the edge, and said, never cut. In `groups.js`: a group
as one thing to the arrangement, as big as its things and its floor's margin and half a tile more.

**Why not the simpler sort** (one score per thing, col + row + height): it is right for things one tile big and wrong
for long ones, where a long box and a short one beside it swap. A deck's blocks are often long.
