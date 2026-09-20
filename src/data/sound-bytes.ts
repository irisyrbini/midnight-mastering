import { SHEET_PIECE_IDS, pieceLabel } from './sheet-music';
import { playSoundByteSample, preloadSoundByteSamples } from '@/game/audio/sound-byte-samples';

/**
 * The mini-DAW's musical side of the sheet-music system: every collectible fragment IS one placeable sound
 * byte, so the timeline the player arranges is built entirely out of objects they actually engaged with in
 * the room. Each of the 20 sheet pieces is paired with one real recorded stem from the finished song (see
 * SOUND_BYTE_FILES below) — the same id is used as the sheet-music piece id, the sound-byte id, the DAW
 * clip id, and the save-file key, so there is exactly one stable identifier per sound all the way through.
 */
// The arrangement grid's shape: one lane per sound byte, a 16-step bar, played back at a fixed, unhurried
// tempo. Still a gameplay representation of composing, not a real sequencer — just a bigger canvas.
export const DAW_TRACK_COUNT = 20;
export const DAW_STEP_COUNT = 16;
export const DAW_STEP_MS = 320; // playhead dwell time per step while playing

export type SoundByteGroup = 'setup' | 'instrument' | 'voice' | 'life';

export type SoundByte = {
  id: string;          // == the sheet-piece id it's unlocked by
  label: string;
  group: SoundByteGroup;
  play: (volume?: number) => void; // volume 0–1, driven by the DAW's per-track mixer (see game-store trackVolume)
};

const GROUP_BY_ID: Record<string, SoundByteGroup> = {
  laptop: 'setup', modularSynths: 'setup', mechanicalKeyboard: 'setup', dualMonitors: 'setup', studioMonitors: 'setup',
  portasound: 'instrument', sk5: 'instrument', acousticGuitar: 'instrument', electricGuitar: 'instrument', mic: 'instrument',
  ukulele: 'voice', lyricNotebook: 'voice', audioInterface: 'voice', shelves: 'voice', window: 'voice',
  bed: 'life', miniFridge: 'life', switch: 'life', vodka: 'life', cigarettes: 'life',
};

/**
 * Canonical piece id → real audio file mapping. These are the 20 actual recorded stems from the finished
 * song ("SOUND BYTES FOR MMHA GAME/"), copied verbatim into public/assets/audio/sound-bytes/<id>.wav (renamed
 * from their original session names to the stable interaction id, nothing else changed). Chosen by ear/fit
 * against each object — e.g. the mic gets the lead vocal stem, the modular rack gets the bass, the mechanical
 * keyboard gets a clicky hat layer — but the specific pairing is cosmetic; what matters is that it's fixed:
 * every piece has exactly one file, every file is used exactly once, and this table is the only place the
 * pairing is decided.
 */
const SOUND_BYTE_FILES: Record<string, string> = {
  laptop: 'laptop.wav',                       // SYNTH PAD
  modularSynths: 'modularSynths.wav',         // SYNTH BASS
  mechanicalKeyboard: 'mechanicalKeyboard.wav', // HAT LAYER
  dualMonitors: 'dualMonitors.wav',           // HAT LAYER 2
  studioMonitors: 'studioMonitors.wav',       // WAVY SYNTH THAT MADE THIS SONG
  portasound: 'portasound.wav',               // SYNTH KEYS
  sk5: 'sk5.wav',                             // 3 NOTE SYNTH
  acousticGuitar: 'acousticGuitar.wav',       // MAIN GUITAR
  electricGuitar: 'electricGuitar.wav',       // LFO SYNTH
  mic: 'mic.wav',                             // MAIN VOCALS
  ukulele: 'ukulele.wav',                     // 3 NOTE SYNTH HIGH
  lyricNotebook: 'lyricNotebook.wav',         // SHAKER
  audioInterface: 'audioInterface.wav',       // BACKING VOX
  shelves: 'shelves.wav',                     // SNARE LAYER 2
  window: 'window.wav',                       // EAGLE
  bed: 'bed.wav',                             // KICK LAYER
  miniFridge: 'miniFridge.wav',               // HAT LAYER 3
  switch: 'switch.wav',                       // SNARE ROLL
  vodka: 'vodka.wav',                         // SNARE
  cigarettes: 'cigarettes.wav',               // KICK LAYER 2
};

// Preload every real stem once, as soon as this module is imported, so the first DAW trigger never stalls
// on a fetch — decoded AudioBuffers are cached and reused for every subsequent play() of that id.
if (typeof window !== 'undefined') {
  preloadSoundByteSamples(
    Object.fromEntries(Object.entries(SOUND_BYTE_FILES).map(([id, file]) => [id, `/assets/audio/sound-bytes/${file}`])),
  );
}

export const GROUP_COLOR: Record<SoundByteGroup, string> = {
  setup: '#4f8f9c',
  instrument: '#d85d58',
  voice: '#6d9c7b',
  life: '#c6798d',
};

/** One sound byte per sheet piece, in the same order — built once (module scope). Every byte plays its own
 *  real recorded stem via the shared, preloaded AudioBuffer cache (see sound-byte-samples.ts). */
export const SOUND_BYTES: readonly SoundByte[] = SHEET_PIECE_IDS.map((id) => ({
  id,
  label: pieceLabel(id),
  group: GROUP_BY_ID[id] ?? 'setup',
  play: (volume) => playSoundByteSample(id, volume),
}));

export const soundByteById = Object.fromEntries(SOUND_BYTES.map((b) => [b.id, b])) as Record<string, SoundByte>;
