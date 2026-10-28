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

```js
import { moveAt, readTransition, extendTransitions, TRANSITIONS } from 'footprint-story/motion';

moveAt('pop', 0.2, { feel: 'heavy' });               // a move on another curve
const mine = extendTransitions(TRANSITIONS, { swirl: { family: 'wipe', seconds: 0.6, ease: 'inOut', sound: null, draw } }, { extra: ['draw'] });
readTransition({ type: 'swirl' }, 'scene 2', { catalog: mine });
```

The ease, spring and moves files came from footprint-storyreel 0.23.0 unchanged in what they do (property tests
against copies of that code in `test/control/`). Only measured or published numbers go in `pace.js`, each with
where it came from.
