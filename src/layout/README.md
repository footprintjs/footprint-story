# layout/ — a flat frame, as numbers

**Why:** a deck and a film both close in on a box and both set words across a width. StoryDeck wrote "zoom so the box
fills a share of the room" three times (its zoom and fit cameras, and the room a side mover leaves) and StoryReel twice
(its focus and its pushes on a named thing), and StoryReel wrote "fill each line greedily, then narrow it to balance"
in its title band, end card, summary cards, captions and whiteboard titles.
Each rule lives here once; the tools measure, draw and word messages.

| file | holds |
|---|---|
| `frame.js` | `frameZoom(size, room, { share, least, most, smallest })` |
| `wrap.js` | `wrapWords(words, width, measure)`, `narrowestWidth(width, lines, linesAt)`, `NARROWEST_STEPS` |

**`frameZoom`** = max(least, min(most, share × min(roomW ÷ boxW, roomH ÷ boxH))): the box contained in the room, a
share of that, held between two bounds. WHY those operations in that order: StoryDeck rounds a view to 4 places, so an
answer that differs in its last bit can round the other way (0.21875 against 0.21874999999999997); the order is the
one its pages were built with. Numbers in, numbers out: a NaN in is a NaN out, so a caller that must refuse an
unchecked option checks it first.

**`wrapWords`** fills each line with as many words as fit (first fit); a word wider than the width has a line to
itself, uncut. Each candidate line is measured whole (`measure(text)`, a canvas's `measureText`), so the face's own
spacing and kerning count. **`narrowestWidth`** halves between 0 and the width 12 times (1/4096 of it) for the
narrowest width that keeps the line count: the lines set there are balanced.

**Not here:** a caption's own line breaking, which sums each word's width once and gives word indexes (StoryReel
`captions.mjs`; it uses `narrowestWidth` to balance), and a chip's, which breaks a word too wide for a chip between its
graphemes (`attention.mjs`). A name on a block's face is `wordsToFit` (`footprint-story/isometric`): one line or two,
the most even break, and a size found for it.

**Pinned:** `test/shared-differential.property.test.js` against copies of StoryDeck 0.28.0's `focus.js` and StoryReel
0.33.0's line breaking (`test/control/`). Sources: [REFERENCES.md](REFERENCES.md).
