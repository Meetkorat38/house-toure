# Modern Residence · Interactive 3D Tour

A first-person walkthrough of a modern two-storey house, built with Three.js. You can walk every room,
the garden and the pool in the browser, on desktop or on a phone.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:5173. Add `?debug` to show FPS and startup timings, or `?quality=low` /
`?quality=high` to force a quality tier.

## Controls

- **Desktop:** game mode is on by default. Move the mouse to look, and use W A S D or the on-screen
  arrows to walk. Click the floor to walk there. `G` toggles game mode, and `Esc` frees the mouse.
- **Phone:** use the joystick to walk, drag to look, or tap the floor to walk there.
- **Rooms and tour:** pick a room from the room bar, or press **Tour** for a guided walk through
  both floors.
- **Lighting:** switch between Day, Golden hour and Evening.

## Build and deploy

```bash
npm run build      # outputs dist/
```

The project deploys to Vercel as-is (see `vercel.json`). Set `VITE_SITE_URL` (for example
`https://your-domain.com`) in the Vercel project's environment variables, so link previews get
absolute image URLs.

## Assets

`public/assets` already holds the optimised, web-ready set (about 10 MB). To rebuild it from source:

```bash
npm run assets:fetch      # downloads raw CC0 assets into assets-src/
npm run assets:optimize   # writes WebP textures, 1k HDRs + sky images, and meshopt GLBs to public/assets
npm run icons             # regenerates the PNG icons from public/favicon.svg
```

Textures, skies and plant models are CC0 from [Poly Haven](https://polyhaven.com) and
[ambientCG](https://ambientcg.com).

## Structure

- `src/data/house.json`: floor plan (rooms, openings, stairs, exterior).
- `src/world/`: builds the house, furniture, pool and garden, plus materials and lighting moods.
- `src/controls/`: input, player movement, path-finding, the floor target ring, and the guided tour.
- `src/ui/`: the HUD and minimap.
