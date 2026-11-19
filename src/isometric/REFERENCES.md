# isometric/ — where the ideas come from

| what | used in | source |
|---|---|---|
| The picture itself: a parallel (axonometric) view, of which isometric and dimetric are the kinds seen from a corner | `grid.js` | J. D. Foley, A. van Dam, S. K. Feiner, J. F. Hughes, *Computer Graphics: Principles and Practice*, 2nd ed., Addison-Wesley, 1990 (the chapter on viewing in 3D: parallel projections) |
| Drawing the furthest thing first, and that some arrangements have no right order | `order.js` | M. E. Newell, R. G. Newell, T. L. Sancha, "A Solution to the Hidden Surface Problem", Proceedings of the ACM Annual Conference, 1972 (the painter's algorithm) |
| Giving an order from "this before that" pairs: take what waits for nothing, again and again | `order.js` | A. B. Kahn, "Topological Sorting of Large Networks", Communications of the ACM 5 (11), 1962 |

**Ours:** the test for "this can never cover that" (all of it at smaller cols, or at smaller rows, or below), with its
reason in `README.md`; cutting a ring at the thing given first; `rise` worked out from the tile so a cube looks like a
cube; the words (`col`, `row`, `lift`, `wide`, `deep`, `high`).

**Why not the simpler sort** (one score per thing, col + row + height): it is right for things one tile big and wrong
for long ones, where a long box and a short one beside it swap. A deck's blocks are often long.
