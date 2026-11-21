// footprint-story/layout — a flat frame as plain numbers: how far a view zooms to frame a box, and how words break
// across a width as they are drawn. Pure: runs anywhere (browser or Node), imports nothing, and loads only when
// imported. Nothing here draws — StoryDeck writes its view into a page, StoryReel paints a canvas.
//
//   frameZoom([w, h], [roomW, roomH], { share, least, most })   → the zoom at which the box fills that share of the room
//   wrapWords(words, width, (text) => width)                     → the words greedily on lines no wider than width
//   narrowestWidth(width, lines, (w) => lineCount)               → the narrowest width that keeps that many lines

export { frameZoom } from './src/layout/frame.js';
export { wrapWords, narrowestWidth, NARROWEST_STEPS } from './src/layout/wrap.js';
