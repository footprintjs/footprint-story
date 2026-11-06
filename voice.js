// footprint-story/voice — a narration in a voice: one clip per text, cached by its recipe. Node only.
//
//   const engine = chatterboxKit({ kit: '../voice-kit' });       // an adapter of the voice port: a local voice kit
//   await voiceClips(texts, { cache, profile, engine });         // voices only the texts whose clip is not cached
//   clipFor(texts[i], { cache, profile })                        // → { key, audio, duration, sentences, words, take } or null
//
//   const takes = recordedTakes({ kit: '../voice-kit', takes: 'takes' });   // the other adapter: your own recordings
//   await voiceClips(texts, { cache, profile: takes.profile, engine: takes });
//
//   const { engine, profile } = narrationVoice({ cache, kit, takes });   // the voice a person named; none: the settings last used here
//   narrationSummary(await narrate(lines, { cache, profile, engine }));  // voices what is missing (with no engine, only reads) and says so

export { clipKey } from './src/voice/key.js';
export { clipFor, pickSteps, voiceClips } from './src/voice/cache.js';
export { chatterboxKit } from './src/voice/chatterbox.js';
export { recordedTakes } from './src/voice/recorded.js';
export { narrate, narrationState, narrationSummary, narrationVoice } from './src/voice/narrate.js';
