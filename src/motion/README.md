# motion/ — how things move, named once for a film and a deck

**Why:** StoryReel draws films on a canvas and StoryDeck plays decks in a page, and both need the same words: *ease
out on an expo*, *settle on a heavy spring*, *slam the title in*, *push to the next picture*, *this is a lesson, so a
pause is fine*. Two copies of a spring drift apart; one named table does not. Nothing here draws — each tool keeps its
own drawer and reads these names.

| file | holds |
|---|---|
| `ease.js` | the ease table by name, CSS `cubic-bezier(…)` as a curve, which curves overshoot |
| `spring.js` | closed-form springs by feel (`snappy`, `default`, `heavy`, `playful`, or `{ k, d }`), settling time, tracks |
| `moves.js` | named moves (entrances, exits, feedback, ambient loops) as data, by feel and use; `moveAt` gives their values at t |
| `transitions.js` | the editor's changes of picture as data (family, seconds, ease, sound name, settings); read, checked, extended |
| `settings.js` | the one settings reader (`oneOf`, `point`, `color`, `number`, `box`, `name`); a point's default may be `'centre'` |
| `pace.js` | how long a picture may sit still, by kind of film: `lesson`, `promo` |
| `turns.js` | an order written once: names one after another, `(a b)` together, `name:seconds` for a turn's own time; when each turn starts |
| `ride.js` | a packet riding a line: eased out of its start and into its end over shares of its LENGTH (`rideProfile`, stops within 0.4 px of the true ease), its time from a speed (`rideSeconds`), the speed at a place (`speedAt`), a rest at the end (`withHold`), how much of it shows (`showStops`), where it fades before a stretch a block hides (`hiddenRamps`) |
| `REFERENCES.md` | where the ideas come from |

```js
import { moveAt, readTransition, extendTransitions, TRANSITIONS } from 'footprint-story/motion';

moveAt('pop', 0.2, { feel: 'heavy' });               // a move on another curve
const mine = extendTransitions(TRANSITIONS, { swirl: { family: 'wipe', seconds: 0.6, ease: 'inOut', sound: null, draw } }, { extra: ['draw'] });
readTransition({ type: 'swirl' }, 'scene 2', { catalog: mine });
```

**Turns.** `stagger` spaces items one gap apart. An order with things that come together, or a turn that takes longer,
is written once and read here, so a deck's route and a film's cue mean the same:

```js
import { readTurns, turnTimes } from 'footprint-story/motion';

const turns = readTurns('camera laptop (dns server) w1:1.2 db');
// camera; then laptop; then dns and server together; then w1, which takes 1.2 s; then db
turnTimes(turns, { step: 0.35 }).turns.map((t) => t.at);   // [0, 0.35, 0.7, 1.05, 2.25]
```

The written form is our own; `stagger` is its plain case. A tool looks the names up in its own picture. Text from anyone is bounded (256 turns, 8192 characters), a name with a
character nobody can see is refused, and every refusal says what to write.

**A packet's ride.** A wire's packets ride its line once a run. StoryDeck turns these numbers into CSS and a film
can ride the same packets with them: the place is the same share of the same line at the same moment in both.

```js
import { rideProfile, rideSeconds, withHold, hiddenRamps } from 'footprint-story/motion';

const ease = [0.15, 0.2];                              // eased over the first 15% of the line and the last 20%
rideSeconds(900, 300, ease);                           // 4.05 (to a float): the ride at a steady 300 px a second, its ends eased
withHold(rideProfile(ease, 900), 0.8);                 // [[0, 0], …, [0.8, 1], [1, 1]]: the ride, then a rest at the end
hiddenRamps([[300, 360]], 900, 300, ease);             // [[0.316…, 0.333…, 0.4, 0.416…]]: out before a block, back after
```

WHY the ease is along the length, not the time: whoever draws says where the packet eases (out of the port, into the
switch), and a place on the line stays the place whatever the ride's time. The packet gathers speed evenly from rest,
keeps one steady speed, and slows evenly to rest, so an eased stretch takes twice the time the steady speed would.
These numbers came from StoryDeck 0.27.0 (`deck/ride.js`), unchanged in what they give (a property test against a copy).

The ease, spring and moves files came from footprint-storyreel 0.23.0 unchanged in what they do (property tests
against copies of that code in `test/control/`). Only measured or published numbers go in `pace.js`, each with
where it came from.
