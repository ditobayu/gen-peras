# PERAS!

A locally saved, browser-based 3D juice stand game set in a cheerful miniature Indonesian neighborhood. Built with React, TypeScript, Vite, Three.js, and the Web Audio API.

## Run locally

Use Node.js 18 or newer and npm.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. A modern browser with WebGL and hardware acceleration is required. The development server binds to all interfaces for convenient testing on the local network.

```sh
npm test          # Run the simulation and save/reload tests
npm run build    # Type-check, bundle, and generate the offline service worker
npm run preview  # Serve the production build locally
```

The production output is in `dist/`. Deploy that directory to a static host at the origin root, with an `index.html` fallback for routes. No application server, API, login, or database is needed.

## Play

Open for business, read the customer ticket, select a matching recipe and drink preference, then use the main action button to slice and load, blend, pour, and serve. Preparation is animated in the 3D scene. Correct recipes earn the menu price; matching the preference also earns a perfect-serve tip. The inventory is committed when preparation begins, and an order can receive payment only once.

You start with Rp75.000 and 12 portions of each fruit. Business days last eight minutes of active play; panels, pause, and photo mode stop the day clock. The daily serving goal starts at eight customers and grows with progression. You can also close early using **Close for today**, collect the printed receipt, and begin the next day.

Buy fruit at the market, adjust menu prices, customize the vendor, recolor the stand, and purchase equipment or decorations. Upgrades affect the scene and the economy. Recipes, customer preferences, and locations unlock over several days. Occasional heat, rain, shortages, tips, and neighborhood recommendations change demand, purchase prices, cash, or reputation. Customer requests and dialogue use Indonesian.

| Control | Action |
| --- | --- |
| Main action button / **Space** | Open the stand or advance preparation |
| Drag the 3D scene | Orbit the camera |
| Scroll | Zoom |
| **P** | Enter or exit photo mode |
| **Esc** | Exit photo mode or close an ordinary panel |
| Left toolbar | Character, stand upgrades, fruit market, locations, sound, and help |
| Settings | Pause, music/effect volumes, continue, and confirmed reset |

In photo mode, right-drag to reframe, choose a lighting preset, optionally freeze ambient animation, and save an actual PNG from the WebGL canvas. The character studio has its own rotating 3D preview. The `/dev/showroom` route provides inspection controls for the character, camera and lighting, and blend/pour previews.

## Saves and offline play

Progress is stored only in the current browser's `localStorage`, for the current origin. It includes money, inventory, the vendor's appearance, upgrades, locations, receipts, sound settings, and completed-order IDs. A separate local session record remembers the current order and preparation checkpoint. Refresh resumes the saved business; active visual preparation may restart from a safe checkpoint. Completed orders cannot pay twice, and already reserved ingredients are not deducted again.

Storage keys are `peras.save.v1`, `peras.session.v1`, and `peras.stand`. Clearing browser/site data removes that browser's progress. Saves are not synchronized across devices. If browser storage is denied or full, the simulation can still run for the current page session.

The production build creates `dist/sw.js` and registers it after the page loads. After a successful initial visit and service-worker installation, the app shell and local assets are cached for offline use. Service workers require HTTPS, or a localhost origin. The development build does not register a worker.

Gameplay uses no remote API or CDN. Three.js, React, the local fonts, and the rest of the build are served from the same static site. World geometry, character meshes and rigs, fruit, icons, and animations are generated in code. Music and sound effects are synthesized locally using Web Audio; audio starts after interaction.

## Source layout

| File | Responsibility |
| --- | --- |
| `src/main.tsx` | React interface, customer session, preparation stages, day timers, panels, and photo controls |
| `src/engine.ts` | Immutable business simulation, recipes, orders, ingredient reservations, costs, upgrades, events, and versioned persistence |
| `src/GameScene.tsx` | Three.js renderer, camera, lighting, character/prop interactions, scene updates, and PNG capture |
| `src/characters.ts` | Procedural skinned character rig, organic mesh surfaces, face/hair/clothing customization, bone animation, and hand reach |
| `src/world.ts` | Cart, blender, fruit, preparation effects, environmental props, location variations, and visible upgrades |
| `src/sound.ts` | Original procedural marimba score and sound effects |
| `src/icons.tsx` / `src/style.css` | Local illustrated interface assets and responsive styling |
| `scripts/test-engine.mjs` | Runs the shipped engine through inventory, economy, progression, corruption recovery, and save/replay tests |
| `scripts/offline.mjs` | Generates the production asset cache and service worker |

Characters use a code-generated skeleton and skinned geometry with procedural animation. The juice vortex, pouring stream, and splashes are authored visual effects. Locations share the same core stand and use different scenery and atmosphere. These are deliberate, inspectable implementations; the project does not depend on downloaded character models or physical fluid simulation.
