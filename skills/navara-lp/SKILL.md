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
- `docs/src/data/lp.json` — **theme colors, image slots, external links** (not copy). Colors: `primary`/`accent`/`sub`/`maplibre` (fed as CSS vars `--pri`/`--acc`/`--sub`/`--ml`; the derived `--ink*`/`--on-dark*`/`--line*` vars come from these). `images.<slot>.src` is a **repo-root-relative** path into `docs/src/assets` or `web/navara_three/example/public/screenshots`, resolved by `resolveImage`.
- `docs/src/data/lp-locales/<locale>.json` — **all copy**, per locale. `en` is `ROOT_LOCALE` (served at `/`, others under `/<locale>/`). Image **alt text lives here**, in `imageAlts` keyed by the lp.json slot id (a missing alt throws at build).

To add a locale: add its `lp-locales/<code>.json` and a page rendering `<LandingPage locale="code" />`.

## Conventions

- **Never hardcode copy or colors in the component** — copy → locale JSON, theme → `lp.json`. Markup pulls both via `t.*` and the `--pri/--acc/...` vars.
- **Images** go through slots: define in `lp.json`, alt in every locale's `imageAlts`, reference with the `src(id)` / `alt(id)` helpers. Prefer AVIF for photos.
- **Reveal-on-scroll:** mark elements `data-reveal` (individually) or a container `data-reveal-group` (staggers children via `--rd`/`--rd-base`). Hidden states only exist under `prefers-reduced-motion: no-preference`, so reduced motion is a no-op. Don't reinvent entrance animation — reuse these hooks.
- **Theme-derived tints:** use `color-mix(in oklab, var(--pri), white NN%)` (matching the existing `--ink*`/`--line*` derivations) rather than raw hex, so a theme change in `lp.json` propagates.
- **Pre-release:** the LP is parked under `/lp` (`lpPathOf`) and carries `<meta name="robots" content="noindex,nofollow">`. Leave both until release.
- **Code snippets (`.lp-hello` HELLO WORLD section):** the snippet is language-agnostic, so it lives in the component frontmatter (`helloCode`), not the locale JSONs — explanations stay in localized copy, code comments in English. Rendered with Astro's `<Code theme="css-variables">`; the `--astro-code-*` vars on `.lp-hello-code` map Shiki onto the LP palette so a theme change propagates. Every API call must be real (it's a TileJSON-based variant of the docs' Getting Started example — the TileJSON document supplies tile URL, zoom range, and attribution); verify against the docs before editing.
- **MapLibre section is parked** behind `SHOW_MAPLIBRE = false` in the component frontmatter (copy and image slots kept); flip to true to bring it back.

## Reusable components

- **`docs/src/components/ImageAttribution.astro`** — data-attribution overlay: an info icon that reveals a per-source credit list on hover/focus (no plate, never overflows). Props: `items: string[]`, `label`, `corner` (`br`/`bl`/`tr`/`tl`), `class`. Drop inside any `position: relative` image wrapper. Use it for **any** credited image, not just the LP. Source the credit strings from `web/navara_three/example/helpers/constants.ts` `attribution` fields (+ a basemap tilejson's own credit).

## Build & verify

- `cd docs && pnpm build` (whole docs site) — LP copy/image errors surface here (missing alt, missing image, unknown slot).
- Verify interactive bits headlessly (Playwright against `pnpm preview`): reveal-on-scroll, the tier showcase cross-fade + synced list/caption highlight, the attribution tooltip. **Look at the screenshots** — a clean build can still be visually wrong.
- After Rust/WASM-adjacent changes elsewhere, also run repo-root `pnpm run build:example`, `format`, `lint`.

## References

- **[references/scene-tiers.md](references/scene-tiers.md)** — the "4 API tiers, 1 engine" showcase (`.lp-api-stage`: cross-fading stills behind a bottom-right editorial open-circle ring — Declarative core, Plugin/API/Shader on the ring): building the fixed-camera, multi-look capture page (`web/navara_three/example/pages/lp-tiers/`), the four look recipes, night FogLight tuning, real OSM street lamps, and the capture→AVIF→slots workflow. Read this before creating or re-shooting those stills.
