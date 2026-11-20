# motion/ — where the ideas come from

| what | used in | source |
|---|---|---|
| A move from rest to rest as constant speeding up, a steady speed, and constant slowing down (a linear stretch with parabolic blends) | `ride.js` | J. J. Craig, *Introduction to Robotics: Mechanics and Control*, Addison-Wesley, 1986 (the chapter on trajectory generation: linear functions with parabolic blends) |
| Stops drawn straight between, as an easing a page plays | `ride.js` (`rideProfile`, `showStops`) | W3C, *CSS Easing Functions Level 2* (the `linear()` easing function) |

**Ours:** easing a ride over shares of the line's LENGTH rather than its time; the number of stops from how far a
parabola cut into straight pieces strays (its stretch over 4·n²), held under 0.4 px; three frames at the packet's own
speed as the shortest fade seen as a fade; a fade done the packet's radius before what hides it.

The ease, spring and moves files came from footprint-storyreel; their sources are named in those files.
