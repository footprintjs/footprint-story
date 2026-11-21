# differs/ — a part that differs from the real thing says so

**Why:** a picture is believed. A process run 30 times faster, or a part drawn far larger than it is, reads as how the
thing is unless the part says otherwise. StoryDeck (`data-differs-*` on a part) and StoryReel (`differs` on a scene)
each held the same rules and the same default words; a deck and a film must say it alike, so the rules live here once.

| file | holds |
|---|---|
| `differs.js` | the default words (`timeWords`, `analogyWords`), the bounds, `timeProblem`, `differsLines`, `differsProblem`, `differsEnglish`, `differsStatements`, `differsFactors`, `foldDiffers` |

**What stays in each tool:** reading its writer's text (an attribute's entities and its `|` lists; a JSON field's
types), the length checks worded for its own fields, and every sentence. The kit gives codes and numbers
(`{ problem: 'unstated', named, statements, says }`), never a sentence: a deck says "the notes", a film "the voice".

**The checks, in order** (`differsProblem`): two phrases that are the same words when spoken (`normSpeech`), nothing
said at all, fewer lines and phrases than statements, and a figure in the line that says the time that is none of the
values the factor may be written as (`differsFactors`: as declared, and as the time words say it; `1,000` and `1.000`
may each be a thousand, `1,5` one and a half). With time alone every line says the time; with anything else too the
first of two or more lines does; a single line beside a phrase cannot be told. A time is refused when it is no finite
number above 0, reads as 1 (real time), or is past 1e9 times either way.

**Pinned:** `test/shared-differential.property.test.js` holds every rule to copies of StoryDeck 0.28.0's and
StoryReel 0.33.0's code (`test/control/`), declaration for declaration and refusal for refusal.
**Ours:** the rules and the words; no borrowed algorithm.
