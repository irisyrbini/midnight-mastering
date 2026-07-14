/**
 * Per-object inspection media, shown in the interaction overlay when you interact with an item
 * (like inspecting an item in a game).
 *
 * HOW TO ADD YOUR OWN IMAGE / VIDEO:
 *   1. Drop the file into   public/assets/interactions/    e.g. public/assets/interactions/vodka.jpg
 *      (supported: .jpg .png .webp .gif images, .mp4 .webm videos)
 *   2. Register it below, keyed by the object's id. The list of ids is in src/data/interactions.ts
 *      (e.g. vodka, portasound, musicDesk, bed, window, acousticGuitar, ...).
 *
 * Anything in /public is served from the site root, so a file at
 *   public/assets/interactions/vodka.jpg   →   src: '/assets/interactions/vodka.jpg'
 *
 * Items without an entry here fall back to the procedural "session playback" visual.
 */
export type InteractionMedia = { type: 'image' | 'video'; src: string; caption?: string };

export const INTERACTION_MEDIA: Record<string, InteractionMedia> = {
  // Your uploaded clip — shows when you interact with the music production desk.
  musicDesk: { type: 'video', src: '/assets/interactions/desk.mp4' },

  // --- Add more the same way: drop a file in public/assets/interactions/ then add a line here ---
  // vodka: { type: 'image', src: '/assets/interactions/vodka.jpg', caption: 'Cheap vodka, half gone.' },
  // portasound: { type: 'video', src: '/assets/interactions/portasound.mp4' },
};
