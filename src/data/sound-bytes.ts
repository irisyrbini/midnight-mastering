import { SHEET_PIECE_IDS, pieceLabel } from './sheet-music';
import {
  playAcousticStrum, playElectricStrum, playKeyboardChord, playModularPatch,
  playUkuleleStrum, playScribble, playSoundByteTone,
} from '@/game/audio/sfx';

/**
 * The mini-DAW's musical side of the sheet-music system: every collectible fragment IS one placeable sound
 * byte, so the timeline the player arranges is built entirely out of objects they actually engaged with in
 * the room. Where a real instrument already has its own synthesized SFX (the guitars, the keyboards, the
 * modular rack, the ukulele, the notebook's scribble), that same sound plays here too — so the DAW feels
 * connected to the room, not a disconnected minigame. Everything else gets a plain synthesized note; all 13
 * of those notes share one C-major-pentatonic run (C D E G A across three octaves), so ANY combination the
 * player drops onto the timeline stays consonant — the "song" can't be made to sound wrong.
 */
// The arrangement grid's shape: 4 lanes, an 8-step bar, played back at a fixed, unhurried tempo. Deliberately
// small — this is a gameplay representation of composing, not a real sequencer.
export const DAW_TRACK_COUNT = 4;
export const DAW_STEP_COUNT = 8;
export const DAW_STEP_MS = 320; // playhead dwell time per step while playing

export type SoundByteGroup = 'setup' | 'instrument' | 'voice' | 'life';

export type SoundByte = {
  id: string;          // == the sheet-piece id it's unlocked by
  label: string;
  group: SoundByteGroup;
  play: () => void;
};

const GROUP_BY_ID: Record<string, SoundByteGroup> = {
  laptop: 'setup', modularSynths: 'setup', mechanicalKeyboard: 'setup', dualMonitors: 'setup', studioMonitors: 'setup',
  portasound: 'instrument', sk5: 'instrument', acousticGuitar: 'instrument', electricGuitar: 'instrument', mic: 'instrument',
  ukulele: 'voice', lyricNotebook: 'voice', audioInterface: 'voice', shelves: 'voice', window: 'voice',
  bed: 'life', miniFridge: 'life', switch: 'life', vodka: 'life', cigarettes: 'life',
};

/** Objects with a real bespoke instrument sound already in the game — reused verbatim as their clip. */
const BESPOKE_SFX: Record<string, () => void> = {
  acousticGuitar: playAcousticStrum,
  electricGuitar: playElectricStrum,
  portasound: playKeyboardChord,
  sk5: playKeyboardChord,
  modularSynths: playModularPatch,
  ukulele: playUkuleleStrum,
  lyricNotebook: playScribble,
};

/** C-major pentatonic across three octaves — any subset harmonizes, so composing can't sound bad. */
const PENTATONIC_SCALE = [
  130.81, 146.83, 164.81, 196.0, 220.0, // C3 D3 E3 G3 A3
  261.63, 293.66, 329.63, 392.0, 440.0, // C4 D4 E4 G4 A4
  523.25, 587.33, 659.25,               // C5 D5 E5
];

export const GROUP_COLOR: Record<SoundByteGroup, string> = {
  setup: '#4f8f9c',
  instrument: '#d85d58',
  voice: '#6d9c7b',
  life: '#c6798d',
};

/** One sound byte per sheet piece, in the same order — built once (module scope; the underlying sfx
 *  functions are stable references, so this never needs to be recomputed at render time). */
export const SOUND_BYTES: readonly SoundByte[] = (() => {
  let scaleStep = 0;
  return SHEET_PIECE_IDS.map((id) => {
    const bespoke = BESPOKE_SFX[id];
    const play = bespoke ?? (() => playSoundByteTone(PENTATONIC_SCALE[scaleStep % PENTATONIC_SCALE.length]));
    if (!bespoke) scaleStep += 1;
    return { id, label: pieceLabel(id), group: GROUP_BY_ID[id] ?? 'setup', play };
  });
})();

export const soundByteById = Object.fromEntries(SOUND_BYTES.map((b) => [b.id, b])) as Record<string, SoundByte>;
