# Interaction media (item inspection)

Drop an **image or video** here to show it when the player interacts with an item.

## Steps
1. Put your file in this folder, named however you like (e.g. `vodka.jpg`, `portasound.mp4`).
   - Images: `.jpg` `.png` `.webp` `.gif`
   - Videos: `.mp4` `.webm`
2. Register it in [`src/data/interaction-media.ts`](../../../src/data/interaction-media.ts) under the item's id:

```ts
export const INTERACTION_MEDIA = {
  vodka: { type: 'image', src: '/assets/interactions/vodka.jpg', caption: 'Cheap vodka, half gone.' },
  portasound: { type: 'video', src: '/assets/interactions/portasound.mp4' },
};
```

The item ids are listed in [`src/data/interactions.ts`](../../../src/data/interactions.ts) — e.g.
`musicDesk`, `dualMonitors`, `laptop`, `acousticGuitar`, `bed`, `window`, `vodka`, `cigarettes`, `miniFridge`, etc.

Files in `public/` are served from the site root, so `public/assets/interactions/vodka.jpg` is referenced as `/assets/interactions/vodka.jpg`.
