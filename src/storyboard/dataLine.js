/**
 * One value as one line of data. JSON leaves some characters raw that a reader or a model can take for something else: line ends
 * other than \n, tag characters and direction controls, which can start a line or hide words. Each one is written as \uXXXX, so
 * the line still parses back to exactly what it was given, with nothing taken out.
 */
const HIDDEN = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}\p{Default_Ignorable_Code_Point}]/gu;

const unitOf = (text, i) => `\\u${text.charCodeAt(i).toString(16).padStart(4, '0')}`;
const escaped = (char) => (char.length === 1 ? unitOf(char, 0) : unitOf(char, 0) + unitOf(char, 1));

export const dataLine = (value) => JSON.stringify(value).replace(HIDDEN, escaped);
