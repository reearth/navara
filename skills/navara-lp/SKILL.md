---
name: navara-lp
description: >
  How the Navara marketing landing page is built and maintained: file layout,
  the config/copy/image split, theming, i18n, reveal-on-scroll, reusable
  components, and build/verify. Use when editing the LP (docs/src/components/
  LandingPage.astro), its copy or images, or adding LP sections/visuals.
---

# Navara landing page

The marketing LP is a single Astro component with a global `<style>` block, driven
by data files for theme/config, copy, and images. Design reference:
`design_handoff_navara_landing_page`.

## Files & the three-way split

- `docs/src/components/LandingPage.astro` — the whole page (markup + `<style is:global>` + reveal/showcase scripts). Rendered per locale by pages that do `<LandingPage locale="..." />`.
- `docs/src/components/LpHeader.astro` — the site header, **shared with the docs site**: `variant="lp"` (fixed/transparent, frosts via `lp-header-solid` toggled by LandingPage's script, carries the `?color` switcher markup — its behavior script stays in LandingPage) and `variant="docs"` (Starlight `Header` override wraps it, inside Starlight's header shell, with a `search` slot; its LP vars are pinned from `--nv-navy`/`--nv-cream` set in `docs/src/styles/theme.css`). Header markup/styles/lang-select script live here, not in LandingPage. The examples gallery top page mirrors the same design in React (`web/navara_three/example/components/SiteHeader.tsx`).
- `docs/src/data/lp.json` — **theme colors, image slots, external links** (not copy). Colors: `primary`/`accent`/`sub`/`maplibre` (fed as CSS vars `--pri`/`--acc`/`--sub`/`--ml`; the derived `--ink*`/`--on-dark*`/`--line*` vars come from these). `themeVariants` lists candidate primary/sub/accent sets (verbatim from the design palette sheet) for the header preview switcher, revealed only by `?color` in the URL (`?color=<name>` preselects one). Switching rewrites `--pri`/`--sub`/`--acc` at runtime; roles a candidate can't fill without losing contrast fall back to plain black/white via `--pri-ink` (always-dark ink/scrim source, = `--pri` normally), `--on-band` (text on `--pri` bands) and `--on-acc` — and a synthetic resize re-samples the adaptive gallery inks. `images.<slot>.src` is a **repo-root-relative** path into `docs/src/assets` or `web/navara_three/example/public/screenshots`, resolved by `resolveImage`.
- `docs/src/data/lp-locales/<locale>.json` — **all copy**, per locale. `en` is `ROOT_LOCALE` (served at `/`, others under `/<locale>/`). Image **alt text lives here**, in `imageAlts` keyed by the lp.json slot id (a missing alt throws at build).

To add a locale: add its `lp-locales/<code>.json` and a page rendering `<LandingPage locale="code" />`.

## Conventions

- **Never hardcode copy or colors in the component** — copy → locale JSON, theme → `lp.json`. Markup pulls both via `t.*` and the `--pri/--acc/...` vars.
- **Images** go through slots: define in `lp.json`, alt in every locale's `imageAlts`, reference with the `src(id)` / `alt(id)` helpers. Prefer AVIF for photos.
- **Reveal-on-scroll:** mark elements `data-reveal` (individually) or a container `data-reveal-group` (staggers children via `--rd`/`--rd-base`). Hidden states only exist under `prefers-reduced-motion: no-preference`, so reduced motion is a no-op. Don't reinvent entrance animation — reuse these hooks.
- **Theme-derived tints:** use `color-mix(in oklab, var(--pri), white NN%)` (matching the existing `--ink*`/`--line*` derivations) rather than raw hex, so a theme change in `lp.json` propagates.
- **Pre-release:** the LP is parked under `/lp` (`lpPathOf`) and carries `<meta name="robots" content="noindex,nofollow">`. Leave both until release.
- **Code snippets (`.lp-hello` HELLO WORLD section):** the snippet is language-agnostic, so it lives in the component frontmatter (`helloCode`), not the locale JSONs — explanations stay in localized copy, code comments in English. Rendered with Astro's `<Code theme="css-variables">`; the `--astro-code-*` vars on `.lp-hello-code` map Shiki onto the LP palette so a theme change propagates. Every API call must be real (it's a TileJSON-based variant of the docs' Getting Started example — the TileJSON document supplies tile URL, zoom range, and attribution); verify against the docs before editing.
- **Phone gutters are 20px for every band** — keep section padding uniform so
  headings line up down the page; if a visual needs the extra width (the
  `.lp-arch` diagram), let *it* break out with negative margins instead of
  shrinking the section's padding.
- **Stills bake in the example's own attribution button** (bottom-right). Where
  the LP overlays its own `ImageAttribution` the baked one must be cropped away
  — `.lp-hello-visual img` is oversized (`height: 106%`) so the frame clips that
  band at every aspect ratio; don't crop the shared asset, docs pages use it.
- **MapLibre section is parked** behind `SHOW_MAPLIBRE = false` in the component frontmatter (copy and image slots kept); flip to true to bring it back.
- **`.lp-arch` line-art SVGs are inlined** (`?raw` + the `archSvg` helper, classes land on the `<svg>` so the img-era sizing rules still apply) and re-themed by CSS attribute selectors keyed to their baked hexes (`#F4F3EF` → `--sub`, `#090C11` → `--pri-ink`, `#C9C9C9` graticule). Re-exporting those SVGs must keep exactly those values, or the selectors in `LandingPage.astro` must be updated with them.

## Reusable components

- **`docs/src/components/ImageAttribution.astro`** — data-attribution overlay: an info icon that reveals a per-source credit list on hover/focus (no plate, never overflows). Props: `items: string[]`, `label`, `corner` (`br`/`bl`/`tr`/`tl`), `class`. Drop inside any `position: relative` image wrapper. Use it for **any** credited image, not just the LP. Source the credit strings from `web/navara_three/example/helpers/constants.ts` `attribution` fields (+ a basemap tilejson's own credit).

## Brand logo & favicon

- Logo SVGs live in `docs/public/logo/{black,white}/` (horizontal + vertical), mirrored in `web/navara_three/example/public/logo/`. They are the delivered Illustrator exports with the `<i:aipgf>` round-trip block stripped (that block was ~97% of the file size) and the viewBox cropped to the tight content bbox — keep both properties if the assets are ever re-delivered.
- The LP inlines the **black** variants via `?raw` + `logoSvg()` (the black paths carry no `fill` attributes, so CSS `fill: currentColor` re-inks them per surface): `.lp-hero-logo` is the vertical lockup centered over the hero video, `.lp-brand` the horizontal one in the header. The branding hands off on scroll: the header logo is `opacity: 0; visibility: hidden` until `lp-header-solid`, at which point the intro panel has covered the hero lockup. `.lp-video-blocked` clears the hero lockup so the fallback play button gets the center.
- The favicon is the delivered white-bird-on-black-square mark, present as `favicon.png` (72×72, the referenced one) and `favicon.svg` (cleaned like the logos; kept but unreferenced) in both `docs/public/` and `web/.../example/public/`. Three places point at `/favicon.png`: the LP `<head>`, Starlight's `favicon` option in `docs/astro.config.mjs`, and the example's `template.html` (injected into every generated page).

## Build & verify

- `cd docs && pnpm build` (whole docs site) — LP copy/image errors surface here (missing alt, missing image, unknown slot).
- Verify interactive bits headlessly (Playwright against `pnpm preview`): reveal-on-scroll, the tier showcase cross-fade + synced list/caption highlight, the attribution tooltip. **Look at the screenshots** — a clean build can still be visually wrong.
- After Rust/WASM-adjacent changes elsewhere, also run repo-root `pnpm run build:example`, `format`, `lint`.

## Hero video

The hero is the looping promo video (assets in `docs/public/promo/`: desktop +
SP H.264 encodes, AVIF posters of the video's first frame; produced per the
`navara-promo-video` skill). Implementation lives in `LandingPage.astro`
(markup near the top, script mid-file, styles by `.lp-hero`). Hard-won
invariants — do not regress these:

- **iOS never fires `loadeddata` (or decodes a frame) until playback starts**,
  so nothing may gate on it. The fade-in-then-play sequence *primes* instead:
  muted `play()` while the video is transparent, first `playing` event →
  pause + rewind + fade the static first frame in over the poster →
  `play()` again on `transitionend` (with a timeout fallback).
- Autoplay is refused in iOS Low Power Mode and cannot be forced; a
  tap-initiated `play()` still works — a centered play button appears via the
  `lp-video-blocked` class whenever the video is stopped unexpectedly.
- Exiting fullscreen pauses the video, and iOS can pause again *after* a
  successful programmatic resume (teardown race) — so the resume path retries
  and then verifies `paused` before falling back to the play button. The
  deliberate priming pause is excluded from that watchdog
  (`fadeRestartPending`).
- SP (≤640px) picks the smaller encode via `matchMedia`, crops center with
  `object-fit: cover`, and shows a bottom-right fullscreen button
  (`webkitEnterFullscreen` fallback for iPhones without
  `video.requestFullscreen`).
- Reduced motion keeps the AVIF poster; no video src is ever set.
- **Video credits are overlaid, not baked, and scene-synced**: the credit line
  baked into the video's bottom ~3.3% is force-cropped at every aspect ratio —
  poster and video are oversized (`height: 104.5%`, clipped by the hero's
  `overflow: hidden`; cover alone only crops vertically on wide windows, so a
  16:10 window would otherwise show the baked line under the overlay) — and
  the hero
  renders one `ImageAttribution` block per scene (`heroScenes` in the
  frontmatter — credits + `end` boundary in seconds, read off the published
  cut's frames) and a `timeupdate` handler swaps them with playback; past the
  last boundary (the loop-closing still = the dive's first frame) it wraps to
  the first block, which is also the no-JS/reduced-motion state matching the
  poster. The Google logo rides only the Photorealistic-3D-Tiles scenes, whose
  credit list transcribes the per-tile copyright line baked into those frames
  (Google / Landsat / Copernicus / Data SIO… / Airbus for the current cut) —
  read it from the frames, not from the shot code, which only registers the
  static baseline. **Re-cutting the promo means re-reading `heroScenes`
  boundaries and credits from the new take** (extract 1 s frames with ffmpeg;
  zoom the bottom strip for the Google line). Generic
  `.lp-hero img` CSS must stay scoped to `picture img`, or it swallows the
  overlay's logo.
- **`.lp-hero` must keep `overflow: hidden`.** The opening animation
  (`nv-hero-in`) holds the full-viewport poster at scale ~1.045 for 3s;
  unclipped, that widens the document's scrollable area and Chromium keeps the
  stale horizontal scrollbar even after the animation ends (it only clears on
  the next relayout, e.g. scrolling into the reveal sections).
- **Verify on a real iPhone** (`pnpm dev:docs --host`), including Low Power
  Mode on/off — desktop Chromium allows muted autoplay everywhere and cannot
  reproduce any of the above.

## Mobile viewport units and page ends

Desktop Chromium has no dynamic toolbar, so none of this reproduces there —
these were all found on an iPhone.

- **Covering elements use `lvh`, content bands use `svh`.** The first scroll on
  iOS is spent collapsing the toolbar, which grows the viewport from `svh` to
  `lvh`: a sticky hero sized `100svh` uncovers a strip of page background under
  the video exactly while that happens. `.lp-hero` is `100lvh` and publishes
  `--lp-toolbar-h: calc(100lvh - 100svh)`, which its bottom-anchored chrome
  (scroll cue, fullscreen button) adds back so it stays inside the smaller,
  toolbar-shown viewport it is first seen in. `min-height` bands (`.lp-hello`,
  `.lp-outro`) keep `svh` — they must fit the *smaller* viewport.
- **A pin line that must hug the bottom edge uses `dvh`.** `.lp-intro` sticks at
  `calc(100dvh - var(--lp-intro-h))`: with `svh` the panel stops a collapsed
  toolbar's height short of the bottom and leaves a strip of bare video under it,
  with `lvh` it is cut off while the toolbar is out. Only `dvh` follows the
  viewport that is actually on screen.
- **`viewport-fit=cover` + `--lp-safe-*`.** The meta viewport opts into the
  full screen so the full-bleed media (hero video, closing globe still) reaches
  the physical edges on notched phones — without it iOS insets the layout
  viewport and the closing band's image stops short of the bottom. `svh`/`lvh`
  then include the safe areas too, which is what makes the `lvh` hero cover the
  home-indicator strip. Everything that hugs an edge pays the inset back through
  `--lp-safe-l/r/b` (`env(safe-area-inset-*, 0px)` named on `:root`): the header
  and `.lp-container` for the landscape notch, `.lp-intro`, `.lp-footer` and the
  hero's bottom chrome for the home indicator. Because they are custom
  properties, a desktop browser can simulate a notch — append
  `:root{--lp-safe-l:47px;--lp-safe-r:47px;--lp-safe-b:34px}` **to `<body>`**
  (the LP's own `<style is:global>` lives there, so a `<head>` tag would lose
  the cascade).
- **The page can never paint iOS Safari's toolbars — only tint them.**
  `viewport-fit=cover` reaches the display's safe areas, not the browser chrome,
  so "extend the closing image under the URL bar" is not achievable; matching the
  color is. Safari tints its bars from `<meta name="theme-color">` (falling back
  to the page background), so both that meta and the canvas are the closing
  band's `--outro-bg` black, and the bottom reads as one surface.
- **`body`'s background is the document canvas** (`html` sets none), so it shows
  through the sub-pixel remainder of a fractional-height page, during overscroll,
  and as that toolbar tint. It is `--outro-bg` (black, hoisted to `:root`) — a
  light canvas showed as a ~1px white hairline under the closing band on iOS, and
  a `--pri` one as a navy seam below it. Every band paints
  its own background (`.lp-main` carries the light one).

## References

- **[references/scene-tiers.md](references/scene-tiers.md)** — the "4 API tiers, 1 engine" showcase (`.lp-api-stage`: cross-fading stills behind a bottom-right editorial open-circle ring — Declarative core, Plugin/API/Shader on the ring): building the fixed-camera, multi-look capture page (`web/navara_three/example/pages/lp-tiers/`), the four look recipes, night FogLight tuning, real OSM street lamps, and the capture→AVIF→slots workflow. Read this before creating or re-shooting those stills.
