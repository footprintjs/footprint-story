# storyboard/ — a story written as data, on a named shape

**Why:** a model that writes a deck's HTML or a film's recipe by hand spends many tokens, can drift between tools, and can
put a conversation's planted text into a page as code. Filling in a shape costs little, names every mistake at once,
and its text is only ever text. Each tool draws the same board its own way.

| file | holds |
|---|---|
| `read.js` | the door's rule: read a board, name every problem at once, give scenes |
| `brief.js` | what a model needs to write a board: the instructions, and the conversation kept apart as data |
| `fixBrief.js` | what a model needs to fix a refused board: one short brief per piece at fault, its words kept apart as data |
| `pieces.js` | which piece each problem belongs to: an entry, a whole list, or the frame |
| `clip.js` | a model's or a conversation's words, cut short for a brief, saying how much was cut |
| `dataLine.js` | one value as one line of JSON, with every line end and hidden character escaped |
| `shapes.js` | the shapes there are |
| `toldTwice.js` | `told-twice`: a cast acts a system out, turns into it, and the story runs again for real |
| `whatWeFound.js` | `what-we-found`: what was checked, what was found, what is not known, what is next |
| `conversation.js` | a conversation as sources, and the rule that a claim's numbers are in the messages it cites |
| `session.js` | a chatbot session file (one JSON record per line), read a line at a time as a conversation: the person's and the assistant's words kept, everything else counted |
| `fields.js` | reading data while keeping every problem |
| `words.js` | the limits on each kind of text, and a part's labels |

```js
import { readStoryboard } from 'footprint-story/storyboard';

const board = readStoryboard(fromAnAgent, { conversation: [{ id: 'm7', text: 'it waited 41 minutes' }] });
board.scenes[1];   // { id, part, look, title, narration, beat }: title and narration are a film's scene as they are
```

The number rule covers every word a `what-we-found` says or shows: a claim against the messages it cites, and anything that
cites none against the whole conversation. What a model writes must use plain digits: a disguised number (hidden characters,
superscripts, odd separators, direction controls) is refused rather than read. It does not catch a claim that
is wrong in words, a number spelled out, or a sign (`-41` reads as 41). `verified` is true only when a shape's claims really were checked: `told-twice`
makes none, and with no conversation given nothing is checked.

`storyboardFixBriefs(board, problems, { conversation })` groups a refused board's problems by piece. Each brief holds the
problems, what the piece says now and the messages it cites, as data lines. Its size is bounded however big the board or the
chat: a long text is cut and says so, and a line that does not fit is counted in `left`. A problem is never left out. A host that
keeps its board can change just those pieces. Nothing here takes a piece as an answer, so the host says what form to answer in.
