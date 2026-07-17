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

/** Play the sound cue for an interacted object id, if it has one. */
export function playInteractionSfx(id: string) {
  if (id === 'acousticGuitar') playAcousticStrum();
  else if (id === 'electricGuitar') playElectricStrum();
  else if (id === 'lyricNotebook') playScribble();
}
