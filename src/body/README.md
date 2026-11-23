# body/ — a body's parts, poses and solvers, as numbers

## FABRIK — a chain of 2 to 16 parts reaching for a point (`fabrik.js`)

**Why:** a spine leaning toward a cup, a neck, a tail: a chain of more than two parts has many answers, and no closed
form. FABRIK (Aristidou & Lasenby 2011) works on the joints' positions, not their angles: it keeps every part's length
exactly on every pass, settles in few passes and bends a chain along its length, where cyclic coordinate descent curls
the last joints first. Pure: the same chain and target give the same answer, bit for bit.

```js
import { fabrik } from './fabrik.js';   // the body door hands it out once round 1A's door lands

fabrik({ points: [[0, 0], [3, 0], [7, 0]], target: [0, 5] });
// → { points: [[0, 0], [2.39, 1.82], [-0.01, 5.02]], angles: [0.65, 1.56], reached: true, miss: 0.025, passes: 1, bound: [] }

fabrik({ points: [[0, 0], [3, 0], [7, 0]], target: [0, 5], limits: [[-0.5, 0.5], null] });
// → the first part held at 0.5 rad: reached false, miss 0.43 (the closest the window allows), bound [0]
```

In: `points`, the start pose's joints from the root to the end (3 to 17); `target`; optional `lengths` (else the start's
own distances), `limits` (one `[min, max]` or `null` a part, on its angle relative to its parent), `parentAngle` (the
world angle of the part the chain hangs from, 0) and `passes` (at most 16). Out, frozen: the solved `points`, each part's
relative `angles`, `reached`, `miss` (px), `passes`, `bound` (the parts whose window held them).

| | |
|---|---|
| a pass | forward (the end on the target, each joint back to its length, end to root), then backward (the root back on its place, root to end); with limits each sweep turns a child back into its window about its joint (Aristidou, Chrysanthou & Lasenby 2016) |
| guarantees, after every pass | the root where it was given; every length to 1e-9 of itself; every limited angle in its window |
| stops | at 16 passes, or once the end is under 0.1 px from the target; one fixed order, so the same answer every time |
| out of reach, no limits | the chain laid straight toward the target, no pass (`passes: 0`) |
| windows | §1's rule: a relative angle is read as the value plus the multiple of 2π nearest the window's middle (`geom/angles.js · wrapAngle`), then held at the nearer end |
| no direction | a direction shorter than 1e-9 of the chain's length is rounding: that part keeps its way in the start pose (a start part with none takes its parent's) |
| in a line | every joint and the target on one line: FABRIK alone never leaves it, so the start is first bent `IN_LINE_BEND` (0.1 rad, ours) a joint, clockwise on screen |
| angles out | a limited part's in its window; an unlimited part's the turn nearest its start pose's, so it never jumps a whole turn between two solves of one move |
| refused | anything §10 bounds, in words naming the field: 2 to 16 parts, points and target within ±1e6 px, lengths 0 < l ≤ 10,000, NaN and Infinity, a window that cannot hold, a getter (never run), an unknown key |

**How sure it is (measured, not a theorem):** with limits nothing is promised about the miss, and it is reported. Without
limits, on 50,000 random reachable chains (2 to 16 parts of 5 to 100 px, every angle uniform round the turn, the target the
end of another such pose), 16 passes reach under 0.1 px on 96.3% and under 1 px on 98.6%; the rest settle slowly, near
full reach, near a fold, or from a tangled start. A textbook FABRIK gives the same points to 1e-11 px, so this is the
method's pace, not a fault; the miss is told, and a caller's `reach-range` finding reads it. On the same chains the miss
never grew from one pass to the next (a property test pins it). Tests: test/body-fabrik.test.js,
test/body-fabrik.property.test.js (FC_RUNS=20000 for a deep sweep).

**Sources:** A. Aristidou, J. Lasenby, "FABRIK: A fast, iterative solver for the Inverse Kinematics problem",
*Graphical Models* 73 (5), 2011 (the passes); A. Aristidou, Y. Chrysanthou, J. Lasenby, "Extending FABRIK with model
constraints", *Computer Animation and Virtual Worlds* 27 (1), 2016 (a child turned back into its window about its joint,
in both sweeps).
