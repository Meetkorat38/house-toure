# 3D Walkthrough Real Estate Site — Build Plan

## Goal
Most real estate sites show a gallery of photos. This project turns a 38-second property tour video into an
explorable 3D house in the browser. Visitors open a link and walk through it in first person, on desktop or
phone. They can look around, tap things to learn about them, and switch the lighting. It works as a sales
tool and as a showcase of what we can build.

Reference: Pinterest pin 890235051341401456. Local copy: `reference/video/source.mp4`
(720×1280, 30 fps, 38.6 s). Frames are in `reference/frames/` (2 fps, 77 frames) and contact sheets in
`reference/sheets/`.

> Use the video only as a reference for layout and style. The site is a 3D interpretation "inspired by" the
> house. It doesn't reuse frames or textures from the video, and it isn't branded as this listing. For a
> real client, swap in their own floor plan or footage and use the same pipeline.

---

## 1. Video analysis (done)

The camera takes one continuous walking path, so the order of the shots shows how the rooms connect:

| Time | Space | Key features to model |
|---|---|---|
| 0:00–0:01 | Entry walk | Pale stone pavers, hedges on both sides, glass-and-steel bridge overhead, glass pivot door |
| 0:01–0:02 | Foyer | Double height, skylight, large abstract art panel, gallery corridor running off it |
| 0:02–0:05 | Great room | Full-width sliding glass wall to the yard, grey sectional, 2 bouclé chairs, stone coffee table, white column |
| 0:05–0:09 | Kitchen + dining | Grey marble waterfall island, 4 white stools, floating wood ceiling panel with LED cove light, glass pendants, dark oven wall |
| 0:10–0:14 | Media lounge | Dark wood slat ceiling with downlights, reeded glass windows, projection screen, low navy sectional, glass coffee table, bar at the back |
| 0:14–0:15 | Gallery corridor | White walls, art, wide oak floor |
| 0:15–0:17 | Family room | Light wood plank ceiling with linear lights, clerestory windows, pivot glass doors, beige sectional, round coffee table |
| 0:17–0:23 | Backyard | Stone stepping pads, lawn, curved pool + spa, loungers, tall hedge, rear facade (2 storeys, dark cladding, pergola) |
| 0:23–0:24 | TV lounge / corridor | Transitional shot |
| 0:24–0:26 | Floating stair | Oak treads, black steel stringer, glass rail, wood-clad wall, double-height window |
| 0:26–0:27 | Upper landing | Glass rail overlooking the void |
| 0:27–0:31 | Primary bedroom | Wood plank ceiling, drop-down TV, glass wall to balcony, curved sofa, cluster side tables, built-in shelves |
| 0:32–0:35 | Roof terrace | Black louvred pergola, outdoor sectionals with striped cushions, teak table, tree views |
| 0:36–0:37 | Primary bath | Freestanding tub, marble floor, glass shower, long double vanity, full-height windows |
| 0:37–0:38 | Walk-in closet | Glass-top island, skylight, linear pendants |

**Material palette:** wide-plank light oak floor, grey veined marble, matte white walls, dark walnut/slatted
ceilings, black steel window frames, pale limestone outdoors, lots of glass.

## 2. Floor plan → `src/data/house.json`
One data file describes the whole house. The 3D scene is generated from it, so layout changes don't need
code changes.

- `floors[]`: level, elevation, ceiling height (ground floor 3.4 m, foyer void 6.8 m)
- `rooms[]`: id, name, polygon (metres), floor and ceiling material, description and area for the info card
- `walls[]`: segments with thickness, plus `openings[]` (door, glass slider, window, pivot door)
- `stairs[]`: start point, direction, tread count, rise
- `props[]`: furniture type, position, rotation, material variant
- `hotspots[]`: interactive points (title, text, action)
- `tourPath[]`: camera keyframes that follow the video's route

The overall size is estimated at about 36 × 18 m. The video has no exact measurements, so proportions are
judged from furniture scale (stool ≈ 0.75 m, door ≈ 2.4 m).

## 3. Tech stack
- **Vite + Three.js (plain JS, no React)**: small bundle, fast load on phones.
- Procedural geometry from `house.json`: walls are extruded with holes cut for openings, and floors and
  ceilings come from the room polygons. Furniture is built from rounded boxes, cylinders and lathe shapes and
  merged/instanced to keep draw calls low.
- **Materials:** `MeshStandardMaterial` / `MeshPhysicalMaterial` (glass, marble clearcoat). Free CC0 PBR
  textures from Poly Haven / ambientCG (oak, marble, limestone, concrete, grass), stored as KTX2/WebP.
- **Lighting:** HDRI sky for reflections, one sun light with shadows on desktop and baked AO on mobile,
  emissive LED strips and pendants, plus a night mode with warm lights switched on.
- **Collision:** a 2D wall grid built from `house.json`, with a capsule that slides along walls. On stairs
  and between levels, eye height follows a sampled floor height.

## 4. Experience design

**Arrival:** a short intro fly-in from above the backyard to the entry walk, then a **"Start the tour"**
button.

**Two modes:**
1. **Guided tour:** the camera follows the `tourPath` route from the video. Next/Prev buttons move between
   rooms and a caption shows each room's name.
2. **Free walk:** first-person control.
   - Desktop: WASD/arrow keys to move, mouse to look (pointer lock), Shift to walk faster.
   - Mobile: virtual joystick on the left thumb, drag to look on the right, tap the floor to walk there.

**UI overlay** (HTML/CSS on top of the canvas):
- Room label that fades in when you enter a room
- Mini-map (top corner) with a "you are here" marker. Tap a room to jump there.
- Floor switch (Ground / Upper)
- Day / evening toggle
- Info hotspots (pulsing dots): kitchen island marble, media screen, pool, primary bath tub, and others.
  Each opens a card with a short description, size and finishes.
- Interactions: open/close the glass sliders, turn the media screen on, switch the pendants on/off, and
  swap floor finish (oak / walnut / stone) as a "customise" demo.
- Contact / "Book a viewing" call to action (placeholder)

**Mobile optimisation:** pixel ratio capped at 1.5, a quality tier picked from GPU and device memory (shadows
off and lower texture resolution on low tier), landscape hint, safe-area insets, a loading screen with a
progress bar, and a total payload target under 15 MB.

## 5. Build phases

**Status (2026-11-11):** Phases 1–4 are done. Phase 5 (materials and lighting) and phase 6 (furniture and
exterior) are done for the **ground floor and backyard only**. The upper floor is hidden: `settings.upperFloor`
is `false` in `house.json`, and the stairs are gated with a "coming soon" note. The upper floor gets the same
treatment once the ground floor is approved.
- CC0 assets live in `public/assets` and are re-fetchable with `node scripts/fetch-assets.mjs`. Sources:
  Poly Haven and ambientCG.
- Comparison of video and render: `reference/compare/comparison.jpg`.
- Run `npm run dev`, then open `http://localhost:5173/?debug` for an FPS readout. Add `?quality=low` or
  `?quality=high` to force a tier.
- Still to do for realism: a dramatic cloud sky, a pool shape closer to the video, lawn mowing stripes,
  baked lighting (Blender), and texture compression (KTX2) to bring the ~80 MB of raw assets down for the web.

| # | Phase | Output | Check |
|---|---|---|---|
| 1 | Scaffold | Vite + Three.js project, render loop, resize, quality tiers | Runs at `localhost:5173` |
| 2 | Floor plan data | `house.json` for both floors, 2D plan preview page | Plan matches the shot sequence above |
| 3 | Blockout | Walls, floors, ceilings, openings, stairs, glass from data | Walk the empty house; proportions look like the frames |
| 4 | Controls + collision | Desktop + mobile first-person, stairs, collisions | No clipping through walls; joystick works at 375 px |
| 5 | Materials + lighting | PBR textures, HDRI, sun, LED coves, night mode | Side-by-side with reference frames per room |
| 6 | Furniture + exterior | Furniture by room, pool/spa water shader, lawn, hedges, pergola | Every row in the table above is represented |
| 7 | UI + interactions | Intro, guided tour, minimap, labels, hotspots, toggles, CTA | Full guided tour plays start to finish |
| 8 | Performance + QA | Merging/instancing, texture compression, mobile tier | ≥ 50 fps desktop, ≥ 30 fps mid-range phone, loads < 5 s |
| 9 | Deploy | Static build → Vercel / Netlify (or GitHub Pages) | Share link opens on phone and desktop |

## 5e. Feedback round: defaults, controls, compact layout, flicker (2026-11-11)
- **Defaults:** golden hour (`?mood=day|evening` overrides) and game mode on for desktop.
- **Game mode without pointer lock:** if the browser blocks pointer lock (embedded views, some
  iframes), game mode falls back to FPS-direction drag-to-look instead of ignoring the mouse.
- **Arrow pad:** translucent on-screen buttons on desktop (↑ ↓ walk, ← → turn); hold to move.
- **Compact layout:** `body.compact` on phones or windows ≤ 640 px wide. It uses 36 px controls,
  an icon-only mood switch, a map behind a toggle button, a full-width room bar, and the joystick
  (touch) or arrow pad (mouse).
- **Flicker fixes:**
  - Camera near/far changed from 0.05/500 to 0.12/380 (about 4× depth precision).
  - Ceiling fixtures and furniture reveals now sit ≥ 4–8 mm proud of their surfaces.
  - Adaptive resolution has hysteresis, so it no longer flips between sizes.

## 5d. Load-time and speed optimisation — done (2026-11-11)
Asset pipeline: `npm run assets:fetch` puts raw CC0 downloads in `assets-src/` (not deployed, about
175 MB). `npm run assets:optimize` writes the web set to `public/assets/` (10 MB, including the phone set):
- Textures are WebP, sized per material (2K only for the oak floor), plus a half-size `.lo` set for phones.
- Each sky is a 1K `.hdr` for lighting (about 1.1 MB) plus a WebP background photo (4K desktop, 2K phone;
  25–125 KB).
- Plant models are single GLB files: welded, simplified, meshopt-compressed, with WebP textures.

| | Before | After |
|---|---|---|
| Downloaded before "Enter" (desktop) | 59.3 MB | ~6.8 MB |
| Downloaded (phone tier) | — | ~3.7 MB |
| Ready (local, warm) | 17.3 s | 2.4–6 s (depends on machine load) |
| Frame, 1280×720 indoors (iGPU) | ~65 ms | ~37 ms |
| Meshes / draw calls | 870 | 420 (furniture merged per 10 m area) |

Other changes:
- Glass is a cheap Fresnel material, not `transmission`; transmission cost about 45% of every frame.
- Shaders compile as soon as the sky lighting arrives (`<link rel=preload>`), in parallel with textures.
- The three.js and post-processing libraries are split into their own cached chunks (`vite.config.js`).
- Debug flags: `?debug` shows startup timing marks in `window.marks`; `?nomerge` turns off mesh merging.

Deploy notes: serve `dist/`. Turn on gzip/brotli (the `.hdr` and `.js` files compress well) and
long-cache headers for `/assets/*`.

## 5c. Upper floor + sky / pool / lawn — done (2026-11-11)
- Day sky: `overcast_soil_puresky` (4K on desktop, 2K on phones).
- Pool area: `src/world/pool.js` builds a round pool, a spa joined to it, a travertine deck ring bulging
  around the spa (circle ∪ rounded-rect outline), outer arc slabs with grass joints, and caustics on the
  pool floor.
- Lawn mowing stripes are done in the shader (`lawnStripes` in `materials.js`).
- Upper floor is enabled (`settings.upperFloor: true`). Furniture lives in `src/world/furnitureUpper.js`
  and the layout in `upperLayout()` in `furnishings.js`. `Navigator` in `nav.js` keeps one grid per floor,
  joined by the stair. The tour has 14 stops.
- Comparison with the video: `reference/compare/upper-and-yard.jpg`.
- Next candidates: merge furniture meshes (~870 meshes means many draw calls), KTX2/WebP texture
  compression (~117 MB raw), then deploy.

## 5b. Controls and lighting — done (2026-11-11)
Code: `src/controls/{input,player,nav,target,tour}.js`, `src/world/moods.js`, `src/ui/hud.js`.
- Evening uses no extra lights. The window area lights move to the ceilings and turn warm, and additive
  "light pools" sit on the floors. Real spotlights cost about 20 s of shader compiling and halved the
  frame rate on integrated GPUs.
- Adaptive resolution (55–100%) keeps motion smooth on slower GPUs. The `?debug` readout shows `res %`.

Original proposal:
- **Desktop:** drag to look (no mouse lock) with smooth, damped turning. Click the floor to glide there,
  with a target ring and path-finding around furniture. WASD stays, with eased movement. Room bar plus a
  guided tour along the video's route. Optional "game mode" with mouse lock.
- **Mobile (option A):** tap the floor to walk, drag to look, a small visible joystick, an optional
  look-by-tilting-the-phone (gyroscope) toggle, room arrows, a guided-tour play button, and a short
  first-time hint.
- **Lighting moods:** Day / Golden hour / Evening switch with a 2 s fade. Matching sky photos (HDRIs) for
  each. Evening uses real downward spotlights from the downlights plus pool lights. Previews:
  `reference/compare/lighting-moods.jpg`.

## 6. Project structure
```
3d real estate/
  reference/          video, frames, contact sheets (input only)
  public/textures/    CC0 PBR textures (ktx2/webp)
  public/hdri/        sky HDRI
  src/
    main.js           bootstrap, loader, quality tier
    data/house.json   floor plan + props + hotspots + tour path
    world/            buildWalls.js, buildRooms.js, buildStairs.js, furniture/*.js, exterior.js, lighting.js
    controls/         firstPerson.js, touchJoystick.js, collision.js, tourCamera.js
    ui/               overlay.html/css, minimap.js, hotspots.js, roomLabel.js
  index.html
```

## 7. Verification
- Run `npm run dev` and walk every room in the browser pane at desktop size and at the mobile preset
  (375×812 touch emulation).
- For each room, compare a screenshot against the matching reference frame (timestamps above).
- Play the guided tour end to end and confirm it visits rooms in the video's order.
- Check FPS with the `?debug` stats overlay. Test the low-tier path by forcing `?quality=low`.
- Do a final check on a real phone using the deployed link.
