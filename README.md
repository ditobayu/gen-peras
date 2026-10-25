# PERAS! — The First-Person Update

A locally saved 3D juice stand game in a cheerful miniature Indonesian neighborhood. Version 3 brings the player behind the counter in first person, with labeled ingredient sources, exact visible drop zones, direct drag-and-drop, stable customer queues, and smoother character and workstation animation.

Built with React, TypeScript, Vite, Three.js, and the Web Audio API. The primary camera stays at the player’s side of the counter, gently turning toward the current task. Articulated hands and first-person forearms follow work gestures. Free orbit is available in photo mode.

## Run locally

Use Node.js 18 or newer and npm.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. A modern browser with WebGL and hardware acceleration is required. The development server binds to all interfaces for local network testing.

```sh
npm test          # Business, preparation, persistence, and audio lifecycle tests
npx tsc --noEmit  # Type-check the application
npm run build    # Type-check, bundle, and generate the offline service worker
npm run preview  # Serve the production build locally
```

Deploy `dist/` to a static host at the origin root, with an `index.html` fallback for routes. No application server, API, login, or database is needed.

## Prepare a drink

Open for business and read the customer ticket. Choose the requested recipe and preference before picking the first fruit. Click the order number to expand the compact ticket.

1. **Pick:** hold the labeled fruit at the ingredient trays, drag it along the guide into the outlined **TALENAN** drop zone, and release inside it. Mixed recipes require each listed fruit type. The first accepted pick reserves the recipe’s inventory once.
2. **Slice:** swipe across the fruit on the cutting board three times. Very short pointer movements do not count. The knife and separated pieces respond to accepted gestures.
3. **Load:** drag two grouped fruit portions into the open blender jar. Add ice, unless the drink is ice-free, then drag in water or milk. Each requires its own gesture. The outlined **BLENDER** area turns green when the held item is inside its exact acceptance rectangle. A missed drop returns the material; it does not consume or add anything.
4. **Blend:** hold the blender’s physical switch, watch the mixture and quality indicator, then release. The ideal blend is around 3–4.5 seconds. Releasing before one second lets you continue blending; holding too long produces an overblended result.
5. **Pour:** hold the jar and drag to control tilt and flow. Aim for 88–98% cup fill, then release. A small partial pour can be continued; releasing once the cup is at least 40% full presents it for serving. Pouring over the rim produces spills and reduces quality.
6. **Serve:** drag the finished cup toward the customer. The vendor and customer perform the handoff and reaction. Money is credited once at the reaction checkpoint. The served customer walks away carrying their cup, the visible next person advances with their existing order, and a distinct newcomer joins the back.

Waiting alone does not pick, cut, load, blend, pour, or serve. Blending advances while its switch is held. Liquid flows during pouring, with a brief stream tail after release. Short pickup, cutting, transfer, handoff, and reaction animations respond to accepted input.

Correct recipes earn the menu price. Blend quality, fill, spills, and preference matching determine perfect-serve tips. Incorrect recipes consume their reserved ingredients and earn no payment. Extra-fruit and large-cup preferences reserve additional portions. Completed order IDs prevent duplicate rewards.

## Controls

| Control | Action |
| --- | --- |
| Hold and drag a fruit into TALENAN | Pick an ingredient |
| Swipe across the cutting board | Make one cut |
| Drag portions, ice, water, or milk toward the jar | Load ingredients |
| Hold the blender switch | Blend until released |
| Hold and drag the jar | Pour and control tilt |
| Drag the finished cup toward the customer | Serve |
| **Space** | Open, resume, or perform one assisted pick/cut/load/serve gesture; hold for blending or pouring |
| **Keyboard & assisted controls** | Show alternative controls; blending/pouring still require a hold and release |
| Right-drag during play | Look around from behind the counter |
| Scroll during play | Adjust limited zoom |
| **P** | Enter or exit photo mode |
| **Esc** | Exit photo mode or close an ordinary panel |
| Left toolbar | Character studio, upgrades, market, locations, sound, and help |
| Settings | Pause, volume controls, continue, and confirmed reset |

Pointer gestures support touch. In photo mode, drag to orbit, right-drag to reframe, and scroll or use the zoom controls. Choose a lighting preset, optionally freeze ambient animation, and save an actual PNG from the WebGL canvas. A local postcard preview also provides a download link.

## Your little business

You start with Rp75.000 and 12 portions of each fruit. Days last eight minutes of active play, with a daily serving goal starting at eight customers. Panels, pause, and photo mode stop the day clock. An order already in preparation can finish after closing time. You can close early between orders using **Close for today**, read the receipt, and start the next day.

The existing market, adjustable prices, character customization, stand colors, upgrades, recipes, locations, returning customers, and events remain available. The blender upgrade shortens the hold time needed to reach blend quality. Weather, location, and pricing affect the pause before the next arrival. Shortages, tips, and recommendations can affect purchase prices, money, or reputation. Customer dialogue uses Indonesian. Location variants share the core stand and change scenery and atmosphere.

## Saves and offline play

Progress stays in the current browser’s `localStorage`, for the current origin. Business saves include money, inventory, appearance, upgrades, locations, receipts, settings, and completed-order IDs. The same-day queue saves customer and order identities so a reload keeps the next people in line. Preparation checkpoints retain picked fruit, cuts, grouped loads, blend duration, fill, remaining juice, and spills. Checkpoints save on accepted input and periodically during live simulation.

Refresh restores progress with held controls released. Existing version-one business saves are preserved. Legacy loaded, blended, and ready checkpoints map to corresponding interactive stages without reserving ingredients twice. Opening another game tab transfers write ownership and pauses the older tab to avoid concurrent progress writes.

Main storage keys are `peras.save.v1`, `peras.session.v1`, and `peras.stand`; tab ownership also uses local markers. Clearing site data removes that browser’s progress. Saves do not sync across devices. If storage is unavailable, play can continue for the current page session.

The production build generates `dist/sw.js` and registers it after loading. After a successful initial visit and service-worker installation, the app shell and local assets are cached for offline use. Service workers require HTTPS, or localhost. Development builds do not register a worker. Offline play requires the initial installation and cache fill to have completed.

Gameplay uses no remote API or CDN. React, Three.js, fonts, and build assets come from the same static site. World geometry, character rigs, fruit, icons, and animations are generated locally in code. Music and effects use original procedural Web Audio. Sustained motor and pour sounds follow held controls and fade on release; audio starts after interaction.

## Development inspection

With the development server running, open `/dev/gameplay-lab`. This development-only view uses the same preparation reducer and scene interaction code, with a recipe selector, camera presets, slow motion, interaction reset, live preparation values, character studio, and free camera/lighting controls. Lab simulation and checkpoint writes are isolated from the saved business.

**Replay last gesture** restores the preparation snapshot from the latest recorded interaction and reapplies its reducer input; held interactions can also replay their recorded duration. This is an interaction replay for inspection rather than a video recording. **Motion frames** displays actual WebGL stills captured during representative cutting, blending, pouring, handoff, and reaction moments. Perform the interactions to populate the frame gallery; the images come from the running scene.

## Source layout

| File | Responsibility |
| --- | --- |
| `src/main.tsx` | React entry point and production service-worker registration |
| `src/App.tsx` | Interface, session coordination, reservation, payment, timers, assisted controls, and lab |
| `src/preparation.ts` | Pure input reducer, held-control simulation, quality, liquid conservation, serialization, and legacy checkpoint recovery |
| `src/interaction.ts` | Raycasting, shared mesh/label gesture entry, screen-aligned captured drags, exact visible drop bounds, and cancellation |
| `src/queue.ts` | Stable three-person order queue, distinct arrivals, exact next-person promotion, and reload recovery |
| `src/engine.ts` | Immutable economy, recipes, inventory, upgrades, events, receipts, and business persistence |
| `src/GameScene.tsx` | First-person camera, projected material/drop guidance, stable customer actors, hand/object interaction, lighting, and PNG capture |
| `src/characters.ts` | Procedural skinned rig, customization, animation, expressions, grips, and hand reach |
| `src/world.ts` | Stand, fruit, cut/load states, blender contents, vortex, stream, cup fill, spills, scenery, and upgrades |
| `src/sound.ts` | Procedural music, tactile effects, and sustained held motor/pour audio |
| `src/icons.tsx` / `src/style.css` | Local illustrated interface assets and styling |
| `scripts/test-engine.mjs` | Inventory, economy, progression, persistence, and payout replay tests |
| `scripts/test-preparation.mjs` | Gesture gates, holds, partial pours, quality, conservation, migration, and reaction checkpoints |
| `scripts/test-queue.mjs` | Identity promotion, duplicate callbacks, stock shortages, modifiers, repeated payment/reload cycles, and day transitions |
| `scripts/test-interaction.mjs` | Actual Three ray hits, pointer lifecycle, exact DOM drop bounds, disabled/cancel handling, and drag planes |
| `scripts/test-sound.mjs` | Audio graph reuse, release envelopes, volume/mute, and cleanup; tests lifecycle rather than perceived sound quality |
| `scripts/offline.mjs` | Production asset cache and service-worker generation |

Characters use a code-generated skeleton, skinned geometry, and procedural animation. Fruit separation, the vortex, stream, and splashes use authored visual effects rather than physical fluid simulation. The project needs no downloaded character models or online gameplay services.
