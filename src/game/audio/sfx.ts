/** Tiny Web-Audio SFX — synthesized so no audio files are needed. Triggered from user interactions. */
let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function pluck(ac: AudioContext, freq: number, start: number, dur: number, type: OscillatorType, gainMul: number, cutoff: number) {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  const filter = ac.createBiquadFilter();
  osc.type = type;
  osc.frequency.value = freq;
  filter.type = 'lowpass';
  filter.frequency.value = cutoff;
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(0.2 * gainMul, start + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0006, start + dur);
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ac.destination);
  osc.start(start);
  osc.stop(start + dur + 0.05);
}

const CHORD = [164.81, 196.0, 246.94, 329.63, 392.0]; // Em-ish, low → high

/** Warm, softly strummed acoustic chord. */
export function playAcousticStrum() {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  CHORD.forEach((f, i) => pluck(ac, f, t + i * 0.05, 0.95, 'triangle', 1, 2600));
}

/** Brighter, sustained, slightly overdriven electric chord. */
export function playElectricStrum() {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  CHORD.forEach((f, i) => {
    pluck(ac, f, t + i * 0.03, 1.5, 'sawtooth', 0.7, 1500);
    pluck(ac, f * 2, t + i * 0.03, 1.2, 'square', 0.18, 2200); // a little bite
  });
}

/** Short filtered-noise scratches — a pencil scribbling. */
export function playScribble() {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  for (let i = 0; i < 6; i += 1) {
    const dur = 0.07;
    const buffer = ac.createBuffer(1, Math.floor(ac.sampleRate * dur), ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let j = 0; j < data.length; j += 1) data[j] = (Math.random() * 2 - 1) * (1 - j / data.length);
    const src = ac.createBufferSource();
    src.buffer = buffer;
    const filter = ac.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1700 + Math.random() * 900;
    filter.Q.value = 1.8;
    const gain = ac.createGain();
    gain.gain.value = 0.11;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ac.destination);
    src.start(t + i * 0.09);
  }
}

/** Soft electric-piano chord for the two keyboard instruments. */
export function playKeyboardChord() {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  [261.63, 329.63, 392.0, 523.25].forEach((freq, index) => pluck(ac, freq, t + index * 0.035, 1.35, 'sine', 0.72, 4200));
}

/** Short, non-melodic modular blip used by the collaborator's ambient idle. */
export function playModularPatch() {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  [110, 146.8, 207.7].forEach((freq, index) => pluck(ac, freq * (0.98 + Math.random() * 0.05), t + index * 0.11, 0.7 + Math.random() * 0.5, 'sawtooth', 0.12, 900 + Math.random() * 1000));
}

/** Gentle looping rain ambience: filtered noise, faded in/out so it never snaps on. */
let rainLoop: { src: AudioBufferSourceNode; gain: GainNode } | null = null;

export function startRain() {
  const ac = audio();
  if (!ac || rainLoop) return;
  const buffer = ac.createBuffer(1, Math.floor(ac.sampleRate * 2), ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * 0.6;
  const src = ac.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  const highpass = ac.createBiquadFilter();
  highpass.type = 'highpass';
  highpass.frequency.value = 780;
  const lowpass = ac.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.value = 5200;
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0, ac.currentTime);
  gain.gain.linearRampToValueAtTime(0.05, ac.currentTime + 1.4); // soft fade-in
  src.connect(highpass);
  highpass.connect(lowpass);
  lowpass.connect(gain);
  gain.connect(ac.destination);
  src.start();
  rainLoop = { src, gain };
}

export function stopRain() {
  if (!rainLoop) return;
  const ac = audio();
  const { src, gain } = rainLoop;
  rainLoop = null;
  if (!ac) { try { src.stop(); } catch { /* already stopped */ } return; }
  gain.gain.linearRampToValueAtTime(0, ac.currentTime + 0.9);
  window.setTimeout(() => { try { src.stop(); } catch { /* already stopped */ } }, 1000);
}

/** Play the sound cue for an interacted object id, if it has one. */
export function playInteractionSfx(id: string) {
  if (id === 'acousticGuitar') playAcousticStrum();
  else if (id === 'electricGuitar') playElectricStrum();
  else if (id === 'portasound' || id === 'sk5') playKeyboardChord();
  else if (id === 'lyricNotebook') playScribble();
  else if (id === 'modularSynths') playModularPatch();
}
