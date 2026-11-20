# The controls — the code this package replaced, kept as it was

These files are the **control** of the differential tests: the package must say, write and keep what the
code it replaced said, wrote and kept. They are copies, never edited, never imported by `src/`.

| file | copied from | changes |
|---|---|---|
| `storydeck-0.2.0-narration.js` | storydeck `narration.js` at `2582b23` (npm `storydeck` 0.2.0) | none (byte-identical) |
| `storyreel-0.9.0-clock-slots.mjs` | footprint-storyreel `src/clock.mjs` at `eab4858` (npm 0.9.0), lines 1–188 | `export` added to the seven private functions (`checkSay`, `findSlot`, `slotPieces`, `slotMap`, `spokenOffset`, `letterStart`, `letterEnd`) |
| `storyreel-0.9.0-captions.mjs` | footprint-storyreel `src/captions.mjs` at `eab4858` | none |
| `storyreel-0.9.0-youtube.mjs` | footprint-storyreel `src/targets/youtube.mjs` at `eab4858` | none |
| `storyreel-0.9.0-readCaptions.mjs` | footprint-storyreel `src/finished.mjs` at `eab4858`, lines 268–277 (`readCaptions`) | none |
| `storyreel-0.23.0-ease.mjs` | footprint-storyreel `src/ease.mjs` at `1f59978` (npm 0.23.0) | none |
| `storyreel-0.23.0-motion.mjs` | footprint-storyreel `src/motion.mjs` at `1f59978` | none |
| `storyreel-0.23.0-moves.mjs` | footprint-storyreel `src/moves.mjs` at `1f59978` | its two imports point at the two controls above |
| `storyreel-0.23.0-settings.mjs` | footprint-storyreel `src/settings.mjs` at `1f59978` | its import of `isHex` from `colour.mjs` is replaced by that one line (`colour.mjs` line 9) |
| `storydeck-0.27.0-ride.js` | storydeck `deck/ride.js` at `2bdfff5` (0.27.0) | none (byte-identical) |
| `storydeck-0.27.0-hairpins.js` | storydeck `deck/cable.js` at `2bdfff5`, lines 116–164 (`hairpins`, its constants and the unused `HAIRPIN_WORDS`) | none |
| `storydeck-0.27.0-keepClear.js` | storydeck `deck/keepClear.js` at `2bdfff5`, lines 17–28 (the constants) and 52–108 (`floorUnder`, `crossesBox`) | none |
| `storydeck-0.27.0-floorLabel.js` | storydeck `deck/floorLabel.js` at `2bdfff5` | its import of `wordsToFit` points at `../../isometric.js` |
| `storydeck-0.27.0-groups.js` | storydeck `deck/groups.js` at `2bdfff5`, lines 20–60 (`GROUP_MARGIN`, `groupWritten`, `arrangeByGroup`) | none (`groupWritten`'s import of `ownAttribute` is left out with the lines above it; it is never called) |

Where the package differs from a control on purpose, the test that compares them names the difference and
leaves it out of its generator — see the CHANGELOG's "Differences from the code it replaced". Keep these
files for as long as the property tests that read them exist.
