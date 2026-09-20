/**
 * Real recorded stems for the mini-DAW's 20 sound bytes (see data/sound-bytes.ts for the id → file
 * mapping and SOUND_BYTE_FILES for the id → url table). Each file is fetched and decoded into an
 * AudioBuffer exactly once and cached — the DAW's step sequencer retriggers the same id many times as
 * its timeline loops, so we never want to re-fetch/re-decode on every play(). A file that fails to load
 * (network error, bad decode) is swallowed: that byte plays nothing rather than throwing and breaking
 * the sequencer or the rest of the game's audio.
 */
let ctx: AudioContext | null = null;

function audioCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

const buffers = new Map<string, AudioBuffer>();
const pending = new Map<string, Promise<void>>();
const playing = new Map<string, AudioBufferSourceNode>();

function load(id: string, url: string): Promise<void> {
  const existing = pending.get(id);
  if (existing) return existing;
  const ac = audioCtx();
  if (!ac) return Promise.resolve();
  const promise = fetch(url)
    .then((res) => res.arrayBuffer())
    .then((data) => ac.decodeAudioData(data))
    .then((buffer) => { buffers.set(id, buffer); })
    .catch((err) => { console.warn(`[sound-byte-samples] failed to load "${id}" from ${url}`, err); });
  pending.set(id, promise);
  return promise;
}

/** Preload every sound byte's real audio once, as soon as the id → url map is known. Safe to call
 *  repeatedly (e.g. on every module import) — already-loading/loaded ids are skipped via `pending`. */
export function preloadSoundByteSamples(files: Record<string, string>) {
  for (const [id, url] of Object.entries(files)) void load(id, url);
}

/** Trigger a sound byte's real sample from the start, at `volume` (0–1, default full). If it's still
 *  sounding from a previous trigger (the DAW's step loop is much shorter than these ~20s stems, so it
 *  comes back around before one finishes), the previous instance is stopped first — one voice per byte,
 *  never a stack of overlapping copies of the same file. No-ops silently if the buffer isn't loaded (or
 *  failed to load), and if `volume` is 0 (the track is muted) it skips starting a source at all. */
export function playSoundByteSample(id: string, volume = 1) {
  const ac = audioCtx();
  const buffer = buffers.get(id);
  if (!ac || !buffer) return;
  playing.get(id)?.stop();
  if (volume <= 0) { playing.delete(id); return; }
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const gain = ac.createGain();
  gain.gain.value = volume;
  src.connect(gain);
  gain.connect(ac.destination);
  src.onended = () => { if (playing.get(id) === src) playing.delete(id); };
  src.start();
  playing.set(id, src);
}

/** Stop every currently-sounding sample immediately — used when the DAW transport stops so nothing keeps
 *  ringing on into silence after Stop is pressed or the panel closes mid-playback. */
export function stopAllSoundByteSamples() {
  for (const src of playing.values()) { try { src.stop(); } catch { /* already stopped */ } }
  playing.clear();
}
