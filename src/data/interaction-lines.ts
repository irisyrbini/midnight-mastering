import type { Interaction } from '@/types/game';
import type { GameState } from '@/store/game-store';
import { pieceIndex } from './sheet-music';

/**
 * The little sentences that come up when something in the room is used. The first use of an object always
 * says its description (which may carry a how-to hint); after that a variant is picked so the fifth strum
 * doesn't read like the first. Some variants only fit a moment (the small hours, rain, a tired body, a heavy
 * night, the score made whole) and are preferred when that moment is true. The voice is a whisper —
 * permission, not instruction. Mirrors the Unity build's InteractionLines.
 */
type Moment = (s: GameState) => boolean;
type Line = { text: string; when?: Moment };

const hour = (s: GameState) => s.clock.minuteOfDay / 60;
const smallHours: Moment = (s) => hour(s) >= 1 && hour(s) < 5;
const dawn: Moment = (s) => hour(s) >= 5 && hour(s) < 8;
const daytime: Moment = (s) => hour(s) >= 9 && hour(s) < 18;
const raining: Moment = (s) => s.weather === 'rain' || s.weather === 'hail';
const tired: Moment = (s) => s.needs.energy < 30;
const hungry: Moment = (s) => s.needs.hunger < 30;
const lonely: Moment = (s) => s.needs.social < 30;
const heavy: Moment = (s) => s.stress > 65;
const light: Moment = (s) => s.stress < 25;
const nearlyThere: Moment = (s) => s.albumProgress >= 70 && !s.albumCompleted;

const L = (text: string, when?: Moment): Line => ({ text, when });

const VARIANTS: Record<string, Line[]> = {
  musicDesk: [L('The session is where you left it.'), L('Same desk, a slightly different you.'), L('Pick up one loose end. Just one.', heavy), L('The record is closer than it feels.', nearlyThere)],
  laptop: [L('The project file opens. Nothing was lost.'), L('Play it from the top, before judging it.'), L('The screen is the brightest thing in the room.', smallHours), L('Almost there. Be gentle with the last parts.', nearlyThere)],
  instrumentTable: [L('Everything is within reach tonight.'), L('Let your hand choose, not your head.')],
  chair: [L('Sit. The room can hold you for a minute.'), L('The chair creaks like it knows you.'), L('Sitting down is allowed.', tired)],
  friendChair: [L("Someone's warmth used to be here."), L('Keep it close. People do come back.', lonely)],
  dualMonitors: [L('Another episode. The colors do some of the work.'), L('A story where someone else finishes things.'), L('The rain and the soundtrack blur together.', raining)],
  studioMonitors: [L('It sounds better than you remembered.'), L("Listen for what works, not only what's wrong."), L('Quiet enough not to wake the building.', smallHours), L('You can hear the shape of it now.', nearlyThere)],
  bed: [L('The sheets are cool. Let the thoughts go quiet.'), L('Rest is part of the work.'), L('Your body asked first. Listen to it.', tired), L('Rain on the window, slow breathing.', raining), L('Close your eyes before the sun gets in.', dawn)],
  miniFridge: [L('The little light comes on. Something to eat.'), L("Not a meal, but it counts."), L("You forgot to eat again. That's okay. Now you didn't.", hungry)],
  redBull: [L('Cold can, sharp sweetness, borrowed hours.'), L("The heart speeds up. The song doesn't have to.", heavy), L('Maybe sleep would do more.', tired)],
  bathroom: [L('Warm water. The night washes off a little.'), L('Steam fills the mirror. No one to look at for a while.'), L('You come out softer than you went in.', heavy)],
  window: [L("The city hums. You're not the only one awake."), L('Cold air, a little room to breathe.'), L('The rain smells like concrete and somewhere else.', raining), L('The sky is going pale at the edges.', dawn), L('A few windows across the street are still lit.', smallHours)],
  window2: [L('Two windows open. The air finds its way through.'), L('The curtains move, then settle.'), L('Rain drums on the sill.', raining)],
  phone: [L('A few names worth calling.'), L('No need for a reason.'), L("It's late, but someone might still be up.", smallHours), L("You've been alone with this for a while.", lonely)],
  bedPhone: [L('The screen lights the pillow blue.'), L('Someone might answer.', lonely)],
  acousticGuitar: [L('The strings are a little out. You play anyway.'), L("A chord you haven't played in years comes back."), L('Soft enough for the neighbors.', smallHours), L('You play along with the rain.', raining), L('The melody is starting to know where it\'s going.', nearlyThere)],
  electricGuitar: [L("Unplugged, it whispers. That's enough."), L('A riff loops until it becomes a part.'), L('The pickups hum along with the lamp.', smallHours), L('Loud in your head, quiet in the room.', heavy)],
  guitarPedal: [L('A little more drive, a little less fear.'), L('The tone gets warmer, rougher, kinder.'), L('Reverb makes the room bigger than it is.')],
  modularSynths: [L('One cable changes everything. Then another.'), L("A patch you'll never recreate. Record it."), L('The oscillators drift like weather.', raining), L("You lose track of time. That's the good kind.", light)],
  portasound: [L('Tiny keys, honest sound.'), L("A toy melody that's secretly sad."), L('The demo song still plays. You play over it.')],
  sk5: [L('A sample of your own voice, pitched down.'), L('Old sounds become new ones.'), L('You sample the rain from the window.', raining)],
  audioInterface: [L('Green lights. The signal is clean.'), L('Everything routed. Nothing left to set up but you.')],
  mechanicalKeyboard: [L('Click, click. Small decisions.'), L('Rename the file, from final_v7 to final.')],
  mouse: [L('Nudge it by a few milliseconds. It breathes.'), L('Ctrl+S. Then again, just in case.')],
  mic: [L('Your voice sounds strange. Then it sounds like you.'), L("First take. Keep it, even if you don't use it."), L('A whisper take, so no one wakes.', smallHours), L('Your voice is shaking. Record that too.', heavy), L('This one sounds like the record.', nearlyThere)],
  lyricNotebook: [L('Cross out a line. Write it again, truer.'), L("Half a page. That's a verse."), L('Write it like a letter to yourself.', lonely), L('Words come easier at this hour.', smallHours)],
  cigarettes: [L('A bit of quiet in a curl of smoke.'), L('Ideas come quickly and leave just as fast.'), L("You're smoking more than you're playing.", heavy)],
  ashtray: [L('Clean desk, same habits.'), L('Fewer stubs than last night.')],
  vodka: [L('Warmth in the throat, blur at the edges.'), L('A little looser, a little further from the work.'), L('Maybe water next time.', tired), L("It doesn't make the song any better.", heavy)],
  beer: [L('Cold glass, slow sip.'), L('One is plenty tonight.', heavy)],
  switch: [L("One more level. It's allowed."), L('Small goals, quick wins.'), L("The game's music sneaks into your head.", light)],
  shelves: [L('Records you loved before you made any.'), L('A tape labeled "ideas" in your old handwriting.'), L('Dust on the spines. Memories under it.')],
  posters: [L('The faces on the wall have seen every draft.'), L('They started somewhere too.')],
  closet: [L('Something comfortable for the walls.'), L('Clothes for a person who goes out. Maybe tomorrow.'), L("It's day out there. You could go.", daytime)],
  sofa: [L('You sink in. The room watches over you.'), L('A pause, not a quit.'), L('Just for a moment, nothing is due.', heavy)],
  entrance: [L('The corridor light hums.'), L('The door is always there.')],
  ledLights: [L('A new color, a new mood.')],
  pillBottle: [L('Read the label carefully.'), L('Water, a breath, a moment.')],
  cables: [L('One knot loose. The rest can wait.')],
  ukulele: [L('Four strings, no pressure.'), L('Hard to be sad on this. You try anyway.'), L('A tiny sunrise song.', dawn)],
};

const FINISHED = 'You know where this part goes now.';

const uses: Record<string, number> = {};
const lastPicked: Record<string, number> = {};

/** The line for using `interaction` now (counts the use). */
export function interactionLine(interaction: Interaction, state: GameState): string {
  const key = interaction.id.replace(/\d+$/, '') === 'posters' ? 'posters' : interaction.id;
  const previous = uses[interaction.id] ?? 0;
  uses[interaction.id] = previous + 1;
  const variants = VARIANTS[key];
  if (previous === 0 || !variants) return interaction.description;
  if (pieceIndex(interaction.id) >= 0 && state.sheetMusicComplete && Math.random() < 0.25) return FINISHED;

  // Candidates: -1 is the description, then every variant whose moment holds.
  const fitting: number[] = [];
  const plain: number[] = [-1];
  variants.forEach((line, i) => {
    if (!line.when) plain.push(i);
    else if (line.when(state)) fitting.push(i);
  });
  let pool = fitting.length > 0 && Math.random() < 0.65 ? fitting : plain;
  if (pool.length > 1) pool = pool.filter((i) => i !== lastPicked[interaction.id]);
  const pick = pool[Math.floor(Math.random() * pool.length)];
  lastPicked[interaction.id] = pick;
  return pick < 0 ? interaction.description : variants[pick].text;
}
