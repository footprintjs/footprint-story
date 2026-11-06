# storyboard/ — a story written as data, on a named shape

**Why:** a model that writes a deck's HTML or a film's recipe by hand spends many tokens, can drift between tools, and can
put a conversation's planted text into a page as code. Filling in a shape costs little, names every mistake at once,
and its text is only ever text. Each tool draws the same board its own way.

| file | holds |
|---|---|
| `read.js` | the door's rule: read a board, name every problem at once, give scenes |
| `toldTwice.js` | `told-twice`: a cast acts a system out, turns into it, and the story runs again for real |
| `whatWeFound.js` | `what-we-found`: what was checked, what was found, what is not known, what is next |
| `conversation.js` | a conversation as sources, and the rule that a claim's numbers are in the messages it cites |
| `fields.js` | reading data while keeping every problem |
| `words.js` | the limits on each kind of text, and a part's labels |

```js
import { readStoryboard } from 'footprint-story/storyboard';

const board = readStoryboard(fromAnAgent, { conversation: [{ id: 'm7', text: 'it waited 41 minutes' }] });
board.scenes[1];   // { id, part, look, title, narration, beat }: title and narration are a film's scene as they are
```

The number rule catches a number that is not in its sources. It does not catch a claim that is wrong in words, or a number
spelled out, and with no conversation given there is nothing to check against, so the board says `verified: false`.
