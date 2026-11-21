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
| `storydeck-0.28.0-differs.js` | storydeck `deck/differs.js` at `eef5335` (0.28.0) | its three imports replaced by the lines they import (`pieceRules.js` lines 41 and 49–77, `readAttributes`; `deck/html.js` lines 43–49, `decodeEntities` and `esc`), the kit's `normSpeech` from `../../index.js`; `export` added to `factorsOf`, `readTime`, `readSaid`, `contradicting` |
| `storydeck-0.28.0-focus.js` | storydeck `focus.js` at `eef5335` | its import of `readTurns` points at `../../motion.js` |
| `storyreel-0.33.0-differs.mjs` | footprint-storyreel `src/differs.mjs` at `e611fb4` (0.33.0), lines 1–140 (through `differsOf`) | `normSpeech` from `../../index.js`; the imports of `claims.mjs` and `reading.mjs` dropped (used only after line 140); `export` added to `factorsOf`, `readTime`, `readSaid`, `contradicting`, `statementsOf` |
| `storyreel-0.33.0-wrap.mjs` | footprint-storyreel at `e611fb4`: `src/layout.mjs` lines 293–306 (`wrap`, `balancedLines`), `src/endcard.mjs` lines 11–16 (`wrap`, as `wrapEndCard`), `src/kits/paper/paper.mjs` lines 352–356 (`wrap`, as `wrapPaper`), `src/captions.mjs` lines 50–74 (`captionLines`) | `export` added, the two `wrap`s from other files renamed, a comment line naming each source |
| `storydeck-0.27.0-groups.js` | storydeck `deck/groups.js` at `2bdfff5`, lines 20–60 (`GROUP_MARGIN`, `groupWritten`, `arrangeByGroup`) | none (`groupWritten`'s import of `ownAttribute` is left out with the lines above it; it is never called) |
| `storydeck-0.29.0-cable.js` | storydeck `deck/cable.js` at `d683b08` (0.29.0), lines 22, 24 and 169–253 (`SAMPLE`, `WALK_MOST`, `cablePoint`, `cableWalk`, `inside`, `held`, `near`, `LABEL_PLACES`, `EDGE`, `TIP`, `LABEL_LOOKS`, `labelPlace`) | none |
| `storydeck-0.29.0-boxes.js` | storydeck `deck/boxes.js` at `d683b08`, lines 27–47 (`exitOutline`, `exit`) | none |
| `storydeck-0.29.0-rides.js` | storydeck `deck/rides.js` at `d683b08`, lines 30–37, 81–106 and 161–175 (`STEP`, `short`, `easing`, `seenOf`, `curveLength`, `piecesLength`) | none |
| `storydeck-0.29.0-iso.js` | storydeck `deck/iso.js` at `d683b08`, lines 272–276 (`roundOutline`) | `export` added |
| `storydeck-0.29.0-transforms.js` | storydeck `deck/transforms.js` at `d683b08`, lines 63–65, 74–83, 90–92, 95–97, 123, 130–135 and 259–311 (`fixed`, `BETWEEN`, `wireEndsOf`, `endsRead`, `LANE`, `GAP`, `LABEL`, `shown`, `HEAD`, `headAt`, `labelBox`, `wiresBetween`) | `export` added to `headAt`, `labelBox`, `wiresBetween`; `exitOutline`/`exit` from the boxes control, `NO_ROUTE` from `../../isometric.js`; the three things `wiresBetween` reads of a page (`pieceNames`, `boxFinder`, `cables`/`cablesOn`) stand in for a plain object handed as `html` (the property passes no floor, so the cable calls are never reached) — nothing inside the copied lines is changed |
| `storyreel-0.34.0-cables.mjs` | footprint-storyreel `src/kits/isometric/cables.mjs` at `502044a` (0.34.0) | its import of `rounded` points at `../../isometric.js` |
| `storyreel-0.34.0-ride.mjs` | footprint-storyreel `src/kits/isometric/ride.mjs` at `502044a`, lines 18–26 and 51–59 (`onStops`, `seenAt`) | `export` added to `seenAt` |
| `storyreel-0.34.0-build.mjs` | footprint-storyreel `src/kits/isometric/build.mjs` at `502044a`, lines 87–91 (`roundOutline`) | `export` added |
| `storyreel-0.34.0-draw.mjs` | footprint-storyreel `src/kits/isometric/draw.mjs` at `502044a`, lines 89–94 (`drawHead`) | `export` added; its import of `ISO_CABLE` points at the cables control |
| `storydeck-0.30.0-cableWay.js` | storydeck `deck/cable.js` at `0cbd4d6` (0.30.0), lines 160–164 (`cableWay`) | its import of `rounded` points at `../../isometric.js` |

Where the package differs from a control on purpose, the test that compares them names the difference and
leaves it out of its generator — see the CHANGELOG's "Differences from the code it replaced". Keep these
files for as long as the property tests that read them exist.
