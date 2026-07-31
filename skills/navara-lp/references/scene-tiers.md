# LP scene tiers — the "4 API tiers, 1 engine" showcase

Reference for [navara-lp](../SKILL.md). The docs LP `.lp-api-stage`
(`docs/src/components/LandingPage.astro`) cross-fades four stills of **one place**
rendered in four independent looks — each look demonstrates one Navara capability
tier. The stills come from a single capture-only example page; the tier labels,
per-tier captions, and scene descriptions live in the LP locale strings. On the LP
the four looks are presented behind an **editorial open-circle diagram** (bottom-
right corner) — `Declarative` at the core, `Plugin` / `API` / `Shader` on the ring,
the active label glowing — with a per-tier caption overlaid bottom-left.

Also read [navara-usage/SKILL.md](../../navara-usage/SKILL.md) (setup order, lighting,
recipes) and [navara-add-example/SKILL.md](../../navara-add-example/SKILL.md)
(example conventions, screenshot script). This is the distilled recipe on top of those.

## Files

- `web/navara_three/example/pages/lp-tiers/` — the capture page
  - `main.ts` — `new ThreeView({ shadow: true, backgroundColor })` then `run(view).then(() => initializeExample(view))`. Sets a gray `backgroundColor` for the plain scenes (stands in for sky); leaves it default (photoreal sky) otherwise. `initializeExample` posts the `navara-example:scene-loaded` signal once tiles settle so the screenshot tooling can wait for the buildings.
  - `run.ts` — one `run()` that branches on `scene` (1–4) for camera-shared, look-specific setup.
  - `lights.ts` — night light field: real OSM street lamps + hand-placed building accents → `FogLightDefinition[]`.
  - `street-lamps.ts` — baked real `highway=street_lamp` coords (see "Real street lamps").
- `docs/src/assets/lp/why-tier-{1..4}.avif` — the captured stills.
- `docs/src/data/lp.json` — `images.why-tier-{1..4}` slots point at those assets.
- `docs/src/data/lp-locales/{en,ja}.json` — `why.apiEyebrow` / `why.apiHeading` / `why.apiSub` (section intro) + `why.apiSegments[]` (`{label, scene, desc}` per tier — `label` is the English ring word, `scene` the grey inline "what the still shows", `desc` the tier explanation), `why.imageAlts.why-tier-*`, `why.mediaAttribution` (array), `why.mediaAttributionLabel`.

## The capture-page pattern

- **One fixed camera, N looks.** `scene` is read from `?scene=1..4` (default 4). The camera (`view.setCamera`) and the base data (terrain + PLATEAU buildings) are identical across scenes; only lighting/effects/styling branch. This keeps the stills a coherent "same place, different capability" set.
- **No UI.** The page exists to be screenshotted — no Tweakpane, no buttons. `export const scene` so `main.ts` can read it for `backgroundColor`.
- **Reproducible.** Fix `view.atmosphere.date` to explicit UTC instants (never `new Date()` — sun position must be deterministic). Bake any external data (see street lamps). Any per-lamp variation uses a deterministic `sin`-hash jitter, not `Math.random`.
- **Camera framing:** low over the Babasaki moat (`height: 120, pitch: -6, heading: 42`) so the Marunouchi tower wall runs unbroken across the frame and the horizon ground is hidden behind buildings, with sky above. Lower height + shallower pitch = more impact, less empty ground.

## The four look recipes (goal → composition)

Shared base every scene: quantized-mesh terrain (`reearthQuantizedMesh`, `requestVertexNormals: true`) + a `papers.reearth.land` paper basemap draped as raster + PLATEAU Chiyoda/Chuo 3D Tiles as white models.

1. **Declarative style (plain white model, with shadows).** No atmosphere. `ambient {intensity:0.15}` + `sun {intensity:1, applyColor:true}` + `ssao {}` + `toneMapping NEUTRAL`, exposure 4. White paper basemap **tinted to the backdrop gray** (`rasterTile.color #9aa2ae`) so ground and the gray `backgroundColor` merge into one stage. Shadows on. Afternoon-ish shared day sun.

**Anti-aliasing:** the plain scenes (1 & 3) add `smaa {}` explicitly (`if (isPlainScene) view.addEffect({ smaa: {} })`); the photoreal scenes (2 & 4) already run SMAA via `addDefaultPhotorealScene()`, so adding it again there throws `duplicate name: smaa`. Keep the `isPlainScene` guard.
2. **Plugins (photoreal).** `defaultPlugin.addDefaultPhotorealScene()` (sky+sun+skyLightProbe in one call) + `clouds {qualityPreset:"high"}`. HDR pipeline needs raised exposure (~5). Sun `castShadow: true`. This is the "one line and the world lights up" tier.
3. **Low-level control (per-feature coloring, shadow-free).** Same plain look as scene 1 but shadows **off** so the data colors read flat. `layer.on("featureUpdated", ({evaluator}) => evaluator.evaluate(...))` colors each building by `bldg:measuredHeight` through `ORANGES_COLOR_MAP.linear(0.3 + t*0.7)` (skip the near-white low end). Data colors = warm (orange), contrasting the brand teal.
4. **Custom shaders (night FogLight).** Night `NIGHT_DATE`; buildings tinted blue-gray (`#5d6884`) so warm lights pop; brighter stars (`intensity:150`), mild `skyLightProbe`, a night `lightProbe` (SH from `helpers/sh`). `FogLightEffectDesc` with `createCityLights()`. See "Night FogLight tuning".

## Night FogLight tuning (hard-won)

- **Ground must be dark at night.** Plain rasters are unlit and render white even at night → drape the **black** paper style (`papers.reearth.land/styles/black/...`) or a hillshade (carries normals) so only the fog lights read. Never leave bare terrain or a light raster.
- **`fogDensity`** low (~0.1) reads as clear night air with lamps softly diffusing; high (~0.35) reads as thick haze. Lower for "clear night, atmospheric diffusion".
- **`useSurfaceLighting: true`** makes the fog lights reflect onto building faces and the ground (warm lower floors). Off = pure volumetric orbs, darker buildings.
- **Lamp height matters.** Street lamps placed at their real ~10 m sit in/under the terrain and pool into a flat ground haze. Lift them (~55 m here) so each reads as a glowing orb floating above the surface.
- Exposure ~12 at night (vs ~5 day); clouds are day-only (at night they wash the scene pale).

## Real street lamps (OSM via Overpass, baked)

`lights.ts` builds street lamps from real `highway=street_lamp` positions, not guessed lines. To (re)fetch:

- Overpass query (bbox = camera view): `node["highway"="street_lamp"](S,W,N,E);out;`
- `overpass-api.de` 406s without a `User-Agent`; `overpass.kumi.systems` works with `-A "navara-lp-dev/1.0"` and `--data-urlencode "data=..."`. Retry across endpoints (transient 504s).
- Bake the coords into `street-lamps.ts` as `[lng,lat][]` with a dated comment + `© OpenStreetMap contributors (ODbL)` — captures must be offline-reproducible.
- Building/station **accents** (Tokyo Station, Marunouchi/Otemachi tower crowns) are hand-placed in `lights.ts` — those are building lights, not street lamps.

## Capture workflow

1. `pnpm --filter @navaramap/three dev` (picks next free port; pass it via `SERVER_URL`).
2. Playwright **with a real GPU — `chromium.launch({ headless: false })`** (the single most important thing here). Playwright's *headless* Chromium falls back to **SwiftShader (software GL)**, which renders the post-processing wrong: SSAO / SMAA / FogLight make buildings come out **semi-transparent** and the terrain / basemap detail is heavily under-rendered — looks "not loaded" even though it is. Headful uses ANGLE Metal (verify via `WEBGL_debug_renderer_info` → should read *ANGLE Metal*, not *SwiftShader*) and matches the live device. Load `/lp-tiers?scene=N`, `waitUntil:"networkidle"`, hide non-canvas UI (`body :not(canvas):not(:has(canvas)){display:none!important}`), wait ~90 s (3D Tiles + terrain stream over the network; the engine never fully idles, so a generous fixed wait past the visible settle is simplest), screenshot at **1920×1200** (16/10; upped from 1200×750 once the LP made the still a full-bleed hero — same aspect, so framing unchanged). **Capture each scene in its own freshly-launched browser** — a shared headful browser sometimes closes mid-run.
3. Convert PNG → AVIF (`sharp(...).avif({quality:60})`, run under `web/navara_three` for its `sharp`) into `docs/src/assets/lp/why-tier-N.avif`.
4. The index thumbnail: add `"lp-tiers": { waitTime: 20000 }` to `PAGE_CONFIGS` in `scripts/generate-screenshots.ts`, then `pnpm navara_three screenshots lp-tiers`.
5. Rebuild docs; verify the LP showcase (cross-fade + synced ring-label glow / caption highlight; ring in the bottom-right corner).
6. From repo root: `pnpm run build:example`, `pnpm run format`, `pnpm run lint`.

Only re-shoot the scene(s) you changed. Iterate on look by eye — screenshot, view, tune exposure/fog/lights, repeat.

## Attribution

Credits come from `helpers/constants.ts` `attribution` fields (PLATEAU wards, `© Re:Earth Terrain`) plus the paper basemap's tilejson credit (`Re:Earth Papers · Protomaps · © OpenStreetMap contributors`, which also covers the baked OSM lamps). On the LP they render via the reusable `ImageAttribution.astro` — see [navara-lp/SKILL.md](../SKILL.md).
